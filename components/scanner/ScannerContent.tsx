"use client";

import { useEffect, useRef, useState } from "react";
import { ScanHeader } from "@/components/scanner/ScanHeader";
import { QrCamera } from "@/components/scanner/QrCamera";
import { Button, Input, Card } from "@/components/ui/Basics";

const OPERATOR_STORAGE_KEY = "ppm_scan_operator";

interface OperatorInfo {
  operatorId: string;
  studentName: string;
  groupName: string;
}

type SessionState =
  | { state: "loading" }
  | { state: "none" }
  | { state: "not_started"; label: string; scanStartTime: string }
  | { state: "active"; sessionId: string; label: string; endTime: string }
  | { state: "error" };

export function ScannerContent() {
  const [operator, setOperator] = useState<OperatorInfo | null>(null);

  useEffect(() => {
    const stored = sessionStorage.getItem(OPERATOR_STORAGE_KEY);
    if (stored) {
      try {
        setOperator(JSON.parse(stored));
      } catch {
        /* ignore */
      }
    }
  }, []);

  function handleLoggedIn(info: OperatorInfo) {
    setOperator(info);
    sessionStorage.setItem(OPERATOR_STORAGE_KEY, JSON.stringify(info));
  }

  function handleLogout() {
    setOperator(null);
    sessionStorage.removeItem(OPERATOR_STORAGE_KEY);
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <ScanHeader />
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col p-4">
        {operator ? (
          <ScannerGate operator={operator} onLogout={handleLogout} />
        ) : (
          <OperatorGate onLoggedIn={handleLoggedIn} />
        )}
      </main>
    </div>
  );
}

function OperatorGate({ onLoggedIn }: { onLoggedIn: (info: OperatorInfo) => void }) {
  const [nis, setNis] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/operators/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nis }),
      });
      const result = await res.json();
      if (!result.ok) {
        setError(result.message ?? "NIS petugas tidak valid.");
        return;
      }
      onLoggedIn({
        operatorId: result.operatorId,
        studentName: result.studentName,
        groupName: result.groupName,
      });
    } catch {
      setError("Gagal terhubung ke server. Periksa koneksi internet dan coba lagi.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="mt-10 p-6">
      <p className="text-sm font-semibold text-ppm-gold-dark">Login Petugas</p>
      <h1 className="font-display text-xl font-extrabold text-gray-800">
        Masukkan NIS Petugas Presensi
      </h1>
      <p className="mt-2 text-sm text-gray-500">
        Hanya santri yang terdaftar sebagai petugas presensi yang dapat mengakses fitur scan.
      </p>
      <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-3">
        <Input
          value={nis}
          onChange={(e) => setNis(e.target.value)}
          placeholder="Masukkan NIS petugas"
          inputMode="numeric"
          autoFocus
        />
        {error && <p className="text-sm font-medium text-red-600">{error}</p>}
        <Button type="submit" disabled={loading}>
          {loading ? "Memeriksa..." : "Masuk"}
        </Button>
      </form>
    </Card>
  );
}

function ScannerGate({
  operator,
  onLogout,
}: {
  operator: OperatorInfo;
  onLogout: () => void;
}) {
  const [session, setSession] = useState<SessionState>({ state: "loading" });
  const [manualOpen, setManualOpen] = useState(false);
  const [manualNis, setManualNis] = useState("");
  const [banner, setBanner] = useState<{ ok: boolean; message: string } | null>(null);
  const [paused, setPaused] = useState(false);
  const processingRef = useRef(false);
  const lastScanRef = useRef<{ text: string; time: number }>({ text: "", time: 0 });

  async function loadSessionState() {
    try {
      const res = await fetch("/api/attendance/session-state");
      const result = await res.json();
      if (!result.ok) {
        setSession({ state: "error" });
        return;
      }
      setSession(result as SessionState);
    } catch {
      setSession({ state: "error" });
    }
  }

  useEffect(() => {
    loadSessionState();
    const interval = setInterval(loadSessionState, 20000);
    return () => clearInterval(interval);
  }, []);

  async function submitScan(nis: string) {
    if (processingRef.current) return;
    processingRef.current = true;
    setPaused(true);
    try {
      const res = await fetch("/api/attendance/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nis, operatorId: operator.operatorId }),
      });
      const result = await res.json();
      setBanner({ ok: result.ok, message: result.message });
    } catch {
      setBanner({
        ok: false,
        message: "Gagal terhubung ke server. Periksa koneksi internet dan coba lagi.",
      });
    } finally {
      setTimeout(() => {
        setBanner(null);
        setPaused(false);
        processingRef.current = false;
      }, 1500);
    }
  }

  function handleDecode(text: string) {
    const now = Date.now();
    if (lastScanRef.current.text === text && now - lastScanRef.current.time < 3000) {
      return; // cegah scan ganda dari frame berturut-turut
    }
    lastScanRef.current = { text, time: now };
    submitScan(text.trim());
  }

  function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!manualNis.trim()) return;
    submitScan(manualNis.trim());
    setManualNis("");
  }

  const canScan = session.state === "active";

  return (
    <Card className="mt-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-ppm-gold-dark">
            {session.state === "active" ? `Presensi ${session.label}` : "Presensi"}
          </p>
          <h1 className="font-display text-xl font-extrabold text-gray-800">SCAN QR CODE</h1>
        </div>
        <button onClick={onLogout} className="text-xs font-semibold text-gray-400 underline">
          Ganti Petugas
        </button>
      </div>
      <p className="mt-1 text-sm text-gray-500">
        Petugas: {operator.studentName} &middot; {operator.groupName}
      </p>

      {session.state === "loading" && (
        <p className="mt-6 text-center text-sm text-gray-400">Memeriksa sesi presensi...</p>
      )}

      {session.state === "none" && (
        <div className="mt-6 rounded-lg bg-amber-50 p-4 text-center text-sm font-medium text-amber-700">
          Belum ada sesi presensi yang dibuka. Silakan hubungi ketua kelas.
        </div>
      )}

      {session.state === "not_started" && (
        <div className="mt-6 rounded-lg bg-amber-50 p-4 text-center text-sm font-medium text-amber-700">
          Sesi presensi {session.label} belum dimulai. Scan dapat dilakukan mulai jam{" "}
          {session.scanStartTime}.
        </div>
      )}

      {session.state === "error" && (
        <div className="mt-6 rounded-lg bg-red-50 p-4 text-center text-sm font-medium text-red-600">
          Gagal terhubung ke server. Periksa koneksi internet dan coba lagi.
        </div>
      )}

      {canScan && (
        <>
          <p className="mt-6 text-center text-sm text-gray-500">Arahkan kamera ke QR Code santri</p>
          <div className="relative mt-3">
            <QrCamera onDecode={handleDecode} paused={paused} />
            {banner && (
              <div
                className={`absolute left-1/2 top-1/2 w-[90%] -translate-x-1/2 -translate-y-1/2 rounded-lg border px-4 py-3 text-center text-sm font-semibold shadow-lg ${
                  banner.ok
                    ? "border-green-300 bg-green-50 text-green-700"
                    : "border-red-300 bg-red-50 text-red-700"
                }`}
              >
                {banner.message}
              </div>
            )}
          </div>

          <div className="mt-4">
            {!manualOpen ? (
              <button
                onClick={() => setManualOpen(true)}
                className="w-full rounded-lg border border-ppm-border bg-white px-4 py-3 text-sm text-gray-500"
              >
                Atau ketik NIS santri manual di sini
              </button>
            ) : (
              <form onSubmit={handleManualSubmit} className="flex gap-2">
                <Input
                  value={manualNis}
                  onChange={(e) => setManualNis(e.target.value)}
                  placeholder="Masukkan NIS santri"
                  inputMode="numeric"
                  autoFocus
                  className="flex-1"
                />
                <Button type="submit">Kirim</Button>
              </form>
            )}
          </div>
        </>
      )}
    </Card>
  );
}
