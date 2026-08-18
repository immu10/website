// Plain monochrome "guest account" marker — an inline SVG rather than an
// emoji, since emoji render in whatever color the OS/browser's emoji font
// uses (can't be recolored via CSS); this one just inherits the surrounding
// text color via currentColor.

export default function GuestIcon({ className = "" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      role="img"
      aria-label="Guest account"
    >
      <title>Guest account</title>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}
