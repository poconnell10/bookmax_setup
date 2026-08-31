import type { Metadata } from "next";
import { SubmissionsList } from "@/components/submissions/SubmissionsList";
import { listPrototypeSubmissions } from "@/lib/implementation/persistence";

export const metadata: Metadata = {
  title: "Submissions",
};

export const dynamic = "force-dynamic";

export default function ImplementationSubmissionsPage() {
  const submissions = listPrototypeSubmissions();
  return <SubmissionsList submissions={submissions} />;
}
