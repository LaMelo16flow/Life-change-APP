// AI photo enhancer for product images (runs in the admin's browser, free).
//
// Small or blurry photos are enlarged with an ESRGAN super-resolution model
// (UpscalerJS "esrgan-slim", served from this site under /models/), then
// lightly sharpened and saved at up to MAX_SIDE pixels. Photos that are
// already large are returned unchanged.
//
// The AI libraries (~1 MB) are only downloaded the first time an admin uses
// the enhancer, so customers' pages stay light.

export const TARGET_MIN_SIDE = 600; // photos smaller than this get enhanced
const MAX_SIDE = 1000;

export interface EnhanceResult {
  blob: Blob;
  enhanced: boolean;
  from: { width: number; height: number };
  to: { width: number; height: number };
}

// deno-lint-ignore no-explicit-any
type AnyUpscaler = any;
const upscalers: Record<number, Promise<AnyUpscaler>> = {};

async function getUpscaler(scale: 2 | 4): Promise<AnyUpscaler> {
  if (!upscalers[scale]) {
    upscalers[scale] = (async () => {
      const [{ default: Upscaler }, model] = await Promise.all([
        import('upscaler'),
        scale === 4 ? import('@upscalerjs/esrgan-slim/4x') : import('@upscalerjs/esrgan-slim/2x'),
      ]);
      // Load the model from this site instead of a CDN.
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { _internals, ...definition } = model.default as Record<string, unknown>;
      const path = `${import.meta.env.BASE_URL}models/esrgan-slim/x${scale}/model.json`;
      return new Upscaler({ model: { ...definition, path } });
    })();
  }
  return upscalers[scale];
}

export async function loadImage(src: string | Blob): Promise<HTMLImageElement> {
  const url = typeof src === 'string' ? src : URL.createObjectURL(src);
  try {
    const img = new Image();
    img.crossOrigin = 'anonymous'; // needed to read the pixels of photos from storage
    img.decoding = 'async';
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('Image could not be loaded'));
      img.src = url;
    });
    return img;
  } finally {
    if (typeof src !== 'string') setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }
}

/** Flattens transparency onto white and returns a canvas of the image. */
function toCanvas(img: CanvasImageSource, width: number, height: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = width;
  c.height = height;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, width, height);
  return c;
}

/** Light unsharp mask so edges and label text look crisp. */
function sharpen(canvas: HTMLCanvasElement, amount = 0.35) {
  const ctx = canvas.getContext('2d')!;
  const { width: w, height: h } = canvas;
  const src = ctx.getImageData(0, 0, w, h);
  const out = ctx.createImageData(w, h);
  const s = src.data, d = out.data;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      for (let ch = 0; ch < 3; ch++) {
        const c = s[i + ch];
        const n = y > 0 ? s[i - w * 4 + ch] : c;
        const so = y < h - 1 ? s[i + w * 4 + ch] : c;
        const we = x > 0 ? s[i - 4 + ch] : c;
        const e = x < w - 1 ? s[i + 4 + ch] : c;
        const blur = (n + so + we + e) / 4;
        d[i + ch] = Math.max(0, Math.min(255, c + amount * (c - blur) * 2));
      }
      d[i + 3] = 255;
    }
  }
  // Replicate the second row/column onto the outer edge (resampling leaves
  // a faint darker line there).
  const copyPx = (from: number, to: number) => {
    d[to] = d[from]; d[to + 1] = d[from + 1]; d[to + 2] = d[from + 2]; d[to + 3] = 255;
  };
  if (w > 2 && h > 2) {
    for (let x = 0; x < w; x++) {
      copyPx((1 * w + x) * 4, x * 4);
      copyPx(((h - 2) * w + x) * 4, ((h - 1) * w + x) * 4);
    }
    for (let y = 0; y < h; y++) {
      copyPx((y * w + 1) * 4, (y * w) * 4);
      copyPx((y * w + w - 2) * 4, (y * w + w - 1) * 4);
    }
  }
  ctx.putImageData(out, 0, 0);
}

const toBlob = (canvas: HTMLCanvasElement) =>
  new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not encode image'))), 'image/jpeg', 0.92)
  );

/**
 * Enhances a photo when it is smaller than TARGET_MIN_SIDE.
 * `force` enhances even large photos (sharpening only).
 */
export async function enhanceImage(
  src: string | Blob,
  opts: { force?: boolean; onProgress?: (fraction: number) => void } = {}
): Promise<EnhanceResult> {
  const img = await loadImage(src);
  const w = img.naturalWidth, h = img.naturalHeight;
  const longest = Math.max(w, h);

  if (longest >= TARGET_MIN_SIDE && !opts.force) {
    const blob = src instanceof Blob ? src : await toBlob(toCanvas(img, w, h));
    return { blob, enhanced: false, from: { width: w, height: h }, to: { width: w, height: h } };
  }

  let result: HTMLCanvasElement;
  if (longest < TARGET_MIN_SIDE) {
    const scale: 2 | 4 = longest * 2 >= TARGET_MIN_SIDE ? 2 : 4;
    // Keep the AI input small enough for phones: at most MAX_SIDE / scale.
    const inMax = Math.floor(MAX_SIDE / scale);
    const k = Math.min(1, inMax / longest);
    const input = toCanvas(img, Math.round(w * k), Math.round(h * k));
    // Very small web thumbnails are heavily JPEG-compressed: smooth the 8x8
    // compression blocks a little first so the AI does not enlarge them.
    if (longest <= 300) {
      const soft = document.createElement('canvas');
      soft.width = input.width;
      soft.height = input.height;
      const sctx = soft.getContext('2d')!;
      sctx.filter = 'blur(0.45px)';
      sctx.drawImage(input, 0, 0);
      input.getContext('2d')!.drawImage(soft, 0, 0);
    }
    const upscaler = await getUpscaler(scale);
    const dataUrl: string = await upscaler.upscale(input, {
      output: 'base64',
      // Large tiles with generous overlap: no visible seams between tiles.
      patchSize: 128,
      padding: 16,
      progress: (p: number) => opts.onProgress?.(p),
    });
    const up = await loadImage(dataUrl);
    // The model darkens the outermost pixels: drop a thin border.
    const edge = Math.max(2, Math.round(scale));
    const cw = up.naturalWidth, ch = up.naturalHeight;
    result = document.createElement('canvas');
    result.width = cw;
    result.height = ch;
    const rctx = result.getContext('2d')!;
    rctx.fillStyle = '#ffffff';
    rctx.fillRect(0, 0, cw, ch);
    rctx.imageSmoothingQuality = 'high';
    rctx.drawImage(up, edge, edge, cw - 2 * edge, ch - 2 * edge, 0, 0, cw, ch);
  } else {
    result = toCanvas(img, w, h);
  }

  // Cap the size, then sharpen lightly.
  const big = Math.max(result.width, result.height);
  if (big > MAX_SIDE) {
    const k = MAX_SIDE / big;
    result = toCanvas(result, Math.round(result.width * k), Math.round(result.height * k));
  }
  sharpen(result, longest <= 300 ? 0.5 : 0.35);
  const blob = await toBlob(result);
  return { blob, enhanced: true, from: { width: w, height: h }, to: { width: result.width, height: result.height } };
}
