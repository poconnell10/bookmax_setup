export type ViewerKind = "customer" | "admin" | "engineer" | "viewer" | "pending" | "disabled";

export function canSeeInternalNav(kind: ViewerKind): boolean {
  return kind === "admin" || kind === "engineer" || kind === "viewer";
}

export function canSeeUsersNav(kind: ViewerKind): boolean {
  return kind === "admin";
}

export function canSeeCustomerNav(kind: ViewerKind): boolean {
  return kind === "customer";
}
