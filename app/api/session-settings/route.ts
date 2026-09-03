import { NextRequest, NextResponse } from "next/server";
import { requireAuth, handleApiError } from "@/lib/api-guard";
import pool from "@/lib/db";

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

    await pool.query(
      `UPDATE session_settings SET scan_start_time = ?, on_time_until = ?, end_time = ? WHERE session_type = ?`,
      [scanStartTime, onTimeUntil, endTime, sessionType]
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
