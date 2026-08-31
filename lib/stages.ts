import type { ImplementationStage } from "@/types/implementation";

export const IMPLEMENTATION_STAGES: readonly ImplementationStage[] = [
  {
    id: "property",
    label: "Property",
    href: "/implementation/property",
    subtitle: "Your hotel",
  },
  {
    id: "contacts",
    label: "Contacts",
    href: "/implementation/contacts",
    subtitle: "Who we work with",
  },
  {
    id: "pms",
    label: "PMS",
    href: "/implementation/pms",
    subtitle: "Your system",
  },
  {
    id: "review",
    label: "Review",
    href: "/implementation/review",
    subtitle: "Check and send",
  },
];

export function isSetupStagePath(pathname: string): boolean {
  return IMPLEMENTATION_STAGES.some((stage) => stage.href === pathname);
}

export function getStage(id: ImplementationStage["id"]): ImplementationStage {
  const stage = IMPLEMENTATION_STAGES.find((item) => item.id === id);

  if (!stage) {
    throw new Error(`Unknown implementation stage: ${id}`);
  }

  return stage;
}
