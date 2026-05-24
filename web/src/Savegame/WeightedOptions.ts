import { RNG } from "../Engine/RNG.ts";

function compareIds(a: string, b: string): number {
  if (a < b) {
    return -1;
  }
  if (a > b) {
    return 1;
  }
  return 0;
}

export class WeightedOptions {
  private _choices = new Map<string, number>();
  private _totalWeight = 0;

  choose(): string {
    if (this._totalWeight === 0) {
      return "";
    }
    let value = RNG.generate(0, this._totalWeight);
    for (const [id, weight] of [...this._choices.entries()].sort((a, b) => compareIds(a[0], b[0]))) {
      if (value <= weight) {
        return id;
      }
      value -= weight;
    }
    return [...this._choices.keys()].sort(compareIds)[0] || "";
  }

  set(id: string, weight: number): void {
    const current = this._choices.get(id);
    if (current != null) {
      this._totalWeight -= current;
      if (weight !== 0) {
        this._choices.set(id, weight);
        this._totalWeight += weight;
      } else {
        this._choices.delete(id);
      }
    } else if (weight !== 0) {
      this._choices.set(id, weight);
      this._totalWeight += weight;
    }
  }

  empty(): boolean {
    return this._totalWeight === 0;
  }

  clear(): void {
    this._totalWeight = 0;
    this._choices.clear();
  }

  load(node: Record<string, number>): void {
    for (const [id, weight] of Object.entries(node)) {
      this.set(id, weight);
    }
  }

  save(): Record<string, number> {
    const node: Record<string, number> = {};
    for (const [id, weight] of [...this._choices.entries()].sort((a, b) => compareIds(a[0], b[0]))) {
      node[id] = weight;
    }
    return node;
  }

  getNames(): string[] {
    return [...this._choices.keys()].sort(compareIds);
  }

  getTotalWeight(): number {
    return this._totalWeight;
  }
}
