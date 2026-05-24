import { Surface } from "../Engine/Surface.ts";
import type { Action } from "../Engine/Action.ts";
import { SDL_MOUSEMOTION } from "../types.ts";

export class Cursor extends Surface {
  private _color = 3;

  constructor(width: number, height: number) {
    super(width, height);
    this.draw();
  }

  setColor(color: number): void {
    this._color = color;
    this.invalidate();
  }

  getColor(): number {
    return this._color;
  }

  handle(action: Action): void {
    const details = action.getDetails();
    if (details.type === SDL_MOUSEMOTION && details.motion) {
      this.setX(Math.trunc(action.getAbsoluteXMouse()));
      this.setY(Math.trunc(action.getAbsoluteYMouse()));
    }
  }

  override draw(): void {
    super.draw();
    for (let y = 0; y < this.getHeight(); ++y) {
      this.setPixel(0, y, this._color);
    }
    for (let x = 0; x < this.getWidth(); ++x) {
      this.setPixel(x, 0, this._color);
    }
    this.setPixel(1, 1, this._color + 2);
    this.setPixel(2, 2, this._color + 2);
  }
}
