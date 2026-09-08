export const ACCESS_AUDIT_EVENTS = [
  "USER_PROVISIONED",
  "ROLE_CHANGED",
  "ACCESS_DISABLED",
  "ACCESS_REACTIVATED",
  "CUSTOMER_ASSIGNMENT_CHANGED",
] as const;

export type AccessAuditEventType = (typeof ACCESS_AUDIT_EVENTS)[number];

export type AccessAccountType = "customer" | "internal" | "unassigned";

export type AccessUserStatus = "pending" | "active" | "disabled";

export type AccessUserView = {
  userId: string;
  email: string;
  emailMasked: string;
  name: string | null;
  accountType: AccessAccountType;
  role: "admin" | "engineer" | "viewer" | "customer" | null;
  status: AccessUserStatus;
  lastSignInAt: string | null;
  firstSignInAt: string | null;
  implementationId: string | null;
  implementationName: string | null;
  provisionedBy: string | null;
};

export type AccessIdentity = {
  userId: string;
  email: string;
  lastSignInAt: string | null;
  createdAt: string;
};

export type ImplementationOption = {
  id: string;
  name: string;
};

export type AccessAuditView = {
  id: string;
  eventType: AccessAuditEventType;
  createdAt: string;
};
