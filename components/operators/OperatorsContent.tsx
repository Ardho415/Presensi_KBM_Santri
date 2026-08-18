"use client";

import useSWR from "swr";
import { useState } from "react";
import { Card, Field, Input, Select, Button } from "@/components/ui/Basics";
import { LoadingState, ErrorState, EmptyState } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function OperatorsContent() {
  const { showToast } = useToast();
  const { data: ref } = useSWR("/api/reference", fetcher);
  const { data, isLoading, mutate } = useSWR("/api/operators", fetcher);

  const [nis, setNis] = useState("");
  const [groupId, setGroupId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAdd() {
    setError(null);
    if (!nis || !groupId) {
      setError("NIS dan kelompok wajib diisi.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/operators", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nis, groupId }),
      });
      const result = await res.json();
      if (!result.ok) {
        setError(result.message ?? "Gagal menambahkan petugas.");
        return;
      }
      showToast(`${result.studentName} berhasil ditambahkan sebagai petugas.`);
      setNis("");
      mutate();
    } catch {
      setError("Gagal terhubung ke server.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggle(id: string, active: boolean) {
    try {
      const res = await fetch(`/api/operators/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !active }),
      });
      const result = await res.json();
      if (!result.ok) {
        showToast(result.message ?? "Gagal memperbarui petugas.", "error");
        return;
      }
      showToast(active ? "Petugas dinonaktifkan." : "Petugas diaktifkan kembali.");
      mutate();
    } catch {
      showToast("Gagal terhubung ke server.", "error");
    }
  }

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <div>
        <p className="text-sm font-semibold text-ppm-gold-dark">Presensi</p>
        <h1 className="font-display text-2xl font-extrabold text-gray-800">Petugas Presensi</h1>
        <p className="mt-1 text-sm text-gray-500">
          Santri yang terdaftar di sini dapat login sebagai petugas di halaman Scan QR untuk
          mengabsen teman sekelasnya.
        </p>
      </div>

      <Card className="p-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="NIS Santri">
            <Input value={nis} onChange={(e) => setNis(e.target.value)} placeholder="Masukkan NIS" />
          </Field>
          <Field label="Kelompok yang Ditugaskan">
            <Select value={groupId} onChange={(e) => setGroupId(e.target.value)}>
              <option value="">Pilih kelompok</option>
              {(ref?.groups ?? []).map((g: any) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </Select>
          </Field>
          <div className="flex items-end">
            <Button onClick={handleAdd} disabled={submitting} className="w-full">
              {submitting ? "Menyimpan..." : "Tambah Petugas"}
            </Button>
          </div>
        </div>
        {error && <p className="mt-3 text-sm font-medium text-red-600">{error}</p>}
      </Card>

      <Card className="overflow-hidden">
        {isLoading && <LoadingState />}
        {data && !data.ok && <ErrorState message="Gagal memuat data petugas." />}
        {data?.ok && data.operators.length === 0 && (
          <EmptyState title="Belum ada petugas presensi terdaftar" />
        )}
        {data?.ok && data.operators.length > 0 && (
          <table className="w-full text-left text-sm">
            <thead className="bg-ppm-green text-white">
              <tr>
                <th className="px-4 py-3 font-semibold">NIS</th>
                <th className="px-4 py-3 font-semibold">Nama</th>
                <th className="px-4 py-3 font-semibold">Kelompok</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {data.operators.map((o: any) => (
                <tr key={o.id} className="border-t border-ppm-border hover:bg-ppm-cream/40">
                  <td className="px-4 py-2 text-gray-600">{o.nis}</td>
                  <td className="px-4 py-2 font-medium text-gray-800">
                    {o.student_name}
                    {!o.student_active && (
                      <span className="ml-2 rounded bg-gray-200 px-1.5 py-0.5 text-[10px] text-gray-600">
                        santri nonaktif
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-gray-600">{o.group_name}</td>
                  <td className="px-4 py-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                        o.active ? "bg-green-100 text-green-700" : "bg-gray-200 text-gray-500"
                      }`}
                    >
                      {o.active ? "Aktif" : "Nonaktif"}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right">
                    <button
                      onClick={() => handleToggle(o.id, o.active)}
                      className="text-sm font-semibold text-ppm-green-dark"
                    >
                      {o.active ? "Nonaktifkan" : "Aktifkan"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
