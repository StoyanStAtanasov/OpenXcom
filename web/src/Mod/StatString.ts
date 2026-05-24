import type { UnitStats } from "./Unit.ts";
import { StatStringCondition } from "./StatStringCondition.ts";

const statStringConditionNames = [
  "psiStrength",
  "psiSkill",
  "bravery",
  "strength",
  "firing",
  "reactions",
  "stamina",
  "tu",
  "health",
  "throwing",
  "melee",
  "psiTraining"
] as const;

export type StatStringConditionName = typeof statStringConditionNames[number];
export type StatStringRange = Array<number | null | undefined>;
export type StatStringDefinition = {
  string?: string;
} & Partial<Record<StatStringConditionName, StatStringRange>>;

const statStringConditionNameSet = new Set<string>(statStringConditionNames);

function hasOwn(source: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(source, key);
}

function toStatLimit(value: number | null | undefined, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

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

function parseOptionalString(value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed || trimmed === "~" || trimmed === "null" || trimmed === "Null" || trimmed === "NULL") {
    return undefined;
  }
  return unquote(trimmed);
}

function parseRangeValue(value: string): number | null | undefined {
  const trimmed = unquote(value);
  if (!trimmed || trimmed === "~" || trimmed === "null" || trimmed === "Null" || trimmed === "NULL") {
    return null;
  }
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : undefined;
}

function splitInlineList(value: string): string[] | null {
  const trimmed = value.trim();
  if (!trimmed.startsWith("[") || !trimmed.endsWith("]")) {
    return null;
  }
  const inside = trimmed.slice(1, -1).trim();
  if (!inside) {
    return [];
  }

  const parts: string[] = [];
  let quoted = false;
  let quote = "";
  let start = 0;
  for (let i = 0; i < inside.length; ++i) {
    const ch = inside[i];
    if ((ch === "\"" || ch === "'") && (i === 0 || inside[i - 1] !== "\\")) {
      if (!quoted) {
        quoted = true;
        quote = ch;
      } else if (quote === ch) {
        quoted = false;
      }
    } else if (ch === "," && !quoted) {
      parts.push(inside.slice(start, i).trim());
      start = i + 1;
    }
  }
  parts.push(inside.slice(start).trim());
  return parts;
}

function parseRange(value: string): StatStringRange {
  const list = splitInlineList(value);
  if (list) {
    return list.map(parseRangeValue);
  }
  if (!value.trim()) {
    return [];
  }
  return [parseRangeValue(value)];
}

function setStatStringProp(target: StatStringDefinition, key: string, value: string): boolean {
  if (key === "string") {
    const parsed = parseOptionalString(value);
    if (parsed != null) {
      target.string = parsed;
    }
    return false;
  }
  if (statStringConditionNameSet.has(key)) {
    target[key as StatStringConditionName] = parseRange(value);
    return !value.trim();
  }
  return false;
}

export class StatString {
  private _stringToBeAddedIfAllConditionsAreMet = "";
  private _conditions: StatStringCondition[] = [];

  load(node: StatStringDefinition): void {
    this._stringToBeAddedIfAllConditionsAreMet = node.string ?? this._stringToBeAddedIfAllConditionsAreMet;
    for (const conditionName of statStringConditionNames) {
      if (hasOwn(node, conditionName)) {
        this._conditions.push(StatString.getCondition(conditionName, node));
      }
    }
  }

  private static getCondition(conditionName: StatStringConditionName, node: StatStringDefinition): StatStringCondition {
    const range = node[conditionName] || [];
    const minValue = toStatLimit(range[0], 0);
    const maxValue = toStatLimit(range[1], 255);
    return new StatStringCondition(conditionName, minValue, maxValue);
  }

  getConditions(): StatStringCondition[] {
    return this._conditions;
  }

  getString(): string {
    return this._stringToBeAddedIfAllConditionsAreMet;
  }

  static calcStatString(currentStats: UnitStats, statStrings: StatString[], psiStrengthEval: boolean, inTraining: boolean): string {
    let statString = "";
    const currentStatsMap = StatString.getCurrentStats(currentStats);
    if (inTraining) {
      currentStatsMap.set("psiTraining", 1);
    }
    for (const rule of statStrings) {
      let conditionsMet = true;
      for (const condition of rule.getConditions()) {
        const conditionName = condition.getConditionName();
        if (currentStatsMap.has(conditionName)) {
          conditionsMet = conditionsMet && condition.isMet(currentStatsMap.get(conditionName) || 0, currentStats.psiSkill > 0 || psiStrengthEval);
        } else {
          conditionsMet = false;
        }
        if (!conditionsMet) {
          break;
        }
      }
      if (conditionsMet) {
        const wstring = rule.getString();
        statString += wstring;
        if (wstring.length > 1) {
          break;
        }
      }
    }
    return statString;
  }

  static getCurrentStats(currentStats: UnitStats): Map<string, number> {
    const currentStatsMap = new Map<string, number>();
    currentStatsMap.set("psiStrength", currentStats.psiStrength);
    currentStatsMap.set("psiSkill", currentStats.psiSkill);
    currentStatsMap.set("bravery", currentStats.bravery);
    currentStatsMap.set("strength", currentStats.strength);
    currentStatsMap.set("firing", currentStats.firing);
    currentStatsMap.set("reactions", currentStats.reactions);
    currentStatsMap.set("stamina", currentStats.stamina);
    currentStatsMap.set("tu", currentStats.tu);
    currentStatsMap.set("health", currentStats.health);
    currentStatsMap.set("throwing", currentStats.throwing);
    currentStatsMap.set("melee", currentStats.melee);
    return currentStatsMap;
  }
}

export function parseStatStringsRul(source: string): StatStringDefinition[] {
  const definitions: StatStringDefinition[] = [];
  let inStatStrings = false;
  let statStringsIndent = 0;
  let current: StatStringDefinition | null = null;
  let currentIndent = 0;
  let pendingRange: StatStringConditionName | null = null;
  let pendingRangeIndent = 0;

  for (const raw of source.split(/\r?\n/)) {
    const line = stripComment(raw);
    if (!line.trim()) {
      continue;
    }
    const indent = line.search(/\S|$/);
    const trimmed = line.trim();

    if (!inStatStrings) {
      if (/^statStrings:\s*$/.test(trimmed)) {
        inStatStrings = true;
        statStringsIndent = indent;
      }
      continue;
    }

    const entryStart = /^-\s+(?:string:\s*(.*))?$/.exec(trimmed);
    if (entryStart && indent <= statStringsIndent + 2) {
      current = {};
      definitions.push(current);
      currentIndent = indent;
      pendingRange = null;
      if (entryStart[1] != null) {
        const parsed = parseOptionalString(entryStart[1]);
        if (parsed != null) {
          current.string = parsed;
        }
      }
      continue;
    }

    if (!current) {
      continue;
    }

    const rangeEntry = /^-\s+(.+)$/.exec(trimmed);
    if (pendingRange && rangeEntry && indent > pendingRangeIndent) {
      current[pendingRange] ||= [];
      current[pendingRange]?.push(parseRangeValue(rangeEntry[1]));
      continue;
    }

    const prop = /^([A-Za-z0-9_]+):\s*(.*)$/.exec(trimmed);
    if (prop && indent > currentIndent) {
      const key = prop[1];
      const value = prop[2];
      pendingRange = setStatStringProp(current, key, value) ? (key as StatStringConditionName) : null;
      pendingRangeIndent = indent;
      continue;
    }

    if (prop && indent <= statStringsIndent && prop[1] !== "statStrings") {
      inStatStrings = false;
      current = null;
      pendingRange = null;
    }
  }

  return definitions;
}
