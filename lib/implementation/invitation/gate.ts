import "server-only";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabase/auth-clients";
import { getInvitationService } from "@/lib/implementation/invitation/runtime";
import {
  INVITATION_CLAIM_COOKIE,
  INVITATION_COOKIE,
  verifyInvitationClaim,
} from "@/lib/implementation/invitation/session-cookie";
import type { InvitationPublicView } from "@/lib/implementation/invitation/types";

/**
 * Full server-side gate for customer setup routes.
 * Redirects to /implementation when session or invitation ownership is missing.
 */
export async function requireCustomerInvitationAccess(): Promise<InvitationPublicView> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id || !user.email) {
    redirect("/implementation");
  }

  const jar = await cookies();
  const claim = verifyInvitationClaim(jar.get(INVITATION_CLAIM_COOKIE)?.value);
  const invitationId = jar.get(INVITATION_COOKIE)?.value;

  if (!claim || !invitationId || claim.invitationId !== invitationId) {
    redirect("/implementation");
  }

  if (claim.authUserId !== user.id) {
    redirect("/implementation");
  }

  try {
    return await getInvitationService().getOwnedInvitation(invitationId, {
      authUserId: user.id,
      email: user.email,
    });
  } catch {
    redirect("/implementation");
  }
}
