import type { ReactNode } from "react";
import { Suspense } from "react";
import { CustomerDraftHydrator } from "@/components/implementation/CustomerDraftHydrator";
import { CustomerShell } from "@/components/implementation/CustomerShell";
import { loadCustomerIntakeState } from "@/lib/implementation/invitation/customer-state";

export default async function CustomerLayout({ children }: { children: ReactNode }) {
  const initialState = await loadCustomerIntakeState();

  return (
    <CustomerShell>
      <CustomerDraftHydrator initialState={initialState} />
      <Suspense>{children}</Suspense>
    </CustomerShell>
  );
}
