import { connectStepComplete, pmsSelectionComplete } from "@/lib/setup/intake";
import type { SetupIntakePayload } from "@/lib/setup/intake";
import type { CustomerProperty, ImplementationStatus } from "@/lib/implementation/customer/types";

export function getSetupResumePath(input: {
  status: ImplementationStatus;
  property: CustomerProperty | null;
  intake: SetupIntakePayload;
  submitted: boolean;
}): string {
  if (input.submitted || input.status === "submitted") {
    return "/setup/thanks";
  }
  if (!input.property) {
    return "/setup/property";
  }
  if (!pmsSelectionComplete(input.intake)) {
    return "/setup/pms";
  }
  if (!connectStepComplete(input.intake)) {
    return "/setup/connect";
  }
  return "/setup/review";
}

export function canReachSetupStage(
  stageId: "property" | "pms" | "connect" | "review",
  input: {
    property: CustomerProperty | null;
    intake: SetupIntakePayload;
    submitted: boolean;
  },
): boolean {
  if (input.submitted) {
    return stageId === "review";
  }
  if (stageId === "property") {
    return true;
  }
  if (!input.property) {
    return false;
  }
  if (stageId === "pms") {
    return true;
  }
  if (!pmsSelectionComplete(input.intake)) {
    return false;
  }
  if (stageId === "connect") {
    return true;
  }
  return connectStepComplete(input.intake);
}
