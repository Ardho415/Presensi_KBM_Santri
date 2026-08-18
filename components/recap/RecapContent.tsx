"use client";

import useSWR from "swr";
import { useState } from "react";
import { Card, Field, Input, Select, Button, FilterBar } from "@/components/ui/Basics";
import { LoadingState, ErrorState, EmptyState } from "@/components/ui/States";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

function todayWIBString() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(new Date());
}
function daysAgoWIBString(days: number) {
  const now = new Date();
  now.setDate(now.getDate() - days);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(now);
}

const COUNT_BADGE: Record<string, string> = {
  hadir: "bg-[var(--status-hadir)]",
  terlambat: "bg-[var(--status-terlambat)]",
  izin: "bg-[var(--status-izin)]",
  sakit: "bg-[var(--status-sakit)]",
  alpa: "bg-[var(--status-alpa)]",
};

export function RecapContent() {
  const { data: ref } = useSWR("/api/reference", fetcher);

  const [from, setFrom] = useState(daysAgoWIBString(29));
  const [to, setTo] = useState(todayWIBString());
  const [groupId, setGroupId] = useState("");
  const [applied, setApplied] = useState({ from: daysAgoWIBString(29), to: todayWIBString(), groupId: "" });

  const { data, isLoading } = useSWR(
    `/api/recap?from=${applied.from}&to=${applied.to}&groupId=${applied.groupId}`,
    fetcher
  );

  function applyFilter() {
    setApplied({ from, to, groupId });
  }

  function exportUrl() {
    const params = new URLSearchParams({ from: applied.from, to: applied.to });
    if (applied.groupId) params.set("groupId", applied.groupId);
    return `/api/recap/export?${params.toString()}`;
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-ppm-gold-dark">Laporan</p>
          <h1 className="font-display text-2xl font-extrabold text-gray-800">
            Rekapan Kehadiran Santri
          </h1>
        </div>
        <a href={exportUrl()}>
          <Button variant="outline">Export Excel</Button>
        </a>
      </div>

      <FilterBar>
        <Field label="Dari Tanggal">
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </Field>
        <Field label="Sampai Tanggal">
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </Field>
        <Field label="Pilih Kelas">
          <Select value={groupId} onChange={(e) => setGroupId(e.target.value)}>
            <option value="">— Semua Kelas &amp; Gender —</option>
            {(ref?.groups ?? []).map((g: any) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </Select>
        </Field>
        <Button variant="gold" onClick={applyFilter}>
          Filter Data
        </Button>
      </FilterBar>

      <Card className="overflow-hidden">
        {isLoading && <LoadingState />}
        {data && !data.ok && <ErrorState message="Gagal memuat rekap presensi." />}
        {data?.ok && data.rows.length === 0 && <EmptyState title="Tidak ada data pada rentang ini" />}
        {data?.ok && data.rows.length > 0 && (
          <div className="scroll-thin overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead className="bg-ppm-green text-white">
                <tr>
                  <th className="px-4 py-3 font-semibold">Nama</th>
                  <th className="px-4 py-3 font-semibold">NIS</th>
                  <th className="px-4 py-3 font-semibold">Kelas</th>
                  <th className="px-4 py-3 font-semibold">Gender</th>
                  <th className="px-4 py-3 font-semibold text-center">Hadir</th>
                  <th className="px-4 py-3 font-semibold text-center">Terlambat</th>
                  <th className="px-4 py-3 font-semibold text-center">Izin</th>
                  <th className="px-4 py-3 font-semibold text-center">Sakit</th>
                  <th className="px-4 py-3 font-semibold text-center">Alpa</th>
                  <th className="px-4 py-3 font-semibold">Persentase</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((r: any) => (
                  <tr key={r.nis} className="border-t border-ppm-border hover:bg-ppm-cream/40">
                    <td className="px-4 py-2 font-medium text-gray-800">{r.name}</td>
                    <td className="px-4 py-2 text-gray-600">{r.nis}</td>
                    <td className="px-4 py-2 text-gray-600">{r.className}</td>
                    <td className="px-4 py-2 text-gray-600">{r.gender}</td>
                    <td className="px-4 py-2 text-center">
                      <CountBadge value={r.hadir} colorKey="hadir" />
                    </td>
                    <td className="px-4 py-2 text-center">
                      <CountBadge value={r.terlambat} colorKey="terlambat" />
                    </td>
                    <td className="px-4 py-2 text-center">
                      <CountBadge value={r.izin} colorKey="izin" />
                    </td>
                    <td className="px-4 py-2 text-center">
                      <CountBadge value={r.sakit} colorKey="sakit" />
                    </td>
                    <td className="px-4 py-2 text-center">
                      <CountBadge value={r.alpa} colorKey="alpa" />
                    </td>
                    <td className="px-4 py-2 font-semibold text-gray-700">
                      {r.percentage.toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function CountBadge({ value, colorKey }: { value: number; colorKey: string }) {
  return (
    <span
      className={`inline-flex h-6 w-6 items-center justify-center rounded-md text-xs font-bold text-white ${COUNT_BADGE[colorKey]}`}
    >
      {value}
    </span>
  );
}
