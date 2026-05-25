import { GameTime } from "./GameTime.ts";
import type { BattleUnitKillsSave } from "./BattleUnitStatistics.ts";

export type SoldierDeathSave = {
  time?: {
    second?: number;
    minute?: number;
    hour?: number;
    weekday?: number;
    day?: number;
    month?: number;
    year?: number;
  };
  cause?: BattleUnitKills | null;
};

export type BattleUnitKills = BattleUnitKillsSave;

export class SoldierDeath {
  private _time: GameTime;

  constructor(time: GameTime = new GameTime(0, 0, 0, 0, 0, 0, 0), private _cause: BattleUnitKills | null = null) {
    this._time = time.clone();
  }

  load(node: SoldierDeathSave | null | undefined): void {
    if (!node) {
      return;
    }
    const time = node.time || {};
    this._time = new GameTime(
      time.weekday ?? this._time.getWeekday(),
      time.day ?? this._time.getDay(),
      time.month ?? this._time.getMonth(),
      time.year ?? this._time.getYear(),
      time.hour ?? this._time.getHour(),
      time.minute ?? this._time.getMinute(),
      time.second ?? this._time.getSecond()
    );
    this._cause = node.cause ?? this._cause;
  }

  save(): SoldierDeathSave {
    const node: SoldierDeathSave = {
      time: {
        second: this._time.getSecond(),
        minute: this._time.getMinute(),
        hour: this._time.getHour(),
        weekday: this._time.getWeekday(),
        day: this._time.getDay(),
        month: this._time.getMonth(),
        year: this._time.getYear()
      }
    };
    if (this._cause) {
      node.cause = this._cause;
    }
    return node;
  }

  getTime(): GameTime {
    return this._time;
  }

  getCause(): BattleUnitKills | null {
    return this._cause;
  }
}
