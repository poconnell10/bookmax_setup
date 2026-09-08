import { NextRequest, NextResponse } from "next/server";
import { landingPath, resolveAuthorization } from "@/lib/access/authorization";
import { maskEmail } from "@/lib/access/email";
import { logAccess } from "@/lib/access/log";
import {
  classifyOtpError,
  isCompleteOtp,
  OTP_INVALID_ERROR,
  OTP_NETWORK_ERROR,
  otpFailureMessage,
  OTP_LENGTH,
} from "@/lib/access/otp";
import { clearPendingEmailCookie, PENDING_EMAIL_COOKIE } from "@/lib/access/pending-email";
import { customerErrorToResponse } from "@/lib/implementation/customer/http";
import { getCustomerService } from "@/lib/implementation/customer/runtime";
import { createSupabaseRouteClient } from "@/lib/supabase/auth-clients";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const email = request.cookies.get(PENDING_EMAIL_COOKIE)?.value;
    if (!email) {
      return NextResponse.json(
        {
          ok: false,
          code: "invalid_input",
          error: "Enter your email again to continue.",
        },
        { status: 400 },
      );
    }

    const body = (await request.json().catch(() => ({}))) as { code?: string };
    const token = typeof body.code === "string" ? body.code.replace(/\D/g, "").slice(0, OTP_LENGTH) : "";
    if (!isCompleteOtp(token)) {
      return NextResponse.json(
        { ok: false, code: "otp_invalid", error: OTP_INVALID_ERROR },
        { status: 400 },
      );
    }

    const { supabase, attachAuthCookies } = createSupabaseRouteClient(request);
    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token,
      type: "email",
    });

    if (error || !data.user?.id || !data.user.email) {
      const kind = classifyOtpError(error);
      logAccess("otp_failed", { stage: "verify", reason: kind });
      return NextResponse.json(
        {
          ok: false,
          code: kind === "expired" ? "otp_expired" : "otp_invalid",
          error: otpFailureMessage(kind),
        },
        { status: 401 },
      );
    }

    const decision = await resolveAuthorization({
      userId: data.user.id,
      email: data.user.email,
    });
    const service = getCustomerService();
    let resume = landingPath(decision);
    let implementation = null;
    let property = null;

    if (decision.kind === "customer") {
      const context = await service.getForUser(data.user.id);
      resume = service.resumePath(context);
      implementation = context.implementation;
      property = context.property;
    }

    logAccess("otp_verified", { kind: decision.kind });

    const response = attachAuthCookies(
      NextResponse.json({
        ok: true,
        emailMasked: maskEmail(data.user.email),
        kind: decision.kind,
        implementation,
        property,
        resumePath: resume,
      }),
    );
    clearPendingEmailCookie(response);
    return response;
  } catch (error) {
    const mapped = customerErrorToResponse(error);
    if (mapped.status === 500 || mapped.status === 503) {
      return NextResponse.json(
        { ok: false, code: "otp_network", error: OTP_NETWORK_ERROR },
        { status: 503 },
      );
    }
    return mapped;
  }
}
