import { NextResponse } from "next/server";
import { requireAuth, handleApiError } from "@/lib/api-guard";
import pool from "@/lib/db";
import type { RowDataPacket } from "mysql2";
import { toWIBDateString, wibDateTimeToUTC } from "@/lib/timezone";
import { finalizeExpiredSessionGroups } from "@/lib/services/attendance";

export async function GET() {
  const unauthorized = await requireAuth();
  if (unauthorized) return unauthorized;

  try {
    await finalizeExpiredSessionGroups();

    const todayStr = toWIBDateString();
    const now = new Date();

    const [sessions] = await pool.query<RowDataPacket[]>(
      `SELECT id, session_type, scan_start_time, end_time, status FROM attendance_sessions WHERE session_date = ?`,
      [todayStr]
    );

    const activeSession = sessions.find((s) => {
      const start = wibDateTimeToUTC(todayStr, s.scan_start_time);
      const end = wibDateTimeToUTC(todayStr, s.end_time);
      return now >= start && now < end;
    });

    const sessionIds = sessions.map((s) => s.id);
    const stats = { hadir: 0, terlambat: 0, izin: 0, sakit: 0, alpa: 0 };

    if (sessionIds.length > 0) {
      const [records] = await pool.query<RowDataPacket[]>(
        `SELECT status FROM attendance_records WHERE session_id IN (?)`,
        [sessionIds]
      );

      for (const r of records) {
        if (r.status in stats) {
          (stats as any)[r.status] += 1;
        }
      }
    }

    return NextResponse.json({
      ok: true,
      today: todayStr,
      activeSessionLabel: activeSession
        ? `Sesi ${activeSession.session_type.charAt(0).toUpperCase() + activeSession.session_type.slice(1)} sedang berlangsung`
        : null,
      stats,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
