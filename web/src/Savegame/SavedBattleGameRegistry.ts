import type { SavedBattleGame } from "./SavedBattleGame.ts";

type SavedBattleGameCtor = new () => SavedBattleGame;

let savedBattleGameCtor: SavedBattleGameCtor | null = null;

export function registerSavedBattleGame(ctor: SavedBattleGameCtor): void {
  savedBattleGameCtor = ctor;
}

export function createRegisteredSavedBattleGame(): SavedBattleGame | null {
  return savedBattleGameCtor ? new savedBattleGameCtor() : null;
}
