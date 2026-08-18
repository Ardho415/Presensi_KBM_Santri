"use client";

import { useEffect, useState } from "react";
import { Card, Field, Input, Button } from "@/components/ui/Basics";
import { useToast } from "@/components/ui/Toast";

export function SessionDefaultsEditor({
  sessionSettings,
  onSaved,
}: {
  sessionSettings: any[];
  onSaved: () => void;
}) {
  const { showToast } = useToast();
  const [open, setOpen] = useState(false);

  return (
    <Card className="p-4">
      <button
        onClick={() => setOpen((v) => !v)}
        className="text-sm font-semibold text-ppm-green-dark"
      >
        {open ? "Tutup Pengaturan Default Waktu" : "Atur Default Waktu Sesi (Subuh/Malam)"}
      </button>
      {open && (
        <div className="mt-4 flex flex-col gap-4">
          {(sessionSettings ?? []).map((s) => (
            <DefaultRow key={s.session_type} setting={s} onSaved={onSaved} showToast={showToast} />
          ))}
        </div>
      )}
    </Card>
  );
}

function DefaultRow({
  setting,
  onSaved,
  showToast,
}: {
  setting: any;
  onSaved: () => void;
  showToast: (msg: string, variant?: "success" | "error") => void;
}) {
  const [scanStart, setScanStart] = useState(setting.scan_start_time?.slice(0, 5) ?? "");
  const [onTimeUntil, setOnTimeUntil] = useState(setting.on_time_until?.slice(0, 5) ?? "");
  const [endTime, setEndTime] = useState(setting.end_time?.slice(0, 5) ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setScanStart(setting.scan_start_time?.slice(0, 5) ?? "");
    setOnTimeUntil(setting.on_time_until?.slice(0, 5) ?? "");
    setEndTime(setting.end_time?.slice(0, 5) ?? "");
  }, [setting]);

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch("/api/session-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionType: setting.session_type,
          scanStartTime: scanStart,
          onTimeUntil,
          endTime,
        }),
      });
      const result = await res.json();
      if (!result.ok) {
        showToast(result.message ?? "Gagal menyimpan default waktu.", "error");
        return;
      }
      showToast(`Default waktu sesi ${setting.label} berhasil disimpan.`);
      onSaved();
    } catch {
      showToast("Gagal terhubung ke server.", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid grid-cols-1 items-end gap-3 border-t border-ppm-border pt-4 first:border-t-0 first:pt-0 sm:grid-cols-4">
      <p className="font-semibold text-gray-700 sm:col-span-4">Sesi {setting.label}</p>
      <Field label="Mulai Scan">
        <Input type="time" value={scanStart} onChange={(e) => setScanStart(e.target.value)} />
      </Field>
      <Field label="Batas Tepat Waktu">
        <Input type="time" value={onTimeUntil} onChange={(e) => setOnTimeUntil(e.target.value)} />
      </Field>
      <Field label="Selesai">
        <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
      </Field>
      <Button variant="outline" onClick={handleSave} disabled={saving}>
        {saving ? "Menyimpan..." : "Simpan Default"}
      </Button>
    </div>
  );
}
