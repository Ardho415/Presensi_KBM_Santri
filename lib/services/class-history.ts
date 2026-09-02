import "server-only";
import pool from "@/lib/db";
import type { RowDataPacket, ResultSetHeader } from "mysql2";
import { v4 as uuidv4 } from "uuid";

/**
 * Menentukan kelompok (group_id) seorang santri pada tanggal tertentu,
 * berdasarkan student_class_history. Ini penting agar riwayat presensi
 * lama TIDAK berubah ketika santri pindah kelas (requirement #7 & #41).
 */
export async function getStudentGroupOnDate(
  studentId: string,
  dateStr: string
): Promise<{ groupId: string; classId: string; gender: "L" | "P"; groupName: string } | null> {
  const [historyRows] = await pool.query<RowDataPacket[]>(
    `SELECT class_id, gender, effective_from, effective_to 
     FROM student_class_history 
     WHERE student_id = ? 
       AND effective_from <= ? 
       AND (effective_to IS NULL OR effective_to >= ?)
     ORDER BY effective_from DESC 
     LIMIT 1`,
    [studentId, dateStr, dateStr]
  );

  let classId: string;
  let gender: "L" | "P";

  if (historyRows.length > 0) {
    classId = historyRows[0].class_id;
    gender = historyRows[0].gender;
  } else {
    // Fallback
    const [studentRows] = await pool.query<RowDataPacket[]>(
      `SELECT class_id, gender FROM students WHERE id = ? LIMIT 1`,
      [studentId]
    );
    if (studentRows.length === 0) return null;
    classId = studentRows[0].class_id;
    gender = studentRows[0].gender;
  }

  const [groupRows] = await pool.query<RowDataPacket[]>(
    `SELECT id, name FROM groups WHERE class_id = ? AND gender = ? LIMIT 1`,
    [classId, gender]
  );

  if (groupRows.length === 0) return null;

  return { groupId: groupRows[0].id, classId, gender, groupName: groupRows[0].name };
}

/**
 * Dipanggil ketika admin mengubah kelas seorang santri. Menutup baris
 * histori aktif (effective_to = sehari sebelum tanggal efektif baru)
 * lalu membuat baris baru. Perubahan berlaku mulai hari perubahan.
 */
export async function changeStudentClass(
  studentId: string,
  newClassId: string,
  newGender: "L" | "P",
  effectiveFrom: string // yyyy-MM-dd (WIB)
): Promise<void> {
  const dayBefore = shiftDate(effectiveFrom, -1);
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [openRows] = await connection.query<RowDataPacket[]>(
      `SELECT id, effective_from FROM student_class_history WHERE student_id = ? AND effective_to IS NULL`,
      [studentId]
    );

    for (const row of openRows) {
      if (row.effective_from <= dayBefore) {
        await connection.query(
          `UPDATE student_class_history SET effective_to = ? WHERE id = ?`,
          [dayBefore, row.id]
        );
      }
    }

    await connection.query(
      `INSERT INTO student_class_history (id, student_id, class_id, gender, effective_from, effective_to)
       VALUES (?, ?, ?, ?, ?, NULL)`,
      [uuidv4(), studentId, newClassId, newGender, effectiveFrom]
    );

    await connection.query(
      `UPDATE students SET class_id = ?, gender = ? WHERE id = ?`,
      [newClassId, newGender, studentId]
    );

    await connection.commit();
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

function shiftDate(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map((v) => parseInt(v, 10));
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
