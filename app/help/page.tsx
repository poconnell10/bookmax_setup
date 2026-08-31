import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Implementation Help",
};

export default function HelpPage() {
  return (
    <div className="step">
      <div className="card">
        <div className="chd">
          <div>
            <div className="t">Implementation Help</div>
            <div className="s">Support for the BookMax setup: Property &amp; PMS, Connect PMS, and Summary.</div>
          </div>
        </div>
        <div className="cb">
          <p className="sfine" style={{ marginTop: 0 }}>
            If you are filling in BookMax setup and need help with a PMS, connection method, or credentials, contact your BookMax implementation lead.
          </p>
          <p className="sfine">
            Email <span className="code">implementation@bookmax.app</span> with your organisation name and property.
          </p>
        </div>
      </div>
    </div>
  );
}
