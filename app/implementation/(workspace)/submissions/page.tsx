import type { Metadata } from "next";
import { SubmissionsList } from "@/components/submissions/SubmissionsList";
import { requireInternalStaffPage } from "@/lib/implementation/internal/auth";
import { getInternalSubmissionService } from "@/lib/implementation/internal/runtime";

export const metadata: Metadata = {
  title: "Submissions",
};

export const dynamic = "force-dynamic";

export default async function ImplementationSubmissionsPage() {
  const staff = await requireInternalStaffPage();
  const submissions = await getInternalSubmissionService().list(staff);
  return <SubmissionsList submissions={submissions} />;
}
