import { NextRequest, NextResponse } from "next/server";
import { requireAuth, handleApiError } from "@/lib/api-guard";
import { createSession, listSessions } from "@/lib/services/sessions";
import { finalizeExpiredSessionGroups } from "@/lib/services/attendance";

export async function GET() {
  const unauthorized = await requireAuth();
  if (unauthorized) return unauthorized;

  try {
    await finalizeExpiredSessionGroups();
    const sessions = await listSessions();
    return NextResponse.json({ ok: true, sessions });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(request: NextRequest) {
  const unauthorized = await requireAuth();
  if (unauthorized) return unauthorized;

  try {
    const body = await request.json();
    const { sessionDate, sessionType, scanStartTime, onTimeUntil, endTime, groupIds } = body;

    if (!sessionDate || !sessionType || !scanStartTime || !onTimeUntil || !endTime) {
      return NextResponse.json(
        { ok: false, message: "Semua field waktu sesi wajib diisi." },
        { status: 400 }
      );
    }
    if (!Array.isArray(groupIds) || groupIds.length === 0) {
      return NextResponse.json(
        { ok: false, message: "Pilih minimal satu kelompok yang mengaji." },
        { status: 400 }
      );
    }

    const id = await createSession({
      sessionDate,
      sessionType,
      scanStartTime,
      onTimeUntil,
      endTime,
      groupIds,
    });

    return NextResponse.json({ ok: true, id });
  } catch (err) {
    return handleApiError(err);
  }
}
