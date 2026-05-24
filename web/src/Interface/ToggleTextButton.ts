import { InteractiveSurface } from "../Engine/InteractiveSurface.ts";
import type { Action } from "../Engine/Action.ts";
import type { State } from "../Engine/State.ts";
import { SDL_BUTTON_LEFT, SDL_BUTTON_RIGHT } from "../types.ts";
import { TextButton } from "./TextButton.ts";

export class ToggleTextButton extends TextButton {
  private _isPressed = false;
  private _originalColor = -1;
  private _invertedColor = -1;
  private _fakeGroup: { value: TextButton | null } = { value: null };

  constructor(width: number, height: number, x = 0, y = 0) {
    super(width, height, x, y);
    this.setGroup(this._fakeGroup);
  }

  override mousePress(action: Action, state: State): void {
    const button = action.getDetails().button?.button;
    if (button === SDL_BUTTON_LEFT || button === SDL_BUTTON_RIGHT) {
      this._isPressed = !this._isPressed;
      this._fakeGroup.value = this._isPressed ? this : null;
      if (this._isPressed && this._invertedColor > -1) {
        TextButton.prototype.setColor.call(this, this._invertedColor);
      } else {
        TextButton.prototype.setColor.call(this, this._originalColor);
      }
    }
    InteractiveSurface.prototype.mousePress.call(this, action, state);
    this.draw();
  }

  setPressed(pressed: boolean): void {
    this._isPressed = pressed;
    this._fakeGroup.value = this._isPressed ? this : null;
    if (this._isPressed && this._invertedColor > -1) {
      TextButton.prototype.setColor.call(this, this._invertedColor);
    } else {
      TextButton.prototype.setColor.call(this, this._originalColor);
    }
    this.invalidate();
  }

  getPressed(): boolean {
    return this._isPressed;
  }

  override setColor(color: number): void {
    this._originalColor = color;
    super.setColor(color);
  }

  setInvertColor(color: number): void {
    this._invertedColor = color;
    this._fakeGroup.value = null;
    this.invalidate();
  }

  override draw(): void {
    if (this._invertedColor > -1) {
      this._fakeGroup.value = null;
    }
    super.draw();
    if (this._invertedColor > -1 && this._isPressed) {
      this.invert(this._invertedColor + 4);
    }
  }
}
