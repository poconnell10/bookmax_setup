import { NextRequest, NextResponse } from "next/server";
import { getInvitationService } from "@/lib/implementation/invitation/runtime";
import { invitationErrorToResponse } from "@/lib/implementation/invitation/http";
import {
  INVITATION_COOKIE,
  invitationCookieOptions,
} from "@/lib/implementation/invitation/session-cookie";
import { InvitationError } from "@/lib/implementation/invitation/types";

export const dynamic = "force-dynamic";

/**
 * Resolve a raw invitation bearer token, mark opened, and set the invitation id cookie.
 * Used by the invite page; also callable for tests.
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { token?: string };
    const token = typeof body.token === "string" ? body.token.trim() : "";
    if (!token) {
      throw new InvitationError("invalid_input", "Invitation token is required.");
    }

    const service = getInvitationService();
    const resolved = await service.resolveByRawToken(token);
    const opened = await service.markOpened(resolved.id);

    const response = NextResponse.json({ ok: true, invitation: opened });
    response.cookies.set(INVITATION_COOKIE, opened.id, invitationCookieOptions());
    return response;
  } catch (error) {
    return invitationErrorToResponse(error);
  }
}
