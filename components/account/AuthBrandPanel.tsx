export function AuthBrandPanel() {
  return (
    <div className="brandpane">
      <div className="brand-top">
        <div className="logo-mark" aria-hidden="true">
          <svg width="24" height="24" viewBox="0 0 32 32" fill="none">
            <path
              d="M11 6v20M11 6h7a5 5 0 0 1 0 10h-7M11 16h8a5 5 0 0 1 0 10h-8"
              stroke="#fff"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <span className="logo-word">BookMax</span>
      </div>
      <div className="brand-mid">
        <div className="brand-eyebrow">Implementation setup</div>
        <div className="brand-h">
          Three steps to get BookMax <em>connected</em>.
        </div>
        <div className="brand-sub">
          Property &amp; PMS, Connect PMS, then Summary. Credentials are received securely and never shown back.
        </div>
        <div className="brand-diff">
          <Diff title="Property & PMS" detail="Organisation, property, and the system BookMax will connect to." />
          <Diff title="Connect PMS" detail="Connection details for OHIP, API, SFTP, or on-premise access." />
          <Diff title="Summary" detail="Review and submit. Thank you is a confirmation, not a fourth step." />
        </div>
      </div>
    </div>
  );
}

function Diff({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="diff-row">
      <div className="diff-mark">
        <svg viewBox="0 0 24 24">
          <path d="M5 12l5 5L20 6" />
        </svg>
      </div>
      <div>
        <div className="diff-t">{title}</div>
        <div className="diff-d">{detail}</div>
      </div>
    </div>
  );
}
