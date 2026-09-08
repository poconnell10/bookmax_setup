import type { ViewerKind } from "@/lib/access/viewer";

export type NavAudience = "customer" | "internal" | "admin";

export type NavItem = {
  id: string;
  label: string;
  href: string;
  audience: NavAudience;
  match?: string;
  matchAny?: readonly string[];
};

export type NavSection = {
  id: string;
  label: string;
  items: readonly NavItem[];
};

export const NAV_SECTIONS: readonly NavSection[] = [
  {
    id: "bookmax",
    label: "BookMax",
    items: [
      {
        id: "setup",
        label: "Setup",
        href: "/implementation/property",
        matchAny: [
          "/implementation/property",
          "/implementation/contacts",
          "/implementation/pms",
          "/implementation/review",
          "/setup/property",
          "/setup/connect",
          "/setup/pms",
          "/setup/review",
        ],
        audience: "customer",
      },
      {
        id: "submissions",
        label: "Submissions",
        href: "/implementation/submissions",
        match: "/implementation/submissions",
        audience: "internal",
      },
      {
        id: "users",
        label: "Users & Access",
        href: "/implementation/users",
        match: "/implementation/users",
        audience: "admin",
      },
    ],
  },
];

export function navAudienceFor(kind: ViewerKind): NavAudience[] {
  if (kind === "admin") {
    return ["internal", "admin"];
  }
  if (kind === "engineer" || kind === "viewer") {
    return ["internal"];
  }
  if (kind === "customer") {
    return ["customer"];
  }
  return [];
}

export function visibleNavItems(kind: ViewerKind) {
  const allowed = new Set(navAudienceFor(kind));
  return NAV_SECTIONS.flatMap((section) => section.items.filter((item) => allowed.has(item.audience)));
}

export const customerNavLabels = visibleNavItems("customer").map((item) => item.label);
export const engineerNavLabels = visibleNavItems("engineer").map((item) => item.label);
export const viewerNavLabels = visibleNavItems("viewer").map((item) => item.label);
export const adminNavLabels = visibleNavItems("admin").map((item) => item.label);
export const internalNavLabels = engineerNavLabels;

export function itemIsActive(item: NavItem, pathname: string): boolean {
  if (item.matchAny) {
    return item.matchAny.some((path) => pathname === path || pathname.startsWith(`${path}/`));
  }

  if (item.match) {
    return pathname === item.match || pathname.startsWith(`${item.match}/`);
  }

  return pathname === item.href;
}
