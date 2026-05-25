import { Options } from "../Engine/Options.ts";
import { Surface } from "../Engine/Surface.ts";
import type { SurfaceSet } from "../Engine/SurfaceSet.ts";
import type { BattleItem } from "../Savegame/BattleItem.ts";
import { BattleUnit, UnitStatus } from "../Savegame/BattleUnit.ts";

/**
 * Renders a unit by combining the source-defined unit and hand item frames.
 */
export class UnitSprite extends Surface {
  private _unit: BattleUnit | null = null;
  private _itemR: BattleItem | null = null;
  private _itemL: BattleItem | null = null;
  private _unitSurface: SurfaceSet | null = null;
  private _itemSurfaceR: SurfaceSet | null = null;
  private _itemSurfaceL: SurfaceSet | null = null;
  private _part = 0;
  private _animationFrame = 0;
  private _drawingRoutine = 0;
  private _color: Array<[number, number]> | null = null;
  private _colorSize = 0;

  constructor(width: number, height: number, x: number, y: number, private _helmet: boolean) {
    super(width, height, x, y);
  }

  setSurfaces(unitSurface: SurfaceSet | null, itemSurfaceR: SurfaceSet | null, itemSurfaceL: SurfaceSet | null): void {
    this._unitSurface = unitSurface;
    this._itemSurfaceR = itemSurfaceR;
    this._itemSurfaceL = itemSurfaceL;
    this._redraw = true;
  }

  setBattleUnit(unit: BattleUnit, part = 0): void {
    this._unit = unit;
    this._drawingRoutine = unit.getArmor().getDrawingRoutine();
    this._redraw = true;
    this._part = part;

    if ((Options as unknown as { battleHairBleach?: boolean }).battleHairBleach) {
      this._color = unit.getRecolor();
      this._colorSize = this._color.length;
    } else {
      this._color = null;
      this._colorSize = 0;
    }

    this._itemR = unit.getItem("STR_RIGHT_HAND");
    if (this._itemR?.getRules().isFixed()) {
      this._itemR = null;
    }
    this._itemL = unit.getItem("STR_LEFT_HAND");
    if (this._itemL?.getRules().isFixed()) {
      this._itemL = null;
    }
  }

  setAnimationFrame(frame: number): void {
    this._animationFrame = frame;
  }

  override draw(): void {
    super.draw();
    const routines = [
      this.drawRoutine0,
      this.drawRoutine1,
      this.drawRoutine2,
      this.drawRoutine3,
      this.drawRoutine4,
      this.drawRoutine5,
      this.drawRoutine6,
      this.drawRoutine7,
      this.drawRoutine8,
      this.drawRoutine9,
      this.drawRoutine0,
      this.drawRoutine11,
      this.drawRoutine12,
      this.drawRoutine0,
      this.drawRoutine0,
      this.drawRoutine0,
      this.drawRoutine12,
      this.drawRoutine4,
      this.drawRoutine4,
      this.drawRoutine19,
      this.drawRoutine20,
      this.drawRoutine21,
      this.drawRoutine3
    ];
    const routine = routines[this._drawingRoutine] || this.drawRoutine0;
    routine.call(this);
  }

  private drawRecolored(src: Surface | null): void {
    if (!src) {
      return;
    }
    if (!this._colorSize || !this._color) {
      src.blit(this);
      return;
    }
    for (let y = 0; y < src.getHeight(); ++y) {
      for (let x = 0; x < src.getWidth(); ++x) {
        const pixel = src.getPixel(x, y);
        if (!pixel) {
          continue;
        }
        let dest = pixel;
        for (const [from, to] of this._color) {
          if ((pixel & (15 << 4)) === from) {
            dest = to + (pixel & 15);
            break;
          }
        }
        this.setPixel(src.getX() + x, src.getY() + y, dest);
      }
    }
  }

  private sortRifles(): void {
    if (this._itemR?.getRules().isTwoHanded()) {
      if (this._itemL?.getRules().isTwoHanded()) {
        if (this._unit?.getActiveHand() === "STR_LEFT_HAND") {
          this._itemR = this._itemL;
        }
        this._itemL = null;
      } else if (this._unit?.getStatus() !== UnitStatus.STATUS_AIMING) {
        this._itemL = null;
      }
    } else if (this._itemL?.getRules().isTwoHanded() && this._unit?.getStatus() !== UnitStatus.STATUS_AIMING) {
      this._itemR = null;
    }
  }

  private drawRoutine0(): void {
    this.drawSingleFrame(0, 16, 24);
  }

  private drawRoutine1(): void {
    this.drawSingleFrame(0, 8, 16);
  }

  private drawRoutine2(): void {
    this.drawSingleFrame(this._part * 8, 32 + this._part * 4, 64);
  }

  private drawRoutine3(): void {
    this.drawSingleFrame(this._part * 8, 32 + this._part * 4, 64);
  }

  private drawRoutine4(): void {
    this.drawSingleFrame(0, 8, 72);
  }

  private drawRoutine5(): void {
    this.drawSingleFrame(this._part * 8, 32 + this._part * 4, this._part * 8);
  }

  private drawRoutine6(): void {
    this.drawSingleFrame(24, 32, 96);
  }

  private drawRoutine7(): void {
    this.drawSingleFrame(24, 48, 224);
  }

  private drawRoutine8(): void {
    this.drawAnimatedBody([0, 1, 2, 3, 4, 3, 2, 1], 6);
  }

  private drawRoutine9(): void {
    this.drawAnimatedOffset(0, 25);
  }

  private drawRoutine11(): void {
    this.drawSingleFrame(this._part * 4, this._part * 4, this._part * 4);
  }

  private drawRoutine12(): void {
    this.drawAnimatedOffset(this._part * 8, 8);
  }

  private drawRoutine19(): void {
    this.drawSingleFrame(0, 8, 16);
  }

  private drawRoutine20(): void {
    const direction = this._unit?.getDirection() || 0;
    const walk = Math.trunc(((this._unit?.getWalkingPhase() || 0) / 2) % 4);
    this.blitFrame(5 * (this._part + 4 * direction) + (this._unit?.getStatus() === UnitStatus.STATUS_WALKING ? walk : 0));
  }

  private drawRoutine21(): void {
    const direction = this._unit?.getDirection() || 0;
    this.blitFrame(this._part * 4 + direction * 16 + (this._animationFrame % 4));
    this._redraw = true;
  }

  private drawSingleFrame(standBase: number, walkBase: number, dieBase: number): void {
    if (!this._unit || this._unit.isOut()) {
      return;
    }
    this.sortRifles();
    const direction = this._unit.getDirection();
    let frame = standBase + direction;
    if (this._unit.getStatus() === UnitStatus.STATUS_COLLAPSING) {
      frame = dieBase + this._unit.getFallingPhase();
    } else if (this._unit.getStatus() === UnitStatus.STATUS_WALKING) {
      frame = walkBase + direction * 8 + this._unit.getWalkingPhase();
    }
    this.blitFrame(frame);
    this.drawHeldItems(direction);
  }

  private drawAnimatedBody(frames: number[], dieBase: number): void {
    if (!this._unit || this._unit.isOut()) {
      return;
    }
    const frame = this._unit.getStatus() === UnitStatus.STATUS_COLLAPSING
      ? dieBase + this._unit.getFallingPhase()
      : frames[this._animationFrame % frames.length];
    this.blitFrame(frame);
    this._redraw = true;
  }

  private drawAnimatedOffset(base: number, dieBase: number): void {
    if (!this._unit || this._unit.isOut()) {
      return;
    }
    const frame = this._unit.getStatus() === UnitStatus.STATUS_COLLAPSING
      ? dieBase + this._unit.getFallingPhase()
      : base + this._animationFrame;
    this.blitFrame(frame);
    this._redraw = true;
  }

  private blitFrame(frame: number): void {
    const surface = this._unitSurface?.getFrame(frame) || null;
    if (!surface) {
      return;
    }
    surface.setX(16);
    this.drawRecolored(surface);
    surface.setX(0);
  }

  private drawHeldItems(direction: number): void {
    const itemR = this._itemR && this._itemSurfaceR?.getFrame(this._itemR.getRules().getHandSprite() + direction);
    const itemL = this._itemL && this._itemSurfaceL?.getFrame(this._itemL.getRules().getHandSprite() + direction);
    if (itemR) {
      itemR.setX(16);
      itemR.blit(this);
      itemR.setX(0);
    }
    if (itemL) {
      itemL.setX(16);
      itemL.blit(this);
      itemL.setX(0);
    }
  }
}
