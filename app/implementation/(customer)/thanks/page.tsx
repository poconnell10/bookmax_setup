import type { Metadata } from "next";
import { SuccessScreen } from "@/components/setup/SuccessScreen";

export const metadata: Metadata = { title: "Thank you" };

export default function ThanksPage() {
  return <SuccessScreen />;
}
