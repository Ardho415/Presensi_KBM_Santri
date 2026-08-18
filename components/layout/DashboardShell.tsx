"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/sessions", label: "Buka Sesi" },
  { href: "/students", label: "Data Santri" },
  { href: "/attendance", label: "Detail Presensi" },
  { href: "/recap", label: "Rekap Presensi" },
  { href: "/operators", label: "Petugas Presensi" },
];

function BrandMark() {
  return (
    <div className="flex items-center gap-3">
      <Image
        src="/logo-ppm.png"
        alt="Logo PPM Roudlotul Jannah"
        width={44}
        height={44}
        className="h-11 w-11 object-contain"
      />
      <div className="leading-tight">
        <p className="font-display text-lg font-extrabold text-ppm-green">
          PPM ROUDLOTUL JANNAH
        </p>
        <p className="text-xs font-semibold text-ppm-gold-dark">Presensi Santri</p>
      </div>
    </div>
  );
}

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen w-full">
      {/* Sidebar desktop */}
      <aside className="hidden w-64 flex-col border-r border-ppm-border bg-white p-5 lg:flex">
        <BrandMark />
        <nav className="mt-8 flex flex-1 flex-col gap-1">
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                  active
                    ? "bg-ppm-green text-white"
                    : "text-gray-600 hover:bg-ppm-cream hover:text-ppm-green-dark"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <button
          onClick={handleLogout}
          disabled={loggingOut}
          className="mt-4 rounded-lg border border-ppm-border px-3 py-2 text-left text-sm font-semibold text-gray-600 hover:bg-ppm-cream"
        >
          {loggingOut ? "Keluar..." : "Logout"}
        </button>
      </aside>

      <div className="flex min-h-screen flex-1 flex-col">
        {/* Header mobile */}
        <header className="flex items-center justify-between border-b border-ppm-border bg-white px-4 py-3 lg:hidden">
          <BrandMark />
          <button
            aria-label="Buka menu"
            onClick={() => setMobileOpen(true)}
            className="rounded-lg border border-ppm-border p-2"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path
                d="M4 6h16M4 12h16M4 18h16"
                stroke="#0e9d54"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </header>

        {/* Drawer mobile */}
        {mobileOpen && (
          <div className="fixed inset-0 z-50 flex lg:hidden">
            <div
              className="flex-1 bg-black/40"
              onClick={() => setMobileOpen(false)}
            />
            <div className="flex w-72 flex-col bg-white p-5">
              <div className="mb-6 flex items-center justify-between">
                <BrandMark />
                <button onClick={() => setMobileOpen(false)} aria-label="Tutup menu">
                  ✕
                </button>
              </div>
              <nav className="flex flex-1 flex-col gap-1">
                {NAV_ITEMS.map((item) => {
                  const active = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileOpen(false)}
                      className={`rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                        active
                          ? "bg-ppm-green text-white"
                          : "text-gray-600 hover:bg-ppm-cream hover:text-ppm-green-dark"
                      }`}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </nav>
              <button
                onClick={handleLogout}
                disabled={loggingOut}
                className="mt-4 rounded-lg border border-ppm-border px-3 py-2 text-left text-sm font-semibold text-gray-600"
              >
                {loggingOut ? "Keluar..." : "Logout"}
              </button>
            </div>
          </div>
        )}

        <main className="flex-1 bg-background p-4 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
