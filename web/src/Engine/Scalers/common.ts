export const MASK_2 = 0x0000ff00;
export const MASK_13 = 0x00ff00ff;
export const MASK_RGB = 0x00ffffff;
export const MASK_ALPHA = 0xff000000;

export const Ymask = 0x00ff0000;
export const Umask = 0x0000ff00;
export const Vmask = 0x000000ff;
export const trY = 0x00300000;
export const trU = 0x00000700;
export const trV = 0x00000006;

export const RGBtoYUV: number[] = [];

function computeRgbToYuv(c: number): number {
  const r = (c >>> 16) & 0xff;
  const g = (c >>> 8) & 0xff;
  const b = c & 0xff;
  const y = Math.trunc(0.299 * r + 0.587 * g + 0.114 * b);
  const u = Math.trunc(-0.169 * r - 0.331 * g + 0.5 * b) + 128;
  const v = Math.trunc(0.5 * r - 0.419 * g - 0.081 * b) + 128;
  return (((y << 16) | (u << 8) | v) >>> 0);
}

export function rgbToYuv(c: number): number {
  const key = c & MASK_RGB;
  const cached = RGBtoYUV[key];
  if (cached !== undefined) {
    return cached;
  }
  const value = computeRgbToYuv(key);
  RGBtoYUV[key] = value;
  return value;
}

export function yuvDiff(yuv1: number, yuv2: number): boolean {
  return (
    Math.abs(((yuv1 & Ymask) - (yuv2 & Ymask)) | 0) > trY ||
    Math.abs(((yuv1 & Umask) - (yuv2 & Umask)) | 0) > trU ||
    Math.abs(((yuv1 & Vmask) - (yuv2 & Vmask)) | 0) > trV
  );
}

export function Diff(c1: number, c2: number): number {
  return yuvDiff(rgbToYuv(c1), rgbToYuv(c2)) ? 1 : 0;
}

function interpolate2(c1: number, w1: number, c2: number, w2: number, s: number): number {
  if (c1 === c2) {
    return c1 >>> 0;
  }
  return (
    ((((((c1 >>> 24) * w1 + (c2 >>> 24) * w2) << (24 - s)) & MASK_ALPHA) >>> 0) +
      ((((c1 & MASK_2) * w1 + (c2 & MASK_2) * w2) >> s) & MASK_2) +
      ((((c1 & MASK_13) * w1 + (c2 & MASK_13) * w2) >> s) & MASK_13)) >>> 0
  );
}

function interpolate3(
  c1: number,
  w1: number,
  c2: number,
  w2: number,
  c3: number,
  w3: number,
  s: number
): number {
  return (
    ((((((c1 >>> 24) * w1 + (c2 >>> 24) * w2 + (c3 >>> 24) * w3) << (24 - s)) & MASK_ALPHA) >>> 0) +
      ((((c1 & MASK_2) * w1 + (c2 & MASK_2) * w2 + (c3 & MASK_2) * w3) >> s) & MASK_2) +
      ((((c1 & MASK_13) * w1 + (c2 & MASK_13) * w2 + (c3 & MASK_13) * w3) >> s) & MASK_13)) >>> 0
  );
}

export function Interp1(c1: number, c2: number): number {
  return interpolate2(c1, 3, c2, 1, 2);
}

export function Interp2(c1: number, c2: number, c3: number): number {
  return interpolate3(c1, 2, c2, 1, c3, 1, 2);
}

export function Interp3(c1: number, c2: number): number {
  return interpolate2(c1, 7, c2, 1, 3);
}

export function Interp4(c1: number, c2: number, c3: number): number {
  return interpolate3(c1, 2, c2, 7, c3, 7, 4);
}

export function Interp5(c1: number, c2: number): number {
  return interpolate2(c1, 1, c2, 1, 1);
}

export function Interp6(c1: number, c2: number, c3: number): number {
  return interpolate3(c1, 5, c2, 2, c3, 1, 3);
}

export function Interp7(c1: number, c2: number, c3: number): number {
  return interpolate3(c1, 6, c2, 1, c3, 1, 3);
}

export function Interp8(c1: number, c2: number): number {
  return interpolate2(c1, 5, c2, 3, 3);
}

export function Interp9(c1: number, c2: number, c3: number): number {
  return interpolate3(c1, 2, c2, 3, c3, 3, 3);
}

export function Interp10(c1: number, c2: number, c3: number): number {
  return interpolate3(c1, 14, c2, 1, c3, 1, 4);
}

export function scaleNearest32(
  src: Uint32Array,
  srcRowBytes: number,
  dst: Uint32Array,
  dstRowBytes: number,
  width: number,
  height: number,
  factor: number
): void {
  const srcStride = Math.trunc(srcRowBytes / 4);
  const dstStride = Math.trunc(dstRowBytes / 4);
  const srcWidth = Math.max(0, width);
  const srcHeight = Math.max(0, height);
  const scale = Math.max(1, factor);

  for (let y = 0; y < srcHeight; ++y) {
    const srcRow = y * srcStride;
    const dstRow = y * scale * dstStride;
    for (let x = 0; x < srcWidth; ++x) {
      const value = src[srcRow + x];
      const dx = x * scale;
      for (let yy = 0; yy < scale; ++yy) {
        const row = dstRow + yy * dstStride;
        for (let xx = 0; xx < scale; ++xx) {
          dst[row + dx + xx] = value;
        }
      }
    }
  }
}
