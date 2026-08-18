import { isAuthenticated } from "@/lib/auth";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { ToastProvider } from "@/components/ui/Toast";

export default async function DashboardGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const authenticated = await isAuthenticated();

  return (
    <ToastProvider>
      {authenticated ? <DashboardShell>{children}</DashboardShell> : children}
    </ToastProvider>
  );
}
