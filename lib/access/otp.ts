export const OTP_LENGTH = 6;

export const OTP_INVALID_ERROR = "That code isn't valid. Check the code and try again.";
export const OTP_EXPIRED_ERROR = "This code has expired. Send a new code to continue.";
export const OTP_NETWORK_ERROR = "We couldn't verify the code. Try again.";
export const OTP_SEND_ERROR = "We couldn't send a verification code. Try again.";
export const OTP_RESENT_MESSAGE = "A new code has been sent.";

export function normalizeOtp(value: string, length = OTP_LENGTH): string {
  return value.replace(/\D/g, "").slice(0, length);
}

export function isCompleteOtp(value: string): boolean {
  return normalizeOtp(value).length === OTP_LENGTH;
}

export type OtpFailureKind = "invalid" | "expired";

export function classifyOtpError(error: { code?: string; message?: string } | null | undefined): OtpFailureKind {
  const code = (error?.code || "").toLowerCase();
  const message = error?.message || "";
  if (code === "otp_expired") {
    return "expired";
  }
  if (/expired/i.test(message) && !/invalid/i.test(message)) {
    return "expired";
  }
  return "invalid";
}

export function otpFailureMessage(kind: OtpFailureKind): string {
  return kind === "expired" ? OTP_EXPIRED_ERROR : OTP_INVALID_ERROR;
}
