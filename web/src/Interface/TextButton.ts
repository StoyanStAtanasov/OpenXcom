import { InteractiveSurface } from "../Engine/InteractiveSurface.ts";
import { Sound } from "../Engine/Sound.ts";
import { Text, ALIGN_CENTER, ALIGN_MIDDLE } from "./Text.ts";
import type { Action } from "../Engine/Action.ts";
import type { State } from "../Engine/State.ts";
import { SDL_BUTTON_LEFT, SDL_BUTTON_WHEELDOWN, SDL_BUTTON_WHEELUP } from "../types.ts";

export class TextButton extends InteractiveSurface {
  static soundPress: { play: (channel?: number) => void } | null = null;

  private _color = 0;
  private _text: Text;
  private _group: { value: TextButton | null } | null = null;
  private _contrast = false;
  private _geoscapeButton = false;
  private _comboBox: { toggle: () => void } | null = null;

  constructor(width: number, height: number, x = 0, y = 0) {
    super(width, height, x, y);
    this._text = new Text(width, height, 0, 0);
    this._text.setSmall();
    this._text.setAlign(ALIGN_CENTER);
    this._text.setVerticalAlign(ALIGN_MIDDLE);
    this._text.setWordWrap(true);
  }

  protected override isButtonHandled(button = 0): boolean {
    if (this._comboBox) {
      return button === SDL_BUTTON_LEFT;
    }
    return super.isButtonHandled(button);
  }

  override setColor(color: number): void {
    this._color = color;
    this._text.setColor(color);
    this.invalidate();
  }

  getColor(): number {
    return this._color;
  }

  setTextColor(color: number): void {
    this._text.setColor(color);
    this.invalidate();
  }

  override setSecondaryColor(color: number): void {
    this.setTextColor(color);
  }

  setBig(): void {
    this._text.setBig();
    this.invalidate();
  }

  setSmall(): void {
    this._text.setSmall();
    this.invalidate();
  }

  getFont(): unknown {
    return this._text.getFont();
  }

  override initText(...args: unknown[]): void {
    this._text.initText(...args);
    this.invalidate();
  }

  override setHighContrast(contrast: boolean): void {
    this._contrast = contrast;
    this._text.setHighContrast(contrast);
    this.invalidate();
  }

  setText(text: string): void {
    this._text.setText(text);
    this.invalidate();
  }

  getText(): string {
    return this._text.getText();
  }

  setGroup(group: { value: TextButton | null } | null): void {
    this._group = group;
    this.invalidate();
  }

  override setPalette(colors: ReturnType<typeof this.getPalette>, firstcolor = 0, ncolors = 256): void {
    super.setPalette(colors, firstcolor, ncolors);
    this._text.setPalette(colors, firstcolor, ncolors);
  }

  override draw(): void {
    super.draw();
    let mul = 1;
    if (this._contrast) {
      mul = 2;
    }
    let color = this._color + 1 * mul;
    const square = { x: 0, y: 0, w: this.getWidth(), h: this.getHeight() };
    for (let i = 0; i < 5; ++i) {
      this.drawRect(square, color);
      if (i % 2 === 0) {
        square.x++;
        square.y++;
      }
      square.w--;
      square.h--;
      switch (i) {
        case 0:
          color = this._color + 5 * mul;
          this.setPixel(square.w, 0, color);
          break;
        case 1:
          color = this._color + 2 * mul;
          break;
        case 2:
          color = this._color + 4 * mul;
          this.setPixel(square.w + 1, 1, color);
          break;
        case 3:
          color = this._color + 3 * mul;
          break;
        case 4:
          if (this._geoscapeButton) {
            this.setPixel(0, 0, this._color);
            this.setPixel(1, 1, this._color);
          }
          break;
      }
    }
    const press = this._group ? this._group.value === this : this.isButtonPressed();
    if (press) {
      this.invert(this._color + (this._geoscapeButton ? 2 : 3) * mul);
    }
    this._text.setInvert(press);
    this._text.blit(this);
  }

  override mousePress(action: Action, state: State): void {
    const button = action.getDetails().button?.button;
    if (button === SDL_BUTTON_LEFT && this._group) {
      const old = this._group.value;
      this._group.value = this;
      old?.draw();
      this.draw();
    }
    if (button != null && this.isButtonHandled(button)) {
      if (TextButton.soundPress && !this._group && button !== SDL_BUTTON_WHEELUP && button !== SDL_BUTTON_WHEELDOWN) {
        TextButton.soundPress.play(Sound.groupAvailable(0));
      }
      this._comboBox?.toggle();
      this.draw();
    }
    super.mousePress(action, state);
  }

  override mouseRelease(action: Action, state: State): void {
    const button = action.getDetails().button?.button;
    if (button != null && this.isButtonHandled(button)) {
      this.draw();
    }
    super.mouseRelease(action, state);
  }

  setComboBox(comboBox: { toggle: () => void } | null): void {
    this._comboBox = comboBox;
    this._text.setX(comboBox ? -6 : 0);
  }

  override setWidth(width: number): void {
    super.setWidth(width);
    this._text.setWidth(width);
  }

  override setHeight(height: number): void {
    super.setHeight(height);
    this._text.setHeight(height);
  }

  setGeoscapeButton(geo: boolean): void {
    this._geoscapeButton = geo;
  }
}
