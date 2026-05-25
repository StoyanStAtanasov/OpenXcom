import { scale2x_16_def, scale2x_32_def, scale2x_8_def, scale2x4_16_def, scale2x4_32_def, scale2x4_8_def, scale2x3_16_def, scale2x3_32_def, scale2x3_8_def } from "./scale2x.ts";
import { scale3x_16_def, scale3x_32_def, scale3x_8_def } from "./scale3x.ts";

type PixelSize = 1 | 2 | 4;
type PixelView = Uint8Array | Uint16Array | Uint32Array;

function createPixelView(pixel: PixelSize, buffer: ArrayBufferLike, byteOffset: number, width: number): PixelView {
  switch (pixel) {
    case 1:
      return new Uint8Array(buffer, byteOffset, width);
    case 2:
      return new Uint16Array(buffer, byteOffset, width);
    case 4:
      return new Uint32Array(buffer, byteOffset, width);
  }
}

function getRow(view: ArrayBufferView, rowBytes: number, row: number, pixel: PixelSize, width: number): PixelView {
  return createPixelView(pixel, view.buffer, view.byteOffset + row * rowBytes, width);
}

function scale2xBitmap(dst: ArrayBufferView, dstSlice: number, src: ArrayBufferView, srcSlice: number, pixel: PixelSize, width: number, height: number): void {
  for (let y = 0; y < height; ++y) {
    const row0 = getRow(src, srcSlice, Math.max(0, y - 1), pixel, width);
    const row1 = getRow(src, srcSlice, y, pixel, width);
    const row2 = getRow(src, srcSlice, Math.min(height - 1, y + 1), pixel, width);
    const out0 = getRow(dst, dstSlice, y * 2, pixel, width * 2);
    const out1 = getRow(dst, dstSlice, y * 2 + 1, pixel, width * 2);
    switch (pixel) {
      case 1:
        scale2x_8_def(out0 as Uint8Array, out1 as Uint8Array, row0 as Uint8Array, row1 as Uint8Array, row2 as Uint8Array, width);
        break;
      case 2:
        scale2x_16_def(out0 as Uint16Array, out1 as Uint16Array, row0 as Uint16Array, row1 as Uint16Array, row2 as Uint16Array, width);
        break;
      case 4:
        scale2x_32_def(out0 as Uint32Array, out1 as Uint32Array, row0 as Uint32Array, row1 as Uint32Array, row2 as Uint32Array, width);
        break;
    }
  }
}

function scale2x3Bitmap(dst: ArrayBufferView, dstSlice: number, src: ArrayBufferView, srcSlice: number, pixel: PixelSize, width: number, height: number): void {
  for (let y = 0; y < height; ++y) {
    const row0 = getRow(src, srcSlice, Math.max(0, y - 1), pixel, width);
    const row1 = getRow(src, srcSlice, y, pixel, width);
    const row2 = getRow(src, srcSlice, Math.min(height - 1, y + 1), pixel, width);
    const out0 = getRow(dst, dstSlice, y * 3, pixel, width * 2);
    const out1 = getRow(dst, dstSlice, y * 3 + 1, pixel, width * 2);
    const out2 = getRow(dst, dstSlice, y * 3 + 2, pixel, width * 2);
    switch (pixel) {
      case 1:
        scale2x3_8_def(out0 as Uint8Array, out1 as Uint8Array, out2 as Uint8Array, row0 as Uint8Array, row1 as Uint8Array, row2 as Uint8Array, width);
        break;
      case 2:
        scale2x3_16_def(out0 as Uint16Array, out1 as Uint16Array, out2 as Uint16Array, row0 as Uint16Array, row1 as Uint16Array, row2 as Uint16Array, width);
        break;
      case 4:
        scale2x3_32_def(out0 as Uint32Array, out1 as Uint32Array, out2 as Uint32Array, row0 as Uint32Array, row1 as Uint32Array, row2 as Uint32Array, width);
        break;
    }
  }
}

function scale2x4Bitmap(dst: ArrayBufferView, dstSlice: number, src: ArrayBufferView, srcSlice: number, pixel: PixelSize, width: number, height: number): void {
  for (let y = 0; y < height; ++y) {
    const row0 = getRow(src, srcSlice, Math.max(0, y - 1), pixel, width);
    const row1 = getRow(src, srcSlice, y, pixel, width);
    const row2 = getRow(src, srcSlice, Math.min(height - 1, y + 1), pixel, width);
    const out0 = getRow(dst, dstSlice, y * 4, pixel, width * 2);
    const out1 = getRow(dst, dstSlice, y * 4 + 1, pixel, width * 2);
    const out2 = getRow(dst, dstSlice, y * 4 + 2, pixel, width * 2);
    const out3 = getRow(dst, dstSlice, y * 4 + 3, pixel, width * 2);
    switch (pixel) {
      case 1:
        scale2x4_8_def(out0 as Uint8Array, out1 as Uint8Array, out2 as Uint8Array, out3 as Uint8Array, row0 as Uint8Array, row1 as Uint8Array, row2 as Uint8Array, width);
        break;
      case 2:
        scale2x4_16_def(out0 as Uint16Array, out1 as Uint16Array, out2 as Uint16Array, out3 as Uint16Array, row0 as Uint16Array, row1 as Uint16Array, row2 as Uint16Array, width);
        break;
      case 4:
        scale2x4_32_def(out0 as Uint32Array, out1 as Uint32Array, out2 as Uint32Array, out3 as Uint32Array, row0 as Uint32Array, row1 as Uint32Array, row2 as Uint32Array, width);
        break;
    }
  }
}

function scale3xBitmap(dst: ArrayBufferView, dstSlice: number, src: ArrayBufferView, srcSlice: number, pixel: PixelSize, width: number, height: number): void {
  for (let y = 0; y < height; ++y) {
    const row0 = getRow(src, srcSlice, Math.max(0, y - 1), pixel, width);
    const row1 = getRow(src, srcSlice, y, pixel, width);
    const row2 = getRow(src, srcSlice, Math.min(height - 1, y + 1), pixel, width);
    const out0 = getRow(dst, dstSlice, y * 3, pixel, width * 3);
    const out1 = getRow(dst, dstSlice, y * 3 + 1, pixel, width * 3);
    const out2 = getRow(dst, dstSlice, y * 3 + 2, pixel, width * 3);
    switch (pixel) {
      case 1:
        scale3x_8_def(out0 as Uint8Array, out1 as Uint8Array, out2 as Uint8Array, row0 as Uint8Array, row1 as Uint8Array, row2 as Uint8Array, width);
        break;
      case 2:
        scale3x_16_def(out0 as Uint16Array, out1 as Uint16Array, out2 as Uint16Array, row0 as Uint16Array, row1 as Uint16Array, row2 as Uint16Array, width);
        break;
      case 4:
        scale3x_32_def(out0 as Uint32Array, out1 as Uint32Array, out2 as Uint32Array, row0 as Uint32Array, row1 as Uint32Array, row2 as Uint32Array, width);
        break;
    }
  }
}

function scale4xBitmap(dst: ArrayBufferView, dstSlice: number, src: ArrayBufferView, srcSlice: number, pixel: PixelSize, width: number, height: number): void {
  const intermediateLength = width * height * 4;
  const intermediate = pixel === 1 ? new Uint8Array(intermediateLength) : pixel === 2 ? new Uint16Array(intermediateLength) : new Uint32Array(intermediateLength);
  const midSlice = width * 2 * pixel;
  scale2xBitmap(intermediate, midSlice, src, srcSlice, pixel, width, height);
  scale2xBitmap(dst, dstSlice, intermediate, midSlice, pixel, width * 2, height * 2);
}

export function scale_precondition(scale: number, pixel: number, width: number, height: number): number {
  if (pixel !== 1 && pixel !== 2 && pixel !== 4) {
    return -1;
  }
  switch (scale) {
    case 202:
    case 203:
    case 204:
    case 2:
    case 303:
    case 3:
      if (height < 2) {
        return -1;
      }
      break;
    case 404:
    case 4:
      if (height < 4) {
        return -1;
      }
      break;
    default:
      return -1;
  }
  if (width < 2) {
    return -1;
  }
  return 0;
}

export function scale(
  scaleFactor: number,
  void_dst: ArrayBufferView,
  dst_slice: number,
  void_src: ArrayBufferView,
  src_slice: number,
  pixel: number,
  width: number,
  height: number
): void {
  const size = pixel as PixelSize;
  switch (scaleFactor) {
    case 202:
    case 2:
      scale2xBitmap(void_dst, dst_slice, void_src, src_slice, size, width, height);
      break;
    case 203:
      scale2x3Bitmap(void_dst, dst_slice, void_src, src_slice, size, width, height);
      break;
    case 204:
      scale2x4Bitmap(void_dst, dst_slice, void_src, src_slice, size, width, height);
      break;
    case 303:
    case 3:
      scale3xBitmap(void_dst, dst_slice, void_src, src_slice, size, width, height);
      break;
    case 404:
    case 4:
      scale4xBitmap(void_dst, dst_slice, void_src, src_slice, size, width, height);
      break;
  }
}
