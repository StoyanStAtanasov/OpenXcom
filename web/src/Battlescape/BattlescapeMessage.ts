import { Palette } from "../Engine/Palette.ts";
import { Surface } from "../Engine/Surface.ts";
import type { PaletteColor } from "../types.ts";
import { ALIGN_CENTER, ALIGN_MIDDLE, Text } from "../Interface/Text.ts";
import { POPUP_NONE, Window } from "../Interface/Window.ts";

/**
 * Generic window used to display messages over the Battlescape map.
 */
export class BattlescapeMessage extends Surface {
  private _window: Window;
  private _text: Text;

  constructor(width: number, height: number, x = 0, y = 0) {
    super(width, height, x, y);
    this._window = new Window(null, width, height, x, y, POPUP_NONE);
    this._window.setColor(Palette.blockOffset(0) - 1);
    this._window.setHighContrast(true);

    this._text = new Text(width, height, x, y);
    this._text.setColor(Palette.blockOffset(0) - 1);
    this._text.setAlign(ALIGN_CENTER);
    this._text.setVerticalAlign(ALIGN_MIDDLE);
    this._text.setHighContrast(true);
  }

  override setX(x: number): void {
    super.setX(x);
    this._window.setX(x);
    this._text.setX(x);
  }

  override setY(y: number): void {
    super.setY(y);
    this._window.setY(y);
    this._text.setY(y);
  }

  setBackground(background: Surface): void {
    this._window.setBackground(background);
  }

  setText(message: string): void {
    this._text.setText(message);
  }

  override initText(big?: unknown, small?: unknown, lang?: unknown): void {
    this._text.initText(big, small, lang);
    this._text.setBig();
  }

  override setPalette(colors: PaletteColor[], firstcolor = 0, ncolors = 256): void {
    super.setPalette(colors, firstcolor, ncolors);
    this._window.setPalette(colors, firstcolor, ncolors);
    this._text.setPalette(colors, firstcolor, ncolors);
  }

  override blit(surface: Surface): void {
    super.blit(surface);
    this._window.blit(surface);
    this._text.blit(surface);
  }

  override setHeight(height: number): void {
    super.setHeight(height);
    this._window.setHeight(height);
    this._text.setHeight(height);
  }

  setTextColor(color: number): void {
    this._text.setColor(color);
  }
}
