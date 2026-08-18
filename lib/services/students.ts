import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { changeStudentClass } from "@/lib/services/class-history";
import { toWIBDateString } from "@/lib/timezone";
import type { Gender } from "@/types/domain";

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
  const supabase = getSupabaseAdmin();
  let query = supabase
    .from("students")
    .select("id, nis, name, class_id, gender, generation, active, classes(name)")
    .order("name", { ascending: true });

  if (params.classId) query = query.eq("class_id", params.classId);
  if (params.active !== undefined) query = query.eq("active", params.active);
  if (params.search) {
    query = query.or(`name.ilike.%${params.search}%,nis.ilike.%${params.search}%`);
  }

  const { data, error } = await query;
  if (error) throw error;

  return (data ?? []).map((s: any) => ({
    id: s.id,
    nis: s.nis,
    name: s.name,
    class_id: s.class_id,
    class_name: s.classes?.name ?? "-",
    gender: s.gender,
    generation: s.generation,
    active: s.active,
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
  const supabase = getSupabaseAdmin();
  const nis = input.nis.trim();

  const { data: existing, error: existingError } = await supabase
    .from("students")
    .select("id")
    .eq("nis", nis)
    .maybeSingle();
  if (existingError) throw existingError;
  if (existing) throw new Error(`NIS ${nis} sudah terdaftar.`);

  const { data: student, error } = await supabase
    .from("students")
    .insert({
      nis,
      name: input.name.trim(),
      class_id: input.classId,
      gender: input.gender,
      generation: input.generation,
      active: input.active,
    })
    .select("id")
    .single();
  if (error) throw error;

  await supabase.from("student_class_history").insert({
    student_id: student.id,
    class_id: input.classId,
    gender: input.gender,
    effective_from: toWIBDateString(),
    effective_to: null,
  });

  return student.id as string;
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
  const supabase = getSupabaseAdmin();

  const patch: Record<string, unknown> = {};
  if (input.name !== undefined) patch.name = input.name.trim();
  if (input.generation !== undefined) patch.generation = input.generation;
  if (input.active !== undefined) patch.active = input.active;

  if (Object.keys(patch).length > 0) {
    const { error } = await supabase.from("students").update(patch).eq("id", id);
    if (error) throw error;
  }

  // Perubahan kelas/gender ditangani lewat histori kelas agar data lama aman.
  if (input.classId !== undefined || input.gender !== undefined) {
    const { data: current, error: currentError } = await supabase
      .from("students")
      .select("class_id, gender")
      .eq("id", id)
      .single();
    if (currentError) throw currentError;

    const newClassId = input.classId ?? current.class_id;
    const newGender = input.gender ?? current.gender;

    if (newClassId !== current.class_id || newGender !== current.gender) {
      await changeStudentClass(supabase, id, newClassId, newGender, toWIBDateString());
    }
  }
}

export async function deleteStudent(id: string) {
  const supabase = getSupabaseAdmin();

  const { error } = await supabase.from("students").delete().eq("id", id);
  if (error) throw error;
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
  const supabase = getSupabaseAdmin();
  const { data: classes, error: classesError } = await supabase.from("classes").select("id, name");
  if (classesError) throw classesError;
  const classMap = new Map((classes ?? []).map((c) => [c.name.toLowerCase(), c.id]));

  const results: ImportRowResult[] = [];
  const seenNis = new Set<string>();

  for (let i = 0; i < rows.length; i++) {
    const rowNum = i + 2; // baris 1 = header
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

    const { data: existing, error: existingError } = await supabase
      .from("students")
      .select("id")
      .eq("nis", nis)
      .maybeSingle();
    if (existingError) {
      results.push({ row: rowNum, nis, status: "error", message: existingError.message });
      continue;
    }
    if (existing) {
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
