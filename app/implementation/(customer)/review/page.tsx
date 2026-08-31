import type { Metadata } from "next";
import { ReviewScreen } from "@/components/setup/ReviewScreen";

export const metadata: Metadata = { title: "Review" };

export default function ReviewPage() {
  return <ReviewScreen />;
}
