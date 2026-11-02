export type RGB = [number, number, number];
export function linear(v: number) {
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}
export function oklab(rgb: RGB): RGB {
  const [r, g, b] = rgb.map(linear);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b),
    m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b),
    s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}
export function nearestColor(rgb: RGB, palette: RGB[], space = "OKLab"): RGB {
  const transform =
    space === "OKLab" ? oklab : (c: RGB) => c.map(linear) as RGB;
  const c = transform(rgb);
  let best = palette[0],
    d = Infinity;
  for (const p of palette) {
    const t = transform(p),
      n = t.reduce((a, v, i) => a + (v - c[i]) ** 2, 0);
    if (n < d) {
      d = n;
      best = p;
    }
  }
  return best;
}
const kernels: Record<string, { div: number; taps: number[][] }> = {
  "Floyd–Steinberg": {
    div: 16,
    taps: [
      [1, 0, 7],
      [-1, 1, 3],
      [0, 1, 5],
      [1, 1, 1],
    ],
  },
  Atkinson: {
    div: 8,
    taps: [
      [1, 0, 1],
      [2, 0, 1],
      [-1, 1, 1],
      [0, 1, 1],
      [1, 1, 1],
      [0, 2, 1],
    ],
  },
  "Jarvis–Judice–Ninke": {
    div: 48,
    taps: [
      [1, 0, 7],
      [2, 0, 5],
      [-2, 1, 3],
      [-1, 1, 5],
      [0, 1, 7],
      [1, 1, 5],
      [2, 1, 3],
      [-2, 2, 1],
      [-1, 2, 3],
      [0, 2, 5],
      [1, 2, 3],
      [2, 2, 1],
    ],
  },
  Stucki: {
    div: 42,
    taps: [
      [1, 0, 8],
      [2, 0, 4],
      [-2, 1, 2],
      [-1, 1, 4],
      [0, 1, 8],
      [1, 1, 4],
      [2, 1, 2],
      [-2, 2, 1],
      [-1, 2, 2],
      [0, 2, 4],
      [1, 2, 2],
      [2, 2, 1],
    ],
  },
  Sierra: {
    div: 32,
    taps: [
      [1, 0, 5],
      [2, 0, 3],
      [-2, 1, 2],
      [-1, 1, 4],
      [0, 1, 5],
      [1, 1, 4],
      [2, 1, 2],
      [-1, 2, 2],
      [0, 2, 3],
      [1, 2, 2],
    ],
  },
};
export interface DiffusionOptions {
  algorithm: string;
  serpentine: boolean;
  levels: number;
  strength: number;
  mono: boolean;
}
export function diffuse(
  input: Uint8Array,
  w: number,
  h: number,
  o: DiffusionOptions,
): Uint8Array {
  const work = Float32Array.from(input, (v) => v / 255),
    out = new Uint8Array(input.length),
    kernel = kernels[o.algorithm] ?? kernels["Floyd–Steinberg"];
  for (let y = 0; y < h; y++) {
    const dir = o.serpentine && y % 2 ? -1 : 1;
    for (let step = 0; step < w; step++) {
      const x = dir === 1 ? step : w - 1 - step,
        i = (y * w + x) * 4;
      if (o.mono) {
        const l =
          0.2126 * work[i] + 0.7152 * work[i + 1] + 0.0722 * work[i + 2];
        work[i] = work[i + 1] = work[i + 2] = l;
      }
      for (let c = 0; c < 3; c++) {
        const old = work[i + c],
          q =
            Math.round(Math.max(0, Math.min(1, old)) * (o.levels - 1)) /
            (o.levels - 1);
        out[i + c] = Math.round(q * 255);
        const error = (old - q) * o.strength;
        for (const [dx, dy, weight] of kernel.taps) {
          const nx = x + dx * dir,
            ny = y + dy;
          if (nx >= 0 && nx < w && ny < h)
            work[(ny * w + nx) * 4 + c] += (error * weight) / kernel.div;
        }
      }
      out[i + 3] = 255;
    }
  }
  return out;
}
