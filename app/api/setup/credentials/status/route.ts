import { NextRequest, NextResponse } from "next/server";
import { requireCustomerSession } from "@/lib/implementation/customer/auth";
import { customerErrorToResponse } from "@/lib/implementation/customer/http";
import { getCredentialService } from "@/lib/setup/credentials/runtime";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { userId, attachAuthCookies } = await requireCustomerSession(request);
    const status = await getCredentialService().status(userId);
    return attachAuthCookies(
      NextResponse.json({
        ok: true,
        credentialsReceived: status.credentialsReceived,
        receivedAt: status.receivedAt,
      }),
    );
  } catch (error) {
    return customerErrorToResponse(error);
  }
}
