import { InteractiveSurface } from "../Engine/InteractiveSurface.ts";
import type { Action } from "../Engine/Action.ts";
import type { Font } from "../Engine/Font.ts";
import type { Language } from "../Engine/Language.ts";
import { Options } from "../Engine/Options.ts";
import type { State } from "../Engine/State.ts";
import { Surface } from "../Engine/Surface.ts";
import type { SurfaceSet } from "../Engine/SurfaceSet.ts";
import { Timer } from "../Engine/Timer.ts";
import { ALIGN_CENTER, Text } from "../Interface/Text.ts";
import { INT_MAX } from "../Mod/RuleInterface.ts";
import type { RuleBaseFacility } from "../Mod/RuleBaseFacility.ts";
import type { Base } from "../Savegame/Base.ts";
import type { BaseFacility } from "../Savegame/BaseFacility.ts";
import type { PaletteColor } from "../types.ts";

const BASE_SIZE = 6;
const GRID_SIZE = 32;

export class BaseView extends InteractiveSurface {
  private _base: Base | null = null;
  private _grid: Array<BaseFacility | null> = Array(BASE_SIZE * BASE_SIZE).fill(null);
  private _selFacility: BaseFacility | null = null;
  private _texture: SurfaceSet | null = null;
  private _big: Font | null = null;
  private _small: Font | null = null;
  private _lang: Language | null = null;
  private _gridX = 0;
  private _gridY = 0;
  private _selSize = 0;
  private _selector: Surface | null = null;
  private _blink = true;
  private _timer: Timer;
  private _color = 213;
  private _color2 = 16;

  constructor(width: number, height: number, x = 0, y = 0) {
    super(width, height, x, y);
    this._timer = new Timer(100);
    this._timer.onSurfaceTimer(this.blink);
    this._timer.start();
  }

  override initText(big?: unknown, small?: unknown, lang?: unknown): void {
    this._big = (big as Font | null) || this._big;
    this._small = (small as Font | null) || this._small || this._big;
    this._lang = (lang as Language | null) || this._lang;
  }

  override setPalette(colors: PaletteColor[], firstcolor = 0, ncolors = colors.length): void {
    super.setPalette(colors, firstcolor, ncolors);
    this._selector?.setPalette(this.getPalette());
  }

  setTexture(texture: SurfaceSet | null): void {
    this._texture = texture;
    this.invalidate();
  }

  setBase(base: Base | null): void {
    this._base = base;
    this.rebuildGrid();
    this.invalidate();
  }

  getSelectedFacility(): BaseFacility | null {
    return this._selFacility;
  }

  resetSelectedFacility(): void {
    if (!this._selFacility) {
      return;
    }
    const x = this._selFacility.getX();
    const y = this._selFacility.getY();
    if (x >= 0 && x < BASE_SIZE && y >= 0 && y < BASE_SIZE) {
      this._grid[y * BASE_SIZE + x] = null;
    }
    this._selFacility = null;
    this.invalidate();
  }

  getGridX(): number {
    return this._gridX;
  }

  getGridY(): number {
    return this._gridY;
  }

  setSelectable(size: number): void {
    this._selSize = size;
    if (this._selSize > 0) {
      this._selector = new Surface(size * GRID_SIZE, size * GRID_SIZE, this.getX(), this.getY());
      this._selector.setPalette(this.getPalette());
      this.drawSelector();
      this._selector.setVisible(false);
    } else {
      this._selector = null;
    }
  }

  isPlaceable(rule: RuleBaseFacility): boolean {
    for (let y = this._gridY; y < this._gridY + rule.getSize(); ++y) {
      for (let x = this._gridX; x < this._gridX + rule.getSize(); ++x) {
        if (x < 0 || x >= BASE_SIZE || y < 0 || y >= BASE_SIZE) {
          return false;
        }
        if (this.getFacilityAt(x, y) !== null) {
          return false;
        }
      }
    }

    const allowQueue = Options.allowBuildingQueue;
    for (let i = 0; i < rule.getSize(); ++i) {
      if ((this._gridX > 0 && this.canConnectTo(this.getFacilityAt(this._gridX - 1, this._gridY + i), allowQueue)) ||
        (this._gridY > 0 && this.canConnectTo(this.getFacilityAt(this._gridX + i, this._gridY - 1), allowQueue)) ||
        (this._gridX + rule.getSize() < BASE_SIZE && this.canConnectTo(this.getFacilityAt(this._gridX + rule.getSize(), this._gridY + i), allowQueue)) ||
        (this._gridY + rule.getSize() < BASE_SIZE && this.canConnectTo(this.getFacilityAt(this._gridX + i, this._gridY + rule.getSize()), allowQueue))) {
        return true;
      }
    }
    return false;
  }

  isQueuedBuilding(rule: RuleBaseFacility): boolean {
    for (let i = 0; i < rule.getSize(); ++i) {
      if ((this._gridX > 0 && this.getFacilityAt(this._gridX - 1, this._gridY + i)?.getBuildTime() === 0) ||
        (this._gridY > 0 && this.getFacilityAt(this._gridX + i, this._gridY - 1)?.getBuildTime() === 0) ||
        (this._gridX + rule.getSize() < BASE_SIZE && this.getFacilityAt(this._gridX + rule.getSize(), this._gridY + i)?.getBuildTime() === 0) ||
        (this._gridY + rule.getSize() < BASE_SIZE && this.getFacilityAt(this._gridX + i, this._gridY + rule.getSize())?.getBuildTime() === 0)) {
        return false;
      }
    }
    return true;
  }

  reCalcQueuedBuildings(): void {
    if (!this._base) {
      return;
    }
    this.rebuildGrid();
    const facilities: BaseFacility[] = [];
    for (const facility of this._base.getFacilities()) {
      if (facility.getBuildTime() > 0) {
        if (facility.getBuildTime() > facility.getRules().getBuildTime()) {
          facility.setBuildTime(INT_MAX);
        }
        facilities.push(facility);
      }
    }

    while (facilities.length > 0) {
      let minIndex = 0;
      for (let i = 1; i < facilities.length; ++i) {
        if (facilities[i].getBuildTime() < facilities[minIndex].getBuildTime()) {
          minIndex = i;
        }
      }
      const facility = facilities.splice(minIndex, 1)[0];
      const rule = facility.getRules();
      const x = facility.getX();
      const y = facility.getY();
      for (let i = 0; i < rule.getSize(); ++i) {
        if (x > 0) {
          this.updateNeighborFacilityBuildTime(facility, this.getFacilityAt(x - 1, y + i));
        }
        if (y > 0) {
          this.updateNeighborFacilityBuildTime(facility, this.getFacilityAt(x + i, y - 1));
        }
        if (x + rule.getSize() < BASE_SIZE) {
          this.updateNeighborFacilityBuildTime(facility, this.getFacilityAt(x + rule.getSize(), y + i));
        }
        if (y + rule.getSize() < BASE_SIZE) {
          this.updateNeighborFacilityBuildTime(facility, this.getFacilityAt(x + i, y + rule.getSize()));
        }
      }
    }
    this.invalidate();
  }

  override setColor(color: number): void {
    this._color = color;
    this.invalidate();
  }

  override setSecondaryColor(color: number): void {
    this._color2 = color;
    this.drawSelector();
    this.invalidate();
  }

  override think(): void {
    this._timer.think(null, this);
  }

  blink(): void {
    this._blink = !this._blink;
    this.drawSelector();
  }

  override blit(surface: Surface): void {
    super.blit(surface);
    this._selector?.blit(surface);
  }

  override draw(): void {
    super.draw();
    if (this._texture && this._base && this._texture.getFrame(0)) {
      this.drawTexturedBase();
    } else {
      this.drawGrid();
      this.drawFacilities();
      this.drawConnectors();
    }
  }

  override mouseOver(action: Action, state: State): void {
    const old = this._selFacility;
    this._gridX = Math.trunc((action.getAbsoluteXMouse() - this.getX()) / GRID_SIZE);
    this._gridY = Math.trunc((action.getAbsoluteYMouse() - this.getY()) / GRID_SIZE);
    this._selFacility = this._gridX >= 0 && this._gridX < BASE_SIZE && this._gridY >= 0 && this._gridY < BASE_SIZE
      ? this.getFacilityAt(this._gridX, this._gridY)
      : null;
    if (this._selSize > 0 && this._selector) {
      if (this._gridX >= 0 &&
        this._gridY >= 0 &&
        this._gridX + this._selSize - 1 < BASE_SIZE &&
        this._gridY + this._selSize - 1 < BASE_SIZE) {
        this._selector.setX(this.getX() + this._gridX * GRID_SIZE);
        this._selector.setY(this.getY() + this._gridY * GRID_SIZE);
        this._selector.setVisible(true);
      } else {
        this._selector.setVisible(false);
      }
    }
    if (old !== this._selFacility) {
      this.invalidate();
    }
    super.mouseOver(action, state);
  }

  override mouseOut(action: Action, state: State): void {
    if (this._selFacility) {
      this._selFacility = null;
      this.invalidate();
    }
    this._selector?.setVisible(false);
    super.mouseOut(action, state);
  }

  private rebuildGrid(): void {
    this._grid = Array(BASE_SIZE * BASE_SIZE).fill(null);
    if (!this._base) {
      return;
    }
    for (const facility of this._base.getFacilities()) {
      const size = Math.max(1, facility.getRules().getSize());
      for (let yy = 0; yy < size; ++yy) {
        for (let xx = 0; xx < size; ++xx) {
          const x = facility.getX() + xx;
          const y = facility.getY() + yy;
          if (x >= 0 && x < BASE_SIZE && y >= 0 && y < BASE_SIZE) {
            this._grid[y * BASE_SIZE + x] = facility;
          }
        }
      }
    }
  }

  private drawGrid(): void {
    for (let y = 0; y < BASE_SIZE; ++y) {
      for (let x = 0; x < BASE_SIZE; ++x) {
        const px = x * GRID_SIZE;
        const py = y * GRID_SIZE;
        this.drawRect(px, py, GRID_SIZE, GRID_SIZE, this._color2);
        this.drawLine(px, py, px + GRID_SIZE - 1, py, this._color);
        this.drawLine(px, py, px, py + GRID_SIZE - 1, this._color);
        this.drawLine(px + GRID_SIZE - 1, py, px + GRID_SIZE - 1, py + GRID_SIZE - 1, this._color + 2);
        this.drawLine(px, py + GRID_SIZE - 1, px + GRID_SIZE - 1, py + GRID_SIZE - 1, this._color + 2);
      }
    }
  }

  private drawTexturedBase(): void {
    if (!this._base) {
      return;
    }

    for (let x = 0; x < BASE_SIZE; ++x) {
      for (let y = 0; y < BASE_SIZE; ++y) {
        this.blitFrame(0, x * GRID_SIZE, y * GRID_SIZE);
      }
    }

    for (const facility of this._base.getFacilities()) {
      const rule = facility.getRules();
      const size = Math.max(1, rule.getSize());
      const outline = Math.max(size * size, 3);
      let num = 0;
      for (let y = facility.getY(); y < facility.getY() + size; ++y) {
        for (let x = facility.getX(); x < facility.getX() + size; ++x) {
          const frame = rule.getSpriteShape() + num + (facility.getBuildTime() === 0 ? 0 : outline);
          this.blitFrame(frame, x * GRID_SIZE, y * GRID_SIZE);
          ++num;
        }
      }
    }

    for (const facility of this._base.getFacilities()) {
      if (facility.getBuildTime() !== 0) {
        continue;
      }
      const rule = facility.getRules();
      const size = Math.max(1, rule.getSize());
      const rightX = facility.getX() + size;
      if (rightX < BASE_SIZE) {
        for (let y = facility.getY(); y < facility.getY() + size; ++y) {
          const right = this._grid[y * BASE_SIZE + rightX];
          if (right && right.getBuildTime() === 0) {
            this.blitFrame(7, rightX * GRID_SIZE - GRID_SIZE / 2, y * GRID_SIZE);
          }
        }
      }

      const bottomY = facility.getY() + size;
      if (bottomY < BASE_SIZE) {
        for (let x = facility.getX(); x < facility.getX() + size; ++x) {
          const bottom = this._grid[bottomY * BASE_SIZE + x];
          if (bottom && bottom.getBuildTime() === 0) {
            this.blitFrame(8, x * GRID_SIZE, bottomY * GRID_SIZE - GRID_SIZE / 2);
          }
        }
      }
    }

    for (const facility of this._base.getFacilities()) {
      const rule = facility.getRules();
      const size = Math.max(1, rule.getSize());
      let num = 0;
      for (let y = facility.getY(); y < facility.getY() + size; ++y) {
        for (let x = facility.getX(); x < facility.getX() + size; ++x) {
          if (size === 1) {
            this.blitFrame(rule.getSpriteFacility() + num, x * GRID_SIZE, y * GRID_SIZE);
          }
          ++num;
        }
      }
    }

    let craft = 0;
    for (const facility of this._base.getFacilities()) {
      facility.setCraft(null);
      const rule = facility.getRules();
      if (facility.getBuildTime() === 0 && rule.getCrafts() > 0) {
        const baseCraft = this._base.getCrafts()[craft];
        if (baseCraft && baseCraft.getStatus() !== "STR_OUT") {
          this.blitFrame(
            baseCraft.getRules().getSprite() + 33,
            facility.getX() * GRID_SIZE + (rule.getSize() - 1) * GRID_SIZE / 2 + 2,
            facility.getY() * GRID_SIZE + (rule.getSize() - 1) * GRID_SIZE / 2 - 4
          );
          facility.setCraft(baseCraft);
        }
        ++craft;
      }
    }

    for (const facility of this._base.getFacilities()) {
      this.drawBuildTime(facility);
    }
  }

  private blitFrame(frameNumber: number, x: number, y: number): void {
    const frame = this._texture?.getFrame(frameNumber);
    if (!frame) {
      return;
    }
    frame.setX(Math.trunc(x));
    frame.setY(Math.trunc(y));
    frame.blit(this);
  }

  private drawFacilities(): void {
    if (!this._base) {
      return;
    }
    for (const facility of this._base.getFacilities()) {
      const rule = facility.getRules();
      const size = Math.max(1, rule.getSize());
      const px = facility.getX() * GRID_SIZE;
      const py = facility.getY() * GRID_SIZE;
      const width = size * GRID_SIZE;
      const height = size * GRID_SIZE;
      const fill = this.facilityColor(facility);
      const border = facility === this._selFacility ? this._color + 5 : this._color + 3;
      this.drawRect(px + 2, py + 2, width - 4, height - 4, fill);
      this.drawLine(px + 1, py + 1, px + width - 2, py + 1, border);
      this.drawLine(px + 1, py + 1, px + 1, py + height - 2, border);
      this.drawLine(px + width - 2, py + 1, px + width - 2, py + height - 2, border);
      this.drawLine(px + 1, py + height - 2, px + width - 2, py + height - 2, border);
      if (facility.getBuildTime() > 0) {
        this.drawLine(px + 4, py + 4, px + width - 5, py + height - 5, border);
        this.drawLine(px + width - 5, py + 4, px + 4, py + height - 5, border);
        this.drawBuildTime(facility);
      }
    }
  }

  private drawConnectors(): void {
    for (let y = 0; y < BASE_SIZE; ++y) {
      for (let x = 0; x < BASE_SIZE; ++x) {
        const current = this._grid[y * BASE_SIZE + x];
        if (!current) {
          continue;
        }
        if (x + 1 < BASE_SIZE) {
          const right = this._grid[y * BASE_SIZE + x + 1];
          if (right && right !== current) {
            this.drawRect((x + 1) * GRID_SIZE - 2, y * GRID_SIZE + 14, 4, 4, this._color + 5);
          }
        }
        if (y + 1 < BASE_SIZE) {
          const down = this._grid[(y + 1) * BASE_SIZE + x];
          if (down && down !== current) {
            this.drawRect(x * GRID_SIZE + 14, (y + 1) * GRID_SIZE - 2, 4, 4, this._color + 5);
          }
        }
      }
    }
  }

  private facilityColor(facility: BaseFacility): number {
    const sprite = facility.getRules().getSpriteFacility();
    return this._color + 1 + (sprite % 4);
  }

  private getFacilityAt(x: number, y: number): BaseFacility | null {
    if (x < 0 || x >= BASE_SIZE || y < 0 || y >= BASE_SIZE) {
      return null;
    }
    return this._grid[y * BASE_SIZE + x];
  }

  private canConnectTo(facility: BaseFacility | null, allowQueue: boolean): boolean {
    return facility !== null && (allowQueue || facility.getBuildTime() === 0);
  }

  private updateNeighborFacilityBuildTime(facility: BaseFacility | null, neighbor: BaseFacility | null): void {
    if (facility !== null &&
      neighbor !== null &&
      neighbor.getBuildTime() > neighbor.getRules().getBuildTime() &&
      facility.getBuildTime() + neighbor.getRules().getBuildTime() < neighbor.getBuildTime()) {
      neighbor.setBuildTime(facility.getBuildTime() + neighbor.getRules().getBuildTime());
    }
  }

  private drawSelector(): void {
    if (!this._selector) {
      return;
    }
    if (this._blink) {
      this._selector.drawRect(0, 0, this._selector.getWidth(), this._selector.getHeight(), this._color2);
      this._selector.drawRect(1, 1, this._selector.getWidth() - 2, this._selector.getHeight() - 2, 0);
    } else {
      this._selector.drawRect(0, 0, this._selector.getWidth(), this._selector.getHeight(), 0);
    }
  }

  private drawBuildTime(facility: BaseFacility): void {
    if (facility.getBuildTime() <= 0 || !this._big || !this._small) {
      return;
    }
    const size = Math.max(1, facility.getRules().getSize());
    const text = new Text(GRID_SIZE * size, 16, 0, 0);
    text.setPalette(this.getPalette());
    text.initText(this._big, this._small, this._lang);
    text.setBig();
    text.setAlign(ALIGN_CENTER);
    text.setColor(this._color);
    text.setText(String(facility.getBuildTime()));
    text.draw();

    const destX = facility.getX() * GRID_SIZE;
    const destY = facility.getY() * GRID_SIZE + Math.trunc((GRID_SIZE * size - 16) / 2);
    for (let y = 0; y < text.getHeight(); ++y) {
      for (let x = 0; x < text.getWidth(); ++x) {
        const pixel = text.getPixel(x, y);
        if (pixel) {
          this.setPixel(destX + x, destY + y, pixel);
        }
      }
    }
  }
}
