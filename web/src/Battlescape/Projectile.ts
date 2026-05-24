import type { Surface } from "../Engine/Surface.ts";
import { Options } from "../Engine/Options.ts";
import { RNG } from "../Engine/RNG.ts";
import { KMOD_CTRL } from "../types.ts";
import { MovementType } from "../Mod/Armor.ts";
import type { Mod } from "../Mod/Mod.ts";
import { TilePart, VoxelType } from "../Mod/MapData.ts";
import type { BattleItem } from "../Savegame/BattleItem.ts";
import { UnitFaction } from "../Savegame/BattleUnit.ts";
import type { SavedBattleGame } from "../Savegame/SavedBattleGame.ts";
import { BattleActionType, type BattleAction } from "./BattlescapeGame.ts";
import { Position, type PositionLike } from "./Position.ts";

function cloneAction(action: BattleAction): BattleAction {
  return {
    ...action,
    target: action.target.clone(),
    waypoints: action.waypoints.map(waypoint => waypoint.clone()),
    cameraPosition: action.cameraPosition.clone()
  };
}

function div(value: number, divisor: number): number {
  return Math.trunc(value / divisor);
}

/**
 * Voxel-space projectile trajectory.
 *
 * This mirrors OpenXcom's Projectile shell: straight shots, arcing throws,
 * accuracy spread, movement along a precalculated voxel path, and the same
 * item/sprite accessors used by the map animation state.
 */
export class Projectile {
  static readonly ItemDropVoxelOffset = -2;

  private _action: BattleAction;
  private _origin: Position;
  private _targetVoxel: Position;
  private _trajectory: Position[] = [];
  private _position = 0;
  private _sprite: Surface | null = null;
  private _speed = Options.battleFireSpeed;
  private _bulletSprite = -1;
  private _reversed = false;
  private _vaporColor = -1;
  private _vaporDensity = -1;
  private _vaporProbability = 5;

  constructor(
    private _mod: Mod | null,
    private _save: SavedBattleGame,
    action: BattleAction,
    origin: PositionLike,
    targetVoxel: PositionLike,
    ammo: BattleItem | null = null
  ) {
    this._action = cloneAction(action);
    this._origin = Position.from(origin);
    this._targetVoxel = Position.from(targetVoxel);

    if (this._action.weapon) {
      if (this._action.type === BattleActionType.BA_THROW) {
        this._sprite = this._mod?.getSurfaceSet("FLOOROB.PCK")?.getFrame(this.getItem()?.getRules().getFloorSprite() ?? -1) || null;
      } else {
        if (ammo) {
          this._bulletSprite = ammo.getRules().getBulletSprite();
          this._vaporColor = ammo.getRules().getVaporColor();
          this._vaporDensity = ammo.getRules().getVaporDensity();
          this._vaporProbability = ammo.getRules().getVaporProbability();
          this._speed = Math.max(1, this._speed + ammo.getRules().getBulletSpeed());
        }
        if (this._bulletSprite === -1) {
          this._bulletSprite = this._action.weapon.getRules().getBulletSprite();
        }
        if (this._vaporColor === -1) {
          this._vaporColor = this._action.weapon.getRules().getVaporColor();
        }
        if (this._vaporDensity === -1) {
          this._vaporDensity = this._action.weapon.getRules().getVaporDensity();
        }
        if (this._vaporProbability === 5) {
          this._vaporProbability = this._action.weapon.getRules().getVaporProbability();
        }
        if (!ammo || (ammo !== this._action.weapon || ammo.getRules().getBulletSpeed() === 0)) {
          this._speed = Math.max(1, this._speed + this._action.weapon.getRules().getBulletSpeed());
        }
      }
    }

    this._reversed = ((this._targetVoxel.x - this._origin.x) + (this._targetVoxel.y - this._origin.y)) >= 0;
  }

  static getPositionFromStart(trajectory: Position[], pos: number): Position {
    if (trajectory.length === 0) {
      return new Position();
    }
    if (pos >= 0 && pos < trajectory.length) {
      return trajectory[pos].clone();
    }
    if (pos < 0) {
      return trajectory[0].clone();
    }
    return trajectory[trajectory.length - 1].clone();
  }

  static getPositionFromEnd(trajectory: Position[], pos: number): Position {
    return Projectile.getPositionFromStart(trajectory, trajectory.length + pos - 1);
  }

  calculateTrajectory(accuracy: number): VoxelType;
  calculateTrajectory(accuracy: number, originVoxel: PositionLike, excludeUnit?: boolean): VoxelType;
  calculateTrajectory(accuracy: number, originVoxelLike?: PositionLike, excludeUnit = true): VoxelType {
    const engine = this._save.getTileEngine();
    const actor = this._action.actor;
    if (!engine || !actor || !this._action.weapon) {
      return VoxelType.V_OUTOFBOUNDS;
    }

    const originVoxel = originVoxelLike
      ? Position.from(originVoxelLike)
      : engine.getOriginVoxel(this._action, this._save.getTile(this._origin));
    const targetTile = this._save.getTile(this._action.target);
    this._trajectory.length = 0;
    this._position = 0;

    const test = engine.calculateLine(
      originVoxel,
      this._targetVoxel,
      false,
      this._trajectory,
      excludeUnit ? actor : null
    );

    const forceFire = Options.forceFire && (Options.getKeyModifiers() & KMOD_CTRL) !== 0;
    if (test !== VoxelType.V_EMPTY &&
      this._trajectory.length > 0 &&
      actor.getFaction() === UnitFaction.FACTION_PLAYER &&
      this._action.autoShotCounter === 1 &&
      !forceFire &&
      (this._save.getBattleGame()?.getPanicHandled() ?? true) &&
      this._action.type !== BattleActionType.BA_LAUNCH) {
      const hitVoxel = this._trajectory[0];
      const hitPos = new Position(div(hitVoxel.x, 16), div(hitVoxel.y, 16), div(hitVoxel.z, 24));
      if (test === VoxelType.V_UNIT && this._save.getTile(hitPos)?.getUnit() == null) {
        hitPos.z--;
      }

      if (!hitPos.equals(this._action.target) && this._action.result.length === 0) {
        if (test === VoxelType.V_NORTHWALL) {
          if (hitPos.y - 1 !== this._action.target.y) {
            this._trajectory.length = 0;
            return VoxelType.V_EMPTY;
          }
        } else if (test === VoxelType.V_WESTWALL) {
          if (hitPos.x - 1 !== this._action.target.x) {
            this._trajectory.length = 0;
            return VoxelType.V_EMPTY;
          }
        } else if (test === VoxelType.V_UNIT) {
          const hitUnit = this._save.getTile(hitPos)?.getUnit() || null;
          const targetUnit = targetTile?.getUnit() || null;
          if (hitUnit !== targetUnit) {
            this._trajectory.length = 0;
            return VoxelType.V_EMPTY;
          }
        } else {
          this._trajectory.length = 0;
          return VoxelType.V_EMPTY;
        }
      }
    }

    this._trajectory.length = 0;
    let extendLine = true;
    if (this._action.type === BattleActionType.BA_LAUNCH) {
      accuracy = actor.getFaction() === UnitFaction.FACTION_PLAYER ? 0.60 : 0.55;
      extendLine = this._action.waypoints.length <= 1;
    }

    this.applyAccuracy(originVoxel, this._targetVoxel, accuracy, false, extendLine);
    return engine.calculateLine(originVoxel, this._targetVoxel, true, this._trajectory, actor);
  }

  calculateThrow(accuracy: number): VoxelType {
    const engine = this._save.getTileEngine();
    const actor = this._action.actor;
    const weapon = this._action.weapon;
    const targetTile = this._save.getTile(this._action.target);
    if (!engine || !actor || !weapon || !targetTile) {
      return VoxelType.V_OUTOFBOUNDS;
    }

    const originVoxel = engine.getOriginVoxel(this._action, null);
    let targetVoxel = this._action.target
      .multiply(new Position(16, 16, 24))
      .add(new Position(8, 8, 1 - targetTile.getTerrainLevel()));
    const targets: Position[] = [];
    let forced = false;

    if (this._action.type === BattleActionType.BA_THROW) {
      targets.push(targetVoxel);
    } else {
      let targetUnit = targetTile.getUnit();
      if (!targetUnit && this._action.target.z > 0 && targetTile.hasNoFloor(null)) {
        targetUnit = this._save.getTile(this._action.target.subtract(new Position(0, 0, 1)))?.getUnit() || null;
      }
      if (Options.forceFire && (Options.getKeyModifiers() & KMOD_CTRL) !== 0 && this._save.getSide() === UnitFaction.FACTION_PLAYER) {
        targets.push(this._action.target.multiply(new Position(16, 16, 24)).add(new Position(0, 0, 12)));
        forced = true;
      } else if (targetUnit && (actor.getFaction() !== UnitFaction.FACTION_PLAYER || targetUnit.getVisible())) {
        targetVoxel = targetVoxel.add(new Position(0, 0, targetUnit.getFloatHeight()));
        targets.push(targetVoxel.add(new Position(0, 0, div(targetUnit.getHeight(), 2) + 1)));
        targets.push(targetVoxel.add(new Position(0, 0, 2)));
        targets.push(targetVoxel.add(new Position(0, 0, targetUnit.getHeight() - 1)));
      } else if (targetTile.getMapData(TilePart.O_OBJECT)) {
        targetVoxel = this._action.target.multiply(new Position(16, 16, 24)).add(new Position(8, 8, 0));
        targets.push(targetVoxel.add(new Position(0, 0, 13)));
        targets.push(targetVoxel.add(new Position(0, 0, 8)));
        targets.push(targetVoxel.add(new Position(0, 0, 23)));
        targets.push(targetVoxel.add(new Position(0, 0, 2)));
      } else if (targetTile.getMapData(TilePart.O_NORTHWALL)) {
        targetVoxel = this._action.target.multiply(new Position(16, 16, 24)).add(new Position(8, 0, 0));
        targets.push(targetVoxel.add(new Position(0, 0, 13)));
        targets.push(targetVoxel.add(new Position(0, 0, 8)));
        targets.push(targetVoxel.add(new Position(0, 0, 20)));
        targets.push(targetVoxel.add(new Position(0, 0, 3)));
      } else if (targetTile.getMapData(TilePart.O_WESTWALL)) {
        targetVoxel = this._action.target.multiply(new Position(16, 16, 24)).add(new Position(0, 8, 0));
        targets.push(targetVoxel.add(new Position(0, 0, 13)));
        targets.push(targetVoxel.add(new Position(0, 0, 8)));
        targets.push(targetVoxel.add(new Position(0, 0, 20)));
        targets.push(targetVoxel.add(new Position(0, 0, 2)));
      } else if (targetTile.getMapData(TilePart.O_FLOOR)) {
        targets.push(targetVoxel);
      }
    }

    let test: VoxelType = VoxelType.V_OUTOFBOUNDS;
    let curvature = 0;
    for (const candidate of targets) {
      targetVoxel = candidate.clone();
      const curveRef = { value: 0 };
      const testRef: { value: VoxelType } = { value: test };
      if (engine.validateThrow(this._action, originVoxel, targetVoxel, curveRef, testRef, forced)) {
        curvature = curveRef.value;
        test = testRef.value;
        break;
      }
      test = testRef.value;
    }
    if (!forced && test === VoxelType.V_OUTOFBOUNDS) {
      return test;
    }

    test = VoxelType.V_OUTOFBOUNDS;
    let attempts = 0;
    while (test === VoxelType.V_OUTOFBOUNDS && attempts++ < 256) {
      let deltas = targetVoxel.clone();
      this._trajectory.length = 0;
      this._position = 0;
      if (this._action.type === BattleActionType.BA_THROW) {
        this.applyAccuracy(originVoxel, deltas, accuracy, true, false);
        deltas = deltas.subtract(targetVoxel);
      } else {
        this.applyAccuracy(originVoxel, targetVoxel, accuracy, true, false);
        deltas = new Position();
      }

      test = engine.calculateParabola(originVoxel, targetVoxel, true, this._trajectory, actor, curvature, deltas);
      if (forced) {
        return VoxelType.V_OBJECT;
      }
      const endPoint = Projectile.getPositionFromEnd(this._trajectory, Projectile.ItemDropVoxelOffset).divide(new Position(16, 16, 24));
      const endTile = this._save.getTile(endPoint);
      const object = endTile?.getMapData(TilePart.O_OBJECT) || null;
      if (this._action.type === BattleActionType.BA_THROW &&
        endTile &&
        object &&
        object.getTUCost(MovementType.MT_WALK) === 255 &&
        !(endTile.isBigWall() && (object.getBigWall() < 1 || object.getBigWall() > 3))) {
        test = VoxelType.V_OUTOFBOUNDS;
      }
    }
    return test;
  }

  move(): boolean {
    if (this._trajectory.length === 0) {
      return false;
    }
    for (let i = 0; i < this._speed; ++i) {
      this._position++;
      if (this._position === this._trajectory.length) {
        this._position--;
        return false;
      }
      if (this._save.getDepth() > 0 && this._vaporColor !== -1 && this._action.type !== BattleActionType.BA_THROW && RNG.percent(this._vaporProbability)) {
        this.addVaporCloud();
      }
    }
    return true;
  }

  getPosition(offset = 0): Position {
    return Projectile.getPositionFromStart(this._trajectory, this._position + offset);
  }

  getParticle(i: number): number {
    return this._bulletSprite !== -1 ? this._bulletSprite + i : -1;
  }

  getItem(): BattleItem | null {
    return this._action.type === BattleActionType.BA_THROW ? this._action.weapon : null;
  }

  getSprite(): Surface | null {
    return this._sprite;
  }

  skipTrajectory(): void {
    while (this.move()) {
      // Move until the precalculated path reaches its final voxel.
    }
  }

  getOrigin(): Position {
    if (this._trajectory.length === 0) {
      return this._origin.clone();
    }
    return this._trajectory[0].divide(new Position(16, 16, 24));
  }

  getTarget(): Position {
    return this._action.target.clone();
  }

  isReversed(): boolean {
    return this._reversed;
  }

  addVaporCloud(): void {
    const voxel = this._trajectory[this._position];
    const tile = voxel ? this._save.getTile(voxel.divide(new Position(16, 16, 24))) : null;
    if (!tile) {
      return;
    }
    for (let i = 0; i !== Math.max(0, this._vaporDensity); ++i) {
      let ttl = RNG.generate(32, 44);
      tile.addParticle({
        animate: () => --ttl > 0
      });
    }
  }

  private applyAccuracy(origin: Position, target: Position, accuracy: number, keepRange: boolean, extendLine: boolean): void {
    const xdiff = origin.x - target.x;
    const ydiff = origin.y - target.y;
    const realDistance = Math.sqrt(xdiff * xdiff + ydiff * ydiff);
    const maxRange = this._action.type === BattleActionType.BA_HIT ? 46 : (keepRange ? realDistance : 16 * 1000);
    const weapon = this._action.weapon?.getRules() || null;

    if (weapon && this._action.type !== BattleActionType.BA_THROW && this._action.type !== BattleActionType.BA_HIT) {
      let modifier = 0.0;
      let upperLimit = weapon.getAimRange();
      const lowerLimit = weapon.getMinRange();
      if (Options.battleUFOExtenderAccuracy) {
        if (this._action.type === BattleActionType.BA_AUTOSHOT) {
          upperLimit = weapon.getAutoRange();
        } else if (this._action.type === BattleActionType.BA_SNAPSHOT) {
          upperLimit = weapon.getSnapRange();
        }
      }
      if (realDistance / 16 < lowerLimit) {
        modifier = (weapon.getDropoff() * (lowerLimit - realDistance / 16)) / 100;
      } else if (upperLimit < realDistance / 16) {
        modifier = (weapon.getDropoff() * (realDistance / 16 - upperLimit)) / 100;
      }
      accuracy = Math.max(0.0, accuracy - modifier);
    }

    const xDist = Math.abs(origin.x - target.x);
    const yDist = Math.abs(origin.y - target.y);
    const zDist = Math.abs(origin.z - target.z);
    const xyShift = div(xDist, 2) <= yDist
      ? div(xDist, 4) + yDist
      : div(xDist + yDist, 2);
    const zShift = xyShift <= zDist
      ? div(xyShift, 2) + zDist
      : xyShift + div(zDist, 2);

    let deviation = RNG.generate(0, 100) - (accuracy * 100);
    if (deviation >= 0) {
      deviation += 50;
    } else {
      deviation += 10;
    }
    deviation = Math.max(1, div(zShift * deviation, 200));

    target.x += RNG.generate(0, deviation) - div(deviation, 2);
    target.y += RNG.generate(0, deviation) - div(deviation, 2);
    target.z += div(RNG.generate(0, div(deviation, 2)), 2) - div(deviation, 8);

    if (extendLine) {
      const rotation = Math.atan2(target.y - origin.y, target.x - origin.x);
      const tilt = Math.atan2(
        target.z - origin.z,
        Math.sqrt((target.x - origin.x) * (target.x - origin.x) + (target.y - origin.y) * (target.y - origin.y))
      );
      const cosFi = Math.cos(tilt);
      const sinFi = Math.sin(tilt);
      const cosTe = Math.cos(rotation);
      const sinTe = Math.sin(rotation);
      target.x = Math.trunc(origin.x + maxRange * cosTe * cosFi);
      target.y = Math.trunc(origin.y + maxRange * sinTe * cosFi);
      target.z = Math.trunc(origin.z + maxRange * sinFi);
    }
  }
}
