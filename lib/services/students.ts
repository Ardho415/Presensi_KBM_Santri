import "server-only";
import pool from "@/lib/db";
import { changeStudentClass } from "@/lib/services/class-history";
import { toWIBDateString } from "@/lib/timezone";
import type { Gender } from "@/types/domain";
import type { RowDataPacket } from "mysql2";
import { v4 as uuidv4 } from "uuid";

export interface StudentListItem {
  id: string;
  nis: string;
  name: string;
  class_id: string;
  class_name: string;
  gender: Gender;
  generation: string | null;
  active: boolean;
}

export async function listStudents(params: {
  search?: string;
  classId?: string;
  active?: boolean;
}): Promise<StudentListItem[]> {
  let query = `
    SELECT s.id, s.nis, s.name, s.class_id, s.gender, s.generation, s.active, c.name as class_name
    FROM students s
    LEFT JOIN classes c ON s.class_id = c.id
    WHERE 1=1
  `;
  const values: any[] = [];

  if (params.classId) {
    query += ` AND s.class_id = ?`;
    values.push(params.classId);
  }
  if (params.active !== undefined) {
    query += ` AND s.active = ?`;
    values.push(params.active ? 1 : 0);
  }
  if (params.search) {
    query += ` AND (s.name LIKE ? OR s.nis LIKE ?)`;
    values.push(`%${params.search}%`, `%${params.search}%`);
  }

  query += ` ORDER BY s.name ASC`;

  const [rows] = await pool.query<RowDataPacket[]>(query, values);

  return rows.map(s => ({
    id: s.id,
    nis: s.nis,
    name: s.name,
    class_id: s.class_id,
    class_name: s.class_name ?? "-",
    gender: s.gender as Gender,
    generation: s.generation,
    active: !!s.active,
  }));
}

export async function createStudent(input: {
  nis: string;
  name: string;
  classId: string;
  gender: Gender;
  generation: string | null;
  active: boolean;
}) {
  const nis = input.nis.trim();
  const id = uuidv4();
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [existing] = await connection.query<RowDataPacket[]>(
      `SELECT id FROM students WHERE nis = ? LIMIT 1`,
      [nis]
    );
    if (existing.length > 0) throw new Error(`NIS ${nis} sudah terdaftar.`);

    await connection.query(
      `INSERT INTO students (id, nis, name, class_id, gender, generation, active)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, nis, input.name.trim(), input.classId, input.gender, input.generation, input.active ? 1 : 0]
    );

    await connection.query(
      `INSERT INTO student_class_history (id, student_id, class_id, gender, effective_from, effective_to)
       VALUES (?, ?, ?, ?, ?, NULL)`,
      [uuidv4(), id, input.classId, input.gender, toWIBDateString()]
    );

    await connection.commit();
    return id;
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

export async function updateStudent(
  id: string,
  input: {
    name?: string;
    generation?: string | null;
    active?: boolean;
    classId?: string;
    gender?: Gender;
  }
) {
  const connection = await pool.getConnection();
  try {
    const updates: string[] = [];
    const values: any[] = [];

    if (input.name !== undefined) {
      updates.push("name = ?");
      values.push(input.name.trim());
    }
    if (input.generation !== undefined) {
      updates.push("generation = ?");
      values.push(input.generation);
    }
    if (input.active !== undefined) {
      updates.push("active = ?");
      values.push(input.active ? 1 : 0);
    }

    if (updates.length > 0) {
      values.push(id);
      await connection.query(`UPDATE students SET ${updates.join(", ")} WHERE id = ?`, values);
    }
  } finally {
    connection.release();
  }

  // Perubahan kelas dikelola via history (punya transaksi sendiri)
  if (input.classId !== undefined || input.gender !== undefined) {
    const [current] = await pool.query<RowDataPacket[]>(
      `SELECT class_id, gender FROM students WHERE id = ? LIMIT 1`,
      [id]
    );
    if (current.length === 0) throw new Error("Student not found");

    const newClassId = input.classId ?? current[0].class_id;
    const newGender = input.gender ?? current[0].gender;

    if (newClassId !== current[0].class_id || newGender !== current[0].gender) {
      await changeStudentClass(id, newClassId, newGender, toWIBDateString());
    }
  }
}

export async function deleteStudent(id: string) {
  await pool.query(`DELETE FROM students WHERE id = ?`, [id]);
}

export interface ImportRowResult {
  row: number;
  nis: string;
  status: "created" | "skipped" | "error";
  message?: string;
}

export async function importStudents(
  rows: Array<{
    nis: string;
    name: string;
    className: string;
    generation: string;
    gender: string;
    active: string;
  }>
): Promise<ImportRowResult[]> {
  const [classesRows] = await pool.query<RowDataPacket[]>(`SELECT id, name FROM classes`);
  const classMap = new Map(classesRows.map((c) => [c.name.toLowerCase(), c.id]));

  const results: ImportRowResult[] = [];
  const seenNis = new Set<string>();

  for (let i = 0; i < rows.length; i++) {
    const rowNum = i + 2; 
    const raw = rows[i];
    const nis = String(raw.nis ?? "").trim();
    const name = String(raw.name ?? "").trim();
    const className = String(raw.className ?? "").trim();
    const genderRaw = String(raw.gender ?? "").trim().toUpperCase();
    const activeRaw = String(raw.active ?? "").trim().toUpperCase();
    const generation = String(raw.generation ?? "").trim();

    if (!nis || !name || !className) {
      results.push({ row: rowNum, nis, status: "error", message: "NIS, Nama, dan Kelas wajib diisi." });
      continue;
    }
    if (seenNis.has(nis)) {
      results.push({ row: rowNum, nis, status: "error", message: "NIS duplikat di dalam file import." });
      continue;
    }
    seenNis.add(nis);

    const gender: Gender | null = genderRaw === "L" || genderRaw === "P" ? (genderRaw as Gender) : null;
    if (!gender) {
      results.push({ row: rowNum, nis, status: "error", message: "Jenis Kelamin harus L atau P." });
      continue;
    }

    const active = activeRaw === "TRUE";
    if (activeRaw !== "TRUE" && activeRaw !== "FALSE") {
      results.push({ row: rowNum, nis, status: "error", message: "Kolom Aktif harus TRUE atau FALSE." });
      continue;
    }

    const classId = classMap.get(className.toLowerCase());
    if (!classId) {
      results.push({
        row: rowNum,
        nis,
        status: "error",
        message: `Kelas "${className}" tidak ditemukan.`,
      });
      continue;
    }

    const [existing] = await pool.query<RowDataPacket[]>(
      `SELECT id FROM students WHERE nis = ? LIMIT 1`,
      [nis]
    );
    if (existing.length > 0) {
      results.push({ row: rowNum, nis, status: "skipped", message: "NIS sudah terdaftar, dilewati." });
      continue;
    }

    try {
      await createStudent({
        nis,
        name,
        classId,
        gender,
        generation: generation || null,
        active,
      });
      results.push({ row: rowNum, nis, status: "created" });
    } catch (err: any) {
      results.push({ row: rowNum, nis, status: "error", message: err.message });
    }
  }

  return results;
}
