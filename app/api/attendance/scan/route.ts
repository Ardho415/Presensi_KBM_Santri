import { NextRequest, NextResponse } from "next/server";
import { scanAttendance } from "@/lib/services/attendance";

// Publik (tidak perlu login dashboard) -- diakses oleh petugas presensi
// yang sudah tervalidasi lewat /api/operators/validate. operatorId
// dikirim dari client, tapi SEMUA aturan bisnis penting (waktu, status,
// duplikasi, kelas dibuka) tetap divalidasi ulang di server pada
// scanAttendance().
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const nis = String(body.nis ?? "");
    const operatorId = String(body.operatorId ?? "");

    if (!operatorId) {
      return NextResponse.json(
        { ok: false, message: "Sesi petugas tidak valid, silakan masukkan NIS petugas kembali." },
        { status: 400 }
      );
    }

    const result = await scanAttendance({ nis, operatorId });
    return NextResponse.json(result);
  } catch (err: any) {
    console.error(err);
    return NextResponse.json(
      { ok: false, message: "Gagal terhubung ke server. Periksa koneksi internet dan coba lagi." },
      { status: 500 }
    );
  }
}
