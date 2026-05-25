import { Timer } from "../Engine/Timer.ts";
import type { Action } from "../Engine/Action.ts";
import type { State } from "../Engine/State.ts";
import { SDL_BUTTON_LEFT, SDL_BUTTON_RIGHT, SDL_BUTTON_WHEELDOWN, SDL_BUTTON_WHEELUP } from "../types.ts";
import type { TextList } from "./TextList.ts";
import { ImageButton } from "./ImageButton.ts";

export const ARROW_NONE = 0;
export const ARROW_BIG_UP = 1;
export const ARROW_BIG_DOWN = 2;
export const ARROW_SMALL_UP = 3;
export const ARROW_SMALL_DOWN = 4;
export const ARROW_SMALL_LEFT = 5;
export const ARROW_SMALL_RIGHT = 6;
export type ArrowShape = typeof ARROW_NONE | typeof ARROW_BIG_UP | typeof ARROW_BIG_DOWN | typeof ARROW_SMALL_UP | typeof ARROW_SMALL_DOWN | typeof ARROW_SMALL_LEFT | typeof ARROW_SMALL_RIGHT;

export class ArrowButton extends ImageButton {
  private _list: TextList | null = null;
  private _timer: Timer;

  constructor(private _shape: ArrowShape, width: number, height: number, x = 0, y = 0) {
    super(width, height, x, y);
    this._timer = new Timer(50);
    this._timer.onSurfaceTimer(this.scroll.bind(this));
  }

  protected override isButtonHandled(button = 0): boolean {
    if (this._list) {
      return button === SDL_BUTTON_LEFT || button === SDL_BUTTON_RIGHT || button === SDL_BUTTON_WHEELUP || button === SDL_BUTTON_WHEELDOWN;
    }
    return super.isButtonHandled(button);
  }

  override setColor(color: number): void {
    super.setColor(color);
    this.invalidate();
  }

  setShape(shape: ArrowShape): void {
    this._shape = shape;
    this.invalidate();
  }

  setTextList(list: TextList | null): void {
    this._list = list;
  }

  override think(): void {
    this._timer.think(null, this);
  }

  scroll(): void {
    if (this._shape === ARROW_BIG_UP) {
      this._list?.scrollUp(false);
    } else if (this._shape === ARROW_BIG_DOWN) {
      this._list?.scrollDown(false);
    }
  }

  override draw(): void {
    super.draw();
    let square = { x: 0, y: 0, w: this.getWidth() - 1, h: this.getHeight() - 1 };
    let color = this._color + 2;
    this.drawRect(square, color);
    square.x++;
    square.y++;
    color = this._color + 5;
    this.drawRect(square, color);
    square.w--;
    square.h--;
    color = this._color + 4;
    this.drawRect(square, color);
    this.setPixel(0, 0, this._color + 1);
    this.setPixel(0, this.getHeight() - 1, this._color + 4);
    this.setPixel(this.getWidth() - 1, 0, this._color + 4);

    color = this._color + 1;
    switch (this._shape) {
      case ARROW_BIG_UP:
        this.drawRect(5, 8, 3, 3, color);
        this.drawTriangleRows(2, 7, 9, -1, color);
        break;
      case ARROW_BIG_DOWN:
        this.drawRect(5, 3, 3, 3, color);
        this.drawTriangleRows(2, 6, 9, 1, color);
        break;
      case ARROW_SMALL_UP:
        this.drawTriangleRows(1, 5, 9, -1, color + 2);
        this.drawTriangleRows(2, 5, 7, -1, color);
        break;
      case ARROW_SMALL_DOWN:
        this.drawTriangleRows(1, 2, 9, 1, color + 2);
        this.drawTriangleRows(2, 2, 7, 1, color);
        break;
      case ARROW_SMALL_LEFT:
        this.drawLine(7, 1, 2, 4, color + 2);
        this.drawLine(2, 4, 7, 7, color + 2);
        this.drawLine(6, 2, 3, 4, color);
        this.drawLine(3, 4, 6, 6, color);
        break;
      case ARROW_SMALL_RIGHT:
        this.drawLine(3, 1, 8, 4, color + 2);
        this.drawLine(8, 4, 3, 7, color + 2);
        this.drawLine(4, 2, 7, 4, color);
        this.drawLine(7, 4, 4, 6, color);
        break;
      default:
        break;
    }
  }

  override mousePress(action: Action, state: State): void {
    super.mousePress(action, state);
    const button = action.getDetails().button?.button;
    if (!this._list) {
      return;
    }
    if (button === SDL_BUTTON_LEFT) {
      this._timer.start();
    } else if (button === SDL_BUTTON_WHEELUP) {
      this._list.scrollUp(false, true);
    } else if (button === SDL_BUTTON_WHEELDOWN) {
      this._list.scrollDown(false, true);
    }
  }

  override mouseRelease(action: Action, state: State): void {
    super.mouseRelease(action, state);
    if (this._list && action.getDetails().button?.button === SDL_BUTTON_LEFT) {
      this._timer.stop();
    }
  }

  override mouseClick(action: Action, state: State): void {
    super.mouseClick(action, state);
    if (!this._list || action.getDetails().button?.button !== SDL_BUTTON_RIGHT) {
      return;
    }
    if (this._shape === ARROW_BIG_UP) {
      this._list.scrollUp(true);
    } else if (this._shape === ARROW_BIG_DOWN) {
      this._list.scrollDown(true);
    }
  }

  private drawTriangleRows(x: number, y: number, w: number, dy: number, color: number): void {
    for (let width = w, sx = x, sy = y; width > 1; width -= 2, sx++, sy += dy) {
      this.drawRect(sx, sy, width, 1, color);
    }
    this.drawRect(x + Math.trunc(w / 2), y + Math.trunc(w / 2) * dy, 1, 1, color);
  }
}
