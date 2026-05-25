import { Options } from "../Engine/Options.ts";
import { MovementType } from "../Mod/Armor.ts";
import { Mod } from "../Mod/Mod.ts";
import { ItemDamageType } from "../Mod/RuleItem.ts";
import { SpecialAbility } from "../Mod/Unit.ts";
import { UnitFaction, UnitStatus, type BattleUnit } from "../Savegame/BattleUnit.ts";
import { Position } from "./Position.ts";
import { BattleActionType, createBattleAction, type BattleAction, type BattlescapeGame } from "./BattlescapeGame.ts";
import { BattleState } from "./BattleState.ts";
import { Pathfinding } from "./Pathfinding.ts";
import { MeleeAttackBState } from "./MeleeAttackBState.ts";
import { UnitFallBState } from "./UnitFallBState.ts";
import type { TileEngine } from "./TileEngine.ts";

/**
 * State for walking units.
 */
export class UnitWalkBState extends BattleState {
  private _target = new Position();
  private _unit: BattleUnit | null = null;
  private _pf: Pathfinding | null = null;
  private _terrain: TileEngine | null = null;
  private _falling = false;
  private _beforeFirstStep = false;
  private _numUnitsSpotted = 0;
  private _preMovementCost = 0;

  constructor(parent: BattlescapeGame, action: BattleAction) {
    super(parent, action);
  }

  init(): void {
    this._unit = this._action.actor;
    if (!this._unit) {
      this._parent.popState();
      return;
    }

    this._numUnitsSpotted = this._unit.getUnitsSpottedThisTurn().length;
    this.setNormalWalkSpeed();
    this._pf = this._parent.getPathfinding();
    this._terrain = this._parent.getTileEngine();
    this._target = this._action.target.clone();
    const dir = this._pf?.getStartDirection() ?? -1;
    if (!this._action.strafe && dir !== -1 && dir !== this._unit.getDirection()) {
      this._beforeFirstStep = true;
    }
  }

  think(): void {
    const unit = this._unit;
    const pf = this._pf;
    const terrain = this._terrain;
    if (!unit || !pf || !terrain) {
      this._parent.popState();
      return;
    }

    let unitSpotted = false;
    const size = unit.getArmor().getSize() - 1;
    const camera = this._parent.getMap().getCamera();
    const onScreen = unit.getVisible() && camera.isOnScreen(unit.getPosition(), true, size, false);

    if (unit.isKneeled()) {
      if (this._parent.kneel(unit)) {
        unit.setCache(null);
        terrain.calculateFOV(unit);
        this._parent.getMap().cacheUnit(unit);
        return;
      }
      this._action.result = "STR_NOT_ENOUGH_TIME_UNITS";
      pf.abortPath();
      this._parent.popState();
      return;
    }

    if (unit.isOut()) {
      pf.abortPath();
      this._parent.popState();
      return;
    }

    if (unit.getStatus() === UnitStatus.STATUS_WALKING || unit.getStatus() === UnitStatus.STATUS_FLYING) {
      const tileBelow = this._parent.getSave().getTile(unit.getPosition().add(new Position(0, 0, -1)));
      const destinationTile = this._parent.getSave().getTile(unit.getDestination());
      if (!destinationTile?.getUnit() || destinationTile.getUnit() === unit) {
        const onScreenBoundary = unit.getVisible() && camera.isOnScreen(unit.getPosition(), true, size, true);
        unit.keepWalking(tileBelow, onScreenBoundary);
        this.playMovementSound();
      } else if (!this._falling) {
        unit.lookAt(unit.getDestination(), unit.getTurretType() !== -1);
        pf.abortPath();
      }

      if (!unit.getPosition().equals(unit.getLastPosition())) {
        this.updateTileOccupancy(unit, size);
        const currentTile = this._parent.getSave().getTile(unit.getPosition());
        this._falling = Boolean(
          currentTile &&
          this.allPartsHaveNoFloor(unit, size) &&
          unit.getPosition().z !== 0 &&
          currentTile.hasNoFloor(tileBelow) &&
          unit.getMovementType() !== MovementType.MT_FLY &&
          unit.getWalkingPhase() === 0
        );

        if (this._falling && this.hasUnitBelow(unit, size)) {
          this._falling = false;
          pf.dequeuePath();
          this._parent.getSave().addFallingUnit(unit);
          this._parent.statePushFront(new UnitFallBState(this._parent));
          return;
        }

        if (!camera.isOnScreen(unit.getPosition(), true, size, false) && unit.getFaction() !== UnitFaction.FACTION_PLAYER && unit.getVisible()) {
          camera.centerOnPosition(unit.getPosition());
        }
        camera.setViewLevel(unit.getPosition().z);
      }

      if (unit.getStatus() === UnitStatus.STATUS_STANDING) {
        this._parent.getSave().getBattleState()?.updateSoldierInfo();
        if (!this._falling &&
          (unit.getSpecialAbility() === SpecialAbility.SPECAB_BURNFLOOR ||
            unit.getSpecialAbility() === SpecialAbility.SPECAB_BURN_AND_EXPLODE)) {
          const unitTile = this._parent.getSave().getTile(unit.getPosition());
          unitTile?.ignite(1);
          const voxelHere = unit.getPosition().multiply(new Position(16, 16, 24)).add(new Position(8, 8, -(unitTile?.getTerrainLevel() ?? 0)));
          terrain.hit(voxelHere, unit.getBaseStats().strength, ItemDamageType.DT_IN, unit);
          if (unit.getStatus() !== UnitStatus.STATUS_STANDING) {
            pf.abortPath();
            return;
          }
        }

        terrain.calculateUnitLighting();
        if (unit.getFaction() !== UnitFaction.FACTION_PLAYER) {
          unit.setVisible(false);
        }
        terrain.calculateFOV(unit.getPosition());
        unitSpotted = !this._falling &&
          !this._action.desperate &&
          this._parent.getPanicHandled() &&
          this._numUnitsSpotted !== unit.getUnitsSpottedThisTurn().length;

        if (this._parent.checkForProximityGrenades(unit)) {
          this._parent.popState();
          return;
        }
        if (unitSpotted) {
          unit.setCache(null);
          this._parent.getMap().cacheUnit(unit);
          pf.abortPath();
          this._parent.popState();
          return;
        }
        if (!this._falling && terrain.checkReactionFire(unit)) {
          unit.setCache(null);
          this._parent.getMap().cacheUnit(unit);
          pf.abortPath();
          this._parent.popState();
          return;
        }
      } else if (onScreen) {
        this.cacheWalkingUnit(unit, pf);
      }
    }

    if (unit.getStatus() === UnitStatus.STATUS_STANDING || unit.getStatus() === UnitStatus.STATUS_PANICKING) {
      if (unitSpotted && !this._action.desperate && !unit.getCharging() && !this._falling) {
        unit.setHiding(false);
        this._parent.getMap().cacheUnit(unit);
        this.postPathProcedures();
        return;
      }

      if (onScreen || this._parent.getSave().getDebugMode()) {
        this.setNormalWalkSpeed();
      } else {
        this._parent.setStateInterval(0);
      }

      let dir = this._falling ? Pathfinding.DIR_DOWN : pf.getStartDirection();
      if (dir !== -1) {
        if (pf.getStrafeMove()) {
          unit.setFaceDirection(unit.getDirection());
        }

        const destination = new Position();
        let tu = pf.getTUCost(unit.getPosition(), dir, destination, unit, null, false);
        const destinationTile = this._parent.getSave().getTile(destination);
        if (unit.getFaction() !== UnitFaction.FACTION_PLAYER &&
          unit.getSpecialAbility() < SpecialAbility.SPECAB_BURNFLOOR &&
          destinationTile &&
          destinationTile.getFire() > 0) {
          tu -= 32;
        }
        if (this._falling) {
          tu = 0;
        }
        let energy = tu;
        if (dir >= Pathfinding.DIR_UP) {
          energy = 0;
        } else if (this._action.run) {
          tu = Math.trunc(tu * 0.75);
          energy = Math.trunc(energy * 1.5);
        }

        if (tu > unit.getTimeUnits()) {
          if (this._parent.getPanicHandled() && tu < 255) {
            this._action.result = "STR_NOT_ENOUGH_TIME_UNITS";
          }
          this.abortPathAndPop(unit, pf);
          return;
        }
        if (Math.trunc(energy / 2) > unit.getEnergy()) {
          if (this._parent.getPanicHandled()) {
            this._action.result = "STR_NOT_ENOUGH_ENERGY";
          }
          this.abortPathAndPop(unit, pf);
          return;
        }
        if (this._parent.getPanicHandled() && !this._parent.checkReservedTU(unit, tu)) {
          pf.abortPath();
          unit.setCache(null);
          this._parent.getMap().cacheUnit(unit);
          return;
        }

        if (dir !== unit.getDirection() && dir < Pathfinding.DIR_UP && !pf.getStrafeMove()) {
          unit.lookAt(dir);
          unit.setCache(null);
          this._parent.getMap().cacheUnit(unit);
          return;
        }

        if (dir < Pathfinding.DIR_UP) {
          const door = terrain.unitOpensDoor(unit, false, dir);
          if (door === 3) {
            return;
          }
          if (door === 0) {
            this._parent.getMod()?.getSoundByDepth(Mod.DOOR_OPEN, this._parent.getDepth(), false)
              ?.play(-1, this._parent.getMap().getSoundAngle(unit.getPosition()));
          }
          if (door === 1) {
            this._parent.getMod()?.getSoundByDepth(Mod.SLIDING_DOOR_OPEN, this._parent.getDepth(), false)
              ?.play(-1, this._parent.getMap().getSoundAngle(unit.getPosition()));
            return;
          }
        }

        if (!this.destinationIsClear(unit, destination, size)) {
          this._action.TU = 0;
          this.abortPathAndPop(unit, pf);
          return;
        }

        dir = pf.dequeuePath();
        if (this._falling) {
          dir = Pathfinding.DIR_DOWN;
        }
        if (unit.spendTimeUnits(tu) && unit.spendEnergy(energy)) {
          const tileBelow = this._parent.getSave().getTile(unit.getPosition().add(new Position(0, 0, -1)));
          unit.startWalking(dir, destination, tileBelow, onScreen);
          this._beforeFirstStep = false;
        }
        if (onScreen) {
          this.cacheWalkingUnit(unit, pf);
        }
      } else {
        this.postPathProcedures();
        return;
      }
    }

    if (unit.getStatus() === UnitStatus.STATUS_TURNING) {
      if (this._beforeFirstStep) {
        this._preMovementCost++;
      }
      unit.turn();
      terrain.calculateFOV(unit);
      unitSpotted = !this._falling &&
        !this._action.desperate &&
        this._parent.getPanicHandled() &&
        this._numUnitsSpotted !== unit.getUnitsSpottedThisTurn().length;
      unit.setCache(null);
      this._parent.getMap().cacheUnit(unit);

      if (unitSpotted && !this._action.desperate && !unit.getCharging() && !this._falling) {
        if (this._beforeFirstStep) {
          unit.spendTimeUnits(this._preMovementCost);
        }
        unit.setHiding(false);
        pf.abortPath();
        unit.abortTurn();
        unit.setCache(null);
        this._parent.getMap().cacheUnit(unit);
        this._parent.popState();
      }
    }
  }

  cancel(): void {
    if (this._parent.getSave().getSide() === UnitFaction.FACTION_PLAYER && this._parent.getPanicHandled()) {
      this._pf?.abortPath();
    }
  }

  private postPathProcedures(): void {
    const unit = this._unit;
    const terrain = this._terrain;
    if (!unit || !terrain) {
      this._parent.popState();
      return;
    }
    this._action.TU = 0;
    if (unit.getFaction() !== UnitFaction.FACTION_PLAYER) {
      let dir = this._action.finalFacing;
      if (this._action.finalAction) {
        unit.dontReselect();
      }
      if (unit.getCharging()) {
        const target = unit.getCharging();
        if (target) {
          dir = this._parent.getTileEngine()?.getDirectionTo(unit.getPosition(), target.getPosition()) ?? dir;
        }
        if (target && this._parent.getTileEngine()?.validMeleeRange(unit, target, dir)) {
          const action = createBattleAction();
          action.actor = unit;
          action.target = target.getPosition().clone();
          action.weapon = unit.getMeleeWeapon();
          action.type = BattleActionType.BA_HIT;
          action.TU = unit.getActionTUs(action.type, action.weapon);
          action.targeting = true;
          unit.setCharging(null);
          if (action.weapon) {
            this._parent.statePushBack(new MeleeAttackBState(this._parent, action));
          }
        }
      } else if (unit.isHiding()) {
        dir = unit.getDirection() + 4;
        unit.setHiding(false);
        unit.dontReselect();
      }
      if (dir !== -1) {
        if (dir >= 8) {
          dir -= 8;
        }
        unit.lookAt(dir);
        while (unit.getStatus() === UnitStatus.STATUS_TURNING) {
          unit.turn();
          terrain.calculateFOV(unit);
        }
      }
    } else if (!this._parent.getPanicHandled()) {
      unit.setTimeUnits(0);
    }

    unit.setCache(null);
    terrain.calculateUnitLighting();
    terrain.calculateFOV(unit);
    this._parent.getMap().cacheUnit(unit);
    if (!this._falling) {
      this._parent.popState();
    }
  }

  private setNormalWalkSpeed(): void {
    const unit = this._unit;
    this._parent.setStateInterval(unit?.getFaction() === UnitFaction.FACTION_PLAYER ? Options.battleXcomSpeed : Options.battleAlienSpeed);
  }

  private playMovementSound(): void {
    const unit = this._unit;
    if (!unit) {
      return;
    }
    const size = unit.getArmor().getSize() - 1;
    const map = this._parent.getMap();
    if ((!unit.getVisible() && !this._parent.getSave().getDebugMode()) ||
      !map.getCamera().isOnScreen(unit.getPosition(), true, size, false)) {
      return;
    }

    const angle = map.getSoundAngle(unit.getPosition());
    const moveSound = unit.getMoveSound();
    if (moveSound !== -1) {
      if (unit.getWalkingPhase() === 0) {
        this._parent.getMod()?.getSoundByDepth(moveSound, this._parent.getDepth(), false)
          ?.play(-1, angle);
      }
      return;
    }

    if (unit.getStatus() === UnitStatus.STATUS_WALKING) {
      const tile = unit.getTile();
      const tilePos = tile?.getPosition?.();
      if (!tile || !tilePos || !tile.getFootstepSound) {
        return;
      }
      const tileBelow = this._parent.getSave().getTile(tilePos.add(new Position(0, 0, -1)));
      const footstepSound = tile.getFootstepSound(tileBelow);
      if (footstepSound <= -1) {
        return;
      }
      if (unit.getWalkingPhase() === 3) {
        this._parent.getMod()?.getSoundByDepth(Mod.WALK_OFFSET + footstepSound * 2, this._parent.getDepth(), false)
          ?.play(-1, angle);
      }
      if (unit.getWalkingPhase() === 7) {
        this._parent.getMod()?.getSoundByDepth(1 + Mod.WALK_OFFSET + footstepSound * 2, this._parent.getDepth(), false)
          ?.play(-1, angle);
      }
    } else if (unit.getMovementType() === MovementType.MT_FLY) {
      if (unit.getWalkingPhase() === 1 && !this._falling) {
        this._parent.getMod()?.getSoundByDepth(Mod.FLYING_SOUND, this._parent.getDepth(), false)
          ?.play(-1, angle);
      }
    }
  }

  private abortPathAndPop(unit: BattleUnit, pf: Pathfinding): void {
    pf.abortPath();
    unit.setCache(null);
    this._parent.getMap().cacheUnit(unit);
    this._parent.popState();
  }

  private updateTileOccupancy(unit: BattleUnit, size: number): void {
    const save = this._parent.getSave();
    for (let x = size; x >= 0; --x) {
      for (let y = size; y >= 0; --y) {
        save.getTile(unit.getLastPosition().add(new Position(x, y, 0)))?.setUnit(null);
      }
    }
    for (let x = size; x >= 0; --x) {
      for (let y = size; y >= 0; --y) {
        const tile = save.getTile(unit.getPosition().add(new Position(x, y, 0)));
        if (tile) {
          tile.setUnit(unit, save.getTile(tile.getPosition().add(new Position(0, 0, -1))));
        }
      }
    }
  }

  private allPartsHaveNoFloor(unit: BattleUnit, size: number): boolean {
    const save = this._parent.getSave();
    for (let x = size; x >= 0; --x) {
      for (let y = size; y >= 0; --y) {
        const tile = save.getTile(unit.getPosition().add(new Position(x, y, 0)));
        const tileBelow = save.getTile(unit.getPosition().add(new Position(x, y, -1)));
        if (!tile?.hasNoFloor(tileBelow) || unit.getMovementType() === MovementType.MT_FLY) {
          return false;
        }
      }
    }
    return true;
  }

  private hasUnitBelow(unit: BattleUnit, size: number): boolean {
    const save = this._parent.getSave();
    for (let x = size; x >= 0; --x) {
      for (let y = size; y >= 0; --y) {
        if (save.getTile(unit.getPosition().add(new Position(x, y, -1)))?.getUnit()) {
          return true;
        }
      }
    }
    return false;
  }

  private destinationIsClear(unit: BattleUnit, destination: Position, size: number): boolean {
    if (this._falling) {
      return true;
    }
    const save = this._parent.getSave();
    for (let x = size; x >= 0; --x) {
      for (let y = size; y >= 0; --y) {
        const pos = destination.add(new Position(x, y, 0));
        const unitInMyWay = save.getTile(pos)?.getUnit();
        const belowDest = save.getTile(destination.add(new Position(x, y, -1)));
        const unitBelowMyWay = belowDest?.getUnit() || null;
        if ((unitInMyWay && unitInMyWay !== unit) ||
          (belowDest && unitBelowMyWay && unitBelowMyWay !== unit &&
            (-belowDest.getTerrainLevel() + unitBelowMyWay.getFloatHeight() + unitBelowMyWay.getHeight()) >= 28)) {
          return false;
        }
      }
    }
    return true;
  }

  private cacheWalkingUnit(unit: BattleUnit, pf: Pathfinding): void {
    if (pf.getStrafeMove()) {
      const dirTemp = unit.getDirection();
      unit.setDirection(unit.getFaceDirection());
      this._parent.getMap().cacheUnit(unit);
      unit.setDirection(dirTemp);
    } else {
      this._parent.getMap().cacheUnit(unit);
    }
  }
}
