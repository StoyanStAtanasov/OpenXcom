import { Options } from "../Engine/Options.ts";
import { UnitFaction, UnitStatus, type BattleUnit } from "../Savegame/BattleUnit.ts";
import { BattleActionType, type BattleAction, type BattlescapeGame } from "./BattlescapeGame.ts";
import { BattleState } from "./BattleState.ts";

/**
 * State for turning units.
 */
export class UnitTurnBState extends BattleState {
  private _unit: BattleUnit | null = null;
  private _turret = false;

  constructor(parent: BattlescapeGame, action: BattleAction, private _chargeTUs = true) {
    super(parent, action);
  }

  init(): void {
    this._unit = this._action.actor;
    if (!this._unit || this._unit.isOut()) {
      this._parent.popState();
      return;
    }

    this._action.TU = 0;
    this._parent.setStateInterval(this._unit.getFaction() === UnitFaction.FACTION_PLAYER ? Options.battleXcomSpeed : Options.battleAlienSpeed);

    this._turret = this._unit.getTurretType() !== -1 && (this._action.targeting || this._action.strafe);
    this._unit.lookAt(this._action.target, this._turret);

    if (this._chargeTUs && this._unit.getStatus() !== UnitStatus.STATUS_TURNING) {
      if (this._action.type === BattleActionType.BA_NONE) {
        const door = this._parent.getTileEngine()?.unitOpensDoor(this._unit, true) ?? -1;
        if (door === 4) {
          this._action.result = "STR_NOT_ENOUGH_TIME_UNITS";
        }
      }
      this._parent.popState();
    }
  }

  think(): void {
    if (!this._unit) {
      this._parent.popState();
      return;
    }

    const tu = this._chargeTUs ? 1 : 0;
    if (this._chargeTUs &&
      this._unit.getFaction() === this._parent.getSave().getSide() &&
      this._parent.getPanicHandled() &&
      !this._action.targeting &&
      !this._parent.checkReservedTU(this._unit, tu)) {
      this._unit.abortTurn();
      this._parent.popState();
      return;
    }

    if (this._unit.spendTimeUnits(tu)) {
      const unitSpotted = this._unit.getUnitsSpottedThisTurn().length;
      this._unit.turn(this._turret);
      this._parent.getTileEngine()?.calculateFOV(this._unit);
      this._unit.setCache(null);
      this._parent.getMap().cacheUnit(this._unit);
      if (this._chargeTUs &&
        this._unit.getFaction() === this._parent.getSave().getSide() &&
        this._parent.getPanicHandled() &&
        this._action.type === BattleActionType.BA_NONE &&
        this._unit.getUnitsSpottedThisTurn().length > unitSpotted) {
        this._unit.abortTurn();
      }
      if (this._unit.getStatus() === UnitStatus.STATUS_STANDING) {
        this._parent.popState();
      }
    } else if (this._parent.getPanicHandled()) {
      this._action.result = "STR_NOT_ENOUGH_TIME_UNITS";
      this._unit.abortTurn();
      this._parent.popState();
    }
  }

  cancel(): void {}
}
