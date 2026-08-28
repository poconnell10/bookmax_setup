"use client";

import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useIntake } from "@/components/intake/IntakeProvider";
import { COUNTRY_OPTIONS } from "@/lib/implementation/catalogue";
import {
  canReachStage,
  credentialLabel,
  filledProperties,
  hostingLabel,
  pmsDisplayName,
  suppliedConnectionDetails,
} from "@/lib/implementation/selectors";

export function SummaryStep() {
  const router = useRouter();
  const { state, submitSetup } = useIntake();
  const properties = filledProperties(state);
  const label = credentialLabel(state);
  const country = COUNTRY_OPTIONS.find((item) => item.value === state.country)?.label;
  const connection = suppliedConnectionDetails(state);
  const credStatus = state.credentialsStatus === "received" ? "Received" : "Pending";

  async function onSubmit() {
    await submitSetup();
    router.push("/implementation/thanks");
  }

  return (
    <div className="step">
      <div className="why">
        <span>This is everything you are about to send us. Check it, change anything that is wrong, and submit.</span>
      </div>
      <div className="card">
        <div className="chd">
          <div>
            <div className="t">Review &amp; submit</div>
            <div className="s">Credentials are never shown back to you — only whether we have them.</div>
          </div>
        </div>
        <div className="cb">
          <Section
            title="Property & PMS"
            action={
              <button type="button" className="btn sm" onClick={() => router.push("/implementation/property")}>
                Edit
              </button>
            }
            rows={[
              ["Organisation", state.organisation],
              [
                "Property",
                properties[0] + (properties.length > 1 ? ` +${properties.length - 1} more` : ""),
              ],
              ["PMS", pmsDisplayName(state)],
              hostingLabel(state) ? ["Hosting", hostingLabel(state)] : null,
              state.pmsVersion.trim() ? ["Version", state.pmsVersion.trim()] : null,
              ["Technical Contact", `${state.technicalContact} · ${state.technicalContactEmail}`],
              state.technicalContactMobile.trim()
                ? ["WhatsApp / Mobile", state.technicalContactMobile.trim()]
                : null,
              country ? ["Country", country] : null,
            ]}
          />
          <Section
            title="Connection Details"
            action={
              <button type="button" className="btn sm" onClick={() => router.push("/implementation/connect")}>
                Edit
              </button>
            }
            rows={[
              ...Object.entries(connection),
              label ? [label, credStatus] : null,
            ]}
          />
          <div className="grp">
            {state.credentialsStatus !== "received" && label ? (
              <div className="sfine" style={{ margin: "0 0 12px" }}>
                You can provide your {label.toLowerCase()} when they become available. Your setup can be submitted now.
              </div>
            ) : null}
            <button
              type="button"
              className="btn pri"
              style={{ width: "100%", justifyContent: "center" }}
              disabled={!canReachStage(state, "summary")}
              onClick={() => void onSubmit()}
            >
              Submit BookMax Setup
            </button>
          </div>
        </div>
      </div>
      <div className="navbar">
        <button type="button" className="btn" onClick={() => router.push("/implementation/connect")}>
          Back
        </button>
      </div>
    </div>
  );
}

function Section({
  title,
  action,
  rows,
}: {
  title: string;
  action: ReactNode;
  rows: Array<[string, string] | null>;
}) {
  const visible = rows.filter((row): row is [string, string] => Boolean(row && row[1]));

  return (
    <div className="grp">
      <div className="sechd">
        <span className="gk" style={{ margin: 0 }}>
          {title}
        </span>
        {action}
      </div>
      <div className="subcard" style={{ marginTop: 2 }}>
        {visible.map(([key, value]) => (
          <div key={key} className="srow">
            <span className="sk2">{key}</span>
            <span className="sv2">
              {key.toLowerCase().includes("credentials") ? (
                <span className={`bd ${value === "Received" ? "ok" : "part"}`}>{value}</span>
              ) : (
                value
              )}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
