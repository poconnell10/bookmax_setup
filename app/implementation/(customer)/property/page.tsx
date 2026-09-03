import type { Metadata } from "next";
import { PropertyScreen } from "@/components/setup/PropertyScreen";

export const metadata: Metadata = { title: "Property" };

export default function PropertyPage() {
  return <PropertyScreen />;
}
