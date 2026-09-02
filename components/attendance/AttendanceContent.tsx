"use client";

import useSWR from "swr";
import { useState } from "react";
import { Card, Field, Input, Select, Button, FilterBar } from "@/components/ui/Basics";
import { LoadingState, ErrorState, EmptyState } from "@/components/ui/States";
import { MatrixCell } from "@/components/ui/StatusBadge";
import { useToast } from "@/components/ui/Toast";
import type { AttendanceStatus } from "@/types/domain";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

function todayWIBString() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(new Date());
}

function daysAgoWIBString(days: number) {
  const now = new Date();
  now.setDate(now.getDate() - days);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(now);
}

const STATUS_OPTIONS: { value: AttendanceStatus; label: string }[] = [
  { value: "hadir", label: "Hadir" },
  { value: "terlambat", label: "Terlambat" },
  { value: "izin", label: "Izin" },
  { value: "sakit", label: "Sakit" },
  { value: "alpa", label: "Alpa" },
];

export function AttendanceContent() {
  const { showToast } = useToast();
  const { data: ref } = useSWR("/api/reference", fetcher);

  const [from, setFrom] = useState(daysAgoWIBString(9));
  const [to, setTo] = useState(todayWIBString());
  const [groupId, setGroupId] = useState("");
  const [appliedQuery, setAppliedQuery] = useState({ from: daysAgoWIBString(9), to: todayWIBString(), groupId: "" });

  const { data, isLoading, mutate } = useSWR(
    `/api/attendance?from=${appliedQuery.from}&to=${appliedQuery.to}&groupId=${appliedQuery.groupId}`,
    fetcher
  );

  const [editTarget, setEditTarget] = useState<{
    sessionId: string;
    studentId: string;
    studentName: string;
    label: string;
  } | null>(null);
  const [savingStatus, setSavingStatus] = useState(false);

  function applyFilter() {
    setAppliedQuery({ from, to, groupId });
  }

  async function handleChangeStatus(status: AttendanceStatus) {
    if (!editTarget) return;
    setSavingStatus(true);
    try {
      const res = await fetch("/api/attendance", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: editTarget.sessionId,
          studentId: editTarget.studentId,
          status,
        }),
      });
      const result = await res.json();
      if (!result.ok) {
        showToast(result.message ?? "Gagal memperbarui status.", "error");
        return;
      }
      showToast("Status presensi diperbarui.");
      setEditTarget(null);
      mutate();
    } catch {
      showToast("Gagal terhubung ke server.", "error");
    } finally {
      setSavingStatus(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <div>
        <p className="text-sm font-semibold text-ppm-gold-dark">Presensi</p>
        <h1 className="font-display text-2xl font-extrabold text-gray-800">
          Santri PPM Roudlotul Jannah
        </h1>
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
            <option value="">Semua Kelas &amp; Gender</option>
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
        {data && !data.ok && <ErrorState message="Gagal memuat data presensi." />}
        {data?.ok && data.sessions.length === 0 && (
          <EmptyState title="Belum ada sesi pada rentang tanggal ini" />
        )}
        {data?.ok && data.sessions.length > 0 && (
          <div className="scroll-thin overflow-x-auto">
            <table className="w-full border-collapse text-center text-sm">
              <thead>
                <tr className="bg-ppm-green text-white">
                  <th className="sticky left-0 z-10 bg-ppm-green px-4 py-3 text-left font-semibold">
                    Nama
                  </th>
                  {groupDaySpans(data.sessions).map((span) => (
                    <th
                      key={span.date}
                      colSpan={span.count}
                      className="border-l border-ppm-green-dark px-2 py-2 font-semibold"
                    >
                      {span.day}
                    </th>
                  ))}
                </tr>
                <tr className="bg-ppm-green-dark text-white text-xs">
                  <th className="sticky left-0 z-10 bg-ppm-green-dark px-4 py-1 text-left"></th>
                  {data.sessions.map((s: any) => (
                    <th key={s.sessionId} className="border-l border-ppm-green px-2 py-1 font-semibold">
                      {s.type.charAt(0).toUpperCase()}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.rows.length === 0 && (
                  <tr>
                    <td colSpan={data.sessions.length + 1} className="py-10 text-gray-400">
                      Tidak ada santri pada filter ini.
                    </td>
                  </tr>
                )}
                {data.rows.map((row: any) => (
                  <tr key={row.studentId} className="border-t border-ppm-border hover:bg-ppm-cream/40">
                    <td className="sticky left-0 z-10 bg-white px-4 py-2 text-left font-medium text-gray-700">
                      {row.name}
                    </td>
                    {data.sessions.map((s: any) => {
                      const code = row.cells[s.sessionId] ?? "-";
                      const clickable = code !== "-";
                      return (
                        <td
                          key={s.sessionId}
                          className={`border-l border-ppm-border px-2 py-2 ${
                            clickable ? "cursor-pointer hover:bg-ppm-cream" : ""
                          }`}
                          onClick={() =>
                            clickable &&
                            setEditTarget({
                              sessionId: s.sessionId,
                              studentId: row.studentId,
                              studentName: row.name,
                              label: s.label,
                            })
                          }
                        >
                          <MatrixCell code={code} />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {editTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="font-display text-lg font-bold text-gray-800">Ubah Status Presensi</h3>
            <p className="mt-1 text-sm text-gray-500">
              {editTarget.studentName} &middot; {editTarget.label}
            </p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              {STATUS_OPTIONS.map((opt) => (
                <Button
                  key={opt.value}
                  variant="outline"
                  disabled={savingStatus}
                  onClick={() => handleChangeStatus(opt.value)}
                >
                  {opt.label}
                </Button>
              ))}
            </div>
            <div className="mt-4 text-right">
              <Button variant="ghost" onClick={() => setEditTarget(null)}>
                Batal
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function groupDaySpans(sessions: any[]): Array<{ date: string; day: string; count: number }> {
  const spans: Array<{ date: string; day: string; count: number }> = [];
  for (const s of sessions) {
    const day = String(parseInt(s.date.split("-")[2], 10));
    const last = spans[spans.length - 1];
    if (last && last.date === s.date) {
      last.count += 1;
    } else {
      spans.push({ date: s.date, day, count: 1 });
    }
  }
  return spans;
}
