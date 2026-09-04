import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SecureCredentialsPanel } from "@/components/submissions/SecureCredentialsPanel";
import { requireEngineerPage } from "@/lib/implementation/internal/auth";
import { getInternalSubmissionService } from "@/lib/implementation/internal/runtime";
import { InternalError } from "@/lib/implementation/internal/types";

export const metadata: Metadata = {
  title: "Reveal credentials",
};

export const dynamic = "force-dynamic";

export default async function SecureCredentialsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const staff = await requireEngineerPage();
  const { id } = await params;
  let submission;

  try {
    submission = await getInternalSubmissionService().get(staff, id);
  } catch (error) {
    if (error instanceof InternalError && error.code === "not_found") {
      notFound();
    }
    throw error;
  }

  if (!submission.can_open_credentials) {
    notFound();
  }

  return (
    <SecureCredentialsPanel
      submissionId={submission.submission_id}
      organisation={submission.organisation}
      credentialType={submission.credential_type}
      receivedAt={submission.credentials_received_at}
    />
  );
}
