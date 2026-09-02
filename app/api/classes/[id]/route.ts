import { NextResponse } from "next/server";
import { requireAuth, handleApiError } from "@/lib/api-guard";
import { updateClass, deleteClass } from "@/lib/services/classes";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const unauthorized = await requireAuth();
  if (unauthorized) return unauthorized;

  try {
    const { id } = await params;
    const { name, sort_order } = await req.json();
    
    if (!name) {
      return NextResponse.json({ ok: false, message: "Nama kelas wajib diisi" }, { status: 400 });
    }

    await updateClass(id, name, sort_order !== undefined ? sort_order : 0);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const unauthorized = await requireAuth();
  if (unauthorized) return unauthorized;

  try {
    const { id } = await params;
    await deleteClass(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
