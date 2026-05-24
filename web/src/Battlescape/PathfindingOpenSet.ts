import type { PathfindingNode } from "./PathfindingNode.ts";

export type OpenSetEntry = {
  _cost: number;
  _node: PathfindingNode | null;
};

/**
 * A class that holds references to the nodes to be examined in pathfinding.
 */
export class PathfindingOpenSet {
  private _queue: OpenSetEntry[] = [];

  pop(): PathfindingNode {
    this.removeDiscarded();
    if (this.empty()) {
      throw new Error("PathfindingOpenSet::pop called on an empty set");
    }
    const entry = this.heapPop();
    if (!entry._node) {
      throw new Error("PathfindingOpenSet::pop reached a discarded entry");
    }
    const nd = entry._node;
    nd._openentry = null;

    // Discarded entries might be visible now.
    this.removeDiscarded();
    return nd;
  }

  push(node: PathfindingNode): void {
    const entry: OpenSetEntry = {
      _node: node,
      _cost: node.getTUCost(false) + node.getTUGuess()
    };
    if (node._openentry) {
      node._openentry._node = null;
    }
    node._openentry = entry;
    this.heapPush(entry);
  }

  empty(): boolean {
    this.removeDiscarded();
    return this._queue.length === 0;
  }

  private removeDiscarded(): void {
    while (this._queue.length > 0 && this._queue[0]._node === null) {
      this.heapPop();
    }
  }

  private heapPush(entry: OpenSetEntry): void {
    this._queue.push(entry);
    let index = this._queue.length - 1;
    while (index > 0) {
      const parent = Math.trunc((index - 1) / 2);
      if (this._queue[parent]._cost <= entry._cost) {
        break;
      }
      this._queue[index] = this._queue[parent];
      index = parent;
    }
    this._queue[index] = entry;
  }

  private heapPop(): OpenSetEntry {
    const first = this._queue[0];
    const last = this._queue.pop();
    if (!first || !last) {
      throw new Error("PathfindingOpenSet heap is empty");
    }
    if (this._queue.length > 0) {
      let index = 0;
      while (true) {
        const left = index * 2 + 1;
        const right = left + 1;
        if (left >= this._queue.length) {
          break;
        }
        let child = left;
        if (right < this._queue.length && this._queue[right]._cost < this._queue[left]._cost) {
          child = right;
        }
        if (this._queue[child]._cost >= last._cost) {
          break;
        }
        this._queue[index] = this._queue[child];
        index = child;
      }
      this._queue[index] = last;
    }
    return first;
  }
}
