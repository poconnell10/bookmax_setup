import { NextRequest, NextResponse } from "next/server";
import { requireEngineer } from "@/lib/implementation/internal/auth";
import { internalErrorToResponse } from "@/lib/implementation/internal/http";
import { getInternalSubmissionService } from "@/lib/implementation/internal/runtime";

export const dynamic = "force-dynamic";

function noStore(response: NextResponse): NextResponse {
  response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, private");
  response.headers.set("Pragma", "no-cache");
  return response;
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const staff = await requireEngineer(request);
    const { id } = await context.params;
    const revealed = await getInternalSubmissionService().revealCredentials(staff, id);
    return staff.attachAuthCookies(
      noStore(
        NextResponse.json({
          ok: true,
          submissionId: revealed.submissionId,
          credentialType: revealed.credentialType,
          receivedAt: revealed.receivedAt,
          clientId: revealed.clientId,
          clientSecret: revealed.clientSecret,
          applicationKey: revealed.applicationKey,
        }),
      ),
    );
  } catch (error) {
    return noStore(internalErrorToResponse(error));
  }
}

export async function GET() {
  return noStore(
    NextResponse.json(
      { ok: false, code: "forbidden", error: "Use the secure credential workflow to retrieve credentials." },
      { status: 405 },
    ),
  );
}
