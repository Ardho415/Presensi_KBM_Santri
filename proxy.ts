import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const COOKIE_NAME = "ppm_session";

const PROTECTED_PREFIXES = [
  "/dashboard",
  "/sessions",
  "/students",
  "/attendance",
  "/recap",
  "/operators",
];

function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );
}

async function hasValidSession(request: NextRequest): Promise<boolean> {
  const token = request.cookies.get(COOKIE_NAME)?.value;
  if (!token) return false;

  const secret = process.env.AUTH_SECRET;
  if (!secret) return false;

  try {
    await jwtVerify(token, new TextEncoder().encode(secret));
    return true;
  } catch {
    return false;
  }
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!isProtectedPath(pathname)) {
    return NextResponse.next();
  }

  const authenticated = await hasValidSession(request);

  if (!authenticated) {
    // Tidak ada route /login terpisah: kita redirect internal ke
    // /dashboard, dan halaman /dashboard sendiri yang menampilkan
    // form login apabila belum ada session.
    if (pathname !== "/dashboard") {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/dashboard",
    "/sessions/:path*",
    "/sessions",
    "/students/:path*",
    "/students",
    "/attendance/:path*",
    "/attendance",
    "/recap/:path*",
    "/recap",
    "/operators/:path*",
    "/operators",
  ],
};
