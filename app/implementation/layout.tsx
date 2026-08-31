import type { ReactNode } from "react";
import { IntakeProvider } from "@/components/intake/IntakeProvider";

export default function ImplementationLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <IntakeProvider>{children}</IntakeProvider>;
}
