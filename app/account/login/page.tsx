import type { Metadata } from "next";
import { LoginScreen } from "@/components/account/LoginScreen";

export const metadata: Metadata = {
  title: "Sign in",
};

export default function LoginPage() {
  return <LoginScreen />;
}
