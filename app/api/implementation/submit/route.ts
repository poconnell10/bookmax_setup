import { NextRequest, NextResponse } from "next/server";
import {
  requireCustomerInvitationApi,
  stripClientAuthorizationFields,
} from "@/lib/implementation/invitation/customer-auth";
import { invitationErrorToResponse } from "@/lib/implementation/invitation/http";
import { getInvitationService } from "@/lib/implementation/invitation/runtime";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const { principal, invitation, attachAuthCookies } = await requireCustomerInvitationApi(request);

    const body = (await request.json()) as { record?: Record<string, unknown> };
    if (!body.record || typeof body.record !== "object") {
      return NextResponse.json({ error: "Missing record" }, { status: 400 });
    }

    const record = {
      ...stripClientAuthorizationFields(body.record),
      invitation_id: invitation.id,
      organisation: invitation.hotelGroupOrBrand || body.record.organisation || "",
      properties: [invitation.propertyName],
      primary_contact: invitation.contactName,
      primary_contact_email: invitation.invitedEmail,
    };

    const submission = await getInvitationService().submitFinal(invitation.id, principal, record);
    return attachAuthCookies(NextResponse.json({ submissionId: submission.id }));
  } catch (error) {
    return invitationErrorToResponse(error);
  }
}
