import { COUNTRY_OPTIONS } from "@/lib/implementation/catalogue";
import type { InvitationPublicView } from "@/lib/implementation/invitation/types";
import type { IntakeState } from "@/types/implementation";

export function resolveCountryCode(country: string): string {
  const trimmed = country.trim();
  const match = COUNTRY_OPTIONS.find(
    (item) =>
      item.value.toLowerCase() === trimmed.toLowerCase() ||
      item.label.toLowerCase() === trimmed.toLowerCase(),
  );
  return match?.value || trimmed;
}

/** Prefill intake fields from invitation without altering screen UX. */
export function intakePatchFromInvitation(
  invitation: InvitationPublicView,
): Partial<IntakeState> {
  return {
    organisation: invitation.hotelGroupOrBrand || "",
    contactName: invitation.contactName,
    contactEmail: invitation.invitedEmail,
    country: resolveCountryCode(invitation.country),
    properties: [invitation.propertyName],
    propertyLocked: true,
    accessVerified: true,
  };
}
