import type { ReactNode } from "react";
import { Suspense } from "react";
import { CustomerShell } from "@/components/implementation/CustomerShell";

export default function CustomerLayout({ children }: { children: ReactNode }) {
  return (
    <CustomerShell>
      <Suspense>{children}</Suspense>
    </CustomerShell>
  );
}
