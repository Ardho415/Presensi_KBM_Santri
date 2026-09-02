import "server-only";
import pool from "@/lib/db";
import { toWIBDateString, wibDateTimeToUTC } from "@/lib/timezone";
import { getStudentGroupOnDate } from "@/lib/services/class-history";
import type { AttendanceStatus, ScanResult } from "@/types/domain";
import type { RowDataPacket } from "mysql2";
import { v4 as uuidv4 } from "uuid";

// -----------------------------------------------------------------------
// FINALISASI ALPA OTOMATIS
// -----------------------------------------------------------------------
export async function finalizeExpiredSessionGroups(): Promise<number> {
  const now = new Date();

  const [candidates] = await pool.query<RowDataPacket[]>(
    `SELECT sg.id, sg.session_id, sg.group_id, sg.opened, sg.finalized,
            s.session_date, s.end_time, s.status,
            g.class_id, g.gender, g.name as group_name
     FROM session_groups sg
     JOIN attendance_sessions s ON sg.session_id = s.id
     JOIN groups g ON sg.group_id = g.id
     WHERE sg.finalized = 0 AND sg.opened = 1`
  );

  if (candidates.length === 0) return 0;

  let finalizedCount = 0;

  for (const row of candidates) {
    const sessionDate = typeof row.session_date === 'string' ? row.session_date : row.session_date.toISOString().split("T")[0];
    const endInstant = wibDateTimeToUTC(sessionDate, row.end_time);
    if (now < endInstant) continue;

    await finalizeOneSessionGroup({
      sessionGroupId: row.id,
      sessionId: row.session_id,
      sessionDate: sessionDate,
      groupId: row.group_id,
      classId: row.class_id,
      gender: row.gender,
      groupName: row.group_name,
    });

    finalizedCount += 1;
  }

  return finalizedCount;
}

async function finalizeOneSessionGroup(params: {
  sessionGroupId: string;
  sessionId: string;
  sessionDate: string;
  groupId: string;
  classId: string;
  gender: "L" | "P";
  groupName: string;
}) {
  const [activeStudents] = await pool.query<RowDataPacket[]>(
    `SELECT id FROM students WHERE active = 1`
  );

  const [existingRecords] = await pool.query<RowDataPacket[]>(
    `SELECT student_id FROM attendance_records WHERE session_id = ?`,
    [params.sessionId]
  );
  const alreadyRecorded = new Set(existingRecords.map((r) => r.student_id));

  const alpaRows: any[] = [];

  for (const s of activeStudents) {
    if (alreadyRecorded.has(s.id)) continue;

    const group = await getStudentGroupOnDate(s.id, params.sessionDate);
    if (!group || group.groupId !== params.groupId) continue;

    alpaRows.push([
      uuidv4(), params.sessionId, s.id, params.groupId, 'alpa', null, 'auto_alpa', null, params.classId, params.groupName, params.gender
    ]);
  }

  if (alpaRows.length > 0) {
    await pool.query(
      `INSERT IGNORE INTO attendance_records 
       (id, session_id, student_id, group_id, status, scanned_at, source, operator_id, class_id_snapshot, group_name_snapshot, gender_snapshot)
       VALUES ?`,
      [alpaRows]
    );
  }

  await pool.query(
    `UPDATE session_groups SET finalized = 1, finalized_at = NOW() WHERE id = ?`,
    [params.sessionGroupId]
  );
}

// -----------------------------------------------------------------------
// STATE SESI UNTUK HALAMAN /scan
// -----------------------------------------------------------------------
export type ScannerSessionState =
  | { state: "none" }
  | { state: "not_started"; sessionType: string; label: string; scanStartTime: string }
  | { state: "active"; sessionId: string; sessionType: string; label: string; endTime: string };

export async function getScannerSessionState(): Promise<ScannerSessionState> {
  const now = new Date();
  const todayStr = toWIBDateString(now);

  const [sessions] = await pool.query<RowDataPacket[]>(
    `SELECT id, session_type, scan_start_time, on_time_until, end_time, status 
     FROM attendance_sessions 
     WHERE session_date = ? AND status = 'open'`,
    [todayStr]
  );

  if (sessions.length === 0) return { state: "none" };

  const label = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

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

  const upcoming = sessions
    .map((s) => ({
      session_type: s.session_type,
      scan_start_time: s.scan_start_time,
      start: wibDateTimeToUTC(todayStr, s.scan_start_time)
    }))
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
  const [studentRows] = await pool.query<RowDataPacket[]>(
    `SELECT id, name, active FROM students WHERE nis = ? LIMIT 1`,
    [nis.trim()]
  );

  if (studentRows.length === 0 || !studentRows[0].active) {
    return { ok: false, message: "NIS petugas tidak terdaftar atau tidak aktif." };
  }
  const student = studentRows[0];

  const [operatorRows] = await pool.query<RowDataPacket[]>(
    `SELECT o.id, o.active, g.name as group_name
     FROM attendance_operators o
     LEFT JOIN groups g ON o.group_id = g.id
     WHERE o.student_id = ? AND o.active = 1
     LIMIT 1`,
    [student.id]
  );

  if (operatorRows.length === 0) {
    return { ok: false, message: "NIS petugas tidak terdaftar atau tidak aktif." };
  }

  return {
    ok: true,
    operatorId: operatorRows[0].id,
    studentName: student.name,
    groupName: operatorRows[0].group_name ?? "-",
  };
}

// -----------------------------------------------------------------------
// SCAN ABSENSI
// -----------------------------------------------------------------------
export async function scanAttendance(params: {
  nis: string;
  operatorId: string;
}): Promise<ScanResult> {
  const now = new Date();
  const todayStr = toWIBDateString(now);

  await finalizeExpiredSessionGroups();

  const nis = params.nis.trim();
  if (!nis) {
    return { ok: false, message: "NIS tidak boleh kosong." };
  }

  const [studentRows] = await pool.query<RowDataPacket[]>(
    `SELECT id, name, active FROM students WHERE nis = ? LIMIT 1`,
    [nis]
  );

  if (studentRows.length === 0) {
    return { ok: false, message: "Santri tidak ditemukan." };
  }
  const student = studentRows[0];
  if (!student.active) {
    return {
      ok: false,
      message: "Santri sudah tidak aktif dan tidak dapat melakukan presensi.",
    };
  }

  const [sessions] = await pool.query<RowDataPacket[]>(
    `SELECT id, session_date, scan_start_time, on_time_until, end_time, status
     FROM attendance_sessions
     WHERE session_date = ? AND status = 'open'`,
    [todayStr]
  );

  const activeSession = sessions.find((s) => {
    const start = wibDateTimeToUTC(todayStr, s.scan_start_time);
    const end = wibDateTimeToUTC(todayStr, s.end_time);
    return now >= start && now < end;
  });

  if (!activeSession) {
    const notYetStarted = sessions.find(
      (s) => now < wibDateTimeToUTC(todayStr, s.scan_start_time)
    );
    if (notYetStarted) return { ok: false, message: "Sesi presensi belum dimulai." };
    const alreadyEnded = sessions.find(
      (s) => now >= wibDateTimeToUTC(todayStr, s.end_time)
    );
    if (alreadyEnded) return { ok: false, message: "Sesi presensi telah berakhir." };
    return {
      ok: false,
      message: "Belum ada sesi presensi yang dibuka. Silakan hubungi ketua kelas.",
    };
  }

  const group = await getStudentGroupOnDate(student.id, todayStr);
  if (!group) {
    return { ok: false, message: "Data kelas santri tidak valid. Hubungi admin." };
  }

  const [sessionGroupRows] = await pool.query<RowDataPacket[]>(
    `SELECT id, opened, closed_manually FROM session_groups WHERE session_id = ? AND group_id = ? LIMIT 1`,
    [activeSession.id, group.groupId]
  );

  const sessionGroup = sessionGroupRows[0];
  if (!sessionGroup || !sessionGroup.opened || sessionGroup.closed_manually) {
    return { ok: false, message: "Kelas santri tidak sedang dibuka untuk sesi ini." };
  }

  const onTimeUntil = wibDateTimeToUTC(todayStr, activeSession.on_time_until);
  const status: AttendanceStatus = now < onTimeUntil ? "hadir" : "terlambat";

  const [existingRows] = await pool.query<RowDataPacket[]>(
    `SELECT id, status FROM attendance_records WHERE session_id = ? AND student_id = ? LIMIT 1`,
    [activeSession.id, student.id]
  );
  if (existingRows.length > 0) {
    return { ok: false, message: `${student.name} sudah melakukan presensi.` };
  }

  try {
    const id = uuidv4();
    await pool.query(
      `INSERT INTO attendance_records 
       (id, session_id, student_id, group_id, status, scanned_at, source, operator_id, class_id_snapshot, group_name_snapshot, gender_snapshot)
       VALUES (?, ?, ?, ?, ?, ?, 'scan', ?, ?, ?, ?)`,
      [id, activeSession.id, student.id, group.groupId, status, now, params.operatorId, group.classId, group.groupName, group.gender]
    );
  } catch (err: any) {
    if (err.code === "ER_DUP_ENTRY") {
      return { ok: false, message: `${student.name} sudah melakukan presensi.` };
    }
    throw err;
  }

  return {
    ok: true,
    message: status === "hadir" ? `${student.name} berhasil hadir (tepat waktu)!` : `${student.name} berhasil hadir (terlambat)!`,
    studentName: student.name,
    status,
  };
}

// -----------------------------------------------------------------------
// EDIT STATUS PRESENSI
// -----------------------------------------------------------------------
export async function editAttendanceStatus(params: {
  sessionId: string;
  studentId: string;
  status: AttendanceStatus;
}): Promise<{ ok: boolean; message: string }> {
  const [sessionRows] = await pool.query<RowDataPacket[]>(
    `SELECT id, session_date FROM attendance_sessions WHERE id = ? LIMIT 1`,
    [params.sessionId]
  );

  if (sessionRows.length === 0) return { ok: false, message: "Sesi tidak ditemukan." };
  const session = sessionRows[0];
  const sessionDateStr = typeof session.session_date === 'string' ? session.session_date : session.session_date.toISOString().split("T")[0];

  const group = await getStudentGroupOnDate(params.studentId, sessionDateStr);
  if (!group) return { ok: false, message: "Data kelas santri tidak valid." };

  const [sessionGroupRows] = await pool.query<RowDataPacket[]>(
    `SELECT id, opened FROM session_groups WHERE session_id = ? AND group_id = ? LIMIT 1`,
    [params.sessionId, group.groupId]
  );

  if (sessionGroupRows.length === 0 || !sessionGroupRows[0].opened) {
    return {
      ok: false,
      message: "Kelompok santri ini tidak dibuka pada sesi tersebut, status tidak dapat diedit.",
    };
  }

  const [existingRows] = await pool.query<RowDataPacket[]>(
    `SELECT id FROM attendance_records WHERE session_id = ? AND student_id = ? LIMIT 1`,
    [params.sessionId, params.studentId]
  );

  if (existingRows.length > 0) {
    await pool.query(
      `UPDATE attendance_records SET status = ?, source = 'edited' WHERE id = ?`,
      [params.status, existingRows[0].id]
    );
  } else {
    await pool.query(
      `INSERT INTO attendance_records 
       (id, session_id, student_id, group_id, status, scanned_at, source, operator_id, class_id_snapshot, group_name_snapshot, gender_snapshot)
       VALUES (?, ?, ?, ?, ?, NULL, 'edited', NULL, ?, ?, ?)`,
      [uuidv4(), params.sessionId, params.studentId, group.groupId, params.status, group.classId, group.groupName, group.gender]
    );
  }

  return { ok: true, message: "Status presensi berhasil diperbarui." };
}
