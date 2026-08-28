import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/AppShell";

export default function ImplementationLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <AppShell>{children}</AppShell>;
}
