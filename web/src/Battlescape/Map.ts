import { InteractiveSurface } from "../Engine/InteractiveSurface.ts";
import { GraphSubset } from "../Engine/GraphSubset.ts";
import { Options, PATH_ARROWS, PATH_FULL, PATH_TU_COST } from "../Engine/Options.ts";
import { Palette } from "../Engine/Palette.ts";
import { Surface } from "../Engine/Surface.ts";
import { Timer } from "../Engine/Timer.ts";
import { formatPercentage } from "../Engine/Unicode.ts";
import { NumberText } from "../Interface/NumberText.ts";
import { Text } from "../Interface/Text.ts";
import type { Action } from "../Engine/Action.ts";
import type { Language } from "../Engine/Language.ts";
import type { State } from "../Engine/State.ts";
import { Mod } from "../Mod/Mod.ts";
import { TilePart } from "../Mod/MapData.ts";
import { UnitFaction, UnitStatus, type BattleUnit } from "../Savegame/BattleUnit.ts";
import { SavedBattleGame } from "../Savegame/SavedBattleGame.ts";
import type { Tile } from "../Savegame/Tile.ts";
import { Camera } from "./Camera.ts";
import { BattleActionType } from "./BattleAction.ts";
import { Explosion } from "./Explosion.ts";
import { Pathfinding } from "./Pathfinding.ts";
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
  getLanguage?: () => Language | null;
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
  private _arrow: Surface;
  private _txtAccuracy = new Text(24, 9, 0, 0);
  private _waypoints: Position[] = [];
  private _unitDying = false;
  private _projectileInFOV = false;
  private _explosionInFOV = false;
  private _flashScreen = false;
  private _launch = false;
  private _smoothingEngaged = false;
  private _iconHeight = 0;
  private _iconWidth = 0;
  private _messageColor = Palette.blockOffset(1);
  private _previewSetting = Options.battleNewPreviewPath;
  private _transparencies: number[] | null = null;
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
    this._arrow = this.createSelectedUnitArrow();
    this._spriteWidth = spriteWidth;
    this._spriteHeight = spriteHeight;
    this._visibleMapHeight = visibleMapHeight;
    const battlescapeInterface = this._mod?.getInterface?.("battlescape") || null;
    this._iconHeight = battlescapeInterface?.getElement("icons")?.h || 0;
    this._iconWidth = battlescapeInterface?.getElement("icons")?.w || 0;
    this._messageColor = battlescapeInterface?.getElement("messageWindows")?.color ?? this._messageColor;
    this._previewSetting = Options.traceAI ? PATH_FULL : Options.battleNewPreviewPath;
    this._transparencies = this._mod?.getLUTs?.()?.[this._save.getDepth?.() || 0] || null;
    this._txtAccuracy.setSmall();
    this._txtAccuracy.setPalette(this.getPalette());
    this._txtAccuracy.setHighContrast(true);
    this._txtAccuracy.initText(
      this._mod?.getFont?.("FONT_BIG") || null,
      this._mod?.getFont?.("FONT_SMALL") || null,
      gameOrSave instanceof SavedBattleGame ? null : gameOrSave.getLanguage?.() || null
    );
    this._camera = new Camera(this._spriteWidth, this._spriteHeight, this._save.getMapSizeX(), this._save.getMapSizeY(), this._save.getMapSizeZ(), this, visibleMapHeight);
    this._scrollMouseTimer.onSurfaceTimer(this.scrollMouse.bind(this));
    this._scrollKeyTimer.onSurfaceTimer(this.scrollKey.bind(this));
    this._camera.setScrollTimer(this._scrollMouseTimer, this._scrollKeyTimer);
    this._obstacleTimer.stop();
    this._obstacleTimer.onSurfaceTimer(this.disableObstacles.bind(this));
    this._camera.centerOnPosition(new Position(Math.trunc(this._save.getMapSizeX() / 2), Math.trunc(this._save.getMapSizeY() / 2), 0), false);
    this.invalidate();
  }

  override initText(big?: unknown, small?: unknown, lang?: unknown): void {
    super.initText(big, small, lang);
    this._txtAccuracy.setPalette(this.getPalette());
    this._txtAccuracy.initText(big, small, lang);
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
    this.updateProjectileVisibility();
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
    this._cursorSize = type === CursorType.CT_NORMAL ? size : 1;
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
    const viewLevel = this._camera.getViewLevel();
    const endZ = this._camera.getShowAllLayers() ? this._save.getMapSizeZ() - 1 : viewLevel;
    const projectileBounds = this.calculateProjectileBounds();
    this.updateProjectileCamera(projectileBounds);
    const offset = this._camera.getMapOffset();
    const pathfinderTurnedOn = this._save.getPathfinding?.()?.isPathPreviewed?.() ?? false;
    const numWaypid = (!this._waypoints.length && !(pathfinderTurnedOn && (this._previewSetting & PATH_TU_COST)))
      ? null
      : this.createNumberOverlay(pathfinderTurnedOn);
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

          this.drawProjectileOnTile(x, y, z, projectileBounds);
          this.drawUnit(tile, tile, new Position(sx, sy, 0), tileShade, obstacleShade, topLayer);

          for (const delta of [new Position(-1, 1, 0), new Position(0, 1, 0), new Position(1, 1, 0), new Position(1, 0, 0), new Position(1, -1, 0)]) {
            this.drawUnit(this._save.getTile(pos.add(delta)), tile, new Position(sx, sy, 0), tileShade, obstacleShade, topLayer);
          }

          this.drawSmokeAndFire(tile, sx, sy, tileShade);
          this.drawParticleCloud(tile, sx, sy);
          this.drawPathPreviewBase(tile, pos, sx, sy);

          const object = tile.getMapData?.(TilePart.O_OBJECT) || null;
          if (object && object.getBigWall() >= 6 && object.getBigWall() !== 9) {
            this.drawTilePart(tile, TilePart.O_OBJECT, sx, sy, tile.getObstacle?.(TilePart.O_OBJECT) ? obstacleShade : tileShade);
          }

          this.drawCursor(tile, x, y, z, sx, sy, true);
          this.drawWaypointsOnTile(pos, sx, sy, numWaypid);
        }
      }
    }
    this.drawPathfindingOverlays(numWaypid, pathfinderTurnedOn);
    this.drawSelectedUnitArrow();
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

  private createSelectedUnitArrow(): Surface {
    const f = Palette.blockOffset(1);
    const b = 15;
    const pixels = [
      0, 0, b, b, b, b, b, 0, 0,
      0, 0, b, f, f, f, b, 0, 0,
      0, 0, b, f, f, f, b, 0, 0,
      b, b, b, f, f, f, b, b, b,
      b, f, f, f, f, f, f, f, b,
      0, b, f, f, f, f, f, b, 0,
      0, 0, b, f, f, f, b, 0, 0,
      0, 0, 0, b, f, b, 0, 0, 0,
      0, 0, 0, 0, b, 0, 0, 0, 0
    ];
    const arrow = new Surface(9, 9);
    arrow.setPalette(this.getPalette());
    for (let y = 0; y < 9; ++y) {
      for (let x = 0; x < 9; ++x) {
        arrow.setPixel(x, y, pixels[x + y * 9]);
      }
    }
    return arrow;
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

  private createNumberOverlay(pathfinderTurnedOn: boolean): NumberText {
    const number = new NumberText(15, 15, 20, 30);
    number.setPalette(this.getPalette());
    number.setColor(pathfinderTurnedOn ? this._messageColor + 1 : Palette.blockOffset(1));
    return number;
  }

  private drawParticleCloud(tile: Tile, sx: number, sy: number): void {
    const particles = tile.getParticleCloud?.() || [];
    if (!particles.length || !this._transparencies) {
      return;
    }
    for (const particle of particles) {
      const color = particle.getColor();
      const opacity = particle.getOpacity();
      if (this._transparencies.length < (color + 1) * 1024) {
        continue;
      }
      const vaporX = Math.trunc(sx + particle.getX());
      const vaporY = Math.trunc(sy + particle.getY());
      switch (particle.getSize()) {
        case 3:
          this.applyParticlePixel(vaporX + 1, vaporY + 1, color, opacity);
        case 2:
          this.applyParticlePixel(vaporX + 1, vaporY, color, opacity);
        case 1:
          this.applyParticlePixel(vaporX, vaporY + 1, color, opacity);
        default:
          this.applyParticlePixel(vaporX, vaporY, color, opacity);
          break;
      }
    }
  }

  private applyParticlePixel(x: number, y: number, color: number, opacity: number): void {
    if (!this._transparencies) {
      return;
    }
    const index = color * 1024 + opacity * 256 + this.getPixel(x, y);
    const replacement = this._transparencies[index];
    if (replacement != null) {
      this.setPixel(x, y, replacement);
    }
  }

  private drawPathPreviewBase(tile: Tile, pos: Position, sx: number, sy: number): void {
    if ((tile.getPreview?.() ?? -1) === -1 || !this.isDiscovered(tile, 0) || !(this._previewSetting & PATH_ARROWS)) {
      return;
    }
    const pathfinding = this._mod?.getSurfaceSet("Pathfinding") || null;
    if (pos.z > 0 && tile.hasNoFloor?.(this._save.getTile(pos.add(new Position(0, 0, -1))))) {
      pathfinding?.getFrame(11)?.blitNShade(this, sx, sy + 2, 0, false, tile.getMarkerColor?.() || 0);
    }
    pathfinding?.getFrame(tile.getPreview())?.blitNShade(this, sx, sy + (tile.getTerrainLevel?.() || 0), 0, false, tile.getMarkerColor?.() || 0);
  }

  private drawWaypointsOnTile(pos: Position, sx: number, sy: number, numWaypid: NumberText | null): void {
    let waypid = 1;
    let waypXOff = 2;
    let waypYOff = 2;
    const currentAction = this._save.getBattleGame?.()?.getCurrentAction?.() || null;
    for (const waypoint of this._waypoints) {
      if (waypoint.equals(pos)) {
        if (waypXOff === 2 && waypYOff === 2) {
          this._mod?.getSurfaceSet("CURSOR.PCK")?.getFrame(7)?.blitNShade(this, sx, sy, 0);
        }
        if (numWaypid && currentAction?.type === BattleActionType.BA_LAUNCH) {
          numWaypid.setValue(waypid);
          numWaypid.draw();
          numWaypid.blitNShade(this, sx + waypXOff, sy + waypYOff, 0);
          waypXOff += waypid > 9 ? 8 : 6;
          if (waypXOff >= 26) {
            waypXOff = 2;
            waypYOff += 8;
          }
        }
      }
      ++waypid;
    }
  }

  private drawPathfindingOverlays(numWaypid: NumberText | null, pathfinderTurnedOn: boolean): void {
    if (!pathfinderTurnedOn) {
      return;
    }
    numWaypid?.setBordered(true);
    const offset = this._camera.getMapOffset();
    const endZ = this._camera.getShowAllLayers() ? this._save.getMapSizeZ() - 1 : this._camera.getViewLevel();
    const pathfinding = this._mod?.getSurfaceSet("Pathfinding") || null;
    for (let z = 0; z <= endZ; ++z) {
      for (let x = 0; x < this._save.getMapSizeX(); ++x) {
        for (let y = 0; y < this._save.getMapSizeY(); ++y) {
          const pos = new Position(x, y, z);
          const screen = this._camera.convertMapToScreen(pos);
          const sx = screen.x + offset.x;
          const sy = screen.y + offset.y;
          if (sx < -this._spriteWidth || sx > this.getWidth() + this._spriteWidth || sy < -this._spriteHeight || sy > this.getHeight() + this._spriteHeight) {
            continue;
          }
          const tile = this._save.getTile(pos);
          if (!tile || !this.isDiscovered(tile, 0) || (tile.getPreview?.() ?? -1) === -1) {
            continue;
          }
          let adjustment = -(tile.getTerrainLevel?.() || 0);
          const markerColor = tile.getMarkerColor?.() || 0;
          const tileBelow = this._save.getTile(pos.add(new Position(0, 0, -1)));
          if (this._previewSetting & PATH_ARROWS) {
            if (z > 0 && tile.hasNoFloor?.(tileBelow)) {
              pathfinding?.getFrame(23)?.blitNShade(this, sx, sy + 2, 0, false, markerColor);
            }
            pathfinding?.getFrame((tile.getPreview?.() ?? 0) + 12)?.blitNShade(this, sx, sy - adjustment, 0, false, markerColor);
          }
          if (numWaypid && (this._previewSetting & PATH_TU_COST) && (tile.getTUMarker?.() ?? -1) > -1) {
            const tu = tile.getTUMarker();
            const off = tu > 9 ? 5 : 3;
            if ((this._save.getSelectedUnit?.()?.getArmor?.()?.getSize?.() ?? 0) > 1) {
              adjustment += 1;
              if (!(this._previewSetting & PATH_ARROWS)) {
                adjustment += 7;
              }
            }
            numWaypid.setValue(tu);
            numWaypid.draw();
            if (!(this._previewSetting & PATH_ARROWS)) {
              numWaypid.blitNShade(this, sx + 16 - off, sy + (29 - adjustment), 0, false, markerColor);
            } else {
              numWaypid.blitNShade(this, sx + 16 - off, sy + (22 - adjustment), 0);
            }
          }
        }
      }
    }
    numWaypid?.setBordered(false);
  }

  private drawSelectedUnitArrow(): void {
    const unit = this._save.getSelectedUnit?.() || null;
    if (!unit || !((this._save.getSide?.() === UnitFaction.FACTION_PLAYER) || this._save.getDebugMode?.()) || unit.getPosition().z > this._camera.getViewLevel()) {
      return;
    }
    const screen = this._camera.convertMapToScreen(unit.getPosition()).add(this._camera.getMapOffset());
    const walking = this.calculateWalkingOffset(unit);
    const offset = walking.offset.clone();
    if ((unit.getArmor?.().getSize?.() ?? 0) > 1) {
      offset.y += 4;
    }
    offset.y += 24 - ((unit.getHeight?.() || 22) + (unit.getFloatHeight?.() || 0));
    if (unit.isKneeled?.()) {
      offset.y -= 2;
    }
    if (this.getCursorType() !== CursorType.CT_NONE) {
      this._arrow.blitNShade(
        this,
        screen.x + offset.x + Math.trunc(this._spriteWidth / 2) - Math.trunc(this._arrow.getWidth() / 2),
        screen.y + offset.y - this._arrow.getHeight() + [0, 1, 2, 1, 0, 1, 2, 1][this._animFrame],
        0
      );
    }
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
    } else if (this._camera.getViewLevel() > itZ) {
      frameNumber = front ? 5 : 2;
    }
    if (frameNumber >= 0) {
      this._mod?.getSurfaceSet("CURSOR.PCK")?.getFrame(frameNumber)?.blitNShade(this, sx, sy, 0);
    }
    if (front && this._cursorType === CursorType.CT_AIM && Options.battleUFOExtenderAccuracy && this._camera.getViewLevel() === itZ) {
      this.drawAccuracyText(itX, itY, itZ, sx, sy);
    }
    if (front && this._cursorType > CursorType.CT_AIM && this._camera.getViewLevel() === itZ) {
      const frames = [0, 0, 0, 11, 13, 15];
      this._mod?.getSurfaceSet("CURSOR.PCK")?.getFrame((frames[this._cursorType] || 0) + Math.trunc(this._animFrame / 4))?.blitNShade(this, sx, sy, 0);
    }
  }

  private drawAccuracyText(itX: number, itY: number, itZ: number, sx: number, sy: number): void {
    const action = this._save.getBattleGame?.()?.getCurrentAction?.() || null;
    const actor = action?.actor || null;
    const weapon = action?.weapon || null;
    const rules = weapon?.getRules?.() || null;
    if (!action || !actor || !weapon || !rules) {
      return;
    }

    let accuracy = Math.trunc(actor.getFiringAccuracy?.(action.type, weapon) ?? 0);
    const distanceSq = Math.trunc(this._save.getTileEngine?.()?.distanceUnitToPositionSq?.(actor, new Position(itX, itY, itZ), false) ?? 0);
    const distance = Math.ceil(Math.sqrt(distanceSq));
    let upperLimit = 200;
    const lowerLimit = Math.trunc(rules.getMinRange?.() ?? 0);
    switch (action.type) {
      case BattleActionType.BA_AIMEDSHOT:
        upperLimit = Math.trunc(rules.getAimRange?.() ?? upperLimit);
        break;
      case BattleActionType.BA_SNAPSHOT:
        upperLimit = Math.trunc(rules.getSnapRange?.() ?? upperLimit);
        break;
      case BattleActionType.BA_AUTOSHOT:
        upperLimit = Math.trunc(rules.getAutoRange?.() ?? upperLimit);
        break;
      default:
        break;
    }

    this._txtAccuracy.setColor(Palette.blockOffset(Pathfinding.yellow - 1) - 1);
    const dropoff = Math.trunc(rules.getDropoff?.() ?? 0);
    if (distance > upperLimit) {
      accuracy -= (distance - upperLimit) * dropoff;
    } else if (distance < lowerLimit) {
      accuracy -= (lowerLimit - distance) * dropoff;
    } else {
      this._txtAccuracy.setColor(Palette.blockOffset(Pathfinding.green - 1) - 1);
    }

    let outOfRange = distanceSq > Math.trunc(rules.getMaxRangeSq?.() ?? Number.MAX_SAFE_INTEGER);
    if (outOfRange) {
      const maxRange = Math.trunc(rules.getMaxRange?.() ?? 0);
      if (maxRange === 1 && distanceSq <= 3) {
        outOfRange = false;
      } else if (maxRange === 2 && distanceSq <= 6) {
        outOfRange = false;
      }
    }
    if (accuracy <= 0 || outOfRange) {
      accuracy = 0;
      this._txtAccuracy.setColor(Palette.blockOffset(Pathfinding.red - 1) - 1);
    }
    this._txtAccuracy.setText(formatPercentage(accuracy));
    this._txtAccuracy.draw();
    this._txtAccuracy.blitNShade(this, sx, sy, 0);
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
    const tileFloorWidth = 32;
    const tileFloorHeight = 16;
    const tileHeight = 40;
    const bonusWidth = moving ? 0 : tileFloorWidth;
    let topMargin = 0;
    let bottomMargin = 0;

    if (unitFromBelow) {
      bottomMargin = -Math.trunc(tileFloorHeight / 2);
      topMargin = tileFloorHeight;
    } else if (topLayer) {
      topMargin = 2 * tileFloorHeight;
    } else {
      const top = this._save.getTile(unitTile.getPosition().add(new Position(0, 0, 1)));
      if (top && top.hasNoFloor?.(unitTile)) {
        topMargin = -Math.trunc(tileFloorHeight / 2);
      } else {
        topMargin = tileFloorHeight;
      }
    }

    let mask = new GraphSubset(tileFloorWidth + bonusWidth, tileHeight + topMargin + bottomMargin)
      .offset(currTileScreenPosition.x - Math.trunc(bonusWidth / 2), currTileScreenPosition.y - topMargin);

    if (moving) {
      const leftMask = mask.offset(-Math.trunc(tileFloorWidth / 2), 0);
      const rightMask = mask.offset(Math.trunc(tileFloorWidth / 2), 0);
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
        switch (direction) {
          case 0:
          case 1:
            mask = GraphSubset.intersection(mask, rightMask);
            break;
          case 5:
          case 6:
            mask = GraphSubset.intersection(mask, leftMask);
            break;
          case 7:
            return;
        }
      } else if (isTileLastPos) {
        switch (direction) {
          case 1:
          case 2:
            mask = GraphSubset.intersection(mask, leftMask);
            break;
          case 3:
            return;
          case 4:
          case 5:
            mask = GraphSubset.intersection(mask, rightMask);
            break;
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
        mask = new GraphSubset(tileFloorWidth, tileHeight + 2 * tileFloorHeight).offset(currTileScreenPosition.x, currTileScreenPosition.y - 2 * tileFloorHeight);
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
        unitShade,
        mask
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
        0,
        mask
      );
    }

    const breathFrame = unit.getBreathFrame?.() || 0;
    if (breathFrame > 0) {
      const breath = this._mod?.getSurfaceSet("BREATH-1.PCK")?.getFrame(breathFrame - 1) || null;
      breath?.blitNShade(
        this,
        unitScreenPosition.x + mapOffset.x + walking.offset.x,
        unitScreenPosition.y + mapOffset.y + walking.offset.y + (22 - (unit.getHeight?.() || 22)) - 30,
        tileShade,
        mask
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

  private updateProjectileVisibility(): void {
    this._projectileInFOV = this._save.getDebugMode?.() ?? false;
    if (this._projectile) {
      const voxel = this._projectile.getPosition(0);
      const tile = this._save.getTile(new Position(Math.trunc(voxel.x / 16), Math.trunc(voxel.y / 16), Math.trunc(voxel.z / 24)));
      if (this._save.getSide?.() === UnitFaction.FACTION_PLAYER || (tile && (tile.getVisible?.() || 0) !== 0)) {
        this._projectileInFOV = true;
      }
    }

    this._explosionInFOV = this._save.getDebugMode?.() ?? false;
    for (const explosion of this._explosions) {
      const voxel = explosion.getPosition();
      const tile = this._save.getTile(new Position(Math.trunc(voxel.x / 16), Math.trunc(voxel.y / 16), Math.trunc(voxel.z / 24)));
      if (tile && (explosion.isBig() || (tile.getVisible?.() || 0) !== 0)) {
        this._explosionInFOV = true;
        break;
      }
    }
  }

  private calculateProjectileBounds(): { lowX: number; lowY: number; lowZ: number; highX: number; highY: number; highZ: number } | null {
    if (!this._projectile || this._explosions.length !== 0) {
      return null;
    }
    const part = this._projectile.getItem() ? 0 : Map.BULLET_SPRITES - 1;
    let lowX = 16000;
    let lowY = 16000;
    let lowZ = 16000;
    let highX = 0;
    let highY = 0;
    let highZ = 0;
    for (let i = 0; i <= part; ++i) {
      const pos = this._projectile.getPosition(1 - i);
      if (pos.x < lowX) lowX = pos.x;
      if (pos.y < lowY) lowY = pos.y;
      if (pos.z < lowZ) lowZ = pos.z;
      if (pos.x > highX) highX = pos.x;
      if (pos.y > highY) highY = pos.y;
      if (pos.z > highZ) highZ = pos.z;
    }
    return {
      lowX: Math.trunc(lowX / 16),
      lowY: Math.trunc(lowY / 16),
      lowZ: Math.trunc(lowZ / 24),
      highX: Math.trunc(highX / 16),
      highY: Math.trunc(highY / 16),
      highZ: Math.trunc(highZ / 24)
    };
  }

  private updateProjectileCamera(bounds: { lowX: number; lowY: number; lowZ: number; highX: number; highY: number; highZ: number } | null): void {
    if (!this._projectile || !bounds || !this._projectileInFOV) {
      return;
    }

    let bulletPositionScreen = this._camera.convertVoxelToScreen(this._projectile.getPosition());
    const newCam = this._camera.getMapOffset();
    if (newCam.z !== bounds.highZ) {
      newCam.z = bounds.highZ;
      this._camera.setMapOffset(newCam);
      bulletPositionScreen = this._camera.convertVoxelToScreen(this._projectile.getPosition());
    }

    if (Options.battleSmoothCamera) {
      if (this._launch) {
        this._launch = false;
        if (bulletPositionScreen.x < 1 || bulletPositionScreen.x > this.getWidth() - 1 ||
          bulletPositionScreen.y < 1 || bulletPositionScreen.y > this._visibleMapHeight - 1) {
          this._camera.centerOnPosition(new Position(bounds.lowX, bounds.lowY, bounds.highZ), false);
          bulletPositionScreen = this._camera.convertVoxelToScreen(this._projectile.getPosition());
        }
      }
      if (!this._smoothingEngaged) {
        if (bulletPositionScreen.x < 1 || bulletPositionScreen.x > this.getWidth() - 1 ||
          bulletPositionScreen.y < 1 || bulletPositionScreen.y > this._visibleMapHeight - 1) {
          this._smoothingEngaged = true;
        }
      } else {
        this._camera.jumpXY(Math.trunc(this.getWidth() / 2) - bulletPositionScreen.x, Math.trunc(this._visibleMapHeight / 2) - bulletPositionScreen.y);
      }
    } else {
      let enough = false;
      while (!enough) {
        enough = true;
        if (bulletPositionScreen.x < 0) {
          this._camera.jumpXY(this.getWidth(), 0);
          enough = false;
        } else if (bulletPositionScreen.x > this.getWidth()) {
          this._camera.jumpXY(-this.getWidth(), 0);
          enough = false;
        } else if (bulletPositionScreen.y < 0) {
          this._camera.jumpXY(0, this._visibleMapHeight);
          enough = false;
        } else if (bulletPositionScreen.y > this._visibleMapHeight) {
          this._camera.jumpXY(0, -this._visibleMapHeight);
          enough = false;
        }
        bulletPositionScreen = this._camera.convertVoxelToScreen(this._projectile.getPosition());
      }
    }
  }

  private drawProjectileOnTile(itX: number, itY: number, itZ: number, bounds: { lowX: number; lowY: number; lowZ: number; highX: number; highY: number; highZ: number } | null): void {
    if (!this._projectile || !this._projectileInFOV) {
      return;
    }

    if (this._projectile.getItem()) {
      const sprite = this._projectile.getSprite();
      if (!sprite) {
        return;
      }
      let voxelPos = this._projectile.getPosition();
      voxelPos = new Position(voxelPos.x, voxelPos.y, this._save.getTileEngine?.()?.castedShade?.(voxelPos) ?? voxelPos.z);
      if (this.projectileVoxelBelongsToTile(voxelPos, itX, itY, itZ, true) && this.isVoxelVisible(voxelPos)) {
        const screen = this._camera.convertVoxelToScreen(voxelPos);
        sprite.blitNShade(this, screen.x - 16, screen.y - 26, 16);
      }

      voxelPos = this._projectile.getPosition();
      if (this.projectileVoxelBelongsToTile(voxelPos, itX, itY, itZ, true) && this.isVoxelVisible(voxelPos)) {
        const screen = this._camera.convertVoxelToScreen(voxelPos);
        sprite.blitNShade(this, screen.x - 16, screen.y - 26, 0);
      }
      return;
    }

    if (!bounds || itX < bounds.lowX || itX > bounds.highX || itY < bounds.lowY || itY > bounds.highY) {
      return;
    }

    const projectileSet = this.getProjectileSet();
    let begin = 0;
    let end = Map.BULLET_SPRITES;
    let direction = 1;
    if (this._projectile.isReversed()) {
      begin = Map.BULLET_SPRITES - 1;
      end = -1;
      direction = -1;
    }
    for (let i = begin; i !== end; i += direction) {
      const sprite = projectileSet?.getFrame(this._projectile.getParticle(i)) || null;
      if (!sprite) {
        continue;
      }
      let voxelPos = this._projectile.getPosition(1 - i);
      voxelPos = new Position(voxelPos.x, voxelPos.y, this._save.getTileEngine?.()?.castedShade?.(voxelPos) ?? voxelPos.z);
      if (this.projectileVoxelBelongsToTile(voxelPos, itX, itY, itZ, false) && this.isVoxelVisible(voxelPos)) {
        const screen = this._camera.convertVoxelToScreen(voxelPos);
        sprite.blitNShade(this, screen.x - Math.trunc(sprite.getWidth() / 2), screen.y - Math.trunc(sprite.getHeight() / 2), 16);
      }

      voxelPos = this._projectile.getPosition(1 - i);
      if (this.projectileVoxelBelongsToTile(voxelPos, itX, itY, itZ, false) && this.isVoxelVisible(voxelPos)) {
        const screen = this._camera.convertVoxelToScreen(voxelPos);
        sprite.blitNShade(this, screen.x - Math.trunc(sprite.getWidth() / 2), screen.y - Math.trunc(sprite.getHeight() / 2), 0);
      }
    }
  }

  private getProjectileSet() {
    return this._mod?.getSurfaceSet((this._save.getDepth?.() || 0) > 0 ? "UnderwaterProjectiles" : "Projectiles") || null;
  }

  private projectileVoxelBelongsToTile(voxelPos: Position, itX: number, itY: number, itZ: number, inclusiveXY: boolean): boolean {
    const vx = Math.trunc(voxelPos.x / 16);
    const vy = Math.trunc(voxelPos.y / 16);
    const vz = Math.trunc(voxelPos.z / 24);
    if (inclusiveXY) {
      return vx >= itX && vy >= itY && vx <= itX + 1 && vy <= itY + 1 && vz === itZ;
    }
    return vx === itX && vy === itY && vz === itZ;
  }

  private isVoxelVisible(voxelPos: Position): boolean {
    return this._save.getTileEngine?.()?.isVoxelVisible?.(voxelPos) ?? true;
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

}
