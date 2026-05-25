import { GraphSubset } from "./GraphSubset.ts";
import { Surface } from "./Surface.ts";
import { ShaderBase } from "./ShaderDrawHelper.ts";

export class ShaderRepeat<Pixel extends number = number> extends ShaderBase<Pixel> {
  _off_x = 0;
  _off_y = 0;

  constructor(source: Surface | Pixel[], max_x?: number, max_y?: number) {
    if (source instanceof Surface) {
      super(source);
      this.setOffset(0, 0);
      return;
    }
    if (max_x == null || max_y == null) {
      throw new Error("ShaderRepeat requires dimensions for raw pixel buffers.");
    }
    super(source, max_x, max_y);
    this.setOffset(0, 0);
  }

  setOffset(x: number, y: number): void {
    this._off_x = x;
    this._off_y = y;
  }

  addOffset(x: number, y: number): void {
    this._off_x += x;
    this._off_y += y;
  }
}
