import type { Action } from "../Engine/Action.ts";
import type { State } from "../Engine/State.ts";
import { Position, type PositionLike } from "./Position.ts";
import type { Map } from "./Map.ts";

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Class handling camera movement, either by mouse or by events on the battlescape.
 */
export class Camera {
  static readonly SCROLL_BORDER = 5;
  static readonly SCROLL_DIAGONAL_EDGE = 60;

  private _screenWidth: number;
  private _screenHeight: number;
  private _mapOffset = new Position(-250, 250, 0);
  private _center = new Position();
  private _scrollMouseX = 0;
  private _scrollMouseY = 0;
  private _scrollKeyX = 0;
  private _scrollKeyY = 0;
  private _scrollTrigger = false;
  private _showAllLayers = false;

  constructor(
    private _spriteWidth: number,
    private _spriteHeight: number,
    private _mapsize_x: number,
    private _mapsize_y: number,
    private _mapsize_z: number,
    private _map: Map,
    private _visibleMapHeight: number
  ) {
    this._screenWidth = _map.getWidth();
    this._screenHeight = _map.getHeight();
  }

  setScrollTimer(_mouse: unknown, _key: unknown): void {}

  mousePress(_action: Action, _state: State): void {}

  mouseRelease(_action: Action, _state: State): void {
    this._scrollTrigger = false;
    this._scrollMouseX = 0;
    this._scrollMouseY = 0;
  }

  mouseOver(_action: Action, _state: State): void {}

  keyboardPress(_action: Action, _state: State): void {}

  keyboardRelease(_action: Action, _state: State): void {
    this._scrollKeyX = 0;
    this._scrollKeyY = 0;
  }

  scrollMouse(): void {
    this.scrollXY(this._scrollMouseX, this._scrollMouseY, true);
  }

  scrollKey(): void {
    this.scrollXY(this._scrollKeyX, this._scrollKeyY, true);
  }

  scrollXY(x: number, y: number, redraw: boolean): void {
    this._mapOffset.x += x;
    this._mapOffset.y += y;

    while (true) {
      const center = this.convertScreenToMap(Math.trunc(this._screenWidth / 2), Math.trunc(this._visibleMapHeight / 2));
      this._center.x = center.x;
      this._center.y = center.y;
      if (this._center.x < 0) {
        this._mapOffset.x -= 1;
        this._mapOffset.y -= 1;
        continue;
      }
      if (this._center.x > this._mapsize_x - 1) {
        this._mapOffset.x += 1;
        this._mapOffset.y += 1;
        continue;
      }
      if (this._center.y < 0) {
        this._mapOffset.x += 1;
        this._mapOffset.y -= 1;
        continue;
      }
      if (this._center.y > this._mapsize_y - 1) {
        this._mapOffset.x -= 1;
        this._mapOffset.y += 1;
        continue;
      }
      break;
    }

    this._map.refreshSelectorPosition();
    if (redraw) {
      this._map.invalidate();
    }
  }

  jumpXY(x: number, y: number): void {
    this._mapOffset.x += x;
    this._mapOffset.y += y;
    const center = this.convertScreenToMap(Math.trunc(this._screenWidth / 2), Math.trunc(this._visibleMapHeight / 2));
    this._center.x = center.x;
    this._center.y = center.y;
  }

  up(): void {
    if (this._mapOffset.z < this._mapsize_z - 1) {
      this._mapOffset.z++;
      this._mapOffset.y += Math.trunc(this._spriteHeight * 3 / 5);
      this._map.draw();
    }
  }

  down(): void {
    if (this._mapOffset.z > 0) {
      this._mapOffset.z--;
      this._mapOffset.y -= Math.trunc(this._spriteHeight * 3 / 5);
      this._map.draw();
    }
  }

  setViewLevel(viewlevel: number): void {
    this._mapOffset.z = clamp(viewlevel, 0, this._mapsize_z - 1);
    this._map.draw();
  }

  convertMapToScreen(mapPos: PositionLike, screenPos?: Position): Position {
    const result = screenPos || new Position();
    result.z = 0;
    result.x = Math.trunc(mapPos.x * (this._spriteWidth / 2) - mapPos.y * (this._spriteWidth / 2));
    result.y = Math.trunc(mapPos.x * (this._spriteWidth / 4) + mapPos.y * (this._spriteWidth / 4) - mapPos.z * ((this._spriteHeight + this._spriteWidth / 4) / 2));
    return result;
  }

  convertVoxelToScreen(voxelPos: PositionLike, screenPos?: Position): Position {
    const mapPosition = new Position(Math.trunc(voxelPos.x / 16), Math.trunc(voxelPos.y / 16), Math.trunc(voxelPos.z / 24));
    const result = this.convertMapToScreen(mapPosition, screenPos);
    const dx = voxelPos.x - mapPosition.x * 16;
    const dy = voxelPos.y - mapPosition.y * 16;
    const dz = voxelPos.z - mapPosition.z * 24;
    result.x += Math.trunc(dx - dy) + Math.trunc(this._spriteWidth / 2);
    result.y += Math.trunc((this._spriteHeight / 2.0) + (dx / 2.0) + (dy / 2.0) - dz);
    result.x += this._mapOffset.x;
    result.y += this._mapOffset.y;
    return result;
  }

  convertScreenToMap(screenX: number, screenY: number, mapX?: { value: number }, mapY?: { value: number }): Position {
    let y = screenY + Math.trunc(-this._spriteWidth / 2) + this._mapOffset.z * Math.trunc((this._spriteHeight + this._spriteWidth / 4) / 2);
    let convertedY = -screenX + this._mapOffset.x + 2 * y - 2 * this._mapOffset.y;
    let convertedX = y - this._mapOffset.y - Math.trunc(convertedY / 4) - Math.trunc(this._spriteWidth / 4);
    convertedX = Math.trunc(convertedX / (this._spriteWidth / 4));
    convertedY = Math.trunc(convertedY / this._spriteWidth);
    convertedX = clamp(convertedX, -1, this._mapsize_x);
    convertedY = clamp(convertedY, -1, this._mapsize_y);
    if (mapX) {
      mapX.value = convertedX;
    }
    if (mapY) {
      mapY.value = convertedY;
    }
    return new Position(convertedX, convertedY, this._mapOffset.z);
  }

  centerOnPosition(pos: PositionLike, redraw = true): void {
    this._center = Position.from(pos);
    this._center.x = clamp(this._center.x, -1, this._mapsize_x);
    this._center.y = clamp(this._center.y, -1, this._mapsize_y);
    const screenPos = this.convertMapToScreen(this._center);
    this._mapOffset.x = -(screenPos.x - Math.trunc(this._screenWidth / 2));
    this._mapOffset.y = -(screenPos.y - Math.trunc(this._visibleMapHeight / 2));
    this._mapOffset.z = this._center.z;
    if (redraw) {
      this._map.draw();
    }
  }

  getCenterPosition(): Position {
    this._center.z = this._mapOffset.z;
    return this._center.clone();
  }

  getViewLevel(): number {
    return this._mapOffset.z;
  }

  getMapSizeX(): number {
    return this._mapsize_x;
  }

  getMapSizeY(): number {
    return this._mapsize_y;
  }

  getMapOffset(): Position {
    return this._mapOffset.clone();
  }

  setMapOffset(pos: PositionLike): void {
    this._mapOffset = Position.from(pos);
  }

  toggleShowAllLayers(): number {
    this._showAllLayers = !this._showAllLayers;
    return this._showAllLayers ? 2 : 1;
  }

  getShowAllLayers(): boolean {
    return this._showAllLayers;
  }

  isOnScreen(mapPos: PositionLike, unitWalking: boolean, unitSize: number, boundary: boolean): boolean {
    const screenPos = this.convertMapToScreen(mapPos);
    let posx = Math.trunc(this._spriteWidth / 2);
    let posy = this._spriteHeight - Math.trunc(this._spriteWidth / 4);
    let sizex = Math.trunc(this._spriteWidth / 2);
    let sizey = Math.trunc(this._spriteHeight / 2);
    if (unitSize > 0) {
      posy -= Math.trunc(this._spriteWidth / 4);
      sizex = this._spriteWidth * unitSize;
      sizey = Math.trunc(this._spriteWidth * unitSize / 2);
    }
    screenPos.x += this._mapOffset.x + posx;
    screenPos.y += this._mapOffset.y + posy;
    if (unitWalking) {
      if (boundary) {
        sizex += this._spriteWidth;
        sizey += Math.trunc(this._spriteWidth / 2);
      }
      if (screenPos.x < 0 - sizex ||
        screenPos.x >= this._screenWidth + sizex ||
        screenPos.y < 0 - sizey ||
        screenPos.y >= this._screenHeight + sizey) {
        return false;
      }
      const side = Math.trunc((this._screenWidth - this._map.getIconWidth()) / 2);
      if (screenPos.y < (this._screenHeight - this._map.getIconHeight()) + sizey) {
        return true;
      }
      if (side > 1 && (screenPos.x < side + sizex || screenPos.x >= (this._screenWidth - side - sizex))) {
        return true;
      }
      return false;
    }
    return screenPos.x >= 0 &&
      screenPos.x <= this._screenWidth - 10 &&
      screenPos.y >= 0 &&
      screenPos.y <= this._screenHeight - 10;
  }

  resize(): void {
    this._screenWidth = this._map.getWidth();
    this._screenHeight = this._map.getHeight();
    this._visibleMapHeight = this._map.getHeight() - this._map.getIconHeight();
  }

  stopMouseScrolling(): void {
    this._scrollMouseX = 0;
    this._scrollMouseY = 0;
  }
}
