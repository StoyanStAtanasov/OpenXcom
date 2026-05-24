import { InteractiveSurface, type ActionHandler } from "../Engine/InteractiveSurface.ts";
import { KEYBOARD_ON, Options } from "../Engine/Options.ts";
import { Timer } from "../Engine/Timer.ts";
import { convUtf32ToUtf8, convUtf8ToUtf32, type UCode, type UString } from "../Engine/Unicode.ts";
import type { Action } from "../Engine/Action.ts";
import type { State } from "../Engine/State.ts";
import type { Font } from "../Engine/Font.ts";
import type { Language } from "../Engine/Language.ts";
import type { PaletteColor } from "../types.ts";
import { SDL_BUTTON_LEFT } from "../types.ts";
import { Text } from "./Text.ts";

export enum TextEditConstraint {
  TEC_NONE,
  TEC_NUMERIC_POSITIVE,
  TEC_NUMERIC
}

export class TextEdit extends InteractiveSurface {
  private _text: Text;
  private _blink = true;
  private _modal = true;
  private _timer: Timer;
  private _char = "A".codePointAt(0)!;
  private _caretPos = 0;
  private _value: UString = [];
  private _textEditConstraint = TextEditConstraint.TEC_NONE;
  private _change: ActionHandler | null = null;

  constructor(private _state: State, width: number, height: number, x = 0, y = 0) {
    super(width, height, x, y);
    this._isFocused = false;
    this._text = new Text(width, height, 0, 0);
    this._timer = new Timer(100);
    this._timer.onSurfaceTimer(this.blink.bind(this));
  }

  override handle(action: Action, state: State): void {
    super.handle(action, state);
    if (this._isFocused && this._modal && action.getDetails().type === "SDL_MOUSEBUTTONDOWN" && (
      action.getAbsoluteXMouse() < this.getX() ||
      action.getAbsoluteXMouse() >= this.getX() + this.getWidth() ||
      action.getAbsoluteYMouse() < this.getY() ||
      action.getAbsoluteYMouse() >= this.getY() + this.getHeight()
    )) {
      this.setFocus(false);
    }
  }

  override setFocus(focus: boolean): void;
  setFocus(focus: boolean, modal: boolean): void;
  setFocus(focus: boolean, modal = true): void {
    this._modal = modal;
    if (focus === this._isFocused) {
      return;
    }
    super.setFocus(focus);
    if (this._isFocused) {
      this._caretPos = this._value.length;
      this._blink = true;
      this._timer.start();
      if (this._modal) {
        this._state.setModal(this);
      }
    } else {
      this._blink = false;
      this._timer.stop();
      if (this._modal) {
        this._state.setModal(null);
      }
    }
    this.invalidate();
  }

  setBig(): void {
    this._text.setBig();
    this.invalidate();
  }

  setSmall(): void {
    this._text.setSmall();
    this.invalidate();
  }

  override initText(big?: unknown, small?: unknown, lang?: unknown): void {
    this._text.initText(big as Font | null, small as Font | null, lang as Language | null);
    this.invalidate();
  }

  setText(text: string): void {
    this._value = convUtf8ToUtf32(text);
    this._caretPos = this._value.length;
    this.invalidate();
  }

  getText(): string {
    return convUtf32ToUtf8(this._value);
  }

  setWordWrap(wrap: boolean): void {
    this._text.setWordWrap(wrap);
    this.invalidate();
  }

  setInvert(invert: boolean): void {
    this._text.setInvert(invert);
    this.invalidate();
  }

  override setHighContrast(contrast: boolean): void {
    this._text.setHighContrast(contrast);
    this.invalidate();
  }

  setAlign(align: string): void {
    this._text.setAlign(align);
    this.invalidate();
  }

  setVerticalAlign(valign: string): void {
    this._text.setVerticalAlign(valign);
    this.invalidate();
  }

  setConstraint(constraint: TextEditConstraint): void {
    this._textEditConstraint = constraint;
  }

  override setColor(color: number): void {
    this._text.setColor(color);
    this.invalidate();
  }

  getColor(): number {
    return this._text.getColor();
  }

  override setSecondaryColor(color: number): void {
    this._text.setSecondaryColor(color);
    this.invalidate();
  }

  getSecondaryColor(): number {
    return this._text.getSecondaryColor();
  }

  override setPalette(colors: PaletteColor[], firstcolor = 0, ncolors = 256): void {
    super.setPalette(colors, firstcolor, ncolors);
    this._text.setPalette(colors, firstcolor, ncolors);
  }

  override think(): void {
    this._timer.think(null, this);
  }

  blink(): void {
    this._blink = !this._blink;
    this.invalidate();
  }

  override draw(): void {
    super.draw();
    const value = [...this._value];
    if (this._isFocused && this._blink) {
      const caret = Options.keyboardMode === KEYBOARD_ON ? "|".codePointAt(0)! : this._char;
      value.splice(this._caretPos, 0, caret);
    }
    this._text.setText(convUtf32ToUtf8(value));
    this._text.blit(this);
  }

  override mousePress(action: Action, state: State): void {
    if (action.getDetails().button?.button === SDL_BUTTON_LEFT) {
      if (!this._isFocused) {
        this.setFocus(true);
      }
      this._caretPos = this.caretFromMouse(action);
      this.invalidate();
    }
    super.mousePress(action, state);
  }

  override keyboardPress(action: Action, state: State): void {
    const sym = action.getDetails().key?.keysym.sym || "";
    if (Options.keyboardMode === KEYBOARD_ON) {
      switch (sym) {
        case "ArrowLeft":
          this._caretPos = Math.max(0, this._caretPos - 1);
          break;
        case "ArrowRight":
          this._caretPos = Math.min(this._value.length, this._caretPos + 1);
          break;
        case "Home":
          this._caretPos = 0;
          break;
        case "End":
          this._caretPos = this._value.length;
          break;
        case "Backspace":
          if (this._caretPos > 0) {
            this._value.splice(this._caretPos - 1, 1);
            this._caretPos--;
          }
          break;
        case "Delete":
          if (this._caretPos < this._value.length) {
            this._value.splice(this._caretPos, 1);
          }
          break;
        case "Enter":
        case "NumpadEnter":
          if (this._value.length > 0) {
            this.setFocus(false);
          }
          break;
        default:
          if (sym.length === 1) {
            const c = sym.codePointAt(0)!;
            if (this.isValidChar(c) && !this.exceedsMaxWidth(c)) {
              this._value.splice(this._caretPos, 0, c);
              this._caretPos++;
            }
          }
          break;
      }
    }
    this.invalidate();
    this._change?.(action);
    super.keyboardPress(action, state);
  }

  onChange(handler: ActionHandler | null): void {
    this._change = handler;
  }

  private exceedsMaxWidth(c: UCode): boolean {
    const font = this._text.getFont();
    if (!font) {
      return false;
    }
    const value = [...this._value];
    value.splice(this._caretPos, 0, c);
    let width = 0;
    for (const ch of value) {
      width += font.getCharSize(ch).w;
    }
    return width > this.getWidth();
  }

  private isValidChar(c: UCode): boolean {
    switch (this._textEditConstraint) {
      case TextEditConstraint.TEC_NUMERIC_POSITIVE:
        return c >= 48 && c <= 57;
      case TextEditConstraint.TEC_NUMERIC:
        if (this._caretPos > 0) {
          return c >= 48 && c <= 57;
        }
        return ((c >= 48 && c <= 57) || c === 43 || c === 45) && (this._value.length === 0 || (this._value[0] !== 43 && this._value[0] !== 45));
      case TextEditConstraint.TEC_NONE:
      default:
        return (c >= 32 && c <= 126) || c >= 160;
    }
  }

  private caretFromMouse(action: Action): number {
    const font = this._text.getFont();
    if (!font) {
      return this._value.length;
    }
    const mouseX = action.getAbsoluteXMouse() - this.getX();
    let width = 0;
    for (let i = 0; i < this._value.length; ++i) {
      const charWidth = font.getCharSize(this._value[i]).w;
      if (mouseX < width + charWidth / 2) {
        return i;
      }
      width += charWidth;
    }
    return this._value.length;
  }
}
