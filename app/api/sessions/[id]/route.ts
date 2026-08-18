import { NextRequest, NextResponse } from "next/server";
import { requireAuth, handleApiError } from "@/lib/api-guard";
import { deleteSession, getSessionDetail } from "@/lib/services/sessions";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const unauthorized = await requireAuth();
  if (unauthorized) return unauthorized;

  try {
    const { id } = await params;
    const session = await getSessionDetail(id);
    return NextResponse.json({ ok: true, session });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const unauthorized = await requireAuth();
  if (unauthorized) return unauthorized;

  try {
    const { id } = await params;
    await deleteSession(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
