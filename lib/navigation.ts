export type NavAudience = "all" | "internal";

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
        ],
        audience: "all",
      },
      {
        id: "submissions",
        label: "Submissions",
        href: "/implementation/submissions",
        match: "/implementation/submissions",
        audience: "internal",
      },
    ],
  },
];

export function visibleNavItems(includeInternal: boolean) {
  return NAV_SECTIONS.flatMap((section) =>
    section.items.filter((item) => item.audience === "all" || includeInternal),
  );
}

export const customerNavLabels = visibleNavItems(false).map((item) => item.label);
export const internalNavLabels = visibleNavItems(true).map((item) => item.label);

export function itemIsActive(item: NavItem, pathname: string): boolean {
  if (item.matchAny) {
    return item.matchAny.some((path) => pathname === path || pathname.startsWith(`${path}/`));
  }

  if (item.match) {
    return pathname === item.match || pathname.startsWith(`${item.match}/`);
  }

  return pathname === item.href;
}
