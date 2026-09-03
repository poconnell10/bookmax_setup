import { NextResponse } from "next/server";
import { CustomerError } from "@/lib/implementation/customer/types";

export function customerErrorToResponse(error: unknown): NextResponse {
  if (error instanceof CustomerError) {
    const status =
      error.code === "forbidden" ? 403 : error.code === "not_found" ? 404 : error.code === "unavailable" ? 503 : 400;
    return NextResponse.json({ ok: false, code: error.code, error: error.message }, { status });
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
