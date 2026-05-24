import { UnitStatus, type BattleUnit } from "../Savegame/BattleUnit.ts";
import { RNG } from "../Engine/RNG.ts";
import { BattleActionType, createBattleAction, type BattlescapeGame } from "./BattlescapeGame.ts";
import { BattleState } from "./BattleState.ts";
import { Position } from "./Position.ts";
import { ProjectileFlyBState } from "./ProjectileFlyBState.ts";
import { UnitTurnBState } from "./UnitTurnBState.ts";

/**
 * State for panicking units.
 */
export class UnitPanicBState extends BattleState {
  private _berserking = false;
  private _shotsFired = 0;

  constructor(parent: BattlescapeGame, private _unit: BattleUnit | null) {
    super(parent);
    this._berserking = this._unit?.getStatus() === UnitStatus.STATUS_BERSERK;
    this._unit?.abortTurn();
  }

  init(): void {}

  think(): void {
    if (this._unit) {
      if (!this._unit.isOut() && this._shotsFired < 10 && this._berserking) {
        this._shotsFired++;
        const ba = createBattleAction();
        ba.actor = this._unit;
        ba.weapon = this._unit.getMainHandWeapon();
        if (ba.weapon &&
          (ba.weapon.getRules().getTUSnap() || ba.weapon.getRules().getTUAuto()) &&
          this._parent.getSave().isItemUsable(ba.weapon)) {
          ba.type = ba.weapon.getRules().getTUAuto() ? BattleActionType.BA_AUTOSHOT : BattleActionType.BA_SNAPSHOT;
          ba.TU = this._unit.getActionTUs(ba.type, ba.weapon);
          if (this._unit.getTimeUnits() >= ba.TU) {
            ba.target = this.findBerserkTarget(this._unit);
            let turnCost = Math.abs(this._unit.getDirection() - this._unit.directionTo(ba.target));
            if (turnCost > 4) {
              turnCost = 8 - turnCost;
            }

            this._parent.statePushFront(new UnitTurnBState(this._parent, ba, false));
            if (this._unit.spendTimeUnits(ba.TU + turnCost)) {
              this._parent.statePushNext(new ProjectileFlyBState(this._parent, ba));
            } else {
              this._unit.spendTimeUnits(turnCost);
            }
          }
        }
        return;
      }
      if (!this._unit.isOut()) {
        this._unit.abortTurn();
      }
      this._unit.setTimeUnits(0);
    }
    this._parent.popState();
    this._parent.setupCursor();
  }

  cancel(): void {}

  private findBerserkTarget(unit: BattleUnit): Position {
    if (unit.getVisibleUnits().length !== 0) {
      let dist = 255;
      let target = unit.getVisibleUnits()[0].getPosition().clone();
      for (const visibleUnit of unit.getVisibleUnits()) {
        const newDist = this._parent.getTileEngine()?.distance(unit.getPosition(), visibleUnit.getPosition()) ?? 255;
        if (newDist < dist) {
          target = visibleUnit.getPosition().clone();
          dist = newDist;
        }
      }
      return target;
    }
    return new Position(unit.getPosition().x + RNG.generate(-6, 6), unit.getPosition().y + RNG.generate(-6, 6), unit.getPosition().z);
  }
}
