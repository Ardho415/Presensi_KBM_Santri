import "server-only";
import { SupabaseClient } from "@supabase/supabase-js";

/**
 * Menentukan kelompok (group_id) seorang santri pada tanggal tertentu,
 * berdasarkan student_class_history. Ini penting agar riwayat presensi
 * lama TIDAK berubah ketika santri pindah kelas (requirement #7 & #41).
 */
export async function getStudentGroupOnDate(
  supabase: SupabaseClient,
  studentId: string,
  dateStr: string
): Promise<{ groupId: string; classId: string; gender: "L" | "P"; groupName: string } | null> {
  const { data: history, error } = await supabase
    .from("student_class_history")
    .select("class_id, gender, effective_from, effective_to")
    .eq("student_id", studentId)
    .lte("effective_from", dateStr)
    .or(`effective_to.is.null,effective_to.gte.${dateStr}`)
    .order("effective_from", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;

  let classId: string;
  let gender: "L" | "P";

  if (history) {
    classId = history.class_id;
    gender = history.gender;
  } else {
    // Fallback: tidak ada baris histori yang cocok (seharusnya jarang
    // terjadi). Gunakan data kelas santri saat ini sebagai pengaman.
    const { data: student, error: studentError } = await supabase
      .from("students")
      .select("class_id, gender")
      .eq("id", studentId)
      .single();
    if (studentError || !student) return null;
    classId = student.class_id;
    gender = student.gender;
  }

  const { data: group, error: groupError } = await supabase
    .from("groups")
    .select("id, name")
    .eq("class_id", classId)
    .eq("gender", gender)
    .maybeSingle();

  if (groupError || !group) return null;

  return { groupId: group.id, classId, gender, groupName: group.name };
}

/**
 * Dipanggil ketika admin mengubah kelas seorang santri. Menutup baris
 * histori aktif (effective_to = sehari sebelum tanggal efektif baru)
 * lalu membuat baris baru. Perubahan berlaku mulai hari perubahan;
 * data historis attendance tidak diubah sama sekali.
 */
export async function changeStudentClass(
  supabase: SupabaseClient,
  studentId: string,
  newClassId: string,
  newGender: "L" | "P",
  effectiveFrom: string // yyyy-MM-dd (WIB)
): Promise<void> {
  const dayBefore = shiftDate(effectiveFrom, -1);

  // Tutup histori yang masih terbuka (effective_to null) dan yang mulai
  // sebelum tanggal efektif baru.
  const { data: openRows, error: openErr } = await supabase
    .from("student_class_history")
    .select("id, effective_from")
    .eq("student_id", studentId)
    .is("effective_to", null);

  if (openErr) throw openErr;

  for (const row of openRows ?? []) {
    if (row.effective_from <= dayBefore) {
      await supabase
        .from("student_class_history")
        .update({ effective_to: dayBefore })
        .eq("id", row.id);
    }
  }

  await supabase.from("student_class_history").insert({
    student_id: studentId,
    class_id: newClassId,
    gender: newGender,
    effective_from: effectiveFrom,
    effective_to: null,
  });

  await supabase
    .from("students")
    .update({ class_id: newClassId, gender: newGender })
    .eq("id", studentId);
}

function shiftDate(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map((v) => parseInt(v, 10));
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
