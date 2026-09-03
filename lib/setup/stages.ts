export type SetupStageId = "access" | "property" | "pms" | "connect" | "review";

export type SetupStage = {
  id: SetupStageId;
  label: string;
  href: string;
  subtitle: string;
};

export const SETUP_STAGES: readonly SetupStage[] = [
  { id: "access", label: "Access", href: "/access", subtitle: "Email and verification code" },
  { id: "property", label: "Property", href: "/setup/property", subtitle: "Your hotel and contacts" },
  { id: "pms", label: "PMS", href: "/setup/pms", subtitle: "Which system you run" },
  { id: "connect", label: "Access", href: "/setup/connect", subtitle: "How we access it" },
  { id: "review", label: "Review", href: "/setup/review", subtitle: "Check and submit" },
];

export function setupStageIndex(pathname: string): number {
  return SETUP_STAGES.findIndex((stage) => pathname === stage.href || pathname.startsWith(`${stage.href}/`));
}

export function isSetupFlowPath(pathname: string): boolean {
  return SETUP_STAGES.some((stage) => stage.id !== "access" && (pathname === stage.href || pathname.startsWith(`${stage.href}/`)));
}
