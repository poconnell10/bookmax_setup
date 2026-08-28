import type { Metadata } from "next";
import { SummaryStep } from "@/components/intake/SummaryStep";

export const metadata: Metadata = {
  title: "Summary",
};

export default function SummaryPage() {
  return <SummaryStep />;
}
