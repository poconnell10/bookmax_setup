import type { Metadata } from "next";
import { PropertySetupScreen } from "@/components/setup/PropertySetupScreen";

export const metadata: Metadata = { title: "Property" };

export default function SetupPropertyPage() {
  return <PropertySetupScreen />;
}
