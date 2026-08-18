import { NextRequest, NextResponse } from "next/server";
import { finalizeExpiredSessionGroups } from "@/lib/services/attendance";

/**
 * Endpoint ini dipanggil secara berkala oleh Vercel Cron (lihat
 * vercel.json) agar santri yang belum absen otomatis menjadi Alpa
 * setelah waktu "Selesai" terlewati -- TANPA bergantung pada dashboard
 * admin yang terbuka. Finalisasi juga terjadi secara lazy di endpoint
 * scan/detail/rekap, jadi cron ini adalah lapisan keandalan tambahan.
 *
 * Dilindungi dengan CRON_SECRET (opsional tapi disarankan di production)
 * yang dikirim Vercel Cron melalui header Authorization: Bearer <secret>.
 */
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ ok: false, message: "Unauthorized." }, { status: 401 });
    }
  }

  try {
    const count = await finalizeExpiredSessionGroups();
    return NextResponse.json({ ok: true, finalized: count });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ ok: false, message: err.message }, { status: 500 });
  }
}
