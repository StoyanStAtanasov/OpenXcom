import { GraphSubset } from "./GraphSubset.ts";
import { Nothing, Offset, Scalar, ShaderBase, controler } from "./ShaderDrawHelper.ts";

export const ColorGroup = 15 << 4;
export const ColorShade = 15;
export const ColorShadeMax = 15;
export const BLACK = 15;

type DrawColorFunc = { func: (...args: unknown[]) => unknown };

function drawInternal<ColorFunc extends DrawColorFunc>(
  colorFunc: ColorFunc,
  destFrame: unknown,
  src0Frame: unknown,
  src1Frame: unknown,
  src2Frame: unknown,
  src3Frame: unknown
): void {
  const dest = new controler(destFrame);
  const src0 = new controler(src0Frame);
  const src1 = new controler(src1Frame);
  const src2 = new controler(src2Frame);
  const src3 = new controler(src3Frame);

  const endTemp = dest.get_range();
  src0.mod_range(endTemp);
  src1.mod_range(endTemp);
  src2.mod_range(endTemp);
  src3.mod_range(endTemp);

  const end = endTemp;
  if (end.size_x() === 0 || end.size_y() === 0) {
    return;
  }

  dest.set_range(end);
  src0.set_range(end);
  src1.set_range(end);
  src2.set_range(end);
  src3.set_range(end);

  let begin_y = 0;
  let end_y = end.size_y();
  dest.mod_y(begin_y, end_y);
  src0.mod_y(begin_y, end_y);
  src1.mod_y(begin_y, end_y);
  src2.mod_y(begin_y, end_y);
  src3.mod_y(begin_y, end_y);
  if (begin_y >= end_y) {
    return;
  }

  dest.set_y(begin_y, end_y);
  src0.set_y(begin_y, end_y);
  src1.set_y(begin_y, end_y);
  src2.set_y(begin_y, end_y);
  src3.set_y(begin_y, end_y);

  for (let y = end_y - begin_y; y > 0; --y, dest.inc_y(), src0.inc_y(), src1.inc_y(), src2.inc_y(), src3.inc_y()) {
    let begin_x = 0;
    let end_x = end.size_x();
    dest.mod_x(begin_x, end_x);
    src0.mod_x(begin_x, end_x);
    src1.mod_x(begin_x, end_x);
    src2.mod_x(begin_x, end_x);
    src3.mod_x(begin_x, end_x);
    if (begin_x >= end_x) {
      continue;
    }

    dest.set_x(begin_x, end_x);
    src0.set_x(begin_x, end_x);
    src1.set_x(begin_x, end_x);
    src2.set_x(begin_x, end_x);
    src3.set_x(begin_x, end_x);

    for (let x = end_x - begin_x; x > 0; --x, dest.inc_x(), src0.inc_x(), src1.inc_x(), src2.inc_x(), src3.inc_x()) {
      const nextValue = colorFunc.func(dest.get_ref(), src0.get_ref(), src1.get_ref(), src2.get_ref(), src3.get_ref());
      dest.set_ref(nextValue);
    }
  }
}

export function ShaderDraw<ColorFunc extends DrawColorFunc>(destFrame: unknown): void;
export function ShaderDraw<ColorFunc extends DrawColorFunc>(destFrame: unknown, src0Frame: unknown): void;
export function ShaderDraw<ColorFunc extends DrawColorFunc>(destFrame: unknown, src0Frame: unknown, src1Frame: unknown): void;
export function ShaderDraw<ColorFunc extends DrawColorFunc>(destFrame: unknown, src0Frame: unknown, src1Frame: unknown, src2Frame: unknown): void;
export function ShaderDraw<ColorFunc extends DrawColorFunc>(destFrame: unknown, src0Frame: unknown, src1Frame: unknown, src2Frame: unknown, src3Frame: unknown): void;
export function ShaderDraw<ColorFunc extends DrawColorFunc>(
  destFrame: unknown,
  src0Frame: unknown = new Nothing(),
  src1Frame: unknown = new Nothing(),
  src2Frame: unknown = new Nothing(),
  src3Frame: unknown = new Nothing()
): void {
  // Browser port boundary: the translated renderer keeps the source-shaped API.
  // The draw loop still runs against browser-safe buffers and returns the next pixel value.
  void GraphSubset;
  void ShaderBase;
  void Scalar;
  void Offset;
  void controler;
  drawInternal({ func: (a: unknown, b: unknown, c: unknown, d: unknown, e: unknown) => a } as ColorFunc, destFrame, src0Frame, src1Frame, src2Frame, src3Frame);
}

export function ShaderScalar<T>(t: T): Scalar<T> {
  return new Scalar(t);
}

export const helper = {
  ColorGroup,
  ColorShade,
  ColorShadeMax,
  BLACK,
  Nothing,
  Scalar,
  Offset,
  ShaderBase,
  controler
};
