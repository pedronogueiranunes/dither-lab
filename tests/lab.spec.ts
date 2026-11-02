import { unzipSync } from "fflate";
import { test, expect } from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";
const algorithms = [
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
];
async function loadState(page: any, extra: Record<string, unknown> = {}) {
  const hash = Buffer.from(
    JSON.stringify({ width: 480, aspect: 1.5, ...extra }),
  ).toString("base64");
  await page.goto("/#" + hash);
  await expect(page.locator("#compile-status")).toHaveText("Compilado");
  await expect(page.locator("#stats")).toContainText(
    String(extra.width ?? 480) + " ×",
  );
}
async function colors(page: any) {
  return page.locator("canvas").evaluate((c: HTMLCanvasElement) => {
    const gl = c.getContext("webgl2")!,
      p = new Uint8Array(c.width * c.height * 4);
    gl.readPixels(0, 0, c.width, c.height, gl.RGBA, gl.UNSIGNED_BYTE, p);
    const set = new Set<string>();
    for (let i = 0; i < p.length; i += 4)
      set.add(`${p[i]},${p[i + 1]},${p[i + 2]}`);
    return set.size;
  });
}
test("GPU, CPU worker, compilation recovery, responsive layout", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await loadState(page);
  await expect.poll(() => colors(page)).toBeGreaterThan(1);
  await page.setViewportSize({ width: 1440, height: 1050 });
  await page.screenshot({ path: "test-results/desktop.png", fullPage: true });
  for (const algorithm of algorithms) {
    await page
      .getByRole("combobox", { name: "Algoritmo", exact: true })
      .selectOption({ label: algorithm });
    await page.waitForTimeout(150);
    await expect.poll(() => colors(page)).toBeGreaterThan(1);
  }
  await page.locator("#use-shader").click();
  const before = await page.locator("#code").inputValue();
  await page.locator("#code").fill("void main(){BROKEN;}");
  await expect(page.locator("#errors")).toBeVisible();
  expect(await colors(page)).toBeGreaterThan(1);
  await page.locator("#code").fill(before);
  await expect(page.locator("#errors")).toBeHidden();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "test-results/mobile.png", fullPage: true });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});
test("exports PNG, both SVG modes, GIF, ZIP, WebM and offline HTML", async ({
  page,
  context,
}) => {
  await loadState(page, { width: 160, duration: 1, fps: 12, paused: true });
  for (const format of ["PNG", "SVG", "GIF", "ZIP", "WebM", "Código HTML"]) {
    const event = page.waitForEvent("download");
    await page
      .locator(".export-grid button")
      .getByText(format, { exact: true })
      .click();
    const download = await event;
    const path = await download.path();
    expect(path).toBeTruthy();
    const data = await readFile(path!);
    expect(data.length).toBeGreaterThan(50);
    if (format === "PNG") expect(data.subarray(1, 4).toString()).toBe("PNG");
    if (format === "GIF")
      expect(data.subarray(0, 6).toString()).toMatch(/GIF8[79]a/);
    if (format === "ZIP") expect(data.subarray(0, 2).toString()).toBe("PK");
    if (format === "SVG") expect(data.toString()).toContain("<rect");
    if (format === "ZIP") {
      const frames = unzipSync(data);
      expect(Object.keys(frames)).toHaveLength(12);
      expect(
        Buffer.from(frames["frame-00000.png"]).subarray(1, 4).toString(),
      ).toBe("PNG");
    }
    if (["PNG", "GIF", "SVG", "WebM"].includes(format)) {
      const mime = (
        {
          PNG: "image/png",
          GIF: "image/gif",
          SVG: "image/svg+xml",
          WebM: "video/webm",
        } as Record<string, string>
      )[format];
      const dimensions = await page.evaluate(
        async ({ encoded, mime, video }) => {
          const url = "data:" + mime + ";base64," + encoded;
          if (video) {
            const v = document.createElement("video");
            v.src = url;
            await new Promise<void>((resolve, reject) => {
              v.onloadedmetadata = () => resolve();
              v.onerror = () => reject(Error("Video decode failed"));
            });
            return [v.videoWidth, v.videoHeight];
          }
          const image = new Image();
          image.src = url;
          await image.decode();
          return [image.naturalWidth, image.naturalHeight];
        },
        { encoded: data.toString("base64"), mime, video: format === "WebM" },
      );
      expect(dimensions).toEqual([160, 107]);
    }

    if (format === "Código HTML") {
      const offline = await context.newPage();
      const errors: string[] = [];
      offline.on("pageerror", (e) => errors.push(e.message));
      await writeFile("/tmp/dither-standalone-test.html", data);
      await offline.route(/^https?:/, (route) => route.abort());
      await offline.goto("file:///tmp/dither-standalone-test.html");
      await expect.poll(() => colors(offline)).toBeGreaterThan(1);
      expect(errors).toEqual([]);
      await offline.close();
    }
  }
  await loadState(page, {
    width: 160,
    algorithm: "Halftone",
    svgMode: "Halftone",
  });
  const downloaded = page.waitForEvent("download");
  await page.getByRole("button", { name: "SVG", exact: true }).click();
  expect(await readFile((await (await downloaded).path())!, "utf8")).toContain(
    "<circle",
  );
});
test("image, video and webcam work with every algorithm", async ({ page }) => {
  await loadState(page, { width: 160 });
  const input = page.locator("#media-file");
  const image = await page.evaluate(() => {
    const c = document.createElement("canvas");
    c.width = 32;
    c.height = 32;
    const x = c.getContext("2d")!,
      gradient = x.createLinearGradient(0, 0, 32, 32);
    gradient.addColorStop(0, "#000");
    gradient.addColorStop(1, "#fff");
    x.fillStyle = gradient;
    x.fillRect(0, 0, 32, 32);
    return c.toDataURL().split(",")[1];
  });
  await input.setInputFiles({
    name: "gradient.png",
    mimeType: "image/png",
    buffer: Buffer.from(image, "base64"),
  });
  const check = async () => {
    for (const algorithm of algorithms) {
      await page
        .getByRole("combobox", { name: "Algoritmo", exact: true })
        .selectOption({ label: algorithm });
      await page.waitForTimeout(100);
      await expect.poll(() => colors(page)).toBeGreaterThan(1);
    }
  };
  await expect(
    page
      .getByRole("combobox", { name: "Entrada", exact: true })
      .locator("option:checked"),
  ).toHaveText("Imagem");
  await check();
  const video = await page.evaluate(async () => {
    const c = document.createElement("canvas");
    c.width = 64;
    c.height = 64;
    const x = c.getContext("2d")!;
    x.fillStyle = "#fff";
    x.fillRect(0, 0, 64, 64);
    x.fillStyle = "#000";
    x.fillRect(0, 0, 32, 64);
    const stream = c.captureStream(12),
      recorder = new MediaRecorder(stream, { mimeType: "video/webm" }),
      chunks: Blob[] = [];
    return await new Promise<string>((resolve) => {
      recorder.ondataavailable = (e) => chunks.push(e.data);
      recorder.onstop = () => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result).split(",")[1]);
        r.readAsDataURL(new Blob(chunks, { type: "video/webm" }));
        stream.getTracks().forEach((t) => t.stop());
      };
      recorder.start();
      setTimeout(() => recorder.stop(), 300);
    });
  });
  await input.setInputFiles({
    name: "sample.webm",
    mimeType: "video/webm",
    buffer: Buffer.from(video, "base64"),
  });
  await check();
  await page
    .getByRole("combobox", { name: "Entrada", exact: true })
    .selectOption({ label: "Webcam" });
  await page.waitForTimeout(400);
  await expect(
    page
      .getByRole("combobox", { name: "Entrada", exact: true })
      .locator("option:checked"),
  ).toHaveText("Webcam");
  await check();
});

test("Worker matches synchronous diffusion for every kernel and extension renders", async ({
  page,
}) => {
  await loadState(page, { width: 160, paused: true });
  const result = await page.evaluate(async () => {
    const rendererPath = "/src/renderer.ts",
      statePath = "/src/state.ts";
    const { Renderer } = await import(rendererPath),
      { defaults, cpuAlgorithms } = await import(statePath);
    const state = structuredClone(defaults);
    state.width = 160;
    state.cpuWidth = 64;
    const r = new Renderer(document.createElement("canvas"), state);
    const matches: boolean[] = [];
    try {
      for (const algorithm of cpuAlgorithms) {
        state.algorithm = algorithm;
        r.render(1.25);
        for (let i = 0; i < 200 && !(r as any).cpuReady; i++) {
          r.render(1.25);
          await new Promise((resolve) => setTimeout(resolve, 10));
        }
        if (!(r as any).cpuReady) throw Error("Worker did not respond");
        r.render(1.25);
        const asyncResult = r.pixels().data;
        r.render(1.25, true);
        const syncResult = r.pixels().data;
        matches.push(
          asyncResult.every((v: number, i: number) => v === syncResult[i]),
        );
      }
    } finally {
      r.dispose();
    }
    return matches;
  });
  expect(result).toEqual([true, true, true, true, true]);
  await page
    .getByRole("combobox", { name: "Algoritmo", exact: true })
    .selectOption({ label: "Posterize (exemplo)" });
  await expect.poll(() => colors(page)).toBeGreaterThan(1);
});
