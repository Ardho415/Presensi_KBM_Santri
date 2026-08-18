import { NextRequest, NextResponse } from "next/server";
import { requireAuth, handleApiError } from "@/lib/api-guard";
import { toggleSessionGroup } from "@/lib/services/sessions";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const unauthorized = await requireAuth();
  if (unauthorized) return unauthorized;

  try {
    const { id } = await params;
    const body = await request.json();
    const { groupId, action } = body as { groupId: string; action: "close" | "reopen" };

    if (!groupId || !["close", "reopen"].includes(action)) {
      return NextResponse.json({ ok: false, message: "Parameter tidak valid." }, { status: 400 });
    }

    await toggleSessionGroup(id, groupId, action);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
