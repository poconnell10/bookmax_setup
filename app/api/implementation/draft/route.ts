import { NextRequest, NextResponse } from "next/server";
import { prototypePersistence } from "@/lib/implementation/persistence";
import type { IntakeState } from "@/types/implementation";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const draftId = request.nextUrl.searchParams.get("id");

  if (!draftId) {
    return NextResponse.json({ draft: null });
  }

  const draft = await prototypePersistence.loadDraft(draftId);
  return NextResponse.json({ draft });
}

export async function POST(request: Request) {
  const body = (await request.json()) as { draft?: IntakeState };

  if (!body.draft) {
    return NextResponse.json({ error: "Missing draft" }, { status: 400 });
  }

  const result = await prototypePersistence.saveDraft(body.draft);
  return NextResponse.json(result);
}
