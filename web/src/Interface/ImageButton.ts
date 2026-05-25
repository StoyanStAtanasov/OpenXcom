import { InteractiveSurface } from "../Engine/InteractiveSurface.ts";
import type { Action } from "../Engine/Action.ts";
import type { State } from "../Engine/State.ts";
import { SDL_BUTTON_LEFT } from "../types.ts";

export class ImageButton extends InteractiveSurface {
  protected _color = 0;
  protected _group: { value: ImageButton | null } | null = null;
  protected _inverted = false;

  constructor(width: number, height: number, x = 0, y = 0) {
    super(width, height, x, y);
  }

  override setColor(color: number): void {
    this._color = color;
    this.invalidate();
  }

  getColor(): number {
    return this._color;
  }

  setGroup(group: { value: ImageButton | null } | null): void {
    this._group = group;
    if (this._group && this._group.value === this) {
      this.invert(this._color + 3);
    }
  }

  override mousePress(action: Action, state: State): void {
    const button = action.getDetails().button?.button || 0;
    if (this._group) {
      if (button === SDL_BUTTON_LEFT) {
        this._group.value?.invert(this._group.value.getColor() + 3);
        this._group.value = this;
        this.invert(this._color + 3);
      }
    } else if (!this._inverted && this.isButtonPressed() && this.isButtonHandled(button)) {
      this._inverted = true;
      this.invert(this._color + 3);
    }
    super.mousePress(action, state);
  }

  override mouseRelease(action: Action, state: State): void {
    const button = action.getDetails().button?.button || 0;
    if (this._inverted && this.isButtonHandled(button)) {
      this._inverted = false;
      this.invert(this._color + 3);
    }
    super.mouseRelease(action, state);
  }

  toggle(press: boolean): void {
    if (this._inverted !== press) {
      this._inverted = !this._inverted;
      this.invert(this._color + 3);
    }
  }
}
