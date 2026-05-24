import { WeightedOptions } from "../Savegame/WeightedOptions.ts";

export enum GenerationType {
  GEN_REGION = 0,
  GEN_MISSION,
  GEN_RACE
}

export type RuleMissionScriptDefinition = {
  type: string;
  varName?: string;
  firstMonth?: number;
  lastMonth?: number;
  label?: number;
  executionOdds?: number;
  targetBaseOdds?: number;
  minDifficulty?: number;
  maxRuns?: number;
  avoidRepeats?: number;
  startDelay?: number;
  conditionals?: number[];
  missionWeights?: Record<number, Record<string, number>>;
  raceWeights?: Record<number, Record<string, number>>;
  regionWeights?: Record<number, Record<string, number>>;
  researchTriggers?: Record<string, boolean>;
  useTable?: boolean;
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

function parseBool(value: string): boolean {
  return value.trim() === "true";
}

function parseNumberList(value: string): number[] {
  const match = /^\[\s*(.*)\s*\]$/.exec(value.trim());
  if (!match) {
    return [];
  }
  const inside = match[1].trim();
  if (!inside) {
    return [];
  }
  const values: number[] = [];
  for (const part of inside.split(",")) {
    const n = parseNumber(part);
    if (n == null) {
      return [];
    }
    values.push(n);
  }
  return values;
}

function setScriptProp(target: RuleMissionScriptDefinition, key: string, value: string): void {
  switch (key) {
    case "type":
    case "varName":
      (target as Record<string, unknown>)[key] = unquote(value);
      break;
    case "firstMonth":
    case "lastMonth":
    case "label":
    case "executionOdds":
    case "targetBaseOdds":
    case "minDifficulty":
    case "maxRuns":
    case "avoidRepeats":
    case "startDelay": {
      const n = parseNumber(value);
      if (n != null) {
        (target as Record<string, unknown>)[key] = n;
      }
      break;
    }
    case "conditionals":
      target.conditionals = parseNumberList(value);
      break;
    case "useTable":
      target.useTable = parseBool(value);
      break;
    default:
      break;
  }
}

export class RuleMissionScript {
  private _varName = "";
  private _firstMonth = 0;
  private _lastMonth = -1;
  private _label = 0;
  private _executionOdds = 100;
  private _targetBaseOdds = 0;
  private _minDifficulty = 0;
  private _maxRuns = -1;
  private _avoidRepeats = 0;
  private _delay = 0;
  private _conditionals: number[] = [];
  private _regionWeights: Array<[number, WeightedOptions]> = [];
  private _missionWeights: Array<[number, WeightedOptions]> = [];
  private _raceWeights: Array<[number, WeightedOptions]> = [];
  private _researchTriggers = new Map<string, boolean>();
  private _useTable = true;
  private _siteType = false;

  constructor(private _type: string) {}

  load(node: RuleMissionScriptDefinition): void {
    this._type = node.type || this._type;
    this._varName = node.varName ?? this._varName;
    this._firstMonth = node.firstMonth ?? this._firstMonth;
    this._lastMonth = node.lastMonth ?? this._lastMonth;
    this._label = node.label ?? this._label;
    this._executionOdds = node.executionOdds ?? this._executionOdds;
    this._targetBaseOdds = node.targetBaseOdds ?? this._targetBaseOdds;
    this._minDifficulty = node.minDifficulty ?? this._minDifficulty;
    this._maxRuns = node.maxRuns ?? this._maxRuns;
    this._avoidRepeats = node.avoidRepeats ?? this._avoidRepeats;
    this._delay = node.startDelay ?? this._delay;
    this._conditionals = [...(node.conditionals || this._conditionals)];
    this._missionWeights = this.loadWeightedTable(node.missionWeights, this._missionWeights);
    this._raceWeights = this.loadWeightedTable(node.raceWeights, this._raceWeights);
    this._regionWeights = this.loadWeightedTable(node.regionWeights, this._regionWeights);
    this._researchTriggers.clear();
    for (const [research, required] of Object.entries(node.researchTriggers || {})) {
      this._researchTriggers.set(research, required);
    }
    this._useTable = node.useTable ?? this._useTable;
    if (!this._varName && (this._maxRuns > 0 || this._avoidRepeats > 0)) {
      throw new Error(`Error in mission script: ${this._type}: no varName provided for a script with maxRuns or repeatAvoidance.`);
    }
  }

  getType(): string {
    return this._type;
  }

  getVarName(): string {
    return this._varName;
  }

  getAllMissionTypes(): Set<string> {
    const types = new Set<string>();
    for (const [, weights] of this._missionWeights) {
      for (const name of weights.getNames()) {
        types.add(name);
      }
    }
    return types;
  }

  getRegions(month: number): string[] {
    return this.getWeightedOptionsForMonth(this._regionWeights, month)?.getNames() || [];
  }

  getMissionTypes(month: number): string[] {
    return this.getWeightedOptionsForMonth(this._missionWeights, month)?.getNames() || [];
  }

  getFirstMonth(): number {
    return this._firstMonth;
  }

  getLastMonth(): number {
    return this._lastMonth;
  }

  getLabel(): number {
    return this._label;
  }

  getExecutionOdds(): number {
    return this._executionOdds;
  }

  getTargetBaseOdds(): number {
    return this._targetBaseOdds;
  }

  getMinDifficulty(): number {
    return this._minDifficulty;
  }

  getMaxRuns(): number {
    return this._maxRuns;
  }

  getRepeatAvoidance(): number {
    return this._avoidRepeats;
  }

  getDelay(): number {
    return this._delay;
  }

  getConditionals(): number[] {
    return this._conditionals;
  }

  hasRaceWeights(): boolean {
    return this._raceWeights.length > 0;
  }

  hasMissionWeights(): boolean {
    return this._missionWeights.length > 0;
  }

  hasRegionWeights(): boolean {
    return this._regionWeights.length > 0;
  }

  getResearchTriggers(): Map<string, boolean> {
    return this._researchTriggers;
  }

  getUseTable(): boolean {
    return this._useTable;
  }

  setSiteType(siteType: boolean): void {
    this._siteType = siteType;
  }

  getSiteType(): boolean {
    return this._siteType;
  }

  generate(monthsPassed: number, type: GenerationType): string {
    const table = type === GenerationType.GEN_RACE
      ? this._raceWeights
      : type === GenerationType.GEN_REGION
        ? this._regionWeights
        : this._missionWeights;
    return this.getWeightedOptionsForMonth(table, monthsPassed)?.choose() || "";
  }

  private loadWeightedTable(source: Record<number, Record<string, number>> | undefined, previous: Array<[number, WeightedOptions]>): Array<[number, WeightedOptions]> {
    if (!source) {
      return previous;
    }
    const entries: Array<[number, WeightedOptions]> = [];
    for (const [monthText, values] of Object.entries(source)) {
      const month = Number(monthText);
      if (!Number.isFinite(month)) {
        continue;
      }
      const weighted = new WeightedOptions();
      weighted.load(values);
      if (!weighted.empty()) {
        entries.push([month, weighted]);
      }
    }
    return entries.sort((a, b) => a[0] - b[0]);
  }

  private getWeightedOptionsForMonth(table: Array<[number, WeightedOptions]>, month: number): WeightedOptions | null {
    if (table.length === 0) {
      return null;
    }
    let current: WeightedOptions | null = table[0][1];
    for (const [entryMonth, weights] of table) {
      if (month < entryMonth) {
        break;
      }
      current = weights;
    }
    return current;
  }
}

export function parseMissionScriptsRul(source: string): RuleMissionScriptDefinition[] {
  const definitions: RuleMissionScriptDefinition[] = [];
  let current: RuleMissionScriptDefinition | null = null;
  let section = "";
  let currentMonth: number | null = null;

  for (const raw of source.split(/\r?\n/)) {
    const line = stripComment(raw);
    if (!line.trim() || line.trim().startsWith("missionScripts:")) {
      continue;
    }
    const indent = line.search(/\S|$/);
    const trimmed = line.trim();

    const start = /^-\s+type:\s*(.+)$/.exec(trimmed);
    if (indent === 2 && start) {
      current = { type: unquote(start[1]) };
      definitions.push(current);
      section = "";
      currentMonth = null;
      continue;
    }

    if (!current) {
      continue;
    }

    const prop = /^([A-Za-z0-9_]+):\s*(.*)$/.exec(trimmed);
    if (indent === 4 && prop) {
      currentMonth = null;
      if (prop[1] === "missionWeights" || prop[1] === "raceWeights" || prop[1] === "regionWeights") {
        section = prop[1];
        (current as Record<string, unknown>)[section] ||= {};
      } else if (prop[1] === "researchTriggers") {
        section = "researchTriggers";
        current.researchTriggers ||= {};
      } else {
        section = "";
        setScriptProp(current, prop[1], prop[2]);
      }
      continue;
    }

    if ((section === "missionWeights" || section === "raceWeights" || section === "regionWeights") && indent === 6) {
      const monthProp = /^([0-9]+):\s*$/.exec(trimmed);
      if (monthProp) {
        currentMonth = Number(monthProp[1]);
        const table = ((current as Record<string, unknown>)[section] ||= {}) as Record<number, Record<string, number>>;
        table[currentMonth] = {};
      }
      continue;
    }

    if ((section === "missionWeights" || section === "raceWeights" || section === "regionWeights") && indent === 8 && currentMonth != null) {
      const weightProp = /^([A-Za-z0-9_]+):\s*(.+)$/.exec(trimmed);
      if (weightProp) {
        const n = parseNumber(weightProp[2]);
        if (n != null) {
          const table = ((current as Record<string, unknown>)[section] ||= {}) as Record<number, Record<string, number>>;
          table[currentMonth] ||= {};
          table[currentMonth][weightProp[1]] = n;
        }
      }
      continue;
    }

    if (section === "researchTriggers" && indent === 6) {
      const researchProp = /^([A-Za-z0-9_]+):\s*(.+)$/.exec(trimmed);
      if (researchProp) {
        current.researchTriggers ||= {};
        current.researchTriggers[researchProp[1]] = parseBool(researchProp[2]);
      }
    }
  }

  return definitions;
}
