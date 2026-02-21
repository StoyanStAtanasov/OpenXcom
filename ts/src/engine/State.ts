import type { Game } from "./Game";

export type StateTransition =
  | { type: "none" }
  | { type: "switch"; next: GameState }
  | { type: "quit" };

export interface StateContext {
  game: Game;
}

export interface GameState {
  readonly id: string;
  enter?(ctx: StateContext): void;
  exit?(ctx: StateContext): void;
  update(ctx: StateContext, dtMs: number): StateTransition | void;
  render(ctx: StateContext): void;
  onPointerDown?(ctx: StateContext, x: number, y: number): StateTransition | void;
  onKeyDown?(ctx: StateContext, event: KeyboardEvent): StateTransition | void;
}

export const noTransition = (): StateTransition => ({ type: "none" });
