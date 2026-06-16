"use client";
// Full-screen WebGL canvas: Subnautica shallows — turquoise water, god rays,
// and caustic shimmer. The caustic style is chosen by the `variant` prop:
//   variant="grid"  -> original tiling caustic (can look grid-like)
//   variant="noise" -> domain-warped noise (organic, non-repeating)
//
// WebGL only runs in the browser, so this is a Client Component.

import { useEffect, useRef } from "react";

const VERT = `
attribute vec2 a_pos;
void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }
`;

// Shared top of the fragment shader (water + god-ray helper).
const FRAG_HEADER = `
precision highp float;
uniform float u_time;
uniform vec2 u_res;
#define TAU 6.28318530718

float surf(float x, float t) {
  float s = 0.0;
  s += sin(x * 5.0 + t * 1.0);
  s += 0.6 * sin(x * 9.0 - t * 1.4);
  s += 0.35 * sin(x * 15.0 + t * 0.7);
  return s / 1.95;
}
`;

// Original tiling caustic — repeats with mod(), which can look grid-like.
const CAUSTIC_GRID = `
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
`;

// value noise + fBm + domain warping -> organic, non-repeating ripples.
const CAUSTIC_NOISE = `
float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    v += a * vnoise(p);
    p = p * 2.0 + vec2(11.3, 7.1);
    a *= 0.5;
  }
  return v;
}
float caustic(vec2 uv, float t) {
  vec2 w = vec2(fbm(uv + vec2(0.0, t * 0.12)),
                fbm(uv + vec2(5.2, -t * 0.10)));
  float n = fbm(uv + 1.8 * w + t * 0.05);
  float c = 1.0 - abs(2.0 * n - 1.0);
  return pow(c, 3.5);
}
`;

// The shared main(). `scale` and `bright` are GLSL float literals (strings).
function mainSrc(scale, bright) {
  return `
void main() {
  vec2 uv = gl_FragCoord.xy / u_res.xy;
  float aspect = u_res.x / u_res.y;
  float depth = 1.0 - uv.y;
  float x = uv.x * aspect;
  float t = u_time;

  vec3 top = vec3(0.18, 0.70, 0.78);
  vec3 bot = vec3(0.02, 0.12, 0.28);
  vec3 col = mix(top, bot, smoothstep(-0.1, 1.1, depth));

  float ray = pow(surf(x + depth * 0.2, t) * 0.5 + 0.5, 2.2);
  col += vec3(0.55, 1.0, 0.92) * ray * mix(0.5, 0.0, depth) * 0.5;

  float caust = caustic(vec2(x, uv.y) * ${scale}, t * 0.4 + 12.0);
  col += vec3(0.6, 1.0, 0.95) * caust * (1.0 - depth) * ${bright};

  gl_FragColor = vec4(col, 1.0);
}
`;
}

const FRAG_GRID = FRAG_HEADER + CAUSTIC_GRID + mainSrc("3.0", "0.35");
const FRAG_NOISE = FRAG_HEADER + CAUSTIC_NOISE + mainSrc("2.2", "0.5");

function compile(gl, type, src) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    console.error("Shader error:", gl.getShaderInfoLog(sh));
  }
  return sh;
}

export default function CausticsCanvas({ variant = "noise" }) {
  const ref = useRef(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;

    const gl = canvas.getContext("webgl");
    if (!gl) return; // CSS fallback colour kicks in

    const program = gl.createProgram();
    gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERT));
    gl.attachShader(
      program,
      compile(gl, gl.FRAGMENT_SHADER, variant === "grid" ? FRAG_GRID : FRAG_NOISE)
    );
    gl.linkProgram(program);
    gl.useProgram(program);

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

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    };
  }, [variant]);

  return <canvas ref={ref} aria-hidden className="caustics-canvas" />;
}
