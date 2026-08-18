"use client";

import useSWR from "swr";
import { Card } from "@/components/ui/Basics";
import { LoadingState, ErrorState } from "@/components/ui/States";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const STAT_LABELS: Array<{ key: "hadir" | "terlambat" | "izin" | "sakit" | "alpa"; label: string; color: string }> = [
  { key: "hadir", label: "Hadir", color: "text-[var(--status-hadir)]" },
  { key: "terlambat", label: "Terlambat", color: "text-[var(--status-terlambat)]" },
  { key: "izin", label: "Izin", color: "text-[var(--status-izin)]" },
  { key: "sakit", label: "Sakit", color: "text-[var(--status-sakit)]" },
  { key: "alpa", label: "Alpa", color: "text-[var(--status-alpa)]" },
];

export function DashboardContent() {
  const { data, error, isLoading } = useSWR("/api/dashboard/stats", fetcher, {
    refreshInterval: 30000,
  });

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <div>
        <p className="text-sm font-semibold text-ppm-gold-dark">Beranda</p>
        <h1 className="font-display text-2xl font-extrabold text-gray-800">Dashboard</h1>
      </div>

      {isLoading && <LoadingState />}
      {error && <ErrorState message="Gagal memuat statistik. Periksa koneksi internet dan coba lagi." />}

      {data && data.ok && (
        <>
          {data.activeSessionLabel ? (
            <Card className="border-ppm-green bg-ppm-green/5 p-4">
              <p className="font-semibold text-ppm-green-dark">{data.activeSessionLabel}</p>
            </Card>
          ) : (
            <Card className="p-4">
              <p className="text-sm text-gray-500">Tidak ada sesi presensi yang sedang berlangsung saat ini.</p>
            </Card>
          )}

          <div>
            <h2 className="mb-3 font-display text-lg font-bold text-gray-700">
              Statistik Hari Ini
            </h2>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
              {STAT_LABELS.map((s) => (
                <Card key={s.key} className="flex flex-col items-center gap-1 p-5">
                  <p className={`font-display text-3xl font-extrabold ${s.color}`}>
                    {data.stats[s.key]}
                  </p>
                  <p className="text-sm font-semibold text-gray-500">{s.label}</p>
                </Card>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
