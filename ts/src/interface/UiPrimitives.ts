import type { Renderer } from "../engine/Renderer";
import { Text, type TextStyle } from "./Text";
import type { UiWidget } from "./UiState";

export class UiText implements UiWidget {
  readonly zIndex: number;

  constructor(
    private readonly x: number,
    private readonly y: number,
    private readonly value: string | (() => string),
    private readonly style: TextStyle | (() => TextStyle) = {},
    zIndex = 0
  ) {
    this.zIndex = zIndex;
  }

  draw(renderer: Renderer): void {
    const text = typeof this.value === "function" ? this.value() : this.value;
    const style = typeof this.style === "function" ? this.style() : this.style;
    new Text(this.x, this.y, text, style).draw(renderer);
  }
}

export class UiRect implements UiWidget {
  readonly zIndex: number;

  constructor(
    private readonly x: number,
    private readonly y: number,
    private readonly w: number,
    private readonly h: number,
    private readonly fill: string,
    private readonly border?: string,
    zIndex = 0
  ) {
    this.zIndex = zIndex;
  }

  draw(renderer: Renderer): void {
    renderer.rect(this.x, this.y, this.w, this.h, this.fill);
    if (this.border) {
      renderer.strokeRect(this.x, this.y, this.w, this.h, this.border);
    }
  }
}
