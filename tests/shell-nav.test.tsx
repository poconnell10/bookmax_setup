import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Sidebar } from "@/components/layout/Sidebar";
import { LoginScreen } from "@/components/account/LoginScreen";
import { ActivateScreen } from "@/components/account/ActivateScreen";
import { customerNavLabels, internalNavLabels } from "@/lib/navigation";

describe("BookMax sidebar", () => {
  it("shows BookMax navigation without Traqra items or website account links", () => {
    render(<Sidebar viewerKind="internal" />);

    expect(screen.getByRole("navigation", { name: "BookMax" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Setup" })).toHaveAttribute(
      "href",
      "/implementation/property",
    );
    expect(screen.getByRole("link", { name: "Submissions" })).toHaveAttribute(
      "href",
      "/implementation/submissions",
    );
    expect(screen.queryByRole("link", { name: "Sign up / Activate" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Log in" })).not.toBeInTheDocument();
    expect(screen.queryByText("Thank You")).not.toBeInTheDocument();
    expect(screen.queryByText(/traqra/i)).not.toBeInTheDocument();
    expect(screen.queryByText("Dashboard")).not.toBeInTheDocument();
    expect(screen.queryByText("GoLive Gates")).not.toBeInTheDocument();
    expect(screen.queryByText("Data Airlock")).not.toBeInTheDocument();
    expect(screen.queryByText("Reporting")).not.toBeInTheDocument();
    expect(screen.queryByText(/discovery/i)).not.toBeInTheDocument();
  });

  it("keeps customer and internal navigation distinct", () => {
    expect(customerNavLabels).toEqual(["Setup"]);
    expect(internalNavLabels).toEqual(["Setup", "Submissions"]);
  });

  it("hides the internal submissions link from customers", () => {
    render(<Sidebar viewerKind="customer" />);
    expect(screen.getByRole("link", { name: "Setup" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Submissions" })).not.toBeInTheDocument();
  });
});

describe("account screens", () => {
  it("keeps the existing BookMax website login screen", () => {
    render(<LoginScreen />);

    expect(screen.getByRole("heading", { name: "Welcome back" })).toBeInTheDocument();
    expect(screen.getByLabelText("Work email")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continue with Microsoft" })).toBeInTheDocument();
  });

  it("keeps the existing activation screen", () => {
    render(<ActivateScreen />);

    expect(screen.getByRole("heading", { name: "Activate your account" })).toBeInTheDocument();
    expect(screen.getByLabelText("Work email")).toBeInTheDocument();
  });
});
