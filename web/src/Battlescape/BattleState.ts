import { BattleActionType, createBattleAction, type BattleAction, type BattlescapeGame } from "./BattlescapeGame.ts";

export function cloneBattleAction(action: BattleAction): BattleAction {
  return {
    ...action,
    target: action.target.clone(),
    waypoints: action.waypoints.map(waypoint => waypoint.clone()),
    cameraPosition: action.cameraPosition.clone()
  };
}

/**
 * This class sets the battlescape in a certain sub-state.
 * These states can be triggered by the player or the AI.
 */
export class BattleState {
  protected _action: BattleAction;

  constructor(protected _parent: BattlescapeGame, action: BattleAction = createBattleAction()) {
    this._action = cloneBattleAction(action);
    if (!action) {
      this._action.result = "";
      this._action.targeting = false;
      this._action.TU = 0;
      this._action.type = BattleActionType.BA_NONE;
    }
  }

  init(): void {}

  cancel(): void {}

  think(): void {}

  getAction(): BattleAction {
    return cloneBattleAction(this._action);
  }
}
