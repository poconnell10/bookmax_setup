import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SubmissionReview } from "@/components/submissions/SubmissionReview";
import { getPrototypeSubmission } from "@/lib/implementation/persistence";

export const metadata: Metadata = {
  title: "Submission review",
};

export const dynamic = "force-dynamic";

export default async function ImplementationSubmissionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const submission = getPrototypeSubmission(id);

  if (!submission) {
    notFound();
  }

  return <SubmissionReview submission={submission} />;
}
