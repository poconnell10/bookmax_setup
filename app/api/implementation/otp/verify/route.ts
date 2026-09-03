import { NextRequest, NextResponse } from "next/server";
import { assertInvitationResolvable, InvitationError } from "@/lib/implementation/invitation";
import { invitationErrorToResponse } from "@/lib/implementation/invitation/http";
import { intakePatchFromInvitation } from "@/lib/implementation/invitation/prefill";
import { getInvitationService, getInvitationStore } from "@/lib/implementation/invitation/runtime";
import {
  INVITATION_CLAIM_COOKIE,
  INVITATION_COOKIE,
  invitationCookieOptions,
  signInvitationClaim,
} from "@/lib/implementation/invitation/session-cookie";
import { createSupabaseRouteClient } from "@/lib/supabase/auth-clients";

export const dynamic = "force-dynamic";

const OTP_LENGTH = 6;

export async function POST(request: NextRequest) {
  try {
    const invitationId = request.cookies.get(INVITATION_COOKIE)?.value;
    if (!invitationId) {
      throw new InvitationError(
        "invalid_input",
        "Open your invitation link before verifying a code.",
      );
    }

    const body = (await request.json()) as { code?: string };
    const code =
      typeof body.code === "string" ? body.code.replace(/\D/g, "").slice(0, OTP_LENGTH) : "";
    if (code.length !== OTP_LENGTH) {
      throw new InvitationError("invalid_input", "Enter the 6-digit code from your email.");
    }

    const store = getInvitationStore();
    const invitation = assertInvitationResolvable(await store.findInvitationById(invitationId));

    const { supabase, attachAuthCookies } = createSupabaseRouteClient(request);
    const { data, error } = await supabase.auth.verifyOtp({
      email: invitation.invitedEmail,
      token: code,
      type: "email",
    });

    if (error || !data.user?.id || !data.user.email) {
      return NextResponse.json(
        {
          ok: false,
          code: "otp_invalid",
          error: "That code is invalid or has expired.",
        },
        { status: 401 },
      );
    }

    const bound = await getInvitationService().bindAuthUser(invitation.id, {
      authUserId: data.user.id,
      email: data.user.email,
    });

    const principal = { authUserId: data.user.id, email: data.user.email };
    const [draft, submission] = await Promise.all([
      getInvitationService().getDraft(bound.id, principal),
      getInvitationStore().findSubmissionByInvitationId(bound.id),
    ]);
    const identity = intakePatchFromInvitation(bound);
    const submitted = bound.status === "submitted" || Boolean(submission);

    const claim = signInvitationClaim({
      invitationId: bound.id,
      authUserId: data.user.id,
    });

    const response = NextResponse.json({
      ok: true,
      invitation: bound,
      intakePatch: {
        ...(draft?.payload || {}),
        ...identity,
        draftId: bound.id,
        submitted,
        status: submitted ? "submitted" : "draft",
        submissionId: submission?.id || null,
        submittedAt: bound.submittedAt,
      },
    });

    attachAuthCookies(response);
    response.cookies.set(INVITATION_COOKIE, bound.id, invitationCookieOptions());
    response.cookies.set(INVITATION_CLAIM_COOKIE, claim, invitationCookieOptions());
    return response;
  } catch (error) {
    return invitationErrorToResponse(error);
  }
}
