import { NextRequest, NextResponse } from "next/server";
import { assertInvitationResolvable, InvitationError } from "@/lib/implementation/invitation";
import { invitationErrorToResponse } from "@/lib/implementation/invitation/http";
import { getInvitationStore } from "@/lib/implementation/invitation/runtime";
import { INVITATION_COOKIE } from "@/lib/implementation/invitation/session-cookie";
import { createSupabaseRouteClient } from "@/lib/supabase/auth-clients";

export const dynamic = "force-dynamic";

const lastSendByInvitation = new Map<string, number>();
const MIN_RESEND_MS = 20_000;

export async function POST(request: NextRequest) {
  try {
    const invitationId = request.cookies.get(INVITATION_COOKIE)?.value;
    if (!invitationId) {
      throw new InvitationError(
        "invalid_input",
        "Open your invitation link before requesting a verification code.",
      );
    }

    const store = getInvitationStore();
    const invitation = assertInvitationResolvable(await store.findInvitationById(invitationId));

    const last = lastSendByInvitation.get(invitation.id) ?? 0;
    if (Date.now() - last < MIN_RESEND_MS) {
      return NextResponse.json({
        ok: true,
        throttled: true,
        invitationId: invitation.id,
      });
    }

    const { supabase, attachAuthCookies } = createSupabaseRouteClient(request);
    const { error } = await supabase.auth.signInWithOtp({
      email: invitation.invitedEmail,
      options: {
        shouldCreateUser: true,
      },
    });

    if (error) {
      console.error("Supabase OTP error:", {
        name: error.name,
        message: error.message,
        status: error.status,
        code: error.code,
      });
      return NextResponse.json(
        {
          ok: false,
          code: "otp_send_failed",
          error: "Could not send a verification code. Please try again.",
        },
        { status: 400 },
      );
    }

    lastSendByInvitation.set(invitation.id, Date.now());

    return attachAuthCookies(
      NextResponse.json({
        ok: true,
        invitationId: invitation.id,
        email: invitation.invitedEmail,
      }),
    );
  } catch (error) {
    return invitationErrorToResponse(error);
  }
}
