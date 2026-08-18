import { NextRequest, NextResponse } from "next/server";
import { requireAuth, handleApiError } from "@/lib/api-guard";
import { listOperators, addOperator } from "@/lib/services/operators";

export async function GET() {
  const unauthorized = await requireAuth();
  if (unauthorized) return unauthorized;

  try {
    const operators = await listOperators();
    return NextResponse.json({ ok: true, operators });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(request: NextRequest) {
  const unauthorized = await requireAuth();
  if (unauthorized) return unauthorized;

  try {
    const body = await request.json();
    const { nis, groupId } = body;
    if (!nis || !groupId) {
      return NextResponse.json(
        { ok: false, message: "NIS dan kelompok wajib diisi." },
        { status: 400 }
      );
    }
    const result = await addOperator(nis, groupId);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return handleApiError(err);
  }
}
