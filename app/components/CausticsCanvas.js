"use client";
// A full-screen WebGL canvas that renders animated water caustics.
// WebGL only runs in the browser, so this is a Client Component ("use client").
//
// mode="topdown"  -> looking straight down: the rippling net of light (like a pool floor)
// mode="depth"    -> side-on: sun shafts punching down through water, fading with depth
//
// It paints an OPAQUE dark-teal scene, so it fully covers anything behind it.

import { useEffect, useRef } from "react";

// Vertex shader: just draws a rectangle covering the whole screen.
const VERT = `
attribute vec2 a_pos;
void main() {
  gl_Position = vec4(a_pos, 0.0, 1.0);
}
`;

// Top-down caustics: the classic animated water-light "net".
const FRAG_TOPDOWN = `
precision highp float;
uniform float u_time;
uniform vec2 u_res;
#define TAU 6.28318530718
#define ITER 5
void main() {
  vec2 uv = gl_FragCoord.xy / u_res.xy;
  uv.x *= u_res.x / u_res.y;            // keep ripples square, not stretched
  float t = u_time * 0.4 + 23.0;
  vec2 p = mod(uv * TAU * 0.8, TAU) - 250.0; // smaller scale = fewer, larger ripples
  vec2 i = p;
  float c = 1.0;
  float inten = 0.005;
  for (int n = 0; n < ITER; n++) {
    float tt = t * (1.0 - (3.5 / float(n + 1)));
    i = p + vec2(cos(tt - i.x) + sin(tt + i.y), sin(tt - i.y) + cos(tt + i.x));
    c += 1.0 / length(vec2(p.x / (sin(i.x + tt) / inten), p.y / (cos(i.y + tt) / inten)));
  }
  c /= float(ITER);
  c = 1.17 - pow(c, 1.4);
  float v = pow(abs(c), 4.5);            // softer highlights (was 8.0 = sharp/metallic)

  vec3 deep  = vec3(0.04, 0.20, 0.26);    // brighter, warmer teal base (not near-black)
  vec3 light = vec3(0.55, 0.88, 0.85);    // soft aqua light, less icy/metallic
  vec3 col = deep + light * v * 0.55;

  vec2 q = gl_FragCoord.xy / u_res.xy;    // gentle vignette (less harsh than before)
  col *= smoothstep(1.5, 0.2, length(q - 0.5)) * 0.35 + 0.72;

  gl_FragColor = vec4(col, 1.0);
}
`;

// Depth view: sun shafts coming down from a surface just above the top edge.
// Smooth & brighter, with crisp (but not blocky) sun shafts.
const FRAG_DEPTH = `
precision highp float;
uniform float u_time;
uniform vec2 u_res;

// wavy light intensity along the surface. Fewer harmonics = cleaner, less "blurry".
float surf(float x, float t) {
  float s = 0.0;
  s += sin(x * 5.0  + t * 1.0);
  s += 0.6 * sin(x * 9.0  - t * 1.4);
  s += 0.35 * sin(x * 15.0 + t * 0.7);
  return s / 1.95;                       // roughly -1..1
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_res.xy;  // y: 0 bottom, 1 top
  float depth = 1.0 - uv.y;              // 0 at surface (top), 1 deep (bottom)
  float x = uv.x * (u_res.x / u_res.y);
  float t = u_time;

  // Sun shafts: sample the surface, spread a little as they go deeper.
  float ray = surf(x + depth * 0.15, t) * 0.5 + 0.5;  // 0..1

  // Crisp-but-smooth beams: a soft-edged mask (sharper than the old pow, but
  // anti-aliased — no hard banding).
  float beamMask = smoothstep(0.42, 0.7, ray);

  // Brighter than the original: gentle linear fade with depth.
  float atten = mix(1.0, 0.45, depth);
  float light = beamMask * atten;        // smooth brightness, no flat bands

  // Soft, bright shimmer near the surface
  float topGlow = exp(-depth * 7.0) * (0.6 + 0.4 * sin(x * 16.0 - t * 2.0));

  // Base water: brighter teal, SMOOTH gradient from surface to deep.
  vec3 c1 = vec3(0.11, 0.46, 0.54);      // bright teal near the surface
  vec3 c2 = vec3(0.04, 0.22, 0.30);      // deeper teal
  vec3 base = mix(c1, c2, depth);

  vec3 beam = vec3(0.65, 1.0, 1.0);      // saturated cyan light
  vec3 col = base + beam * light * 0.55 + beam * topGlow * 0.18;

  gl_FragColor = vec4(col, 1.0);
}
`;

// Subnautica shallows: bright turquoise gradient + god rays + caustic shimmer
// + drifting marine-snow particles.
const FRAG_SUBNAUTICA = `
precision highp float;
uniform float u_time;
uniform vec2 u_res;
#define TAU 6.28318530718

// wavy surface light (for the god rays)
float surf(float x, float t) {
  float s = 0.0;
  s += sin(x * 5.0 + t * 1.0);
  s += 0.6 * sin(x * 9.0 - t * 1.4);
  s += 0.35 * sin(x * 15.0 + t * 0.7);
  return s / 1.95;
}

// caustic "net" shimmer
float caustic(vec2 uv, float t) {
  vec2 p = mod(uv * TAU, TAU) - 250.0;
  vec2 i = p;
  float c = 1.0;
  float inten = 0.005;
  for (int n = 0; n < 4; n++) {
    float tt = t * (1.0 - (3.5 / float(n + 1)));
    i = p + vec2(cos(tt - i.x) + sin(tt + i.y), sin(tt - i.y) + cos(tt + i.x));
    c += 1.0 / length(vec2(p.x / (sin(i.x + tt) / inten), p.y / (cos(i.y + tt) / inten)));
  }
  c /= 4.0;
  c = 1.17 - pow(c, 1.4);
  return pow(abs(c), 5.0);
}

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 345.45));
  p += dot(p, p + 34.345);
  return fract(p.x * p.y);
}

// drifting marine-snow specks (two layers)
float snow(vec2 uv, float t) {
  float m = 0.0;
  for (int k = 0; k < 2; k++) {
    float fk = float(k);
    float scale = 9.0 + fk * 7.0;
    vec2 gv = uv * scale;
    gv.y += t * (0.06 + fk * 0.03);      // slow downward drift
    gv.x += sin(t * 0.2 + fk) * 0.3;     // gentle sway
    vec2 id = floor(gv);
    vec2 f = fract(gv) - 0.5;
    float h = hash21(id + fk * 37.0);
    vec2 off = (vec2(h, fract(h * 57.0)) - 0.5) * 0.7;
    float d = length(f - off);
    float size = 0.03 + 0.04 * h;
    m += smoothstep(size, 0.0, d) * (0.4 + 0.6 * h);
  }
  return m;
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_res.xy;
  float aspect = u_res.x / u_res.y;
  float depth = 1.0 - uv.y;              // 0 surface (top) .. 1 deep (bottom)
  float x = uv.x * aspect;
  float t = u_time;

  // Sunlit shallows turquoise -> deep blue
  vec3 top = vec3(0.18, 0.70, 0.78);
  vec3 bot = vec3(0.02, 0.12, 0.28);
  vec3 col = mix(top, bot, smoothstep(-0.1, 1.1, depth));

  // God rays from the surface, fading with depth
  float ray = pow(surf(x + depth * 0.2, t) * 0.5 + 0.5, 2.2);
  col += vec3(0.55, 1.0, 0.92) * ray * mix(0.5, 0.0, depth) * 0.5;

  // Caustic shimmer, strongest near the surface
  float caust = caustic(vec2(x, uv.y) * 3.0, t * 0.4 + 12.0);
  col += vec3(0.6, 1.0, 0.95) * caust * (1.0 - depth) * 0.35;

  // Marine snow
  col += vec3(0.85, 0.97, 1.0) * snow(vec2(x, uv.y), t) * 0.5;

  gl_FragColor = vec4(col, 1.0);
}
`;

function compile(gl, type, src) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    console.error("Shader error:", gl.getShaderInfoLog(sh));
  }
  return sh;
}

export default function CausticsCanvas({ mode = "topdown" }) {
  const ref = useRef(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;

    const gl = canvas.getContext("webgl");
    if (!gl) return; // CSS fallback colour kicks in (see globals.css)

    // Build the program with the shader for this mode.
    const program = gl.createProgram();
    gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERT));
    gl.attachShader(
      program,
      compile(
        gl,
        gl.FRAGMENT_SHADER,
        mode === "depth"
          ? FRAG_DEPTH
          : mode === "subnautica"
            ? FRAG_SUBNAUTICA
            : FRAG_TOPDOWN
      )
    );
    gl.linkProgram(program);
    gl.useProgram(program);

    // A rectangle (two triangles) covering the whole screen.
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW
    );
    const loc = gl.getAttribLocation(program, "a_pos");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    const uTime = gl.getUniformLocation(program, "u_time");
    const uRes = gl.getUniformLocation(program, "u_res");

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(window.innerWidth * dpr);
      canvas.height = Math.floor(window.innerHeight * dpr);
      gl.viewport(0, 0, canvas.width, canvas.height);
    }
    resize();
    window.addEventListener("resize", resize);

    // Respect "reduce motion": draw a single still frame instead of animating.
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let raf;
    const start = performance.now();
    function draw(now) {
      const t = reduce ? 8.0 : (now - start) / 1000;
      gl.uniform1f(uTime, t);
      gl.uniform2f(uRes, canvas.width, canvas.height);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      if (!reduce) raf = requestAnimationFrame(draw);
    }
    raf = requestAnimationFrame(draw);

    // Cleanup when leaving the page / switching mode.
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    };
  }, [mode]);

  return <canvas ref={ref} aria-hidden className="caustics-canvas" />;
}
