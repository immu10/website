// Small warning icon shown next to a section heading when that section's
// data source is configured but the live fetch failed — distinguishes a
// real fetch failure from "never configured" (which stays silent).

export default function LiveWarning({
  label = "Live data unavailable for this section — showing fallback content",
}) {
  return (
    <span
      title={label}
      aria-label={label}
      role="img"
      className="text-sm text-amber-400"
    >
      ⚠
    </span>
  );
}
