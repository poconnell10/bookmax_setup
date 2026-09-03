import { NextRequest, NextResponse } from "next/server";
import { getInvitationService } from "@/lib/implementation/invitation/runtime";
import {
  INVITATION_COOKIE,
  invitationCookieOptions,
} from "@/lib/implementation/invitation/session-cookie";
import { InvitationError } from "@/lib/implementation/invitation/types";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ token: string }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  const { token: rawToken } = await context.params;
  const token = decodeURIComponent(rawToken || "").trim();
  const signIn = new URL("/implementation", request.url);

  if (!token) {
    return NextResponse.redirect(signIn);
  }

  try {
    const service = getInvitationService();
    const resolved = await service.resolveByRawToken(token);
    const opened = await service.markOpened(resolved.id);

    const response = NextResponse.redirect(signIn);
    response.cookies.set(INVITATION_COOKIE, opened.id, invitationCookieOptions());
    return response;
  } catch (error) {
    if (error instanceof InvitationError) {
      signIn.searchParams.set("invite", error.code);
    } else {
      signIn.searchParams.set("invite", "invalid");
    }
    return NextResponse.redirect(signIn);
  }
}
