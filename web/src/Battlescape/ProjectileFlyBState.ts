import { Options } from "../Engine/Options.ts";
import { KMOD_CTRL } from "../types.ts";
import { MovementType } from "../Mod/Armor.ts";
import { Mod } from "../Mod/Mod.ts";
import { TilePart, VoxelType } from "../Mod/MapData.ts";
import { BattleType } from "../Mod/RuleItem.ts";
import type { BattleItem } from "../Savegame/BattleItem.ts";
import { UnitFaction, type BattleUnit } from "../Savegame/BattleUnit.ts";
import type { Tile } from "../Savegame/Tile.ts";
import { BattleState, cloneBattleAction } from "./BattleState.ts";
import { BattleActionType, type BattleAction, type BattlescapeGame } from "./BattlescapeGame.ts";
import { Explosion } from "./Explosion.ts";
import { ExplosionBState } from "./ExplosionBState.ts";
import { CursorType } from "./Map.ts";
import { Position, type PositionLike } from "./Position.ts";
import { Projectile } from "./Projectile.ts";

function samePosition(a: PositionLike, b: PositionLike): boolean {
  return a.x === b.x && a.y === b.y && a.z === b.z;
}

/**
 * A projectile state.
 */
export class ProjectileFlyBState extends BattleState {
  private _unit: BattleUnit | null = null;
  private _ammo: BattleItem | null = null;
  private _projectileItem: BattleItem | null = null;
  private _origin: Position;
  private _targetVoxel = new Position();
  private _originVoxel = new Position(-1, -1, -1);
  private _projectileImpact: VoxelType = VoxelType.V_EMPTY;
  private _initialized = false;
  private _targetFloor = false;

  constructor(parent: BattlescapeGame, action: BattleAction, origin?: PositionLike) {
    super(parent, action);
    this._origin = origin ? Position.from(origin) : (action.actor?.getPosition().clone() || new Position());
  }

  init(): void {
    if (this._initialized) {
      return;
    }
    this._initialized = true;

    const weapon = this._action.weapon;
    const save = this._parent.getSave();
    const engine = this._parent.getTileEngine();
    this._projectileItem = null;

    if (!weapon || !this._action.actor || !engine) {
      this._parent.popState();
      return;
    }
    const targetTile = save.getTile(this._action.target);
    if (!targetTile) {
      this._parent.popState();
      return;
    }
    if (this._parent.getPanicHandled() && this._action.actor.getTimeUnits() < this._action.TU) {
      this._action.result = "STR_NOT_ENOUGH_TIME_UNITS";
      this._parent.popState();
      return;
    }

    this._unit = this._action.actor;
    this._ammo = weapon.getAmmoItem();
    if (this._unit.isOut() || this._unit.getHealth() === 0 || this._unit.getHealth() < this._unit.getStunlevel()) {
      this._parent.popState();
      return;
    }

    const distanceSq = engine.distanceUnitToPositionSq(this._action.actor, this._action.target, false);
    const isPlayer = save.getSide() === UnitFaction.FACTION_PLAYER;
    if (isPlayer) {
      this._parent.getMap().resetObstacles();
    }

    switch (this._action.type) {
      case BattleActionType.BA_SNAPSHOT:
      case BattleActionType.BA_AIMEDSHOT:
      case BattleActionType.BA_AUTOSHOT:
      case BattleActionType.BA_LAUNCH:
        if (!this._ammo) {
          this._action.result = "STR_NO_AMMUNITION_LOADED";
          this._parent.popState();
          return;
        }
        if (this._ammo.getAmmoQuantity() === 0) {
          this._action.result = "STR_NO_ROUNDS_LEFT";
          this._parent.popState();
          return;
        }
        if (distanceSq > weapon.getRules().getMaxRangeSq()) {
          const maxRange = weapon.getRules().getMaxRange();
          if (!((maxRange === 1 && distanceSq <= 3) || (maxRange === 2 && distanceSq <= 6))) {
            this._action.result = "STR_OUT_OF_RANGE";
            this._parent.popState();
            return;
          }
        }
        break;
      case BattleActionType.BA_THROW:
        if (!ProjectileFlyBState.validThrowRange(this._action, engine.getOriginVoxel(this._action, null), targetTile)) {
          this._action.result = "STR_OUT_OF_RANGE";
          this._parent.popState();
          return;
        }
        if (targetTile.getTerrainLevel() === -24 && targetTile.getPosition().z + 1 < save.getMapSizeZ()) {
          this._action.target.z += 1;
        }
        this._projectileItem = weapon;
        break;
      default:
        this._parent.popState();
        return;
    }

    let forceEnableObstacles = false;
    const forceFire = Options.forceFire && (Options.getKeyModifiers() & KMOD_CTRL) !== 0 && isPlayer;
    if (this._action.type === BattleActionType.BA_LAUNCH || forceFire || !this._parent.getPanicHandled()) {
      this._targetVoxel = this._action.target.multiply(new Position(16, 16, 24)).add(new Position(8, 8, 12));
      if (this._action.type === BattleActionType.BA_LAUNCH) {
        this._targetVoxel.z += this._targetFloor ? -10 : 4;
      }
    } else if (!weapon.getRules().getArcingShot()) {
      const originVoxel = engine.getOriginVoxel(this._action, save.getTile(this._origin));
      const unit = targetTile.getUnit();
      if (unit && (this._unit.getFaction() !== UnitFaction.FACTION_PLAYER || unit.getVisible())) {
        if (samePosition(this._origin, this._action.target) || unit === this._unit) {
          this._targetVoxel = this._action.target.multiply(new Position(16, 16, 24)).add(new Position(8, 8, 0));
        } else if (!engine.canTargetUnit(originVoxel, targetTile, this._targetVoxel, this._unit, isPlayer)) {
          this._targetVoxel = new Position(-16, -16, -24);
          if (isPlayer) {
            forceEnableObstacles = true;
          }
        }
      } else if (targetTile.getMapData(TilePart.O_OBJECT)) {
        if (!engine.canTargetTile(originVoxel, targetTile, TilePart.O_OBJECT, this._targetVoxel, this._unit, isPlayer)) {
          this._targetVoxel = this._action.target.multiply(new Position(16, 16, 24)).add(new Position(8, 8, 10));
        }
      } else if (targetTile.getMapData(TilePart.O_NORTHWALL)) {
        if (!engine.canTargetTile(originVoxel, targetTile, TilePart.O_NORTHWALL, this._targetVoxel, this._unit, isPlayer)) {
          this._targetVoxel = this._action.target.multiply(new Position(16, 16, 24)).add(new Position(8, 0, 9));
        }
      } else if (targetTile.getMapData(TilePart.O_WESTWALL)) {
        if (!engine.canTargetTile(originVoxel, targetTile, TilePart.O_WESTWALL, this._targetVoxel, this._unit, isPlayer)) {
          this._targetVoxel = this._action.target.multiply(new Position(16, 16, 24)).add(new Position(0, 8, 9));
        }
      } else if (targetTile.getMapData(TilePart.O_FLOOR)) {
        if (!engine.canTargetTile(originVoxel, targetTile, TilePart.O_FLOOR, this._targetVoxel, this._unit, isPlayer)) {
          this._targetVoxel = this._action.target.multiply(new Position(16, 16, 24)).add(new Position(8, 8, 2));
        }
      } else {
        engine.canTargetTile(originVoxel, targetTile, 999, this._targetVoxel, this._unit, isPlayer);
        this._targetVoxel = this._action.target.multiply(new Position(16, 16, 24)).add(new Position(8, 8, 12));
      }
    } else {
      this._targetVoxel = this._action.target.multiply(new Position(16, 16, 24)).add(new Position(8, 8, 12));
    }

    if (this.createNewProjectile()) {
      this._parent.getMap().setCursorType(CursorType.CT_NONE);
      this._parent.getMap().getCamera().stopMouseScrolling();
      this._parent.getMap().disableObstacles();
    } else if (isPlayer && (this._targetVoxel.z >= 0 || forceEnableObstacles)) {
      this._parent.getMap().enableObstacles();
    }
  }

  think(): void {
    this._parent.getSave().getBattleState()?.clearMouseScrollingState();
    const map = this._parent.getMap();
    const projectile = map.getProjectile();
    if (!projectile) {
      if (!this.tryNextAutoShot()) {
        this.finishState();
      }
      return;
    }

    if (this._action.type !== BattleActionType.BA_THROW && this._ammo && this._ammo.getRules().getShotgunPellets() !== 0) {
      projectile.skipTrajectory();
    }

    if (projectile.move()) {
      map.invalidate();
      return;
    }

    this.handleImpact(projectile);
    map.setProjectile(null);
    map.invalidate();
  }

  cancel(): void {
    const projectile = this._parent.getMap().getProjectile();
    if (!projectile) {
      return;
    }
    projectile.skipTrajectory();
    const p = projectile.getPosition();
    const tilePos = new Position(Math.trunc(p.x / 16), Math.trunc(p.y / 16), Math.trunc(p.z / 24));
    if (!this._parent.getMap().getCamera().isOnScreen(tilePos, false, 0, false)) {
      this._parent.getMap().getCamera().centerOnPosition(tilePos);
    }
  }

  static validThrowRange(action: BattleAction, originLike: PositionLike, target: Tile | null): boolean {
    if (action.type !== BattleActionType.BA_THROW) {
      return true;
    }
    if (!action.actor || !action.weapon || !target) {
      return false;
    }
    const origin = Position.from(originLike);
    const offset = 2;
    const zd = origin.z - ((action.target.z * 24 + offset) - target.getTerrainLevel());
    let weight = action.weapon.getRules().getWeight();
    const ammo = action.weapon.getAmmoItem();
    if (ammo && ammo !== action.weapon) {
      weight += ammo.getRules().getWeight();
    }
    const maxDistance = (ProjectileFlyBState.getMaxThrowDistance(weight, action.actor.getBaseStats().strength, zd) + 8) / 16.0;
    const xdiff = action.target.x - action.actor.getPosition().x;
    const ydiff = action.target.y - action.actor.getPosition().y;
    const realDistance = Math.sqrt(xdiff * xdiff + ydiff * ydiff);
    return realDistance <= maxDistance;
  }

  static getMaxThrowDistance(weight: number, strength: number, level: number): number {
    let curZ = level + 0.5;
    let dz = 1.0;
    let dist = 0;
    while (dist < 4000) {
      dist += 8;
      if (dz < -1) {
        curZ -= 8;
      } else {
        curZ += dz * 8;
      }

      if (curZ < 0 && dz < 0) {
        dz = Math.max(dz, -1.0);
        if (Math.abs(dz) > 1e-10) {
          dist -= curZ / dz;
        }
        break;
      }
      dz -= (50 * weight / strength) / 100;
      if (dz <= -2.0) {
        break;
      }
    }
    return Math.trunc(dist);
  }

  setOriginVoxel(pos: PositionLike): void {
    this._originVoxel = Position.from(pos);
  }

  targetFloor(): void {
    this._targetFloor = true;
  }

  projectileHitUnit(posLike: PositionLike): void {
    const pos = Position.from(posLike).divide(new Position(16, 16, 24));
    const victim = this._parent.getSave().getTile(pos)?.getUnit() || null;
    const targetVictim = this._parent.getSave().getTile(this._action.target)?.getUnit() || null;
    if (!victim || victim.isOut() || !this._unit) {
      return;
    }

    victim.getStatistics().hitCounter++;
    if (this._unit.getOriginalFaction() === UnitFaction.FACTION_PLAYER && victim.getOriginalFaction() === UnitFaction.FACTION_PLAYER) {
      victim.getStatistics().shotByFriendlyCounter++;
      this._unit.getStatistics().shotFriendlyCounter++;
    }
    if (victim === targetVictim) {
      const distanceSq = this._parent.getTileEngine()?.distanceUnitToPositionSq(this._action.actor!, victim.getPosition(), false) || 0;
      const distance = Math.ceil(Math.sqrt(distanceSq));
      let accuracy = this._unit.getFiringAccuracy(this._action.type, this._action.weapon!);
      if (Options.battleUFOExtenderAccuracy) {
        const weapon = this._action.weapon!.getRules();
        let upperLimit = weapon.getAimRange();
        const lowerLimit = weapon.getMinRange();
        if (this._action.type === BattleActionType.BA_AUTOSHOT) {
          upperLimit = weapon.getAutoRange();
        } else if (this._action.type === BattleActionType.BA_SNAPSHOT) {
          upperLimit = weapon.getSnapRange();
        }
        if (distance > upperLimit) {
          accuracy -= (distance - upperLimit) * weapon.getDropoff();
        } else if (distance < lowerLimit) {
          accuracy -= (lowerLimit - distance) * weapon.getDropoff();
        }
        if (accuracy < 0) {
          accuracy = 0;
        }
      }
      this._unit.getStatistics().shotsLandedCounter++;
      if (distance > 30) {
        this._unit.getStatistics().longDistanceHitCounter++;
      }
      if (accuracy < distance) {
        this._unit.getStatistics().lowAccuracyHitCounter++;
      }
    }
    if (victim.getFaction() === UnitFaction.FACTION_HOSTILE) {
      const ai = victim.getAIModule();
      if (ai?.setWasHitBy) {
        ai.setWasHitBy(this._unit);
        this._unit.setTurnsSinceSpotted(0);
      }
    }
    victim.setMurdererId(this._unit.getId());
    if (this._action.weapon) {
      victim.setMurdererWeapon(this._action.weapon.getRules().getName());
    }
    if (this._ammo) {
      victim.setMurdererWeaponAmmo(this._ammo.getRules().getName());
    }
  }

  private createNewProjectile(): boolean {
    if (!this._unit || !this._action.weapon) {
      this._parent.popState();
      return false;
    }
    this._action.autoShotCounter++;
    const projectile = new Projectile(this._parent.getMod(), this._parent.getSave(), this._action, this._origin, this._targetVoxel, this._ammo);
    this._parent.getMap().setProjectile(projectile);
    this._parent.setStateInterval(1000 / 60);
    this._projectileImpact = VoxelType.V_EMPTY;

    const accuracyDivider = this._parent.getPanicHandled() ? 100.0 : 200.0;
    if (this._action.type === BattleActionType.BA_THROW) {
      this._projectileImpact = projectile.calculateThrow(this._unit.getThrowingAccuracy() / accuracyDivider);
      if (this._projectileImpact === VoxelType.V_FLOOR || this._projectileImpact === VoxelType.V_UNIT || this._projectileImpact === VoxelType.V_OBJECT) {
        if (this._unit.getFaction() !== UnitFaction.FACTION_PLAYER && this._projectileItem?.getRules().getBattleType() === BattleType.BT_GRENADE) {
          this._projectileItem.setFuseTimer(0);
        }
        this._projectileItem?.moveToOwner(null);
        this._unit.setCache(0);
        this._parent.getMap().cacheUnit(this._unit);
        this._parent.getMod()?.getSoundByDepth(Mod.ITEM_THROW, this._parent.getDepth(), false)
          ?.play(-1, this._parent.getMap().getSoundAngle(this._unit.getPosition()));
        this._unit.addThrowingExp();
        return true;
      }
      this._parent.getMap().setProjectile(null);
      this._action.result = "STR_UNABLE_TO_THROW_HERE";
      this._action.TU = 0;
      this._parent.popState();
      return false;
    }

    if (this._action.weapon.getRules().getArcingShot()) {
      this._projectileImpact = projectile.calculateThrow(this._unit.getFiringAccuracy(this._action.type, this._action.weapon) / accuracyDivider);
      if (this._projectileImpact !== VoxelType.V_EMPTY && this._projectileImpact !== VoxelType.V_OUTOFBOUNDS) {
        this.startShotAnimation(projectile, true);
        return true;
      }
      this.failShot(projectile);
      return false;
    }

    if (!samePosition(this._originVoxel, new Position(-1, -1, -1))) {
      this._projectileImpact = projectile.calculateTrajectory(this._unit.getFiringAccuracy(this._action.type, this._action.weapon) / accuracyDivider, this._originVoxel, false);
    } else {
      this._projectileImpact = projectile.calculateTrajectory(this._unit.getFiringAccuracy(this._action.type, this._action.weapon) / accuracyDivider);
    }

    if (!samePosition(this._targetVoxel, new Position(-16, -16, -24)) &&
      (this._projectileImpact !== VoxelType.V_EMPTY || this._action.type === BattleActionType.BA_LAUNCH)) {
      this.startShotAnimation(projectile);
      if (this._action.type !== BattleActionType.BA_LAUNCH) {
        this._unit.getStatistics().shotsFiredCounter++;
      }
      return true;
    }

    this.failShot(projectile);
    return false;
  }

  private startShotAnimation(projectile: Projectile, useUnitPosition = false): void {
    if (!this._unit || !this._ammo || !this._action.weapon) {
      return;
    }
    this._unit.aim(true);
    this._unit.setCache(0);
    this._parent.getMap().cacheUnit(this._unit);
    const fireSound = this._ammo.getRules().getFireSound() !== -1
      ? this._ammo.getRules().getFireSound()
      : this._action.weapon.getRules().getFireSound();
    if (fireSound !== -1) {
      const anglePosition = useUnitPosition ? this._unit.getPosition() : projectile.getOrigin();
      this._parent.getMod()?.getSoundByDepth(fireSound, this._parent.getDepth(), false)
        ?.play(-1, this._parent.getMap().getSoundAngle(anglePosition));
    }
    if (!this._parent.getSave().getDebugMode() && this._action.type !== BattleActionType.BA_LAUNCH && !this._ammo.spendBullet()) {
      this._parent.getSave().removeItem(this._ammo);
      this._action.weapon.setAmmoItem(null);
    }
  }

  private failShot(_projectile: Projectile): void {
    this._parent.getMap().setProjectile(null);
    if (this._parent.getPanicHandled()) {
      this._action.result = "STR_NO_LINE_OF_FIRE";
    } else if (this._unit) {
      this._unit.setTimeUnits(this._unit.getTimeUnits() + this._action.TU);
    }
    this._unit?.abortTurn();
    this._parent.popState();
  }

  private tryNextAutoShot(): boolean {
    if (!this._unit || !this._ammo || !this._action.weapon || this._action.type !== BattleActionType.BA_AUTOSHOT) {
      return false;
    }
    const tile = this._parent.getSave().getTile(this._action.actor!.getPosition());
    const below = this._parent.getSave().getTile(this._action.actor!.getPosition().add(new Position(0, 0, -1)));
    const hasFloor = Boolean(tile && !tile.hasNoFloor(below));
    const unitCanFly = this._action.actor!.getMovementType() === MovementType.MT_FLY;
    if (this._action.autoShotCounter < this._action.weapon.getRules().getAutoShots() &&
      !this._action.actor!.isOut() &&
      this._ammo.getAmmoQuantity() !== 0 &&
      (hasFloor || unitCanFly)) {
      return this.createNewProjectile();
    }
    return false;
  }

  private finishState(): void {
    if (this._action.cameraPosition.z !== -1 && this._action.waypoints.length <= 1) {
      this._parent.getMap().getCamera().setMapOffset(this._action.cameraPosition);
      this._parent.getMap().invalidate();
    }
    if (this._unit && !this._parent.getSave().getUnitsFalling() && this._parent.getPanicHandled()) {
      this._parent.getTileEngine()?.checkReactionFire(this._unit);
    }
    if (this._unit && !this._unit.isOut()) {
      this._unit.abortTurn();
    }
    if (this._parent.getSave().getSide() === UnitFaction.FACTION_PLAYER || this._parent.getSave().getDebugMode()) {
      this._parent.setupCursor();
    }
    this._parent.convertInfected();
    this._parent.popState();
  }

  private handleImpact(projectile: Projectile): void {
    if (!this._unit) {
      return;
    }
    if (this._action.type === BattleActionType.BA_THROW) {
      this._parent.getMap().resetCameraSmoothing();
      const pos = projectile.getPosition(Projectile.ItemDropVoxelOffset).divide(new Position(16, 16, 24));
      if (pos.y > this._parent.getSave().getMapSizeY()) {
        pos.y--;
      }
      if (pos.x > this._parent.getSave().getMapSizeX()) {
        pos.x--;
      }
      const item = projectile.getItem();
      if (item) {
        this._parent.getMod()?.getSoundByDepth(Mod.ITEM_DROP, this._parent.getDepth(), false)
          ?.play(-1, this._parent.getMap().getSoundAngle(pos));
        if (Options.battleInstantGrenade && item.getRules().getBattleType() === BattleType.BT_GRENADE && item.getFuseTimer() === 0) {
          this._parent.statePushFront(new ExplosionBState(this._parent, projectile.getPosition(Projectile.ItemDropVoxelOffset), item, this._action.actor));
        } else {
          this._parent.dropItem(pos, item);
          if (this._unit.getFaction() !== UnitFaction.FACTION_PLAYER && item.getRules().getBattleType() === BattleType.BT_GRENADE) {
            this._parent.getTileEngine()?.setDangerZone(pos, item.getRules().getExplosionRadius(), this._action.actor);
          }
        }
      }
      return;
    }

    if (this._action.type === BattleActionType.BA_LAUNCH && this._action.waypoints.length > 1 && this._projectileImpact === VoxelType.V_EMPTY) {
      this._origin = this._action.waypoints.shift() || this._origin;
      this._action.target = this._action.waypoints[0]?.clone() || this._action.target;
      const nextWaypoint = new ProjectileFlyBState(this._parent, cloneBattleAction(this._action), this._origin);
      nextWaypoint.setOriginVoxel(projectile.getPosition(-1));
      if (samePosition(this._origin, this._action.target)) {
        nextWaypoint.targetFloor();
      }
      this._parent.statePushNext(nextWaypoint);
      return;
    }

    const targetUnit = this._parent.getSave().getTile(this._action.target)?.getUnit() || null;
    if (targetUnit) {
      targetUnit.getStatistics().shotAtCounter++;
    }
    this._parent.getMap().resetCameraSmoothing();
    if (this._ammo && this._action.type === BattleActionType.BA_LAUNCH && !this._ammo.spendBullet()) {
      this._parent.getSave().removeItem(this._ammo);
      this._action.weapon?.setAmmoItem(null);
    }
    const lowerWeapon = this._action.type !== BattleActionType.BA_AUTOSHOT ||
      this._action.autoShotCounter === (this._action.weapon?.getRules().getAutoShots() || 0) ||
      !this._action.weapon?.getAmmoItem();
    if (this._ammo && this._projectileImpact !== VoxelType.V_OUTOFBOUNDS) {
      let offset = 0;
      if (this._ammo.getRules().getExplosionRadius() !== 0 && this._projectileImpact !== VoxelType.V_UNIT) {
        offset = -2;
      }
      this._parent.statePushFront(new ExplosionBState(this._parent, projectile.getPosition(offset), this._ammo, this._action.actor, null, lowerWeapon));
      if (this._projectileImpact === VoxelType.V_UNIT) {
        this.projectileHitUnit(projectile.getPosition(offset));
      }
      const firingXP = this._unit.getFiringXP();
      if (this._ammo.getRules().getShotgunPellets() !== 0) {
        let i = 1;
        while (i !== this._ammo.getRules().getShotgunPellets()) {
          const proj = new Projectile(this._parent.getMod(), this._parent.getSave(), this._action, this._origin, this._targetVoxel, this._ammo);
          const secondaryImpact = proj.calculateTrajectory(Math.max(0.0, (this._unit.getFiringAccuracy(this._action.type, this._action.weapon!) / 100.0) - i * 5.0));
          if (secondaryImpact !== VoxelType.V_EMPTY) {
            proj.skipTrajectory();
            if (secondaryImpact !== VoxelType.V_OUTOFBOUNDS) {
              const impactPosition = proj.getPosition(offset);
              if (secondaryImpact === VoxelType.V_UNIT) {
                this.projectileHitUnit(impactPosition);
              }
              this._parent.getMap().getExplosions().push(new Explosion(impactPosition, this._ammo.getRules().getHitAnimation()));
              if (this._ammo.getRules().getExplosionRadius() !== 0) {
                this._parent.getTileEngine()?.explode(impactPosition, this._ammo.getRules().getPower(), this._ammo.getRules().getDamageType(), this._ammo.getRules().getExplosionRadius(), this._unit);
              } else {
                this._parent.getSave().getTileEngine()?.hit(impactPosition, this._ammo.getRules().getPower(), this._ammo.getRules().getDamageType(), this._unit);
              }
            }
          }
          ++i;
        }
      }
      if (this._unit.getFiringXP() > firingXP + 1) {
        this._unit.nerfFiringXP(firingXP + 1);
      }
    } else if (this._projectileImpact === VoxelType.V_OUTOFBOUNDS && lowerWeapon) {
      this._unit.aim(false);
      this._unit.setCache(0);
      this._parent.getMap().cacheUnits();
    }
  }
}
