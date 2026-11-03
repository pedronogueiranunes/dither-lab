import { t } from "./i18n";
import { extensions } from "./effects/registry.generated";
export const algorithms = [
  "Threshold",
  "Bayer 2×2",
  "Bayer 4×4",
  "Bayer 8×8",
  "Blue noise",
  "Halftone",
  "White noise",
  "Floyd–Steinberg",
  "Atkinson",
  "Jarvis–Judice–Ninke",
  "Stucki",
  "Sierra",
  ...extensions.map((e) => e.name),
] as const;
export const cpuAlgorithms = algorithms.slice(7, 12);
export const palettes: Record<string, string[]> = {
  "1-bit": ["#141714", "#f0efdf"],
  "Game Boy": ["#0f380f", "#306230", "#8bac0f", "#9bbc0f"],
  CGA: ["#000000", "#55ffff", "#ff55ff", "#ffffff"],
  "PICO-8": [
    "#000000",
    "#1d2b53",
    "#7e2553",
    "#008751",
    "#ab5236",
    "#5f574f",
    "#c2c3c7",
    "#fff1e8",
    "#ff004d",
    "#ffa300",
    "#ffec27",
    "#00e436",
    "#29adff",
    "#83769c",
    "#ff77a8",
    "#ffccaa",
  ],
  Sépia: ["#241b16", "#73513a", "#bc9568", "#f0dfb5"],
  Duotone: ["#172447", "#f9a77b"],
  Personalizada: ["#101820", "#f2f0df"],
};
export const defaultCode = `// WebGL2 · uniforms: u_time, u_resolution, u_mouse, u_tex
// Write the output color to outColor.
void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  vec2 p = (uv - 0.5) * vec2(u_resolution.x/u_resolution.y, 1.0);
  float wave = sin(p.x*9.0 + u_time) + cos(p.y*8.0 - u_time*0.7);
  float rings = sin(length(p)*20.0 - u_time*1.5);
  vec3 color = 0.5 + 0.5*cos(wave + rings + vec3(0.0,2.0,4.0));
  outColor = vec4(color, 1.0);
}`;
export interface State {
  source: string;
  procedural: string;
  algorithm: string;
  width: number;
  aspect: number;
  brightness: number;
  contrast: number;
  gamma: number;
  pixel: number;
  levels: number;
  strength: number;
  scale: number;
  mono: boolean;
  angle: number;
  cell: number;
  shape: string;
  serpentine: boolean;
  cpuWidth: number;
  palette: string;
  colors: string[];
  distance: string;
  code: string;
  compare: number;
  paused: boolean;
  exportScale: number;
  duration: number;
  fps: number;
  svgMode: string;
}
export const defaults: State = {
  source: "Procedural",
  procedural: "Plasma",
  algorithm: "Bayer 4×4",
  width: 960,
  aspect: 1.5,
  brightness: 0,
  contrast: 1,
  gamma: 1,
  pixel: 2,
  levels: 2,
  strength: 1,
  scale: 2,
  mono: false,
  angle: 45,
  cell: 8,
  shape: "Pontos",
  serpentine: true,
  cpuWidth: 320,
  palette: "Game Boy",
  colors: [...palettes["Game Boy"]],
  distance: "OKLab",
  code: defaultCode,
  compare: 0,
  paused: false,
  exportScale: 1,
  duration: 3,
  fps: 24,
  svgMode: "Pixel",
};
export const presets: Record<string, Partial<State>> = {
  "Game Boy Bayer": {},
  "Halftone jornal": {
    algorithm: "Halftone",
    palette: "1-bit",
    mono: true,
    procedural: "Formas",
    pixel: 1,
    cell: 8,
  },
  "Atkinson Mac clássico": {
    algorithm: "Atkinson",
    palette: "1-bit",
    mono: true,
    procedural: "Gradiente",
  },
  "Blue noise duotone": {
    algorithm: "Blue noise",
    palette: "Duotone",
    procedural: "Noise",
    scale: 1,
  },
  "Plasma 1-bit": {
    source: "Shader",
    algorithm: "Bayer 8×8",
    palette: "1-bit",
    mono: true,
  },
  "CGA interferência": {
    algorithm: "Sierra",
    palette: "CGA",
    procedural: "Plasma",
  },
  "PICO cosmos": {
    algorithm: "Bayer 2×2",
    palette: "PICO-8",
    procedural: "Formas",
    levels: 4,
  },
};
export function preset(name: string): State {
  const s = { ...structuredClone(defaults), ...presets[name] };
  s.colors = [...palettes[s.palette]];
  return s;
}
export function validate(value: unknown): State {
  if (!value || typeof value !== "object")
    throw Error(t("Preset inválido: use um objeto JSON."));
  const v = value as Record<string, unknown>;
  const s = structuredClone(defaults);
  for (const key of Object.keys(s) as (keyof State)[])
    if (typeof v[key] === typeof s[key] && key !== "colors")
      (s as unknown as Record<string, unknown>)[key] = v[key];
  if (
    Array.isArray(v.colors) &&
    v.colors.length >= 2 &&
    v.colors.length <= 16 &&
    v.colors.every((c) => typeof c === "string" && /^#[0-9a-f]{6}$/i.test(c))
  )
    s.colors = [...v.colors];
  const bounds: Partial<Record<keyof State, number[]>> = {
    width: [160, 1920],
    aspect: [0.5, 3],
    brightness: [-1, 1],
    contrast: [0, 3],
    gamma: [0.1, 3],
    pixel: [1, 24],
    levels: [2, 16],
    strength: [0, 1],
    scale: [1, 16],
    angle: [0, 180],
    cell: [2, 64],
    cpuWidth: [64, 640],
    compare: [0, 1],
    duration: [1, 30],
    fps: [1, 60],
    exportScale: [1, 4],
  };
  for (const [k, [a, b]] of Object.entries(bounds)) {
    const n = Number((s as any)[k]);
    (s as any)[k] = Number.isFinite(n)
      ? Math.min(b, Math.max(a, n))
      : (defaults as any)[k];
  }
  if (!algorithms.includes(s.algorithm as any))
    s.algorithm = defaults.algorithm;
  if (!["Procedural", "Imagem", "Webcam", "Vídeo", "Shader"].includes(s.source))
    s.source = "Procedural";
  if (s.code.length > 100000)
    throw Error(t("Shader muito grande. Limite: 100 mil caracteres."));
  return s;
}
export function encode(s: State) {
  return btoa(
    Array.from(new TextEncoder().encode(JSON.stringify(s)), (b) =>
      String.fromCharCode(b),
    ).join(""),
  );
}
export function decode(hash: string) {
  return validate(
    JSON.parse(
      new TextDecoder().decode(
        Uint8Array.from(atob(hash), (c) => c.charCodeAt(0)),
      ),
    ),
  );
}
