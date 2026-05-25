import { InteractiveSurface } from "../Engine/InteractiveSurface.ts";
import { Options } from "../Engine/Options.ts";
import { Palette } from "../Engine/Palette.ts";
import { Timer } from "../Engine/Timer.ts";
import type { Action } from "../Engine/Action.ts";
import type { State } from "../Engine/State.ts";
import { UnitFaction } from "../Savegame/BattleUnit.ts";
import { SavedBattleGame } from "../Savegame/SavedBattleGame.ts";
import { Camera } from "./Camera.ts";
import { Explosion } from "./Explosion.ts";
import { Position } from "./Position.ts";
import type { Projectile } from "./Projectile.ts";

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

  cacheUnit(_unit: unknown): void {
    this.invalidate();
  }

  cacheUnits(): void {
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
    const minZ = this._camera.getShowAllLayers() ? 0 : viewLevel;
    for (let z = minZ; z <= viewLevel; ++z) {
      for (let y = 0; y < this._save.getMapSizeY(); ++y) {
        for (let x = 0; x < this._save.getMapSizeX(); ++x) {
          const pos = new Position(x, y, z);
          const tile = this._save.getTile(pos);
          if (!tile || tile.isVoid()) {
            continue;
          }
          const screen = this._camera.convertMapToScreen(pos);
          const sx = screen.x + offset.x;
          const sy = screen.y + offset.y;
          if (sx < -this._spriteWidth || sx > this.getWidth() + this._spriteWidth || sy < -this._spriteHeight || sy > this.getHeight() + this._spriteHeight) {
            continue;
          }
          const shade = Math.max(0, Math.min(4, 4 - tile.getShade()));
          const baseColor = Palette.blockOffset(4) + 3 + shade;
          this.drawTileDiamond(sx, sy, baseColor);
          if (this._showObstacles && tile.isObstacle()) {
            this.drawTileDiamond(sx, sy, Palette.blockOffset(3) + 10);
          }
          if (tile.getMarkerColor() > 0) {
            this.drawTileDiamond(sx, sy, Palette.blockOffset(tile.getMarkerColor()) + 10);
          }
          if (tile.getPreview() >= 0) {
            this.drawPreviewMarker(sx, sy, tile.getPreview(), tile.getMarkerColor() || PathPreviewColor.YELLOW);
          }
        }
      }
    }
    this.drawUnits();
    this.drawProjectile();
    this.drawExplosions();
    if (this._cursorType !== CursorType.CT_NONE) {
      const pos = new Position(this._selectorX, this._selectorY, viewLevel);
      const screen = this._camera.convertMapToScreen(pos);
      this.drawTileDiamond(screen.x + offset.x, screen.y + offset.y, Palette.blockOffset(13) + 12, false);
    }
    if (this._flashScreen) {
      this.drawRect(0, 0, this.getWidth(), this.getHeight(), Palette.blockOffset(15) + 8);
    }
  }

  private drawUnits(): void {
    const offset = this._camera.getMapOffset();
    const viewLevel = this._camera.getViewLevel();
    const minZ = this._camera.getShowAllLayers() ? 0 : viewLevel;
    const units = [...this._save.getUnits()].sort((a, b) => {
      const ap = a.getPosition();
      const bp = b.getPosition();
      return ap.z - bp.z || ap.y - bp.y || ap.x - bp.x;
    });
    for (const unit of units) {
      const pos = unit.getPosition();
      if (pos.z < minZ || pos.z > viewLevel) {
        continue;
      }
      const tile = this._save.getTile(pos);
      if (!tile || tile.isVoid()) {
        continue;
      }
      const screen = this._camera.convertMapToScreen(pos);
      const sx = screen.x + offset.x;
      const sy = screen.y + offset.y;
      if (sx < -this._spriteWidth || sx > this.getWidth() + this._spriteWidth || sy < -this._spriteHeight || sy > this.getHeight() + this._spriteHeight) {
        continue;
      }
      this.drawUnitMarker(sx, sy, unit.getFaction(), unit === this._save.getSelectedUnit());
    }
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
      const color = Palette.blockOffset(10) + 14;
      this.drawRect(screen.x - 2, screen.y - 2, 5, 5, Palette.blockOffset(0) + 4);
      this.drawRect(screen.x - 1, screen.y - 1, 3, 3, color);
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
        const frameIndex = frame % Explosion.EXPLODE_FRAMES;
        const radius = 3 + frameIndex * 2;
        const color = frameIndex < 3 ? Palette.blockOffset(15) + 12 : Palette.blockOffset(2) + 11;
        this.drawCircle(screen.x, screen.y, radius, color);
        this.drawCircle(screen.x, screen.y, Math.max(1, Math.trunc(radius / 2)), Palette.blockOffset(13) + 12);
      } else if (explosion.isHit()) {
        const size = 8 - Math.min(4, frame % Explosion.HIT_FRAMES);
        this.drawRect(screen.x - Math.trunc(size / 2), screen.y - Math.trunc(size / 2), size, size, Palette.blockOffset(2) + 12);
        this.drawLine(screen.x - size, screen.y, screen.x + size, screen.y, Palette.blockOffset(15) + 10);
        this.drawLine(screen.x, screen.y - size, screen.x, screen.y + size, Palette.blockOffset(15) + 10);
      } else {
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
