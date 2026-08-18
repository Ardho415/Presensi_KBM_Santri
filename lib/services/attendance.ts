import "server-only";
import { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { toWIBDateString, wibDateTimeToUTC } from "@/lib/timezone";
import { getStudentGroupOnDate } from "@/lib/services/class-history";
import type { AttendanceStatus, ScanResult } from "@/types/domain";

// -----------------------------------------------------------------------
// FINALISASI ALPA OTOMATIS
// -----------------------------------------------------------------------
// Dipanggil secara "lazy" di awal endpoint-endpoint yang membaca/menulis
// data presensi (scan, detail, rekap) DAN oleh Vercel Cron
// (/api/cron/finalize). Dengan begitu status Alpa tetap benar walaupun
// dashboard admin tidak pernah dibuka -- tidak bergantung pada browser
// yang terbuka.
// -----------------------------------------------------------------------
export async function finalizeExpiredSessionGroups(): Promise<number> {
  const supabase = getSupabaseAdmin();
  const now = new Date();

  const { data: candidates, error } = await supabase
    .from("session_groups")
    .select(
      "id, session_id, group_id, opened, finalized, attendance_sessions(session_date, end_time, status), groups(id, class_id, gender, name)"
    )
    .eq("finalized", false)
    .eq("opened", true);

  if (error) throw error;
  if (!candidates || candidates.length === 0) return 0;

  let finalizedCount = 0;

  for (const row of candidates as any[]) {
    const session = row.attendance_sessions;
    const group = row.groups;
    if (!session || !group) continue;

    const endInstant = wibDateTimeToUTC(session.session_date, session.end_time);
    if (now < endInstant) continue; // belum lewat waktu selesai

    await finalizeOneSessionGroup(supabase, {
      sessionGroupId: row.id,
      sessionId: row.session_id,
      sessionDate: session.session_date,
      groupId: group.id,
      classId: group.class_id,
      gender: group.gender,
      groupName: group.name,
    });

    finalizedCount += 1;
  }

  return finalizedCount;
}

async function finalizeOneSessionGroup(
  supabase: SupabaseClient,
  params: {
    sessionGroupId: string;
    sessionId: string;
    sessionDate: string;
    groupId: string;
    classId: string;
    gender: "L" | "P";
    groupName: string;
  }
) {
  // Ambil semua santri aktif yang kelompoknya (berdasarkan histori kelas
  // pada tanggal sesi) sama dengan kelompok sesi ini.
  const { data: activeStudents, error: studentsError } = await supabase
    .from("students")
    .select("id")
    .eq("active", true);

  if (studentsError) throw studentsError;

  const { data: existingRecords, error: recordsError } = await supabase
    .from("attendance_records")
    .select("student_id")
    .eq("session_id", params.sessionId);

  if (recordsError) throw recordsError;
  const alreadyRecorded = new Set((existingRecords ?? []).map((r) => r.student_id));

  const alpaRows: any[] = [];

  for (const s of activeStudents ?? []) {
    if (alreadyRecorded.has(s.id)) continue;

    const group = await getStudentGroupOnDate(supabase, s.id, params.sessionDate);
    if (!group || group.groupId !== params.groupId) continue;

    alpaRows.push({
      session_id: params.sessionId,
      student_id: s.id,
      group_id: params.groupId,
      status: "alpa" as AttendanceStatus,
      scanned_at: null,
      source: "auto_alpa",
      operator_id: null,
      class_id_snapshot: params.classId,
      group_name_snapshot: params.groupName,
      gender_snapshot: params.gender,
    });
  }

  if (alpaRows.length > 0) {
    // insert satu per satu dengan upsert-ignore agar aman terhadap race
    // condition (mis. dua request finalize berjalan bersamaan).
    const { error: insertError } = await supabase
      .from("attendance_records")
      .upsert(alpaRows, { onConflict: "session_id,student_id", ignoreDuplicates: true });
    if (insertError) throw insertError;
  }

  await supabase
    .from("session_groups")
    .update({ finalized: true, finalized_at: new Date().toISOString() })
    .eq("id", params.sessionGroupId);
}

// -----------------------------------------------------------------------
// STATE SESI UNTUK HALAMAN /scan
// -----------------------------------------------------------------------
export type ScannerSessionState =
  | { state: "none" }
  | { state: "not_started"; sessionType: string; label: string; scanStartTime: string }
  | { state: "active"; sessionId: string; sessionType: string; label: string; endTime: string };

export async function getScannerSessionState(): Promise<ScannerSessionState> {
  const supabase = getSupabaseAdmin();
  const now = new Date();
  const todayStr = toWIBDateString(now);

  const { data: sessions, error } = await supabase
    .from("attendance_sessions")
    .select("id, session_type, scan_start_time, on_time_until, end_time, status")
    .eq("session_date", todayStr)
    .eq("status", "open");

  if (error) throw error;
  if (!sessions || sessions.length === 0) return { state: "none" };

  const label = (t: string) => (t === "subuh" ? "Subuh" : "Malam");

  for (const s of sessions) {
    const start = wibDateTimeToUTC(todayStr, s.scan_start_time);
    const end = wibDateTimeToUTC(todayStr, s.end_time);
    if (now >= start && now < end) {
      return {
        state: "active",
        sessionId: s.id,
        sessionType: s.session_type,
        label: label(s.session_type),
        endTime: s.end_time,
      };
    }
  }

  // cari sesi yang belum dimulai, ambil yang paling dekat waktunya
  const upcoming = sessions
    .map((s) => ({ ...s, start: wibDateTimeToUTC(todayStr, s.scan_start_time) }))
    .filter((s) => now < s.start)
    .sort((a, b) => a.start.getTime() - b.start.getTime())[0];

  if (upcoming) {
    return {
      state: "not_started",
      sessionType: upcoming.session_type,
      label: label(upcoming.session_type),
      scanStartTime: upcoming.scan_start_time,
    };
  }

  return { state: "none" };
}

// -----------------------------------------------------------------------
// VALIDASI PETUGAS PRESENSI
// -----------------------------------------------------------------------
export interface OperatorValidationResult {
  ok: boolean;
  message?: string;
  operatorId?: string;
  studentName?: string;
  groupName?: string;
}

export async function validateOperatorByNis(nis: string): Promise<OperatorValidationResult> {
  const supabase = getSupabaseAdmin();

  const { data: student, error: studentError } = await supabase
    .from("students")
    .select("id, name, active")
    .eq("nis", nis.trim())
    .maybeSingle();

  if (studentError) throw studentError;
  if (!student) {
    return { ok: false, message: "NIS petugas tidak terdaftar atau tidak aktif." };
  }
  if (!student.active) {
    return { ok: false, message: "NIS petugas tidak terdaftar atau tidak aktif." };
  }

  const { data: operator, error: operatorError } = await supabase
    .from("attendance_operators")
    .select("id, active, groups(name)")
    .eq("student_id", student.id)
    .eq("active", true)
    .limit(1)
    .maybeSingle();

  if (operatorError) throw operatorError;
  if (!operator) {
    return { ok: false, message: "NIS petugas tidak terdaftar atau tidak aktif." };
  }

  return {
    ok: true,
    operatorId: operator.id,
    studentName: student.name,
    groupName: (operator as any).groups?.name ?? "-",
  };
}

// -----------------------------------------------------------------------
// SCAN ABSENSI (dipakai oleh QR maupun input NIS manual -- aturan sama persis)
// -----------------------------------------------------------------------
export async function scanAttendance(params: {
  nis: string;
  operatorId: string;
}): Promise<ScanResult> {
  const supabase = getSupabaseAdmin();
  const now = new Date();
  const todayStr = toWIBDateString(now);

  // Finalisasi lazy: pastikan sesi yang sudah lewat waktu selesai
  // sudah diproses Alpa-nya sebelum kita cek duplikasi/kondisi lain.
  await finalizeExpiredSessionGroups();

  const nis = params.nis.trim();
  if (!nis) {
    return { ok: false, message: "NIS tidak boleh kosong." };
  }

  // 1. Cari santri
  const { data: student, error: studentError } = await supabase
    .from("students")
    .select("id, name, active")
    .eq("nis", nis)
    .maybeSingle();

  if (studentError) throw studentError;
  if (!student) {
    return { ok: false, message: "Santri tidak ditemukan." };
  }
  if (!student.active) {
    return {
      ok: false,
      message: "Santri sudah tidak aktif dan tidak dapat melakukan presensi.",
    };
  }

  // 2. Cari sesi aktif hari ini
  const { data: sessions, error: sessionsError } = await supabase
    .from("attendance_sessions")
    .select("id, session_date, scan_start_time, on_time_until, end_time, status")
    .eq("session_date", todayStr)
    .eq("status", "open");

  if (sessionsError) throw sessionsError;

  const activeSession = (sessions ?? []).find((s) => {
    const start = wibDateTimeToUTC(todayStr, s.scan_start_time);
    const end = wibDateTimeToUTC(todayStr, s.end_time);
    return now >= start && now < end;
  });

  if (!activeSession) {
    // Bedakan pesan: ada sesi tapi belum mulai / sudah berakhir, vs sama sekali tidak ada
    const notYetStarted = (sessions ?? []).find(
      (s) => now < wibDateTimeToUTC(todayStr, s.scan_start_time)
    );
    if (notYetStarted) {
      return { ok: false, message: "Sesi presensi belum dimulai." };
    }
    const alreadyEnded = (sessions ?? []).find(
      (s) => now >= wibDateTimeToUTC(todayStr, s.end_time)
    );
    if (alreadyEnded) {
      return { ok: false, message: "Sesi presensi telah berakhir." };
    }
    return {
      ok: false,
      message: "Belum ada sesi presensi yang dibuka. Silakan hubungi ketua kelas.",
    };
  }

  // 3. Tentukan kelompok santri pada tanggal ini
  const group = await getStudentGroupOnDate(supabase, student.id, todayStr);
  if (!group) {
    return { ok: false, message: "Data kelas santri tidak valid. Hubungi admin." };
  }

  // 4. Cek kelompok sedang dibuka pada sesi ini
  const { data: sessionGroup, error: sgError } = await supabase
    .from("session_groups")
    .select("id, opened, closed_manually")
    .eq("session_id", activeSession.id)
    .eq("group_id", group.groupId)
    .maybeSingle();

  if (sgError) throw sgError;
  if (!sessionGroup || !sessionGroup.opened || sessionGroup.closed_manually) {
    return { ok: false, message: "Kelas santri tidak sedang dibuka untuk sesi ini." };
  }

  // 5. Tentukan status berdasarkan waktu WIB
  const onTimeUntil = wibDateTimeToUTC(todayStr, activeSession.on_time_until);
  const status: AttendanceStatus = now < onTimeUntil ? "hadir" : "terlambat";

  // 6. Cek duplikasi (pre-check agar pesan lebih ramah; unique constraint
  //    tetap jadi pengaman utama terhadap race condition di langkah 7).
  const { data: existing, error: existingError } = await supabase
    .from("attendance_records")
    .select("id, status")
    .eq("session_id", activeSession.id)
    .eq("student_id", student.id)
    .maybeSingle();

  if (existingError) throw existingError;
  if (existing) {
    return { ok: false, message: `${student.name} sudah melakukan presensi.` };
  }

  // 7. Insert -- unique constraint (session_id, student_id) melindungi
  //    dari race condition apabila dua scan hampir bersamaan lolos
  //    precheck di atas.
  const { error: insertError } = await supabase.from("attendance_records").insert({
    session_id: activeSession.id,
    student_id: student.id,
    group_id: group.groupId,
    status,
    scanned_at: now.toISOString(),
    source: "scan",
    operator_id: params.operatorId,
    class_id_snapshot: group.classId,
    group_name_snapshot: group.groupName,
    gender_snapshot: group.gender,
  });

  if (insertError) {
    if (insertError.code === "23505") {
      // unique_violation -> race condition, sudah ada yang insert lebih dulu
      return { ok: false, message: `${student.name} sudah melakukan presensi.` };
    }
    throw insertError;
  }

  return {
    ok: true,
    message:
      status === "hadir"
        ? `${student.name} berhasil hadir (tepat waktu)!`
        : `${student.name} berhasil hadir (terlambat)!`,
    studentName: student.name,
    status,
  };
}

// -----------------------------------------------------------------------
// EDIT STATUS PRESENSI (Detail Presensi)
// -----------------------------------------------------------------------
// Ketua kelas/pengurus dapat mengubah status kapan saja (bahkan setelah
// sesi selesai), misalnya Alpa -> Sakit ketika info menyusul. Status
// cukup di-overwrite, tidak perlu riwayat perubahan.
export async function editAttendanceStatus(params: {
  sessionId: string;
  studentId: string;
  status: AttendanceStatus;
}): Promise<{ ok: boolean; message: string }> {
  const supabase = getSupabaseAdmin();

  const { data: session, error: sessionError } = await supabase
    .from("attendance_sessions")
    .select("id, session_date")
    .eq("id", params.sessionId)
    .maybeSingle();
  if (sessionError) throw sessionError;
  if (!session) return { ok: false, message: "Sesi tidak ditemukan." };

  const group = await getStudentGroupOnDate(supabase, params.studentId, session.session_date);
  if (!group) return { ok: false, message: "Data kelas santri tidak valid." };

  const { data: sessionGroup, error: sgError } = await supabase
    .from("session_groups")
    .select("id, opened")
    .eq("session_id", params.sessionId)
    .eq("group_id", group.groupId)
    .maybeSingle();
  if (sgError) throw sgError;
  if (!sessionGroup || !sessionGroup.opened) {
    return {
      ok: false,
      message: "Kelompok santri ini tidak dibuka pada sesi tersebut, status tidak dapat diedit.",
    };
  }

  const { data: existing, error: existingError } = await supabase
    .from("attendance_records")
    .select("id, scanned_at")
    .eq("session_id", params.sessionId)
    .eq("student_id", params.studentId)
    .maybeSingle();
  if (existingError) throw existingError;

  if (existing) {
    const { error } = await supabase
      .from("attendance_records")
      .update({ status: params.status, source: "edited" })
      .eq("id", existing.id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("attendance_records").insert({
      session_id: params.sessionId,
      student_id: params.studentId,
      group_id: group.groupId,
      status: params.status,
      scanned_at: null,
      source: "edited",
      operator_id: null,
      class_id_snapshot: group.classId,
      group_name_snapshot: group.groupName,
      gender_snapshot: group.gender,
    });
    if (error) throw error;
  }

  return { ok: true, message: "Status presensi berhasil diperbarui." };
}
