export type ViewerKind = "customer" | "internal";

export function canSeeInternalNav(kind: ViewerKind): boolean {
  return kind === "internal";
}
