import { InteractiveSurface } from "../Engine/InteractiveSurface.ts";
import { Surface } from "../Engine/Surface.ts";
import type { Action } from "../Engine/Action.ts";
import type { State } from "../Engine/State.ts";
import type { TextList } from "./TextList.ts";
import { SDL_BUTTON_LEFT, SDL_BUTTON_WHEELDOWN, SDL_BUTTON_WHEELUP, SDL_MOUSEBUTTONDOWN, SDL_MOUSEMOTION } from "../types.ts";

export class ScrollBar extends InteractiveSurface {
  private _list: TextList | null = null;
  private _color = 0;
  private _pressed = false;
  private _contrast = false;
  private _track: Surface;
  private _thumb: Surface;
  private _thumbRect = { x: 0, y: 0, w: 0, h: 0 };
  private _offset = 0;
  private _bg: Surface | null = null;

  constructor(width: number, height: number, x = 0, y = 0) {
    super(width, height, x, y);
    this._track = new Surface(width - 2, height, x + 1, y);
    this._thumb = new Surface(width, height, x, y);
  }

  override setX(x: number): void {
    super.setX(x);
    this._track.setX(x + 1);
    this._thumb.setX(x);
  }

  override setY(y: number): void {
    super.setY(y);
    this._track.setY(y);
    this._thumb.setY(y);
  }

  override setHeight(height: number): void {
    super.setHeight(height);
    this._track.setHeight(height);
    this._thumb.setHeight(height);
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

  setTextList(list: TextList | null): void {
    this._list = list;
  }

  setBackground(bg: Surface | null): void {
    this._bg = bg;
  }

  override setPalette(colors: ReturnType<typeof this.getPalette>, firstcolor = 0, ncolors = 256): void {
    super.setPalette(colors, firstcolor, ncolors);
    this._track.setPalette(colors, firstcolor, ncolors);
    this._thumb.setPalette(colors, firstcolor, ncolors);
  }

  override blit(surface: Surface): void {
    super.blit(surface);
    if (this.getVisible()) {
      this._track.blit(surface);
      this._thumb.blit(surface);
      this.invalidate();
    }
  }

  override handle(action: Action, state: State): void {
    super.handle(action, state);
    if (!this._list || !this._pressed || (action.getDetails().type !== SDL_MOUSEMOTION && action.getDetails().type !== SDL_MOUSEBUTTONDOWN)) {
      return;
    }
    const cursorY = action.getAbsoluteYMouse() - this.getY();
    const y = Math.max(0, Math.min(this.getHeight() - this._thumbRect.h + 1, cursorY + this._offset));
    const scale = this._list.getRows() / Math.max(1, this.getHeight());
    this._list.scrollTo(Math.round(y * scale));
  }

  override mousePress(action: Action, state: State): void {
    super.mousePress(action, state);
    const button = action.getDetails().button?.button;
    if (!this._list) return;
    if (button === SDL_BUTTON_LEFT) {
      const cursorY = action.getAbsoluteYMouse() - this.getY();
      this._offset = cursorY >= this._thumbRect.y && cursorY < this._thumbRect.y + this._thumbRect.h
        ? this._thumbRect.y - cursorY
        : -Math.trunc(this._thumbRect.h / 2);
      this._pressed = true;
    } else if (button === SDL_BUTTON_WHEELUP) {
      this._list.scrollUp(false, true);
    } else if (button === SDL_BUTTON_WHEELDOWN) {
      this._list.scrollDown(false, true);
    }
  }

  override mouseRelease(action: Action, state: State): void {
    super.mouseRelease(action, state);
    if (action.getDetails().button?.button === SDL_BUTTON_LEFT) {
      this._pressed = false;
      this._offset = 0;
    }
  }

  override draw(): void {
    super.draw();
    this.drawTrack();
    this.drawThumb();
  }

  private drawTrack(): void {
    this._track.clear();
    if (this._bg) {
      this._track.copy(this._bg);
      this._track.offsetBlock(this._contrast ? -3 : -5);
    }
  }

  private drawThumb(): void {
    if (!this._list) return;
    const rows = Math.max(1, this._list.getRows());
    const scale = this.getHeight() / rows;
    this._thumbRect = {
      x: 0,
      y: Math.floor(this._list.getScroll() * scale),
      w: this._thumb.getWidth(),
      h: Math.max(4, Math.ceil(this._list.getVisibleRows() * scale))
    };
    this._thumb.clear();
    let square = { ...this._thumbRect };
    let color = this._color + 2;
    square.w--;
    square.h--;
    this._thumb.drawRect(square, color);
    square.x++;
    square.y++;
    color = this._color + 5;
    this._thumb.drawRect(square, color);
    square.w--;
    square.h--;
    color = this._color + 4;
    this._thumb.drawRect(square, color);
    this._thumb.setPixel(this._thumbRect.x, this._thumbRect.y, this._color + 1);
    this._thumb.setPixel(this._thumbRect.x, this._thumbRect.y + this._thumbRect.h - 1, this._color + 4);
    this._thumb.setPixel(this._thumbRect.x + this._thumbRect.w - 1, this._thumbRect.y, this._color + 4);
  }
}
