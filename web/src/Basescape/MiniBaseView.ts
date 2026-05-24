import { InteractiveSurface } from "../Engine/InteractiveSurface.ts";
import { Palette } from "../Engine/Palette.ts";
import type { SurfaceSet } from "../Engine/SurfaceSet.ts";
import type { Base } from "../Savegame/Base.ts";

const SLOT_WIDTH = 16;
const MINI_GRID = 6;
const MAX_BASES = 8;

export class MiniBaseView extends InteractiveSurface {
  private _bases: Base[] = [];
  private _selectedBase: Base | null = null;
  private _texture: SurfaceSet | null = null;
  private _color = 48;
  private _color2 = 32;

  setTexture(texture: SurfaceSet | null): void {
    this._texture = texture;
    this.invalidate();
  }

  setBases(bases: Base[]): void {
    this._bases = bases;
    this.invalidate();
  }

  setSelectedBase(base: Base | null): void {
    this._selectedBase = base;
    this.invalidate();
  }

  getBaseAt(mouseX: number): Base | null {
    const slot = Math.trunc((mouseX - this.getX()) / SLOT_WIDTH);
    return this._bases[slot] || null;
  }

  override setColor(color: number): void {
    this._color = color;
    this.invalidate();
  }

  override setSecondaryColor(color: number): void {
    this._color2 = color;
    this.invalidate();
  }

  override draw(): void {
    super.draw();
    if (this._texture?.getFrame(41)) {
      this.drawTextured();
      return;
    }
    this.drawRect(0, 0, this.getWidth(), this.getHeight(), this._color2);
    for (let i = 0; i < this._bases.length && i * SLOT_WIDTH < this.getWidth(); ++i) {
      const base = this._bases[i];
      const x = i * SLOT_WIDTH;
      const border = base === this._selectedBase ? this._color + 5 : this._color;
      this.drawLine(x, 0, x + SLOT_WIDTH - 1, 0, border);
      this.drawLine(x, 0, x, this.getHeight() - 1, border);
      this.drawLine(x + SLOT_WIDTH - 1, 0, x + SLOT_WIDTH - 1, this.getHeight() - 1, border);
      this.drawLine(x, this.getHeight() - 1, x + SLOT_WIDTH - 1, this.getHeight() - 1, border);
      for (const facility of base.getFacilities()) {
        const fx = x + 2 + Math.trunc(facility.getX() * 12 / MINI_GRID);
        const fy = 2 + Math.trunc(facility.getY() * 12 / MINI_GRID);
        const size = Math.max(1, Math.trunc(facility.getRules().getSize() * 12 / MINI_GRID));
        this.drawRect(fx, fy, size, size, this._color + 2 + (facility.getRules().getSpriteFacility() % 3));
      }
    }
  }

  private drawTextured(): void {
    for (let i = 0; i < MAX_BASES && i * SLOT_WIDTH < this.getWidth(); ++i) {
      const x = i * SLOT_WIDTH;
      if (this._bases[i] === this._selectedBase) {
        this.fillPaletteRect(x, 0, SLOT_WIDTH, SLOT_WIDTH, 1);
      }
      const frame = this._texture?.getFrame(41);
      if (frame) {
        frame.setX(x);
        frame.setY(0);
        frame.blit(this);
      }

      const base = this._bases[i];
      if (!base) {
        continue;
      }
      for (const facility of base.getFacilities()) {
        const color = facility.getBuildTime() === 0 ? this._color : this._color2;
        let fx = x + 2 + facility.getX() * 2;
        let fy = 2 + facility.getY() * 2;
        let fw = facility.getRules().getSize() * 2;
        let fh = facility.getRules().getSize() * 2;
        this.fillPaletteRect(fx, fy, fw, fh, color + 3);
        fx++;
        fy++;
        fw--;
        fh--;
        this.fillPaletteRect(fx, fy, fw, fh, color + 5);
        fx--;
        fy--;
        this.fillPaletteRect(fx, fy, fw, fh, color + 2);
        fx++;
        fy++;
        fw--;
        fh--;
        this.fillPaletteRect(fx, fy, fw, fh, color + 3);
        this.fillPaletteRect(fx - 1, fy - 1, 1, 1, color + 1);
      }
    }
  }

  private fillPaletteRect(x: number, y: number, w: number, h: number, color: number): void {
    if (w <= 0 || h <= 0) {
      return;
    }
    const ctx = this.getContext();
    ctx.fillStyle = Palette.css(this._palette, color);
    ctx.fillRect(x, y, w, h);
  }
}
