import type { Metadata } from "next";
import { ConnectSetupScreen } from "@/components/setup/ConnectSetupScreen";

export const metadata: Metadata = { title: "Connection details" };

export default function SetupConnectPage() {
  return <ConnectSetupScreen />;
}
