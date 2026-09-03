import { randomUUID } from "node:crypto";
import { normalizeSetupIntake } from "@/lib/setup/intake";
import type { SetupIntakePayload } from "@/lib/setup/intake";
import type { CustomerStore } from "@/lib/implementation/customer/store";
import { CustomerError } from "@/lib/implementation/customer/types";
import type {
  CustomerImplementation,
  CustomerIntake,
  CustomerProperty,
  CustomerSubmission,
  ImplementationMembership,
  PropertyInput,
} from "@/lib/implementation/customer/types";

function nowIso(): string {
  return new Date().toISOString();
}

export function createMemoryCustomerStore(): CustomerStore {
  const implementations = new Map<string, CustomerImplementation>();
  const memberships = new Map<string, ImplementationMembership>();
  const membershipByUser = new Map<string, string>();
  const properties = new Map<string, CustomerProperty>();
  const propertyByImplementation = new Map<string, string>();
  const intakes = new Map<string, CustomerIntake>();
  const intakeByImplementation = new Map<string, string>();
  const submissions = new Map<string, CustomerSubmission>();
  const submissionByImplementation = new Map<string, string>();

  return {
    async findMembershipByUserId(userId) {
      const id = membershipByUser.get(userId);
      return id ? (memberships.get(id) ?? null) : null;
    },

    async findImplementationById(id) {
      return implementations.get(id) ?? null;
    },

    async findPropertyByImplementationId(implementationId) {
      const id = propertyByImplementation.get(implementationId);
      return id ? (properties.get(id) ?? null) : null;
    },

    async findPropertyById(id) {
      return properties.get(id) ?? null;
    },

    async insertImplementation() {
      const stamp = nowIso();
      const created: CustomerImplementation = {
        id: randomUUID(),
        status: "started",
        createdAt: stamp,
        updatedAt: stamp,
      };
      implementations.set(created.id, created);
      return created;
    },

    async insertMembership({ implementationId, userId }) {
      if (membershipByUser.has(userId)) {
        throw new CustomerError("invalid_input", "User already belongs to an implementation.");
      }
      if (!implementations.has(implementationId)) {
        throw new CustomerError("not_found", "Implementation was not found.");
      }
      const created: ImplementationMembership = {
        id: randomUUID(),
        implementationId,
        userId,
        role: "customer",
        createdAt: nowIso(),
      };
      memberships.set(created.id, created);
      membershipByUser.set(userId, created.id);
      return created;
    },

    async updateImplementationStatus(id, status) {
      const current = implementations.get(id);
      if (!current) {
        throw new CustomerError("not_found", "Implementation was not found.");
      }
      const next = { ...current, status, updatedAt: nowIso() };
      implementations.set(id, next);
      return next;
    },

    async upsertProperty(implementationId, input: PropertyInput) {
      if (!implementations.has(implementationId)) {
        throw new CustomerError("not_found", "Implementation was not found.");
      }
      const stamp = nowIso();
      const existingId = propertyByImplementation.get(implementationId);
      if (existingId) {
        const current = properties.get(existingId);
        if (!current) {
          throw new CustomerError("not_found", "Property was not found.");
        }
        const next: CustomerProperty = {
          ...current,
          name: input.name,
          city: input.city?.trim() ? input.city.trim() : null,
          country: input.country?.trim() ? input.country.trim() : null,
          hotelBrand: input.hotelBrand?.trim() ? input.hotelBrand.trim() : null,
          contactName: input.contactName,
          jobTitle: input.jobTitle?.trim() ? input.jobTitle.trim() : null,
          updatedAt: stamp,
        };
        properties.set(existingId, next);
        return next;
      }
      const created: CustomerProperty = {
        id: randomUUID(),
        implementationId,
        name: input.name,
        city: input.city?.trim() ? input.city.trim() : null,
        country: input.country?.trim() ? input.country.trim() : null,
        hotelBrand: input.hotelBrand?.trim() ? input.hotelBrand.trim() : null,
        contactName: input.contactName,
        jobTitle: input.jobTitle?.trim() ? input.jobTitle.trim() : null,
        createdAt: stamp,
        updatedAt: stamp,
      };
      properties.set(created.id, created);
      propertyByImplementation.set(implementationId, created.id);
      return created;
    },

    async findIntakeByImplementationId(implementationId) {
      const id = intakeByImplementation.get(implementationId);
      return id ? (intakes.get(id) ?? null) : null;
    },

    async upsertIntake(implementationId, payload: SetupIntakePayload) {
      if (!implementations.has(implementationId)) {
        throw new CustomerError("not_found", "Implementation was not found.");
      }
      const stamp = nowIso();
      const normalized = normalizeSetupIntake(payload);
      const existingId = intakeByImplementation.get(implementationId);
      if (existingId) {
        const current = intakes.get(existingId);
        if (!current) {
          throw new CustomerError("not_found", "Intake was not found.");
        }
        const next: CustomerIntake = {
          ...current,
          payload: normalized,
          updatedAt: stamp,
        };
        intakes.set(existingId, next);
        return next;
      }
      const created: CustomerIntake = {
        id: randomUUID(),
        implementationId,
        payload: normalized,
        createdAt: stamp,
        updatedAt: stamp,
      };
      intakes.set(created.id, created);
      intakeByImplementation.set(implementationId, created.id);
      return created;
    },

    async findSubmissionByImplementationId(implementationId) {
      const id = submissionByImplementation.get(implementationId);
      return id ? (submissions.get(id) ?? null) : null;
    },

    async insertSubmission({ implementationId, record }) {
      if (!implementations.has(implementationId)) {
        throw new CustomerError("not_found", "Implementation was not found.");
      }
      if (submissionByImplementation.has(implementationId)) {
        throw new CustomerError("invalid_input", "This implementation was already submitted.");
      }
      const created: CustomerSubmission = {
        id: randomUUID(),
        implementationId,
        record,
        submittedAt: record.submittedAt,
      };
      submissions.set(created.id, created);
      submissionByImplementation.set(implementationId, created.id);
      return created;
    },
  };
}
