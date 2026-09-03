import { cookies } from "next/headers";
import {
  assertInvitationResolvable,
  toInvitationPublicView,
  type InvitationPublicView,
} from "@/lib/implementation/invitation";
import { getInvitationStore } from "@/lib/implementation/invitation/runtime";
import { INVITATION_COOKIE } from "@/lib/implementation/invitation/session-cookie";

export async function loadSignInInvitation(): Promise<InvitationPublicView | null> {
  const invitationId = (await cookies()).get(INVITATION_COOKIE)?.value;
  if (!invitationId) {
    return null;
  }

  try {
    const invitation = await getInvitationStore().findInvitationById(invitationId);
    if (!invitation) {
      return null;
    }
    return toInvitationPublicView(assertInvitationResolvable(invitation));
  } catch {
    return null;
  }
}
