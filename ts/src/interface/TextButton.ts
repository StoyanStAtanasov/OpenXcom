import type { Renderer } from "../engine/Renderer";
import type { StateTransition } from "../engine/State";
import { Text } from "./Text";
import type { UiWidget } from "./UiState";

export interface TextButtonStyle {
  background: string;
  border: string;
  focusBorder?: string;
  foreground: string;
  fontSize?: number;
}

export class TextButton implements UiWidget {
  readonly focusable = true;
  readonly zIndex = 0;
  private focused = false;

  constructor(
    readonly x: number,
    readonly y: number,
    readonly w: number,
    readonly h: number,
    readonly label: string,
    readonly action: () => StateTransition,
    private readonly style: TextButtonStyle | (() => TextButtonStyle)
  ) {}

  contains(px: number, py: number): boolean {
    return px >= this.x && px <= this.x + this.w && py >= this.y && py <= this.y + this.h;
  }

  click(): StateTransition {
    return this.action();
  }

  onPointerDown(): StateTransition {
    return this.click();
  }

  setFocused(focused: boolean): void {
    this.focused = focused;
  }

  draw(renderer: Renderer): void {
    const style = typeof this.style === "function" ? this.style() : this.style;
    renderer.rect(this.x, this.y, this.w, this.h, style.background);
    renderer.strokeRect(this.x, this.y, this.w, this.h, this.focused ? (style.focusBorder ?? style.border) : style.border);
    new Text(this.x + 6, this.y + 11, this.label, {
      color: style.foreground,
      size: style.fontSize ?? 8
    }).draw(renderer);
  }
}
