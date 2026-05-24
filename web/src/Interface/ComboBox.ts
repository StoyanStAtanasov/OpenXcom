import { InteractiveSurface } from "../Engine/InteractiveSurface.ts";
import type { Action } from "../Engine/Action.ts";
import type { Font } from "../Engine/Font.ts";
import type { Language } from "../Engine/Language.ts";
import type { State } from "../Engine/State.ts";
import type { PaletteColor } from "../types.ts";
import { SDL_BUTTON_LEFT, SDL_BUTTON_WHEELDOWN, SDL_BUTTON_WHEELUP } from "../types.ts";
import { TextButton } from "./TextButton.ts";

/**
 * Text button with a list dropdown when pressed.
 *
 * The first browser translation preserves the original public API used by menu
 * states. Full popup list behavior is still pending, so clicks cycle options.
 */
export class ComboBox extends InteractiveSurface {
  private _button: TextButton;
  private _options: string[] = [];
  private _labels: string[] = [];
  private _sel = 0;
  private _change: ((action: Action) => void) | null = null;
  private _color = 0;
  private _lang: Language | null = null;

  constructor(private _state: State, width: number, height: number, x = 0, y = 0, private _popupAboveButton = false) {
    super(width, height, x, y);
    this._button = new TextButton(width, height, 0, 0);
    this._button.setComboBox({ toggle: () => this.toggle() });
  }

  override initText(big?: unknown, small?: unknown, lang?: unknown): void {
    this._lang = (lang as Language | null) || this._lang;
    this._button.initText(big as Font | undefined, small as Font | undefined, this._lang || undefined);
    this.refreshText();
  }

  override setPalette(colors: PaletteColor[], firstcolor = 0, ncolors = 256): void {
    super.setPalette(colors, firstcolor, ncolors);
    this._button.setPalette(colors, firstcolor, ncolors);
  }

  override setColor(color: number): void {
    this._color = color;
    this._button.setColor(color);
    this.invalidate();
  }

  getColor(): number {
    return this._color;
  }

  override setHighContrast(contrast: boolean): void {
    this._button.setHighContrast(contrast);
    this.invalidate();
  }

  setArrowColor(color: number): void {
    this._button.setSecondaryColor(color);
  }

  getSelected(): number {
    return this._sel;
  }

  getHoveredListIdx(): number {
    return this._sel;
  }

  setText(text: string): void {
    this._button.setText(text);
    this.invalidate();
  }

  setSelected(sel: number): void {
    if (this._options.length === 0) {
      this._sel = 0;
    } else {
      this._sel = Math.max(0, Math.min(this._options.length - 1, Math.trunc(sel)));
    }
    this.refreshText();
  }

  setOptions(options: string[], translate = false): void {
    this._options = [...options];
    this._labels = translate ? this._options.map(option => String(this._state.tr(option))) : [...this._options];
    if (this._sel >= this._options.length) {
      this._sel = Math.max(0, this._options.length - 1);
    }
    this.refreshText();
  }

  override draw(): void {
    super.draw();
    this._button.draw();
    this._button.blit(this);
    const arrowX = this.getWidth() - 9;
    const midY = Math.trunc(this.getHeight() / 2);
    const color = this._color + 5;
    if (this._popupAboveButton) {
      this.drawLine(arrowX, midY + 2, arrowX + 4, midY - 2, color);
      this.drawLine(arrowX + 4, midY - 2, arrowX + 8, midY + 2, color);
    } else {
      this.drawLine(arrowX, midY - 2, arrowX + 4, midY + 2, color);
      this.drawLine(arrowX + 4, midY + 2, arrowX + 8, midY - 2, color);
    }
  }

  toggle(first = false): void {
    if (first || this._options.length <= 1) {
      return;
    }
    this.setSelected((this._sel + 1) % this._options.length);
  }

  onChange(handler: ((action: Action) => void) | null): void {
    this._change = handler;
  }

  onListMouseIn(_handler: ((action: Action) => void) | null): void {}
  onListMouseOut(_handler: ((action: Action) => void) | null): void {}
  onListMouseOver(_handler: ((action: Action) => void) | null): void {}

  override mouseClick(action: Action, state: State): void {
    const button = action.getDetails().button?.button;
    if (button === SDL_BUTTON_LEFT) {
      const old = this._sel;
      this.toggle();
      if (old !== this._sel) {
        this._change?.(action);
      }
    }
    super.mouseClick(action, state);
  }

  override mousePress(action: Action, state: State): void {
    const button = action.getDetails().button?.button;
    if (button === SDL_BUTTON_WHEELUP || button === SDL_BUTTON_WHEELDOWN) {
      const old = this._sel;
      const dir = button === SDL_BUTTON_WHEELUP ? -1 : 1;
      this.setSelected((this._sel + dir + this._options.length) % Math.max(1, this._options.length));
      if (old !== this._sel) {
        this._change?.(action);
      }
    }
    super.mousePress(action, state);
  }

  override setWidth(width: number): void {
    super.setWidth(width);
    this._button.setWidth(width);
  }

  override setHeight(height: number): void {
    super.setHeight(height);
    this._button.setHeight(height);
  }

  private refreshText(): void {
    this._button.setText(this._labels[this._sel] || "");
    this.invalidate();
  }
}
