import { NextRequest, NextResponse } from "next/server";
import {
  requireCustomerInvitationApi,
  stripClientAuthorizationFields,
} from "@/lib/implementation/invitation/customer-auth";
import { invitationErrorToResponse } from "@/lib/implementation/invitation/http";
import { intakePatchFromInvitation } from "@/lib/implementation/invitation/prefill";
import { getInvitationService } from "@/lib/implementation/invitation/runtime";
import type { IntakeState } from "@/types/implementation";

export const dynamic = "force-dynamic";

function toIntakeDraft(
  invitation: { id: string },
  payload: Record<string, unknown> | null,
  identity: ReturnType<typeof intakePatchFromInvitation>,
): IntakeState | null {
  if (!payload) {
    return null;
  }
  return {
    ...(payload as IntakeState),
    ...identity,
    draftId: invitation.id,
  };
}

export async function GET(request: NextRequest) {
  try {
    const { principal, invitation, attachAuthCookies } = await requireCustomerInvitationApi(
      request,
      { allowSubmitted: true },
    );

    const draft = await getInvitationService().getDraft(invitation.id, principal);
    const identity = intakePatchFromInvitation(invitation);
    const response = NextResponse.json({
      draft: toIntakeDraft(invitation, draft?.payload ?? null, identity),
    });
    return attachAuthCookies(response);
  } catch (error) {
    return invitationErrorToResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { principal, invitation, attachAuthCookies } = await requireCustomerInvitationApi(
      request,
      { allowSubmitted: true },
    );

    const body = (await request.json()) as { draft?: Record<string, unknown> };
    if (!body.draft || typeof body.draft !== "object") {
      return NextResponse.json({ error: "Missing draft" }, { status: 400 });
    }

    if (invitation.status === "submitted") {
      return attachAuthCookies(NextResponse.json({ draftId: invitation.id }));
    }

    const identity = intakePatchFromInvitation(invitation);
    const payload = {
      ...stripClientAuthorizationFields(body.draft),
      ...identity,
      draftId: invitation.id,
    };

    await getInvitationService().saveDraft(invitation.id, principal, payload);
    return attachAuthCookies(NextResponse.json({ draftId: invitation.id }));
  } catch (error) {
    return invitationErrorToResponse(error);
  }
}
