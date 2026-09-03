export const EMAIL_VALIDATION_ERROR = "Enter a valid work email address.";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isValidEmail(email: string): boolean {
  const normalized = normalizeEmail(email);
  return normalized.length > 0 && EMAIL_PATTERN.test(normalized);
}

export function parseWorkEmail(raw: unknown): { ok: true; email: string } | { ok: false; error: string } {
  if (typeof raw !== "string" || !isValidEmail(raw)) {
    return { ok: false, error: EMAIL_VALIDATION_ERROR };
  }
  return { ok: true, email: normalizeEmail(raw) };
}

export function maskEmail(email: string): string {
  const trimmed = email.trim();
  const at = trimmed.indexOf("@");
  if (at < 1) {
    return "your work email";
  }
  return `${trimmed[0]}••••@${trimmed.slice(at + 1)}`;
}

export function emailDomain(email: string): string {
  const at = email.indexOf("@");
  if (at < 0) {
    return "";
  }
  return email.slice(at + 1);
}
