export function BrandMark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 120 120" fill="none" aria-hidden="true">
      <polyline
        points="16,93 45,66 73,75 104,30"
        stroke="currentColor"
        strokeWidth="9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="16" cy="93" r="6.5" fill="currentColor" />
      <circle cx="104" cy="30" r="13.5" stroke="currentColor" strokeWidth="8" />
      <circle cx="104" cy="30" r="4" fill="currentColor" />
    </svg>
  );
}
