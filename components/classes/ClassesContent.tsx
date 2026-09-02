"use client";

import useSWR from "swr";
import { useState } from "react";
import { Card, Field, Input, Button } from "@/components/ui/Basics";
import { LoadingState, ErrorState, EmptyState } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function ClassesContent() {
  const { data, isLoading, mutate } = useSWR("/api/classes", fetcher);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-ppm-gold-dark">Data Master</p>
          <h1 className="font-display text-2xl font-extrabold text-gray-800">Data Kelas</h1>
        </div>
        <Button variant="gold" onClick={() => setShowAddForm((v) => !v)}>
          {showAddForm ? "Tutup Form" : "+ Tambah Kelas"}
        </Button>
      </div>

      {showAddForm && (
        <AddClassForm
          onCreated={() => {
            setShowAddForm(false);
            mutate();
          }}
        />
      )}

      <Card className="overflow-hidden">
        {isLoading && <LoadingState />}
        {data && !data.ok && <ErrorState message="Gagal memuat data kelas." />}
        {data?.ok && data.classes.length === 0 && (
          <EmptyState title="Tidak ada kelas ditemukan" />
        )}
        {data?.ok && data.classes.length > 0 && (
          <div className="scroll-thin overflow-x-auto">
            <table className="w-full min-w-[500px] text-left text-sm">
              <thead className="bg-ppm-green text-white">
                <tr>
                  <th className="px-4 py-3 font-semibold">Nama Kelas</th>
                  <th className="px-4 py-3 font-semibold w-24 text-center">Urutan</th>
                  <th className="px-4 py-3 font-semibold text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {data.classes.map((c: any) => (
                  <ClassRow
                    key={c.id}
                    classData={c}
                    editing={editingId === c.id}
                    onEdit={() => setEditingId(c.id)}
                    onCancelEdit={() => setEditingId(null)}
                    onSaved={() => {
                      setEditingId(null);
                      mutate();
                    }}
                    onDeleted={() => mutate()}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function AddClassForm({ onCreated }: { onCreated: () => void }) {
  const { showToast } = useToast();
  const [name, setName] = useState("");
  const [sortOrder, setSortOrder] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    setError(null);
    if (!name) {
      setError("Nama kelas wajib diisi.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/classes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, sort_order: sortOrder }),
      });
      const result = await res.json();
      if (!result.ok) {
        setError(result.message ?? "Gagal menambahkan kelas.");
        return;
      }
      showToast("Kelas berhasil ditambahkan.");
      setName("");
      setSortOrder(0);
      onCreated();
    } catch {
      setError("Gagal terhubung ke server.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card className="p-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Nama Kelas">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Contoh: Kelas 1A" />
        </Field>
        <Field label="Urutan (opsional)">
          <Input 
            type="number" 
            value={sortOrder} 
            onChange={(e) => setSortOrder(parseInt(e.target.value) || 0)} 
          />
        </Field>
      </div>
      {error && <p className="mt-3 text-sm font-medium text-red-600">{error}</p>}
      <div className="mt-4">
        <Button onClick={handleSubmit} disabled={submitting}>
          {submitting ? "Menyimpan..." : "Simpan Kelas"}
        </Button>
      </div>
    </Card>
  );
}

function ClassRow({
  classData,
  editing,
  onEdit,
  onCancelEdit,
  onSaved,
  onDeleted,
}: {
  classData: any;
  editing: boolean;
  onEdit: () => void;
  onCancelEdit: () => void;
  onSaved: () => void;
  onDeleted: () => void;
}) {
  const { showToast } = useToast();
  const [name, setName] = useState(classData.name);
  const [sortOrder, setSortOrder] = useState(classData.sort_order);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch(`/api/classes/${classData.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, sort_order: sortOrder }),
      });
      const result = await res.json();
      if (!result.ok) {
        showToast(result.message ?? "Gagal menyimpan perubahan.", "error");
        return;
      }
      showToast("Data kelas diperbarui.");
      onSaved();
    } catch {
      showToast("Gagal terhubung ke server.", "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    const confirmed = window.confirm(
      `Hapus kelas ${classData.name}? Pastikan tidak ada santri yang terikat dengan kelas ini.`
    );
    if (!confirmed) return;

    try {
      const res = await fetch(`/api/classes/${classData.id}`, {
        method: "DELETE",
      });
      const result = await res.json();
      if (!result.ok) {
        showToast(result.message ?? "Gagal menghapus kelas.", "error");
        return;
      }
      showToast("Kelas berhasil dihapus.");
      onDeleted();
    } catch {
      showToast("Gagal terhubung ke server.", "error");
    }
  }

  if (editing) {
    return (
      <tr className="border-t border-ppm-border bg-ppm-cream/40">
        <td className="px-4 py-2">
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </td>
        <td className="px-4 py-2 w-24">
          <Input 
            type="number" 
            value={sortOrder} 
            onChange={(e) => setSortOrder(parseInt(e.target.value) || 0)} 
          />
        </td>
        <td className="px-4 py-2">
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onCancelEdit}>
              Batal
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "..." : "Simpan"}
            </Button>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-t border-ppm-border hover:bg-ppm-cream/30">
      <td className="px-4 py-2 font-medium text-gray-800">{classData.name}</td>
      <td className="px-4 py-2 text-center text-gray-600">{classData.sort_order}</td>
      <td className="px-4 py-2">
        <div className="flex justify-end gap-3">
          <button onClick={onEdit} className="text-sm font-semibold text-ppm-green-dark">
            Edit
          </button>
          <button onClick={handleDelete} className="text-sm font-semibold text-red-600">
            Hapus
          </button>
        </div>
      </td>
    </tr>
  );
}
