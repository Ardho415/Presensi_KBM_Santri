import "server-only";
import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";

/**
 * Dipakai di awal setiap API route dashboard (bukan /scan) untuk
 * memastikan request berasal dari session yang sudah login.
 * Return NextResponse jika tidak authenticated (untuk langsung
 * di-`return` oleh caller), atau null jika boleh lanjut.
 */
export async function requireAuth(): Promise<NextResponse | null> {
  const ok = await isAuthenticated();
  if (!ok) {
    return NextResponse.json({ ok: false, message: "Unauthorized." }, { status: 401 });
  }
  return null;
}

export function handleApiError(err: any): NextResponse {
  console.error(err);
  return NextResponse.json(
    { ok: false, message: err?.message ?? "Terjadi kesalahan pada server." },
    { status: 500 }
  );
}
