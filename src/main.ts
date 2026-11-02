import "./style.css";
import { Renderer } from "./renderer";
import { controls, layout } from "./ui";
import {
  defaults,
  preset,
  validate,
  encode,
  decode,
  cpuAlgorithms,
  type State,
} from "./state";
import { download, image, svg, standaloneHTML, animation } from "./export";
layout();
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
  notice("O link contém um preset inválido. Abrimos o preset padrão.");
}
const code = $<HTMLTextAreaElement>("code");
try {
  renderer = new Renderer($<HTMLCanvasElement>("canvas"), state);
} catch (e) {
  notice(String(e));
  $("compile-status").textContent = "WebGL indisponível";
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
    $("compile-status").textContent = "Compilado";
    $("compile-status").style.color = "";
  } catch (e) {
    $("errors").textContent =
      String(e) +
      "\nO último shader válido continua rodando. Com o cabeçalho automático, a linha do corpo começa na linha 9.";
    $("errors").hidden = false;
    $("compile-status").textContent = "Erro no shader";
    $("compile-status").style.color = "#ffb4a5";
  }
  changed();
}
function changed() {
  renderer.state = state;
  $("effect-label").textContent = state.algorithm;
  $("engine").textContent = cpuAlgorithms.includes(state.algorithm as any)
    ? "CPU / WORKER"
    : "GPU";
  $("play").textContent = state.paused ? "Reproduzir" : "Pausar";
  $("play").setAttribute(
    "aria-label",
    state.paused ? "Reproduzir animação" : "Pausar animação",
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
        throw Error("A webcam precisa de HTTPS ou localhost.");
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
      notice(`Não foi possível abrir a webcam: ${String(e)}`);
      state.source = "Procedural";
      ui.refresh();
    }
  } else if (state.source === "Imagem" || state.source === "Vídeo") {
    if (
      !renderer.media ||
      (state.source === "Vídeo") !== renderer.media instanceof HTMLVideoElement
    ) {
      notice("Abra um arquivo ou arraste para o canvas.");
      $("media-file").click();
    }
  } else {
    if (stream) cleanupMedia();
  }
  if (token <= sourceToken) changed();
}
async function loadMedia(file: File) {
  if (!/^image\//.test(file.type) && !/^video\//.test(file.type)) {
    notice("Escolha um arquivo de imagem ou vídeo.");
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
        video.onerror = () => reject(Error("Formato de vídeo não suportado"));
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
      reader.onerror = () => reject(Error("Falha ao ler arquivo"));
      reader.readAsDataURL(file);
    });
    if (token !== sourceToken) return;
    mediaData = loadedData;
    ui.refresh();
    changed();
    notice(`${file.name} carregado. Seu arquivo fica neste navegador.`);
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
    notice(`Preset não aplicado. ${String(e)}`);
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
      "O preset guarda parâmetros. Reabra o arquivo local para usar a fonte original.",
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
    notice("Link do preset copiado. Arquivos locais não são incluídos.");
  } catch (e) {
    notice(`Não foi possível copiar o link: ${String(e)}`);
  }
}
function buildUI() {
  ui = controls($("controls"), state, {
    change: changed,
    source: () => void source(),
    upload: () => $("media-file").click(),
    preset: (name) => void apply(preset(name)),
    save: () => {
      const name = prompt("Nome para o preset", "Meu preset");
      if (!name?.trim()) return;
      try {
        const saved = JSON.parse(
          localStorage.getItem("dither-presets") || "{}",
        );
        saved[name] = state;
        localStorage.setItem("dither-presets", JSON.stringify(saved));
        notice("Preset salvo neste navegador.");
      } catch {
        notice("Não foi possível salvar. Exporte o preset em JSON.");
      }
    },
    load: () => {
      try {
        const saved = JSON.parse(
            localStorage.getItem("dither-presets") || "{}",
          ),
          names = Object.keys(saved);
        if (!names.length) {
          notice("Você ainda não salvou um preset.");
          return;
        }
        const name = prompt(
          `Qual preset carregar?\n${names.join("\n")}`,
          names[0],
        );
        if (name && saved[name]) void apply(validate(saved[name]));
      } catch (e) {
        notice(String(e));
      }
    },
    import: () => $("preset-file").click(),
    json: () =>
      download(
        new Blob([JSON.stringify(state, null, 2)], {
          type: "application/json",
        }),
        "dither-preset.json",
      ),
    share: () => void share(),
    export: (format) => void exportAs(format),
  });
}
let controller: AbortController | null = null;
async function exportAs(format: string) {
  if (exporting) {
    notice("Aguarde a exportação atual ou cancele.");
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
      if (n) notice(`SVG exportado · ${n.toLocaleString("pt-BR")} elementos.`);
    } else if (format === "HTML") await standaloneHTML(renderer, mediaData);
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
      notice(`${format} exportado.`);
    }
  } catch (e) {
    notice(
      e instanceof DOMException && e.name === "AbortError"
        ? "Exportação cancelada."
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
$("png").onclick = () => void exportAs("PNG");
$("share").onclick = () => void share();
$("compile").onclick = compile;
$("play").onclick = () => {
  if (exporting) return;
  state.paused = !state.paused;
  if (renderer.media instanceof HTMLVideoElement) {
    if (state.paused) renderer.media.pause();
    else void renderer.media.play();
  }
  changed();
};
$("copy").onclick = () =>
  void navigator.clipboard
    .writeText(code.value)
    .then(() => notice("GLSL copiado."))
    .catch(() =>
      notice("Não foi possível copiar. Selecione o código no editor."),
    );
$("use-shader").onclick = () => {
  state.source = "Shader";
  void source();
  ui.refresh();
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
  $("compile-status").textContent = "Compilando…";
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
$<HTMLInputElement>("preset-file").onchange = async (e) => {
  const input = e.target as HTMLInputElement;
  try {
    if (input.files?.[0])
      await apply(validate(JSON.parse(await input.files[0].text())));
  } catch (err) {
    notice(`Não foi possível importar: ${String(err)}`);
  }
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
    notice(`Link inválido: ${String(e)}`);
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
  notice("Reabra o arquivo local para usar a fonte deste preset.");
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
    $("clock").textContent = `${time.toFixed(2)} s`;
    frames++;
    if (now - sample >= 1000) {
      fps = Math.round((frames * 1000) / (now - sample));
      frames = 0;
      sample = now;
    }
    $("stats").textContent =
      `${renderer.canvas.width} × ${renderer.canvas.height} · ${fps} fps`;
  }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
