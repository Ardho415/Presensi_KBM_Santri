import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { requireAuth, handleApiError } from "@/lib/api-guard";
import { importStudents } from "@/lib/services/students";

// Format kolom yang diterima (header tidak case sensitive):
// NIS | Nama | Kelas | Angkatan | Jenis Kelamin | Aktif
export async function POST(request: NextRequest) {
  const unauthorized = await requireAuth();
  if (unauthorized) return unauthorized;

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ ok: false, message: "File tidak ditemukan." }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rawRows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: "" });

    if (rawRows.length === 0) {
      return NextResponse.json(
        { ok: false, message: "File kosong atau tidak dapat dibaca." },
        { status: 400 }
      );
    }

    const normalized = rawRows.map((r) => {
      const map: Record<string, any> = {};
      for (const key of Object.keys(r)) {
        map[key.trim().toLowerCase()] = r[key];
      }
      return {
        nis: String(map["nis"] ?? "").trim(),
        name: String(map["nama"] ?? "").trim(),
        className: String(map["kelas"] ?? "").trim(),
        generation: String(map["angkatan"] ?? "").trim(),
        gender: String(map["jenis kelamin"] ?? map["gender"] ?? "").trim(),
        active: String(map["aktif"] ?? "").trim(),
      };
    });

    const results = await importStudents(normalized);
    const summary = {
      created: results.filter((r) => r.status === "created").length,
      skipped: results.filter((r) => r.status === "skipped").length,
      error: results.filter((r) => r.status === "error").length,
    };

    return NextResponse.json({ ok: true, summary, results });
  } catch (err) {
    return handleApiError(err);
  }
}
