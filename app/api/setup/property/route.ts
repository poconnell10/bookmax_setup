import { NextRequest, NextResponse } from "next/server";
import { requireCustomerSession } from "@/lib/implementation/customer/auth";
import { customerErrorToResponse } from "@/lib/implementation/customer/http";
import { getCustomerService } from "@/lib/implementation/customer/runtime";
import type { PropertyInput, PropertyPeopleInput } from "@/lib/implementation/customer/types";
import { emptySetupIntake } from "@/lib/setup/intake";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { userId, email, attachAuthCookies } = await requireCustomerSession(request);
    const requestedImplementationId = request.nextUrl.searchParams.get("implementationId");
    const requestedPropertyId = request.nextUrl.searchParams.get("propertyId");
    const service = getCustomerService();

    if (requestedImplementationId) {
      await service.assertOwnsImplementation(userId, requestedImplementationId);
    }
    if (requestedPropertyId) {
      await service.assertOwnsProperty(userId, requestedPropertyId);
    }

    const context = await service.getForUser(userId);
    return attachAuthCookies(
      NextResponse.json({
        ok: true,
        email,
        implementation: context.implementation,
        property: context.property,
        intake: context.intake?.payload ?? emptySetupIntake(),
      }),
    );
  } catch (error) {
    return customerErrorToResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId, email, attachAuthCookies } = await requireCustomerSession(request);
    const body = (await request.json().catch(() => ({}))) as Partial<PropertyInput> &
      Partial<PropertyPeopleInput> & {
        implementationId?: string;
        propertyId?: string;
        id?: string;
      };

    const service = getCustomerService();
    if (body.implementationId) {
      await service.assertOwnsImplementation(userId, body.implementationId);
    }
    if (body.propertyId || body.id) {
      await service.assertOwnsProperty(userId, body.propertyId || body.id || "");
    }

    const hasPeople =
      body.sameAsPrimaryContact === true ||
      body.sameAsPrimaryContact === false ||
      Boolean(body.technicalContactName) ||
      Boolean(body.technicalContactEmail) ||
      Boolean(body.technicalContactMobile);

    const context = await service.saveProperty(
      userId,
      {
        name: body.name || "",
        city: body.city,
        country: body.country,
        hotelBrand: body.hotelBrand,
        contactName: body.contactName || "",
        jobTitle: body.jobTitle,
      },
      hasPeople
        ? {
            sameAsPrimaryContact: body.sameAsPrimaryContact === true,
            technicalContactName: body.technicalContactName,
            technicalContactEmail: body.technicalContactEmail,
            technicalContactMobile: body.technicalContactMobile,
          }
        : undefined,
    );

    return attachAuthCookies(
      NextResponse.json({
        ok: true,
        email,
        implementation: context.implementation,
        property: context.property,
        intake: context.intake?.payload ?? emptySetupIntake(),
      }),
    );
  } catch (error) {
    return customerErrorToResponse(error);
  }
}
