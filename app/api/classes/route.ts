import { NextResponse } from "next/server";
import { requireAuth, handleApiError } from "@/lib/api-guard";
import { listClasses, createClass } from "@/lib/services/classes";

export async function GET() {
  const unauthorized = await requireAuth();
  if (unauthorized) return unauthorized;

  try {
    const classes = await listClasses();
    return NextResponse.json({ ok: true, classes });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: Request) {
  const unauthorized = await requireAuth();
  if (unauthorized) return unauthorized;

  try {
    const { name, sort_order } = await req.json();
    if (!name) {
      return NextResponse.json({ ok: false, message: "Nama kelas wajib diisi" }, { status: 400 });
    }
    
    await createClass(name, sort_order || 0);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
