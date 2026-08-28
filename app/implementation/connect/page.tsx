import type { Metadata } from "next";
import { ConnectStep } from "@/components/intake/ConnectStep";

export const metadata: Metadata = {
  title: "Connect PMS",
};

export default function ConnectPage() {
  return <ConnectStep />;
}
