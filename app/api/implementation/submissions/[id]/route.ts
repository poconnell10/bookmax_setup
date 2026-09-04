import { NextRequest, NextResponse } from "next/server";
import { requireInternalStaff } from "@/lib/implementation/internal/auth";
import { internalErrorToResponse } from "@/lib/implementation/internal/http";
import { getInternalSubmissionService } from "@/lib/implementation/internal/runtime";
import { SUBMISSION_STATUSES, type SubmissionStatus } from "@/types/implementation";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const staff = await requireInternalStaff(request);
    const { id } = await context.params;
    const submission = await getInternalSubmissionService().get(staff, id);
    return staff.attachAuthCookies(NextResponse.json({ ok: true, submission }));
  } catch (error) {
    return internalErrorToResponse(error);
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const staff = await requireInternalStaff(request);
    const { id } = await context.params;
    const body = (await request.json().catch(() => ({}))) as { status?: string };
    const status = body.status as SubmissionStatus | undefined;
    if (!status || !SUBMISSION_STATUSES.includes(status)) {
      return NextResponse.json({ ok: false, code: "invalid_input", error: "Invalid status" }, { status: 400 });
    }
    const submission = await getInternalSubmissionService().updateStatus(staff, id, status);
    return staff.attachAuthCookies(NextResponse.json({ ok: true, submission }));
  } catch (error) {
    return internalErrorToResponse(error);
  }
}
