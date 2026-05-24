import { Position, type PositionLike } from "./Position.ts";
import type { OpenSetEntry } from "./PathfindingOpenSet.ts";

/**
 * A class that holds pathfinding info for a certain node on the map.
 */
export class PathfindingNode {
  private _pos: Position;
  private _checked = false;
  private _tuCost = 0;
  private _prevNode: PathfindingNode | null = null;
  private _prevDir = 0;
  private _tuGuess = 0;
  // Invasive field needed by PathfindingOpenSet.
  _openentry: OpenSetEntry | null = null;

  constructor(pos: PositionLike) {
    this._pos = Position.from(pos);
  }

  getPosition(): Position {
    return this._pos.clone();
  }

  reset(): void {
    this._checked = false;
    this._openentry = null;
  }

  isChecked(): boolean {
    return this._checked;
  }

  setChecked(): void {
    this._checked = true;
  }

  getTUCost(missile: boolean): number {
    if (missile) {
      return 0;
    }
    return this._tuCost;
  }

  getPrevNode(): PathfindingNode | null {
    return this._prevNode;
  }

  getPrevDir(): number {
    return this._prevDir;
  }

  inOpenSet(): boolean {
    return this._openentry !== null;
  }

  getTUGuess(): number {
    return this._tuGuess;
  }

  connect(tuCost: number, prevNode: PathfindingNode | null, prevDir: number, target?: PositionLike): void {
    this._tuCost = tuCost;
    this._prevNode = prevNode;
    this._prevDir = prevDir;
    if (target) {
      if (!this.inOpenSet()) {
        const d = Position.from(target).subtract(this._pos);
        const squared = d.multiply(d);
        this._tuGuess = Math.trunc(4 * Math.sqrt(squared.x + squared.y + squared.z));
      }
    } else {
      this._tuGuess = 0;
    }
  }
}

/**
 * Compares PathfindingNode pointers based on TU cost.
 */
export function minNodeCosts(a: PathfindingNode, b: PathfindingNode): boolean {
  return a.getTUCost(false) < b.getTUCost(false);
}
