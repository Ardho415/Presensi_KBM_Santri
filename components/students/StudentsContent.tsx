"use client";

import useSWR from "swr";
import { useMemo, useRef, useState } from "react";
import { Card, Field, Input, Select, Button, FilterBar } from "@/components/ui/Basics";
import { LoadingState, ErrorState, EmptyState } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function StudentsContent() {
  const { showToast } = useToast();
  const { data: ref } = useSWR("/api/reference", fetcher);
  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState("");
  const [activeFilter, setActiveFilter] = useState("");

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (classFilter) params.set("classId", classFilter);
    if (activeFilter) params.set("active", activeFilter);
    return params.toString();
  }, [search, classFilter, activeFilter]);

  const { data, isLoading, mutate } = useSWR(`/api/students?${queryString}`, fetcher);

  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [importSummary, setImportSummary] = useState<any>(null);

  async function handleImport(file: File) {
    setImporting(true);
    setImportSummary(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/students/import", { method: "POST", body: formData });
      const result = await res.json();
      if (!result.ok) {
        showToast(result.message ?? "Gagal mengimpor data.", "error");
        return;
      }
      setImportSummary(result.summary);
      showToast(
        `Import selesai: ${result.summary.created} ditambahkan, ${result.summary.skipped} dilewati, ${result.summary.error} error.`
      );
      mutate();
    } catch {
      showToast("Gagal terhubung ke server.", "error");
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-ppm-gold-dark">Data Master</p>
          <h1 className="font-display text-2xl font-extrabold text-gray-800">Data Santri</h1>
        </div>
        <div className="flex gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleImport(e.target.files[0])}
          />
          <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={importing}>
            {importing ? "Mengimpor..." : "Import Excel/CSV"}
          </Button>
          <Button variant="gold" onClick={() => setShowAddForm((v) => !v)}>
            {showAddForm ? "Tutup Form" : "+ Tambah Santri"}
          </Button>
        </div>
      </div>

      {importSummary && (
        <Card className="border-ppm-green bg-ppm-green/5 p-4 text-sm">
          Import selesai: <strong>{importSummary.created}</strong> ditambahkan,{" "}
          <strong>{importSummary.skipped}</strong> dilewati (NIS sudah ada),{" "}
          <strong>{importSummary.error}</strong> gagal. Format kolom: NIS, Nama, Kelas, Angkatan,
          Jenis Kelamin (L/P), Aktif (TRUE/FALSE).
        </Card>
      )}

      {showAddForm && (
        <AddStudentForm
          classes={ref?.classes ?? []}
          onCreated={() => {
            setShowAddForm(false);
            mutate();
          }}
        />
      )}

      <FilterBar>
        <Field label="Cari Nama / NIS">
          <Input
            placeholder="Ketik nama atau NIS..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </Field>
        <Field label="Kelas">
          <Select value={classFilter} onChange={(e) => setClassFilter(e.target.value)}>
            <option value="">Semua Kelas</option>
            {(ref?.classes ?? []).map((c: any) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Status">
          <Select value={activeFilter} onChange={(e) => setActiveFilter(e.target.value)}>
            <option value="">Semua</option>
            <option value="true">Aktif</option>
            <option value="false">Nonaktif</option>
          </Select>
        </Field>
      </FilterBar>

      <Card className="overflow-hidden">
        {isLoading && <LoadingState />}
        {data && !data.ok && <ErrorState message="Gagal memuat data santri." />}
        {data?.ok && data.students.length === 0 && (
          <EmptyState title="Tidak ada santri ditemukan" />
        )}
        {data?.ok && data.students.length > 0 && (
          <div className="scroll-thin overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="bg-ppm-green text-white">
                <tr>
                  <th className="px-4 py-3 font-semibold">NIS</th>
                  <th className="px-4 py-3 font-semibold">Nama</th>
                  <th className="px-4 py-3 font-semibold">Kelas</th>
                  <th className="px-4 py-3 font-semibold">Gender</th>
                  <th className="px-4 py-3 font-semibold">Angkatan</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {data.students.map((s: any) => (
                  <StudentRow
                    key={s.id}
                    student={s}
                    classes={ref?.classes ?? []}
                    editing={editingId === s.id}
                    onEdit={() => setEditingId(s.id)}
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

function AddStudentForm({ classes, onCreated }: { classes: any[]; onCreated: () => void }) {
  const { showToast } = useToast();
  const [nis, setNis] = useState("");
  const [name, setName] = useState("");
  const [classId, setClassId] = useState("");
  const [gender, setGender] = useState("L");
  const [generation, setGeneration] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    setError(null);
    if (!nis || !name || !classId) {
      setError("NIS, Nama, dan Kelas wajib diisi.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/students", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nis, name, classId, gender, generation, active: true }),
      });
      const result = await res.json();
      if (!result.ok) {
        setError(result.message ?? "Gagal menambahkan santri.");
        return;
      }
      showToast("Santri berhasil ditambahkan.");
      setNis("");
      setName("");
      setGeneration("");
      onCreated();
    } catch {
      setError("Gagal terhubung ke server.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card className="p-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Field label="NIS">
          <Input value={nis} onChange={(e) => setNis(e.target.value)} />
        </Field>
        <Field label="Nama">
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Kelas">
          <Select value={classId} onChange={(e) => setClassId(e.target.value)}>
            <option value="">Pilih kelas</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Jenis Kelamin">
          <Select value={gender} onChange={(e) => setGender(e.target.value)}>
            <option value="L">Laki-laki (L)</option>
            <option value="P">Perempuan (P)</option>
          </Select>
        </Field>
        <Field label="Angkatan">
          <Input value={generation} onChange={(e) => setGeneration(e.target.value)} />
        </Field>
      </div>
      {error && <p className="mt-3 text-sm font-medium text-red-600">{error}</p>}
      <div className="mt-4">
        <Button onClick={handleSubmit} disabled={submitting}>
          {submitting ? "Menyimpan..." : "Simpan Santri"}
        </Button>
      </div>
    </Card>
  );
}

function StudentRow({
  student,
  classes,
  editing,
  onEdit,
  onCancelEdit,
  onSaved,
  onDeleted,
}: {
  student: any;
  classes: any[];
  editing: boolean;
  onEdit: () => void;
  onCancelEdit: () => void;
  onSaved: () => void;
  onDeleted: () => void;
}) {
  const { showToast } = useToast();
  const [name, setName] = useState(student.name);
  const [classId, setClassId] = useState(student.class_id);
  const [gender, setGender] = useState(student.gender);
  const [generation, setGeneration] = useState(student.generation ?? "");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch(`/api/students/${student.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, classId, gender, generation }),
      });
      const result = await res.json();
      if (!result.ok) {
        showToast(result.message ?? "Gagal menyimpan perubahan.", "error");
        return;
      }
      showToast("Data santri diperbarui.");
      onSaved();
    } catch {
      showToast("Gagal terhubung ke server.", "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive() {
    try {
      const res = await fetch(`/api/students/${student.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !student.active }),
      });
      const result = await res.json();
      if (!result.ok) {
        showToast(result.message ?? "Gagal memperbarui status.", "error");
        return;
      }
      showToast(student.active ? "Santri dinonaktifkan." : "Santri diaktifkan kembali.");
      onSaved();
    } catch {
      showToast("Gagal terhubung ke server.", "error");
    }
  }

  async function handleDelete() {
    const confirmed = window.confirm(
      `Hapus santri ${student.name} (${student.nis})? Data presensi dan riwayat kelas terkait akan ikut terhapus.`
    );
    if (!confirmed) return;

    try {
      const res = await fetch(`/api/students/${student.id}`, {
        method: "DELETE",
      });
      const result = await res.json();
      if (!result.ok) {
        showToast(result.message ?? "Gagal menghapus santri.", "error");
        return;
      }
      showToast("Santri berhasil dihapus.");
      onDeleted();
    } catch {
      showToast("Gagal terhubung ke server.", "error");
    }
  }

  if (editing) {
    return (
      <tr className="border-t border-ppm-border bg-ppm-cream/40">
        <td className="px-4 py-2 text-gray-500">{student.nis}</td>
        <td className="px-4 py-2">
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </td>
        <td className="px-4 py-2">
          <Select value={classId} onChange={(e) => setClassId(e.target.value)}>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </td>
        <td className="px-4 py-2">
          <Select value={gender} onChange={(e) => setGender(e.target.value)}>
            <option value="L">L</option>
            <option value="P">P</option>
          </Select>
        </td>
        <td className="px-4 py-2">
          <Input value={generation} onChange={(e) => setGeneration(e.target.value)} />
        </td>
        <td className="px-4 py-2 text-gray-500">{student.active ? "Aktif" : "Nonaktif"}</td>
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
      <td className="px-4 py-2 text-gray-600">{student.nis}</td>
      <td className="px-4 py-2 font-medium text-gray-800">{student.name}</td>
      <td className="px-4 py-2 text-gray-600">{student.class_name}</td>
      <td className="px-4 py-2 text-gray-600">{student.gender}</td>
      <td className="px-4 py-2 text-gray-600">{student.generation ?? "-"}</td>
      <td className="px-4 py-2">
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
            student.active ? "bg-green-100 text-green-700" : "bg-gray-200 text-gray-500"
          }`}
        >
          {student.active ? "Aktif" : "Nonaktif"}
        </span>
      </td>
      <td className="px-4 py-2">
        <div className="flex justify-end gap-2">
          <button onClick={onEdit} className="text-sm font-semibold text-ppm-green-dark">
            Edit
          </button>
          <button onClick={handleToggleActive} className="text-sm font-semibold text-gray-500">
            {student.active ? "Nonaktifkan" : "Aktifkan"}
          </button>
          <button onClick={handleDelete} className="text-sm font-semibold text-red-600">
            Hapus
          </button>
        </div>
      </td>
    </tr>
  );
}
