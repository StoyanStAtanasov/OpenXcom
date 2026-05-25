export enum CraftWeaponProjectileType {
  CWPT_STINGRAY_MISSILE,
  CWPT_AVALANCHE_MISSILE,
  CWPT_CANNON_ROUND,
  CWPT_FUSION_BALL,
  CWPT_LASER_BEAM,
  CWPT_PLASMA_BEAM
}

export enum CraftWeaponProjectileGlobalType {
  CWPGT_MISSILE,
  CWPGT_BEAM
}

export enum Directions {
  D_NONE,
  D_UP,
  D_DOWN
}

export const HP_LEFT = -1;
export const HP_CENTER = 0;
export const HP_RIGHT = 1;

export class CraftWeaponProjectile {
  private _type = CraftWeaponProjectileType.CWPT_CANNON_ROUND;
  private _globalType = CraftWeaponProjectileGlobalType.CWPGT_MISSILE;
  private _speed = 0;
  private _direction = Directions.D_NONE;
  private _currentPosition = 0;
  private _horizontalPosition = 0;
  private _state = 0;
  private _accuracy = 0;
  private _damage = 0;
  private _range = 0;
  private _toBeRemoved = false;
  private _missed = false;
  private _distanceCovered = 0;

  setType(type: CraftWeaponProjectileType): void {
    this._type = type;
    if (type >= CraftWeaponProjectileType.CWPT_LASER_BEAM) {
      this._globalType = CraftWeaponProjectileGlobalType.CWPGT_BEAM;
      this._state = 8;
    }
  }

  getType(): CraftWeaponProjectileType {
    return this._type;
  }

  getGlobalType(): CraftWeaponProjectileGlobalType {
    return this._globalType;
  }

  setDirection(direction: number): void {
    this._direction = direction;
    if (this._direction === Directions.D_UP) {
      this._currentPosition = 0;
    }
  }

  getDirection(): number {
    return this._direction;
  }

  move(): void {
    if (this._globalType === CraftWeaponProjectileGlobalType.CWPGT_MISSILE) {
      let positionChange = this._speed;
      if (Math.trunc(this._distanceCovered / 8) < this.getRange() && Math.trunc((this._distanceCovered + this._speed) / 8) >= this.getRange()) {
        positionChange = this.getRange() * 8 - this._distanceCovered;
      }
      if (Math.trunc(this._distanceCovered / 8) >= this.getRange()) {
        this.setMissed(true);
      }
      if (this._direction === Directions.D_UP) {
        this._currentPosition += positionChange;
      } else if (this._direction === Directions.D_DOWN) {
        this._currentPosition -= positionChange;
      }
      this._distanceCovered += positionChange;
    } else if (this._globalType === CraftWeaponProjectileGlobalType.CWPGT_BEAM) {
      this._state = Math.trunc(this._state / 2);
      if (this._state === 1) {
        this._toBeRemoved = true;
      }
    }
  }

  getPosition(): number {
    return this._currentPosition;
  }

  setPosition(position: number): void {
    this._currentPosition = position;
  }

  setHorizontalPosition(position: number): void {
    this._horizontalPosition = position;
  }

  getHorizontalPosition(): number {
    return this._horizontalPosition;
  }

  remove(): void {
    this._toBeRemoved = true;
  }

  toBeRemoved(): boolean {
    return this._toBeRemoved;
  }

  getState(): number {
    return this._state;
  }

  setDamage(damage: number): void {
    this._damage = damage;
  }

  getDamage(): number {
    return this._damage;
  }

  setAccuracy(accuracy: number): void {
    this._accuracy = accuracy;
  }

  getAccuracy(): number {
    return this._accuracy;
  }

  setMissed(missed: boolean): void {
    this._missed = missed;
  }

  getMissed(): boolean {
    return this._missed;
  }

  setRange(range: number): void {
    this._range = range;
  }

  getRange(): number {
    return this._range;
  }

  setSpeed(speed: number): void {
    this._speed = speed;
  }
}
