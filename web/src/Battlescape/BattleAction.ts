import { Position } from "./Position.ts";
import type { BattleItem } from "../Savegame/BattleItem.ts";
import type { BattleUnit } from "../Savegame/BattleUnit.ts";

export enum BattleActionType {
  BA_NONE = 0,
  BA_TURN,
  BA_WALK,
  BA_PRIME,
  BA_THROW,
  BA_AUTOSHOT,
  BA_SNAPSHOT,
  BA_AIMEDSHOT,
  BA_HIT,
  BA_USE,
  BA_LAUNCH,
  BA_MINDCONTROL,
  BA_PANIC,
  BA_RETHINK
}

export type BattleAction = {
  type: BattleActionType;
  actor: BattleUnit | null;
  weapon: BattleItem | null;
  target: Position;
  waypoints: Position[];
  TU: number;
  targeting: boolean;
  value: number;
  result: string;
  strafe: boolean;
  run: boolean;
  diff: number;
  autoShotCounter: number;
  cameraPosition: Position;
  desperate: boolean;
  finalFacing: number;
  finalAction: boolean;
  number: number;
};

export function createBattleAction(): BattleAction {
  return {
    type: BattleActionType.BA_NONE,
    actor: null,
    weapon: null,
    target: new Position(),
    waypoints: [],
    TU: 0,
    targeting: false,
    value: 0,
    result: "",
    strafe: false,
    run: false,
    diff: 0,
    autoShotCounter: 0,
    cameraPosition: new Position(0, 0, -1),
    desperate: false,
    finalFacing: -1,
    finalAction: false,
    number: 0
  };
}
