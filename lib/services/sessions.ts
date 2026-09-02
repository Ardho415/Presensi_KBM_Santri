import "server-only";
import pool from "@/lib/db";
import type { SessionType } from "@/types/domain";
import type { RowDataPacket } from "mysql2";
import { v4 as uuidv4 } from "uuid";

export interface CreateSessionInput {
  sessionDate: string;
  sessionType: SessionType;
  scanStartTime: string;
  onTimeUntil: string;
  endTime: string;
  groupIds: string[];
}

export async function createSession(input: CreateSessionInput) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [existing] = await connection.query<RowDataPacket[]>(
      `SELECT id FROM attendance_sessions WHERE session_date = ? AND session_type = ? LIMIT 1`,
      [input.sessionDate, input.sessionType]
    );

    if (existing.length > 0) {
      throw new Error(
        `Sesi ${input.sessionType} untuk tanggal ${input.sessionDate} sudah ada. Satu tanggal + jenis sesi hanya boleh memiliki satu sesi.`
      );
    }

    const sessionId = uuidv4();
    await connection.query(
      `INSERT INTO attendance_sessions (id, session_date, session_type, scan_start_time, on_time_until, end_time, status)
       VALUES (?, ?, ?, ?, ?, ?, 'open')`,
      [sessionId, input.sessionDate, input.sessionType, input.scanStartTime, input.onTimeUntil, input.endTime]
    );

    if (input.groupIds.length > 0) {
      // batch insert
      const insertData = input.groupIds.map(groupId => [
        uuidv4(), sessionId, groupId, 1, 0, 0
      ]);
      await connection.query(
        `INSERT INTO session_groups (id, session_id, group_id, opened, closed_manually, finalized) VALUES ?`,
        [insertData]
      );
    }

    await connection.commit();
    return sessionId;
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

export async function listSessions(limit = 30) {
  const [sessions] = await pool.query<RowDataPacket[]>(
    `SELECT id, session_date, session_type, scan_start_time, on_time_until, end_time, status
     FROM attendance_sessions
     ORDER BY session_date DESC, session_type DESC
     LIMIT ?`,
    [limit]
  );

  if (sessions.length === 0) return [];

  const sessionIds = sessions.map(s => s.id);
  const [sessionGroups] = await pool.query<RowDataPacket[]>(
    `SELECT sg.id, sg.session_id, sg.opened, sg.closed_manually, sg.finalized, sg.group_id, g.name as group_name
     FROM session_groups sg
     LEFT JOIN groups g ON sg.group_id = g.id
     WHERE sg.session_id IN (?)`,
    [sessionIds]
  );

  return sessions.map(s => ({
    ...s,
    session_groups: sessionGroups.filter(sg => sg.session_id === s.id).map(sg => ({
      id: sg.id,
      opened: !!sg.opened,
      closed_manually: !!sg.closed_manually,
      finalized: !!sg.finalized,
      groups: { id: sg.group_id, name: sg.group_name }
    }))
  }));
}

export async function getSessionDetail(id: string) {
  const [sessions] = await pool.query<RowDataPacket[]>(
    `SELECT id, session_date, session_type, scan_start_time, on_time_until, end_time, status
     FROM attendance_sessions
     WHERE id = ? LIMIT 1`,
    [id]
  );

  if (sessions.length === 0) return null;
  const session = sessions[0];

  const [sessionGroups] = await pool.query<RowDataPacket[]>(
    `SELECT sg.id, sg.group_id, sg.opened, sg.closed_manually, sg.finalized, g.name as group_name
     FROM session_groups sg
     LEFT JOIN groups g ON sg.group_id = g.id
     WHERE sg.session_id = ?`,
    [id]
  );

  return {
    ...session,
    session_groups: sessionGroups.map(sg => ({
      id: sg.id,
      group_id: sg.group_id,
      opened: !!sg.opened,
      closed_manually: !!sg.closed_manually,
      finalized: !!sg.finalized,
      groups: { id: sg.group_id, name: sg.group_name }
    }))
  };
}

export async function deleteSession(id: string) {
  await pool.query(`DELETE FROM attendance_sessions WHERE id = ?`, [id]);
}

export async function toggleSessionGroup(
  sessionId: string,
  groupId: string,
  action: "close" | "reopen"
) {
  const [sg] = await pool.query<RowDataPacket[]>(
    `SELECT id FROM session_groups WHERE session_id = ? AND group_id = ? LIMIT 1`,
    [sessionId, groupId]
  );
  
  if (sg.length === 0) throw new Error("Kelompok tidak ditemukan pada sesi ini.");

  await pool.query(
    `UPDATE session_groups SET closed_manually = ? WHERE id = ?`,
    [action === "close" ? 1 : 0, sg[0].id]
  );
}

export async function getActiveSessionSummaryForToday(todayStr: string) {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id, session_type, scan_start_time, on_time_until, end_time, status
     FROM attendance_sessions
     WHERE session_date = ?
     ORDER BY session_type ASC`,
    [todayStr]
  );
  return rows;
}

export interface UpdateSessionInput {
  sessionDate: string;
  sessionType: SessionType;
  scanStartTime: string;
  onTimeUntil: string;
  endTime: string;
}

export async function updateSession(id: string, input: UpdateSessionInput) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.query(
      `UPDATE attendance_sessions 
       SET session_date = ?, session_type = ?, scan_start_time = ?, on_time_until = ?, end_time = ?
       WHERE id = ?`,
      [input.sessionDate, input.sessionType, input.scanStartTime, input.onTimeUntil, input.endTime, id]
    );
    // Jika sesi diedit (misal waktu selesai diperpanjang), kita reset status finalisasinya
    // dan hapus record "auto_alpa" yang mungkin sudah terlanjur dibuat oleh sistem.
    await connection.query(
      `UPDATE session_groups SET finalized = 0, finalized_at = NULL WHERE session_id = ?`,
      [id]
    );
    await connection.query(
      `DELETE FROM attendance_records WHERE session_id = ? AND source = 'auto_alpa'`,
      [id]
    );
    await connection.commit();
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}
