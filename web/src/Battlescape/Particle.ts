import { RNG } from "../Engine/RNG.ts";

export class Particle {
  private _size = 0;

  constructor(
    private _xOffset: number,
    private _yOffset: number,
    private _density: number,
    private _color: number,
    private _opacity: number
  ) {
    if (this._density < 100) {
      this._size = 3;
    } else if (this._density < 125) {
      this._size = 2;
    } else if (this._density < 150) {
      this._size = 1;
    }
  }

  animate(): boolean {
    this._yOffset -= (320 - this._density) / 256.0;
    this._opacity--;
    this._xOffset += (RNG.seedless(0, 1) * 2 - 1) * (0.25 + RNG.seedless(0, 9) / 30);
    return this._opacity !== 0;
  }

  getSize(): number {
    return this._size;
  }

  getColor(): number {
    return this._color;
  }

  getOpacity(): number {
    return Math.min(Math.trunc((this._opacity + 7) / 10), 3);
  }

  getX(): number {
    return this._xOffset;
  }

  getY(): number {
    return this._yOffset;
  }
}
