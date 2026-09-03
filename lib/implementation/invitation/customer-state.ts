import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/auth-clients";
import { requireCustomerInvitationAccess } from "@/lib/implementation/invitation/gate";
import { intakePatchFromInvitation } from "@/lib/implementation/invitation/prefill";
import { getInvitationService, getInvitationStore } from "@/lib/implementation/invitation/runtime";
import { createInitialIntakeState } from "@/lib/implementation/selectors";
import type { IntakeState } from "@/types/implementation";

function asPartialIntake(value: Record<string, unknown> | null | undefined): Partial<IntakeState> {
  if (!value || typeof value !== "object") {
    return {};
  }
  return value as Partial<IntakeState>;
}

export async function loadCustomerIntakeState(): Promise<IntakeState> {
  const invitation = await requireCustomerInvitationAccess();
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const prefill = intakePatchFromInvitation(invitation);
  const base: IntakeState = {
    ...createInitialIntakeState(),
    ...prefill,
    draftId: invitation.id,
  };

  if (!user?.id || !user.email) {
    return base;
  }

  const principal = { authUserId: user.id, email: user.email };
  const [draft, submission] = await Promise.all([
    getInvitationService().getDraft(invitation.id, principal),
    getInvitationStore().findSubmissionByInvitationId(invitation.id),
  ]);

  const fromDraft = asPartialIntake(draft?.payload);
  const submitted = invitation.status === "submitted" || Boolean(submission);

  return {
    ...base,
    ...fromDraft,
    ...prefill,
    draftId: invitation.id,
    submitted,
    status: submitted ? "submitted" : fromDraft.status || "draft",
    submissionId: submission?.id || fromDraft.submissionId || null,
    submittedAt: invitation.submittedAt || fromDraft.submittedAt || null,
  };
}
