import { Pane } from "tweakpane";
import {
  algorithms,
  cpuAlgorithms,
  palettes,
  presets,
  preset,
  type State,
} from "./state";
import { t } from "./i18n";
import { wallpapers } from "./export";
export interface Actions {
  change: () => void;
  source: () => void;
  upload: () => void;
  preset: (name: string) => void;
  export: (format: string) => void;
}
const options = (items: readonly string[]) =>
  Object.fromEntries(items.map((i) => [t(i), i]));
export function controls(container: HTMLElement, s: State, a: Actions) {
  const pane = new Pane({ container });
  const bind = (
    folder: any,
    key: keyof State,
    label: string,
    params: Record<string, unknown> = {},
  ) => {
    label = t(label);
    const binding = folder
      .addBinding(s, key, { label, ...params })
      .on("change", a.change);
    binding.element
      .querySelectorAll("input,select")
      .forEach((el: HTMLElement) => el.setAttribute("aria-label", label));
    return binding;
  };
  const currentPreset =
    Object.keys(presets).find((name) => {
      const candidate = preset(name);
      return (["source", "procedural", "algorithm", "palette"] as const).every(
        (key) => candidate[key] === s[key],
      );
    }) ?? "Personalizado";
  const selection = { preset: currentPreset };
  pane
    .addBinding(selection, "preset", {
      label: "Preset",
      options: options([...Object.keys(presets), "Personalizado"]),
    })
    .on("change", (e) => e.value !== "Personalizado" && a.preset(e.value));
  const src = pane.addFolder({ title: t("Fonte") });
  bind(src, "source", "Entrada", {
    options: options(["Procedural", "Imagem", "Webcam", "Vídeo", "Shader"]),
  }).on("change", a.source);
  const gen = bind(src, "procedural", "Gerador", {
    options: options(["Gradiente", "Noise", "Formas", "Plasma"]),
  });
  src.addButton({ title: t("Abrir arquivo…") }).on("click", a.upload);
  const pre = pane.addFolder({ title: t("Ajustes"), expanded: false });
  bind(pre, "brightness", "Brilho", { min: -1, max: 1, step: 0.01 });
  bind(pre, "contrast", "Contraste", { min: 0, max: 3, step: 0.01 });
  bind(pre, "gamma", "Gamma", { min: 0.1, max: 3, step: 0.01 });
  bind(pre, "pixel", "Pixel", { min: 1, max: 24, step: 1 });
  const fx = pane.addFolder({ title: t("Dither") });
  bind(fx, "algorithm", "Algoritmo", { options: options(algorithms) });
  bind(fx, "levels", "Níveis", { min: 2, max: 16, step: 1 });
  bind(fx, "strength", "Força", { min: 0, max: 1, step: 0.01 });
  bind(fx, "scale", "Escala", { min: 1, max: 16, step: 1 });
  bind(fx, "mono", "Monocromático");
  const half = fx.addFolder({ title: t("Halftone"), expanded: false });
  bind(half, "shape", "Forma", {
    options: options(["Pontos", "Linhas", "Cruz"]),
  });
  bind(half, "angle", "Ângulo", { min: 0, max: 180, step: 1 });
  bind(half, "cell", "Célula", { min: 2, max: 64, step: 1 });
  const cpu = fx.addFolder({ title: t("Difusão de erro"), expanded: false });
  bind(cpu, "serpentine", "Serpentina");
  bind(cpu, "cpuWidth", "Largura", {
    options: { "160 px": 160, "320 px": 320, "480 px": 480, "640 px": 640 },
  });
  const pal = pane.addFolder({ title: t("Paleta") });
  bind(pal, "palette", "Coleção", {
    options: options(Object.keys(palettes)),
  }).on("change", () => {
    s.colors = [...palettes[s.palette]];
    rebuildColors();
    a.change();
  });
  bind(pal, "distance", "Distância", { options: options(["OKLab", "Linear"]) });
  const colorsRoot = document.createElement("div");
  colorsRoot.className = "palette-editor";
  pal.element.querySelector(".tp-fldv_c")!.append(colorsRoot);
  function rebuildColors() {
    colorsRoot.replaceChildren();
    s.colors.forEach((color, i) => {
      const input = document.createElement("input");
      input.type = "color";
      input.value = color;
      input.setAttribute("aria-label", `${t("Cor")} ${i + 1}`);
      input.title = `${t("Cor")} ${i + 1}: ${color}`;
      input.oninput = () => {
        s.colors[i] = input.value;
        s.palette = "Personalizada";
        a.change();
        pane.refresh();
      };
      colorsRoot.append(input);
    });
    const add = document.createElement("button"),
      remove = document.createElement("button");
    add.textContent = "+";
    add.title = t("Adicionar cor");
    add.setAttribute("aria-label", t("Adicionar cor"));
    add.disabled = s.colors.length >= 16;
    add.onclick = () => {
      s.colors.push("#ffffff");
      s.palette = "Personalizada";
      rebuildColors();
      a.change();
      pane.refresh();
    };
    remove.textContent = "−";
    remove.title = t("Remover última cor");
    remove.setAttribute("aria-label", t("Remover última cor"));
    remove.disabled = s.colors.length <= 2;
    remove.onclick = () => {
      s.colors.pop();
      s.palette = "Personalizada";
      rebuildColors();
      a.change();
      pane.refresh();
    };
    colorsRoot.append(add, remove);
  }
  rebuildColors();
  const render = pane.addFolder({ title: t("Saída"), expanded: false });
  bind(render, "width", "Resolução", {
    options: {
      "480 px": 480,
      "720 px": 720,
      "960 px": 960,
      "1440 px": 1440,
      "1920 px": 1920,
    },
  });
  bind(render, "aspect", "Proporção", {
    options: { "3:2": 1.5, "16:9": 16 / 9, "1:1": 1, "9:16": 9 / 16 },
  });
  bind(render, "exportScale", "Escala", {
    options: { "1×": 1, "2×": 2, "4×": 4 },
  });
  bind(render, "svgMode", "SVG", { options: options(["Pixel", "Halftone"]) });
  bind(render, "duration", "Duração (s)", { min: 1, max: 30, step: 1 });
  bind(render, "fps", "FPS", {
    options: { "12": 12, "24": 24, "30": 30, "60": 60 },
  });
  const exports = document.createElement("div");
  exports.className = "export-grid";
  for (const format of [
    "PNG",
    "JPG",
    "WebP",
    "SVG",
    "MP4",
    "WebM",
    "GIF",
    "ZIP",
    "HTML",
    "JSON",
  ]) {
    const b = document.createElement("button");
    b.textContent = format;
    if (format === "PNG") b.title = "S";
    if (format === "WebM") b.title = "R";
    b.onclick = () => a.export(format);
    exports.append(b);
  }
  for (const kind of Object.keys(wallpapers) as (keyof typeof wallpapers)[]) {
    const [w, h] = wallpapers[kind],
      b = document.createElement("button");
    b.className = "wide";
    b.textContent = t(kind === "Phone" ? "Wallpaper celular" : "Wallpaper PC");
    b.title = `${w} × ${h}`;
    b.onclick = () => a.export(kind);
    exports.append(b);
  }
  container.append(exports);
  const sync = () => {
    gen.hidden = s.source !== "Procedural";
    half.hidden = s.algorithm !== "Halftone";
    cpu.hidden = !cpuAlgorithms.includes(s.algorithm as any);
  };
  pane.on("change", sync);
  sync();
  return {
    dispose() {
      pane.dispose();
      colorsRoot.remove();
      exports.remove();
    },
    refresh: () => {
      pane.refresh();
      sync();
      rebuildColors();
    },
  };
}
export function layout() {
  document.querySelector("#app")!.innerHTML = `
<header class="app-header"><a class="wordmark" href="./"><span class="brand-pixels" aria-hidden="true"></span>Dither Lab<span class="version">1.0</span></a><nav class="header-actions"><button id="share" class="quiet" data-t="Copiar link">Copiar link</button><div class="lang" role="group" aria-label="Language"><button class="quiet" data-lang="en">EN</button><button class="quiet" data-lang="pt">PT</button></div><a class="quiet site" href="https://pedronogueiranunes.github.io/" target="_blank" rel="noopener" aria-label="Pedro Nogueira"><span class="site-name">Pedro Nogueira </span>↗</a></nav></header>
<main class="workspace"><section class="studio">
<div class="viewport" id="dropzone"><canvas id="canvas" data-t-label="Resultado do dithering"></canvas><div class="drop-hint" aria-hidden="true" data-t="Solte o arquivo">Solte o arquivo</div></div>
<div class="canvas-bar"><div class="canvas-meta"><button id="play" class="quiet">Pausar</button><span id="stats"></span></div><label class="compare" data-t="Original">Original <input id="compare" type="range" min="0" max="1" step="0.001" value="0"></label></div>
<section class="editor" id="editor" aria-label="Fragment shader"><div class="editor-body"><div class="line-numbers" aria-hidden="true"></div><textarea id="code" spellcheck="false" data-t-label="Código GLSL" autocapitalize="off" autocomplete="off" autocorrect="off"></textarea></div><pre id="errors" role="alert" hidden></pre></section>
</section><aside class="sidebar" data-t-label="Controles"><div id="controls"></div></aside></main>
<div id="notice" role="status" hidden></div><div class="export-progress" id="progress" hidden><span id="progress-label"></span><progress max="1" value="0"></progress><button id="cancel" data-t="Cancelar">Cancelar</button></div>
<input id="media-file" type="file" accept="image/*,video/*,application/json,.json" hidden>`;
}
