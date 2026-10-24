"use client";

import { useEffect, useRef } from "react";

import { ENERGY, fakeVoice, prefersReducedMotion, type AvaState } from "./useLoop";

/*
 * The pearl: a liquid, iridescent drop of light with rays from its centre,
 * after the bubble clip Zander shared. Drawn by a small fragment shader.
 * The GL context only exists while the orb is on screen, so a page full
 * of orbs never runs out of contexts.
 */

const VERT = `attribute vec2 p; void main(){ gl_Position = vec4(p, 0., 1.); }`;

const FRAG = `
precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform float uEnergy;
uniform float uVoice;
uniform float uDark;

float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3. - 2. * f);
  return mix(mix(hash(i), hash(i + vec2(1., 0.)), u.x), mix(hash(i + vec2(0., 1.)), hash(i + vec2(1., 1.)), u.x), u.y);
}
float fbm(vec2 p){
  float v = 0., a = .5;
  for (int i = 0; i < 5; i++){ v += a * noise(p); p = p * 2.03 + vec2(1.7, 9.2); a *= .5; }
  return v;
}
// Soft pearl rainbow: sky, ice cyan, lilac.
vec3 irid(float t){ return vec3(.84, .9, .97) + vec3(.13, .1, .05) * cos(6.2831 * (vec3(.02, .30, .62) + t)); }

void main(){
  vec2 uv = (gl_FragCoord.xy - .5 * uRes) / (.5 * min(uRes.x, uRes.y));
  float t = uTime;
  float r = length(uv);
  float ang = atan(uv.y, uv.x);

  // A liquid edge: the rim wobbles, more when she is busy or talking.
  float wob = (noise(vec2(cos(ang), sin(ang)) * 1.6 + vec2(t * .35, t * .22)) - .5) * (.03 + .05 * uEnergy)
            + sin(ang * 3. + t * .8) * .007 * (1. + uEnergy)
            + sin(ang * 5. - t * 1.7) * .012 * uVoice;
  float edge = .69 + wob + uVoice * .035;
  float aa = 1.5 / min(uRes.x, uRes.y);
  float inside = 1. - smoothstep(edge - aa * 2., edge + aa * 2., r);

  vec2 q = uv / edge;
  float d2 = clamp(dot(q, q), 0., 1.);
  float z = sqrt(1. - d2);
  float fres = pow(1. - z, 2.4);

  // Veils of light drifting inside.
  vec2 p = q * 1.5;
  float warp = fbm(p * 2. - vec2(t * .05, t * .04));
  float flow = fbm(p * 1.25 + vec2(t * .06, -t * .045) + warp * 1.3);

  // Rays from the centre, like light through water.
  float qa = atan(q.y, q.x);
  float rays = pow(noise(vec2(cos(qa), sin(qa)) * 5. + vec2(flow * 1.5, t * .25)), 3.2);
  float fine = pow(abs(sin(qa * 9. + flow * 4. + t * .15)), 22.);
  float falloff = smoothstep(1.05, .05, sqrt(d2));
  float streak = (rays * .7 + fine * .45) * falloff * (.4 + .55 * uEnergy + .3 * uVoice);
  float core = exp(-d2 * (7. - 2.5 * uEnergy - 2. * uVoice)) * (.85 + .35 * uEnergy);

  vec3 film = irid(fres * 1.1 + flow * .55 + t * .015 + q.x * .12);
  vec3 body = mix(vec3(.84, .92, 1.), film, .5) + vec3(.7, .88, 1.) * (flow - .45) * .35;
  // On a dark room the body takes on the brand sky so it glows rather than greys.
  body = mix(body, mix(vec3(.16, .48, .82), film, .45) + vec3(.2, .45, .75) * flow, uDark * .55);

  vec3 col = body;
  col = mix(col, vec3(1.), clamp(core, 0., 1.));
  col += vec3(.86, .95, 1.) * streak;
  col = mix(col, film * 1.04, fres * .55);
  col += pow(fres, 7.) * .55;
  // A thin darker line inside the rim gives the drop a skin on light grounds.
  float skin = smoothstep(.86, .97, sqrt(d2)) * (1. - smoothstep(.97, 1., sqrt(d2)));
  col = mix(col, col * vec3(.78, .86, .96), skin * .35 * (1. - uDark));

  float spark = step(.996, hash(floor(gl_FragCoord.xy / 2.) + floor(t * 3.))) * falloff;
  col += spark * .5;

  float glow = exp(-max(0., r - edge) * (7.5 - 2. * uEnergy)) * (1. - inside) * (.28 + .3 * uEnergy + .25 * uVoice);
  glow *= 1. - smoothstep(.82, 1., r);
  vec3 glowCol = mix(vec3(.55, .78, .98), vec3(.45, .74, 1.), uDark);

  float alpha = clamp(inside + glow, 0., 1.);
  vec3 outc = clamp(col, 0., 1.) * inside + glowCol * glow;
  gl_FragColor = vec4(outc, alpha);
}`;

function compile(gl: WebGLRenderingContext, type: number, src: string) {
  const s = gl.createShader(type)!;
  gl.shaderSource(s, src);
  gl.compileShader(s);
  return s;
}

export function PearlOrb({
  size,
  state = "idle",
  dark = false,
  className,
}: {
  size: number;
  state?: AvaState;
  dark?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const target = useRef(ENERGY[state]);
  const voiceOn = useRef(false);
  const darkRef = useRef(dark ? 1 : 0);
  target.current = ENERGY[state];
  voiceOn.current = state === "speaking" || state === "listening";
  darkRef.current = dark ? 1 : 0;

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    let gl: WebGLRenderingContext | null = null;
    let raf = 0;
    let energy = target.current;
    const start = performance.now();
    const still = prefersReducedMotion();
    let u: Record<string, WebGLUniformLocation | null> = {};

    const setup = () => {
      gl = canvas.getContext("webgl", { premultipliedAlpha: true, alpha: true, antialias: true, preserveDrawingBuffer: true });
      if (!gl) return;
      const prog = gl.createProgram()!;
      gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT));
      gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAG));
      gl.linkProgram(prog);
      gl.useProgram(prog);
      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(prog, "p");
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      u = Object.fromEntries(["uRes", "uTime", "uEnergy", "uVoice", "uDark"].map((n) => [n, gl!.getUniformLocation(prog, n)]));
    };

    const teardown = () => {
      cancelAnimationFrame(raf);
      raf = 0;
      gl?.getExtension("WEBGL_lose_context")?.loseContext();
      gl = null;
    };

    const frame = (now: number) => {
      raf = 0;
      if (!gl) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const px = Math.round(canvas.clientWidth * dpr);
      if (canvas.width !== px) {
        canvas.width = px;
        canvas.height = px;
      }
      const t = still ? 3 : (now - start) / 1000;
      energy += (target.current - energy) * 0.05;
      gl.viewport(0, 0, px, px);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform2f(u.uRes, px, px);
      gl.uniform1f(u.uTime, t);
      gl.uniform1f(u.uEnergy, energy);
      gl.uniform1f(u.uVoice, fakeVoice(t, voiceOn.current));
      gl.uniform1f(u.uDark, darkRef.current);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      if (!still) raf = requestAnimationFrame(frame);
    };

    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) {
        if (!gl) setup();
        if (!raf) raf = requestAnimationFrame(frame);
      } else {
        teardown();
      }
    });
    io.observe(canvas);
    return () => {
      io.disconnect();
      teardown();
    };
  }, []);

  // Small pearls (beside messages, in the rail) are drawn in CSS: a page can
  // hold a dozen of them without using up the browser's WebGL contexts.
  if (size < 40) {
    return (
      <span
        className={`ad-mini-pearl ${state === "thinking" ? "is-busy" : ""} ${dark ? "is-dark" : ""} ${className ?? ""}`}
        style={{ width: size, height: size }}
        aria-hidden
      />
    );
  }

  // The canvas is larger than the drop so its glow has room.
  return (
    <span className={className} style={{ position: "relative", display: "inline-block", width: size, height: size, flexShrink: 0 }} aria-hidden>
      <canvas ref={ref} style={{ position: "absolute", left: "-22%", top: "-22%", width: "144%", height: "144%" }} />
    </span>
  );
}
