import { NextRequest, NextResponse } from "next/server";
import { validateOperatorByNis } from "@/lib/services/attendance";

// Route ini SENGAJA publik (tidak perlu login dashboard) karena dipakai
// oleh petugas presensi di /scan, sesuai requirement bahwa petugas tidak
// mempunyai akses dashboard.
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const nis = String(body.nis ?? "");
    const result = await validateOperatorByNis(nis);
    return NextResponse.json(result);
  } catch (err: any) {
    console.error(err);
    return NextResponse.json(
      { ok: false, message: "Gagal terhubung ke server. Periksa koneksi internet dan coba lagi." },
      { status: 500 }
    );
  }
}
