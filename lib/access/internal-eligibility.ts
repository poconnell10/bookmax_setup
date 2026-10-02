import { emailDomain, normalizeEmail } from "@/lib/access/email";

/**
 * Domains an Admin may offer Internal to. This is not authorization.
 * Access still requires auth.users.id → internal_staff → role + status=active.
 */
export const INTERNAL_ELIGIBLE_DOMAINS = ["frontlinepg.com", "in-gauge.io"] as const;

export function isInternalEligibleEmail(email: string): boolean {
  const domain = emailDomain(normalizeEmail(email));
  return (INTERNAL_ELIGIBLE_DOMAINS as readonly string[]).includes(domain);
}
