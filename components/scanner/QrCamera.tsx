"use client";

import { useEffect, useRef, useState } from "react";

interface QrCameraProps {
  onDecode: (text: string) => void;
  paused: boolean;
}

export function QrCamera({ onDecode, paused }: QrCameraProps) {
  const containerId = "qr-reader-region";
  const scannerRef = useRef<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [cameras, setCameras] = useState<Array<{ id: string; label: string }>>([]);
  const [cameraIndex, setCameraIndex] = useState(0);
  const [ready, setReady] = useState(false);
  const onDecodeRef = useRef(onDecode);

  useEffect(() => {
    onDecodeRef.current = onDecode;
  }, [onDecode]);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        const devices = await Html5Qrcode.getCameras();
        if (cancelled) return;

        if (!devices || devices.length === 0) {
          setError("Kamera tidak ditemukan pada perangkat ini.");
          return;
        }

        setCameras(devices.map((d) => ({ id: d.id, label: d.label })));

        const backCameraIndex = devices.findIndex((d) =>
          /back|belakang|rear|environment/i.test(d.label)
        );
        const startIndex = backCameraIndex >= 0 ? backCameraIndex : 0;
        setCameraIndex(startIndex);

        const instance = new Html5Qrcode(containerId, { verbose: false });
        scannerRef.current = instance;

        await instance.start(
          devices[startIndex].id,
          { fps: 10, qrbox: { width: 220, height: 220 } },
          (decodedText: string) => {
            onDecodeRef.current(decodedText);
          },
          () => {
            /* diabaikan: dipanggil terus-menerus saat tidak ada QR terdeteksi */
          }
        );
        if (!cancelled) setReady(true);
      } catch {
        if (!cancelled) {
          setError(
            "Tidak dapat mengakses kamera. Pastikan izin kamera sudah diberikan pada browser."
          );
        }
      }
    }

    init();

    return () => {
      cancelled = true;
      const instance = scannerRef.current;
      if (instance) {
        instance
          .stop()
          .then(() => instance.clear())
          .catch(() => {});
      }
    };
  }, []);

  useEffect(() => {
    const instance = scannerRef.current;
    if (!instance || !ready) return;
    if (paused) {
      instance.pause(true);
    } else {
      try {
        instance.resume();
      } catch {
        /* no-op jika belum sempat pause */
      }
    }
  }, [paused, ready]);

  async function handleFlipCamera() {
    if (cameras.length < 2 || !scannerRef.current) return;
    const nextIndex = (cameraIndex + 1) % cameras.length;
    try {
      await scannerRef.current.stop();
      await scannerRef.current.start(
        cameras[nextIndex].id,
        { fps: 10, qrbox: { width: 220, height: 220 } },
        (decodedText: string) => onDecodeRef.current(decodedText),
        () => {}
      );
      setCameraIndex(nextIndex);
    } catch {
      setError("Gagal mengganti kamera.");
    }
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative w-full max-w-sm overflow-hidden rounded-xl bg-gray-800">
        <div id={containerId} className="w-full" />
        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-800 p-4 text-center text-sm text-white">
            {error}
          </div>
        )}
      </div>
      {cameras.length > 1 && (
        <button
          onClick={handleFlipCamera}
          aria-label="Ganti kamera"
          className="flex h-11 w-11 items-center justify-center rounded-lg border border-sky-300 bg-sky-50 text-sky-600"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path
              d="M4 7h3l1.5-2h7L17 7h3a1 1 0 011 1v11a1 1 0 01-1 1H4a1 1 0 01-1-1V8a1 1 0 011-1z"
              stroke="currentColor"
              strokeWidth="1.5"
            />
            <circle cx="12" cy="13" r="3.2" stroke="currentColor" strokeWidth="1.5" />
            <path d="M9 4l1 2M15 4l-1 2" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        </button>
      )}
    </div>
  );
}
