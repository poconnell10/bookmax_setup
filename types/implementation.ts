export type StageId = "property" | "connect" | "summary";

export type ImplementationStage = {
  id: StageId;
  label: string;
  href: `/${string}`;
  subtitle: string;
};

export type HostingKind = "cloud" | "onprem" | "hybrid" | "unsure";

export type PmsKind = "api" | "interface" | "brand" | "unknown";

export type PmsOption = {
  id: string;
  name: string;
  vendor: string;
  host: HostingKind | "";
  integration: string;
  kind: PmsKind;
};

export type ConnectionMethod = "api" | "sftp" | "unsure";

export type AvailabilityAnswer = "Yes" | "No" | "Not sure" | "";

export type CredentialStatus = "not_received" | "received";

export type ConnectionDetailsStatus = "not_started" | "in_progress" | "complete";

export type CredentialLabel = "API Credentials" | "SFTP Credentials" | "Access Credentials";

export type IntakeState = {
  organisation: string;
  contactName: string;
  contactEmail: string;
  country: string;
  properties: string[];
  technicalContact: string;
  technicalContactEmail: string;
  pmsId: string | null;
  otherPmsName: string;
  hosting: HostingKind | "";
  pmsVersion: string;
  technicalContactMobile: string;
  connectionMethod: ConnectionMethod | null;
  apiUrl: string;
  apiCredentialsAvailable: AvailabilityAnswer;
  transferDetailsAvailable: AvailabilityAnswer;
  sftpHost: string;
  environment: "" | "uat" | "prod";
  enterpriseId: string;
  hotelId: string;
  gatewayUrl: string;
  authMethod: string;
  oauthScope: string;
  chainCode: string;
  ohipAdmin: string;
  ohipAdminEmail: string;
  propertyCode: string;
  pmsAdmin: string;
  brandSponsor: string;
  connectionDetailsStatus: ConnectionDetailsStatus;
  credentialsStatus: CredentialStatus;
  submitted: boolean;
  submittedAt: string | null;
  submittedBy: string | null;
  submissionId: string | null;
  draftId: string | null;
  status: "draft" | "submitted";
};

export type SubmissionRecord = {
  submission_id: string;
  organisation: string;
  properties: string[];
  pms: string;
  pms_version: string;
  pms_type: string;
  technical_contact: string;
  technical_contact_email: string;
  technical_contact_mobile: string;
  connection_method: string;
  connection_details: Record<string, string>;
  connection_details_status: ConnectionDetailsStatus;
  credentials_status: CredentialStatus;
  submitted_at: string;
  submitted_by: string;
  status: "submitted";
  created_at: string;
  updated_at: string;
};
