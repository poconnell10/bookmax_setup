import { NextRequest, NextResponse } from "next/server";
import { requireCustomerSession } from "@/lib/implementation/customer/auth";
import { customerErrorToResponse } from "@/lib/implementation/customer/http";
import { getCredentialService } from "@/lib/setup/credentials/runtime";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const { userId, attachAuthCookies } = await requireCustomerSession(request);
    const body = (await request.json().catch(() => ({}))) as {
      clientId?: string;
      clientSecret?: string;
      applicationKey?: string;
    };
    await getCredentialService().submit(userId, body);
    return attachAuthCookies(
      NextResponse.json({
        ok: true,
        credentialsReceived: true,
      }),
    );
  } catch (error) {
    return customerErrorToResponse(error);
  }
}
