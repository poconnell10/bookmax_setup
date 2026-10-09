import type { Metadata } from "next";
import { PropertySetupScreen } from "@/components/setup/PropertySetupScreen";
import { requirePropertySetupPage } from "@/lib/implementation/customer/auth";

export const metadata: Metadata = { title: "Property" };

/**
 * Outside the (customer) group: this is the one setup page an Admin may open,
 * and only for the Customer and implementation named in the query string.
 */
export default async function SetupPropertyPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const customer = typeof params.customer === "string" ? params.customer : null;
  const implementation = typeof params.implementation === "string" ? params.implementation : null;
  await requirePropertySetupPage({ customer, implementation });
  return (
    <PropertySetupScreen
      adminScope={customer && implementation ? { customer, implementation } : null}
    />
  );
}
