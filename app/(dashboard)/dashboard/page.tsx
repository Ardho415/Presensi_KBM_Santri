import { isAuthenticated } from "@/lib/auth";
import { LoginForm } from "@/components/layout/LoginForm";
import { DashboardContent } from "@/components/dashboard/DashboardContent";

export default async function DashboardPage() {
  const authenticated = await isAuthenticated();

  if (!authenticated) {
    return <LoginForm />;
  }

  return <DashboardContent />;
}
