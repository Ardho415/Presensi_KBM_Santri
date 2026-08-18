import { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-ppm-border bg-white shadow-sm ${className}`}
    >
      {children}
    </div>
  );
}

export function FilterBar({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border border-ppm-border bg-ppm-cream p-4 flex flex-wrap items-end gap-3">
      {children}
    </div>
  );
}

export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-semibold text-ppm-gold-dark">{label}</label>
      {children}
    </div>
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  const { className = "", ...rest } = props;
  return (
    <input
      {...rest}
      className={`rounded-lg border border-ppm-border bg-white px-3 py-2 text-sm text-gray-700 outline-none focus:ring-2 focus:ring-ppm-green/40 ${className}`}
    />
  );
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  const { className = "", children, ...rest } = props;
  return (
    <select
      {...rest}
      className={`rounded-lg border border-ppm-border bg-white px-3 py-2 text-sm text-gray-700 outline-none focus:ring-2 focus:ring-ppm-green/40 ${className}`}
    >
      {children}
    </select>
  );
}

export function Button(
  props: ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: "primary" | "gold" | "outline" | "danger" | "ghost";
  }
) {
  const { variant = "primary", className = "", children, ...rest } = props;

  const variants: Record<string, string> = {
    primary: "bg-ppm-green hover:bg-ppm-green-dark text-white",
    gold: "bg-ppm-gold hover:bg-ppm-gold-dark text-white",
    outline: "border border-ppm-border bg-white hover:bg-ppm-cream text-gray-700",
    danger: "bg-red-600 hover:bg-red-700 text-white",
    ghost: "text-ppm-green-dark hover:bg-ppm-cream",
  };

  return (
    <button
      {...rest}
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${variants[variant]} ${className}`}
    >
      {children}
    </button>
  );
}
