import "server-only";
import { buildAttendanceMatrix } from "@/lib/services/attendance-matrix";

export interface RecapRow {
  nis: string;
  name: string;
  className: string;
  gender: "L" | "P";
  hadir: number;
  terlambat: number;
  izin: number;
  sakit: number;
  alpa: number;
  totalSesiDibuka: number;
  percentage: number;
}

/**
 * Rekap = agregat dari matrix yang sama dipakai Detail Presensi, supaya
 * definisi "sesi dibuka" dan status per sel konsisten di kedua halaman.
 *
 * Persentase = (Hadir + Terlambat) / Total Sesi Dibuka x 100.
 * Sel kosong ("") -- sesi dibuka tapi santri belum sempat difinalisasi --
 * dihitung tetap masuk denominator (dianggap belum tuntas / akan menjadi
 * Alpa begitu difinalisasi), supaya angka rekap tidak menyesatkan.
 */
export async function buildRecap(params: {
  dateFrom: string;
  dateTo: string;
  groupId?: string;
}): Promise<RecapRow[]> {
  const { rows } = await buildAttendanceMatrix({
    dateFrom: params.dateFrom,
    dateTo: params.dateTo,
    groupId: params.groupId,
  });

  return rows.map((r) => {
    let hadir = 0;
    let terlambat = 0;
    let izin = 0;
    let sakit = 0;
    let alpa = 0;
    let totalSesiDibuka = 0;

    for (const code of Object.values(r.cells)) {
      if (code === "-") continue;
      totalSesiDibuka += 1;
      if (code === "H") hadir += 1;
      else if (code === "T") terlambat += 1;
      else if (code === "I") izin += 1;
      else if (code === "S") sakit += 1;
      else if (code === "A") alpa += 1;
      // code === "" (belum difinalisasi) tetap masuk denominator, tidak
      // menambah kategori manapun.
    }

    const percentage =
      totalSesiDibuka > 0 ? ((hadir + terlambat) / totalSesiDibuka) * 100 : 0;

    return {
      nis: r.nis,
      name: r.name,
      className: r.currentClassName,
      gender: r.currentGender,
      hadir,
      terlambat,
      izin,
      sakit,
      alpa,
      totalSesiDibuka,
      percentage: Math.round(percentage * 100) / 100,
    };
  });
}
