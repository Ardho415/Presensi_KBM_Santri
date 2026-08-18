import Image from "next/image";

export function ScanHeader() {
  return (
    <header className="border-b border-ppm-border bg-white px-4 py-4">
      <div className="mx-auto flex max-w-xl items-center gap-3">
        <Image
          src="/logo-ppm.png"
          alt="Logo PPM Roudlotul Jannah"
          width={44}
          height={44}
          className="h-11 w-11 object-contain"
        />
        <div className="leading-tight">
          <p className="font-display text-lg font-extrabold text-ppm-green">
            PPM ROUDLOTUL JANNAH
          </p>
          <p className="text-xs font-semibold text-ppm-gold-dark">Presensi Santri</p>
        </div>
      </div>
    </header>
  );
}
