import { logAccess } from "@/lib/access/log";
import {
  buildSubmissionRecord,
  connectStepComplete,
  emptySetupIntake,
  looksLikeEmail,
  mergeSetupIntake,
  normalizeSetupIntake,
  pmsSelectionComplete,
  submitBlockers,
  type SetupIntakePayload,
} from "@/lib/setup/intake";
import { getSetupResumePath } from "@/lib/setup/resume";
import type { CustomerStore } from "@/lib/implementation/customer/store";
import { CustomerError } from "@/lib/implementation/customer/types";
import type {
  CustomerSetupContext,
  PropertyInput,
  PropertyPeopleInput,
} from "@/lib/implementation/customer/types";

const REQUIRED_PROPERTY_ERROR = "Enter the required property details.";

export function validatePropertyInput(input: PropertyInput): PropertyInput {
  const name = input.name.trim();
  const contactName = input.contactName.trim();
  const hotelBrand = input.hotelBrand?.trim() || null;
  const city = input.city?.trim() || null;
  const country = input.country?.trim() || null;
  const jobTitle = input.jobTitle?.trim() || null;
  if (!name || !contactName) {
    throw new CustomerError("invalid_input", REQUIRED_PROPERTY_ERROR);
  }
  return { name, city, country, hotelBrand, contactName, jobTitle };
}

async function loadContext(store: CustomerStore, userId: string, created: boolean): Promise<CustomerSetupContext | null> {
  const membership = await store.findMembershipByUserId(userId);
  if (!membership) {
    return null;
  }
  const implementation = await store.findImplementationById(membership.implementationId);
  if (!implementation) {
    return null;
  }
  const [property, intake, submission] = await Promise.all([
    store.findPropertyByImplementationId(implementation.id),
    store.findIntakeByImplementationId(implementation.id),
    store.findSubmissionByImplementationId(implementation.id),
  ]);
  return { implementation, property, intake, submission, created };
}

export function createCustomerService(store: CustomerStore) {
  async function ensureForUser(userId: string): Promise<CustomerSetupContext> {
    const existing = await loadContext(store, userId, false);
    if (existing) {
      logAccess("implementation_resumed", { implementationId: existing.implementation.id });
      return existing;
    }

    try {
      const implementation = await store.insertImplementation();
      await store.insertMembership({ implementationId: implementation.id, userId });
      logAccess("implementation_created", { implementationId: implementation.id });
      return { implementation, property: null, intake: null, submission: null, created: true };
    } catch (error) {
      if (error instanceof CustomerError && error.code === "invalid_input") {
        const raced = await loadContext(store, userId, false);
        if (raced) {
          logAccess("implementation_resumed", { implementationId: raced.implementation.id });
          return raced;
        }
      }
      throw error;
    }
  }

  async function getForUser(userId: string): Promise<CustomerSetupContext> {
    const context = await loadContext(store, userId, false);
    if (!context) {
      throw new CustomerError("forbidden", "Sign in to continue.");
    }
    const membership = await store.findMembershipByUserId(userId);
    if (membership?.status === "disabled") {
      throw new CustomerError("forbidden", "You cannot access that implementation.");
    }
    return context;
  }

  async function assertOwnsImplementation(userId: string, implementationId: string): Promise<void> {
    const context = await getForUser(userId);
    if (context.implementation.id !== implementationId) {
      throw new CustomerError("forbidden", "You cannot access that implementation.");
    }
  }

  async function assertOwnsProperty(userId: string, propertyId: string) {
    const context = await getForUser(userId);
    const property = await store.findPropertyById(propertyId);
    if (!property || property.implementationId !== context.implementation.id) {
      throw new CustomerError("forbidden", "You cannot access that property.");
    }
    return property;
  }

  async function saveProperty(
    userId: string,
    input: PropertyInput,
    people?: PropertyPeopleInput,
  ): Promise<CustomerSetupContext> {
    const context = await getForUser(userId);
    if (context.submission) {
      throw new CustomerError("invalid_input", "This implementation was already submitted.");
    }
    const valid = validatePropertyInput(input);
    if (people && !people.sameAsPrimaryContact) {
      const techName = people.technicalContactName?.trim() || "";
      const techEmail = people.technicalContactEmail?.trim() || "";
      if (!techName || !techEmail) {
        throw new CustomerError("invalid_input", REQUIRED_PROPERTY_ERROR);
      }
      if (!looksLikeEmail(techEmail)) {
        throw new CustomerError("invalid_input", "PMS access contact email must look like an email.");
      }
    }
    const property = await store.upsertProperty(context.implementation.id, valid);
    const peoplePatch: Partial<SetupIntakePayload> = people
      ? {
          sameAsPrimaryContact: people.sameAsPrimaryContact,
          technicalContactName: people.sameAsPrimaryContact
            ? valid.contactName
            : people.technicalContactName?.trim() || "",
          technicalContactEmail: people.sameAsPrimaryContact
            ? ""
            : people.technicalContactEmail?.trim() || "",
          technicalContactMobile: people.technicalContactMobile?.trim() || "",
        }
      : {};
    const intake = await store.upsertIntake(
      context.implementation.id,
      mergeSetupIntake(currentIntake(context), peoplePatch),
    );
    const implementation = await store.updateImplementationStatus(
      context.implementation.id,
      "property_complete",
    );
    logAccess("property_saved", { implementationId: implementation.id });
    return { ...context, implementation, property, intake, created: false };
  }

  function currentIntake(context: CustomerSetupContext): SetupIntakePayload {
    return context.intake?.payload ?? emptySetupIntake();
  }

  async function saveIntake(
    userId: string,
    patch: Partial<SetupIntakePayload>,
  ): Promise<CustomerSetupContext> {
    const context = await getForUser(userId);
    if (context.submission) {
      throw new CustomerError("invalid_input", "This implementation was already submitted.");
    }
    if (!context.property) {
      throw new CustomerError("invalid_input", "Save your property details first.");
    }
    const merged = mergeSetupIntake(currentIntake(context), patch);
    const intake = await store.upsertIntake(context.implementation.id, merged);
    logAccess("intake_saved", { implementationId: context.implementation.id });
    return { ...context, intake, created: false };
  }

  async function savePmsSelection(
    userId: string,
    input: Pick<SetupIntakePayload, "pmsId" | "otherPmsName">,
  ): Promise<CustomerSetupContext> {
    const context = await saveIntake(userId, input);
    if (!pmsSelectionComplete(context.intake!.payload)) {
      throw new CustomerError("invalid_input", "Select your property management system.");
    }
    return context;
  }

  async function saveConnectDetails(
    userId: string,
    patch: Partial<SetupIntakePayload>,
  ): Promise<CustomerSetupContext> {
    const context = await saveIntake(userId, patch);
    if (!connectStepComplete(context.intake!.payload)) {
      throw new CustomerError("invalid_input", "Enter the required connection details.");
    }
    return context;
  }

  async function submitSetup(userId: string, contactEmail: string): Promise<CustomerSetupContext> {
    const context = await getForUser(userId);
    if (context.submission) {
      throw new CustomerError("invalid_input", "This implementation was already submitted.");
    }
    if (!context.property || !context.intake) {
      throw new CustomerError("invalid_input", "Complete setup before submitting.");
    }
    const blockers = submitBlockers(context.intake.payload, context.property, contactEmail);
    if (blockers.length > 0) {
      throw new CustomerError("invalid_input", blockers[0]);
    }
    const record = buildSubmissionRecord({
      implementationId: context.implementation.id,
      property: context.property,
      contactEmail,
      intake: context.intake.payload,
    });
    const submission = await store.insertSubmission({
      implementationId: context.implementation.id,
      record,
    });
    const implementation = await store.updateImplementationStatus(
      context.implementation.id,
      "submitted",
    );
    logAccess("implementation_submitted", {
      implementationId: implementation.id,
      submissionId: submission.id,
    });
    return { ...context, implementation, submission, created: false };
  }

  function resumePath(context: CustomerSetupContext): string {
    return getSetupResumePath({
      status: context.implementation.status,
      property: context.property,
      intake: currentIntake(context),
      submitted: Boolean(context.submission),
    });
  }

  return {
    ensureForUser,
    getForUser,
    assertOwnsImplementation,
    assertOwnsProperty,
    saveProperty,
    saveIntake,
    savePmsSelection,
    saveConnectDetails,
    submitSetup,
    resumePath,
    currentIntake,
  };
}

export type CustomerService = ReturnType<typeof createCustomerService>;

export { normalizeSetupIntake };
