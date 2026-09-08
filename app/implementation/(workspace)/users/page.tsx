import type { Metadata } from "next";
import { UsersAccessScreen } from "@/components/access/UsersAccessScreen";
import { getAccessDirectoryService } from "@/lib/implementation/access/runtime";
import { requireAdminPage } from "@/lib/implementation/internal/auth";

export const metadata: Metadata = {
  title: "Users & Access",
};

export const dynamic = "force-dynamic";

export default async function UsersAccessPage() {
  const staff = await requireAdminPage();
  const service = getAccessDirectoryService();
  const [users, implementations] = await Promise.all([
    service.list(staff),
    service.listImplementationOptions(staff),
  ]);
  return <UsersAccessScreen initialUsers={users} initialImplementations={implementations} />;
}
