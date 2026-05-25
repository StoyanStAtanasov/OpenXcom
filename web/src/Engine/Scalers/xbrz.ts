import { ScalerCfg } from "./config.ts";

export enum ColorFormat {
  RGB,
  ARGB
}

export enum SliceType {
  NN_SCALE_SLICE_SOURCE,
  NN_SCALE_SLICE_TARGET
}

function getAlpha(pix: number): number {
  return (pix >>> 24) & 0xff;
}

function getRed(pix: number): number {
  return (pix >>> 16) & 0xff;
}

function getGreen(pix: number): number {
  return (pix >>> 8) & 0xff;
}

function getBlue(pix: number): number {
  return pix & 0xff;
}

function distYCbCr(pix1: number, pix2: number, luminanceWeight: number): number {
  const rDiff = getRed(pix1) - getRed(pix2);
  const gDiff = getGreen(pix1) - getGreen(pix2);
  const bDiff = getBlue(pix1) - getBlue(pix2);

  const kB = 0.0593;
  const kR = 0.2627;
  const kG = 1 - kB - kR;
  const scaleB = 0.5 / (1 - kB);
  const scaleR = 0.5 / (1 - kR);
  const y = luminanceWeight * (kR * rDiff + kG * gDiff + kB * bDiff);
  const cB = scaleB * (bDiff - y);
  const cR = scaleR * (rDiff - y);
  return Math.sqrt(y * y + cB * cB + cR * cR);
}

function distARGB(pix1: number, pix2: number, luminanceWeight: number): number {
  const a1 = getAlpha(pix1) / 255.0;
  const a2 = getAlpha(pix2) / 255.0;
  const d = distYCbCr(pix1, pix2, luminanceWeight);
  return a1 < a2 ? a1 * d + 255 * (a2 - a1) : a2 * d + 255 * (a1 - a2);
}

export function equalColorTest(col1: number, col2: number, colFmt: ColorFormat, luminanceWeight: number, equalColorTolerance: number): boolean {
  switch (colFmt) {
    case ColorFormat.ARGB:
      return distARGB(col1, col2, luminanceWeight) < equalColorTolerance;
    case ColorFormat.RGB:
      return distYCbCr(col1, col2, luminanceWeight) < equalColorTolerance;
  }
}

function nearestNeighborScaleSource(src: Uint32Array, srcWidth: number, srcHeight: number, srcPitch: number, trg: Uint32Array, trgWidth: number, trgHeight: number, trgPitch: number, yFirst: number, yLast: number): void {
  const srcStride = Math.trunc(srcPitch / 4);
  const trgStride = Math.trunc(trgPitch / 4);
  const start = Math.max(0, yFirst);
  const end = Math.min(srcHeight, yLast);
  for (let y = start; y < end; ++y) {
    const srcLine = y * srcStride;
    const yStart = Math.floor((y * trgHeight) / srcHeight);
    const yEnd = Math.floor(((y + 1) * trgHeight) / srcHeight);
    for (let x = 0; x < srcWidth; ++x) {
      const xStart = Math.floor((x * trgWidth) / srcWidth);
      const xEnd = Math.floor(((x + 1) * trgWidth) / srcWidth);
      const value = src[srcLine + x];
      for (let ty = yStart; ty < yEnd; ++ty) {
        const trgLine = ty * trgStride;
        for (let tx = xStart; tx < xEnd; ++tx) {
          trg[trgLine + tx] = value;
        }
      }
    }
  }
}

function nearestNeighborScaleTarget(src: Uint32Array, srcWidth: number, srcHeight: number, srcPitch: number, trg: Uint32Array, trgWidth: number, trgHeight: number, trgPitch: number, yFirst: number, yLast: number): void {
  const srcStride = Math.trunc(srcPitch / 4);
  const trgStride = Math.trunc(trgPitch / 4);
  const start = Math.max(0, yFirst);
  const end = Math.min(trgHeight, yLast);
  for (let y = start; y < end; ++y) {
    const ySrc = Math.floor((y * srcHeight) / trgHeight);
    const srcLine = ySrc * srcStride;
    const trgLine = y * trgStride;
    for (let x = 0; x < trgWidth; ++x) {
      const xSrc = Math.floor((x * srcWidth) / trgWidth);
      trg[trgLine + x] = src[srcLine + xSrc];
    }
  }
}

export function nearestNeighborScale(
  src: Uint32Array,
  srcWidth: number,
  srcHeight: number,
  srcPitch: number,
  trg: Uint32Array,
  trgWidth: number,
  trgHeight: number,
  trgPitch: number,
  st: SliceType,
  yFirst: number,
  yLast: number
): void {
  if (srcPitch < srcWidth * 4 || trgPitch < trgWidth * 4) {
    return;
  }
  switch (st) {
    case SliceType.NN_SCALE_SLICE_SOURCE:
      nearestNeighborScaleSource(src, srcWidth, srcHeight, srcPitch, trg, trgWidth, trgHeight, trgPitch, yFirst, yLast);
      break;
    case SliceType.NN_SCALE_SLICE_TARGET:
      nearestNeighborScaleTarget(src, srcWidth, srcHeight, srcPitch, trg, trgWidth, trgHeight, trgPitch, yFirst, yLast);
      break;
  }
}

export function scale(
  factor: number,
  src: Uint32Array,
  trg: Uint32Array,
  srcWidth: number,
  srcHeight: number,
  colFmt: ColorFormat,
  cfg: ScalerCfg = new ScalerCfg(),
  yFirst = 0,
  yLast = Number.MAX_SAFE_INTEGER
): void {
  void colFmt;
  void cfg;
  const trgWidth = srcWidth * factor;
  const trgHeight = srcHeight * factor;
  nearestNeighborScale(src, srcWidth, srcHeight, srcWidth * 4, trg, trgWidth, trgHeight, trgWidth * 4, SliceType.NN_SCALE_SLICE_TARGET, yFirst, yLast);
}
