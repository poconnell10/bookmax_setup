import { NextRequest, NextResponse } from "next/server";
import { requireCustomerInvitationApi } from "@/lib/implementation/invitation/customer-auth";
import { invitationErrorToResponse } from "@/lib/implementation/invitation/http";
import { intakePatchFromInvitation } from "@/lib/implementation/invitation/prefill";
import { getInvitationService } from "@/lib/implementation/invitation/runtime";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const { principal, invitation, attachAuthCookies } = await requireCustomerInvitationApi(request);

    const body = (await request.json()) as {
      draftId?: string;
      clientId?: string;
      clientSecret?: string;
      applicationKey?: string;
    };

    if (!body.clientId?.trim() || !body.clientSecret?.trim() || !body.applicationKey?.trim()) {
      return NextResponse.json({ error: "Incomplete credentials" }, { status: 400 });
    }

    const existing = await getInvitationService().getDraft(invitation.id, principal);
    const identity = intakePatchFromInvitation(invitation);
    await getInvitationService().saveDraft(invitation.id, principal, {
      ...(existing?.payload || {}),
      ...identity,
      draftId: invitation.id,
      credentialsStatus: "received",
    });

    return attachAuthCookies(NextResponse.json({ credentialsStatus: "received" }));
  } catch (error) {
    return invitationErrorToResponse(error);
  }
}
