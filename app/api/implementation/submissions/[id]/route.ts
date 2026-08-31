import { NextResponse } from "next/server";
import {
  getPrototypeSubmission,
  updatePrototypeSubmissionStatus,
} from "@/lib/implementation/persistence";
import { SUBMISSION_STATUSES, type SubmissionStatus } from "@/types/implementation";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const submission = getPrototypeSubmission(id);

  if (!submission) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ submission });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const body = (await request.json()) as { status?: string };
  const status = body.status as SubmissionStatus | undefined;

  if (!status || !SUBMISSION_STATUSES.includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const submission = updatePrototypeSubmissionStatus(id, status);

  if (!submission) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ submission });
}
