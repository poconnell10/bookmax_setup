import { NextRequest, NextResponse } from "next/server";
import { maskEmail, parseWorkEmail } from "@/lib/access/email";
import { logAccess } from "@/lib/access/log";
import { OTP_SEND_ERROR } from "@/lib/access/otp";
import {
  PENDING_EMAIL_COOKIE,
  pendingEmailCookieOptions,
} from "@/lib/access/pending-email";
import { createSupabaseRouteClient } from "@/lib/supabase/auth-clients";

export const dynamic = "force-dynamic";

const lastSendByEmail = new Map<string, number>();
const MIN_RESEND_MS = 20_000;

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as { email?: string };
    const cookieEmail = request.cookies.get(PENDING_EMAIL_COOKIE)?.value;
    const parsed = parseWorkEmail(body.email || cookieEmail || "");
    if (!parsed.ok) {
      return NextResponse.json({ ok: false, code: "invalid_input", error: parsed.error }, { status: 400 });
    }

    const last = lastSendByEmail.get(parsed.email) ?? 0;
    const throttled = Date.now() - last < MIN_RESEND_MS;
    if (throttled) {
      const response = NextResponse.json({
        ok: true,
        throttled: true,
        emailMasked: maskEmail(parsed.email),
      });
      response.cookies.set(PENDING_EMAIL_COOKIE, parsed.email, pendingEmailCookieOptions());
      return response;
    }

    const { supabase, attachAuthCookies } = createSupabaseRouteClient(request);
    const { error } = await supabase.auth.signInWithOtp({
      email: parsed.email,
      options: {
        // New customers are allowed to be created as part of passwordless onboarding.
        shouldCreateUser: true,
      },
    });

    if (error) {
      // Keep UX generic, but log the real Supabase failure for diagnosis.
      // Do not log email / tokens / OTP values.
      console.error("bookmax.m1.otp_send_failed", {
        name: error.name,
        status: error.status,
        message: error.message,
      });
      logAccess("otp_failed", { stage: "send" });
      return NextResponse.json(
        { ok: false, code: "otp_send_failed", error: OTP_SEND_ERROR },
        { status: 400 },
      );
    }

    lastSendByEmail.set(parsed.email, Date.now());
    logAccess("otp_requested");

    const response = attachAuthCookies(
      NextResponse.json({
        ok: true,
        throttled: false,
        emailMasked: maskEmail(parsed.email),
      }),
    );
    response.cookies.set(PENDING_EMAIL_COOKIE, parsed.email, pendingEmailCookieOptions());
    return response;
  } catch {
    return NextResponse.json(
      { ok: false, code: "otp_send_failed", error: OTP_SEND_ERROR },
      { status: 500 },
    );
  }
}
