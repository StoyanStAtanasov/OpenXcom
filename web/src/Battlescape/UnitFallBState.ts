import { Options } from "../Engine/Options.ts";
import { MovementType } from "../Mod/Armor.ts";
import { SpecialAbility } from "../Mod/Unit.ts";
import { ItemDamageType } from "../Mod/RuleItem.ts";
import { UnitStatus, type BattleUnit } from "../Savegame/BattleUnit.ts";
import type { Tile } from "../Savegame/Tile.ts";
import { BattleState } from "./BattleState.ts";
import type { BattlescapeGame } from "./BattlescapeGame.ts";
import { Pathfinding } from "./Pathfinding.ts";
import { Position } from "./Position.ts";

/**
 * State for falling units.
 */
export class UnitFallBState extends BattleState {
  private _terrain = this._parent.getTileEngine();
  private _tilesToFallInto: Tile[] = [];
  private _unitsToMove: BattleUnit[] = [];

  constructor(parent: BattlescapeGame) {
    super(parent);
  }

  init(): void {
    this._terrain = this._parent.getTileEngine();
    this._parent.setStateInterval(this._parent.getSave().getSide() === 0 ? Options.battleXcomSpeed : Options.battleAlienSpeed);
  }

  think(): void {
    const save = this._parent.getSave();
    const fallingUnits = save.getFallingUnits();
    for (let index = 0; index < fallingUnits.length;) {
      const unit = fallingUnits[index];
      if (unit.getStatus() === UnitStatus.STATUS_TURNING) {
        unit.abortTurn();
      }
      if (unit.getHealth() === 0 || unit.getStunlevel() >= unit.getHealth()) {
        fallingUnits.splice(index, 1);
        continue;
      }

      const size = unit.getArmor().getSize() - 1;
      const tile = unit.getTile();
      const tileBelow = save.getTile(unit.getPosition().add(new Position(0, 0, -1)));
      if (!tile?.hasNoFloor) {
        fallingUnits.splice(index, 1);
        continue;
      }

      let largeCheck = true;
      for (let x = size; x >= 0; --x) {
        for (let y = size; y >= 0; --y) {
          const currentTile = save.getTile(unit.getPosition().add(new Position(x, y, 0)));
          const otherBelow = save.getTile(unit.getPosition().add(new Position(x, y, -1)));
          if (!currentTile?.hasNoFloor(otherBelow) || unit.getMovementType() === MovementType.MT_FLY) {
            largeCheck = false;
          }
        }
      }

      if (unit.getStatus() === UnitStatus.STATUS_WALKING || unit.getStatus() === UnitStatus.STATUS_FLYING) {
        const previous = unit.getPosition().clone();
        unit.keepWalking(tileBelow, true);
        this._parent.getMap().cacheUnit(unit);
        if (!unit.getPosition().equals(previous)) {
          this.updateUnitTiles(unit, previous, size);
        }
        index++;
        continue;
      }

      const falling = largeCheck &&
        unit.getPosition().z !== 0 &&
        tile.hasNoFloor(tileBelow) &&
        unit.getMovementType() !== MovementType.MT_FLY &&
        unit.getWalkingPhase() === 0;

      if (falling) {
        this.collectFallTargets(unit, size);
      }

      if (unit.getStatus() === UnitStatus.STATUS_STANDING) {
        if (falling) {
          const destination = unit.getPosition().add(new Position(0, 0, -1));
          const tileDest = save.getTile(destination);
          unit.startWalking(Pathfinding.DIR_DOWN, destination, tileDest, unit.getVisible());
          unit.setCache(null);
          this._parent.getMap().cacheUnit(unit);
          index++;
        } else {
          if (unit.getSpecialAbility() === SpecialAbility.SPECAB_BURNFLOOR ||
            unit.getSpecialAbility() === SpecialAbility.SPECAB_BURN_AND_EXPLODE) {
            const currentTile = save.getTile(unit.getPosition());
            currentTile?.ignite(1);
            const groundVoxel = unit.getPosition().multiply(new Position(16, 16, 24)).add(new Position(8, 8, -(currentTile?.getTerrainLevel() || 0)));
            this._parent.getTileEngine()?.hit(groundVoxel, unit.getBaseStats().strength, ItemDamageType.DT_IN, unit);
          }
          this._terrain?.calculateUnitLighting();
          this._parent.getMap().cacheUnit(unit);
          unit.setCache(null);
          this._terrain?.calculateFOV(unit);
          this._parent.checkForProximityGrenades(unit);
          if (unit.getStatus() === UnitStatus.STATUS_STANDING) {
            fallingUnits.splice(index, 1);
          } else {
            index++;
          }
        }
      } else {
        index++;
      }
    }

    if (this._unitsToMove.length > 0) {
      for (const unitBelow of this._unitsToMove.splice(0)) {
        unitBelow.knockOut(this._parent);
      }
      this._parent.checkForCasualties(null, null);
    }

    if (fallingUnits.length === 0) {
      this._tilesToFallInto.length = 0;
      this._unitsToMove.length = 0;
      this._parent.popState();
    }
  }

  private collectFallTargets(unit: BattleUnit, size: number): void {
    const save = this._parent.getSave();
    const fallingUnits = save.getFallingUnits();
    for (let x = size; x >= 0; --x) {
      for (let y = size; y >= 0; --y) {
        const target = save.getTile(unit.getPosition().add(new Position(x, y, -1)));
        if (!target) {
          continue;
        }
        this._tilesToFallInto.push(target);
        const unitBelow = target.getUnit();
        if (unitBelow &&
          !fallingUnits.includes(unitBelow) &&
          !this._unitsToMove.includes(unitBelow)) {
          this._unitsToMove.push(unitBelow);
        }
      }
    }
  }

  private updateUnitTiles(unit: BattleUnit, previous: Position, size: number): void {
    const save = this._parent.getSave();
    for (let x = size; x >= 0; --x) {
      for (let y = size; y >= 0; --y) {
        const oldTile = save.getTile(previous.add(new Position(x, y, 0)));
        if (oldTile?.getUnit() === unit) {
          oldTile.setUnit(null);
        }
      }
    }
    for (let x = size; x >= 0; --x) {
      for (let y = size; y >= 0; --y) {
        save.getTile(unit.getPosition().add(new Position(x, y, 0)))?.setUnit(unit);
      }
    }
  }
}
