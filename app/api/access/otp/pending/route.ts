import { NextRequest, NextResponse } from "next/server";
import { maskEmail } from "@/lib/access/email";
import { clearPendingEmailCookie, PENDING_EMAIL_COOKIE } from "@/lib/access/pending-email";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const email = request.cookies.get(PENDING_EMAIL_COOKIE)?.value;
  if (!email) {
    return NextResponse.json({ ok: false, code: "not_found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, emailMasked: maskEmail(email) });
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  clearPendingEmailCookie(response);
  return response;
}
