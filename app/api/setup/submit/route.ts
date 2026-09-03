import { NextRequest, NextResponse } from "next/server";
import { requireCustomerSession } from "@/lib/implementation/customer/auth";
import { customerErrorToResponse } from "@/lib/implementation/customer/http";
import { getCustomerService } from "@/lib/implementation/customer/runtime";
import { emptySetupIntake } from "@/lib/setup/intake";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const { userId, email, attachAuthCookies } = await requireCustomerSession(request);
    const body = (await request.json().catch(() => ({}))) as { implementationId?: string };
    const service = getCustomerService();

    if (body.implementationId) {
      await service.assertOwnsImplementation(userId, body.implementationId);
    }

    const context = await service.submitSetup(userId, email);

    return attachAuthCookies(
      NextResponse.json({
        ok: true,
        email,
        implementation: context.implementation,
        property: context.property,
        intake: context.intake?.payload ?? emptySetupIntake(),
        submission: context.submission,
        resumePath: service.resumePath(context),
      }),
    );
  } catch (error) {
    return customerErrorToResponse(error);
  }
}
