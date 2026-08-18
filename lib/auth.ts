import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

/**
 * Autentikasi dashboard sangat sederhana secara sengaja:
 * - Hanya ada 1 akun, username & password berasal dari environment variable.
 * - Tidak ada tabel user, tidak ada registrasi, tidak ada role system.
 * - Session disimpan sebagai JWT ringkas di cookie HttpOnly.
 */

const COOKIE_NAME = "ppm_session";
const SESSION_DURATION_SECONDS = 60 * 60 * 12; // 12 jam

function getAuthSecretKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("AUTH_SECRET belum diset di environment variables.");
  }
  return new TextEncoder().encode(secret);
}

export async function verifyCredentials(
  username: string,
  password: string
): Promise<boolean> {
  const adminUsername = process.env.ADMIN_USERNAME;
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminUsername || !adminPassword) {
    throw new Error(
      "ADMIN_USERNAME / ADMIN_PASSWORD belum diset di environment variables."
    );
  }

  return username === adminUsername && password === adminPassword;
}

export async function createSession(username: string): Promise<string> {
  const token = await new SignJWT({ sub: username })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION_SECONDS}s`)
    .sign(getAuthSecretKey());
  return token;
}

export async function setSessionCookie(token: string) {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DURATION_SECONDS,
  });
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export async function getSessionUsername(): Promise<string | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, getAuthSecretKey());
    return (payload.sub as string) ?? null;
  } catch {
    return null;
  }
}

export async function isAuthenticated(): Promise<boolean> {
  const username = await getSessionUsername();
  return username !== null;
}

export const SESSION_COOKIE_NAME = COOKIE_NAME;
