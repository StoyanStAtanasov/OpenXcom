import { scaleNearest32 } from "./common.ts";

export function hq2x_32_rb(
  src: Uint32Array,
  src_rowBytes: number,
  dest: Uint32Array,
  dest_rowBytes: number,
  width: number,
  height: number
): void {
  scaleNearest32(src, src_rowBytes, dest, dest_rowBytes, width, height, 2);
}

export function hq2x_32(src: Uint32Array, dest: Uint32Array, width: number, height: number): void {
  hq2x_32_rb(src, width * 4, dest, width * 8, width, height);
}
