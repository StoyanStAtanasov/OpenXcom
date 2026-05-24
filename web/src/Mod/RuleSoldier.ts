import { createUnitStats, mergeUnitStats, type UnitStats } from "./Unit.ts";
import type { SoldierNamePool } from "./SoldierNamePool.ts";

export type SoldierDefinition = {
  type: string;
  requires: string[];
  minStats: UnitStats;
  maxStats: UnitStats;
  statCaps: UnitStats;
  armor?: string;
  costBuy?: number;
  costSalary?: number;
  standHeight?: number;
  kneelHeight?: number;
  floatHeight?: number;
  femaleFrequency?: number;
  value?: number;
  transferTime?: number;
  soldierNames: string[];
};

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

function parseNumber(value: string): number | undefined {
  const n = Number(value.trim());
  return Number.isFinite(n) ? n : undefined;
}

function setScalar(target: SoldierDefinition, key: string, value: string): void {
  switch (key) {
    case "costBuy":
    case "costSalary":
    case "standHeight":
    case "kneelHeight":
    case "floatHeight":
    case "femaleFrequency":
    case "value":
    case "transferTime": {
      const n = parseNumber(value);
      if (n != null) {
        target[key] = n;
      }
      break;
    }
    case "armor":
      target.armor = unquote(value);
      break;
    default:
      break;
  }
}

export class RuleSoldier {
  private _requires: string[] = [];
  private _minStats = createUnitStats();
  private _maxStats = createUnitStats();
  private _statCaps = createUnitStats();
  private _armor = "";
  private _costBuy = 0;
  private _costSalary = 0;
  private _standHeight = 0;
  private _kneelHeight = 0;
  private _floatHeight = 0;
  private _femaleFrequency = 50;
  private _value = 20;
  private _transferTime = 0;
  private _names: SoldierNamePool[] = [];
  private _soldierNamePaths: string[] = [];

  constructor(private _type: string) {}

  load(node: SoldierDefinition): void {
    this._type = node.type === "XCOM" ? "STR_SOLDIER" : (node.type || this._type);
    this._requires = [...(node.requires || [])];
    mergeUnitStats(this._minStats, node.minStats || {});
    mergeUnitStats(this._maxStats, node.maxStats || {});
    mergeUnitStats(this._statCaps, node.statCaps || {});
    this._armor = node.armor ?? this._armor;
    this._costBuy = node.costBuy ?? this._costBuy;
    this._costSalary = node.costSalary ?? this._costSalary;
    this._standHeight = node.standHeight ?? this._standHeight;
    this._kneelHeight = node.kneelHeight ?? this._kneelHeight;
    this._floatHeight = node.floatHeight ?? this._floatHeight;
    this._femaleFrequency = node.femaleFrequency ?? this._femaleFrequency;
    this._value = node.value ?? this._value;
    this._transferTime = node.transferTime ?? this._transferTime;
    this._soldierNamePaths = [...(node.soldierNames || [])];
  }

  getType(): string {
    return this._type;
  }

  getRequirements(): string[] {
    return this._requires;
  }

  getMinStats(): UnitStats {
    return { ...this._minStats };
  }

  getMaxStats(): UnitStats {
    return { ...this._maxStats };
  }

  getStatCaps(): UnitStats {
    return { ...this._statCaps };
  }

  getBuyCost(): number {
    return this._costBuy;
  }

  getSalaryCost(): number {
    return this._costSalary;
  }

  getStandHeight(): number {
    return this._standHeight;
  }

  getKneelHeight(): number {
    return this._kneelHeight;
  }

  getFloatHeight(): number {
    return this._floatHeight;
  }

  getArmor(): string {
    return this._armor;
  }

  getFemaleFrequency(): number {
    return this._femaleFrequency;
  }

  getNames(): SoldierNamePool[] {
    return this._names;
  }

  getValue(): number {
    return this._value;
  }

  getTransferTime(): number {
    return this._transferTime;
  }

  getSoldierNamePaths(): string[] {
    return this._soldierNamePaths;
  }

  addSoldierNamePool(pool: SoldierNamePool): void {
    this._names.push(pool);
  }
}

export function parseSoldiersRul(source: string): SoldierDefinition[] {
  const definitions: SoldierDefinition[] = [];
  let current: SoldierDefinition | null = null;
  let section = "";

  for (const raw of source.split(/\r?\n/)) {
    const line = stripComment(raw);
    if (!line.trim() || line.trim() === "soldiers:") {
      continue;
    }
    const indent = line.search(/\S|$/);
    const trimmed = line.trim();

    const soldierStart = /^-\s+type:\s*(.+)$/.exec(trimmed);
    if (indent === 2 && soldierStart) {
      current = {
        type: unquote(soldierStart[1]),
        requires: [],
        minStats: createUnitStats(),
        maxStats: createUnitStats(),
        statCaps: createUnitStats(),
        soldierNames: []
      };
      definitions.push(current);
      section = "";
      continue;
    }

    if (!current) {
      continue;
    }

    const prop = /^([A-Za-z0-9_]+):\s*(.*)$/.exec(trimmed);
    if (indent === 4 && prop) {
      section = ["requires", "minStats", "maxStats", "statCaps", "soldierNames"].includes(prop[1]) ? prop[1] : "";
      if (!section) {
        setScalar(current, prop[1], prop[2]);
      }
      continue;
    }

    const entry = /^-\s+(.+)$/.exec(trimmed);
    if (indent === 6 && entry && section === "requires") {
      current.requires.push(unquote(entry[1]));
      continue;
    }
    if (indent === 6 && entry && section === "soldierNames") {
      current.soldierNames.push(unquote(entry[1]));
      continue;
    }
    if (indent === 6 && prop && (section === "minStats" || section === "maxStats" || section === "statCaps")) {
      const n = parseNumber(prop[2]);
      if (n != null && prop[1] in current[section]) {
        current[section][prop[1] as keyof UnitStats] = n;
      }
    }
  }

  return definitions;
}
