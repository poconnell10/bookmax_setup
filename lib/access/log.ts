type AccessLogFields = Record<string, string | number | boolean | null | undefined>;

const FORBIDDEN_KEYS = /otp|token|secret|password|authorization|cookie|code/i;

export function logAccess(event: string, fields: AccessLogFields = {}): void {
  const safe: AccessLogFields = {};
  for (const [key, value] of Object.entries(fields)) {
    if (FORBIDDEN_KEYS.test(key)) {
      continue;
    }
    if (typeof value === "string" && FORBIDDEN_KEYS.test(value)) {
      continue;
    }
    safe[key] = value;
  }
  console.info(JSON.stringify({ scope: "access", event, ...safe }));
}
