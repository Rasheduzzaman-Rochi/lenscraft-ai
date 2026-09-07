import { AdminShell } from "@/components/admin/admin-shell";
import { requireAdminSession } from "@/lib/admin/session";

export default async function AdminDashboardLayout({ children }: { children: React.ReactNode }) {
  await requireAdminSession();
  return <AdminShell>{children}</AdminShell>;
}
