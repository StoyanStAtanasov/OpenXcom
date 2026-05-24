import { Palette } from "../Engine/Palette.ts";
import { Surface } from "../Engine/Surface.ts";

/**
 * Fancy frame border thing used for windows and other elements.
 */
export class Frame extends Surface {
  private _color = 0;
  private _bg = 0;
  private _thickness = 5;
  private _contrast = false;

  override setColor(color: number): void {
    this._color = color;
    this.invalidate();
  }

  getColor(): number {
    return this._color;
  }

  override setBorderColor(color: number): void {
    this.setColor(color);
  }

  override setSecondaryColor(bg: number): void {
    this._bg = bg;
    this.invalidate();
  }

  getSecondaryColor(): number {
    return this._bg;
  }

  override setHighContrast(contrast: boolean): void {
    this._contrast = contrast;
    this.invalidate();
  }

  setThickness(thickness: number): void {
    this._thickness = thickness;
    this.invalidate();
  }

  override draw(): void {
    super.draw();
    const square = { x: 0, y: 0, w: this.getWidth(), h: this.getHeight() };
    const mul = this._contrast ? 2 : 1;
    let color = this._color + Math.trunc(((1 + this._thickness) * mul) / 2);
    const darkest = Palette.blockOffset(Math.trunc(this._color / 16)) + 15;

    for (let i = 0; i < this._thickness; ++i) {
      if (this._thickness > 5 && (i === 0 || i === this._thickness - 1)) {
        this.drawRect(square, darkest);
      } else {
        this.drawRect(square, color);
      }
      if (i < Math.trunc(this._thickness / 2)) {
        color -= mul;
      } else {
        color += mul;
      }
      square.x++;
      square.y++;
      square.w = square.w >= 2 ? square.w - 2 : 1;
      square.h = square.h >= 2 ? square.h - 2 : 1;
    }
    this.drawRect(square, this._bg);
  }
}
