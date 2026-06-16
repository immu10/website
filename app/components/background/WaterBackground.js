// Toony underwater light. The screen is divided into vertical columns, and each
// column's BRIGHTNESS rises and falls. Every column uses the same pulse, but is
// offset in time by its position — so the bright band sweeps across the screen
// like a sine wave traveling sideways (not random, not up/down).

const COLUMNS = 18;
const WAVE_PERIOD = 5; // seconds for one full bright->dim->bright cycle (same for all)
const WAVE_CYCLES = 1.5; // how many bright crests are visible across the width at once

export default function WaterBackground() {
  const shafts = Array.from({ length: COLUMNS }, (_, i) => ({
    left: ((i + 0.5) / COLUMNS) * 100, // evenly spaced columns
    duration: WAVE_PERIOD, // identical speed = a coherent wave
    // Offset each column's brightness pulse by its position. Neighbours are
    // slightly out of phase, so the bright band rolls across like a sine wave.
    delay: -((i / COLUMNS) * WAVE_PERIOD * WAVE_CYCLES),
  }));

  return (
    <div aria-hidden className="water-bg">
      {shafts.map((s, i) => (
        <span
          key={i}
          className="water-shaft"
          style={{
            left: `${s.left}%`,
            animationDuration: `${s.duration}s`,
            animationDelay: `${s.delay}s`,
          }}
        />
      ))}
    </div>
  );
}
