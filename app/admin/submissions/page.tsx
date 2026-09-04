import { redirect } from "next/navigation";
import { requireInternalStaffPage } from "@/lib/implementation/internal/auth";

export const dynamic = "force-dynamic";

export default async function AdminSubmissionsPage() {
  await requireInternalStaffPage();
  redirect("/implementation/submissions");
}
