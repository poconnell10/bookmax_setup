import type { SetupIntakePayload, SetupSubmissionRecord } from "@/lib/setup/intake";

export const IMPLEMENTATION_STATUSES = ["started", "property_complete", "submitted"] as const;

export type ImplementationStatus = (typeof IMPLEMENTATION_STATUSES)[number];

export type CustomerImplementation = {
  id: string;
  status: ImplementationStatus;
  createdAt: string;
  updatedAt: string;
};

export type ImplementationMembership = {
  id: string;
  implementationId: string;
  userId: string;
  role: "customer";
  createdAt: string;
};

export type CustomerProperty = {
  id: string;
  implementationId: string;
  name: string;
  city: string | null;
  country: string | null;
  hotelBrand: string | null;
  contactName: string;
  jobTitle: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PropertyInput = {
  name: string;
  city?: string | null;
  country?: string | null;
  hotelBrand?: string | null;
  contactName: string;
  jobTitle?: string | null;
};

export type PropertyPeopleInput = {
  sameAsPrimaryContact: boolean;
  technicalContactName?: string;
  technicalContactEmail?: string;
  technicalContactMobile?: string;
};

export type CustomerIntake = {
  id: string;
  implementationId: string;
  payload: SetupIntakePayload;
  createdAt: string;
  updatedAt: string;
};

export type CustomerSubmission = {
  id: string;
  implementationId: string;
  record: SetupSubmissionRecord;
  submittedAt: string;
};

export type CustomerSetupContext = {
  implementation: CustomerImplementation;
  property: CustomerProperty | null;
  intake: CustomerIntake | null;
  submission: CustomerSubmission | null;
  created: boolean;
};

export class CustomerError extends Error {
  readonly code: "forbidden" | "not_found" | "invalid_input" | "unavailable";

  constructor(
    code: "forbidden" | "not_found" | "invalid_input" | "unavailable",
    message: string,
  ) {
    super(message);
    this.name = "CustomerError";
    this.code = code;
  }
}
