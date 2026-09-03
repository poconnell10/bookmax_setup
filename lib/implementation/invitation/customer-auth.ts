import "server-only";

import { NextRequest } from "next/server";
import { createSupabaseRouteClient } from "@/lib/supabase/auth-clients";
import { getInvitationService, getInvitationStore } from "@/lib/implementation/invitation/runtime";
import { INVITATION_COOKIE } from "@/lib/implementation/invitation/session-cookie";
import {
  InvitationError,
  type AuthPrincipal,
  type InvitationPublicView,
} from "@/lib/implementation/invitation/types";
import { assertInvitationResolvable } from "@/lib/implementation/invitation/authorization";

export type CustomerAuthContext = {
  principal: AuthPrincipal;
  invitation: InvitationPublicView;
  attachAuthCookies: (response: import("next/server").NextResponse) => import("next/server").NextResponse;
};

/**
 * Authoritative customer API gate.
 * Cookie invitation id is context only. Session + DB ownership decide access.
 */
export async function requireCustomerInvitationApi(
  request: NextRequest,
  options?: { allowSubmitted?: boolean },
): Promise<CustomerAuthContext> {
  const { supabase, attachAuthCookies } = createSupabaseRouteClient(request);
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user?.id || !user.email) {
    throw new InvitationError("forbidden", "Sign in to continue.");
  }

  const principal: AuthPrincipal = {
    authUserId: user.id,
    email: user.email,
  };

  const invitationId = request.cookies.get(INVITATION_COOKIE)?.value;
  if (!invitationId) {
    throw new InvitationError("forbidden", "Open your invitation link to continue.");
  }

  const stored = await getInvitationStore().findInvitationById(invitationId);
  if (!stored) {
    throw new InvitationError("not_found", "Invitation was not found.");
  }

  if (stored.status === "submitted" && options?.allowSubmitted) {
    const invitation = await getInvitationService().getOwnedInvitation(stored.id, principal);
    return { principal, invitation, attachAuthCookies };
  }

  assertInvitationResolvable(stored);
  const invitation = await getInvitationService().getOwnedInvitation(stored.id, principal);
  return { principal, invitation, attachAuthCookies };
}

export function stripClientAuthorizationFields<T extends Record<string, unknown>>(
  input: T,
): Omit<T, "invitation_id" | "invitationId" | "auth_user_id" | "authUserId" | "invited_email"> {
  const next = { ...input };
  delete next.invitation_id;
  delete next.invitationId;
  delete next.auth_user_id;
  delete next.authUserId;
  delete next.invited_email;
  return next;
}
