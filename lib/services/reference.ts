import "server-only";
import pool from "@/lib/db";
import type { ClassRow, GroupRow, SessionSettingRow } from "@/types/domain";

export async function listClasses(): Promise<ClassRow[]> {
  const [rows] = await pool.query(
    "SELECT id, name, sort_order FROM classes ORDER BY sort_order ASC"
  );
  return rows as ClassRow[];
}

export async function listGroups(): Promise<GroupRow[]> {
  const [rows] = await pool.query(
    "SELECT id, class_id, gender, name, sort_order FROM groups ORDER BY sort_order ASC"
  );
  return rows as GroupRow[];
}

export async function listSessionSettings(): Promise<SessionSettingRow[]> {
  const [rows] = await pool.query(
    "SELECT id, session_type, label, scan_start_time, on_time_until, end_time FROM session_settings ORDER BY session_type ASC"
  );
  return rows as SessionSettingRow[];
}
