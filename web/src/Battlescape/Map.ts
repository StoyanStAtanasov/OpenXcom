import { InteractiveSurface } from "../Engine/InteractiveSurface.ts";
import { Options } from "../Engine/Options.ts";
import { Palette } from "../Engine/Palette.ts";
import { Surface } from "../Engine/Surface.ts";
import { Timer } from "../Engine/Timer.ts";
import type { Action } from "../Engine/Action.ts";
import type { State } from "../Engine/State.ts";
import { Mod } from "../Mod/Mod.ts";
import { TilePart } from "../Mod/MapData.ts";
import { UnitFaction, UnitStatus, type BattleUnit } from "../Savegame/BattleUnit.ts";
import { SavedBattleGame } from "../Savegame/SavedBattleGame.ts";
import type { Tile } from "../Savegame/Tile.ts";
import { Camera } from "./Camera.ts";
import { Explosion } from "./Explosion.ts";
import { Position } from "./Position.ts";
import type { Projectile } from "./Projectile.ts";
import { UnitSprite } from "./UnitSprite.ts";

export enum CursorType {
  CT_NONE = 0,
  CT_NORMAL,
  CT_AIM,
  CT_PSI,
  CT_WAYPOINT,
  CT_THROW
}

export type MapGameLike = {
  getSavedGame?: () => { getSavedBattle?: () => SavedBattleGame | null } | null;
  getMod?: () => Mod | null;
};

function resolveSave(source: SavedBattleGame | MapGameLike): SavedBattleGame {
  if (source instanceof SavedBattleGame) {
    return source;
  }
  const save = source.getSavedGame?.()?.getSavedBattle?.() || null;
  if (!save) {
    throw new Error("Map requires a SavedBattleGame or a Game with getSavedGame().getSavedBattle().");
  }
  return save;
}

/**
 * Interactive map of the battlescape.
 */
export class Map extends InteractiveSurface {
  static readonly SCROLL_INTERVAL = 15;
  static readonly BULLET_SPRITES = 35;

  private _save: SavedBattleGame;
  private _mod: Mod | null = null;
  private _spriteWidth = 32;
  private _spriteHeight = 40;
  private _selectorX = 0;
  private _selectorY = 0;
  private _mouseX = 0;
  private _mouseY = 0;
  private _cursorType = CursorType.CT_NORMAL;
  private _cursorSize = 1;
  private _animFrame = 0;
  private _camera: Camera;
  private _visibleMapHeight: number;
  private _waypoints: Position[] = [];
  private _unitDying = false;
  private _flashScreen = false;
  private _launch = false;
  private _smoothingEngaged = false;
  private _iconHeight = 0;
  private _iconWidth = 0;
  private _showObstacles = false;
  private _projectile: Projectile | null = null;
  private _explosions: Explosion[] = [];
  private _scrollMouseTimer = new Timer(Map.SCROLL_INTERVAL);
  private _scrollKeyTimer = new Timer(Map.SCROLL_INTERVAL);
  private _obstacleTimer = new Timer(2500);

  constructor(gameOrSave: SavedBattleGame | MapGameLike, width: number, height: number, x: number, y: number, visibleMapHeight = height, spriteWidth = 32, spriteHeight = 40) {
    super(width, height, x, y);
    this._save = resolveSave(gameOrSave);
    this._mod = gameOrSave instanceof SavedBattleGame ? null : gameOrSave.getMod?.() || null;
    this._spriteWidth = spriteWidth;
    this._spriteHeight = spriteHeight;
    this._visibleMapHeight = visibleMapHeight;
    this._camera = new Camera(this._spriteWidth, this._spriteHeight, this._save.getMapSizeX(), this._save.getMapSizeY(), this._save.getMapSizeZ(), this, visibleMapHeight);
    this._scrollMouseTimer.onSurfaceTimer(this.scrollMouse.bind(this));
    this._scrollKeyTimer.onSurfaceTimer(this.scrollKey.bind(this));
    this._camera.setScrollTimer(this._scrollMouseTimer, this._scrollKeyTimer);
    this._obstacleTimer.stop();
    this._obstacleTimer.onSurfaceTimer(this.disableObstacles.bind(this));
    this._camera.centerOnPosition(new Position(Math.trunc(this._save.getMapSizeX() / 2), Math.trunc(this._save.getMapSizeY() / 2), 0), false);
    this.invalidate();
  }

  init(): void {
    this._projectile = null;
  }

  think(): void {
    this._scrollMouseTimer.think(null, this);
    this._scrollKeyTimer.think(null, this);
    this._obstacleTimer.think(null, this);
  }

  override draw(): void {
    if (!this._redraw) {
      return;
    }
    this._redraw = false;
    this.clear(Palette.blockOffset(0) + 15);
    this.drawTerrain();
  }

  override mouseOver(action: Action, state: State): void {
    super.mouseOver(action, state);
    this._camera.mouseOver(action, state);
    this._mouseX = Math.trunc(action.getAbsoluteXMouse());
    this._mouseY = Math.trunc(action.getAbsoluteYMouse());
    this.setSelectorPosition(this._mouseX, this._mouseY);
  }

  override mousePress(action: Action, state: State): void {
    super.mousePress(action, state);
    this._camera.mousePress(action, state);
  }

  override mouseRelease(action: Action, state: State): void {
    super.mouseRelease(action, state);
    this._camera.mouseRelease(action, state);
  }

  override keyboardPress(action: Action, state: State): void {
    super.keyboardPress(action, state);
    this._camera.keyboardPress(action, state);
  }

  override keyboardRelease(action: Action, state: State): void {
    super.keyboardRelease(action, state);
    this._camera.keyboardRelease(action, state);
  }

  animate(redraw: boolean): void {
    this._animFrame++;
    if (this._animFrame === 8) {
      this._animFrame = 0;
    }
    for (const tile of this._save.getTiles()) {
      tile.animate();
    }
    if (redraw) {
      this.invalidate();
    }
  }

  setSelectorPosition(mx: number, my: number): void {
    const oldX = this._selectorX;
    const oldY = this._selectorY;
    const pos = this._camera.convertScreenToMap(mx, my + Math.trunc(this._spriteHeight / 4));
    this._selectorX = pos.x;
    this._selectorY = pos.y;
    if (oldX !== this._selectorX || oldY !== this._selectorY) {
      this.invalidate();
    }
  }

  getSelectorPosition(pos?: Position): Position {
    const result = pos || new Position();
    result.x = this._selectorX;
    result.y = this._selectorY;
    result.z = this._camera.getViewLevel();
    return result;
  }

  setCursorType(type: CursorType, size = 1): void {
    this._cursorType = type;
    this._cursorSize = size;
    this.invalidate();
  }

  getCursorType(): CursorType {
    return this._cursorType;
  }

  getCamera(): Camera {
    return this._camera;
  }

  scrollMouse(): void {
    this._camera.scrollMouse();
  }

  scrollKey(): void {
    this._camera.scrollKey();
  }

  getWaypoints(): Position[] {
    return this._waypoints;
  }

  setButtonsPressed(button: number, pressed: boolean): void {
    this.setButtonPressed(button, pressed);
  }

  setUnitDying(flag: boolean): void {
    this._unitDying = flag;
  }

  refreshSelectorPosition(): void {
    this.setSelectorPosition(this._mouseX, this._mouseY);
  }

  override setHeight(height: number): void {
    super.setHeight(height);
    this._visibleMapHeight = height - this._iconHeight;
    this._camera.resize();
  }

  override setWidth(width: number): void {
    super.setWidth(width);
    this._camera.resize();
  }

  getMessageY(): number {
    return Math.trunc(this._visibleMapHeight / 2);
  }

  getIconHeight(): number {
    return this._iconHeight;
  }

  getIconWidth(): number {
    return this._iconWidth;
  }

  getSoundAngle(pos: Position): number {
    const midPoint = Math.trunc(this.getWidth() / 2);
    const relativePosition = this._camera.convertMapToScreen(pos);
    const offset = this._camera.getMapOffset();
    relativePosition.x = Math.max(-midPoint, Math.min(midPoint, (relativePosition.x + offset.x) - midPoint));
    return 360 + Math.trunc(relativePosition.x / (midPoint / 80.0));
  }

  resetCameraSmoothing(): void {
    this._smoothingEngaged = false;
  }

  setProjectile(projectile: Projectile | null): void {
    this._projectile = projectile;
    if (projectile && Options.battleSmoothCamera) {
      this._launch = true;
    }
    this.invalidate();
  }

  getProjectile(): Projectile | null {
    return this._projectile;
  }

  getExplosions(): Explosion[] {
    return this._explosions;
  }

  setBlastFlash(flash: boolean): void {
    this._flashScreen = flash;
    this.invalidate();
  }

  getBlastFlash(): boolean {
    return this._flashScreen;
  }

  cacheUnit(unit: BattleUnit | unknown): void {
    const battleUnit = unit as BattleUnit | null;
    const armor = battleUnit?.getArmor?.();
    if (!battleUnit || !armor) {
      this.invalidate();
      return;
    }

    const unitSurface = this._mod?.getSurfaceSet(armor.getSpriteSheet()) || null;
    if (!unitSurface) {
      this.invalidate();
      return;
    }
    if (!battleUnit.isCacheInvalid()) {
      this.invalidate();
      return;
    }

    const unitSprite = new UnitSprite(this._spriteWidth * 2, this._spriteHeight, 0, 0, this._save.getDepth?.() !== 0);
    unitSprite.setPalette(this.getPalette());
    unitSprite.setSurfaces(
      unitSurface,
      this._mod?.getSurfaceSet("HANDOB.PCK") || null,
      this._mod?.getSurfaceSet("HANDOB2.PCK") || this._mod?.getSurfaceSet("HANDOB.PCK") || null
    );

    const numOfParts = armor.getSize() * armor.getSize();
    for (let i = 0; i < numOfParts; ++i) {
      const cache = battleUnit.getCache(i) || new Surface(this._spriteWidth * 2, this._spriteHeight);
      cache.setPalette(this.getPalette());
      unitSprite.setBattleUnit(battleUnit, i);
      unitSprite.setAnimationFrame(this._animFrame);
      cache.clear();
      unitSprite.draw();
      cache.copy(unitSprite);
      battleUnit.setCache(cache, i);
    }
    this.invalidate();
  }

  cacheUnits(): void {
    for (const unit of this._save.getUnits()) {
      this.cacheUnit(unit);
    }
    this.invalidate();
  }

  resetObstacles(): void {
    for (const tile of this._save.getTiles()) {
      tile.resetObstacle();
    }
    this._showObstacles = false;
    this.invalidate();
  }

  enableObstacles(): void {
    this._showObstacles = true;
    this._obstacleTimer.stop();
    this._obstacleTimer.start();
    this.invalidate();
  }

  disableObstacles(): void {
    this._showObstacles = false;
    this._obstacleTimer.stop();
    this.invalidate();
  }

  private drawTerrain(): void {
    const offset = this._camera.getMapOffset();
    const viewLevel = this._camera.getViewLevel();
    const endZ = this._camera.getShowAllLayers() ? this._save.getMapSizeZ() - 1 : viewLevel;
    this.lock();
    for (let z = 0; z <= endZ; ++z) {
      const topLayer = z === endZ;
      for (let x = 0; x < this._save.getMapSizeX(); ++x) {
        for (let y = 0; y < this._save.getMapSizeY(); ++y) {
          const pos = new Position(x, y, z);
          const tile = this._save.getTile(pos);
          if (!tile) {
            continue;
          }
          const screen = this._camera.convertMapToScreen(pos);
          const sx = screen.x + offset.x;
          const sy = screen.y + offset.y;
          if (sx < -this._spriteWidth || sx > this.getWidth() + this._spriteWidth || sy < -this._spriteHeight || sy > this.getHeight() + this._spriteHeight) {
            continue;
          }

          const tileShade = this.isDiscovered(tile, 2) ? tile.getShade?.() ?? 0 : 16;
          let obstacleShade = tileShade;
          if (this._showObstacles && tile.isObstacle?.()) {
            if (tileShade > 7) obstacleShade = 7;
            if (tileShade < 2) obstacleShade = 2;
            obstacleShade += ([0, 1, 2, 1, 0, 1, 2, 1][this._animFrame] * 2 - 2);
          }

          const floorDrawn = this.drawTilePart(tile, TilePart.O_FLOOR, sx, sy, tile.getObstacle?.(TilePart.O_FLOOR) ? obstacleShade : tileShade);
          if (!floorDrawn) {
            const shade = Math.max(0, Math.min(4, 4 - tileShade));
            this.drawTileDiamond(sx, sy, Palette.blockOffset(4) + 3 + shade);
          }
          if (this._showObstacles && tile.isObstacle?.()) {
            this.drawTileDiamond(sx, sy, Palette.blockOffset(3) + 10);
          }

          this.drawCursor(tile, x, y, z, sx, sy, false);

          for (const delta of [new Position(0, -1, 0), new Position(-1, -1, 0), new Position(-1, 0, 0)]) {
            this.drawUnit(this._save.getTile(pos.add(delta)), tile, new Position(sx, sy, 0), tileShade, obstacleShade, topLayer);
          }

          if (!(tile.isVoid?.() ?? false)) {
            const westWall = tile.getMapData?.(TilePart.O_WESTWALL) || null;
            if (westWall) {
              const wallShade = (westWall.isDoor?.() || westWall.isUFODoor?.()) && this.isDiscovered(tile, 0) ? tile.getShade?.() ?? tileShade : tileShade;
              this.drawTilePart(tile, TilePart.O_WESTWALL, sx, sy, tile.getObstacle?.(TilePart.O_WESTWALL) ? obstacleShade : wallShade);
            }
            const northWall = tile.getMapData?.(TilePart.O_NORTHWALL) || null;
            if (northWall) {
              const wallShade = (northWall.isDoor?.() || northWall.isUFODoor?.()) && this.isDiscovered(tile, 1) ? tile.getShade?.() ?? tileShade : tileShade;
              this.drawTilePart(tile, TilePart.O_NORTHWALL, sx, sy, tile.getObstacle?.(TilePart.O_NORTHWALL) ? obstacleShade : wallShade, Boolean(westWall));
            }
            const object = tile.getMapData?.(TilePart.O_OBJECT) || null;
            if (object && (object.getBigWall() < 6 || object.getBigWall() === 9)) {
              this.drawTilePart(tile, TilePart.O_OBJECT, sx, sy, tile.getObstacle?.(TilePart.O_OBJECT) ? obstacleShade : tileShade);
            }
            this.drawGroundItem(tile, sx, sy, tileShade);
          }

          this.drawUnit(tile, tile, new Position(sx, sy, 0), tileShade, obstacleShade, topLayer);

          for (const delta of [new Position(-1, 1, 0), new Position(0, 1, 0), new Position(1, 1, 0), new Position(1, 0, 0), new Position(1, -1, 0)]) {
            this.drawUnit(this._save.getTile(pos.add(delta)), tile, new Position(sx, sy, 0), tileShade, obstacleShade, topLayer);
          }

          this.drawSmokeAndFire(tile, sx, sy, tileShade);

          const object = tile.getMapData?.(TilePart.O_OBJECT) || null;
          if (object && object.getBigWall() >= 6 && object.getBigWall() !== 9) {
            this.drawTilePart(tile, TilePart.O_OBJECT, sx, sy, tile.getObstacle?.(TilePart.O_OBJECT) ? obstacleShade : tileShade);
          }

          this.drawCursor(tile, x, y, z, sx, sy, true);

          if ((tile.getMarkerColor?.() ?? 0) > 0) {
            this.drawTileDiamond(sx, sy, Palette.blockOffset(tile.getMarkerColor()) + 10);
          }
          if ((tile.getPreview?.() ?? -1) >= 0) {
            this.drawPreviewMarker(sx, sy, tile.getPreview(), tile.getMarkerColor?.() || PathPreviewColor.YELLOW);
          }
        }
      }
    }
    this.drawProjectile();
    this.unlock();
    if (this._flashScreen) {
      this.applyBlastFlash();
    } else {
      this.drawExplosions();
    }
  }

  private drawTilePart(tile: Tile, part: TilePart, sx: number, sy: number, shade: number, half = false): boolean {
    const sprite = tile.getSprite?.(part) || null;
    if (!sprite) {
      return false;
    }
    const yOffset = tile.getMapData?.(part)?.getYOffset?.() || 0;
    sprite.blitNShade(this, sx, sy - yOffset, shade, half);
    return true;
  }

  private drawGroundItem(tile: Tile, sx: number, sy: number, shade: number): void {
    const sprite = tile.getTopItemSprite?.() ?? -1;
    if (sprite === -1) {
      return;
    }
    this._mod?.getSurfaceSet("FLOOROB.PCK")?.getFrame(sprite)?.blitNShade(this, sx, sy + (tile.getTerrainLevel?.() || 0), shade);
  }

  private drawSmokeAndFire(tile: Tile, sx: number, sy: number, tileShade: number): void {
    if (!(tile.getSmoke?.() || 0) || !this.isDiscovered(tile, 2)) {
      return;
    }
    let frameNumber = 0;
    let shade = 0;
    if (!(tile.getFire?.() || 0)) {
      frameNumber += (this._save.getDepth?.() || 0) > 0 ? Mod.UNDERWATER_SMOKE_OFFSET : Mod.SMOKE_OFFSET;
      frameNumber += Math.trunc(Math.floor(((tile.getSmoke?.() || 0) / 6.0) - 0.1));
      shade = tileShade;
    }
    const animOffset = Math.trunc(this._animFrame / 2) + (tile.getAnimationOffset?.() || 0);
    frameNumber += animOffset > 3 ? animOffset - 4 : animOffset;
    this._mod?.getSurfaceSet("SMOKE.PCK")?.getFrame(frameNumber)?.blitNShade(this, sx, sy, shade);
  }

  private drawCursor(tile: Tile, itX: number, itY: number, itZ: number, sx: number, sy: number, front: boolean): void {
    if (this._cursorType === CursorType.CT_NONE ||
      this._selectorX <= itX - this._cursorSize ||
      this._selectorY <= itY - this._cursorSize ||
      this._selectorX >= itX + 1 ||
      this._selectorY >= itY + 1 ||
      (this._save.getBattleState?.()?.getMouseOverIcons?.() ?? false)) {
      return;
    }
    let frameNumber = -1;
    const unit = tile.getUnit?.() || null;
    const visibleUnit = unit && (unit.getVisible?.() || this._save.getDebugMode?.());
    if (this._camera.getViewLevel() === itZ) {
      if (this._cursorType !== CursorType.CT_AIM) {
        frameNumber = visibleUnit ? (front ? 3 : 0) + (this._animFrame % 2) : (front ? 3 : 0);
      } else {
        frameNumber = visibleUnit ? 7 + Math.trunc(this._animFrame / 2) : 6;
      }
    } else if (!front && this._camera.getViewLevel() > itZ) {
      frameNumber = 2;
    }
    if (frameNumber >= 0) {
      this._mod?.getSurfaceSet("CURSOR.PCK")?.getFrame(frameNumber)?.blitNShade(this, sx, sy, 0);
    }
  }

  private drawUnit(unitTile: Tile | null, currTile: Tile, currTileScreenPosition: Position, shade: number, obstacleShade: number, topLayer: boolean): void {
    if (!unitTile) {
      return;
    }
    let unit = unitTile.getUnit?.() || null;
    let unitFromBelow = false;
    if (!unit) {
      if (!unitTile.getPosition) {
        return;
      }
      const below = this._save.getTile(unitTile.getPosition().add(new Position(0, 0, -1)));
      if (below && unitTile.hasNoFloor?.(below)) {
        unit = below.getUnit?.() || null;
        unitFromBelow = Boolean(unit);
      }
      if (!unit) {
        return;
      }
    }
    if (!(unit.getVisible?.() || this._save.getDebugMode?.())) {
      return;
    }

    const unitOffset = unitTile.getPosition().subtract(unit.getPosition());
    const part = unitOffset.x + unitOffset.y * 2;
    let tmpSurface = unit.getCache?.(part) || null;
    if (!tmpSurface && unit.isCacheInvalid?.()) {
      this.cacheUnit(unit);
      tmpSurface = unit.getCache?.(part) || null;
    }

    const moving = unit.getStatus?.() === UnitStatus.STATUS_WALKING || unit.getStatus?.() === UnitStatus.STATUS_FLYING;
    if (moving) {
      const direction = unit.getDirection();
      const partCurr = currTile.getPosition();
      const partDest = unit.getDestination().add(unitOffset);
      const partLast = unit.getLastPosition().add(unitOffset);
      const isTileDestPos = this.positionHaveSameXY(partDest, partCurr);
      const isTileLastPos = this.positionHaveSameXY(partLast, partCurr);
      if (this.positionHaveSameXY(partLast, partDest)) {
        if (currTile !== unitTile) {
          return;
        }
      } else if (isTileDestPos) {
        if (direction === 7) {
          return;
        }
      } else if (isTileLastPos) {
        if (direction === 3) {
          return;
        }
      } else {
        const leftPos = partCurr.add(new Position(-1, 0, 0));
        const rightPos = partCurr.add(new Position(0, -1, 0));
        if (!topLayer && (partDest.z > partCurr.z || partLast.z > partCurr.z)) {
          return;
        }
        if (!((direction === 1 && (partDest.equals(rightPos) || partLast.equals(leftPos))) ||
          (direction === 5 && (partDest.equals(leftPos) || partLast.equals(rightPos))))) {
          return;
        }
      }
    } else if (unitTile !== currTile) {
      return;
    }

    const unitScreenPosition = this._camera.convertMapToScreen(unitTile.getPosition().add(new Position(0, 0, unitFromBelow ? -1 : 0)));
    const mapOffset = this._camera.getMapOffset();
    const walking = this.calculateWalkingOffset(unit);
    const tileShade = this.isDiscovered(currTile, 2) ? currTile.getShade?.() ?? 0 : 16;
    let unitShade = Math.trunc((tileShade * (16 - walking.shadeOffset) + shade * walking.shadeOffset) / 16);
    if (!moving && unitTile.getObstacle?.(4)) {
      unitShade = obstacleShade;
    }

    if (tmpSurface) {
      tmpSurface.blitNShade(
        this,
        unitScreenPosition.x + mapOffset.x + walking.offset.x - Math.trunc(this._spriteWidth / 2),
        unitScreenPosition.y + mapOffset.y + walking.offset.y,
        unitShade
      );
    } else if (unitTile === currTile) {
      this.drawUnitMarker(currTileScreenPosition.x, currTileScreenPosition.y, unit.getFaction(), unit === this._save.getSelectedUnit?.());
    }

    if ((unit.getFire?.() || 0) > 0) {
      const fireFrame = 4 + Math.trunc(this._animFrame / 2);
      this._mod?.getSurfaceSet("SMOKE.PCK")?.getFrame(fireFrame)?.blitNShade(
        this,
        unitScreenPosition.x + mapOffset.x + walking.offset.x,
        unitScreenPosition.y + mapOffset.y + walking.offset.y,
        0
      );
    }

    const breathFrame = unit.getBreathFrame?.() || 0;
    if (breathFrame > 0) {
      const breath = this._mod?.getSurfaceSet("BREATH-1.PCK")?.getFrame(breathFrame - 1) || null;
      breath?.blitNShade(
        this,
        unitScreenPosition.x + mapOffset.x + walking.offset.x,
        unitScreenPosition.y + mapOffset.y + walking.offset.y + (22 - (unit.getHeight?.() || 22)) - 30,
        tileShade
      );
    }
  }

  private calculateWalkingOffset(unit: BattleUnit): { offset: Position; shadeOffset: number } {
    const offset = new Position();
    const offsetX = [1, 1, 1, 0, -1, -1, -1, 0];
    const offsetY = [1, 0, -1, -1, -1, 0, 1, 1];
    const phase = unit.getWalkingPhase() + (unit.getDiagonalWalkingPhase?.() || 0);
    const dir = unit.getDirection();
    let midphase = 4 + 4 * (dir % 2);
    const endphase = 8 + 8 * (dir % 2);
    const size = unit.getArmor().getSize();
    const shadeOffset = endphase === 16 ? phase : phase * 2;

    if (size > 1) {
      if (dir < 1 || dir > 5) midphase = endphase;
      else if (dir === 5) midphase = 12;
      else if (dir === 1) midphase = 5;
      else midphase = 1;
    }
    if (unit.getVerticalDirection()) {
      midphase = 4;
    } else if (unit.getStatus() === UnitStatus.STATUS_WALKING || unit.getStatus() === UnitStatus.STATUS_FLYING) {
      if (phase < midphase) {
        offset.x = phase * 2 * offsetX[dir];
        offset.y = -phase * offsetY[dir];
      } else {
        offset.x = (phase - endphase) * 2 * offsetX[dir];
        offset.y = -(phase - endphase) * offsetY[dir];
      }
    }

    if (unit.getStatus() === UnitStatus.STATUS_WALKING || unit.getStatus() === UnitStatus.STATUS_FLYING) {
      if (phase < midphase) {
        let fromLevel = this.getTerrainLevel(unit.getPosition(), size);
        let toLevel = this.getTerrainLevel(unit.getDestination(), size);
        if (unit.getPosition().z > unit.getDestination().z) {
          toLevel += 24 * (unit.getPosition().z - unit.getDestination().z);
        } else if (unit.getPosition().z < unit.getDestination().z) {
          toLevel = -24 * (unit.getDestination().z - unit.getPosition().z) + Math.abs(toLevel);
        }
        offset.y += Math.trunc((fromLevel * (endphase - phase)) / endphase) + Math.trunc((toLevel * phase) / endphase);
      } else {
        let fromLevel = this.getTerrainLevel(unit.getLastPosition(), size);
        let toLevel = this.getTerrainLevel(unit.getDestination(), size);
        if (unit.getLastPosition().z > unit.getDestination().z) {
          fromLevel -= 24 * (unit.getLastPosition().z - unit.getDestination().z);
        } else if (unit.getLastPosition().z < unit.getDestination().z) {
          fromLevel = 24 * (unit.getDestination().z - unit.getLastPosition().z) - Math.abs(fromLevel);
        }
        offset.y += Math.trunc((fromLevel * (endphase - phase)) / endphase) + Math.trunc((toLevel * phase) / endphase);
      }
    } else {
      offset.y += this.getTerrainLevel(unit.getPosition(), size);
      if ((this._save.getDepth?.() || 0) > 0) {
        unit.setFloorAbove(false);
        if (this._camera.getViewLevel() > unit.getPosition().z) {
          for (let z = Math.min(this._camera.getViewLevel(), this._save.getMapSizeZ() - 1); z !== unit.getPosition().z; --z) {
            if (!this._save.getTile(new Position(unit.getPosition().x, unit.getPosition().y, z))?.hasNoFloor?.(null)) {
              unit.setFloorAbove(true);
              break;
            }
          }
        }
      }
    }
    return { offset, shadeOffset };
  }

  private getTerrainLevel(pos: Position, size: number): number {
    let lowestLevel = 0;
    for (let x = 0; x < size; ++x) {
      for (let y = 0; y < size; ++y) {
        const level = this._save.getTile(pos.add(new Position(x, y, 0)))?.getTerrainLevel?.() ?? 0;
        if (level < lowestLevel) {
          lowestLevel = level;
        }
      }
    }
    return lowestLevel;
  }

  private positionHaveSameXY(a: Position, b: Position): boolean {
    return a.x === b.x && a.y === b.y;
  }

  private isDiscovered(tile: Tile, part: number): boolean {
    return tile.isDiscovered?.(part) ?? true;
  }

  private applyBlastFlash(): void {
    for (let y = 0; y < this.getHeight(); ++y) {
      for (let x = 0; x < this.getWidth(); ++x) {
        const pixel = this.getPixel(x, y);
        this.setPixel(x, y, Math.trunc(pixel / 16) * 16);
      }
    }
    this._flashScreen = false;
  }

  private drawUnitMarker(sx: number, sy: number, faction: UnitFaction, selected: boolean): void {
    const cx = sx;
    const footY = sy + Math.trunc(this._spriteWidth / 4);
    const color = faction === UnitFaction.FACTION_PLAYER
      ? Palette.blockOffset(5) + 11
      : faction === UnitFaction.FACTION_HOSTILE
        ? Palette.blockOffset(2) + 11
        : Palette.blockOffset(10) + 11;
    const outline = selected ? Palette.blockOffset(13) + 15 : Palette.blockOffset(0) + 4;
    this.drawRect(cx - 3, footY - 14, 7, 5, outline);
    this.drawRect(cx - 2, footY - 13, 5, 3, color);
    this.drawRect(cx - 4, footY - 9, 9, 8, outline);
    this.drawRect(cx - 3, footY - 8, 7, 6, color);
    this.drawLine(cx - 3, footY - 1, cx - 5, footY + 4, outline);
    this.drawLine(cx + 3, footY - 1, cx + 5, footY + 4, outline);
  }

  private drawProjectile(): void {
    if (!this._projectile) {
      return;
    }
    const current = this._projectile.getPosition();
    const screen = this._camera.convertVoxelToScreen(current);
    if (screen.x < -16 || screen.x > this.getWidth() + 16 || screen.y < -16 || screen.y > this.getHeight() + 16) {
      return;
    }

    if (this._projectile.getItem()) {
      const sprite = this._projectile.getSprite();
      if (sprite) {
        sprite.blitNShade(this, screen.x - 16, screen.y - 26, 0);
        return;
      }
      const color = Palette.blockOffset(10) + 14;
      this.drawRect(screen.x - 2, screen.y - 2, 5, 5, Palette.blockOffset(0) + 4);
      this.drawRect(screen.x - 1, screen.y - 1, 3, 3, color);
      return;
    }

    const projectileSet = this._mod?.getSurfaceSet((this._save.getDepth?.() || 0) > 0 ? "UnderwaterProjectiles" : "Projectiles") || null;
    const particle = projectileSet?.getFrame(this._projectile.getParticle(0)) || null;
    if (particle) {
      particle.blitNShade(this, screen.x - Math.trunc(particle.getWidth() / 2), screen.y - Math.trunc(particle.getHeight() / 2), 0);
      return;
    }

    const color = Palette.blockOffset(15) + 12;
    const prev = this._camera.convertVoxelToScreen(this._projectile.getPosition(-1));
    const next = this._camera.convertVoxelToScreen(this._projectile.getPosition(1));
    this.drawLine(prev.x, prev.y, next.x, next.y, color);
    this.drawRect(screen.x - 1, screen.y - 1, 3, 3, color);
  }

  private drawExplosions(): void {
    for (const explosion of this._explosions) {
      const frame = explosion.getCurrentFrame();
      if (frame < 0) {
        continue;
      }
      const screen = this._camera.convertVoxelToScreen(explosion.getPosition());
      if (screen.x < -32 || screen.x > this.getWidth() + 32 || screen.y < -32 || screen.y > this.getHeight() + 32) {
        continue;
      }

      if (explosion.isBig()) {
        const sprite = this._mod?.getSurfaceSet("X1.PCK")?.getFrame(frame) || null;
        if (sprite) {
          sprite.blitNShade(this, screen.x - Math.trunc(sprite.getWidth() / 2), screen.y - Math.trunc(sprite.getHeight() / 2), 0);
          continue;
        }
        const frameIndex = frame % Explosion.EXPLODE_FRAMES;
        const radius = 3 + frameIndex * 2;
        const color = frameIndex < 3 ? Palette.blockOffset(15) + 12 : Palette.blockOffset(2) + 11;
        this.drawCircle(screen.x, screen.y, radius, color);
        this.drawCircle(screen.x, screen.y, Math.max(1, Math.trunc(radius / 2)), Palette.blockOffset(13) + 12);
      } else if (explosion.isHit()) {
        const sprite = this._mod?.getSurfaceSet("HIT.PCK")?.getFrame(frame) || null;
        if (sprite) {
          sprite.blitNShade(this, screen.x - 15, screen.y - 25, 0);
          continue;
        }
        const size = 8 - Math.min(4, frame % Explosion.HIT_FRAMES);
        this.drawRect(screen.x - Math.trunc(size / 2), screen.y - Math.trunc(size / 2), size, size, Palette.blockOffset(2) + 12);
        this.drawLine(screen.x - size, screen.y, screen.x + size, screen.y, Palette.blockOffset(15) + 10);
        this.drawLine(screen.x, screen.y - size, screen.x, screen.y + size, Palette.blockOffset(15) + 10);
      } else {
        const sprite = this._mod?.getSurfaceSet("SMOKE.PCK")?.getFrame(frame) || null;
        if (sprite) {
          sprite.blitNShade(this, screen.x - 15, screen.y - 15, 0);
          continue;
        }
        const step = Math.min(5, frame % Explosion.BULLET_FRAMES);
        this.drawRect(screen.x - 1 - step, screen.y - 1, 3 + step * 2, 3, Palette.blockOffset(15) + 11);
        this.drawRect(screen.x - 1, screen.y - 1 - step, 3, 3 + step * 2, Palette.blockOffset(2) + 13);
      }
    }
  }

  private drawTileDiamond(sx: number, sy: number, color: number, fill = true): void {
    const halfW = Math.trunc(this._spriteWidth / 2);
    const quarterW = Math.trunc(this._spriteWidth / 4);
    const xs = [sx, sx + halfW, sx, sx - halfW];
    const ys = [sy, sy + quarterW, sy + halfW, sy + quarterW];
    if (fill) {
      this.drawPolygon(xs, ys, 4, color);
    }
    this.drawLine(xs[0], ys[0], xs[1], ys[1], color);
    this.drawLine(xs[1], ys[1], xs[2], ys[2], color);
    this.drawLine(xs[2], ys[2], xs[3], ys[3], color);
    this.drawLine(xs[3], ys[3], xs[0], ys[0], color);
  }

  private drawPreviewMarker(sx: number, sy: number, preview: number, markerColor: number): void {
    const color = Palette.blockOffset(markerColor) + 15;
    const cx = sx;
    const cy = sy + Math.trunc(this._spriteWidth / 4);
    if (preview === 10) {
      this.drawRect(cx - 2, cy - 2, 5, 5, color);
      return;
    }
    const vectors = [
      [0, -5], [5, -3], [6, 0], [5, 3], [0, 5], [-5, 3], [-6, 0], [-5, -3], [0, -7], [0, 7]
    ];
    const vector = vectors[preview] || [0, 0];
    this.drawLine(cx, cy, cx + vector[0], cy + vector[1], color);
    this.drawLine(cx + vector[0], cy + vector[1], cx + Math.trunc(vector[0] / 2), cy + Math.trunc(vector[1] / 2), color);
  }
}

enum PathPreviewColor {
  YELLOW = 10
}
