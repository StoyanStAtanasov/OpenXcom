type PixelArray = Uint8Array | Uint16Array | Uint32Array;

function scale3xBorderRow(dst: PixelArray, src0: PixelArray, src1: PixelArray, src2: PixelArray, count: number): void {
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
    const out = i * 3;
    if (b !== h && d !== f) {
      dst[out] = e;
      dst[out + 1] = ((d === b && e !== bRight) || (f === b && e !== b)) ? b : e;
      dst[out + 2] = f === b ? f : e;
    } else {
      dst[out] = e;
      dst[out + 1] = e;
      dst[out + 2] = e;
    }
    void bLeft;
    void hLeft;
    void hRight;
  }
}

function scale3xCenterRow(dst: PixelArray, src0: PixelArray, src1: PixelArray, src2: PixelArray, count: number): void {
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
    const out = i * 3;
    if (b !== h && d !== f) {
      dst[out] = ((d === b && e !== hLeft) || (d === h && e !== bLeft)) ? d : e;
      dst[out + 1] = e;
      dst[out + 2] = ((f === b && e !== hRight) || (f === h && e !== bRight)) ? f : e;
    } else {
      dst[out] = e;
      dst[out + 1] = e;
      dst[out + 2] = e;
    }
  }
}

export function scale3x_8_def(dst0: Uint8Array, dst1: Uint8Array, dst2: Uint8Array, src0: Uint8Array, src1: Uint8Array, src2: Uint8Array, count: number): void {
  scale3xBorderRow(dst0, src0, src1, src2, count);
  scale3xCenterRow(dst1, src0, src1, src2, count);
  scale3xBorderRow(dst2, src2, src1, src0, count);
}

export function scale3x_16_def(dst0: Uint16Array, dst1: Uint16Array, dst2: Uint16Array, src0: Uint16Array, src1: Uint16Array, src2: Uint16Array, count: number): void {
  scale3xBorderRow(dst0, src0, src1, src2, count);
  scale3xCenterRow(dst1, src0, src1, src2, count);
  scale3xBorderRow(dst2, src2, src1, src0, count);
}

export function scale3x_32_def(dst0: Uint32Array, dst1: Uint32Array, dst2: Uint32Array, src0: Uint32Array, src1: Uint32Array, src2: Uint32Array, count: number): void {
  scale3xBorderRow(dst0, src0, src1, src2, count);
  scale3xCenterRow(dst1, src0, src1, src2, count);
  scale3xBorderRow(dst2, src2, src1, src0, count);
}
