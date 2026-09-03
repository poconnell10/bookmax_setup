import { NextRequest, NextResponse } from "next/server";
import { requireCustomerSession } from "@/lib/implementation/customer/auth";
import { customerErrorToResponse } from "@/lib/implementation/customer/http";
import { getCustomerService } from "@/lib/implementation/customer/runtime";
import { emptySetupIntake } from "@/lib/setup/intake";
import type { SetupIntakePayload } from "@/lib/setup/intake";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const { userId, email, attachAuthCookies } = await requireCustomerSession(request);
    const body = (await request.json().catch(() => ({}))) as Partial<SetupIntakePayload> & {
      implementationId?: string;
      step?: "pms" | "connect";
    };

    const service = getCustomerService();
    const { step, implementationId, ...patch } = body;
    if (implementationId) {
      await service.assertOwnsImplementation(userId, implementationId);
    }
    const context =
      step === "pms"
        ? await service.savePmsSelection(userId, {
            pmsId: patch.pmsId ?? null,
            otherPmsName: patch.otherPmsName ?? "",
          })
        : step === "connect"
          ? await service.saveConnectDetails(userId, patch)
          : await service.saveIntake(userId, patch);

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
