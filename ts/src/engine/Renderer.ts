import { FontAtlas } from "./FontAtlas";
import { Palette } from "./Palette";
import { Surface } from "./Surface";

export class Renderer {
  private readonly canvas: HTMLCanvasElement;
  private readonly context: CanvasRenderingContext2D;
  private readonly width: number;
  private readonly height: number;
  private readonly surface: Surface;
  private palette: Palette;
  private readonly frame: ImageData;
  private readonly overlayPass: Array<() => void> = [];
  private scale: number;
  private smallFont: FontAtlas | null = null;

  constructor(parent: HTMLElement, width: number, height: number, scale: number) {
    this.width = width;
    this.height = height;
    this.surface = new Surface(width, height, 0);
    this.palette = Palette.defaultUiPalette();
    this.frame = new ImageData(width, height);
    this.scale = scale;

    this.canvas = document.createElement("canvas");
    this.canvas.width = width;
    this.canvas.height = height;
    this.canvas.className = "game-canvas";

    const context = this.canvas.getContext("2d");
    if (!context) {
      throw new Error("2D context unavailable");
    }
    context.imageSmoothingEnabled = false;
    context.textBaseline = "top";
    this.context = context;

    this.applyScale(scale);
    parent.appendChild(this.canvas);

    void this.initFont();
    void this.setPalettePack("ufo");
  }

  getCanvas(): HTMLCanvasElement {
    return this.canvas;
  }

  clear(color: string): void {
    this.surface.clear(this.resolveIndex(color));
    this.overlayPass.length = 0;
  }

  text(value: string, x: number, y: number, color = "#f0f0f0", size = 10): void {
    const resolved = this.resolveColor(color);
    if (!this.smallFont) {
      this.overlayPass.push(() => {
        this.context.fillStyle = resolved;
        this.context.font = "8px monospace";
        this.context.fillText(value, x, y);
      });
      return;
    }
    this.overlayPass.push(() => {
      this.smallFont?.drawText(this.context, value, x, y, resolved, size);
    });
  }

  rect(x: number, y: number, width: number, height: number, color: string): void {
    this.surface.fillRect(x, y, width, height, this.resolveIndex(color));
  }

  strokeRect(x: number, y: number, width: number, height: number, color: string): void {
    this.surface.strokeRect(x, y, width, height, this.resolveIndex(color));
  }

  toLogicalCoordinates(clientX: number, clientY: number): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect();
    const x = Math.floor(((clientX - rect.left) / rect.width) * this.width);
    const y = Math.floor(((clientY - rect.top) / rect.height) * this.height);
    return { x, y };
  }

  getSize(): { width: number; height: number; scale: number } {
    return { width: this.width, height: this.height, scale: this.scale };
  }

  fitToViewport(viewportWidth: number, viewportHeight: number, padding = 24, minScale = 1, maxScale = 6): void {
    const usableWidth = Math.max(1, viewportWidth - padding * 2);
    const usableHeight = Math.max(1, viewportHeight - padding * 2);
    const nextScale = Math.max(
      minScale,
      Math.min(maxScale, Math.floor(Math.min(usableWidth / this.width, usableHeight / this.height)))
    );
    this.applyScale(Number.isFinite(nextScale) ? nextScale : minScale);
  }

  present(): void {
    this.surface.blitToImageData(this.palette, this.frame);
    this.context.putImageData(this.frame, 0, 0);
    for (const draw of this.overlayPass) {
      draw();
    }
    this.overlayPass.length = 0;
  }

  async setPalettePack(pack: "ufo" | "tftd"): Promise<void> {
    try {
      this.palette = await Palette.fromDatUrl(`/game-assets/${pack}/GEODATA/BACKPALS.DAT`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`[renderer] Failed to load palette pack ${pack}: ${message}`);
      this.palette = Palette.defaultUiPalette();
    }
  }

  private applyScale(scale: number): void {
    this.scale = Math.max(1, Math.floor(scale));
    this.canvas.style.width = `${this.width * this.scale}px`;
    this.canvas.style.height = `${this.height * this.scale}px`;
  }

  private async initFont(): Promise<void> {
    try {
      this.smallFont = await FontAtlas.loadSmall();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`[renderer] Failed to load game font: ${message}`);
    }
  }

  private resolveColor(color: string): string {
    if (color.startsWith("p:")) {
      const index = Number.parseInt(color.slice(2), 10);
      if (Number.isFinite(index)) {
        return this.palette.getCss(index);
      }
    }
    return color;
  }

  private resolveIndex(color: string): number {
    if (color.startsWith("p:")) {
      const index = Number.parseInt(color.slice(2), 10);
      if (Number.isFinite(index)) {
        return index;
      }
      return 0;
    }
    const rgb = Palette.parseCssColor(color);
    return this.palette.findClosestIndex(rgb);
  }
}
