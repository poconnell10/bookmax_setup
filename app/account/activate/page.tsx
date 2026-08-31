import type { Metadata } from "next";
import { ActivateScreen } from "@/components/account/ActivateScreen";

export const metadata: Metadata = {
  title: "Sign up / Activate",
};

export default function ActivatePage() {
  return <ActivateScreen />;
}
