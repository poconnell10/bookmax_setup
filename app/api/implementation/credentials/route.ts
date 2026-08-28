import { NextResponse } from "next/server";
import { prototypePersistence } from "@/lib/implementation/persistence";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    draftId?: string;
    clientId?: string;
    clientSecret?: string;
    applicationKey?: string;
  };

  if (!body.draftId || !body.clientId || !body.clientSecret || !body.applicationKey) {
    return NextResponse.json({ error: "Incomplete credentials" }, { status: 400 });
  }

  const result = await prototypePersistence.submitCredentials(body.draftId, {
    clientId: body.clientId,
    clientSecret: body.clientSecret,
    applicationKey: body.applicationKey,
  });

  return NextResponse.json(result);
}
