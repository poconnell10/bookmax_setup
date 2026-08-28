import type { ImplementationStage } from "@/types/implementation";

export const IMPLEMENTATION_STAGES: readonly ImplementationStage[] = [
  {
    id: "property",
    label: "Property & PMS",
    href: "/implementation/property",
    subtitle: "Property details",
  },
  {
    id: "connect",
    label: "Connect PMS",
    href: "/implementation/connect",
    subtitle: "Connection details",
  },
  {
    id: "summary",
    label: "Summary",
    href: "/implementation/summary",
    subtitle: "Review & submit",
  },
];

export function getStage(id: ImplementationStage["id"]): ImplementationStage {
  const stage = IMPLEMENTATION_STAGES.find((item) => item.id === id);

  if (!stage) {
    throw new Error(`Unknown implementation stage: ${id}`);
  }

  return stage;
}
