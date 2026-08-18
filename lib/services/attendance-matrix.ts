import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { AttendanceStatus, Gender } from "@/types/domain";

export interface MatrixSessionColumn {
  sessionId: string;
  date: string;
  type: "subuh" | "malam";
  label: string; // contoh: "16 Subuh"
}

export interface MatrixStudentRow {
  studentId: string;
  nis: string;
  name: string;
  currentClassName: string;
  currentGroupName: string;
  currentGender: Gender;
  cells: Record<string, "H" | "T" | "I" | "S" | "A" | "-" | "">; // sessionId -> code
}

interface HistoryEntry {
  classId: string;
  gender: Gender;
  effectiveFrom: string;
  effectiveTo: string | null;
}

function pickGroupForDate(
  history: HistoryEntry[],
  date: string,
  fallback: { classId: string; gender: Gender }
): { classId: string; gender: Gender } {
  const candidates = history
    .filter((h) => h.effectiveFrom <= date && (h.effectiveTo === null || h.effectiveTo >= date))
    .sort((a, b) => (a.effectiveFrom < b.effectiveFrom ? 1 : -1));
  if (candidates.length > 0) {
    return { classId: candidates[0].classId, gender: candidates[0].gender };
  }
  return fallback;
}

/**
 * Membangun data matrix presensi untuk rentang tanggal & filter kelompok
 * tertentu. Dipakai baik oleh Detail Presensi (menampilkan grid) maupun
 * Rekap Presensi (menghitung agregat).
 *
 * PENTING soal desain (didokumentasikan sesuai requirement #53):
 * - Baris (santri mana yang ditampilkan) ditentukan oleh KELAS/KELOMPOK
 *   SAAT INI, sesuai filter dropdown, agar daftar tetap stabil dan mudah
 *   dipahami ketua kelas.
 * - Setiap SEL dihitung berdasarkan kelompok santri PADA TANGGAL SESI
 *   tersebut (via histori kelas), sehingga histori tetap akurat walau
 *   santri pindah kelas di tengah periode (requirement #7 & #41).
 */
export async function buildAttendanceMatrix(params: {
  dateFrom: string;
  dateTo: string;
  groupId?: string; // undefined/"" = semua kelas
  includeInactive?: boolean;
}): Promise<{ sessions: MatrixSessionColumn[]; rows: MatrixStudentRow[] }> {
  const supabase = getSupabaseAdmin();

  // 1. Sessions dalam rentang tanggal
  const { data: sessionRows, error: sessionsError } = await supabase
    .from("attendance_sessions")
    .select("id, session_date, session_type")
    .gte("session_date", params.dateFrom)
    .lte("session_date", params.dateTo)
    .order("session_date", { ascending: true })
    .order("session_type", { ascending: true });
  if (sessionsError) throw sessionsError;

  const sessions: MatrixSessionColumn[] = (sessionRows ?? []).map((s) => ({
    sessionId: s.id,
    date: s.session_date,
    type: s.session_type,
    label: `${parseInt(s.session_date.split("-")[2], 10)} ${s.session_type === "subuh" ? "Subuh" : "Malam"}`,
  }));

  // 2. Santri (baris) sesuai filter kelompok saat ini
  let studentQuery = supabase
    .from("students")
    .select("id, nis, name, class_id, gender, active, classes(name)")
    .order("name", { ascending: true });

  if (!params.includeInactive) {
    // tetap tampilkan semua by default agar histori aman; caller dapat
    // mem-filter aktif saja bila diperlukan lewat parameter terpisah.
  }

  if (params.groupId) {
    const { data: group, error: groupError } = await supabase
      .from("groups")
      .select("class_id, gender")
      .eq("id", params.groupId)
      .single();
    if (groupError) throw groupError;
    studentQuery = studentQuery.eq("class_id", group.class_id).eq("gender", group.gender);
  }

  const { data: studentRows, error: studentsError } = await studentQuery;
  if (studentsError) throw studentsError;

  if (!studentRows || studentRows.length === 0 || sessions.length === 0) {
    return { sessions, rows: [] };
  }

  const studentIds = studentRows.map((s) => s.id);
  const sessionIds = sessions.map((s) => s.sessionId);

  // 3. Semua groups untuk mapping classId+gender -> groupName & groupId
  const { data: allGroups, error: groupsError } = await supabase
    .from("groups")
    .select("id, class_id, gender, name");
  if (groupsError) throw groupsError;
  const groupByClassGender = new Map(
    (allGroups ?? []).map((g) => [`${g.class_id}__${g.gender}`, g])
  );

  // 4. Session groups (kelompok mana yang dibuka pada tiap sesi)
  const { data: sessionGroupRows, error: sgError } = await supabase
    .from("session_groups")
    .select("session_id, group_id, opened")
    .in("session_id", sessionIds);
  if (sgError) throw sgError;
  const openedSet = new Set(
    (sessionGroupRows ?? []).filter((sg) => sg.opened).map((sg) => `${sg.session_id}__${sg.group_id}`)
  );

  // 5. Attendance records untuk santri & sesi terkait
  const { data: recordRows, error: recordsError } = await supabase
    .from("attendance_records")
    .select("session_id, student_id, status")
    .in("session_id", sessionIds)
    .in("student_id", studentIds);
  if (recordsError) throw recordsError;
  const recordMap = new Map(
    (recordRows ?? []).map((r) => [`${r.session_id}__${r.student_id}`, r.status as AttendanceStatus])
  );

  // 6. Histori kelas semua santri terkait
  const { data: historyRows, error: historyError } = await supabase
    .from("student_class_history")
    .select("student_id, class_id, gender, effective_from, effective_to")
    .in("student_id", studentIds);
  if (historyError) throw historyError;

  const historyByStudent = new Map<string, HistoryEntry[]>();
  for (const h of historyRows ?? []) {
    const list = historyByStudent.get(h.student_id) ?? [];
    list.push({
      classId: h.class_id,
      gender: h.gender,
      effectiveFrom: h.effective_from,
      effectiveTo: h.effective_to,
    });
    historyByStudent.set(h.student_id, list);
  }

  const statusCode: Record<AttendanceStatus, "H" | "T" | "I" | "S" | "A"> = {
    hadir: "H",
    terlambat: "T",
    izin: "I",
    sakit: "S",
    alpa: "A",
  };

  const rows: MatrixStudentRow[] = studentRows.map((s: any) => {
    const history = historyByStudent.get(s.id) ?? [];
    const cells: MatrixStudentRow["cells"] = {};

    for (const session of sessions) {
      const effective = pickGroupForDate(history, session.date, {
        classId: s.class_id,
        gender: s.gender,
      });
      const group = groupByClassGender.get(`${effective.classId}__${effective.gender}`);
      const wasOpened = group ? openedSet.has(`${session.sessionId}__${group.id}`) : false;

      if (!wasOpened) {
        cells[session.sessionId] = "-";
        continue;
      }

      const status = recordMap.get(`${session.sessionId}__${s.id}`);
      if (status) {
        cells[session.sessionId] = statusCode[status];
      } else {
        // Sesi dibuka tapi belum ada record: kemungkinan sesi masih
        // berjalan (belum difinalisasi jadi Alpa). Tampilkan kosong.
        cells[session.sessionId] = "";
      }
    }

    return {
      studentId: s.id,
      nis: s.nis,
      name: s.name,
      currentClassName: s.classes?.name ?? "-",
      currentGroupName:
        groupByClassGender.get(`${s.class_id}__${s.gender}`)?.name ?? "-",
      currentGender: s.gender,
      cells,
    };
  });

  return { sessions, rows };
}
