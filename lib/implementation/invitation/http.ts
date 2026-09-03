import { NextResponse } from "next/server";
import { PersistenceUnavailableError } from "@/lib/implementation/invitation/supabase-store";
import { InvitationError } from "@/lib/implementation/invitation/types";

export function invitationErrorToResponse(error: unknown): NextResponse {
  if (error instanceof InvitationError) {
    const status =
      error.code === "not_found"
        ? 404
        : error.code === "forbidden" ||
            error.code === "email_mismatch" ||
            error.code === "rebind_conflict"
          ? 403
          : error.code === "expired" || error.code === "revoked" || error.code === "submitted"
            ? 410
            : error.code === "invalid_input"
              ? 400
              : 400;
    return NextResponse.json({ ok: false, code: error.code, error: error.message }, { status });
  }

  if (error instanceof PersistenceUnavailableError) {
    return NextResponse.json(
      { ok: false, code: "unavailable", error: error.message },
      { status: 503 },
    );
  }

  if (error instanceof Error && error.message.includes("Supabase")) {
    return NextResponse.json(
      { ok: false, code: "misconfigured", error: "Authentication is not configured." },
      { status: 503 },
    );
  }

  return NextResponse.json(
    { ok: false, code: "internal", error: "Unexpected server error." },
    { status: 500 },
  );
}
