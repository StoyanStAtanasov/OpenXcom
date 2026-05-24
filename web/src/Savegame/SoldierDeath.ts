import { GameTime } from "./GameTime.ts";

export type BattleUnitKills = {
  faction?: number;
  race?: string;
  mission?: number;
};

export class SoldierDeath {
  private _time: GameTime;

  constructor(time: GameTime = new GameTime(0, 0, 0, 0, 0, 0, 0), private _cause: BattleUnitKills | null = null) {
    this._time = time.clone();
  }

  getTime(): GameTime {
    return this._time;
  }

  getCause(): BattleUnitKills | null {
    return this._cause;
  }
}
