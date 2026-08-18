export function LoadingState({ label = "Memuat data..." }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-gray-500">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-ppm-border border-t-ppm-green" />
      <p className="text-sm">{label}</p>
    </div>
  );
}

export function EmptyState({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-1 py-16 text-center text-gray-500">
      <p className="text-base font-semibold text-gray-600">{title}</p>
      {description && <p className="text-sm">{description}</p>}
    </div>
  );
}

export function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 py-10 text-center text-red-700">
      <p className="text-sm font-semibold">{message}</p>
    </div>
  );
}
