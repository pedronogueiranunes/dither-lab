import { Pane } from "tweakpane";
import {
  algorithms,
  cpuAlgorithms,
  palettes,
  presets,
  preset,
  type State,
} from "./state";
export interface Actions {
  change: () => void;
  source: () => void;
  upload: () => void;
  preset: (name: string) => void;
  save: () => void;
  load: () => void;
  import: () => void;
  json: () => void;
  share: () => void;
  export: (format: string) => void;
}
const options = (items: readonly string[]) =>
  Object.fromEntries(items.map((i) => [i, i]));
export function controls(container: HTMLElement, s: State, a: Actions) {
  const pane = new Pane({ container });
  const bind = (
    folder: any,
    key: keyof State,
    label: string,
    params: Record<string, unknown> = {},
  ) => {
    const binding = folder
      .addBinding(s, key, { label, ...params })
      .on("change", a.change);
    binding.element
      .querySelectorAll("input,select")
      .forEach((el: HTMLElement) => el.setAttribute("aria-label", label));
    return binding;
  };
  const p = pane.addFolder({ title: "PONTO DE PARTIDA" });
  const currentPreset =
    Object.keys(presets).find((name) => {
      const candidate = preset(name);
      return (["source", "procedural", "algorithm", "palette"] as const).every(
        (key) => candidate[key] === s[key],
      );
    }) ?? "Personalizado";
  const selection = { preset: currentPreset };
  p.addBinding(selection, "preset", {
    label: "Preset",
    options: options([...Object.keys(presets), "Personalizado"]),
  }).on("change", (e) => e.value !== "Personalizado" && a.preset(e.value));
  const src = pane.addFolder({ title: "FONTE" });
  bind(src, "source", "Entrada", {
    options: options(["Procedural", "Imagem", "Webcam", "Vídeo", "Shader"]),
  }).on("change", a.source);
  bind(src, "procedural", "Gerador", {
    options: options(["Gradiente", "Noise", "Formas", "Plasma"]),
  });
  src.addButton({ title: "Abrir imagem ou vídeo…" }).on("click", a.upload);
  const pre = pane.addFolder({ title: "PRÉ-PROCESSAMENTO", expanded: false });
  bind(pre, "brightness", "Brilho", { min: -1, max: 1, step: 0.01 });
  bind(pre, "contrast", "Contraste", { min: 0, max: 3, step: 0.01 });
  bind(pre, "gamma", "Gamma", { min: 0.1, max: 3, step: 0.01 });
  bind(pre, "pixel", "Pixel", { min: 1, max: 24, step: 1 });
  const fx = pane.addFolder({ title: "DITHERING" });
  bind(fx, "algorithm", "Algoritmo", { options: options(algorithms) });
  bind(fx, "levels", "Níveis / canal", { min: 2, max: 16, step: 1 });
  bind(fx, "strength", "Força", { min: 0, max: 1, step: 0.01 });
  bind(fx, "scale", "Escala", { min: 1, max: 16, step: 1 });
  bind(fx, "mono", "Monocromático");
  const half = fx.addFolder({ title: "Halftone", expanded: false });
  bind(half, "shape", "Forma", {
    options: options(["Pontos", "Linhas", "Cruz"]),
  });
  bind(half, "angle", "Ângulo", { min: 0, max: 180, step: 1 });
  bind(half, "cell", "Célula", { min: 2, max: 64, step: 1 });
  const cpu = fx.addFolder({ title: "Difusão de erro · CPU", expanded: false });
  bind(cpu, "serpentine", "Serpentina");
  bind(cpu, "cpuWidth", "Largura de trabalho", {
    options: { "160 px": 160, "320 px": 320, "480 px": 480, "640 px": 640 },
  });
  const pal = pane.addFolder({ title: "PALETA" });
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
  container.append(colorsRoot);
  function rebuildColors() {
    colorsRoot.replaceChildren();
    s.colors.forEach((color, i) => {
      const input = document.createElement("input");
      input.type = "color";
      input.value = color;
      input.setAttribute("aria-label", `Cor ${i + 1}`);
      input.title = `Cor ${i + 1}: ${color}`;
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
    add.title = "Adicionar cor";
    add.setAttribute("aria-label", "Adicionar cor");
    add.disabled = s.colors.length >= 16;
    add.onclick = () => {
      s.colors.push("#ffffff");
      s.palette = "Personalizada";
      rebuildColors();
      a.change();
      pane.refresh();
    };
    remove.textContent = "−";
    remove.title = "Remover última cor";
    remove.setAttribute("aria-label", "Remover última cor");
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
  const render = pane.addFolder({
    title: "RENDER & EXPORTAÇÃO",
    expanded: false,
  });
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
  bind(render, "exportScale", "Escala imagem", {
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
  ]) {
    const b = document.createElement("button");
    b.textContent = format === "HTML" ? "Código HTML" : format;
    b.onclick = () => a.export(format);
    exports.append(b);
  }
  container.append(exports);
  const state = pane.addFolder({
    title: "PRESETS & COMPARTILHAMENTO",
    expanded: false,
  });
  for (const [title, fn] of [
    ["Salvar no navegador", a.save],
    ["Carregar salvo", a.load],
    ["Importar JSON", a.import],
    ["Exportar JSON", a.json],
    ["Copiar link", a.share],
  ] as const)
    state.addButton({ title }).on("click", fn);
  pane.on("change", () => {
    half.hidden = s.algorithm !== "Halftone";
    cpu.hidden = !cpuAlgorithms.includes(s.algorithm as any);
  });
  half.hidden = s.algorithm !== "Halftone";
  cpu.hidden = !cpuAlgorithms.includes(s.algorithm as any);
  return {
    dispose() {
      pane.dispose();
      colorsRoot.remove();
      exports.remove();
    },
    refresh: () => {
      pane.refresh();
      rebuildColors();
    },
  };
}
export function layout() {
  document.querySelector("#app")!.innerHTML = `
<header class="app-header"><a class="wordmark" href="./" aria-label="Dither Lab início"><span class="brand-pixels" aria-hidden="true"></span>Dither<span class="muted">Lab</span><span class="version">/ 1.0</span></a><span class="header-note">Menos cores. Mais possibilidades.</span><button id="share" class="quiet">Compartilhar preset <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M4 12 12 4M4 4h8v8"/></svg></button></header>
<main class="workspace"><section class="studio" aria-label="Preview e editor"><div class="toolbar"><div class="toolbar-title"><span class="status-dot"></span><span id="effect-label">Bayer 4×4</span><span class="tag" id="engine">GPU</span></div><div class="toolbar-actions"><button id="play" aria-label="Pausar animação">Pausar</button><button id="png" class="accent">Exportar PNG <kbd>S</kbd></button></div></div>
<div class="viewport" id="dropzone"><canvas id="canvas" aria-label="Resultado do dithering"></canvas><div class="drop-hint" aria-hidden="true">Solte sua imagem ou vídeo aqui</div></div>
<div class="canvas-footer"><span id="stats">960 × 640</span><label class="comparison">Antes <input id="compare" type="range" min="0" max="1" step="0.001" value="0" aria-label="Comparar antes e depois"> Depois</label><span id="clock">0.00 s</span></div>
<section class="editor" aria-label="Editor de fragment shader"><div class="editor-bar"><div><strong>Fragment shader</strong><span class="file-label">custom.frag</span></div><div><span id="compile-status">Compilado</span><button id="copy" class="quiet">Copiar GLSL</button><button id="compile" class="quiet">Compilar <kbd>⌘ ↵</kbd></button></div></div><div class="editor-body"><div class="line-numbers" aria-hidden="true"></div><textarea id="code" spellcheck="false" aria-label="Código GLSL" autocapitalize="off" autocomplete="off" autocorrect="off"></textarea></div><pre id="errors" role="alert" hidden></pre><div class="editor-tip">O código é usado na fonte <button id="use-shader">Shader personalizado</button>. <span>Recompilação ao vivo · 300 ms</span></div></section>
</section><aside class="sidebar" aria-label="Controles"><div class="panel-heading"><h1>Seu laboratório.</h1><p>Explore o espaço entre os pixels.</p></div><div id="controls"></div><div class="panel-note">fonte → pré-processamento → dither → paleta</div></aside></main>
<footer class="app-footer"><span>Feito de pixels. Rodando no seu navegador.</span><span><kbd>espaço</kbd> pausar <kbd>S</kbd> PNG <kbd>R</kbd> gravar</span></footer>
<div id="notice" role="status" hidden></div><div class="export-progress" id="progress" hidden><span id="progress-label">Exportando…</span><progress max="1" value="0"></progress><button id="cancel">Cancelar</button></div>
<input id="media-file" type="file" accept="image/*,video/*" hidden><input id="preset-file" type="file" accept="application/json,.json" hidden>`;
}
