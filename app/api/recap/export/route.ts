import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { requireAuth, handleApiError } from "@/lib/api-guard";
import { buildRecap } from "@/lib/services/recap";
import { finalizeExpiredSessionGroups } from "@/lib/services/attendance";

export async function GET(request: NextRequest) {
  const unauthorized = await requireAuth();
  if (unauthorized) return unauthorized;

  try {
    await finalizeExpiredSessionGroups();

    const { searchParams } = new URL(request.url);
    const dateFrom = searchParams.get("from");
    const dateTo = searchParams.get("to");
    const groupId = searchParams.get("groupId") ?? undefined;

    if (!dateFrom || !dateTo) {
      return NextResponse.json(
        { ok: false, message: "Parameter from dan to wajib diisi." },
        { status: 400 }
      );
    }

    const rows = await buildRecap({ dateFrom, dateTo, groupId });

    const sheetData = rows.map((r) => ({
      NIS: r.nis,
      Nama: r.name,
      Kelas: r.className,
      Gender: r.gender,
      Hadir: r.hadir,
      Terlambat: r.terlambat,
      Izin: r.izin,
      Sakit: r.sakit,
      Alpa: r.alpa,
      Persentase: `${r.percentage.toFixed(2)}%`,
    }));

    const worksheet = XLSX.utils.json_to_sheet(sheetData);
    worksheet["!cols"] = [
      { wch: 14 },
      { wch: 28 },
      { wch: 12 },
      { wch: 8 },
      { wch: 8 },
      { wch: 10 },
      { wch: 8 },
      { wch: 8 },
      { wch: 8 },
      { wch: 12 },
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Rekap Presensi");

    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="rekap-presensi-${dateFrom}_${dateTo}.xlsx"`,
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
