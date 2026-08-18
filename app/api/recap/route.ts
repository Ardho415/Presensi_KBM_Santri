import { NextRequest, NextResponse } from "next/server";
import { requireAuth, handleApiError } from "@/lib/api-guard";
import { buildRecap } from "@/lib/services/recap";
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

    const rows = await buildRecap({ dateFrom, dateTo, groupId });
    return NextResponse.json({ ok: true, rows });
  } catch (err) {
    return handleApiError(err);
  }
}
