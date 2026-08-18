import { NextResponse } from "next/server";
import { requireAuth, handleApiError } from "@/lib/api-guard";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { toWIBDateString, wibDateTimeToUTC } from "@/lib/timezone";
import { finalizeExpiredSessionGroups } from "@/lib/services/attendance";

export async function GET() {
  const unauthorized = await requireAuth();
  if (unauthorized) return unauthorized;

  try {
    await finalizeExpiredSessionGroups();

    const supabase = getSupabaseAdmin();
    const todayStr = toWIBDateString();
    const now = new Date();

    const { data: sessions, error: sessionsError } = await supabase
      .from("attendance_sessions")
      .select("id, session_type, scan_start_time, end_time, status")
      .eq("session_date", todayStr);
    if (sessionsError) throw sessionsError;

    const activeSession = (sessions ?? []).find((s) => {
      const start = wibDateTimeToUTC(todayStr, s.scan_start_time);
      const end = wibDateTimeToUTC(todayStr, s.end_time);
      return now >= start && now < end;
    });

    const sessionIds = (sessions ?? []).map((s) => s.id);
    const stats = { hadir: 0, terlambat: 0, izin: 0, sakit: 0, alpa: 0 };

    if (sessionIds.length > 0) {
      const { data: records, error: recordsError } = await supabase
        .from("attendance_records")
        .select("status")
        .in("session_id", sessionIds);
      if (recordsError) throw recordsError;

      for (const r of records ?? []) {
        if (r.status in stats) {
          (stats as any)[r.status] += 1;
        }
      }
    }

    return NextResponse.json({
      ok: true,
      today: todayStr,
      activeSessionLabel: activeSession
        ? `Sesi ${activeSession.session_type === "subuh" ? "Subuh" : "Malam"} sedang berlangsung`
        : null,
      stats,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
