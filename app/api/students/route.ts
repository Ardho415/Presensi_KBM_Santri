import { NextRequest, NextResponse } from "next/server";
import { requireAuth, handleApiError } from "@/lib/api-guard";
import { listStudents, createStudent } from "@/lib/services/students";

export async function GET(request: NextRequest) {
  const unauthorized = await requireAuth();
  if (unauthorized) return unauthorized;

  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") ?? undefined;
    const classId = searchParams.get("classId") ?? undefined;
    const activeParam = searchParams.get("active");
    const active = activeParam === null ? undefined : activeParam === "true";

    const students = await listStudents({ search, classId, active });
    return NextResponse.json({ ok: true, students });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(request: NextRequest) {
  const unauthorized = await requireAuth();
  if (unauthorized) return unauthorized;

  try {
    const body = await request.json();
    const { nis, name, classId, gender, generation, active } = body;

    if (!nis || !name || !classId || !gender) {
      return NextResponse.json(
        { ok: false, message: "NIS, Nama, Kelas, dan Jenis Kelamin wajib diisi." },
        { status: 400 }
      );
    }

    const id = await createStudent({
      nis,
      name,
      classId,
      gender,
      generation: generation || null,
      active: active ?? true,
    });

    return NextResponse.json({ ok: true, id });
  } catch (err) {
    return handleApiError(err);
  }
}
