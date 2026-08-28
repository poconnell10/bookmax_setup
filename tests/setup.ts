import { createElement, type AnchorHTMLAttributes, type ReactNode } from "react";
import { cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { usePathname } from "next/navigation";
import { afterEach, vi } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("next/navigation", () => ({
  usePathname: vi.fn(() => "/implementation/property"),
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement> & {
    href: string;
    children: ReactNode;
  }) => createElement("a", { href, ...props }, children),
}));

afterEach(() => {
  if (typeof document !== "undefined") {
    cleanup();
  }
  vi.mocked(usePathname).mockReturnValue("/implementation/property");
});
