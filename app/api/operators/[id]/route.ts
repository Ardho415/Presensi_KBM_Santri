import { NextRequest, NextResponse } from "next/server";
import { requireAuth, handleApiError } from "@/lib/api-guard";
import { setOperatorActive, deleteOperator } from "@/lib/services/operators";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const unauthorized = await requireAuth();
  if (unauthorized) return unauthorized;

  try {
    const { id } = await params;
    const body = await request.json();
    await setOperatorActive(id, Boolean(body.active));
    return NextResponse.json({ ok: true });
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
    await deleteOperator(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
