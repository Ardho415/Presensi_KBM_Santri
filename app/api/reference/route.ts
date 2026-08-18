import { NextResponse } from "next/server";
import { requireAuth, handleApiError } from "@/lib/api-guard";
import { listClasses, listGroups, listSessionSettings } from "@/lib/services/reference";

// Data referensi dipakai di banyak halaman dashboard (dropdown kelas,
// kelompok, default waktu sesi).
export async function GET() {
  const unauthorized = await requireAuth();
  if (unauthorized) return unauthorized;

  try {
    const [classes, groups, sessionSettings] = await Promise.all([
      listClasses(),
      listGroups(),
      listSessionSettings(),
    ]);
    return NextResponse.json({ ok: true, classes, groups, sessionSettings });
  } catch (err) {
    return handleApiError(err);
  }
}
