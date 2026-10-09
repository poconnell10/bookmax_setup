import type { Metadata } from "next";
import { ThanksSetupScreen } from "@/components/setup/ThanksSetupScreen";

export const metadata: Metadata = { title: "Setup submitted" };

export default function SetupThanksPage() {
  return <ThanksSetupScreen />;
}
