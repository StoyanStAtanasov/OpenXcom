import { Surface } from "../Engine/Surface.ts";
import { Timer } from "../Engine/Timer.ts";
import type { PaletteColor } from "../types.ts";
import { ALIGN_CENTER, ALIGN_MIDDLE, Text } from "../Interface/Text.ts";

/**
 * Coloured box with text inside that fades out after it is displayed.
 */
export class WarningMessage extends Surface {
  private _text: Text;
  private _timer: Timer;
  private _color = 0;
  private _fade = 0;

  constructor(width: number, height: number, x = 0, y = 0) {
    super(width, height, x, y);
    this._text = new Text(width, height, 0, 0);
    this._text.setHighContrast(true);
    this._text.setAlign(ALIGN_CENTER);
    this._text.setVerticalAlign(ALIGN_MIDDLE);
    this._text.setWordWrap(true);

    this._timer = new Timer(50);
    this._timer.onSurfaceTimer(this.fade.bind(this));

    this.setVisible(false);
  }

  override setColor(color: number): void {
    this._color = color;
  }

  setTextColor(color: number): void {
    this._text.setColor(color);
  }

  override initText(big?: unknown, small?: unknown, lang?: unknown): void {
    this._text.initText(big, small, lang);
  }

  override setPalette(colors: PaletteColor[], firstcolor = 0, ncolors = 256): void {
    super.setPalette(colors, firstcolor, ncolors);
    this._text.setPalette(colors, firstcolor, ncolors);
  }

  showMessage(msg: string): void {
    this._text.setText(msg);
    this._fade = 0;
    this._redraw = true;
    this.setVisible(true);
    this._timer.start();
  }

  override think(): void {
    this._timer.think(null, this);
  }

  fade(): void {
    this._fade++;
    this._redraw = true;
    if (this._fade === 24) {
      this.setVisible(false);
      this._timer.stop();
    }
  }

  override draw(): void {
    super.draw();
    this.drawRect(0, 0, this.getWidth(), this.getHeight(), this._color + (this._fade > 12 ? 12 : this._fade));
    this._text.blit(this);
  }
}
