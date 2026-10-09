import { NextRequest, NextResponse } from "next/server";
import { logAccess } from "@/lib/access/log";
import { getAccessDirectoryService } from "@/lib/implementation/access/runtime";
import { requirePropertySetupSession } from "@/lib/implementation/customer/auth";
import { customerErrorToResponse } from "@/lib/implementation/customer/http";
import { getCustomerService } from "@/lib/implementation/customer/runtime";
import { CustomerError, type PropertyInput, type PropertyPeopleInput } from "@/lib/implementation/customer/types";
import { emptySetupIntake } from "@/lib/setup/intake";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { subjectUserId, subjectEmail, attachAuthCookies } = await requirePropertySetupSession(request);
    const requestedImplementationId = request.nextUrl.searchParams.get("implementationId");
    const requestedPropertyId = request.nextUrl.searchParams.get("propertyId");
    const service = getCustomerService();

    if (requestedImplementationId) {
      await service.assertOwnsImplementation(subjectUserId, requestedImplementationId);
    }
    if (requestedPropertyId) {
      await service.assertOwnsProperty(subjectUserId, requestedPropertyId);
    }

    const context = await service.getForUser(subjectUserId);
    return attachAuthCookies(
      NextResponse.json({
        ok: true,
        email: subjectEmail,
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
    const { subjectUserId, subjectEmail, actingAdmin, attachAuthCookies } =
      await requirePropertySetupSession(request);
    const body = (await request.json().catch(() => ({}))) as Partial<PropertyInput> &
      Partial<PropertyPeopleInput> & {
        implementationId?: string;
        propertyId?: string;
        id?: string;
      };

    const service = getCustomerService();
    if (body.implementationId) {
      await service.assertOwnsImplementation(subjectUserId, body.implementationId);
    }
    if (body.propertyId || body.id) {
      await service.assertOwnsProperty(subjectUserId, body.propertyId || body.id || "");
    }

    const hasPeople =
      body.sameAsPrimaryContact === true ||
      body.sameAsPrimaryContact === false ||
      Boolean(body.technicalContactName) ||
      Boolean(body.technicalContactEmail) ||
      Boolean(body.technicalContactMobile);

    const before = actingAdmin ? await service.getForUser(subjectUserId) : null;
    const context = await service.saveProperty(
      subjectUserId,
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

    if (actingAdmin) {
      logAccess("property_saved_by_admin", { implementationId: context.implementation.id });
      try {
        await getAccessDirectoryService().recordCustomerPropertySaved(actingAdmin, subjectUserId, {
          implementationId: context.implementation.id,
          propertyCreated: !before?.property,
        });
      } catch {
        throw new CustomerError("unavailable", "The property was saved, but the change could not be recorded.");
      }
    }

    return attachAuthCookies(
      NextResponse.json({
        ok: true,
        email: subjectEmail,
        implementation: context.implementation,
        property: context.property,
        intake: context.intake?.payload ?? emptySetupIntake(),
      }),
    );
  } catch (error) {
    return customerErrorToResponse(error);
  }
}
