import type { Metadata } from "next";
import { SuccessScreen } from "@/components/setup/SuccessScreen";

export const metadata: Metadata = { title: "You're all set" };

export default function ThanksPage() {
  return <SuccessScreen />;
}
