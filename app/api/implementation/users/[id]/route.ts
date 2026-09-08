import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/implementation/internal/auth";
import { internalErrorToResponse } from "@/lib/implementation/internal/http";
import { getAccessDirectoryService } from "@/lib/implementation/access/runtime";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const staff = await requireAdmin(request);
    const { id } = await params;
    const detail = await getAccessDirectoryService().get(staff, id);
    return staff.attachAuthCookies(NextResponse.json({ ok: true, ...detail }));
  } catch (error) {
    return internalErrorToResponse(error);
  }
}
