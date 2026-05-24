import { InteractiveSurface } from "../Engine/InteractiveSurface.ts";
import { Surface } from "../Engine/Surface.ts";
import type { Action } from "../Engine/Action.ts";
import type { State } from "../Engine/State.ts";
import type { PaletteColor } from "../types.ts";
import { SDL_BUTTON_LEFT } from "../types.ts";

enum InversionType {
  INVERT_NONE,
  INVERT_CLICK,
  INVERT_TOGGLE
}

/**
 * Regular image that works like a button.
 */
export class BattlescapeButton extends InteractiveSurface {
  private _color = 0;
  private _group: { value: BattlescapeButton | null } | null = null;
  private _inverted = false;
  private _toggleMode = InversionType.INVERT_NONE;
  private _altSurface: Surface | null = null;

  override setColor(color: number): void {
    this._color = color;
  }

  getColor(): number {
    return this._color;
  }

  setGroup(group: { value: BattlescapeButton | null } | null): void {
    this._group = group;
    if (this._group && this._group.value === this) {
      this._inverted = true;
    }
  }

  override mousePress(action: Action, state: State): void {
    const button = action.getDetails().button?.button;
    if (this._group) {
      if (button === SDL_BUTTON_LEFT) {
        this._group.value?.toggle(false);
        this._group.value = this;
        this._inverted = true;
      }
    } else if ((this._tftdMode || this._toggleMode === InversionType.INVERT_CLICK) &&
      !this._inverted &&
      this.isButtonPressed() &&
      this.isButtonHandled(button ?? 0)) {
      this._inverted = true;
    }
    super.mousePress(action, state);
  }

  override mouseRelease(action: Action, state: State): void {
    const button = action.getDetails().button?.button;
    if (this._inverted && this.isButtonHandled(button ?? 0)) {
      this._inverted = false;
    }
    super.mouseRelease(action, state);
  }

  toggle(press: boolean): void {
    if (this._tftdMode || this._toggleMode === InversionType.INVERT_TOGGLE || this._inverted) {
      this._inverted = press;
      this.invalidate();
    }
  }

  allowToggleInversion(): void {
    this._toggleMode = InversionType.INVERT_TOGGLE;
  }

  allowClickInversion(): void {
    this._toggleMode = InversionType.INVERT_CLICK;
  }

  initSurfaces(): void {
    this._altSurface = new Surface(this.getWidth(), this.getHeight(), this.getX(), this.getY());
    this._altSurface.setPalette(this.getPalette());
    if (this._tftdMode) {
      const colorFrom = [1, 2, 3, 4, 7, 8, 31, 47, 153, 156, 159];
      const colorTo = [2, 3, 4, 5, 11, 10, 2, 2, 96, 9, 97];
      const pos = { x: 0, y: 0 };
      for (let y = 0; y < this.getHeight(); ++y) {
        for (let x = 0; x < this.getWidth(); ++x) {
          let pixel = this.getPixel(x, y);
          const index = colorFrom.indexOf(pixel);
          if (index !== -1) {
            pixel = colorTo[index];
          }
          this._altSurface.setPixelIterative(pos, pixel);
        }
      }
    } else {
      const pos = { x: 0, y: 0 };
      for (let y = 0; y < this.getHeight(); ++y) {
        for (let x = 0; x < this.getWidth(); ++x) {
          const pixel = this.getPixel(x, y);
          this._altSurface.setPixelIterative(pos, pixel > 0 ? pixel + 2 * (this._color + 3 - pixel) : 0);
        }
      }
    }
  }

  override setPalette(colors: PaletteColor[], firstcolor = 0, ncolors = colors.length): void {
    super.setPalette(colors, firstcolor, ncolors);
    this._altSurface?.setPalette(colors, firstcolor, ncolors);
  }

  override blit(surface: Surface): void {
    if (this._inverted && this._altSurface) {
      this._altSurface.blit(surface);
    } else {
      super.blit(surface);
    }
  }

  override setX(x: number): void {
    super.setX(x);
    this._altSurface?.setX(x);
  }

  override setY(y: number): void {
    super.setY(y);
    this._altSurface?.setY(y);
  }
}
