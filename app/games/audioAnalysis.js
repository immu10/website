// Pure helpers for turning a decoded AudioBuffer into a deterministic beat
// list, and turning that beat list + a seed into a procedural obstacle
// layout. No React/DOM/canvas here so it's testable/reusable independent of
// the game component.

// Simple energy-based onset detector: chunks the (mono-mixed) samples into
// short windows, flags a window as an onset when its RMS energy spikes well
// above the local rolling average. Cheap, standard beat-detection approach —
// deterministic for a given fixed audio buffer, which is what lets the same
// track always produce the same beat list (and eventually the same
// leaderboard-fair course) rather than something that drifts run to run.
export function detectOnsets(
  audioBuffer,
  { windowSize = 1024, minIntervalSeconds = 0.2, sensitivity = 1.5 } = {}
) {
  const sampleRate = audioBuffer.sampleRate;
  const channels = audioBuffer.numberOfChannels;
  const length = audioBuffer.length;

  const mono = new Float32Array(length);
  for (let c = 0; c < channels; c++) {
    const data = audioBuffer.getChannelData(c);
    for (let i = 0; i < length; i++) mono[i] += data[i] / channels;
  }

  const numWindows = Math.floor(length / windowSize);
  const energies = new Float32Array(numWindows);
  for (let w = 0; w < numWindows; w++) {
    let sum = 0;
    const start = w * windowSize;
    for (let i = 0; i < windowSize; i++) {
      const s = mono[start + i];
      sum += s * s;
    }
    energies[w] = Math.sqrt(sum / windowSize);
  }

  const onsets = [];
  const historyLen = 43; // ~1s of windows at 1024 samples / 44.1kHz
  const minIntervalWindows = Math.round((minIntervalSeconds * sampleRate) / windowSize);
  let lastOnsetWindow = -Infinity;

  // Skip windows before a full history buffer exists — otherwise the
  // rolling average starts at (or near) 0 and the very first window or two
  // trivially "spikes" above it, producing a bogus onset right at the start
  // of the track no matter what's actually playing.
  for (let w = historyLen; w < numWindows; w++) {
    const from = w - historyLen;
    let avg = 0;
    for (let k = from; k < w; k++) avg += energies[k];
    avg /= historyLen;

    if (
      energies[w] > avg * sensitivity &&
      energies[w] > 0.02 &&
      w - lastOnsetWindow >= minIntervalWindows
    ) {
      onsets.push((w * windowSize) / sampleRate);
      lastOnsetWindow = w;
    }
  }

  return onsets;
}

// Estimates BPM from the onset list by histogramming inter-onset intervals
// (rounded to the nearest 20ms bucket) and taking the most common one as
// "the beat." Onset spacing is noisy (not every onset is on-beat), but the
// true beat interval tends to dominate the histogram since it recurs far
// more often than any other gap. Falls back to a reasonable default when
// there aren't enough onsets to make a call.
export function estimateTempo(onsets, { fallbackBpm = 120 } = {}) {
  if (onsets.length < 4) return fallbackBpm;

  const buckets = new Map();
  for (let i = 1; i < onsets.length; i++) {
    const interval = onsets[i] - onsets[i - 1];
    // Ignore implausible intervals (way too fast/slow to be "the beat").
    if (interval < 0.2 || interval > 2) continue;
    const bucketKey = Math.round(interval / 0.02) * 0.02;
    buckets.set(bucketKey, (buckets.get(bucketKey) || 0) + 1);
  }
  if (buckets.size === 0) return fallbackBpm;

  let bestInterval = fallbackBpm > 0 ? 60 / fallbackBpm : 0.5;
  let bestCount = -1;
  for (const [interval, count] of buckets) {
    if (count > bestCount) {
      bestCount = count;
      bestInterval = interval;
    }
  }

  let bpm = 60 / bestInterval;
  // Octave-correct into a typical dance/electronic range — halving/doubling
  // is the classic tempo-detection ambiguity (detecting every other beat,
  // or every half-beat, is easy to do by mistake).
  while (bpm < 80) bpm *= 2;
  while (bpm > 175) bpm /= 2;
  return Math.round(bpm);
}

// Finds where the beat grid should start (0..intervalSeconds) by averaging
// each onset's position within its own interval — a circular mean, not a
// plain average, since "just before 0" and "just after intervalSeconds"
// are actually right next to each other on a repeating grid; a plain
// average of e.g. [0.02, interval-0.02] would wrongly land at the
// interval's midpoint instead of near 0.
export function estimatePhaseOffset(onsets, tempo, { subdivision = 1 } = {}) {
  if (onsets.length === 0) return 0;
  const interval = (60 / tempo) * subdivision;

  let sinSum = 0;
  let cosSum = 0;
  for (const t of onsets) {
    const angle = ((t % interval) / interval) * 2 * Math.PI;
    sinSum += Math.sin(angle);
    cosSum += Math.cos(angle);
  }
  const meanAngle = Math.atan2(sinSum, cosSum);
  const normalized = meanAngle < 0 ? meanAngle + 2 * Math.PI : meanAngle;
  return (normalized / (2 * Math.PI)) * interval;
}

// A steady, regularly-spaced pulse of required-input timestamps derived
// purely from tempo — the "metronome" alternative to onset-driven timing.
// subdivision controls density relative to the beat: 1 = every beat,
// 2 = every other beat, 0.5 = twice per beat. phaseOffset (from
// estimatePhaseOffset) aligns the grid to when the track's hits actually
// land instead of starting arbitrarily at t=0.
export function generateBeatGrid(tempo, duration, { subdivision = 1, phaseOffset = 0 } = {}) {
  const interval = (60 / tempo) * subdivision;
  const grid = [];
  for (let t = phaseOffset; t < duration; t += interval) {
    if (t >= 0) grid.push(t);
  }
  return grid;
}

// Coarse (100ms-window) RMS energy over time, normalized to 0..1 against
// the track's own min/max. Used to scale difficulty to how "busy" a section
// of the track actually is — quiet intros stay easy, dense/loud sections
// get harder — without needing a second pass over the raw samples per
// obstacle at generation time.
export function computeEnergyEnvelope(audioBuffer, { windowSeconds = 0.1 } = {}) {
  const sampleRate = audioBuffer.sampleRate;
  const channels = audioBuffer.numberOfChannels;
  const length = audioBuffer.length;
  const windowSize = Math.round(windowSeconds * sampleRate);

  const mono = new Float32Array(length);
  for (let c = 0; c < channels; c++) {
    const data = audioBuffer.getChannelData(c);
    for (let i = 0; i < length; i++) mono[i] += data[i] / channels;
  }

  const numWindows = Math.floor(length / windowSize);
  const raw = new Float32Array(numWindows);
  let min = Infinity;
  let max = -Infinity;
  for (let w = 0; w < numWindows; w++) {
    let sum = 0;
    const start = w * windowSize;
    for (let i = 0; i < windowSize; i++) {
      const s = mono[start + i];
      sum += s * s;
    }
    const rms = Math.sqrt(sum / windowSize);
    raw[w] = rms;
    if (rms < min) min = rms;
    if (rms > max) max = rms;
  }

  const range = max - min || 1;
  const normalized = new Float32Array(numWindows);
  for (let w = 0; w < numWindows; w++) normalized[w] = (raw[w] - min) / range;

  return { values: normalized, windowSeconds };
}

// Energy (0..1) at a given track time, from an envelope produced by
// computeEnergyEnvelope.
export function energyAt(envelope, time) {
  const idx = Math.min(
    envelope.values.length - 1,
    Math.max(0, Math.round(time / envelope.windowSeconds))
  );
  return envelope.values[idx] ?? 0;
}

// Mulberry32 — tiny, fast, deterministic PRNG. Same seed -> same output
// sequence every time, which is what makes a "procedurally generated"
// obstacle course reproducible (and eventually verifiable server-side)
// instead of using Math.random(), which can't be replayed or checked.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// A continuous winding tunnel rather than discrete flappy-bird pillars: one
// "keyframe" per onset, each a sharp direction-change point for the tunnel's
// center line, connected to its neighbors by straight (linear-interpolated)
// segments — the same zigzag shape you'd get plotting center-Y over time.
// Tunnel width narrows (harder) in higher-energy sections when an energy
// envelope is supplied — a quiet intro stays forgiving, a dense drop gets
// tighter, without needing per-keyframe hand-tuning.
//
// Reachability: each keyframe's center is rolled, then clamped to within
// maxVerticalSpeed * (time since previous keyframe) * reachabilityMargin of
// the previous keyframe's center — otherwise two keyframes close together in
// time would require a slope steeper than the player can physically fly,
// an unavoidable "impossible" tunnel wall rather than a real difficulty
// spike. The margin leaves slack for reaction time.
export function generateTunnel(
  onsets,
  seed,
  {
    minWidth = 110,
    maxWidth = 240,
    edgeMargin = 20,
    startBufferSeconds = 2,
    energyEnvelope = null,
    canvasHeight = 460,
    maxVerticalSpeed = null,
    reachabilityMargin = 0.7,
  } = {}
) {
  const rand = mulberry32(seed);
  const keyframes = [{ time: 0, centerY: canvasHeight / 2, width: maxWidth }];

  for (const time of onsets) {
    if (time < startBufferSeconds) continue;
    const energy = energyEnvelope ? energyAt(energyEnvelope, time) : 0;
    const width = maxWidth - energy * (maxWidth - minWidth);

    const prev = keyframes[keyframes.length - 1];
    const lo = edgeMargin + width / 2;
    const hi = canvasHeight - edgeMargin - width / 2;

    let loBound = lo;
    let hiBound = hi;
    if (maxVerticalSpeed) {
      const dt = time - prev.time;
      const maxDelta = maxVerticalSpeed * dt * reachabilityMargin;
      loBound = Math.max(lo, prev.centerY - maxDelta);
      hiBound = Math.min(hi, prev.centerY + maxDelta);
      if (loBound > hiBound) {
        // Reachable window collapsed (shouldn't happen with sane speeds)
        // — fall back to staying put rather than rolling an impossible turn.
        loBound = hiBound = Math.max(lo, Math.min(hi, prev.centerY));
      }
    }

    const centerY = loBound + rand() * (hiBound - loBound);
    keyframes.push({ time, centerY, width });
  }

  return keyframes;
}

// Center-Y and width of the tunnel at an arbitrary track time, linearly
// interpolated between the two surrounding keyframes — used both to render
// the continuous wall shape and to collision-test the player's current
// position, since both need the same "where is the tunnel right now" value.
export function sampleTunnel(keyframes, time) {
  if (time <= keyframes[0].time) return keyframes[0];
  const last = keyframes[keyframes.length - 1];
  if (time >= last.time) return last;

  for (let i = 1; i < keyframes.length; i++) {
    const b = keyframes[i];
    if (time <= b.time) {
      const a = keyframes[i - 1];
      const t = (time - a.time) / (b.time - a.time);
      return {
        centerY: a.centerY + (b.centerY - a.centerY) * t,
        width: a.width + (b.width - a.width) * t,
      };
    }
  }
  return last;
}

// Widest single ground obstacle a jump can clear, given the game's own jump
// physics — used to cap generated obstacles so none end up wider than
// what's actually jumpable.
//
// The player isn't "clear" for the whole ground-to-ground air time — only
// while risen at least obstacleHeight above the ground (height(t) = v*t -
// 0.5*g*t^2 >= obstacleHeight), a shorter window centered on the jump's
// apex. Solving that quadratic for the window's two roots gives the real
// clear duration; using full air time instead (as an earlier version of
// this function did) overestimates it and generates obstacles wider than a
// correctly-timed jump can actually clear — a real bug, not hypothetical,
// caught by an autoplay bot dying on a "guaranteed clearable" obstacle.
// playerSize is subtracted since the player's own leading edge needs to be
// past the obstacle too, not just its center point.
//
// The double-jump figure is a heuristic multiplier rather than exact
// kinematics (a second jump triggered mid-arc doesn't add a full second
// jump's worth of window the way two independent jumps would).
export function estimateMaxClearWidth({
  jumpVelocity,
  gravity,
  scrollSpeed,
  obstacleHeight,
  playerSize = 0,
  doubleJump = false,
}) {
  const v = Math.abs(jumpVelocity);
  const discriminant = v * v - 2 * gravity * obstacleHeight;
  if (discriminant <= 0) return 0; // this jump can never clear something this tall

  const sqrtD = Math.sqrt(discriminant);
  const clearDuration = (2 * sqrtD) / gravity; // (v+sqrtD)/g - (v-sqrtD)/g
  const singleClear = Math.max(0, scrollSpeed * clearDuration - playerSize);
  return doubleJump ? singleClear * 1.8 : singleClear;
}

// Ground-obstacle variant for a jump-based (Dino Run / Geometry Dash style)
// runner: one block per onset, sitting on the ground, width scaling up in
// higher-energy sections (a wider block needs earlier/more precise jump
// timing). No vertical placement RNG needed since these all sit on the
// ground line.
//
// Safeguard: two onsets close together in time can produce two separate
// blocks with no safe landing gap between them — the player clears the
// first only to be forced into an unavoidable second obstacle mid-recovery.
// When scrollSpeed is supplied, blocks that don't leave minLandingGapSeconds
// of clear ground between them get merged into one wider block instead
// (still a real obstacle, just honestly one you have to clear in one go),
// and every block's final width is capped at maxClearWidth so nothing —
// merged or not — ends up wider than what a jump can actually cross.
export function generateGroundObstacles(
  seedOnsets,
  seed,
  {
    minWidth = 24,
    maxWidth = 48,
    startBufferSeconds = 2,
    energyEnvelope = null,
    scrollSpeed = null,
    maxClearWidth = null,
    minLandingGapSeconds = 0.25,
  } = {}
) {
  void seed; // reserved for future width jitter; not used yet

  const raw = seedOnsets
    .filter((time) => time >= startBufferSeconds)
    .map((time) => {
      const energy = energyEnvelope ? energyAt(energyEnvelope, time) : 0;
      const width = minWidth + energy * (maxWidth - minWidth);
      return { time, width };
    });

  if (!scrollSpeed) return raw;

  const merged = [];
  for (const ob of raw) {
    const widthSeconds = ob.width / scrollSpeed;
    const leading = ob.time - widthSeconds / 2;
    const trailing = ob.time + widthSeconds / 2;
    const last = merged[merged.length - 1];
    if (last && leading - last.trailing < minLandingGapSeconds) {
      last.trailing = Math.max(last.trailing, trailing);
      last.time = (last.leading + last.trailing) / 2;
    } else {
      merged.push({ leading, trailing, time: ob.time });
    }
  }

  return merged.map((ob) => {
    let width = (ob.trailing - ob.leading) * scrollSpeed;
    if (maxClearWidth) width = Math.min(width, maxClearWidth);
    return { time: ob.time, width };
  });
}
