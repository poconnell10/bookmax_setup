import { createElement, type AnchorHTMLAttributes, type ReactNode } from "react";
import { cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { usePathname } from "next/navigation";
import { afterEach, vi } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("next/navigation", () => ({
  usePathname: vi.fn(() => "/implementation/property"),
  useRouter: vi.fn(() => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  })),
  useSearchParams: vi.fn(() => new URLSearchParams()),
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
  if (typeof window !== "undefined") {
    window.sessionStorage.clear();
    window.localStorage.clear();
  }
  vi.mocked(usePathname).mockReturnValue("/implementation/property");
});
