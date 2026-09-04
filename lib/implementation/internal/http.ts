import { NextResponse } from "next/server";
import { InternalError } from "@/lib/implementation/internal/types";

export function internalErrorToResponse(error: unknown): NextResponse {
  if (error instanceof InternalError) {
    const status =
      error.code === "unauthenticated"
        ? 401
        : error.code === "forbidden"
          ? 403
          : error.code === "not_found"
            ? 404
            : error.code === "unavailable"
              ? 503
              : 400;
    return NextResponse.json({ ok: false, code: error.code, error: error.message }, { status });
  }

  return NextResponse.json(
    { ok: false, code: "internal", error: "Unexpected server error." },
    { status: 500 },
  );
}
