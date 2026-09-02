import "server-only";
import pool from "@/lib/db";
import type { AttendanceStatus, Gender } from "@/types/domain";
import type { RowDataPacket } from "mysql2";

export interface MatrixSessionColumn {
  sessionId: string;
  date: string;
  type: "subuh" | "pagi" | "siang" | "malam";
  label: string; 
}

export interface MatrixStudentRow {
  studentId: string;
  nis: string;
  name: string;
  currentClassName: string;
  currentGroupName: string;
  currentGender: Gender;
  cells: Record<string, "H" | "T" | "I" | "S" | "A" | "-" | "">; 
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

const formatDateStr = (dateVal: any) => {
  if (typeof dateVal === 'string') return dateVal;
  const d = new Date(dateVal);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
};

export async function buildAttendanceMatrix(params: {
  dateFrom: string;
  dateTo: string;
  groupId?: string; 
  includeInactive?: boolean;
}): Promise<{ sessions: MatrixSessionColumn[]; rows: MatrixStudentRow[] }> {
  
  const [sessionRows] = await pool.query<RowDataPacket[]>(
    `SELECT id, session_date, session_type
     FROM attendance_sessions
     WHERE session_date >= ? AND session_date <= ?
     ORDER BY session_date ASC, session_type ASC`,
    [params.dateFrom, params.dateTo]
  );

  const sessions: MatrixSessionColumn[] = sessionRows.map((s) => {
    const dStr = formatDateStr(s.session_date);
    return {
      sessionId: s.id,
      date: dStr,
      type: s.session_type,
      label: `${parseInt(dStr.split("-")[2], 10)} ${s.session_type.charAt(0).toUpperCase() + s.session_type.slice(1)}`,
    };
  });

  let studentQuery = `
    SELECT s.id, s.nis, s.name, s.class_id, s.gender, s.active, c.name as class_name
    FROM students s
    LEFT JOIN classes c ON s.class_id = c.id
    WHERE 1=1
  `;
  const studentValues: any[] = [];

  if (params.groupId) {
    const [groupRows] = await pool.query<RowDataPacket[]>(
      `SELECT class_id, gender FROM groups WHERE id = ? LIMIT 1`,
      [params.groupId]
    );
    if (groupRows.length > 0) {
      studentQuery += ` AND s.class_id = ? AND s.gender = ?`;
      studentValues.push(groupRows[0].class_id, groupRows[0].gender);
    }
  }

  studentQuery += ` ORDER BY s.name ASC`;
  const [studentRows] = await pool.query<RowDataPacket[]>(studentQuery, studentValues);

  if (studentRows.length === 0 || sessions.length === 0) {
    return { sessions, rows: [] };
  }

  const studentIds = studentRows.map((s) => s.id);
  const sessionIds = sessions.map((s) => s.sessionId);

  const [allGroups] = await pool.query<RowDataPacket[]>(`SELECT id, class_id, gender, name FROM groups`);
  const groupByClassGender = new Map(
    allGroups.map((g) => [`${g.class_id}__${g.gender}`, g])
  );

  const [sessionGroupRows] = await pool.query<RowDataPacket[]>(
    `SELECT session_id, group_id, opened FROM session_groups WHERE session_id IN (?)`,
    [sessionIds]
  );
  const openedSet = new Set(
    sessionGroupRows.filter((sg) => sg.opened).map((sg) => `${sg.session_id}__${sg.group_id}`)
  );

  const [recordRows] = await pool.query<RowDataPacket[]>(
    `SELECT session_id, student_id, status FROM attendance_records WHERE session_id IN (?) AND student_id IN (?)`,
    [sessionIds, studentIds]
  );
  const recordMap = new Map(
    recordRows.map((r) => [`${r.session_id}__${r.student_id}`, r.status as AttendanceStatus])
  );

  const [historyRows] = await pool.query<RowDataPacket[]>(
    `SELECT student_id, class_id, gender, effective_from, effective_to FROM student_class_history WHERE student_id IN (?)`,
    [studentIds]
  );

  const historyByStudent = new Map<string, HistoryEntry[]>();
  for (const h of historyRows) {
    const list = historyByStudent.get(h.student_id) ?? [];
    list.push({
      classId: h.class_id,
      gender: h.gender,
      effectiveFrom: formatDateStr(h.effective_from),
      effectiveTo: h.effective_to ? formatDateStr(h.effective_to) : null,
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

  const rows: MatrixStudentRow[] = studentRows.map((s) => {
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
        cells[session.sessionId] = "";
      }
    }

    return {
      studentId: s.id,
      nis: s.nis,
      name: s.name,
      currentClassName: s.class_name ?? "-",
      currentGroupName: groupByClassGender.get(`${s.class_id}__${s.gender}`)?.name ?? "-",
      currentGender: s.gender as Gender,
      cells,
    };
  });

  return { sessions, rows };
}
