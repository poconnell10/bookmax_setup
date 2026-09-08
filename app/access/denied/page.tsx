import type { Metadata } from "next";
import { AccessDeniedScreen } from "@/components/access/AccessDeniedScreen";

export const metadata: Metadata = {
  title: "Access denied",
};

export default function AccessDeniedPage() {
  return <AccessDeniedScreen />;
}
