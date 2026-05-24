import { InteractiveSurface } from "../Engine/InteractiveSurface.ts";
import type { Action } from "../Engine/Action.ts";
import type { Font } from "../Engine/Font.ts";
import type { Language } from "../Engine/Language.ts";
import type { State } from "../Engine/State.ts";
import type { PaletteColor } from "../types.ts";
import { SDL_BUTTON_LEFT, SDL_BUTTON_WHEELDOWN, SDL_BUTTON_WHEELUP } from "../types.ts";
import { Frame } from "./Frame.ts";
import { Text } from "./Text.ts";

/**
 * Horizontal slider control to select from a range of values.
 */
export class Slider extends InteractiveSurface {
  private _frame: Frame;
  private _txtMinus: Text;
  private _txtPlus: Text;
  private _pos = 0;
  private _min = 0;
  private _max = 0;
  private _value = 0;
  private _pressed = false;
  private _change: ((action: Action) => void) | null = null;
  private _thickness = 3;
  private _textness = 8;
  private _minX = 0;
  private _maxX = 0;
  private _offsetX = 0;

  constructor(width: number, height: number, x = 0, y = 0) {
    super(width, height, x, y);
    this._frame = new Frame(width, height, 0, 0);
    this._txtMinus = new Text(8, height, 0, 0);
    this._txtPlus = new Text(8, height, width - 8, 0);
    this._txtMinus.setText("-");
    this._txtPlus.setText("+");
    this.resetBounds();
  }

  override initText(big?: unknown, small?: unknown, lang?: unknown): void {
    this._txtMinus.initText(big as Font | undefined, small as Font | undefined, lang as Language | undefined);
    this._txtPlus.initText(big as Font | undefined, small as Font | undefined, lang as Language | undefined);
  }

  override setHighContrast(contrast: boolean): void {
    this._frame.setHighContrast(contrast);
    this._txtMinus.setHighContrast(contrast);
    this._txtPlus.setHighContrast(contrast);
    this.invalidate();
  }

  override setColor(color: number): void {
    this._frame.setColor(color);
    this._txtMinus.setColor(color);
    this._txtPlus.setColor(color);
    this.invalidate();
  }

  getColor(): number {
    return this._frame.getColor();
  }

  override setPalette(colors: PaletteColor[], firstcolor = 0, ncolors = 256): void {
    super.setPalette(colors, firstcolor, ncolors);
    this._frame.setPalette(colors, firstcolor, ncolors);
    this._txtMinus.setPalette(colors, firstcolor, ncolors);
    this._txtPlus.setPalette(colors, firstcolor, ncolors);
  }

  setRange(min: number, max: number): void {
    this._min = Math.trunc(min);
    this._max = Math.max(this._min, Math.trunc(max));
    this.setValue(Math.max(this._min, Math.min(this._max, this._value)));
  }

  setValue(value: number): void {
    this._value = Math.max(this._min, Math.min(this._max, Math.trunc(value)));
    if (this._max === this._min) {
      this.setPosition(0);
    } else {
      this.setPosition((this._value - this._min) / (this._max - this._min));
    }
  }

  getValue(): number {
    return this._value;
  }

  onChange(handler: ((action: Action) => void) | null): void {
    this._change = handler;
  }

  override draw(): void {
    super.draw();
    this._frame.draw();
    this._frame.blit(this);
    this._txtMinus.draw();
    this._txtMinus.blit(this);
    this._txtPlus.draw();
    this._txtPlus.blit(this);

    const trackY = Math.trunc(this.getHeight() / 2);
    this.drawRect(this._minX, trackY - 1, Math.max(1, this._maxX - this._minX + 1), 3, this.getColor() + 2);
    const knobX = Math.trunc(this._minX + this._pos * (this._maxX - this._minX));
    this.drawRect(knobX - 2, this._thickness, 5, this.getHeight() - this._thickness * 2, this.getColor() + 5);
  }

  override mousePress(action: Action, state: State): void {
    const button = action.getDetails().button?.button;
    if (button === SDL_BUTTON_LEFT) {
      this._pressed = true;
      this.setValueFromX(action.getRelativeXMouse() / action.getXScale());
      this._change?.(action);
    } else if (button === SDL_BUTTON_WHEELUP || button === SDL_BUTTON_WHEELDOWN) {
      const delta = button === SDL_BUTTON_WHEELUP ? -1 : 1;
      const old = this._value;
      this.setValue(this._value + delta);
      if (old !== this._value) {
        this._change?.(action);
      }
    }
    super.mousePress(action, state);
  }

  override mouseRelease(action: Action, state: State): void {
    this._pressed = false;
    super.mouseRelease(action, state);
  }

  override mouseOver(action: Action, state: State): void {
    if (this._pressed) {
      const old = this._value;
      this.setValueFromX(action.getRelativeXMouse() / action.getXScale());
      if (old !== this._value) {
        this._change?.(action);
      }
    }
    super.mouseOver(action, state);
  }

  override setWidth(width: number): void {
    super.setWidth(width);
    this._frame.setWidth(width);
    this._txtPlus.setX(width - this._textness);
    this.resetBounds();
  }

  override setHeight(height: number): void {
    super.setHeight(height);
    this._frame.setHeight(height);
    this._txtMinus.setHeight(height);
    this._txtPlus.setHeight(height);
    this.resetBounds();
  }

  private setPosition(pos: number): void {
    this._pos = Math.max(0, Math.min(1, pos));
    this.invalidate();
  }

  private setValueFromX(x: number): void {
    const rel = Math.max(this._minX, Math.min(this._maxX, Math.trunc(x) - this._offsetX));
    const pos = this._maxX === this._minX ? 0 : (rel - this._minX) / (this._maxX - this._minX);
    const value = this._min + Math.round(pos * (this._max - this._min));
    this.setValue(value);
  }

  private resetBounds(): void {
    this._offsetX = 0;
    this._minX = this._textness + this._thickness;
    this._maxX = Math.max(this._minX, this.getWidth() - this._textness - this._thickness - 1);
    this._txtPlus.setX(this.getWidth() - this._textness);
    this.setValue(this._value);
  }
}
