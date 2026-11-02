import { describe, it, expect } from "vitest";
import { diffuse, nearestColor, oklab, type RGB } from "./diffusion";
import { blueNoise } from "./blue-noise";
import { defaults, validate, encode, decode, cpuAlgorithms } from "../state";
const gray = (w: number, h: number) => {
  const p = new Uint8Array(w * h * 4);
  for (let i = 0; i < p.length; i += 4) {
    p[i] = p[i + 1] = p[i + 2] = 128;
    p[i + 3] = 255;
  }
  return p;
};
describe("error diffusion", () => {
  it("Floyd–Steinberg produces about 50% white pixels in a 4×4 50% gray image", () => {
    const result = diffuse(gray(4, 4), 4, 4, {
      algorithm: "Floyd–Steinberg",
      serpentine: false,
      levels: 2,
      strength: 1,
      mono: true,
    });
    const whites = Array.from(result).filter(
      (v, i) => i % 4 === 0 && v === 255,
    ).length;
    expect(whites).toBeGreaterThanOrEqual(7);
    expect(whites).toBeLessThanOrEqual(9);
  });
  for (const algorithm of cpuAlgorithms)
    it(`${algorithm} is deterministic, preserves alpha and quantizes channels`, () => {
      for (const serpentine of [false, true]) {
        const opts = {
          algorithm,
          serpentine,
          levels: 2,
          strength: 1,
          mono: false,
        };
        const p = gray(8, 6),
          out = diffuse(p, 8, 6, opts);
        expect(out).toEqual(diffuse(p, 8, 6, opts));
        expect(p).toEqual(gray(8, 6));
        for (let i = 0; i < out.length; i++)
          expect(i % 4 === 3 ? [255] : [0, 255]).toContain(out[i]);
      }
    });
});
describe("palette", () => {
  const palette: RGB[] = [
    [0, 0, 0],
    [1, 0, 0],
    [1, 1, 1],
  ];
  for (const space of ["Linear", "OKLab"])
    it(`chooses nearest ${space} color`, () => {
      expect(nearestColor([0.94, 0.05, 0.02], palette, space)).toEqual([
        1, 0, 0,
      ]);
      expect(nearestColor([0.01, 0.01, 0.01], palette, space)).toEqual([
        0, 0, 0,
      ]);
    });
  it("OKLab white has unit lightness", () =>
    expect(oklab([1, 1, 1])[0]).toBeCloseTo(1, 4));
});
it("blue-noise ranks cover every byte evenly and repeat deterministically", () => {
  const noise = blueNoise(16);
  expect(new Set(noise).size).toBe(256);
  expect(noise).toEqual(blueNoise(16));
});
it("Unicode state round trips through URL base64", () => {
  const state = { ...defaults, code: defaults.code + "\n// ação" };
  expect(decode(encode(state))).toEqual(state);
});
it("bounds imported values and rejects malformed inputs", () => {
  expect(validate({ ...defaults, width: 999999 }).width).toBe(1920);
  expect(() => validate(null)).toThrow();
  expect(validate({ ...defaults, colors: ["bad"] }).colors).toEqual(
    defaults.colors,
  );
});
