import { Surface } from "../Engine/Surface.ts";
import type { PaletteColor } from "../types.ts";

const DIGITS = [
  ["111", "101", "101", "101", "111"],
  ["010", "110", "010", "010", "111"],
  ["111", "001", "111", "100", "111"],
  ["111", "001", "111", "001", "111"],
  ["101", "101", "111", "001", "001"],
  ["111", "100", "111", "001", "111"],
  ["111", "100", "111", "101", "111"],
  ["111", "001", "001", "001", "001"],
  ["111", "101", "111", "101", "111"],
  ["111", "101", "111", "001", "111"]
];

export class NumberText extends Surface {
  private _value = 0;
  private _chars: Surface[] = [];
  private _borderedChars: Surface[] = [];
  private _bordered = false;
  private _color = 0;

  constructor(width: number, height: number, x = 0, y = 0) {
    super(width, height, x, y);
    for (let i = 0; i < 10; ++i) {
      const digit = new Surface(3, 5);
      for (let y = 0; y < 5; ++y) {
        for (let x = 0; x < 3; ++x) {
          if (DIGITS[i][y][x] === "1") digit.setPixel(x, y, 1);
        }
      }
      this._chars.push(digit);
      const bordered = new Surface(5, 7);
      for (const [x, y, shade] of [[0, 0, 11], [2, 0, 11], [0, 2, 11], [2, 2, 11], [0, 1, 8], [1, 0, 8], [2, 1, 8], [1, 2, 8]]) {
        digit.blitNShade(bordered, x, y, shade);
      }
      digit.blitNShade(bordered, 1, 1, 0);
      this._borderedChars.push(bordered);
    }
  }

  setValue(value: number): void {
    this._value = Math.max(0, Math.trunc(value));
    this.invalidate();
  }

  getValue(): number {
    return this._value;
  }

  override setColor(color: number): void {
    this._color = color;
    this.invalidate();
  }

  getColor(): number {
    return this._color;
  }

  override setPalette(colors: PaletteColor[], firstcolor = 0, ncolors = 256): void {
    super.setPalette(colors, firstcolor, ncolors);
    for (let i = 0; i < 10; ++i) {
      this._chars[i].setPalette(colors, firstcolor, ncolors);
      this._borderedChars[i].setPalette(colors, firstcolor, ncolors);
    }
  }

  override draw(): void {
    super.draw();
    let x = 0;
    for (const ch of String(this._value)) {
      const digit = Number(ch);
      const surface = this._bordered ? this._borderedChars[digit] : this._chars[digit];
      for (let sy = 0; sy < surface.getHeight(); ++sy) {
        for (let sx = 0; sx < surface.getWidth(); ++sx) {
          const pixel = surface.getPixel(sx, sy);
          if (pixel) {
            this.setPixel(x + sx, sy, pixel);
          }
        }
      }
      x += this._chars[digit].getWidth() + 1;
    }
    this.offset(this._color);
  }

  setBordered(bordered: boolean): void {
    this._bordered = bordered;
    this.invalidate();
  }
}
