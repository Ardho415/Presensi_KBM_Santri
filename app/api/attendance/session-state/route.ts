import { NextResponse } from "next/server";
import { getScannerSessionState, finalizeExpiredSessionGroups } from "@/lib/services/attendance";

// Publik: dipakai halaman /scan untuk mengetahui apakah ada sesi yang
// sedang berlangsung.
export async function GET() {
  try {
    await finalizeExpiredSessionGroups();
    const state = await getScannerSessionState();
    return NextResponse.json({ ok: true, ...state });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json(
      { ok: false, message: "Gagal terhubung ke server. Periksa koneksi internet dan coba lagi." },
      { status: 500 }
    );
  }
}
