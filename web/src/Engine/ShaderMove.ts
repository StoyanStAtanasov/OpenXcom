import { GraphSubset } from "./GraphSubset.ts";
import { Surface } from "./Surface.ts";
import { ShaderBase } from "./ShaderDrawHelper.ts";

export class ShaderMove<Pixel extends number = number> extends ShaderBase<Pixel> {
  _move_x: number;
  _move_y: number;

  constructor(source: Surface | ShaderMove<Pixel> | Pixel[], max_x?: number, max_y?: number, move_x?: number, move_y?: number) {
    if (source instanceof ShaderMove) {
      super(source);
      this._move_x = source._move_x;
      this._move_y = source._move_y;
      return;
    }
    if (source instanceof Surface) {
      super(source);
      this._move_x = max_x ?? source.getX();
      this._move_y = max_y ?? source.getY();
      return;
    }
    if (max_x == null || max_y == null) {
      throw new Error("ShaderMove requires dimensions for raw pixel buffers.");
    }
    super(source, max_x, max_y);
    this._move_x = move_x ?? 0;
    this._move_y = move_y ?? 0;
  }

  override getImage(): GraphSubset {
    return this._range_domain.offset(this._move_x, this._move_y);
  }

  setMove(x: number, y: number): void {
    this._move_x = x;
    this._move_y = y;
  }

  addMove(x: number, y: number): void {
    this._move_x += x;
    this._move_y += y;
  }
}

export function ShaderSurface(s: Surface): ShaderMove<number>;
export function ShaderSurface(s: Surface, x: number, y: number): ShaderMove<number>;
export function ShaderSurface(s: Surface, x?: number, y?: number): ShaderMove<number> {
  if (x == null || y == null) {
    return new ShaderMove(s);
  }
  return new ShaderMove(s, x, y);
}

export function ShaderCrop(s: Surface, x: number, y: number): ShaderMove<number>;
export function ShaderCrop(s: Surface): ShaderMove<number>;
export function ShaderCrop(s: Surface, x?: number, y?: number): ShaderMove<number> {
  const ret = x == null || y == null ? new ShaderMove(s) : new ShaderMove(s, x, y);
  const crop = s.getCrop();
  if (crop.w && crop.h) {
    const dim = new GraphSubset([crop.x, crop.x + crop.w], [crop.y, crop.y + crop.h]);
    ret.setDomain(dim);
    ret.addMove(-crop.x, -crop.y);
  }
  return ret;
}
