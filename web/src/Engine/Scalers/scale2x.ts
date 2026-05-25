type PixelArray = Uint8Array | Uint16Array | Uint32Array;

function scale2xBorderRow(dst: PixelArray, src0: PixelArray, src1: PixelArray, src2: PixelArray, count: number): void {
  for (let i = 0; i < count; ++i) {
    const e = src1[i];
    const b = src0[i];
    const h = src2[i];
    const d = i > 0 ? src1[i - 1] : e;
    const f = i + 1 < count ? src1[i + 1] : e;
    const out = i * 2;
    if (b !== h && d !== f) {
      dst[out] = d === b ? b : e;
      dst[out + 1] = f === b ? b : e;
    } else {
      dst[out] = e;
      dst[out + 1] = e;
    }
  }
}

function scale2xCenterRow(dst: PixelArray, src0: PixelArray, src1: PixelArray, src2: PixelArray, count: number): void {
  for (let i = 0; i < count; ++i) {
    const e = src1[i];
    const b = src0[i];
    const h = src2[i];
    const d = i > 0 ? src1[i - 1] : e;
    const f = i + 1 < count ? src1[i + 1] : e;
    const bLeft = i > 0 ? src0[i - 1] : b;
    const bRight = i + 1 < count ? src0[i + 1] : b;
    const hLeft = i > 0 ? src2[i - 1] : h;
    const hRight = i + 1 < count ? src2[i + 1] : h;
    const out = i * 2;
    if (b !== h && d !== f) {
      dst[out] = ((d === b && e !== hLeft) || (d === h && e !== bLeft)) ? d : e;
      dst[out + 1] = ((f === b && e !== hRight) || (f === h && e !== bRight)) ? f : e;
    } else {
      dst[out] = e;
      dst[out + 1] = e;
    }
  }
}

function scale2x2(dst0: PixelArray, dst1: PixelArray, src0: PixelArray, src1: PixelArray, src2: PixelArray, count: number): void {
  scale2xBorderRow(dst0, src0, src1, src2, count);
  scale2xBorderRow(dst1, src2, src1, src0, count);
}

function scale2x3(dst0: PixelArray, dst1: PixelArray, dst2: PixelArray, src0: PixelArray, src1: PixelArray, src2: PixelArray, count: number): void {
  scale2xBorderRow(dst0, src0, src1, src2, count);
  scale2xCenterRow(dst1, src0, src1, src2, count);
  scale2xBorderRow(dst2, src2, src1, src0, count);
}

function scale2x4(dst0: PixelArray, dst1: PixelArray, dst2: PixelArray, dst3: PixelArray, src0: PixelArray, src1: PixelArray, src2: PixelArray, count: number): void {
  scale2xBorderRow(dst0, src0, src1, src2, count);
  scale2xCenterRow(dst1, src0, src1, src2, count);
  scale2xCenterRow(dst2, src0, src1, src2, count);
  scale2xBorderRow(dst3, src2, src1, src0, count);
}

export function scale2x_8_def(dst0: Uint8Array, dst1: Uint8Array, src0: Uint8Array, src1: Uint8Array, src2: Uint8Array, count: number): void {
  scale2x2(dst0, dst1, src0, src1, src2, count);
}

export function scale2x_16_def(dst0: Uint16Array, dst1: Uint16Array, src0: Uint16Array, src1: Uint16Array, src2: Uint16Array, count: number): void {
  scale2x2(dst0, dst1, src0, src1, src2, count);
}

export function scale2x_32_def(dst0: Uint32Array, dst1: Uint32Array, src0: Uint32Array, src1: Uint32Array, src2: Uint32Array, count: number): void {
  scale2x2(dst0, dst1, src0, src1, src2, count);
}

export function scale2x3_8_def(dst0: Uint8Array, dst1: Uint8Array, dst2: Uint8Array, src0: Uint8Array, src1: Uint8Array, src2: Uint8Array, count: number): void {
  scale2x3(dst0, dst1, dst2, src0, src1, src2, count);
}

export function scale2x3_16_def(dst0: Uint16Array, dst1: Uint16Array, dst2: Uint16Array, src0: Uint16Array, src1: Uint16Array, src2: Uint16Array, count: number): void {
  scale2x3(dst0, dst1, dst2, src0, src1, src2, count);
}

export function scale2x3_32_def(dst0: Uint32Array, dst1: Uint32Array, dst2: Uint32Array, src0: Uint32Array, src1: Uint32Array, src2: Uint32Array, count: number): void {
  scale2x3(dst0, dst1, dst2, src0, src1, src2, count);
}

export function scale2x4_8_def(dst0: Uint8Array, dst1: Uint8Array, dst2: Uint8Array, dst3: Uint8Array, src0: Uint8Array, src1: Uint8Array, src2: Uint8Array, count: number): void {
  scale2x4(dst0, dst1, dst2, dst3, src0, src1, src2, count);
}

export function scale2x4_16_def(dst0: Uint16Array, dst1: Uint16Array, dst2: Uint16Array, dst3: Uint16Array, src0: Uint16Array, src1: Uint16Array, src2: Uint16Array, count: number): void {
  scale2x4(dst0, dst1, dst2, dst3, src0, src1, src2, count);
}

export function scale2x4_32_def(dst0: Uint32Array, dst1: Uint32Array, dst2: Uint32Array, dst3: Uint32Array, src0: Uint32Array, src1: Uint32Array, src2: Uint32Array, count: number): void {
  scale2x4(dst0, dst1, dst2, dst3, src0, src1, src2, count);
}

export function scale2x_8_mmx(dst0: Uint8Array, dst1: Uint8Array, src0: Uint8Array, src1: Uint8Array, src2: Uint8Array, count: number): void {
  scale2x_8_def(dst0, dst1, src0, src1, src2, count);
}

export function scale2x_16_mmx(dst0: Uint16Array, dst1: Uint16Array, src0: Uint16Array, src1: Uint16Array, src2: Uint16Array, count: number): void {
  scale2x_16_def(dst0, dst1, src0, src1, src2, count);
}

export function scale2x_32_mmx(dst0: Uint32Array, dst1: Uint32Array, src0: Uint32Array, src1: Uint32Array, src2: Uint32Array, count: number): void {
  scale2x_32_def(dst0, dst1, src0, src1, src2, count);
}

export function scale2x3_8_mmx(dst0: Uint8Array, dst1: Uint8Array, dst2: Uint8Array, src0: Uint8Array, src1: Uint8Array, src2: Uint8Array, count: number): void {
  scale2x3_8_def(dst0, dst1, dst2, src0, src1, src2, count);
}

export function scale2x3_16_mmx(dst0: Uint16Array, dst1: Uint16Array, dst2: Uint16Array, src0: Uint16Array, src1: Uint16Array, src2: Uint16Array, count: number): void {
  scale2x3_16_def(dst0, dst1, dst2, src0, src1, src2, count);
}

export function scale2x3_32_mmx(dst0: Uint32Array, dst1: Uint32Array, dst2: Uint32Array, src0: Uint32Array, src1: Uint32Array, src2: Uint32Array, count: number): void {
  scale2x3_32_def(dst0, dst1, dst2, src0, src1, src2, count);
}

export function scale2x4_8_mmx(dst0: Uint8Array, dst1: Uint8Array, dst2: Uint8Array, dst3: Uint8Array, src0: Uint8Array, src1: Uint8Array, src2: Uint8Array, count: number): void {
  scale2x4_8_def(dst0, dst1, dst2, dst3, src0, src1, src2, count);
}

export function scale2x4_16_mmx(dst0: Uint16Array, dst1: Uint16Array, dst2: Uint16Array, dst3: Uint16Array, src0: Uint16Array, src1: Uint16Array, src2: Uint16Array, count: number): void {
  scale2x4_16_def(dst0, dst1, dst2, dst3, src0, src1, src2, count);
}

export function scale2x4_32_mmx(dst0: Uint32Array, dst1: Uint32Array, dst2: Uint32Array, dst3: Uint32Array, src0: Uint32Array, src1: Uint32Array, src2: Uint32Array, count: number): void {
  scale2x4_32_def(dst0, dst1, dst2, dst3, src0, src1, src2, count);
}

export function scale2x_mmx_emms(): void {
  return;
}
