import "server-only";
import pool from "@/lib/db";
import type { RowDataPacket } from "mysql2";
import { v4 as uuidv4 } from "uuid";

export interface OperatorListItem {
  id: string;
  student_id: string;
  nis: string;
  student_name: string;
  student_active: boolean;
  group_id: string;
  group_name: string;
  active: boolean;
}

export async function listOperators(): Promise<OperatorListItem[]> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT o.id, o.student_id, o.group_id, o.active,
            s.nis as student_nis, s.name as student_name, s.active as student_active,
            g.name as group_name
     FROM attendance_operators o
     LEFT JOIN students s ON o.student_id = s.id
     LEFT JOIN groups g ON o.group_id = g.id
     ORDER BY o.created_at DESC`
  );

  return rows.map((o) => ({
    id: o.id,
    student_id: o.student_id,
    nis: o.student_nis ?? "-",
    student_name: o.student_name ?? "-",
    student_active: !!o.student_active,
    group_id: o.group_id,
    group_name: o.group_name ?? "-",
    active: !!o.active,
  }));
}

export async function addOperator(nis: string, groupId: string) {
  const connection = await pool.getConnection();
  try {
    const [studentRows] = await connection.query<RowDataPacket[]>(
      `SELECT id, name, active FROM students WHERE nis = ? LIMIT 1`,
      [nis.trim()]
    );
    if (studentRows.length === 0) throw new Error("NIS tidak ditemukan pada data santri.");
    
    const student = studentRows[0];
    if (!student.active) throw new Error("Santri sudah tidak aktif dan tidak dapat menjadi petugas.");

    const [existingRows] = await connection.query<RowDataPacket[]>(
      `SELECT id, active FROM attendance_operators WHERE student_id = ? AND group_id = ? LIMIT 1`,
      [student.id, groupId]
    );

    if (existingRows.length > 0) {
      const existing = existingRows[0];
      if (existing.active) {
        throw new Error(`${student.name} sudah terdaftar sebagai petugas pada kelompok ini.`);
      }
      await connection.query(
        `UPDATE attendance_operators SET active = 1 WHERE id = ?`,
        [existing.id]
      );
      return { id: existing.id, studentName: student.name };
    }

    const id = uuidv4();
    await connection.query(
      `INSERT INTO attendance_operators (id, student_id, group_id, active) VALUES (?, ?, ?, 1)`,
      [id, student.id, groupId]
    );

    return { id, studentName: student.name };
  } finally {
    connection.release();
  }
}

export async function setOperatorActive(id: string, active: boolean) {
  await pool.query(
    `UPDATE attendance_operators SET active = ? WHERE id = ?`,
    [active ? 1 : 0, id]
  );
}

export async function deleteOperator(id: string) {
  await pool.query(`DELETE FROM attendance_operators WHERE id = ?`, [id]);
}
