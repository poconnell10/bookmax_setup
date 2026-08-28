import type { Metadata } from "next";
import { PropertyStep } from "@/components/intake/PropertyStep";

export const metadata: Metadata = {
  title: "Property & PMS",
};

export default function PropertyPage() {
  return <PropertyStep />;
}
