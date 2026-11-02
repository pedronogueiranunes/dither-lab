import { GIFEncoder, applyPalette } from "gifenc";
import { zipSync } from "fflate";
import type { Renderer } from "./renderer";
import standalone from "./standalone.generated.txt?raw";
export function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}
export function scaledCanvas(renderer: Renderer, scale = 1) {
  const { data, width, height } = renderer.pixels();
  const base = document.createElement("canvas");
  base.width = width;
  base.height = height;
  base
    .getContext("2d")!
    .putImageData(
      new ImageData(new Uint8ClampedArray(data), width, height),
      0,
      0,
    );
  if (scale === 1) return base;
  const out = document.createElement("canvas");
  out.width = width * scale;
  out.height = height * scale;
  const ctx = out.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(base, 0, 0, out.width, out.height);
  return out;
}
function blob(canvas: HTMLCanvasElement, type = "image/png", quality?: number) {
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (b) =>
        b && b.type === type
          ? resolve(b)
          : reject(Error(`Este navegador não gera ${type}.`)),
      type,
      quality,
    ),
  );
}
const stills = {
  PNG: ["image/png", "png"],
  JPG: ["image/jpeg", "jpg"],
  WebP: ["image/webp", "webp"],
} as const;
export type StillFormat = keyof typeof stills;
export async function image(r: Renderer, format: StillFormat = "PNG") {
  const [type, ext] = stills[format];
  r.render(r.time, true);
  const canvas = scaledCanvas(r, r.state.exportScale);
  // ponytail: dithered pixels are sharp edges; high quality keeps JPG artifacts low.
  download(await blob(canvas, type, 0.95), `dither-lab.${ext}`);
}
const hex = (data: Uint8Array, i: number) =>
  "#" +
  [0, 1, 2].map((c) => data[i + c].toString(16).padStart(2, "0")).join("");
export function svg(r: Renderer) {
  r.render(r.time, true);
  const halftone = r.state.svgMode === "Halftone";
  const { data, width, height } = r.pixels(halftone);
  const nodes: string[] = [];
  const s = r.state;
  const addNode = (node: string) => {
    if (
      nodes.length === 200000 &&
      !confirm(
        "Este SVG ultrapassou 200 mil elementos e pode ficar pesado. Continuar?",
      )
    ) {
      throw new DOMException("Exportação SVG cancelada", "AbortError");
    }
    nodes.push(node);
  };
  if (!halftone) {
    for (let y = 0; y < height; y++) {
      let x = 0;
      while (x < width) {
        const color = hex(data, (y * width + x) * 4);
        let end = x + 1;
        while (end < width && hex(data, (y * width + end) * 4) === color) end++;
        addNode(
          `<rect x="${x}" y="${y}" width="${end - x}" height="1" fill="${color}"/>`,
        );
        x = end;
      }
    }
  } else {
    const cell = s.cell,
      a = (s.angle * Math.PI) / 180,
      cs = Math.cos(a),
      sn = Math.sin(a),
      extent = Math.ceil(Math.hypot(width, height) / cell);
    addNode(`<rect width="100%" height="100%" fill="${s.colors.at(-1)}"/>`);
    for (let y = -extent; y <= extent; y++)
      for (let x = -extent; x <= extent; x++) {
        const px = (x + 0.5) * cell * cs - (y + 0.5) * cell * sn,
          py = (x + 0.5) * cell * sn + (y + 0.5) * cell * cs;
        if (px < 0 || py < 0 || px >= width || py >= height) continue;
        const i = (Math.floor(py) * width + Math.floor(px)) * 4,
          l =
            (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) /
            255,
          ink = 1 - l,
          screenY = height - py;
        const color = s.colors[0];
        if (s.shape === "Pontos")
          addNode(
            `<circle cx="${px.toFixed(2)}" cy="${screenY.toFixed(2)}" r="${(Math.sqrt(ink / Math.PI) * cell).toFixed(2)}" fill="${color}"/>`,
          );
        else {
          const stroke =
            s.shape === "Cruz" ? (1 - Math.sqrt(1 - ink)) * cell : ink * cell;
          const line = (dx: number, dy: number) =>
            `<line x1="${(px - dx).toFixed(2)}" y1="${(screenY + dy).toFixed(2)}" x2="${(px + dx).toFixed(2)}" y2="${(screenY - dy).toFixed(2)}" stroke="${color}" stroke-width="${stroke.toFixed(2)}"/>`;
          addNode(line((cs * cell) / 2, (sn * cell) / 2));
          if (s.shape === "Cruz")
            addNode(line((-sn * cell) / 2, (cs * cell) / 2));
        }
      }
  }
  download(
    new Blob(
      [
        `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" shape-rendering="${halftone ? "geometricPrecision" : "crispEdges"}">${nodes.join("")}</svg>`,
      ],
      { type: "image/svg+xml" },
    ),
    "dither-lab.svg",
  );
  return nodes.length;
}
export async function standaloneHTML(r: Renderer, mediaData: string | null) {
  let media = mediaData;
  if (r.state.source === "Webcam" && r.media) {
    const c = document.createElement("canvas");
    c.width = r.canvas.width;
    c.height = r.canvas.height;
    c.getContext("2d")!.drawImage(r.media, 0, 0, c.width, c.height);
    media = c.toDataURL();
  }
  const config = JSON.stringify({
    state: r.state,
    time: r.time,
    media,
    mediaType:
      r.state.source === "Webcam"
        ? "image"
        : r.media instanceof HTMLVideoElement
          ? "video"
          : "image",
  }).replace(/</g, "\\u003c");
  const safeRuntime = standalone.replace(/<\/script/gi, "<\\/script");
  download(
    new Blob(
      [
        `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Dither Lab · export</title><style>html,body{margin:0;background:#171917;height:100%;display:grid;place-items:center}canvas{max-width:100vw;max-height:100vh;image-rendering:pixelated}p{color:#fff;position:fixed;bottom:0;font:12px monospace}</style><canvas></canvas><p></p><script>window.__DITHER__=${config};${safeRuntime}</script></html>`,
      ],
      { type: "text/html" },
    ),
    "dither-lab.html",
  );
}
export async function animation(
  r: Renderer,
  format: "GIF" | "ZIP" | "WebM" | "MP4",
  onProgress: (v: number) => void,
  signal: AbortSignal,
) {
  const s = r.state,
    frames = Math.round(s.duration * s.fps),
    originalTime = r.time,
    media = r.media instanceof HTMLVideoElement ? r.media : null,
    mediaTime = media?.currentTime ?? 0,
    wasPaused = media?.paused ?? true;
  const abort = () => {
    if (signal.aborted)
      throw new DOMException("Exportação cancelada", "AbortError");
  };
  const seek = async (t: number) => {
    if (!media || !Number.isFinite(media.duration) || s.source === "Webcam")
      return;
    media.pause();
    const target = (mediaTime + t) % media.duration;
    if (Math.abs(media.currentTime - target) < 0.001) return;
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        cleanup();
        reject(Error("O vídeo não respondeu ao avanço de quadro."));
      }, 8000);
      function cleanup() {
        clearTimeout(timeout);
        media!.removeEventListener("seeked", done);
      }
      function done() {
        cleanup();
        resolve();
      }
      media.addEventListener("seeked", done);
      media.currentTime = target;
    });
  };
  let stream: MediaStream | undefined, recorder: MediaRecorder | undefined;
  try {
    if (format === "WebM" || format === "MP4") {
      if (!r.canvas.captureStream || typeof MediaRecorder === "undefined")
        throw Error(
          `Gravação ${format} indisponível neste navegador. Use GIF ou ZIP.`,
        );
      const mime = (
        format === "MP4"
          ? ["video/mp4;codecs=avc1", "video/mp4"]
          : ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"]
      ).find((m) => MediaRecorder.isTypeSupported(m));
      if (!mime)
        throw Error(
          `Este navegador não grava ${format}. Tente ${format === "MP4" ? "WebM" : "MP4"}, GIF ou ZIP.`,
        );
      stream = r.canvas.captureStream(s.fps);
      const chunks: Blob[] = [];
      recorder = new MediaRecorder(stream, { mimeType: mime });
      const done = new Promise<Blob>((resolve, reject) => {
        recorder!.ondataavailable = (e) => {
          if (e.data.size) chunks.push(e.data);
        };
        recorder!.onerror = () => reject(Error("A gravação falhou."));
        recorder!.onstop = () => resolve(new Blob(chunks, { type: mime }));
      });
      recorder.start();
      const start = performance.now();
      for (let f = 0; f < frames; f++) {
        abort();
        await seek(f / s.fps);
        r.render(originalTime + f / s.fps, true);
        onProgress((f + 1) / frames);
        await new Promise((resolve) =>
          setTimeout(
            resolve,
            Math.max(0, start + ((f + 1) * 1000) / s.fps - performance.now()),
          ),
        );
      }
      recorder.stop();
      download(await done, `dither-lab.${format === "MP4" ? "mp4" : "webm"}`);
    } else {
      if (frames * r.canvas.width * r.canvas.height > 400_000_000)
        throw Error(
          "Muitos pixels para exportar na memória. Reduza a resolução, duração ou FPS.",
        );
      if (s.source === "Webcam")
        throw Error(
          "Para animação determinística, use vídeo, imagem, gerador ou shader. A webcam pode ser gravada em WebM.",
        );
      const gif = format === "GIF" ? GIFEncoder() : null,
        files: Record<string, Uint8Array> = {},
        palette = s.colors.map((c) =>
          [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16)),
        );
      for (let f = 0; f < frames; f++) {
        abort();
        await seek(f / s.fps);
        r.render(originalTime + f / s.fps, true);
        if (gif) {
          const { data, width, height } = r.pixels();
          gif.writeFrame(applyPalette(data, palette), width, height, {
            palette,
            delay: 1000 / s.fps,
          });
        } else
          files[`frame-${String(f).padStart(5, "0")}.png`] = new Uint8Array(
            await (await blob(scaledCanvas(r))).arrayBuffer(),
          );
        onProgress((f + 1) / frames);
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
      if (gif) {
        gif.finish();
        download(new Blob([new Uint8Array(gif.bytes())]), "dither-lab.gif");
      } else
        download(
          new Blob([new Uint8Array(zipSync(files, { level: 0 }))]),
          "dither-lab.zip",
        );
    }
  } finally {
    if (recorder?.state === "recording") recorder.stop();
    stream?.getTracks().forEach((t) => t.stop());
    if (media && s.source !== "Webcam") {
      media.currentTime = mediaTime;
      if (!wasPaused) void media.play();
    }
    r.render(originalTime, true);
  }
}
