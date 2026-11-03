import { t } from "./i18n";
import { extensions } from "./effects/registry.generated";
import { algorithms, cpuAlgorithms, type State } from "./state";
import {
  vertex,
  header,
  source,
  preprocess,
  dither,
  palette,
  output,
} from "./effects/shaders";
import { blueNoise } from "./effects/blue-noise";
import { diffuse, linear, oklab, type RGB } from "./effects/diffusion";
type Target = {
  texture: WebGLTexture;
  fbo: WebGLFramebuffer;
  width: number;
  height: number;
};
export class Renderer {
  gl: WebGL2RenderingContext;
  programs: Record<string, WebGLProgram> = {};
  targets: Target[] = [];
  media: HTMLImageElement | HTMLVideoElement | null = null;
  mouse = [0, 0];
  time = 0;
  private mediaTex: WebGLTexture;
  private noiseTex: WebGLTexture;
  private cpuTex: WebGLTexture;
  private cpuReady = false;
  private worker: Worker | null = null;
  private busy = false;
  private generation = 0;
  private cpuGeneration = -1;
  private cpuKey = "";
  private uniformCache = new WeakMap<
    WebGLProgram,
    Map<string, WebGLUniformLocation | null>
  >();
  private paletteKey = "";
  private paletteColors: number[] = [];
  private paletteMetric: number[] = [];
  private requestGeneration = 0;
  constructor(
    public canvas: HTMLCanvasElement,
    public state: State,
    worker = true,
  ) {
    const gl = canvas.getContext("webgl2", {
      preserveDrawingBuffer: true,
      antialias: false,
      alpha: false,
    });
    if (!gl)
      throw Error(
        t(
          "Este navegador não oferece WebGL2. Abra em uma versão atual do Chrome, Firefox ou Safari.",
        ),
      );
    this.gl = gl;
    gl.bindVertexArray(gl.createVertexArray());
    for (const [name, frag] of Object.entries({
      source,
      preprocess,
      dither,
      palette,
      output,
    }))
      this.programs[name] = this.program(frag);
    for (const effect of extensions)
      this.programs["effect:" + effect.name] = this.program(
        effect.frag.trimStart().startsWith("#version")
          ? effect.frag
          : header +
              "uniform int u_levels,u_mono; uniform float u_strength,u_scale,u_angle,u_cell;\n" +
              effect.frag,
      );
    this.mediaTex = this.texture();
    this.cpuTex = this.texture();
    this.noiseTex = this.texture();
    gl.bindTexture(gl.TEXTURE_2D, this.noiseTex);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.R8,
      64,
      64,
      0,
      gl.RED,
      gl.UNSIGNED_BYTE,
      blueNoise(),
    );
    this.compile(state.code);
    if (worker) {
      this.worker = new Worker(
        new URL("./effects/diffusion.worker.ts", import.meta.url),
        { type: "module" },
      );
      this.worker.onmessage = ({ data }) => {
        this.busy = false;
        if (data.error) {
          console.error(data.error);
          return;
        }
        if (this.requestGeneration !== this.generation) {
          data.bitmap?.close();
          return;
        }
        gl.bindTexture(gl.TEXTURE_2D, this.cpuTex);
        if (data.bitmap) {
          gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
          gl.texImage2D(
            gl.TEXTURE_2D,
            0,
            gl.RGBA,
            gl.RGBA,
            gl.UNSIGNED_BYTE,
            data.bitmap,
          );
          data.bitmap.close();
        } else
          gl.texImage2D(
            gl.TEXTURE_2D,
            0,
            gl.RGBA,
            data.width,
            data.height,
            0,
            gl.RGBA,
            gl.UNSIGNED_BYTE,
            new Uint8Array(data.pixels),
          );
        this.cpuReady = true;
        this.cpuGeneration = this.generation;
      };
      this.worker.onerror = () => {
        this.busy = false;
        this.worker?.terminate();
        this.worker = null;
      };
    }
    canvas.addEventListener("pointermove", (e) => {
      const r = canvas.getBoundingClientRect();
      this.mouse = [
        ((e.clientX - r.left) / r.width) * canvas.width,
        (1 - (e.clientY - r.top) / r.height) * canvas.height,
      ];
    });
  }
  texture() {
    const g = this.gl,
      t = g.createTexture()!;
    g.bindTexture(g.TEXTURE_2D, t);
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MIN_FILTER, g.NEAREST);
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MAG_FILTER, g.NEAREST);
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_S, g.CLAMP_TO_EDGE);
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_T, g.CLAMP_TO_EDGE);
    g.texImage2D(
      g.TEXTURE_2D,
      0,
      g.RGBA,
      1,
      1,
      0,
      g.RGBA,
      g.UNSIGNED_BYTE,
      new Uint8Array([0, 0, 0, 255]),
    );
    return t;
  }
  program(frag: string) {
    const g = this.gl,
      shaders: WebGLShader[] = [];
    try {
      for (const [type, text] of [
        [g.VERTEX_SHADER, vertex],
        [g.FRAGMENT_SHADER, frag],
      ] as const) {
        const sh = g.createShader(type)!;
        shaders.push(sh);
        g.shaderSource(sh, text);
        g.compileShader(sh);
        if (!g.getShaderParameter(sh, g.COMPILE_STATUS))
          throw Error(g.getShaderInfoLog(sh) || "Erro de compilação");
      }
      const p = g.createProgram()!;
      shaders.forEach((sh) => g.attachShader(p, sh));
      g.linkProgram(p);
      if (!g.getProgramParameter(p, g.LINK_STATUS)) {
        const log = g.getProgramInfoLog(p);
        g.deleteProgram(p);
        throw Error(log || "Erro ao vincular shader");
      }
      return p;
    } finally {
      shaders.forEach((sh) => g.deleteShader(sh));
    }
  }
  compile(code: string) {
    const frag = code.trimStart().startsWith("#version") ? code : header + code;
    const p = this.program(frag);
    if (this.programs.custom) this.gl.deleteProgram(this.programs.custom);
    this.programs.custom = p;
  }
  target(width: number, height: number): Target {
    const g = this.gl,
      texture = this.texture(),
      fbo = g.createFramebuffer()!;
    g.bindTexture(g.TEXTURE_2D, texture);
    g.texImage2D(
      g.TEXTURE_2D,
      0,
      g.RGBA8,
      width,
      height,
      0,
      g.RGBA,
      g.UNSIGNED_BYTE,
      null,
    );
    g.bindFramebuffer(g.FRAMEBUFFER, fbo);
    g.framebufferTexture2D(
      g.FRAMEBUFFER,
      g.COLOR_ATTACHMENT0,
      g.TEXTURE_2D,
      texture,
      0,
    );
    if (g.checkFramebufferStatus(g.FRAMEBUFFER) !== g.FRAMEBUFFER_COMPLETE)
      throw Error(
        t("Não foi possível criar o framebuffer. Reduza a resolução."),
      );
    return { texture, fbo, width, height };
  }
  resize() {
    const s = this.state,
      w = Math.round(s.width),
      h = Math.round(w / s.aspect),
      cw = Math.min(w, Math.round(s.cpuWidth)),
      ch = Math.round(cw / s.aspect);
    if (
      this.targets[0]?.width === w &&
      this.targets[0]?.height === h &&
      this.targets[4]?.width === cw &&
      this.targets[4]?.height === ch
    )
      return;
    const g = this.gl;
    this.targets.forEach((t) => {
      g.deleteTexture(t.texture);
      g.deleteFramebuffer(t.fbo);
    });
    this.canvas.width = w;
    this.canvas.height = h;
    this.targets = [
      this.target(w, h),
      this.target(w, h),
      this.target(w, h),
      this.target(w, h),
      this.target(cw, ch),
    ];
    this.generation++;
    this.cpuReady = false;
  }
  uniform(program: WebGLProgram, name: string) {
    let cache = this.uniformCache.get(program);
    if (!cache) {
      cache = new Map();
      this.uniformCache.set(program, cache);
    }
    if (!cache.has(name))
      cache.set(name, this.gl.getUniformLocation(program, name));
    return cache.get(name)!;
  }
  pass(
    program: WebGLProgram,
    target: Target | null,
    input: WebGLTexture,
    values: Record<string, number | number[]> = {},
    textures: Record<string, WebGLTexture> = {},
  ) {
    const g = this.gl;
    g.useProgram(program);
    g.bindFramebuffer(g.FRAMEBUFFER, target?.fbo ?? null);
    g.viewport(
      0,
      0,
      target?.width ?? this.canvas.width,
      target?.height ?? this.canvas.height,
    );
    const resolution = [
      target?.width ?? this.canvas.width,
      target?.height ?? this.canvas.height,
    ];
    values = {
      u_time: this.time,
      u_resolution: resolution,
      u_mouse: this.mouse,
      ...values,
    };
    let unit = 0;
    for (const [name, tex] of Object.entries({ u_tex: input, ...textures })) {
      g.activeTexture(g.TEXTURE0 + unit);
      g.bindTexture(g.TEXTURE_2D, tex);
      g.uniform1i(this.uniform(program, name), unit++);
    }
    const integers = new Set([
      "u_source",
      "u_algorithm",
      "u_levels",
      "u_mono",
      "u_shape",
      "u_count",
      "u_oklab",
    ]);
    for (const [name, value] of Object.entries(values)) {
      const l = this.uniform(program, name);
      if (Array.isArray(value)) {
        if (name === "u_colors" || name === "u_metric") g.uniform3fv(l, value);
        else g.uniform2fv(l, value);
      } else if (integers.has(name)) g.uniform1i(l, value);
      else g.uniform1f(l, value);
    }
    g.drawArrays(g.TRIANGLES, 0, 3);
  }
  render(time: number, deterministic = false) {
    this.time = time;
    this.resize();
    const g = this.gl,
      s = this.state,
      [src, pre, dit, pal, small] = this.targets;
    const key = JSON.stringify([
      s.source,
      s.algorithm,
      s.brightness,
      s.contrast,
      s.gamma,
      s.pixel,
      s.levels,
      s.strength,
      s.mono,
      s.serpentine,
      s.procedural,
    ]);
    if (key !== this.cpuKey) {
      this.cpuKey = key;
      this.generation++;
      this.cpuReady = false;
    }
    if (
      this.media &&
      (this.media instanceof HTMLImageElement || this.media.readyState >= 2)
    ) {
      g.activeTexture(g.TEXTURE0);
      g.bindTexture(g.TEXTURE_2D, this.mediaTex);
      g.pixelStorei(g.UNPACK_FLIP_Y_WEBGL, true);
      g.texImage2D(
        g.TEXTURE_2D,
        0,
        g.RGBA,
        g.RGBA,
        g.UNSIGNED_BYTE,
        this.media,
      );
      g.pixelStorei(g.UNPACK_FLIP_Y_WEBGL, false);
    }
    const mediaAspect =
      this.media instanceof HTMLVideoElement
        ? this.media.videoWidth / this.media.videoHeight
        : this.media
          ? this.media.naturalWidth / this.media.naturalHeight
          : 1;
    this.pass(
      s.source === "Shader" ? this.programs.custom : this.programs.source,
      src,
      this.mediaTex,
      {
        u_source:
          s.source === "Procedural"
            ? ["Gradiente", "Noise", "Formas", "Plasma"].indexOf(s.procedural) +
              1
            : 0,
        u_aspect: mediaAspect || 1,
      },
    );
    this.pass(this.programs.preprocess, pre, src.texture, {
      u_brightness: s.brightness,
      u_contrast: s.contrast,
      u_gamma: s.gamma,
      u_pixel: s.pixel,
    });
    let result: WebGLTexture;
    if (cpuAlgorithms.includes(s.algorithm as any)) {
      const options = {
        algorithm: s.algorithm,
        serpentine: s.serpentine,
        levels: s.levels,
        strength: s.strength,
        mono: s.mono,
      };
      if (deterministic || !this.worker || !this.busy) {
        this.pass(
          this.programs.output,
          small,
          pre.texture,
          { u_compare: 0 },
          { u_before: pre.texture },
        );
        const pixels = new Uint8Array(small.width * small.height * 4);
        g.readPixels(
          0,
          0,
          small.width,
          small.height,
          g.RGBA,
          g.UNSIGNED_BYTE,
          pixels,
        );
        if (deterministic || !this.worker) {
          const out = diffuse(pixels, small.width, small.height, options);
          g.bindTexture(g.TEXTURE_2D, this.cpuTex);
          g.texImage2D(
            g.TEXTURE_2D,
            0,
            g.RGBA,
            small.width,
            small.height,
            0,
            g.RGBA,
            g.UNSIGNED_BYTE,
            out,
          );
          this.cpuReady = true;
          this.cpuGeneration = this.generation;
        } else {
          this.busy = true;
          this.requestGeneration = this.generation;
          this.worker.postMessage(
            {
              pixels: pixels.buffer,
              width: small.width,
              height: small.height,
              options,
            },
            [pixels.buffer],
          );
        }
      }
      result =
        this.cpuReady && this.cpuGeneration === this.generation
          ? this.cpuTex
          : pre.texture;
    } else {
      this.pass(
        this.programs["effect:" + s.algorithm] ?? this.programs.dither,
        dit,
        pre.texture,
        {
          u_algorithm: algorithms.indexOf(s.algorithm as any),
          u_levels: s.levels,
          u_mono: +s.mono,
          u_strength: s.strength,
          u_scale: s.scale,
          u_angle: s.angle,
          u_cell: s.cell,
          u_shape: ["Pontos", "Linhas", "Cruz"].indexOf(s.shape),
        },
        { u_noise: this.noiseTex },
      );
      result = dit.texture;
    }
    const paletteKey = JSON.stringify([s.colors, s.distance]);
    if (paletteKey !== this.paletteKey) {
      this.paletteKey = paletteKey;
      const colors = s.colors.map(
        (c) =>
          [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16) / 255) as RGB,
      );
      this.paletteColors = colors.flat();
      this.paletteMetric = colors.flatMap((c) =>
        s.distance === "OKLab" ? oklab(c) : c.map(linear),
      );
    }
    this.pass(this.programs.palette, pal, result, {
      u_colors: this.paletteColors,
      u_metric: this.paletteMetric,
      u_count: s.colors.length,
      u_oklab: +(s.distance === "OKLab"),
    });
    this.pass(
      this.programs.output,
      null,
      pal.texture,
      { u_compare: deterministic ? 0 : s.compare },
      { u_before: src.texture },
    );
  }
  pixels(before = false) {
    const g = this.gl,
      t = this.targets[before ? 1 : 3],
      data = new Uint8Array(t.width * t.height * 4);
    g.bindFramebuffer(g.FRAMEBUFFER, t.fbo);
    g.readPixels(0, 0, t.width, t.height, g.RGBA, g.UNSIGNED_BYTE, data);
    g.bindFramebuffer(g.FRAMEBUFFER, null);
    const flipped = new Uint8Array(data.length),
      row = t.width * 4;
    for (let y = 0; y < t.height; y++)
      flipped.set(
        data.subarray(y * row, (y + 1) * row),
        (t.height - 1 - y) * row,
      );
    return { data: flipped, width: t.width, height: t.height };
  }
  dispose() {
    this.worker?.terminate();
    const g = this.gl;
    Object.values(this.programs).forEach((p) => g.deleteProgram(p));
    this.targets.forEach((t) => {
      g.deleteTexture(t.texture);
      g.deleteFramebuffer(t.fbo);
    });
    [this.mediaTex, this.cpuTex, this.noiseTex].forEach((t) =>
      g.deleteTexture(t),
    );
  }
}
