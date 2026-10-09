import type { Metadata } from "next";
import { UsersAccessScreen } from "@/components/access/UsersAccessScreen";
import { getAccessDirectoryService } from "@/lib/implementation/access/runtime";
import { requireAdminPage } from "@/lib/implementation/internal/auth";

export const metadata: Metadata = {
  title: "Users & Access",
};

export const dynamic = "force-dynamic";

export default async function UsersAccessPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const staff = await requireAdminPage();
  const service = getAccessDirectoryService();
  const [users, implementations, attachable, params] = await Promise.all([
    service.list(staff),
    service.listImplementationOptions(staff),
    service.listAttachableImplementations(staff),
    searchParams,
  ]);
  const manage = typeof params.manage === "string" ? params.manage : null;
  return (
    <UsersAccessScreen
      initialUsers={users}
      initialImplementations={implementations}
      initialAttachable={attachable}
      initialManageUserId={manage}
    />
  );
}
