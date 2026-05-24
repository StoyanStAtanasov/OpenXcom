import { Position, type PositionLike } from "./Position.ts";

/**
 * Battlescape impact/explosion animation descriptor.
 */
export class Explosion {
  static readonly HIT_FRAMES = 4;
  static readonly EXPLODE_FRAMES = 8;
  static readonly BULLET_FRAMES = 10;

  private _position: Position;
  private _currentFrame = 0;

  constructor(
    position: PositionLike,
    private _startFrame: number,
    private _frameDelay = 0,
    private _big = false,
    private _hit = false
  ) {
    this._position = Position.from(position);
  }

  animate(): boolean {
    if (this._frameDelay > 0) {
      this._frameDelay--;
      return true;
    }
    this._currentFrame++;
    if (this._hit) {
      return this._currentFrame < Explosion.HIT_FRAMES;
    }
    if (this._big) {
      return this._currentFrame < Explosion.EXPLODE_FRAMES;
    }
    return this._currentFrame < Explosion.BULLET_FRAMES;
  }

  getPosition(): Position {
    return this._position;
  }

  getCurrentFrame(): number {
    if (this._frameDelay > 0) {
      return -1;
    }
    return this._startFrame + this._currentFrame;
  }

  isBig(): boolean {
    return this._big;
  }

  isHit(): boolean {
    return this._hit;
  }
}
