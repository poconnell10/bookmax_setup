import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useRouter } from "next/navigation";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ConnectSetupScreen } from "@/components/setup/ConnectSetupScreen";
import { PmsSetupScreen } from "@/components/setup/PmsSetupScreen";
import { ReviewSetupScreen } from "@/components/setup/ReviewSetupScreen";
import { ThanksSetupScreen } from "@/components/setup/ThanksSetupScreen";

const { signOut } = vi.hoisted(() => ({
  signOut: vi.fn(async () => ({ error: null })),
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: { signOut },
  }),
}));

const context = {
  ok: true,
  email: "jane@hotel.com",
  property: {
    id: "prop-1",
    name: "The Gritti Palace",
    hotelBrand: "Marriott Luxury Collection",
    contactName: "Patrick Smith",
  },
  intake: {
    pmsId: null,
    otherPmsName: "",
    sameAsPrimaryContact: true,
    technicalContactName: "Patrick Smith",
    technicalContactEmail: "",
  },
  submission: null,
};

function mockSetupFetch(options?: {
  pmsId?: string | null;
  extraIntake?: Record<string, unknown>;
  credentialsReceived?: boolean;
  postCredentials?: (body: Record<string, unknown>) => Response;
  intakeResponse?: Response;
}) {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.includes("/api/setup/credentials/status")) {
      return Response.json({
        ok: true,
        credentialsReceived: options?.credentialsReceived === true,
        receivedAt: options?.credentialsReceived ? "2026-09-03T12:00:00.000Z" : null,
      });
    }
    if (url.includes("/api/setup/credentials") && init?.method === "POST") {
      const body = JSON.parse(String(init.body)) as Record<string, unknown>;
      if (options?.postCredentials) {
        return options.postCredentials(body);
      }
      return Response.json({ ok: true, credentialsReceived: true });
    }
    if (url.includes("/api/setup/intake") && init?.method === "POST") {
      return options?.intakeResponse ?? Response.json({ ok: true });
    }
    return Response.json({
      ...context,
      intake: {
        ...context.intake,
        pmsId: options?.pmsId ?? context.intake.pmsId,
        ...options?.extraIntake,
      },
    });
  });
}

describe("M2 setup screens", () => {
  const push = vi.fn();
  const replace = vi.fn();

  beforeEach(() => {
    push.mockReset();
    replace.mockReset();
    signOut.mockClear();
    vi.mocked(useRouter).mockReturnValue({
      push,
      replace,
      prefetch: vi.fn(),
    } as never);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("PMS-UI-001 — renders v3-2 heading, grouped catalogue, search, and Other", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json(context)));
    render(<PmsSetupScreen />);
    await screen.findByRole("heading", { name: "Which system runs your front desk?" });
    expect(
      screen.getByText(/Your Property Management System — the software your team uses/),
    ).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Start typing to narrow the list")).toBeInTheDocument();
    expect(screen.getByText("Cloud")).toBeInTheDocument();
    expect(screen.getByText("On-premise")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /OPERA Cloud/ })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /OPERA 5 \/ On-Premise/ })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /Other \/ not listed/ })).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText("Start typing to narrow the list"), {
      target: { value: "Oracle" },
    });
    expect(screen.getByRole("radio", { name: /OPERA Cloud/ })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /Other \/ not listed/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: /Other \/ not listed/ }));
    expect(screen.getByLabelText(/What is it called/i)).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText("Start typing to narrow the list"), {
      target: { value: "zzzz-no-match" },
    });
    expect(screen.getByText(/Nothing matches/)).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /Other \/ not listed/ })).toBeInTheDocument();
    expect(screen.queryByRole("radio", { name: /OPERA Cloud/ })).not.toBeInTheDocument();
  });

  it("PMS-UI-002 — OPERA Cloud hosting echo then continues to access", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        if (String(input).includes("/api/setup/intake") && init?.method === "POST") {
          return Response.json({ ok: true });
        }
        return Response.json(context);
      }),
    );
    render(<PmsSetupScreen />);
    await screen.findByRole("heading", { name: "Which system runs your front desk?" });
    fireEvent.click(screen.getByRole("radio", { name: /OPERA Cloud/ }));
    expect(
      screen.getByText(
        "OPERA Cloud is cloud-hosted. Up next, you’ll need your API credentials or integration key.",
      ),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    await waitFor(() => {
      expect(push).toHaveBeenCalledWith("/setup/connect");
    });
  });

  it("PMS-UI-003 — Other custom name persists and continues to access", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        if (String(input).includes("/api/setup/intake") && init?.method === "POST") {
          const body = JSON.parse(String(init.body)) as { pmsId?: string; otherPmsName?: string };
          expect(body.pmsId).toBe("other");
          expect(body.otherPmsName).toBe("HotelKey");
          return Response.json({ ok: true });
        }
        return Response.json(context);
      }),
    );
    render(<PmsSetupScreen />);
    await screen.findByRole("heading", { name: "Which system runs your front desk?" });
    fireEvent.click(screen.getByRole("radio", { name: /Other \/ not listed/ }));
    fireEvent.change(screen.getByLabelText(/What is it called/i), { target: { value: "HotelKey" } });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    await waitFor(() => {
      expect(push).toHaveBeenCalledWith("/setup/connect");
    });
  });

  it("ACCESS-UI-001 — OPERA 5 allows I'm not sure and has no secret fields", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          ...context,
          intake: { ...context.intake, pmsId: "opera5" },
        }),
      ),
    );
    render(<ConnectSetupScreen />);
    await screen.findByRole("heading", { name: "Connecting to OPERA 5 / On-Premise" });
    expect(screen.getByText("I'm not sure")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /I'm not sure/i }));
    expect(screen.queryByLabelText(/client secret/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/password/i)).not.toBeInTheDocument();
    expect(screen.getByText("Who manages PMS access?")).toBeInTheDocument();
    expect(screen.queryByText(/Submit securely/)).not.toBeInTheDocument();
    expect(screen.queryByText(/I already have our/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Change" })).toBeInTheDocument();
  });

  it("ACCESS-UI-002 — OPERA Cloud shows OHIP, honors nextMsg, and optional collapsed credential disclosure", async () => {
    vi.stubGlobal("fetch", mockSetupFetch({ pmsId: "operacloud" }));
    render(<ConnectSetupScreen />);
    await screen.findByRole("heading", { name: "Connecting to OPERA Cloud" });
    expect(
      screen.getByText(
        "OPERA Cloud is cloud-hosted. Up next, you’ll need your API credentials or integration key.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/Hotel ID \/ property code/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/OHIP enterprise ID/i)).toBeInTheDocument();
    expect(screen.queryByText("I'm not sure")).not.toBeInTheDocument();
    expect(screen.getByText("Who manages PMS access?")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /I already have our OHIP credentials to hand/ }),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText(/client id/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/client secret/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Submit securely/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Credentials received/)).not.toBeInTheDocument();
  });

  it("ACCESS-UI-003 — API and SFTP optional fields stay available for on-prem", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          ...context,
          intake: { ...context.intake, pmsId: "opera5" },
        }),
      ),
    );
    render(<ConnectSetupScreen />);
    await screen.findByRole("heading", { name: "Connecting to OPERA 5 / On-Premise" });
    fireEvent.click(screen.getByRole("button", { name: /API/ }));
    expect(screen.getByLabelText(/API or integration address/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /SFTP or file transfer/i }));
    expect(screen.getByLabelText(/SFTP host or server/i)).toBeInTheDocument();
  });

  it("REVIEW-UI-001 — shows PROPERTY PEOPLE PMS ACCESS, CTA, and no secrets", async () => {
    vi.stubGlobal(
      "fetch",
      mockSetupFetch({
        pmsId: "operacloud",
        extraIntake: { hotelId: "GRITTI", enterpriseId: "" },
      }),
    );
    render(<ReviewSetupScreen />);
    await screen.findByRole("heading", { name: "Ready to start" });
    expect(screen.getByText("People")).toBeInTheDocument();
    expect(screen.getByText("PMS")).toBeInTheDocument();
    expect(screen.getByText("Access")).toBeInTheDocument();
    expect(screen.getAllByText("Property").length).toBeGreaterThan(0);
    expect(screen.getByText(/· and PMS access/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Change property details" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Change contact details" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Change your PMS" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Change access details" })).toBeInTheDocument();
    expect(
      screen.getByText(/Submitting sends this to our implementation team/),
    ).toBeInTheDocument();
    expect(screen.queryByText("City")).not.toBeInTheDocument();
    expect(screen.queryByText("Country")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start BookMax implementation" })).toBeInTheDocument();
    expect(screen.queryByText(/client secret/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/^Received$/)).not.toBeInTheDocument();
    expect(screen.getByText("We'll request these securely")).toBeInTheDocument();
    expect(screen.queryByText("Received securely")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Change property details" }));
    expect(push).toHaveBeenCalledWith("/setup/property");
  });

  it("THANKS-UI-001 — submitted state uses You're all set copy", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          ...context,
          submission: { id: "sub-1" },
          intake: { ...context.intake, pmsId: "mews", sameAsPrimaryContact: true },
        }),
      ),
    );
    render(<ThanksSetupScreen />);
    await screen.findByRole("heading", { name: "You're all set." });
    expect(
      screen.getByText(/Thank you for completing the initial setup details for/),
    ).toBeInTheDocument();
    expect(screen.getAllByText("The Gritti Palace").length).toBe(2);
    expect(
      screen.getByText(/moving into the execution phase of your/),
    ).toBeInTheDocument();
    expect(screen.getByText("Connection & Systems Testing")).toBeInTheDocument();
    expect(
      screen.getByText(
        /We'll validate the connection and integration configuration to ensure data is flowing correctly/,
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("PMS Access & Deployment")).toBeInTheDocument();
    expect(
      screen.getByText("No further action is required from you at this time."),
    ).toBeInTheDocument();
    expect(screen.getByText("Patrick Smith")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Exit" })).toBeInTheDocument();
    const source = readFileSync(join(process.cwd(), "components/setup/ThanksSetupScreen.tsx"), "utf8");
    expect(source).not.toContain("The Gritti Palace");
    expect(source).not.toContain("Tom Hardy");
    expect(source).not.toContain("your property");
    expect(source).not.toContain("your PMS contact");
  });

  it("THANKS-UI-003 — technical contact and property names come from implementation data", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          ...context,
          submission: { id: "sub-1" },
          property: { ...context.property, name: "The Gritti Palace" },
          intake: {
            ...context.intake,
            pmsId: "mews",
            sameAsPrimaryContact: false,
            technicalContactName: "Tom Hardy",
          },
        }),
      ),
    );
    render(<ThanksSetupScreen />);
    await screen.findByRole("heading", { name: "You're all set." });
    expect(screen.getAllByText("The Gritti Palace").length).toBeGreaterThan(0);
    expect(screen.getByText("Tom Hardy")).toBeInTheDocument();
    expect(screen.queryByText("Patrick Smith")).not.toBeInTheDocument();
  });

  it("THANKS-UI-004 — Exit signs out through the existing client and returns to /access", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          ...context,
          submission: { id: "sub-1" },
          intake: { ...context.intake, pmsId: "mews", sameAsPrimaryContact: true },
        }),
      ),
    );
    render(<ThanksSetupScreen />);
    await screen.findByRole("button", { name: "Exit" });
    fireEvent.click(screen.getByRole("button", { name: "Exit" }));
    await waitFor(() => {
      expect(signOut).toHaveBeenCalledTimes(1);
      expect(replace).toHaveBeenCalledWith("/access");
    });
  });

  it("THANKS-UI-002 — missing submission does not render You're all set", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          ...context,
          submission: null,
          resumePath: "/setup/review",
        }),
      ),
    );
    render(<ThanksSetupScreen />);
    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith("/setup/review");
    });
    expect(screen.queryByRole("heading", { name: "You're all set." })).not.toBeInTheDocument();
    expect(screen.getByText("Loading…")).toBeInTheDocument();
  });
});

describe("M3B.2 credential UI", () => {
  const push = vi.fn();
  const replace = vi.fn();

  beforeEach(() => {
    push.mockReset();
    replace.mockReset();
    vi.mocked(useRouter).mockReturnValue({
      push,
      replace,
      prefetch: vi.fn(),
    } as never);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("cloud PMS shows optional OHIP/API disclosure; on-prem and Other do not", async () => {
    vi.stubGlobal("fetch", mockSetupFetch({ pmsId: "mews" }));
    const { unmount } = render(<ConnectSetupScreen />);
    await screen.findByRole("heading", { name: "Connecting to Mews" });
    expect(
      screen.getByRole("button", { name: /I already have our API credentials to hand/ }),
    ).toBeInTheDocument();
    unmount();

    vi.stubGlobal("fetch", mockSetupFetch({ pmsId: "opera5" }));
    const onPrem = render(<ConnectSetupScreen />);
    await screen.findByRole("heading", { name: "Connecting to OPERA 5 / On-Premise" });
    expect(screen.queryByText(/I already have our/)).not.toBeInTheDocument();
    onPrem.unmount();

    vi.stubGlobal(
      "fetch",
      mockSetupFetch({ pmsId: "other", extraIntake: { otherPmsName: "HotelKey" } }),
    );
    render(<ConnectSetupScreen />);
    await screen.findByRole("heading", { name: "Connecting to HotelKey" });
    expect(screen.queryByText(/I already have our/)).not.toBeInTheDocument();
  });

  it("existing received status shows encrypted success copy without secret fields", async () => {
    vi.stubGlobal("fetch", mockSetupFetch({ pmsId: "operacloud", credentialsReceived: true }));
    render(<ConnectSetupScreen />);
    await screen.findByText(
      "Credentials received — thank you. They are encrypted and will not be shown again.",
    );
    expect(screen.queryByText(/I already have our/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/client id/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/client secret/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/application key/i)).not.toBeInTheDocument();
  });

  it("requires Client ID and client secret; application key is optional", async () => {
    const fetchMock = mockSetupFetch({ pmsId: "operacloud" });
    vi.stubGlobal("fetch", fetchMock);
    render(<ConnectSetupScreen />);
    fireEvent.click(
      await screen.findByRole("button", { name: /I already have our OHIP credentials to hand/ }),
    );
    expect(screen.getByLabelText("Client ID")).toBeInTheDocument();
    expect(screen.getByLabelText("Client secret")).toBeInTheDocument();
    expect(screen.getByLabelText(/Application key/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Submit securely" })).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Client ID"), { target: { value: "client-id-value" } });
    expect(screen.getByRole("button", { name: "Submit securely" })).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Client secret"), { target: { value: "client-secret-value" } });
    expect(screen.getByRole("button", { name: "Submit securely" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Submit securely" }));

    await waitFor(() => {
      expect(screen.getByText(
        "Credentials received — thank you. They are encrypted and will not be shown again.",
      )).toBeInTheDocument();
    });
    const credentialPost = fetchMock.mock.calls.find(
      ([url, init]) =>
        String(url) === "/api/setup/credentials" && (init as RequestInit | undefined)?.method === "POST",
    );
    expect(credentialPost).toBeTruthy();
    const posted = JSON.parse(String((credentialPost?.[1] as RequestInit).body)) as Record<string, unknown>;
    expect(posted).toEqual({ clientId: "client-id-value", clientSecret: "client-secret-value" });
    expect(posted).not.toHaveProperty("implementationId");
    expect(posted).not.toHaveProperty("propertyId");
    expect(posted).not.toHaveProperty("userId");
    expect(posted).not.toHaveProperty("email");
  });

  it("successful POST clears fields, hides the form, and never stores values in the browser", async () => {
    const fetchMock = mockSetupFetch({ pmsId: "operacloud" });
    vi.stubGlobal("fetch", fetchMock);
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    render(<ConnectSetupScreen />);
    fireEvent.click(
      await screen.findByRole("button", { name: /I already have our OHIP credentials to hand/ }),
    );
    fireEvent.change(screen.getByLabelText("Client ID"), { target: { value: "client-id-value" } });
    fireEvent.change(screen.getByLabelText("Client secret"), { target: { value: "client-secret-value" } });
    fireEvent.change(screen.getByLabelText(/Application key/), { target: { value: "app-key-value" } });
    fireEvent.click(screen.getByRole("button", { name: "Submit securely" }));
    await waitFor(() => {
      expect(screen.getByText(
        "Credentials received — thank you. They are encrypted and will not be shown again.",
      )).toBeInTheDocument();
    });
    expect(screen.queryByLabelText("Client ID")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Client secret")).not.toBeInTheDocument();
    expect(screen.queryByDisplayValue("client-id-value")).not.toBeInTheDocument();
    expect(screen.queryByDisplayValue("client-secret-value")).not.toBeInTheDocument();
    expect(screen.queryByDisplayValue("app-key-value")).not.toBeInTheDocument();
    const posted = JSON.parse(
      String(
        (
          fetchMock.mock.calls.find(
            ([url, init]) =>
              String(url) === "/api/setup/credentials" && (init as RequestInit | undefined)?.method === "POST",
          )?.[1] as RequestInit
        ).body,
      ),
    ) as Record<string, unknown>;
    expect(posted).toEqual({
      clientId: "client-id-value",
      clientSecret: "client-secret-value",
      applicationKey: "app-key-value",
    });
    expect(setItem).not.toHaveBeenCalled();
    setItem.mockRestore();
  });

  it("Not now collapses the form without posting credentials", async () => {
    const fetchMock = mockSetupFetch({ pmsId: "operacloud" });
    vi.stubGlobal("fetch", fetchMock);
    render(<ConnectSetupScreen />);
    fireEvent.click(
      await screen.findByRole("button", { name: /I already have our OHIP credentials to hand/ }),
    );
    fireEvent.change(screen.getByLabelText("Client ID"), { target: { value: "client-id-value" } });
    fireEvent.click(screen.getByRole("button", { name: "Not now" }));
    expect(screen.queryByLabelText("Client ID")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /I already have our OHIP credentials to hand/ }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Credentials received/)).not.toBeInTheDocument();
    expect(
      fetchMock.mock.calls.some(
        ([url, init]) =>
          String(url) === "/api/setup/credentials" && (init as RequestInit | undefined)?.method === "POST",
      ),
    ).toBe(false);
  });

  it("failed POST keeps the form and does not claim credentials were received", async () => {
    vi.stubGlobal(
      "fetch",
      mockSetupFetch({
        pmsId: "operacloud",
        postCredentials: () =>
          new Response(JSON.stringify({ ok: false, error: "Unable to store credentials." }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          }),
      }),
    );
    render(<ConnectSetupScreen />);
    fireEvent.click(
      await screen.findByRole("button", { name: /I already have our OHIP credentials to hand/ }),
    );
    fireEvent.change(screen.getByLabelText("Client ID"), { target: { value: "client-id-value" } });
    fireEvent.change(screen.getByLabelText("Client secret"), { target: { value: "client-secret-value" } });
    fireEvent.click(screen.getByRole("button", { name: "Submit securely" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Unable to store credentials.");
    expect(screen.queryByText(/Credentials received/)).not.toBeInTheDocument();
    expect(screen.getByLabelText("Client ID")).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
  });

  it("Review shows Received securely or We'll request these securely from status only", async () => {
    vi.stubGlobal("fetch", mockSetupFetch({ pmsId: "operacloud", credentialsReceived: true }));
    const received = render(<ReviewSetupScreen />);
    await screen.findByText("Received securely");
    expect(screen.queryByText("We'll request these securely")).not.toBeInTheDocument();
    expect(screen.queryByText(/client secret/i)).not.toBeInTheDocument();
    received.unmount();

    vi.stubGlobal("fetch", mockSetupFetch({ pmsId: "operacloud", credentialsReceived: false }));
    render(<ReviewSetupScreen />);
    await screen.findByText("We'll request these securely");
    expect(screen.queryByText("Received securely")).not.toBeInTheDocument();
  });

  it("Continue still saves connect intake and does not post credentials", async () => {
    const fetchMock = mockSetupFetch({ pmsId: "operacloud" });
    vi.stubGlobal("fetch", fetchMock);
    render(<ConnectSetupScreen />);
    await screen.findByRole("heading", { name: "Connecting to OPERA Cloud" });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    await waitFor(() => {
      expect(push).toHaveBeenCalledWith("/setup/review");
    });
    expect(
      fetchMock.mock.calls.some(
        ([url, init]) =>
          String(url) === "/api/setup/credentials" && (init as RequestInit | undefined)?.method === "POST",
      ),
    ).toBe(false);
    expect(
      fetchMock.mock.calls.some(
        ([url, init]) => String(url).includes("/api/setup/intake") && (init as RequestInit | undefined)?.method === "POST",
      ),
    ).toBe(true);
  });
});
