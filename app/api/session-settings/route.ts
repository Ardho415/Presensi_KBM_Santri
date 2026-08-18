import { NextRequest, NextResponse } from "next/server";
import { requireAuth, handleApiError } from "@/lib/api-guard";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

// Mengedit nilai default waktu sesi (Subuh/Malam) yang dipakai sebagai
// pre-fill saat admin membuka sesi baru di halaman "Buka Sesi". Mengubah
// default TIDAK mengubah sesi yang sudah terlanjur dibuat sebelumnya,
// karena attendance_sessions menyimpan salinan waktunya sendiri.
export async function PATCH(request: NextRequest) {
  const unauthorized = await requireAuth();
  if (unauthorized) return unauthorized;

  try {
    const body = await request.json();
    const { sessionType, scanStartTime, onTimeUntil, endTime } = body;

    if (!sessionType || !scanStartTime || !onTimeUntil || !endTime) {
      return NextResponse.json(
        { ok: false, message: "Semua field waktu wajib diisi." },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from("session_settings")
      .update({
        scan_start_time: scanStartTime,
        on_time_until: onTimeUntil,
        end_time: endTime,
      })
      .eq("session_type", sessionType);

    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
