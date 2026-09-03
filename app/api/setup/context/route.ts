import { NextRequest, NextResponse } from "next/server";
import { requireCustomerSession } from "@/lib/implementation/customer/auth";
import { customerErrorToResponse } from "@/lib/implementation/customer/http";
import { getCustomerService } from "@/lib/implementation/customer/runtime";
import { emptySetupIntake } from "@/lib/setup/intake";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { userId, email, attachAuthCookies } = await requireCustomerSession(request);
    const requestedImplementationId = request.nextUrl.searchParams.get("implementationId");
    const service = getCustomerService();

    if (requestedImplementationId) {
      await service.assertOwnsImplementation(userId, requestedImplementationId);
    }

    const context = await service.getForUser(userId);
    const intake = context.intake?.payload ?? emptySetupIntake();

    return attachAuthCookies(
      NextResponse.json({
        ok: true,
        email,
        implementation: context.implementation,
        property: context.property,
        intake,
        submission: context.submission,
        resumePath: service.resumePath(context),
      }),
    );
  } catch (error) {
    return customerErrorToResponse(error);
  }
}
