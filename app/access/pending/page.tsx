import type { Metadata } from "next";
import { AccessPendingScreen } from "@/components/access/AccessPendingScreen";

export const metadata: Metadata = {
  title: "Access pending",
};

export default function AccessPendingPage() {
  return <AccessPendingScreen />;
}
