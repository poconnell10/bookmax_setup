import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseProxyClient } from "@/lib/supabase/auth-clients";
import {
  INVITATION_CLAIM_COOKIE,
  INVITATION_COOKIE,
  verifyInvitationClaim,
} from "@/lib/implementation/invitation/session-cookie";

const INVITATION_PREFIXES = [
  "/implementation/property",
  "/implementation/contacts",
  "/implementation/pms",
  "/implementation/review",
  "/implementation/thanks",
] as const;

const SETUP_PREFIXES = [
  "/setup/property",
  "/setup/pms",
  "/setup/connect",
  "/setup/review",
  "/setup/thanks",
  "/setup/complete",
] as const;

function matchesPrefix(pathname: string, prefixes: readonly string[]): boolean {
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const isSetup = matchesPrefix(pathname, SETUP_PREFIXES);
  const isInvitation = matchesPrefix(pathname, INVITATION_PREFIXES);

  if (!isSetup && !isInvitation) {
    return NextResponse.next();
  }

  const response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  try {
    const supabase = createSupabaseProxyClient(request, response);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (isSetup) {
      if (!user?.id) {
        return NextResponse.redirect(new URL("/access", request.url));
      }
      return response;
    }

    const claim = verifyInvitationClaim(request.cookies.get(INVITATION_CLAIM_COOKIE)?.value);
    const invitationId = request.cookies.get(INVITATION_COOKIE)?.value;

    const authorized =
      Boolean(user?.id) &&
      Boolean(claim) &&
      Boolean(invitationId) &&
      claim!.invitationId === invitationId &&
      claim!.authUserId === user!.id;

    if (!authorized) {
      return NextResponse.redirect(new URL("/implementation", request.url));
    }

    return response;
  } catch {
    const login = new URL(isSetup ? "/access" : "/implementation", request.url);
    return NextResponse.redirect(login);
  }
}

export const config = {
  matcher: [
    "/implementation/property",
    "/implementation/contacts",
    "/implementation/pms",
    "/implementation/review",
    "/implementation/thanks",
    "/setup/property",
    "/setup/pms",
    "/setup/connect",
    "/setup/review",
    "/setup/thanks",
    "/setup/complete",
  ],
};
