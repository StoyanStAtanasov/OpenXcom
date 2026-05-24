import { Surface } from "../Engine/Surface.ts";
import { Timer } from "../Engine/Timer.ts";
import type { State } from "../Engine/State.ts";

export const POPUP_NONE = "POPUP_NONE";
export const POPUP_HORIZONTAL = "POPUP_HORIZONTAL";
export const POPUP_VERTICAL = "POPUP_VERTICAL";
export const POPUP_BOTH = "POPUP_BOTH";
export type WindowPopup = typeof POPUP_NONE | typeof POPUP_HORIZONTAL | typeof POPUP_VERTICAL | typeof POPUP_BOTH;

export class Window extends Surface {
  private static POPUP_SPEED = 0.05;
  static soundPopup: Array<{ play: () => void } | null> = [null, null, null];

  private _dx: number;
  private _dy: number;
  private _bg: Surface | null = null;
  private _color = 1;
  private _popupStep = 0.0;
  private _timer: Timer;
  private _contrast = false;
  private _screen = false;
  private _thinBorder = false;

  constructor(private _state: State | null, width: number, height: number, x = 0, y = 0, private _popup: WindowPopup = POPUP_NONE) {
    super(width, height, x, y);
    this._dx = -x;
    this._dy = -y;
    this._timer = new Timer(10);
    this._timer.onSurfaceTimer(this.popup.bind(this));
    if (this._popup === POPUP_NONE) {
      this._popupStep = 1.0;
    } else {
      this.setHidden(true);
      this._timer.start();
      if (this._state) {
        this._screen = this._state.isScreen();
        if (this._screen) {
          this._state.toggleScreen();
        }
      }
    }
  }

  setBackground(bg: Surface): void {
    this._bg = bg;
    this.invalidate();
  }

  override setColor(color: number): void {
    this._color = color;
    this.invalidate();
  }

  getColor(): number {
    return this._color;
  }

  override setHighContrast(contrast: boolean): void {
    this._contrast = contrast;
    this.invalidate();
  }

  override think(): void {
    if (this._hidden && this._popupStep < 1.0) {
      this._state?.hideAll();
      this.setHidden(false);
    }
    this._timer.think(null, this);
  }

  popup(): void {
    if (this._popupStep < 1.0) {
      this._popupStep += Window.POPUP_SPEED;
    } else {
      if (this._screen) {
        this._state?.toggleScreen();
      }
      this._state?.showAll();
      this._popupStep = 1.0;
      this._timer.stop();
    }
    this.invalidate();
  }

  override draw(): void {
    super.draw();
    const square = { x: 0, y: 0, w: this.getWidth(), h: this.getHeight() };
    if (this._popup === POPUP_HORIZONTAL || this._popup === POPUP_BOTH) {
      square.x = Math.trunc((this.getWidth() - this.getWidth() * this._popupStep) / 2);
      square.w = Math.trunc(this.getWidth() * this._popupStep);
    }
    if (this._popup === POPUP_VERTICAL || this._popup === POPUP_BOTH) {
      square.y = Math.trunc((this.getHeight() - this.getHeight() * this._popupStep) / 2);
      square.h = Math.trunc(this.getHeight() * this._popupStep);
    }
    const mul = this._contrast ? 2 : 1;
    let color = this._color + (this._thinBorder ? 1 : 3) * mul;
    for (let i = 0; i < 5; ++i) {
      this.drawRect(square, color);
      if (this._thinBorder) {
        if (i % 2 === 0) {
          square.x++;
          square.y++;
        }
        square.w--;
        square.h--;
        color = this._color + [5, 2, 4, 3, 3][i] * mul;
      } else {
        if (i < 2) {
          color -= 1 * mul;
        } else {
          color += 1 * mul;
        }
        square.x++;
        square.y++;
        square.w = Math.max(1, square.w - 2);
        square.h = Math.max(1, square.h - 2);
      }
    }
    if (this._bg) {
      this._bg.getCrop().x = square.x - this._dx;
      this._bg.getCrop().y = square.y - this._dy;
      this._bg.getCrop().w = square.w;
      this._bg.getCrop().h = square.h;
      this._bg.setX(square.x);
      this._bg.setY(square.y);
      this._bg.blit(this);
    }
  }

  setDX(dx: number): void {
    this._dx = dx;
  }

  setDY(dy: number): void {
    this._dy = dy;
  }

  setThinBorder(): void {
    this._thinBorder = true;
  }
}
