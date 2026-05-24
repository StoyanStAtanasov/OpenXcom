import { RNG } from "../Engine/RNG.ts";

function stripComment(line: string): string {
  let quoted = false;
  let quote = "";
  for (let i = 0; i < line.length; ++i) {
    const ch = line[i];
    if ((ch === "\"" || ch === "'") && (i === 0 || line[i - 1] !== "\\")) {
      if (!quoted) {
        quoted = true;
        quote = ch;
      } else if (quote === ch) {
        quoted = false;
      }
    }
    if (ch === "#" && !quoted) {
      return line.slice(0, i);
    }
  }
  return line;
}

function unquote(value: string): string {
  const trimmed = value.trim();
  if ((trimmed.startsWith("\"") && trimmed.endsWith("\"")) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

export class SoldierNamePool {
  private _maleFirst: string[] = [];
  private _femaleFirst: string[] = [];
  private _maleLast: string[] = [];
  private _femaleLast: string[] = [];
  private _lookWeights: number[] = [];
  private _totalWeight = 0;
  private _femaleFrequency = -1;

  load(source: string): void {
    let section = "";
    for (const raw of source.split(/\r?\n/)) {
      const line = stripComment(raw);
      if (!line.trim()) {
        continue;
      }
      const indent = line.search(/\S|$/);
      const trimmed = line.trim();

      const prop = /^([A-Za-z0-9_]+):\s*(.*)$/.exec(trimmed);
      if (indent === 0 && prop) {
        section = prop[1];
        if (section === "femaleFrequency") {
          const n = Number(prop[2]);
          if (Number.isFinite(n)) {
            this._femaleFrequency = n;
          }
        }
        continue;
      }

      const entry = /^-\s+(.+)$/.exec(trimmed);
      if (indent === 2 && entry) {
        if (section === "lookWeights") {
          const n = Number(entry[1]);
          if (Number.isFinite(n)) {
            this._lookWeights.push(n);
          }
        } else if (section === "maleFirst") {
          this._maleFirst.push(unquote(entry[1]));
        } else if (section === "femaleFirst") {
          this._femaleFirst.push(unquote(entry[1]));
        } else if (section === "maleLast") {
          this._maleLast.push(unquote(entry[1]));
        } else if (section === "femaleLast") {
          this._femaleLast.push(unquote(entry[1]));
        }
      }
    }
    if (this._femaleFirst.length === 0) {
      this._femaleFirst = [...this._maleFirst];
    }
    if (this._femaleLast.length === 0) {
      this._femaleLast = [...this._maleLast];
    }
    this._totalWeight = this._lookWeights.reduce((total, value) => total + value, 0);
  }

  genName(femaleFrequency: number): { name: string; gender: number } {
    const female = RNG.percent(this._femaleFrequency > -1 ? this._femaleFrequency : femaleFrequency);
    const firstNames = female ? this._femaleFirst : this._maleFirst;
    const lastNames = female ? this._femaleLast : this._maleLast;
    const first = firstNames.length ? firstNames[RNG.generate(0, firstNames.length - 1)] : (female ? "Jane" : "John");
    const last = lastNames.length ? ` ${lastNames[RNG.generate(0, lastNames.length - 1)]}` : "";
    return {
      name: `${first}${last}`,
      gender: female ? 1 : 0
    };
  }

  genLook(numLooks: number): number {
    const minimumChance = 2;
    while (this._lookWeights.length < numLooks) {
      this._lookWeights.push(minimumChance);
      this._totalWeight += minimumChance;
    }
    while (this._lookWeights.length > numLooks) {
      this._totalWeight -= this._lookWeights.pop() || 0;
    }

    let random = RNG.generate(0, this._totalWeight);
    for (let look = 0; look < this._lookWeights.length; ++look) {
      if (random <= this._lookWeights[look]) {
        return look;
      }
      random -= this._lookWeights[look];
    }
    return RNG.generate(0, Math.max(0, numLooks - 1));
  }
}
