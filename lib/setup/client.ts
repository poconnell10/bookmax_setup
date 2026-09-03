"use client";

import type { SetupIntakePayload } from "@/lib/setup/intake";
import type { CustomerProperty, CustomerSubmission } from "@/lib/implementation/customer/types";

export type SetupContextPayload = {
  ok?: boolean;
  email?: string;
  property?: CustomerProperty | null;
  intake?: SetupIntakePayload;
  submission?: CustomerSubmission | null;
  resumePath?: string;
  error?: string;
};

export async function fetchSetupContext(): Promise<SetupContextPayload> {
  const response = await fetch("/api/setup/context");
  return (await response.json()) as SetupContextPayload;
}
