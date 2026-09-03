import type { Metadata } from "next";
import { ReviewSetupScreen } from "@/components/setup/ReviewSetupScreen";

export const metadata: Metadata = { title: "Review and submit" };

export default function SetupReviewPage() {
  return <ReviewSetupScreen />;
}
