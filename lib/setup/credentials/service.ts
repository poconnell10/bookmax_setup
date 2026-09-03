import { logAccess } from "@/lib/access/log";
import { encryptCredentialSecrets } from "@/lib/setup/credentials/encrypt";
import type { CredentialStore } from "@/lib/setup/credentials/store";
import { isSetupCloudPms } from "@/lib/setup/pms-catalogue";
import type { CustomerService } from "@/lib/implementation/customer/service";
import { CustomerError } from "@/lib/implementation/customer/types";

export type CredentialStatus = {
  credentialsReceived: boolean;
  receivedAt: string | null;
};

export type CredentialSubmitInput = {
  clientId?: string;
  clientSecret?: string;
  applicationKey?: string;
};

function asTrimmed(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function createCredentialService(store: CredentialStore, customer: CustomerService) {
  async function submit(userId: string, input: CredentialSubmitInput): Promise<{ credentialsReceived: true }> {
    const context = await customer.getForUser(userId);
    if (context.submission) {
      throw new CustomerError("invalid_input", "This implementation was already submitted.");
    }
    if (!isSetupCloudPms(context.intake?.payload.pmsId ?? null)) {
      throw new CustomerError("invalid_input", "Credentials can only be submitted for a cloud PMS.");
    }

    const clientId = asTrimmed(input.clientId);
    const clientSecret = asTrimmed(input.clientSecret);
    const applicationKey = asTrimmed(input.applicationKey);
    if (!clientId || !clientSecret) {
      throw new CustomerError("invalid_input", "Enter your Client ID and client secret.");
    }

    const envelope = encryptCredentialSecrets({ clientId, clientSecret, applicationKey });
    await store.upsert(context.implementation.id, envelope);
    logAccess("credentials_received", { implementationId: context.implementation.id });
    return { credentialsReceived: true };
  }

  async function status(userId: string): Promise<CredentialStatus> {
    const context = await customer.getForUser(userId);
    const record = await store.findByImplementationId(context.implementation.id);
    return {
      credentialsReceived: Boolean(record),
      receivedAt: record?.receivedAt ?? null,
    };
  }

  return { submit, status };
}

export type CredentialService = ReturnType<typeof createCredentialService>;
