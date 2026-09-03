import type { NextResponse } from "next/server";

export const PENDING_EMAIL_COOKIE = "bookmax.pending_email";
export const PENDING_EMAIL_MAX_AGE_SECONDS = 60 * 15;

export function pendingEmailCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: PENDING_EMAIL_MAX_AGE_SECONDS,
  };
}

export function clearPendingEmailCookie(response: NextResponse): void {
  response.cookies.set(PENDING_EMAIL_COOKIE, "", {
    ...pendingEmailCookieOptions(),
    maxAge: 0,
  });
}
