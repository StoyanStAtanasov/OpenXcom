import { glyphIndexForChar, loadSmallGameFont, type GameFont, type Glyph } from "./GameFont";
import { Palette } from "./Palette";

export class FontAtlas {
  private readonly font: GameFont;
  private readonly glyphCache = new Map<string, HTMLCanvasElement>();

  constructor(font: GameFont) {
    this.font = font;
  }

  static async loadSmall(): Promise<FontAtlas> {
    const font = await loadSmallGameFont();
    return new FontAtlas(font);
  }

  drawText(
    context: CanvasRenderingContext2D,
    value: string,
    x: number,
    y: number,
    color: string,
    size: number
  ): void {
    const pixelScale = Math.max(1, Math.round(size / this.font.glyphHeight));
    let dx = Math.floor(x);
    const dy = Math.floor(y);
    const rgb = Palette.parseCssColor(color);

    for (const char of value) {
      const key = glyphIndexForChar(char);
      if (key === " ") {
        dx += this.font.spaceAdvance * pixelScale;
        continue;
      }

      const sourceGlyph = this.font.glyphs.get(key) ?? this.font.fallback;
      const glyph = this.getGlyph(sourceGlyph, key, rgb.r, rgb.g, rgb.b, pixelScale);
      context.drawImage(glyph, dx, dy);
      dx += (sourceGlyph.width + this.font.spacing) * pixelScale;
    }
  }

  private getGlyph(
    glyph: Glyph,
    keyName: string,
    r: number,
    g: number,
    b: number,
    pixelScale: number
  ): HTMLCanvasElement {
    const key = `${keyName}|${r}|${g}|${b}|${pixelScale}`;
    const cached = this.glyphCache.get(key);
    if (cached) {
      return cached;
    }

    const glyphCanvas = document.createElement("canvas");
    glyphCanvas.width = glyph.width * pixelScale;
    glyphCanvas.height = glyph.height * pixelScale;
    const glyphCtx = glyphCanvas.getContext("2d");
    if (!glyphCtx) {
      return glyphCanvas;
    }

    glyphCtx.fillStyle = `rgb(${r}, ${g}, ${b})`;
    for (let row = 0; row < glyph.height; row += 1) {
      for (let col = 0; col < glyph.width; col += 1) {
        const value = glyph.mask[row * glyph.width + col];
        if (value === 0) continue;
        glyphCtx.fillRect(col * pixelScale, row * pixelScale, pixelScale, pixelScale);
      }
    }

    this.glyphCache.set(key, glyphCanvas);
    return glyphCanvas;
  }
}

