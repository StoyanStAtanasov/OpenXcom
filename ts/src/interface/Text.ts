import type { Renderer } from "../engine/Renderer";

export interface TextStyle {
  color?: string;
  size?: number;
}

export class Text {
  constructor(
    readonly x: number,
    readonly y: number,
    readonly value: string,
    private readonly style: TextStyle = {}
  ) {}

  draw(renderer: Renderer): void {
    renderer.text(this.value, this.x, this.y, this.style.color ?? "#f0f0f0", this.style.size ?? 8);
  }
}

