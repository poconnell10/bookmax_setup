import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/implementation/internal/auth";
import { internalErrorToResponse } from "@/lib/implementation/internal/http";
import { getAccessDirectoryService } from "@/lib/implementation/access/runtime";
import type { InternalRole } from "@/lib/implementation/internal/types";

export const dynamic = "force-dynamic";

function isRole(value: unknown): value is InternalRole {
  return value === "admin" || value === "engineer" || value === "viewer";
}

export async function GET(request: NextRequest) {
  try {
    const staff = await requireAdmin(request);
    const service = getAccessDirectoryService();
    const [users, implementations] = await Promise.all([
      service.list(staff),
      service.listImplementationOptions(staff),
    ]);
    return staff.attachAuthCookies(NextResponse.json({ ok: true, users, implementations }));
  } catch (error) {
    return internalErrorToResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const staff = await requireAdmin(request);
    const body = (await request.json().catch(() => ({}))) as {
      userId?: string;
      accountType?: string;
      role?: string;
      implementationId?: string;
    };
    if (!body.userId) {
      return NextResponse.json(
        { ok: false, code: "invalid_input", error: "Select a user to provision." },
        { status: 400 },
      );
    }
    const service = getAccessDirectoryService();
    if (body.accountType === "customer") {
      const user = await service.provision(staff, {
        userId: body.userId,
        accountType: "customer",
        implementationId: body.implementationId || "",
      });
      return staff.attachAuthCookies(NextResponse.json({ ok: true, user }));
    }
    if (body.accountType !== "internal" || !isRole(body.role)) {
      return NextResponse.json(
        { ok: false, code: "invalid_input", error: "Choose Customer or Internal access." },
        { status: 400 },
      );
    }
    const user = await service.provision(staff, {
      userId: body.userId,
      accountType: "internal",
      role: body.role,
    });
    return staff.attachAuthCookies(NextResponse.json({ ok: true, user }));
  } catch (error) {
    return internalErrorToResponse(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const staff = await requireAdmin(request);
    const body = (await request.json().catch(() => ({}))) as {
      userId?: string;
      action?: string;
      role?: string;
      accountType?: string;
      implementationId?: string;
    };
    if (!body.userId || !body.action) {
      return NextResponse.json(
        { ok: false, code: "invalid_input", error: "Select a user and an action." },
        { status: 400 },
      );
    }
    const service = getAccessDirectoryService();
    const action =
      body.action === "role" && isRole(body.role)
        ? ({ action: "role" as const, role: body.role })
        : body.action === "disable"
          ? { action: "disable" as const }
          : body.action === "reactivate"
            ? { action: "reactivate" as const }
            : body.action === "assign"
              ? { action: "assign" as const, implementationId: body.implementationId || "" }
              : body.action === "accountType" && body.accountType === "internal" && isRole(body.role)
                ? { action: "accountType" as const, accountType: "internal" as const, role: body.role }
                : body.action === "accountType" && body.accountType === "customer"
                  ? {
                      action: "accountType" as const,
                      accountType: "customer" as const,
                      implementationId: body.implementationId || "",
                    }
                  : null;
    if (!action) {
      return NextResponse.json(
        { ok: false, code: "invalid_input", error: "That access change is not supported." },
        { status: 400 },
      );
    }
    const user = await service.manage(staff, body.userId, action);
    return staff.attachAuthCookies(NextResponse.json({ ok: true, user }));
  } catch (error) {
    return internalErrorToResponse(error);
  }
}
