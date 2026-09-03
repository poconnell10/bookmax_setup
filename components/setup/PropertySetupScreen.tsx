"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { SetupShell } from "@/components/setup/SetupShell";
import { emptySetupIntake, looksLikeEmail, type SetupIntakePayload } from "@/lib/setup/intake";
import type { CustomerProperty } from "@/lib/implementation/customer/types";

type FieldErrors = {
  name?: string;
  contactName?: string;
  technicalContactName?: string;
  technicalContactEmail?: string;
};

const REQUIRED = "This field is required.";

export function PropertySetupScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [property, setProperty] = useState<CustomerProperty | null>(null);
  const [intake, setIntake] = useState<SetupIntakePayload>(emptySetupIntake());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [name, setName] = useState("");
  const [hotelBrand, setHotelBrand] = useState("");
  const [contactName, setContactName] = useState("");
  const [sameAsPrimaryContact, setSameAsPrimaryContact] = useState(false);
  const [technicalContactName, setTechnicalContactName] = useState("");
  const [technicalContactEmail, setTechnicalContactEmail] = useState("");
  const [technicalContactMobile, setTechnicalContactMobile] = useState("");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch("/api/setup/property");
        if (response.status === 403 || response.status === 401) {
          router.replace("/access");
          return;
        }
        const payload = (await response.json()) as {
          ok?: boolean;
          email?: string;
          property?: CustomerProperty | null;
          intake?: SetupIntakePayload;
        };
        if (!response.ok || !payload.ok) {
          router.replace("/access");
          return;
        }
        if (cancelled) {
          return;
        }
        setEmail(payload.email || "");
        const nextIntake = payload.intake || emptySetupIntake();
        setIntake(nextIntake);
        if (payload.property) {
          setProperty(payload.property);
          setName(payload.property.name);
          setHotelBrand(payload.property.hotelBrand || "");
          setContactName(payload.property.contactName);
        }
        setSameAsPrimaryContact(nextIntake.sameAsPrimaryContact);
        setTechnicalContactName(nextIntake.technicalContactName || "");
        setTechnicalContactEmail(nextIntake.technicalContactEmail || "");
        setTechnicalContactMobile(nextIntake.technicalContactMobile || "");
      } catch {
        router.replace("/access");
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  function validate(): boolean {
    const next: FieldErrors = {};
    if (!name.trim()) {
      next.name = REQUIRED;
    }
    if (!contactName.trim()) {
      next.contactName = REQUIRED;
    }
    if (!sameAsPrimaryContact) {
      if (!technicalContactName.trim()) {
        next.technicalContactName = REQUIRED;
      }
      if (!technicalContactEmail.trim()) {
        next.technicalContactEmail = REQUIRED;
      } else if (!looksLikeEmail(technicalContactEmail)) {
        next.technicalContactEmail = "Enter a valid email.";
      }
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) {
      return;
    }
    if (!validate()) {
      return;
    }
    setSaving(true);
    setFormError("");
    try {
      const response = await fetch("/api/setup/property", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          hotelBrand,
          contactName,
          sameAsPrimaryContact,
          technicalContactName,
          technicalContactEmail,
          technicalContactMobile,
        }),
      });
      const payload = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !payload.ok) {
        setFormError(payload.error || "We couldn't save your property. Try again.");
        return;
      }
      router.push("/setup/pms");
    } catch {
      setFormError("We couldn't save your property. Try again.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <SetupShell email={email}>
        <p className="sub">Loading your implementation…</p>
      </SetupShell>
    );
  }

  return (
    <SetupShell
      email={email}
      saved={Boolean(property)}
      property={property}
      intake={intake}
    >
      <div className="intro">
        <h1>Set up your property for BookMax</h1>
        <p>
          BookMax is your pre-arrival upsell solution. We need a few basic details about your
          property and PMS so our implementation team can get started.
        </p>
        <span className="mins">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v5l3.5 2" />
          </svg>
          Takes about 2 minutes
        </span>
      </div>
      <form onSubmit={onSubmit} noValidate>
        <div className={`card${name.trim() ? " ok" : ""}`} id="c-prop">
          <div className="sqrow">
            <span className="sq">Your property</span>
            <span className="ckd">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.4">
                <path d="M20 6L9 17l-5-5" />
              </svg>
              Done
            </span>
          </div>
          <div>
            <div className={`f${errors.name ? " iserr" : ""}`}>
              <label htmlFor="pname">
                Property name<span className="rq">*</span>
              </label>
              <input
                id="pname"
                placeholder="e.g. The Gritti Palace"
                value={name}
                onChange={(event) => {
                  setName(event.target.value);
                  setErrors((current) => ({ ...current, name: undefined }));
                }}
              />
              {errors.name ? (
                <div className="err" role="alert">
                  {errors.name}
                </div>
              ) : null}
            </div>
            <div className="f">
              <label htmlFor="pgroup">
                Hotel brand<span className="op">· optional</span>
              </label>
              <input
                id="pgroup"
                placeholder="e.g. Marriott Luxury Collection"
                value={hotelBrand}
                onChange={(event) => setHotelBrand(event.target.value)}
              />
            </div>
          </div>
        </div>

        <div className={`card${contactName.trim() && email ? " ok" : ""}`} id="c-you">
          <div className="sqrow">
            <span className="sq">Your contact details</span>
            <span className="ckd">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.4">
                <path d="M20 6L9 17l-5-5" />
              </svg>
              Done
            </span>
          </div>
          <div className="sh">So we know who to keep updated.</div>
          <div className="two">
            <div className={`f${errors.contactName ? " iserr" : ""}`}>
              <label htmlFor="yname">
                Your name<span className="rq">*</span>
              </label>
              <input
                id="yname"
                value={contactName}
                onChange={(event) => {
                  setContactName(event.target.value);
                  setErrors((current) => ({ ...current, contactName: undefined }));
                }}
              />
              {errors.contactName ? (
                <div className="err" role="alert">
                  {errors.contactName}
                </div>
              ) : null}
            </div>
            <div className="f">
              <label htmlFor="yemail">
                Email<span className="rq">*</span>
              </label>
              <input id="yemail" value={email} readOnly />
            </div>
          </div>
        </div>

        <div
          className={`card${sameAsPrimaryContact || (technicalContactName.trim() && technicalContactEmail.trim()) ? " ok" : ""}`}
          id="c-tech"
        >
          <div className="sqrow">
            <span className="sq">Who should we contact about PMS access?</span>
            <span className="ckd">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.4">
                <path d="M20 6L9 17l-5-5" />
              </svg>
              Done
            </span>
          </div>
          <div className="sh">
            Often someone in IT or your PMS provider. We go to them directly, so you don&apos;t have
            to relay anything technical.
          </div>
          <button
            type="button"
            className={`cb${sameAsPrimaryContact ? " on" : ""}`}
            id="samecb"
            onClick={() => {
              setSameAsPrimaryContact((value) => !value);
              setErrors((current) => ({
                ...current,
                technicalContactName: undefined,
                technicalContactEmail: undefined,
              }));
            }}
          >
            <span className="cbx">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2">
                <path d="M20 6L9 17l-5-5" />
              </svg>
            </span>
            <span className="cbl">That&apos;s me — I look after PMS access too</span>
          </button>
          {!sameAsPrimaryContact ? (
            <div id="techFields" style={{ marginTop: 13 }}>
              <div className="two">
                <div className={`f${errors.technicalContactName ? " iserr" : ""}`}>
                  <label htmlFor="tname">
                    Name<span className="rq">*</span>
                  </label>
                  <input
                    id="tname"
                    placeholder="e.g. Maria Rossi"
                    value={technicalContactName}
                    onChange={(event) => {
                      setTechnicalContactName(event.target.value);
                      setErrors((current) => ({ ...current, technicalContactName: undefined }));
                    }}
                  />
                  {errors.technicalContactName ? (
                    <div className="err" role="alert">
                      {errors.technicalContactName}
                    </div>
                  ) : null}
                </div>
                <div className={`f${errors.technicalContactEmail ? " iserr" : ""}`}>
                  <label htmlFor="temail">
                    Email<span className="rq">*</span>
                  </label>
                  <input
                    id="temail"
                    placeholder="maria.rossi@grittipalace.com"
                    value={technicalContactEmail}
                    onChange={(event) => {
                      setTechnicalContactEmail(event.target.value);
                      setErrors((current) => ({ ...current, technicalContactEmail: undefined }));
                    }}
                  />
                  {errors.technicalContactEmail ? (
                    <div className="err" role="alert">
                      {errors.technicalContactEmail}
                    </div>
                  ) : null}
                </div>
              </div>
              <div className="f">
                <label htmlFor="tphone">
                  Mobile or WhatsApp<span className="op">· optional</span>
                </label>
                <input
                  id="tphone"
                  placeholder="+1 (555) 000-0000"
                  value={technicalContactMobile}
                  onChange={(event) => setTechnicalContactMobile(event.target.value)}
                />
              </div>
            </div>
          ) : null}
        </div>

        {formError ? (
          <div className="err" role="alert">
            {formError}
          </div>
        ) : null}
        <div className="nav">
          <span />
          <button type="submit" className="btn pri" disabled={saving}>
            {saving ? "Saving…" : "Continue"}
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </button>
        </div>
      </form>
    </SetupShell>
  );
}
