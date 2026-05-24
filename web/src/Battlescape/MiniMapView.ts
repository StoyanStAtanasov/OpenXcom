import type { Game } from "../Engine/Game.ts";
import { InteractiveSurface } from "../Engine/InteractiveSurface.ts";
import type { Action } from "../Engine/Action.ts";
import type { State } from "../Engine/State.ts";
import { Options } from "../Engine/Options.ts";
import { TilePart } from "../Mod/MapData.ts";
import { UnitFaction } from "../Savegame/BattleUnit.ts";
import type { SavedBattleGame } from "../Savegame/SavedBattleGame.ts";
import { SDL_BUTTON_LEFT, SDL_BUTTON_RIGHT, SDL_MOUSEBUTTONUP } from "../types.ts";
import type { Camera } from "./Camera.ts";
import { Pathfinding } from "./Pathfinding.ts";
import { Position } from "./Position.ts";
import type { MiniMapState } from "./MiniMapState.ts";

const CELL_WIDTH = 4;
const CELL_HEIGHT = 4;
const MAX_FRAME = 2;

/**
 * MiniMapView is the class used to display the map in the MiniMapState.
 */
export class MiniMapView extends InteractiveSurface {
  private _frame = 0;
  private _isMouseScrolling = false;
  private _isMouseScrolled = false;
  private _mouseScrollX = 0;
  private _mouseScrollY = 0;
  private _posBeforeMouseScrolling = new Position();
  private _cursorPosition = new Position();
  private _lastMouseX = 0;
  private _lastMouseY = 0;
  private _totalMouseMoveX = 0;
  private _totalMouseMoveY = 0;
  private _mouseMovedOverThreshold = false;
  private _mouseScrollingStartTime = 0;

  constructor(
    w: number,
    h: number,
    x: number,
    y: number,
    private _game: Game,
    private _camera: Camera,
    private _battleGame: SavedBattleGame
  ) {
    super(w, h, x, y);
  }

  override draw(): void {
    const startX = this._camera.getCenterPosition().x - Math.trunc((this.getWidth() / CELL_WIDTH) / 2);
    const startY = this._camera.getCenterPosition().y - Math.trunc((this.getHeight() / CELL_HEIGHT) / 2);
    const set = this._game.getMod()?.getSurfaceSet("SCANG.DAT") || null;

    super.draw();
    if (!set) {
      return;
    }
    this.drawRect(0, 0, this.getWidth(), this.getHeight(), 15);

    for (let lvl = 0; lvl <= this._camera.getCenterPosition().z; ++lvl) {
      let py = startY;
      for (let y = this.getY(); y < this.getHeight() + this.getY(); y += CELL_HEIGHT) {
        let px = startX;
        for (let x = this.getX(); x < this.getWidth() + this.getX(); x += CELL_WIDTH) {
          const tile = this._battleGame.getTile(new Position(px, py, lvl));
          if (!tile) {
            px++;
            continue;
          }

          for (let i = TilePart.O_FLOOR; i <= TilePart.O_OBJECT; ++i) {
            const data = tile.getMapData(i);
            if (data && data.getMiniMapIndex()) {
              const frame = set.getFrame(data.getMiniMapIndex() + 35);
              if (frame) {
                let shade = 16;
                if (tile.isDiscovered(2)) {
                  shade = tile.getShade();
                  if (shade > 7) {
                    shade = 7;
                  }
                }
                frame.blitNShade(this, x, y, shade);
              }
            }
          }

          const unit = tile.getUnit();
          if (unit && unit.getVisible()) {
            let frameIndex = unit.getMiniMapSpriteIndex();
            const size = unit.getArmor().getSize();
            frameIndex += (tile.getPosition().y - unit.getPosition().y) * size;
            frameIndex += tile.getPosition().x - unit.getPosition().x;
            frameIndex += this._frame * size * size;
            const frame = set.getFrame(frameIndex);
            if (frame) {
              if (size > 1 && unit.getFaction() === UnitFaction.FACTION_NEUTRAL) {
                frame.blitNShade(this, x, y, 0, false, Pathfinding.red);
              } else {
                frame.blitNShade(this, x, y, 0);
              }
            }
          }

          if (tile.isDiscovered(2) && tile.getInventory().length > 0) {
            const frame = set.getFrame(9 + this._frame);
            frame?.blitNShade(this, x, y, 0);
          }

          px++;
        }
        py++;
      }
    }

    const centerX = Math.trunc(this.getWidth() / 2) - 1;
    const centerY = Math.trunc(this.getHeight() / 2) - 1;
    const color = 1 + this._frame * 3;
    const xOffset = Math.trunc(CELL_WIDTH / 2);
    const yOffset = Math.trunc(CELL_HEIGHT / 2);
    this.drawLine(centerX - CELL_WIDTH, centerY - CELL_HEIGHT, centerX - xOffset, centerY - yOffset, color);
    this.drawLine(centerX + xOffset, centerY - yOffset, centerX + CELL_WIDTH, centerY - CELL_HEIGHT, color);
    this.drawLine(centerX - CELL_WIDTH, centerY + CELL_HEIGHT, centerX - xOffset, centerY + yOffset, color);
    this.drawLine(centerX + CELL_WIDTH, centerY + CELL_HEIGHT, centerX + xOffset, centerY + yOffset, color);
  }

  up(): number {
    this._camera.setViewLevel(this._camera.getViewLevel() + 1);
    this.invalidate();
    return this._camera.getViewLevel();
  }

  down(): number {
    this._camera.setViewLevel(this._camera.getViewLevel() - 1);
    this.invalidate();
    return this._camera.getViewLevel();
  }

  override mousePress(action: Action, state: State): void {
    super.mousePress(action, state);
    if (action.getDetails().button?.button === Options.battleDragScrollButton) {
      this._isMouseScrolling = true;
      this._isMouseScrolled = false;
      this._posBeforeMouseScrolling = this._camera.getCenterPosition();
      this._cursorPosition = new Position(action.getXMouse(), action.getYMouse(), 1);
      this._lastMouseX = action.getXMouse();
      this._lastMouseY = action.getYMouse();
      this._mouseScrollX = 0;
      this._mouseScrollY = 0;
      this._totalMouseMoveX = 0;
      this._totalMouseMoveY = 0;
      this._mouseMovedOverThreshold = false;
      this._mouseScrollingStartTime = Date.now();
    }
  }

  override mouseClick(action: Action, state: State): void {
    super.mouseClick(action, state);

    if (this._isMouseScrolling) {
      if (action.getDetails().button?.button === Options.battleDragScrollButton) {
        this._isMouseScrolling = false;
        this.stopScrolling(action);
      } else {
        return;
      }
      if (!this._mouseMovedOverThreshold && Date.now() - this._mouseScrollingStartTime <= Options.dragScrollTimeTolerance) {
        this._isMouseScrolled = false;
        this.stopScrolling(action);
        this._camera.centerOnPosition(this._posBeforeMouseScrolling);
        this.invalidate();
      }
      if (this._isMouseScrolled) {
        return;
      }
    }

    const button = action.getDetails().button?.button;
    if (button === SDL_BUTTON_RIGHT) {
      (state as MiniMapState).btnOkClick(action);
    }
    if (button === SDL_BUTTON_LEFT) {
      const origX = Math.trunc(action.getRelativeXMouse() / action.getXScale());
      const origY = Math.trunc(action.getRelativeYMouse() / action.getYScale());
      const xOff = Math.trunc(origX / CELL_WIDTH) - Math.trunc((this.getWidth() / 2) / CELL_WIDTH);
      const yOff = Math.trunc(origY / CELL_HEIGHT) - Math.trunc((this.getHeight() / 2) / CELL_HEIGHT);
      const newX = this._camera.getCenterPosition().x + xOff;
      const newY = this._camera.getCenterPosition().y + yOff;
      this._camera.centerOnPosition(new Position(newX, newY, this._camera.getViewLevel()));
      this.invalidate();
    }
  }

  override mouseOver(action: Action, state: State): void {
    super.mouseOver(action, state);
    if (this._isMouseScrolling && action.getDetails().type === "SDL_MOUSEMOTION") {
      this._isMouseScrolled = true;
      const xrel = action.getXMouse() - this._lastMouseX;
      const yrel = action.getYMouse() - this._lastMouseY;
      this._lastMouseX = action.getXMouse();
      this._lastMouseY = action.getYMouse();
      this._totalMouseMoveX += xrel;
      this._totalMouseMoveY += yrel;
      if (!this._mouseMovedOverThreshold) {
        this._mouseMovedOverThreshold = Math.abs(this._totalMouseMoveX) > Options.dragScrollPixelTolerance ||
          Math.abs(this._totalMouseMoveY) > Options.dragScrollPixelTolerance;
      }

      const scrollX = Options.battleDragScrollInvert ? xrel : -xrel;
      const scrollY = Options.battleDragScrollInvert ? yrel : -yrel;
      this._mouseScrollX += scrollX;
      this._mouseScrollY += scrollY;
      let newX = this._posBeforeMouseScrolling.x + Math.trunc(this._mouseScrollX / action.getXScale() / 4);
      let newY = this._posBeforeMouseScrolling.y + Math.trunc(this._mouseScrollY / action.getYScale() / 4);
      if (newX < -1 || this._camera.getMapSizeX() < newX) {
        this._mouseScrollX -= scrollX;
        newX = this._posBeforeMouseScrolling.x + Math.trunc(this._mouseScrollX / 4);
      }
      if (newY < -1 || this._camera.getMapSizeY() < newY) {
        this._mouseScrollY -= scrollY;
        newY = this._posBeforeMouseScrolling.y + Math.trunc(this._mouseScrollY / 4);
      }
      this._camera.centerOnPosition(new Position(newX, newY, this._camera.getViewLevel()));
      this.invalidate();
    }
  }

  override mouseIn(action: Action, state: State): void {
    super.mouseIn(action, state);
    this._isMouseScrolling = false;
    this.setButtonPressed(SDL_BUTTON_RIGHT, false);
  }

  animate(): void {
    this._frame++;
    if (this._frame > MAX_FRAME) {
      this._frame = 0;
    }
    this.invalidate();
  }

  stopScrolling(action: Action): void {
    if (!Options.battleDragScrollInvert) {
      action.setMouseAction(this._cursorPosition.x, this._cursorPosition.y, this.getX(), this.getY());
    }
    this._cursorPosition.z = 0;
  }
}
