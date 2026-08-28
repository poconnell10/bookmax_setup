import { NextResponse } from "next/server";
import { prototypePersistence } from "@/lib/implementation/persistence";
import type { SubmissionRecord } from "@/types/implementation";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = (await request.json()) as { record?: SubmissionRecord };

  if (!body.record) {
    return NextResponse.json({ error: "Missing record" }, { status: 400 });
  }

  const result = await prototypePersistence.submitImplementation(body.record);
  return NextResponse.json(result);
}
