// A stylized Subnautica "Peeper" — the little fish with the big eyes.
// Pure inline SVG (no image file). It swims across the screen via CSS
// (see .peeper rules in globals.css). Decorative only.

export default function Peeper() {
  return (
    <div className="peeper" aria-hidden>
      <svg viewBox="0 0 140 90" width="100%" height="auto">
        <defs>
          <linearGradient id="peeperBody" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#46c9a6" />
            <stop offset="0.55" stopColor="#2a9aa0" />
            <stop offset="1" stopColor="#1d7b86" />
          </linearGradient>
        </defs>

        {/* tail (wiggles) */}
        <path
          className="peeper-tail"
          d="M42,45 L6,20 Q18,45 6,70 Z"
          fill="#1d7b86"
        />

        {/* dorsal + pectoral fins */}
        <path d="M58,24 Q70,6 84,23 Z" fill="#26909a" />
        <path d="M78,62 Q88,82 99,62 Z" fill="#26909a" />

        {/* body */}
        <ellipse cx="74" cy="45" rx="42" ry="25" fill="url(#peeperBody)" />

        {/* pale belly */}
        <path
          d="M40,52 Q74,80 112,50 Q74,63 40,52 Z"
          fill="#cdeee0"
          opacity="0.85"
        />

        {/* orange lips */}
        <path d="M111,45 q11,2 10,8 q-7,1 -11,-3 Z" fill="#e8743b" />

        {/* big signature eye */}
        <circle cx="98" cy="38" r="13" fill="#ffffff" />
        <circle cx="101" cy="39" r="6.5" fill="#10243a" />
        <circle cx="103.5" cy="36" r="2.2" fill="#ffffff" />
      </svg>
    </div>
  );
}
