import { diffuse } from "./diffusion";
self.onmessage = ({ data }) => {
  try {
    const result = diffuse(
      new Uint8Array(data.pixels),
      data.width,
      data.height,
      data.options,
    );
    if (typeof OffscreenCanvas !== "undefined") {
      const canvas = new OffscreenCanvas(data.width, data.height);
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.putImageData(
          new ImageData(new Uint8ClampedArray(result), data.width, data.height),
          0,
          0,
        );
        const bitmap = canvas.transferToImageBitmap();
        self.postMessage(
          { bitmap, width: data.width, height: data.height },
          { transfer: [bitmap] },
        );
        return;
      }
    }
    self.postMessage(
      { pixels: result.buffer, width: data.width, height: data.height },
      { transfer: [result.buffer] },
    );
  } catch (error) {
    self.postMessage({ error: String(error) });
  }
};
