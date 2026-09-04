import { NextRequest, NextResponse } from "next/server";
import { verifyCredentials, createSession, setSessionCookie } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const username = String(body.username ?? "");
    const password = String(body.password ?? "");

    if (!username || !password) {
      return NextResponse.json(
        { ok: false, message: "Username dan password wajib diisi." },
        { status: 400 }
      );
    }

    const valid = await verifyCredentials(username, password);
    if (!valid) {
      return NextResponse.json(
        { ok: false, message: "Username atau password salah." },
        { status: 401 }
      );
    }

    const token = await createSession(username);
    await setSessionCookie(token);

    return NextResponse.json(
      { ok: true },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, message: err.message ?? "Terjadi kesalahan pada server." },
      { status: 500 }
    );
  }
}
