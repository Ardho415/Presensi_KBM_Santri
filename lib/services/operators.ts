import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

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
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("attendance_operators")
    .select("id, active, students(id, nis, name, active), groups(id, name)")
    .order("created_at", { ascending: false });
  if (error) throw error;

  return (data ?? []).map((o: any) => ({
    id: o.id,
    student_id: o.students?.id,
    nis: o.students?.nis ?? "-",
    student_name: o.students?.name ?? "-",
    student_active: o.students?.active ?? false,
    group_id: o.groups?.id,
    group_name: o.groups?.name ?? "-",
    active: o.active,
  }));
}

export async function addOperator(nis: string, groupId: string) {
  const supabase = getSupabaseAdmin();

  const { data: student, error: studentError } = await supabase
    .from("students")
    .select("id, name, active")
    .eq("nis", nis.trim())
    .maybeSingle();
  if (studentError) throw studentError;
  if (!student) throw new Error("NIS tidak ditemukan pada data santri.");
  if (!student.active) throw new Error("Santri sudah tidak aktif dan tidak dapat menjadi petugas.");

  const { data: existing, error: existingError } = await supabase
    .from("attendance_operators")
    .select("id, active")
    .eq("student_id", student.id)
    .eq("group_id", groupId)
    .maybeSingle();
  if (existingError) throw existingError;

  if (existing) {
    if (existing.active) {
      throw new Error(`${student.name} sudah terdaftar sebagai petugas pada kelompok ini.`);
    }
    const { error } = await supabase
      .from("attendance_operators")
      .update({ active: true })
      .eq("id", existing.id);
    if (error) throw error;
    return { id: existing.id, studentName: student.name };
  }

  const { data: created, error } = await supabase
    .from("attendance_operators")
    .insert({ student_id: student.id, group_id: groupId, active: true })
    .select("id")
    .single();
  if (error) throw error;

  return { id: created.id as string, studentName: student.name as string };
}

export async function setOperatorActive(id: string, active: boolean) {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("attendance_operators").update({ active }).eq("id", id);
  if (error) throw error;
}
