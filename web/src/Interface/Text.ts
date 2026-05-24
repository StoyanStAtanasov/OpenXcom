import { InteractiveSurface } from "../Engine/InteractiveSurface.ts";
import type { Action } from "../Engine/Action.ts";
import type { State } from "../Engine/State.ts";
import type { Font } from "../Engine/Font.ts";
import type { Language } from "../Engine/Language.ts";
import { DIRECTION_RTL, WRAP_LETTERS, WRAP_WORDS } from "../Engine/Language.ts";
import { convUtf8ToUtf32, isLinebreak, isPrintable, isSeparator, isSpace, TOK_COLOR_FLIP, TOK_NL_SMALL, type UString } from "../Engine/Unicode.ts";
import { SDL_BUTTON_WHEELDOWN, SDL_BUTTON_WHEELUP } from "../types.ts";

export const ALIGN_LEFT = "ALIGN_LEFT";
export const ALIGN_CENTER = "ALIGN_CENTER";
export const ALIGN_RIGHT = "ALIGN_RIGHT";
export const ALIGN_TOP = "ALIGN_TOP";
export const ALIGN_MIDDLE = "ALIGN_MIDDLE";
export const ALIGN_BOTTOM = "ALIGN_BOTTOM";

export class Text extends InteractiveSurface {
  private _big: Font | null = null;
  private _small: Font | null = null;
  private _font: Font | null = null;
  private _fontOrig: Font | null = null;
  private _lang: Language | null = null;
  private _text = "";
  private _processedText: UString = [];
  private _lineWidth: number[] = [];
  private _lineHeight: number[] = [];
  private _wrap = false;
  private _invert = false;
  private _contrast = false;
  private _indent = false;
  private _scroll = false;
  private _align = ALIGN_LEFT;
  private _valign = ALIGN_TOP;
  private _color = 0;
  private _color2 = 0;
  private _scrollY = 0;

  setBig(): void {
    this._font = this._big;
    this._fontOrig = this._big;
    this.processText();
  }

  setSmall(): void {
    this._font = this._small;
    this._fontOrig = this._small;
    this.processText();
  }

  getFont(): Font | null {
    return this._font;
  }

  override initText(big?: unknown, small?: unknown, lang?: unknown): void {
    this._big = (big as Font | null) || this._big;
    this._small = (small as Font | null) || this._small || this._big;
    this._lang = (lang as Language | null) || this._lang;
    this.setSmall();
  }

  setText(text: string): void {
    this._text = String(text);
    this._font = this._fontOrig;
    this.processText();
    if (this._text && this._font === this._big && (this.getTextWidth() > this.getWidth() || this.getTextHeight() > this.getHeight()) && this._text[this._text.length - 1] !== ".") {
      this._font = this._small;
      this.processText();
    }
  }

  getText(): string {
    return this._text;
  }

  setWordWrap(wrap: boolean, indent = false): void {
    if (wrap !== this._wrap || indent !== this._indent) {
      this._wrap = wrap;
      this._indent = indent;
      this.processText();
    }
  }

  setInvert(invert: boolean): void {
    this._invert = invert;
    this.invalidate();
  }

  override setHighContrast(contrast: boolean): void {
    this._contrast = contrast;
    this.invalidate();
  }

  setAlign(align: string): void {
    this._align = align;
    this.invalidate();
  }

  getAlign(): string {
    return this._align;
  }

  setVerticalAlign(valign: string): void {
    this._valign = valign;
    this.invalidate();
  }

  getVerticalAlign(): string {
    return this._valign;
  }

  override setColor(color: number): void {
    this._color = color;
    this._color2 = color;
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

  getNumLines(): number {
    return this._wrap ? this._lineHeight.length : 1;
  }

  getTextHeight(line = -1): number {
    if (line === -1) {
      return this._lineHeight.reduce((height, h) => height + h, 0);
    }
    return this._lineHeight[line] || 0;
  }

  getTextWidth(line = -1): number {
    if (line === -1) {
      return Math.max(0, ...this._lineWidth);
    }
    return this._lineWidth[line] || 0;
  }

  override draw(): void {
    super.draw();
    if (!this._text || !this._font) {
      return;
    }
    let x = 0;
    let y = 0;
    let line = 0;
    let font = this._font;
    let color = this._color;
    const height = this.getTextHeight();
    if (this._scroll) {
      y = this._scrollY;
    } else {
      switch (this._valign) {
        case ALIGN_MIDDLE:
          y = Math.ceil((this.getHeight() - height) / 2.0);
          break;
        case ALIGN_BOTTOM:
          y = this.getHeight() - height;
          break;
        case ALIGN_TOP:
        default:
          y = 0;
          break;
      }
    }
    x = this.getLineX(line);
    const mul = this._contrast ? 3 : 1;
    const dir = this._lang?.getTextDirection() === DIRECTION_RTL ? -1 : 1;
    const mid = this._invert ? 3 : 0;

    for (const c of this._processedText) {
      if (isSpace(c) || c === "\t".codePointAt(0)) {
        x += dir * font.getCharSize(c).w;
      } else if (isLinebreak(c)) {
        line++;
        y += font.getCharSize(c).h;
        x = this.getLineX(line);
        if (c === TOK_NL_SMALL && this._small) {
          font = this._small;
        }
      } else if (c === TOK_COLOR_FLIP) {
        color = color === this._color ? this._color2 : this._color;
      } else {
        if (dir < 0) {
          x += dir * font.getCharSize(c).w;
        }
        const chr = font.getChar(c);
        this.blitPaletteShift(chr, x, y, color, mul, mid);
        if (dir > 0) {
          x += dir * font.getCharSize(c).w;
        }
      }
    }
  }

  setScrollable(scroll: boolean): void {
    this._scroll = scroll;
  }

  override mousePress(action: Action, state: State): void {
    super.mousePress(action, state);
    const button = action.getDetails().button?.button;
    if (!this._scroll || (button !== SDL_BUTTON_WHEELUP && button !== SDL_BUTTON_WHEELDOWN) || !this._font) {
      return;
    }
    const scrollArea = this.getHeight() - this.getTextHeight();
    if (scrollArea < 0) {
      let scrollAmount = this._font.getHeight() + this._font.getSpacing();
      if (button === SDL_BUTTON_WHEELDOWN) {
        scrollAmount = -scrollAmount;
      }
      this._scrollY = Math.max(scrollArea, Math.min(0, this._scrollY + scrollAmount));
      this.invalidate();
    }
  }

  private processText(): void {
    if (!this._font || !this._lang) {
      return;
    }
    this._processedText = convUtf8ToUtf32(this._text);
    this._lineWidth = [];
    this._lineHeight = [];
    this._scrollY = 0;

    let width = 0;
    let word = 0;
    let space = 0;
    let textIndentation = 0;
    let start = true;
    let font = this._font;
    const str = this._processedText;

    for (let c = 0; c <= str.length; ++c) {
      if (c === str.length || isLinebreak(str[c])) {
        this._lineWidth.push(width);
        this._lineHeight.push(font.getCharSize("\n".codePointAt(0)!).h);
        width = 0;
        word = 0;
        start = true;
        if (c === str.length) {
          break;
        } else if (str[c] === TOK_NL_SMALL && this._small) {
          font = this._small;
        }
      } else if (isSpace(str[c]) || isSeparator(str[c])) {
        if (c === textIndentation) {
          textIndentation++;
        }
        space = c;
        width += font.getCharSize(str[c]).w;
        word = 0;
        start = false;
      } else if (str[c] !== TOK_COLOR_FLIP) {
        const charWidth = font.getCharSize(str[c]).w;
        width += charWidth;
        word += charWidth;

        if (this._wrap && width >= this.getWidth() && (!start || this._lang.getTextWrapping() === WRAP_LETTERS)) {
          let indentLocation = c;
          if (this._lang.getTextWrapping() === WRAP_WORDS || isSpace(str[c])) {
            width -= word;
            indentLocation = space;
            if (isSpace(str[space])) {
              width -= font.getCharSize(str[space]).w;
              str[space] = "\n".codePointAt(0)!;
            } else {
              str.splice(space + 1, 0, "\n".codePointAt(0)!);
              indentLocation++;
            }
          } else if (this._lang.getTextWrapping() === WRAP_LETTERS) {
            str.splice(c, 0, "\n".codePointAt(0)!);
            width -= charWidth;
          }
          if (textIndentation > 0) {
            str.splice(indentLocation + 1, 0, ...Array(textIndentation).fill("\t".codePointAt(0)!));
            indentLocation += textIndentation;
          }
          if (this._indent) {
            str.splice(indentLocation + 1, 0, "\t".codePointAt(0)!);
            width += font.getCharSize("\t".codePointAt(0)!).w;
          }
          this._lineWidth.push(width);
          this._lineHeight.push(font.getCharSize("\n".codePointAt(0)!).h);
          if (this._lang.getTextWrapping() === WRAP_WORDS) {
            width = word;
          } else if (this._lang.getTextWrapping() === WRAP_LETTERS) {
            width = 0;
          }
          start = true;
        }
      }
    }
    this.invalidate();
  }

  private getLineX(line: number): number {
    if (this._lang?.getTextDirection() === DIRECTION_RTL) {
      switch (this._align) {
        case ALIGN_LEFT:
          return this.getWidth() - 1;
        case ALIGN_CENTER:
          return this.getWidth() - Math.ceil((this.getWidth() + (this._font?.getSpacing() || 0) - this._lineWidth[line]) / 2.0);
        case ALIGN_RIGHT:
          return this._lineWidth[line];
        default:
          return this.getWidth() - 1;
      }
    }
    switch (this._align) {
      case ALIGN_CENTER:
        return Math.ceil((this.getWidth() + (this._font?.getSpacing() || 0) - this._lineWidth[line]) / 2.0);
      case ALIGN_RIGHT:
        return this.getWidth() - 1 - this._lineWidth[line];
      case ALIGN_LEFT:
      default:
        return 0;
    }
  }
}
