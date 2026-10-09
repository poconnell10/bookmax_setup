import type { Metadata } from "next";
import { PmsSetupScreen } from "@/components/setup/PmsSetupScreen";

export const metadata: Metadata = { title: "PMS selection" };

export default function SetupPmsPage() {
  return <PmsSetupScreen />;
}
