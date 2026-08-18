import { NextRequest, NextResponse } from "next/server";
import { requireAuth, handleApiError } from "@/lib/api-guard";
import { buildAttendanceMatrix } from "@/lib/services/attendance-matrix";
import { editAttendanceStatus } from "@/lib/services/attendance";
import { finalizeExpiredSessionGroups } from "@/lib/services/attendance";

export async function GET(request: NextRequest) {
  const unauthorized = await requireAuth();
  if (unauthorized) return unauthorized;

  try {
    await finalizeExpiredSessionGroups();

    const { searchParams } = new URL(request.url);
    const dateFrom = searchParams.get("from");
    const dateTo = searchParams.get("to");
    const groupId = searchParams.get("groupId") ?? undefined;

    if (!dateFrom || !dateTo) {
      return NextResponse.json(
        { ok: false, message: "Parameter from dan to wajib diisi." },
        { status: 400 }
      );
    }

    const matrix = await buildAttendanceMatrix({ dateFrom, dateTo, groupId });
    return NextResponse.json({ ok: true, ...matrix });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(request: NextRequest) {
  const unauthorized = await requireAuth();
  if (unauthorized) return unauthorized;

  try {
    const body = await request.json();
    const { sessionId, studentId, status } = body;
    if (!sessionId || !studentId || !status) {
      return NextResponse.json({ ok: false, message: "Parameter tidak lengkap." }, { status: 400 });
    }
    const result = await editAttendanceStatus({ sessionId, studentId, status });
    return NextResponse.json(result);
  } catch (err) {
    return handleApiError(err);
  }
}
