/**
 * Semua perhitungan tanggal & waktu presensi HARUS menggunakan timezone
 * Asia/Jakarta (WIB / UTC+7), terlepas dari timezone server Vercel.
 *
 * Kita tidak mengandalkan `process.env.TZ` karena Vercel functions bisa
 * berjalan di region manapun. Sebagai gantinya kita hitung offset WIB
 * secara eksplisit menggunakan Intl API.
 */

export const APP_TIMEZONE = "Asia/Jakarta";

/** Kembalikan Date "sekarang" tetapi sudah dianggap dalam representasi WIB */
export function nowWIB(): Date {
  return new Date();
}

/** Format sebuah Date menjadi string 'yyyy-MM-dd' pada timezone WIB */
export function toWIBDateString(date: Date = new Date()): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(date); // en-CA locale menghasilkan format yyyy-MM-dd
}

/** Format sebuah Date menjadi string 'HH:mm:ss' pada timezone WIB */
export function toWIBTimeString(date: Date = new Date()): string {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: APP_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  return fmt.format(date);
}

/**
 * Gabungkan tanggal (yyyy-MM-dd) + waktu (HH:mm atau HH:mm:ss) yang
 * dimaksudkan sebagai waktu WIB, menjadi Date (UTC instant) yang benar.
 * Karena WIB = UTC+7 tetap sepanjang tahun (tidak ada DST), konversinya
 * sederhana: instant UTC = local time - 7 jam.
 */
export function wibDateTimeToUTC(dateStr: string, timeStr: string): Date {
  const [h, m, s] = timeStr.split(":").map((v) => parseInt(v, 10));
  const [y, mo, d] = dateStr.split("-").map((v) => parseInt(v, 10));
  // Bentuk sebagai UTC lalu kurangi 7 jam agar merepresentasikan waktu WIB.
  const utcMillis = Date.UTC(y, mo - 1, d, h, m, s || 0) - 7 * 60 * 60 * 1000;
  return new Date(utcMillis);
}

/** Bandingkan apakah instant `now` berada dalam [start, end) WIB pada tanggal tertentu */
export function isWithinWIB(
  now: Date,
  dateStr: string,
  startTime: string,
  endTime: string
): boolean {
  const start = wibDateTimeToUTC(dateStr, startTime);
  const end = wibDateTimeToUTC(dateStr, endTime);
  return now >= start && now < end;
}

/** Format tanggal untuk ditampilkan, contoh: "16 Agustus 2026" */
export function formatDateIndonesian(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map((v) => parseInt(v, 10));
  const date = new Date(Date.UTC(y, m - 1, d));
  const fmt = new Intl.DateTimeFormat("id-ID", {
    timeZone: "UTC",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  return fmt.format(date);
}

/** Format jam saja untuk label matrix, contoh "16" dari "2026-08-16" */
export function dayOfMonth(dateStr: string): string {
  return String(parseInt(dateStr.split("-")[2], 10));
}
