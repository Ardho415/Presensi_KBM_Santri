import type { AttendanceStatus } from "@/types/domain";

const STYLE: Record<AttendanceStatus, string> = {
  hadir: "bg-[var(--status-hadir)] text-white",
  terlambat: "bg-[var(--status-terlambat)] text-white",
  izin: "bg-[var(--status-izin)] text-white",
  sakit: "bg-[var(--status-sakit)] text-white",
  alpa: "bg-[var(--status-alpa)] text-white",
};

const LABEL: Record<AttendanceStatus, string> = {
  hadir: "Hadir",
  terlambat: "Terlambat",
  izin: "Izin",
  sakit: "Sakit",
  alpa: "Alpa",
};

export function StatusBadge({ status }: { status: AttendanceStatus }) {
  return (
    <span
      className={`inline-flex items-center justify-center rounded-md px-2 py-0.5 text-xs font-bold min-w-[1.75rem] ${STYLE[status]}`}
    >
      {LABEL[status].slice(0, 1)}
    </span>
  );
}

const CODE_STYLE: Record<string, string> = {
  H: "text-[var(--status-hadir)]",
  T: "text-[var(--status-terlambat)]",
  I: "text-[var(--status-izin)]",
  S: "text-[var(--status-sakit)]",
  A: "text-[var(--status-alpa)]",
  "-": "text-gray-300",
  "": "text-gray-300",
};

export function MatrixCell({ code }: { code: string }) {
  return (
    <span className={`font-bold ${CODE_STYLE[code] ?? "text-gray-400"}`}>
      {code === "" ? "•" : code}
    </span>
  );
}
