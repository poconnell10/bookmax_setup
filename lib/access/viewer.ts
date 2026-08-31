export type ViewerKind = "customer" | "internal";

/** Prototype default. Replace with Supabase Auth / roles. */
export const PROTOTYPE_VIEWER_KIND: ViewerKind = "internal";

export function canSeeInternalNav(kind: ViewerKind = PROTOTYPE_VIEWER_KIND): boolean {
  return kind === "internal";
}
