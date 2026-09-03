import type { SetupIntakePayload, SetupSubmissionRecord } from "@/lib/setup/intake";
import type {
  CustomerImplementation,
  CustomerIntake,
  CustomerProperty,
  CustomerSubmission,
  ImplementationMembership,
  PropertyInput,
} from "@/lib/implementation/customer/types";

export type CustomerStore = {
  findMembershipByUserId(userId: string): Promise<ImplementationMembership | null>;
  findImplementationById(id: string): Promise<CustomerImplementation | null>;
  findPropertyByImplementationId(implementationId: string): Promise<CustomerProperty | null>;
  findPropertyById(id: string): Promise<CustomerProperty | null>;
  insertImplementation(): Promise<CustomerImplementation>;
  insertMembership(input: {
    implementationId: string;
    userId: string;
  }): Promise<ImplementationMembership>;
  updateImplementationStatus(
    id: string,
    status: CustomerImplementation["status"],
  ): Promise<CustomerImplementation>;
  upsertProperty(implementationId: string, input: PropertyInput): Promise<CustomerProperty>;
  findIntakeByImplementationId(implementationId: string): Promise<CustomerIntake | null>;
  upsertIntake(implementationId: string, payload: SetupIntakePayload): Promise<CustomerIntake>;
  findSubmissionByImplementationId(implementationId: string): Promise<CustomerSubmission | null>;
  insertSubmission(input: {
    implementationId: string;
    record: SetupSubmissionRecord;
  }): Promise<CustomerSubmission>;
};
