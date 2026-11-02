import { Renderer } from "./renderer";
import { validate } from "./state";
(async () => {
  const config = (window as any).__DITHER__,
    canvas = document.querySelector("canvas")!,
    state = validate(config.state);
  const renderer = new Renderer(canvas, state, false);
  if (config.media) {
    if (config.mediaType === "video") {
      const video = document.createElement("video");
      video.muted = true;
      video.loop = true;
      video.playsInline = true;
      video.src = config.media;
      await new Promise<void>((resolve, reject) => {
        video.onloadeddata = () => resolve();
        video.onerror = () => reject(Error("Falha ao abrir vídeo"));
      });
      renderer.media = video;
      await video.play();
    } else {
      const image = new Image();
      image.src = config.media;
      await image.decode();
      renderer.media = image;
      if (state.source === "Webcam") state.source = "Imagem";
    }
  }
  let start = performance.now();
  function frame(now: number) {
    renderer.render(
      state.paused ? config.time : config.time + (now - start) / 1000,
      true,
    );
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})().catch((e) => {
  document.querySelector("p")!.textContent = String(e);
});
