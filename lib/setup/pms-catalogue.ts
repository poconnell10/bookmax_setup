export type SetupPmsId =
  | "operacloud"
  | "shiji"
  | "inforhms"
  | "pep"
  | "agilysyscloud"
  | "mews"
  | "cloudbeds"
  | "stayntouch"
  | "lightspeedcloud"
  | "webrezpro"
  | "roomraccoon"
  | "hotelogix"
  | "clockpms"
  | "rmscloud"
  | "amadeushms"
  | "littlehotelier"
  | "opera5"
  | "fosse"
  | "onq"
  | "smshost"
  | "fspms"
  | "galaxy"
  | "agilysysonprem"
  | "maestro"
  | "roomkey"
  | "rdp"
  | "roommaster"
  | "autoclerk"
  | "other";

export type SetupPmsHost = "cloud" | "onprem" | "hybrid" | null;

export type SetupPmsKind = "cloud" | "onprem" | "brand" | "other";

export type SetupPmsOption = {
  id: SetupPmsId;
  label: string;
  vendor: string;
  host: SetupPmsHost;
  kind: SetupPmsKind;
  short?: string;
  tail?: string;
  cred?: string;
};

/** Approved BookMax Setup v3-2 catalogue. Labels must match the HTML exactly. */
export const SETUP_PMS_OPTIONS: SetupPmsOption[] = [
  { id: "operacloud", label: "OPERA Cloud", vendor: "Oracle", host: "cloud", kind: "cloud", cred: "OHIP", tail: "your API credentials or integration key" },
  { id: "shiji", label: "Shiji (SEP / Daylight)", vendor: "Shiji", host: "cloud", kind: "cloud", tail: "your API credentials" },
  { id: "inforhms", label: "Infor HMS", vendor: "Infor", host: "cloud", kind: "cloud", tail: "your API credentials" },
  { id: "pep", label: "Hilton PEP", vendor: "Hilton", host: "cloud", kind: "cloud", tail: "your cloud API credentials" },
  { id: "agilysyscloud", label: "Agilysys Cloud / Stay", vendor: "Agilysys", host: "cloud", kind: "cloud", short: "Agilysys Cloud", tail: "your API credentials" },
  { id: "mews", label: "Mews", vendor: "Mews", host: "cloud", kind: "cloud", tail: "your API integration token" },
  { id: "cloudbeds", label: "Cloudbeds", vendor: "Cloudbeds", host: "cloud", kind: "cloud", tail: "your API credentials" },
  { id: "stayntouch", label: "Stayntouch", vendor: "Shiji", host: "cloud", kind: "cloud", tail: "your API credentials" },
  { id: "lightspeedcloud", label: "Lightspeed (Cloud)", vendor: "Lightspeed", host: "cloud", kind: "cloud", short: "Lightspeed", tail: "your API credentials" },
  { id: "webrezpro", label: "WebRezPro", vendor: "World Web", host: "cloud", kind: "cloud", tail: "your API credentials" },
  { id: "roomraccoon", label: "RoomRaccoon", vendor: "RoomRaccoon", host: "cloud", kind: "cloud", tail: "your API credentials" },
  { id: "hotelogix", label: "Hotelogix", vendor: "Hotelogix", host: "cloud", kind: "cloud", tail: "your API credentials" },
  { id: "clockpms", label: "Clock PMS+", vendor: "Clock", host: "cloud", kind: "cloud", tail: "your API credentials" },
  { id: "rmscloud", label: "RMS Cloud", vendor: "RMS", host: "cloud", kind: "cloud", tail: "your API credentials" },
  { id: "amadeushms", label: "Amadeus HMS", vendor: "Amadeus", host: "cloud", kind: "cloud", tail: "your API credentials" },
  { id: "littlehotelier", label: "Little Hotelier", vendor: "SiteMinder", host: "cloud", kind: "cloud", tail: "your API credentials" },
  { id: "opera5", label: "OPERA 5 / On-Premise", vendor: "Oracle", host: "onprem", kind: "onprem", short: "OPERA 5", tail: "to configure your local interface server" },
  { id: "fosse", label: "FOSSE", vendor: "Marriott", host: "onprem", kind: "onprem", tail: "to configure your local serial/IP interface" },
  { id: "onq", label: "OnQ", vendor: "Hilton", host: "onprem", kind: "onprem", tail: "to configure your property interface connection" },
  { id: "smshost", label: "SMSHost", vendor: "Springer-Miller", host: "onprem", kind: "onprem", tail: "to configure your local interface server" },
  { id: "fspms", label: "FSPMS", vendor: "Oracle", host: "onprem", kind: "onprem", tail: "to configure your local network interface" },
  { id: "galaxy", label: "Galaxy / Lightspeed", vendor: "Galaxy", host: "onprem", kind: "onprem", short: "Galaxy Lightspeed", tail: "to configure your local interface server" },
  { id: "agilysysonprem", label: "Agilysys (On-Premise)", vendor: "Agilysys", host: "onprem", kind: "onprem", short: "Agilysys", tail: "to configure your local interface server" },
  { id: "maestro", label: "Maestro PMS", vendor: "Northwind", host: "onprem", kind: "onprem", tail: "to configure your local interface server" },
  { id: "roomkey", label: "RoomKeyPMS", vendor: "RoomKey", host: "onprem", kind: "onprem", tail: "to configure your local interface server" },
  { id: "rdp", label: "ResortData Processing (RDP)", vendor: "RDP", host: "onprem", kind: "onprem", short: "RDP", tail: "to configure your local interface server" },
  { id: "roommaster", label: "roommaster", vendor: "InnQuest", host: "onprem", kind: "onprem", tail: "to configure your local interface server" },
  { id: "autoclerk", label: "AutoClerk", vendor: "AutoClerk", host: "onprem", kind: "onprem", tail: "to configure your local interface server" },
  { id: "other", label: "Other / not listed", vendor: "", host: null, kind: "other", tail: "" },
];

const LEGACY_PMS_IDS: Record<string, SetupPmsId> = {
  opera_cloud: "operacloud",
  opera_onprem: "opera5",
  operaonprem: "opera5",
  hilton_onq: "onq",
  marriott_fosse: "fosse",
  opera_unknown: "other",
  unknown: "other",
  oraclehosp: "other",
  protel: "other",
  agilysys: "agilysyscloud",
};

export function findSetupPms(id: string | null | undefined): SetupPmsOption | undefined {
  if (!id) {
    return undefined;
  }
  const mapped = LEGACY_PMS_IDS[id] ?? id;
  return SETUP_PMS_OPTIONS.find((item) => item.id === mapped);
}

export function isSetupCloudPms(id: string | null | undefined): boolean {
  return findSetupPms(id)?.kind === "cloud";
}

export function isSetupBrandPms(id: string | null | undefined): boolean {
  return findSetupPms(id)?.kind === "brand";
}

export function isSetupOnPremPms(id: string | null | undefined): boolean {
  return findSetupPms(id)?.kind === "onprem";
}

export function isSetupOtherPms(id: string | null | undefined): boolean {
  return findSetupPms(id)?.kind === "other";
}

export function isSetupOhipPms(id: string | null | undefined): boolean {
  return id === "operacloud" || id === "opera_cloud";
}

export function nextMsg(option: SetupPmsOption | undefined): string {
  if (!option?.host || !option.tail) {
    return "";
  }
  const name = option.short || option.label;
  return option.host === "cloud"
    ? `${name} is cloud-hosted. Up next, you’ll need ${option.tail}.`
    : `${name} runs locally on property. Up next, you’ll need ${option.tail}.`;
}

export function hostingCopy(option: SetupPmsOption): string {
  return nextMsg(option);
}

export function hostLabel(option: SetupPmsOption | undefined): string {
  if (!option?.host) {
    return "To be confirmed";
  }
  if (option.host === "cloud") {
    return "Cloud";
  }
  if (option.host === "onprem") {
    return "On-premise";
  }
  return "Hybrid";
}
