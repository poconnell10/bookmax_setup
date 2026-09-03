import type { ReactNode } from "react";
import { BrandMark } from "@/components/implementation/BrandMark";

const ACCESS_STEPS = [
  ["Access", "Verify your work email"],
  ["Property", "Tell us about your hotel"],
  ["Connect", "Who owns PMS access"],
  ["Discovery", "We read your configuration"],
  ["Setup & validation", "Your decisions, then we verify"],
] as const;

export function AuthSplitLayout({ children }: { children: ReactNode }) {
  return (
    <div className="bmx-auth">
      <aside className="brandside">
        <div className="bmark">
          <BrandMark />
          <span className="wm">traqra</span>
          <span className="pd">BookMax</span>
        </div>
        <div className="bpitch">
          <h2>Your BookMax implementation, in five steps.</h2>
          <p>
            You will not be asked to re-type configuration we can read from your PMS. Tell us how to
            reach it, and we take it from there.
          </p>
          <div className="bsteps">
            {ACCESS_STEPS.map(([title, detail], index) => (
              <span key={title} className={`bs${index === 0 ? " on" : ""}`}>
                <span className="bn">{index + 1}</span>
                <span className="bt">
                  <b>{title}</b>
                  {detail}
                </span>
              </span>
            ))}
          </div>
        </div>
        <div className="bfoot">
          <a href="#privacy">Privacy</a>
          <a href="#security">Security</a>
          <a href="#contact">Contact implementation</a>
        </div>
      </aside>
      <main className="formside">
        <div className="shell">
          <div className="mobmark">
            <BrandMark />
            <span className="wm">
              traqra <span style={{ color: "var(--mut-2)", fontWeight: 500 }}>BookMax</span>
            </span>
          </div>
          <section className="view on">{children}</section>
        </div>
      </main>
    </div>
  );
}
