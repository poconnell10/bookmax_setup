import type { PmsAccessMethod, PmsOption } from "@/types/implementation";

export const PMS_CATALOGUE: readonly PmsOption[] = [
  {
    id: "operacloud",
    name: "OPERA Cloud",
    vendor: "Oracle",
    host: "cloud",
    integration: "OHIP",
    kind: "api",
  },
  {
    id: "operaonprem",
    name: "OPERA / OPERA 5",
    vendor: "Oracle",
    host: "onprem",
    integration: "OXI / interface",
    kind: "interface",
  },
  {
    id: "fspms",
    name: "Oracle FSPMS",
    vendor: "Oracle",
    host: "onprem",
    integration: "Export interface",
    kind: "interface",
  },
  {
    id: "fosse",
    name: "FOSSE",
    vendor: "Marriott",
    host: "onprem",
    integration: "Brand-approved route",
    kind: "brand",
  },
  {
    id: "onq",
    name: "OnQ",
    vendor: "Hilton",
    host: "onprem",
    integration: "Brand-approved route",
    kind: "brand",
  },
  {
    id: "pep",
    name: "PEP",
    vendor: "Hilton",
    host: "cloud",
    integration: "Brand-approved route",
    kind: "brand",
  },
  {
    id: "shiji",
    name: "Shiji",
    vendor: "Shiji Group",
    host: "cloud",
    integration: "Shiji API",
    kind: "api",
  },
  {
    id: "protel",
    name: "Protel",
    vendor: "Protel",
    host: "hybrid",
    integration: "Protel I/O",
    kind: "api",
  },
  {
    id: "mews",
    name: "Mews",
    vendor: "Mews",
    host: "cloud",
    integration: "Mews Connector",
    kind: "api",
  },
  {
    id: "agilysys",
    name: "Agilysys",
    vendor: "Agilysys",
    host: "hybrid",
    integration: "Agilysys API",
    kind: "api",
  },
  {
    id: "oraclehosp",
    name: "Oracle Hospitality",
    vendor: "Oracle",
    host: "cloud",
    integration: "OHIP",
    kind: "api",
  },
  {
    id: "stayntouch",
    name: "StayNTouch",
    vendor: "StayNTouch",
    host: "cloud",
    integration: "StayNTouch API",
    kind: "api",
  },
  {
    id: "other",
    name: "Other / Not listed",
    vendor: "Not listed",
    host: "",
    integration: "To be determined",
    kind: "unknown",
  },
];

export const HOSTING_OPTIONS = [
  {
    id: "cloud" as const,
    name: "Cloud",
    description: "Your PMS vendor hosts it. You sign in over the internet.",
  },
  {
    id: "onprem" as const,
    name: "On-premise",
    description: "Installed on servers at the property or in your own data centre.",
  },
  {
    id: "hybrid" as const,
    name: "Hybrid",
    description:
      "Some components hosted by the vendor, some on your own infrastructure.",
  },
  {
    id: "unsure" as const,
    name: "Unsure",
    description: "That is fine — we will confirm it with your technical contact.",
  },
];

export const COUNTRY_OPTIONS = [
  { value: "es", label: "Spain" },
  { value: "uk", label: "United Kingdom" },
  { value: "ie", label: "Ireland" },
  { value: "fr", label: "France" },
  { value: "de", label: "Germany" },
  { value: "it", label: "Italy" },
  { value: "pt", label: "Portugal" },
  { value: "us", label: "United States" },
  { value: "ae", label: "United Arab Emirates" },
  { value: "sg", label: "Singapore" },
  { value: "other", label: "Other" },
];

export const PMS_ACCESS_OPTIONS: Array<{
  value: Exclude<PmsAccessMethod, "">;
  label: string;
  hint?: string;
}> = [
  { value: "interface", label: "Existing interface / integration" },
  { value: "sftp", label: "SFTP or file transfer" },
  { value: "api", label: "API" },
  { value: "onprem", label: "On-premise system" },
  { value: "unsure", label: "I'm not sure", hint: "That's fine — we'll work this out with your PMS access contact." },
];

export const AUTH_METHOD_OPTIONS = [
  "Client credentials / OCIM",
  "SSD / resource owner",
  "Not sure",
];

export const ENVIRONMENT_OPTIONS = [
  {
    value: "uat" as const,
    label: "Test / UAT",
    description: "Your test system. Nothing we do there touches live reservations.",
  },
  {
    value: "prod" as const,
    label: "Live / Production",
    description: "Your live system. We only read from it — nothing is changed.",
  },
];

export function findPms(id: string | null): PmsOption | undefined {
  return PMS_CATALOGUE.find((item) => item.id === id);
}
