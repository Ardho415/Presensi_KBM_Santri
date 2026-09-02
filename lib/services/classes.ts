import "server-only";
import pool from "@/lib/db";
import { v4 as uuid } from "uuid";
import type { ClassRow } from "@/types/domain";

export async function listClasses(): Promise<ClassRow[]> {
  const [rows] = await pool.query(
    "SELECT id, name, sort_order FROM classes ORDER BY sort_order ASC"
  );
  return rows as ClassRow[];
}

export async function createClass(name: string, sortOrder: number = 0): Promise<void> {
  const id = uuid();
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.query(
      "INSERT INTO classes (id, name, sort_order) VALUES (?, ?, ?)",
      [id, name, sortOrder]
    );
    await connection.query(
      "INSERT INTO groups (id, class_id, gender, name, sort_order) VALUES (?, ?, ?, ?, ?)",
      [uuid(), id, 'L', `${name} Putra`, sortOrder]
    );
    await connection.query(
      "INSERT INTO groups (id, class_id, gender, name, sort_order) VALUES (?, ?, ?, ?, ?)",
      [uuid(), id, 'P', `${name} Putri`, sortOrder]
    );
    await connection.commit();
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

export async function updateClass(id: string, name: string, sortOrder: number): Promise<void> {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.query(
      "UPDATE classes SET name = ?, sort_order = ? WHERE id = ?",
      [name, sortOrder, id]
    );
    await connection.query(
      "UPDATE groups SET name = CONCAT(?, ' Putra'), sort_order = ? WHERE class_id = ? AND gender = 'L'",
      [name, sortOrder, id]
    );
    await connection.query(
      "UPDATE groups SET name = CONCAT(?, ' Putri'), sort_order = ? WHERE class_id = ? AND gender = 'P'",
      [name, sortOrder, id]
    );
    await connection.commit();
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

export async function deleteClass(id: string): Promise<void> {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.query("DELETE FROM groups WHERE class_id = ?", [id]);
    await connection.query("DELETE FROM classes WHERE id = ?", [id]);
    await connection.commit();
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}
