import type { ReactNode } from "react";
import { requireCustomerSetupPage } from "@/lib/implementation/customer/auth";

export default async function SetupLayout({ children }: { children: ReactNode }) {
  await requireCustomerSetupPage();
  return children;
}
