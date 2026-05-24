import { Surface } from "../Engine/Surface.ts";

/**
 * Bar graphic that represents a certain value.
 */
export class Bar extends Surface {
  private _color = 0;
  private _color2 = 0;
  private _borderColor = 0;
  private _scale = 0;
  private _max = 0;
  private _value = 0;
  private _value2 = 0;
  private _secondOnTop = true;

  override setColor(color: number): void {
    this._color = color;
    this.invalidate();
  }

  getColor(): number {
    return this._color;
  }

  override setSecondaryColor(color: number): void {
    this._color2 = color;
    this.invalidate();
  }

  getSecondaryColor(): number {
    return this._color2;
  }

  setScale(scale: number): void {
    this._scale = scale;
    this.invalidate();
  }

  getScale(): number {
    return this._scale;
  }

  setMax(max: number): void {
    this._max = max;
    this.invalidate();
  }

  getMax(): number {
    return this._max;
  }

  setValue(value: number): void {
    this._value = value < 0.0 ? 0.0 : value;
    this.invalidate();
  }

  getValue(): number {
    return this._value;
  }

  setValue2(value: number): void {
    this._value2 = value < 0.0 ? 0.0 : value;
    this.invalidate();
  }

  getValue2(): number {
    return this._value2;
  }

  setSecondValueOnTop(onTop: boolean): void {
    this._secondOnTop = onTop;
    this.invalidate();
  }

  override setBorderColor(bc: number): void {
    this._borderColor = bc;
    this.invalidate();
  }

  override draw(): void {
    super.draw();
    const square = {
      x: 0,
      y: 0,
      w: Math.trunc(this._scale * this._max) + 1,
      h: this.getHeight()
    };

    this.drawRect(square, this._borderColor || this._color + 4);

    square.y++;
    square.w--;
    square.h -= 2;

    this.drawRect(square, 0);

    if (this._secondOnTop) {
      square.w = Math.trunc(this._scale * this._value);
      this.drawRect(square, this._color);
      square.w = Math.trunc(this._scale * this._value2);
      this.drawRect(square, this._color2);
    } else {
      square.w = Math.trunc(this._scale * this._value2);
      this.drawRect(square, this._color2);
      square.w = Math.trunc(this._scale * this._value);
      this.drawRect(square, this._color);
    }
  }
}
