// Source strings are Portuguese (they double as state values); `en` maps them to English.
// ponytail: flat dictionary, swap for a library if a third language shows up.
const en: Record<string, string> = {
  // layout
  "Copiar link": "Copy link",
  Pausar: "Pause",
  Reproduzir: "Play",
  Original: "Original",
  "Solte o arquivo": "Drop the file",
  Cancelar: "Cancel",
  "Resultado do dithering": "Dithering output",
  "Código GLSL": "GLSL code",
  Controles: "Controls",
  "Comparar com o original": "Compare with original",
  "Pausar animação": "Pause animation",
  "Reproduzir animação": "Play animation",
  // panel
  Personalizado: "Custom",
  Fonte: "Source",
  Entrada: "Input",
  Gerador: "Generator",
  "Abrir arquivo…": "Open file…",
  Ajustes: "Adjust",
  Brilho: "Brightness",
  Contraste: "Contrast",
  Algoritmo: "Algorithm",
  Níveis: "Levels",
  Força: "Strength",
  Escala: "Scale",
  Monocromático: "Monochrome",
  Forma: "Shape",
  Ângulo: "Angle",
  Célula: "Cell",
  "Difusão de erro": "Error diffusion",
  Serpentina: "Serpentine",
  Largura: "Width",
  Paleta: "Palette",
  Coleção: "Set",
  Distância: "Distance",
  Cor: "Color",
  "Adicionar cor": "Add color",
  "Remover última cor": "Remove last color",
  Saída: "Output",
  Resolução: "Resolution",
  Proporção: "Aspect",
  "Duração (s)": "Duration (s)",
  "Wallpaper celular": "Phone wallpaper",
  "Wallpaper PC": "Desktop wallpaper",
  // option values
  Imagem: "Image",
  Vídeo: "Video",
  Gradiente: "Gradient",
  Formas: "Shapes",
  Pontos: "Dots",
  Linhas: "Lines",
  Cruz: "Cross",
  Sépia: "Sepia",
  Personalizada: "Custom",
  "Halftone jornal": "Newsprint halftone",
  "Atkinson Mac clássico": "Classic Mac Atkinson",
  "CGA interferência": "CGA interference",
  // notices & errors
  "O link contém um preset inválido. Abrimos o preset padrão.":
    "The link has an invalid preset. Loaded the default instead.",
  "A webcam precisa de HTTPS ou localhost.":
    "The webcam needs HTTPS or localhost.",
  "Não foi possível abrir a webcam: {0}": "Couldn't open the webcam: {0}",
  "Abra um arquivo ou arraste para o canvas.":
    "Open a file or drop it on the canvas.",
  "Preset inválido: {0}": "Invalid preset: {0}",
  "Use uma imagem, um vídeo ou um preset JSON.":
    "Use an image, a video or a JSON preset.",
  "Formato de vídeo não suportado": "Unsupported video format",
  "Falha ao ler arquivo": "Couldn't read the file",
  "Preset não aplicado. {0}": "Preset not applied. {0}",
  "O preset guarda parâmetros. Reabra o arquivo local para usar a fonte original.":
    "Presets store settings only. Reopen the local file to use the original source.",
  "Link copiado.": "Link copied.",
  "Não foi possível copiar o link: {0}": "Couldn't copy the link: {0}",
  "Aguarde a exportação atual ou cancele.":
    "Wait for the current export or cancel it.",
  "SVG exportado · {0} elementos.": "SVG exported · {0} elements.",
  "{0} exportado.": "{0} exported.",
  "Exportação cancelada.": "Export cancelled.",
  "Reabra o arquivo local para usar a fonte deste preset.":
    "Reopen the local file to use this preset's source.",
  "Link inválido: {0}": "Invalid link: {0}",
  "Este navegador não gera {0}.": "This browser can't encode {0}.",
  "Este SVG ultrapassou 200 mil elementos e pode ficar pesado. Continuar?":
    "This SVG passed 200k elements and may be heavy. Continue?",
  "Gravação {0} indisponível neste navegador. Use GIF ou ZIP.":
    "{0} recording isn't available in this browser. Use GIF or ZIP.",
  "Este navegador não grava {0}. Tente {1}, GIF ou ZIP.":
    "This browser can't record {0}. Try {1}, GIF or ZIP.",
  "A gravação falhou.": "Recording failed.",
  "O vídeo não respondeu ao avanço de quadro.":
    "The video didn't respond to frame seeking.",
  "Muitos pixels para exportar na memória. Reduza a resolução, duração ou FPS.":
    "Too many pixels to export in memory. Lower the resolution, duration or FPS.",
  "Para animação determinística, use vídeo, imagem, gerador ou shader. A webcam pode ser gravada em WebM.":
    "For deterministic animation use a video, image, generator or shader. The webcam can be recorded as WebM.",
  "Este navegador não oferece WebGL2. Abra em uma versão atual do Chrome, Firefox ou Safari.":
    "This browser has no WebGL2. Use a current Chrome, Firefox or Safari.",
  "Não foi possível criar o framebuffer. Reduza a resolução.":
    "Couldn't create the framebuffer. Lower the resolution.",
  "Preset inválido: use um objeto JSON.": "Invalid preset: use a JSON object.",
  "Shader muito grande. Limite: 100 mil caracteres.":
    "Shader too large. Limit: 100k characters.",
};

export type Lang = "en" | "pt";
const stored = (() => {
  try {
    return localStorage.getItem("lang");
  } catch {
    return null;
  }
})();
export let lang: Lang = stored === "pt" ? "pt" : "en";

export function setLang(next: Lang) {
  lang = next;
  document.documentElement.lang = next === "pt" ? "pt-BR" : "en";
  try {
    localStorage.setItem("lang", next);
  } catch {}
}

export const t = (key: string, ...args: unknown[]) =>
  (lang === "en" ? (en[key] ?? key) : key).replace(/\{(\d)\}/g, (_, i) =>
    String(args[i]),
  );

/** Re-label static markup: data-t → text, data-t-label → aria-label. */
export function translateDom(root: ParentNode = document) {
  root.querySelectorAll<HTMLElement>("[data-t]").forEach((el) => {
    el.firstChild!.textContent = t(el.dataset.t!);
  });
  root.querySelectorAll<HTMLElement>("[data-t-label]").forEach((el) => {
    el.setAttribute("aria-label", t(el.dataset.tLabel!));
  });
}
