import type { Metadata } from "next";
import { OtpVerifyScreen } from "@/components/access/OtpVerifyScreen";

export const metadata: Metadata = { title: "Check your email" };

export default function AccessVerifyPage() {
  return <OtpVerifyScreen />;
}
