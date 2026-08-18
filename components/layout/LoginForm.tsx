"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState, FormEvent } from "react";
import { Button, Input, Field } from "@/components/ui/Basics";

export function LoginForm() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.message ?? "Username atau password salah.");
        return;
      }
      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Gagal terhubung ke server. Periksa koneksi internet dan coba lagi.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md rounded-3xl border border-ppm-border bg-white p-8 shadow-md">
        <div className="flex flex-col items-center text-center">
          <Image
            src="/logo-ppm.png"
            alt="Logo PPM Roudlotul Jannah"
            width={90}
            height={90}
            className="h-24 w-24 object-contain"
          />
          <p className="mt-4 font-semibold text-ppm-gold-dark">Presensi Santri</p>
          <h1 className="font-display text-2xl font-extrabold text-ppm-green">
            PPM ROUDLOTUL JANNAH
          </h1>
        </div>

        <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-4">
          <Field label="Username">
            <Input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              required
            />
          </Field>
          <Field label="Password">
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </Field>

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-600">
              {error}
            </p>
          )}

          <Button type="submit" disabled={loading} className="mt-2 w-full py-3 text-base">
            {loading ? "Memproses..." : "Login"}
          </Button>
        </form>
      </div>
    </div>
  );
}
