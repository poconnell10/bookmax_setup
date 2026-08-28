import type { PmsOption } from "@/types/implementation";

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
    name: "OPERA On-Premise",
    vendor: "Oracle 5.x",
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
    name: "Marriott FOSSE",
    vendor: "Marriott",
    host: "onprem",
    integration: "Brand-approved route",
    kind: "brand",
  },
  {
    id: "onq",
    name: "Hilton OnQ",
    vendor: "Hilton",
    host: "onprem",
    integration: "Brand-approved route",
    kind: "brand",
  },
  {
    id: "pep",
    name: "Hilton PEP",
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
    id: "other",
    name: "Other",
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
  { value: "es", label: "Spain · EMEA" },
  { value: "uk", label: "United Kingdom · EMEA" },
  { value: "us", label: "United States · AMER" },
  { value: "ae", label: "United Arab Emirates · MEA" },
  { value: "sg", label: "Singapore · APAC" },
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
