import type { Metadata } from "next";
import { PmsScreen } from "@/components/setup/PmsScreen";

export const metadata: Metadata = { title: "PMS" };

export default function PmsPage() {
  return <PmsScreen />;
}
