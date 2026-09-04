import { NextRequest, NextResponse } from "next/server";
import { requireInternalStaff } from "@/lib/implementation/internal/auth";
import { internalErrorToResponse } from "@/lib/implementation/internal/http";
import { getInternalSubmissionService } from "@/lib/implementation/internal/runtime";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const staff = await requireInternalStaff(request);
    const submissions = await getInternalSubmissionService().list(staff);
    return staff.attachAuthCookies(NextResponse.json({ ok: true, submissions }));
  } catch (error) {
    return internalErrorToResponse(error);
  }
}
