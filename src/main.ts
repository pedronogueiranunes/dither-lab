import "./style.css";
import { Renderer } from "./renderer";
import { controls, layout } from "./ui";
import {
  defaults,
  preset,
  validate,
  encode,
  decode,
  type State,
} from "./state";
import {
  download,
  image,
  svg,
  standaloneHTML,
  animation,
  wallpaper,
  wallpapers,
  type Wallpaper,
} from "./export";
import { t, lang, setLang, translateDom, type Lang } from "./i18n";
layout();
setLang(lang);
translateDom();
const $ = <T extends HTMLElement>(id: string) =>
  document.getElementById(id) as T;
let state: State = structuredClone(defaults),
  ui: ReturnType<typeof controls>,
  renderer: Renderer;
let time = 0,
  last = performance.now(),
  exporting = false,
  stream: MediaStream | null = null,
  mediaURL: string | null = null,
  mediaData: string | null = null,
  sourceToken = 0,
  noticeTimer = 0;
function notice(text: string) {
  $("notice").textContent = text;
  $("notice").hidden = false;
  clearTimeout(noticeTimer);
  noticeTimer = window.setTimeout(() => ($("notice").hidden = true), 6500);
}
try {
  if (location.hash) state = decode(location.hash.slice(1));
} catch {
  notice(t("O link contém um preset inválido. Abrimos o preset padrão."));
}
const code = $<HTMLTextAreaElement>("code");
try {
  renderer = new Renderer($<HTMLCanvasElement>("canvas"), state);
} catch (e) {
  notice(String(e));
  throw e;
}
function updateLines() {
  document.querySelector(".line-numbers")!.textContent = Array.from(
    { length: code.value.split("\n").length },
    (_, i) => i + 1,
  ).join("\n");
}
function compile() {
  try {
    renderer.compile(code.value);
    state.code = code.value;
    $("errors").hidden = true;
  } catch (e) {
    // ponytail: last valid shader keeps running; body line N = error line N+8.
    $("errors").textContent = String(e);
    $("errors").hidden = false;
  }
  changed();
}
function changed() {
  renderer.state = state;
  $("editor").hidden = state.source !== "Shader";
  $("play").textContent = t(state.paused ? "Reproduzir" : "Pausar");
  $("play").setAttribute(
    "aria-label",
    t(state.paused ? "Reproduzir animação" : "Pausar animação"),
  );
  $<HTMLInputElement>("compare").value = String(state.compare);
  if (!exporting) renderer.render(time);
}
function cleanupMedia() {
  sourceToken++;
  stream?.getTracks().forEach((t) => t.stop());
  stream = null;
  if (renderer.media instanceof HTMLVideoElement) {
    renderer.media.pause();
    renderer.media.srcObject = null;
    renderer.media.removeAttribute("src");
    renderer.media.load();
  }
  renderer.media = null;
  if (mediaURL) URL.revokeObjectURL(mediaURL);
  mediaURL = null;
  mediaData = null;
}
async function source() {
  const token = ++sourceToken;
  if (state.source === "Webcam") {
    cleanupMedia();
    const token = sourceToken;
    try {
      if (!navigator.mediaDevices?.getUserMedia)
        throw Error(t("A webcam precisa de HTTPS ou localhost."));
      const camera = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false,
      });
      if (token !== sourceToken || state.source !== "Webcam") {
        camera.getTracks().forEach((t) => t.stop());
        return;
      }
      stream = camera;
      const video = document.createElement("video");
      video.muted = true;
      video.playsInline = true;
      video.srcObject = camera;
      await video.play();
      if (state.paused) video.pause();
      renderer.media = video;
    } catch (e) {
      notice(t("Não foi possível abrir a webcam: {0}", e));
      state.source = "Procedural";
      ui.refresh();
    }
  } else if (state.source === "Imagem" || state.source === "Vídeo") {
    if (
      !renderer.media ||
      (state.source === "Vídeo") !== renderer.media instanceof HTMLVideoElement
    ) {
      notice(t("Abra um arquivo ou arraste para o canvas."));
      $("media-file").click();
    }
  } else {
    if (stream) cleanupMedia();
  }
  if (token <= sourceToken) changed();
}
async function loadMedia(file: File) {
  if (file.type === "application/json" || file.name.endsWith(".json")) {
    try {
      await apply(validate(JSON.parse(await file.text())));
    } catch (e) {
      notice(t("Preset inválido: {0}", e));
    }
    return;
  }
  if (!/^image\//.test(file.type) && !/^video\//.test(file.type)) {
    notice(t("Use uma imagem, um vídeo ou um preset JSON."));
    return;
  }
  cleanupMedia();
  const token = sourceToken;
  mediaURL = URL.createObjectURL(file);
  try {
    if (file.type.startsWith("video/")) {
      const video = document.createElement("video");
      video.src = mediaURL;
      video.muted = true;
      video.loop = true;
      video.playsInline = true;
      await new Promise<void>((resolve, reject) => {
        video.onloadeddata = () => resolve();
        video.onerror = () =>
          reject(Error(t("Formato de vídeo não suportado")));
      });
      if (token !== sourceToken) return;
      await video.play();
      if (state.paused) video.pause();
      renderer.media = video;
      state.source = "Vídeo";
    } else {
      const image = new Image();
      image.src = mediaURL;
      await image.decode();
      if (token !== sourceToken) return;
      renderer.media = image;
      state.source = "Imagem";
    }
    const loadedData = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(Error(t("Falha ao ler arquivo")));
      reader.readAsDataURL(file);
    });
    if (token !== sourceToken) return;
    mediaData = loadedData;
    ui.refresh();
    changed();
  } catch (e) {
    if (token === sourceToken) {
      cleanupMedia();
      state.source = "Procedural";
      ui.refresh();
      notice(String(e));
    }
  }
}
async function apply(next: State) {
  try {
    renderer.compile(next.code);
  } catch (e) {
    notice(t("Preset não aplicado. {0}", e));
    return;
  }
  cleanupMedia();
  Object.assign(state, next);
  code.value = state.code;
  updateLines();
  ui.dispose();
  buildUI();
  $("errors").hidden = true;
  if (["Imagem", "Vídeo"].includes(state.source)) {
    state.source = "Procedural";
    notice(
      t(
        "O preset guarda parâmetros. Reabra o arquivo local para usar a fonte original.",
      ),
    );
    ui.refresh();
  } else if (state.source === "Webcam") await source();
  changed();
}
async function share() {
  try {
    const hash = encode(state);
    history.replaceState(null, "", "#" + hash);
    await navigator.clipboard.writeText(location.href);
    notice(t("Link copiado."));
  } catch (e) {
    notice(t("Não foi possível copiar o link: {0}", e));
  }
}
function buildUI() {
  ui = controls($("controls"), state, {
    change: changed,
    source: () => void source(),
    upload: () => $("media-file").click(),
    preset: (name) => void apply(preset(name)),
    export: (format) => void exportAs(format),
  });
}
let controller: AbortController | null = null;
async function exportAs(format: string) {
  if (exporting) {
    notice(t("Aguarde a exportação atual ou cancele."));
    return;
  }
  exporting = true;
  const oldPaused = state.paused;
  controller = new AbortController();
  try {
    if (format === "PNG" || format === "JPG" || format === "WebP")
      await image(renderer, format);
    else if (format === "SVG") {
      const n = svg(renderer);
      if (n)
        notice(
          t(
            "SVG exportado · {0} elementos.",
            n.toLocaleString(lang === "pt" ? "pt-BR" : "en"),
          ),
        );
    } else if (format === "HTML") await standaloneHTML(renderer, mediaData);
    else if (format in wallpapers)
      await wallpaper(renderer, format as Wallpaper);
    else if (format === "JSON")
      download(
        new Blob([JSON.stringify(state, null, 2)], {
          type: "application/json",
        }),
        "dither-preset.json",
      );
    else {
      $("progress").hidden = false;
      await animation(
        renderer,
        format as "GIF" | "ZIP" | "WebM" | "MP4",
        (v) => {
          $<HTMLProgressElement>("progress").value = v;
          $("progress-label").textContent =
            `${format} · ${Math.round(v * 100)}%`;
        },
        controller.signal,
      );
      notice(t("{0} exportado.", format));
    }
  } catch (e) {
    notice(
      e instanceof DOMException && e.name === "AbortError"
        ? t("Exportação cancelada.")
        : String(e),
    );
  } finally {
    exporting = false;
    state.paused = oldPaused;
    controller = null;
    $("progress").hidden = true;
    renderer.render(time);
    last = performance.now();
  }
}
$("cancel").onclick = () => controller?.abort();
$("share").onclick = () => void share();
const syncLang = () =>
  document
    .querySelectorAll<HTMLElement>("[data-lang]")
    .forEach((b) =>
      b.setAttribute("aria-pressed", String(b.dataset.lang === lang)),
    );
document.querySelectorAll<HTMLElement>("[data-lang]").forEach(
  (b) =>
    (b.onclick = () => {
      setLang(b.dataset.lang as Lang);
      translateDom();
      syncLang();
      ui.dispose();
      buildUI();
      changed();
    }),
);
syncLang();
$("play").onclick = () => {
  if (exporting) return;
  state.paused = !state.paused;
  if (renderer.media instanceof HTMLVideoElement) {
    if (state.paused) renderer.media.pause();
    else void renderer.media.play();
  }
  changed();
};
$<HTMLInputElement>("compare").oninput = (e) => {
  state.compare = Number((e.target as HTMLInputElement).value);
  changed();
};
let debounce = 0;
code.value = state.code;
updateLines();
code.oninput = () => {
  updateLines();
  clearTimeout(debounce);
  debounce = window.setTimeout(compile, 300);
};
code.onscroll = () => {
  document.querySelector(".line-numbers")!.scrollTop = code.scrollTop;
};
code.onkeydown = (e) => {
  if (e.key === "Tab") {
    e.preventDefault();
    code.setRangeText("  ", code.selectionStart, code.selectionEnd, "end");
    code.dispatchEvent(new Event("input"));
  }
};
$<HTMLInputElement>("media-file").onchange = (e) => {
  const input = e.target as HTMLInputElement;
  if (input.files?.[0]) void loadMedia(input.files[0]);
  input.value = "";
};
const drop = $("dropzone");
drop.ondragover = (e) => {
  e.preventDefault();
  drop.classList.add("dragging");
};
drop.ondragleave = () => drop.classList.remove("dragging");
drop.ondrop = (e) => {
  e.preventDefault();
  drop.classList.remove("dragging");
  if (e.dataTransfer?.files[0]) void loadMedia(e.dataTransfer.files[0]);
};
window.addEventListener("keydown", (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
    e.preventDefault();
    clearTimeout(debounce);
    compile();
    return;
  }
  if (
    (e.target as HTMLElement).closest("input,textarea,select,button") ||
    e.metaKey ||
    e.ctrlKey ||
    e.altKey
  )
    return;
  if (e.code === "Space") {
    e.preventDefault();
    $("play").click();
  } else if (e.key.toLowerCase() === "s") {
    e.preventDefault();
    void exportAs("PNG");
  } else if (e.key.toLowerCase() === "r") {
    e.preventDefault();
    if (exporting) controller?.abort();
    else void exportAs("WebM");
  }
});
window.addEventListener("hashchange", () => {
  try {
    void apply(decode(location.hash.slice(1)));
  } catch (e) {
    notice(t("Link inválido: {0}", e));
  }
});
window.addEventListener("beforeunload", () => {
  cleanupMedia();
  renderer.dispose();
});
buildUI();
changed();
if (state.source === "Webcam") void source();
else if (["Imagem", "Vídeo"].includes(state.source)) {
  notice(t("Reabra o arquivo local para usar a fonte deste preset."));
}
let frames = 0,
  fps = 0,
  sample = performance.now();
function loop(now: number) {
  const dt = Math.min((now - last) / 1000, 0.1);
  last = now;
  if (!exporting) {
    if (!state.paused) time += dt;
    renderer.render(time);
    frames++;
    if (now - sample >= 500) {
      fps = Math.round((frames * 1000) / (now - sample));
      
      frames = 0;
      sample = now;
      $("stats").textContent =
        `${renderer.canvas.width} × ${renderer.canvas.height} · ${fps} fps`;
    }
  }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
