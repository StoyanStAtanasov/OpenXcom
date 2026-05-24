import { Surface } from "../Engine/Surface.ts";
import type { Action } from "../Engine/Action.ts";

export class FpsCounter extends Surface {
  private _frames = 0;
  private _last = performance.now();
  private _fps = 0;
  private _color = 3;

  setColor(color: number): void {
    this._color = color;
    this.invalidate();
  }

  handle(_action: Action): void {}

  addFrame(): void {
    this._frames++;
    const now = performance.now();
    if (now - this._last >= 1000) {
      this._fps = this._frames;
      this._frames = 0;
      this._last = now;
      this.invalidate();
    }
  }

  override draw(): void {
    super.draw();
    const ctx = this.getContext();
    ctx.font = "10px Consolas, monospace";
    ctx.fillStyle = `rgb(${this._color * 32}, 255, ${this._color * 16})`;
    ctx.fillText(String(this._fps), 0, 0);
  }
}
