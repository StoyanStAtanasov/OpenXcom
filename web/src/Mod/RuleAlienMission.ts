import { WeightedOptions } from "../Savegame/WeightedOptions.ts";

export type MissionWave = {
  ufoType: string;
  ufoCount: number;
  trajectory: string;
  spawnTimer: number;
  objective: boolean;
};

export enum MissionObjective {
  OBJECTIVE_SCORE = 0,
  OBJECTIVE_INFILTRATION,
  OBJECTIVE_BASE,
  OBJECTIVE_SITE,
  OBJECTIVE_RETALIATION,
  OBJECTIVE_SUPPLY
}

export type RuleAlienMissionDefinition = {
  type: string;
  points?: number;
  objective?: number;
  spawnUfo?: string;
  spawnZone?: number;
  raceWeights?: Record<number, Record<string, number>>;
  missionWeights?: Record<number, number>;
  retaliationOdds?: number;
  siteType?: string;
  waves: MissionWave[];
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

function setMissionProp(target: RuleAlienMissionDefinition, key: string, value: string): void {
  switch (key) {
    case "type":
    case "spawnUfo":
    case "siteType":
      (target as Record<string, unknown>)[key] = unquote(value);
      break;
    case "points":
    case "objective":
    case "spawnZone":
    case "retaliationOdds": {
      const n = parseNumber(value);
      if (n != null) {
        (target as Record<string, unknown>)[key] = n;
      }
      break;
    }
    default:
      break;
  }
}

function setWaveProp(target: MissionWave, key: string, value: string): void {
  switch (key) {
    case "ufo":
      target.ufoType = unquote(value);
      break;
    case "count": {
      const n = parseNumber(value);
      if (n != null) {
        target.ufoCount = n;
      }
      break;
    }
    case "trajectory":
      target.trajectory = unquote(value);
      break;
    case "timer": {
      const n = parseNumber(value);
      if (n != null) {
        target.spawnTimer = n;
      }
      break;
    }
    case "objective":
      target.objective = parseBool(value);
      break;
    default:
      break;
  }
}

export class RuleAlienMission {
  private _spawnUfo = "";
  private _raceDistribution: Array<[number, WeightedOptions]> = [];
  private _weights = new Map<number, number>();
  private _waves: MissionWave[] = [];
  private _points = 0;
  private _objective = MissionObjective.OBJECTIVE_SCORE;
  private _spawnZone = -1;
  private _retaliationOdds = -1;
  private _siteType = "";

  constructor(private _type: string) {}

  getType(): string {
    return this._type;
  }

  generateRace(monthsPassed: number): string {
    for (let i = this._raceDistribution.length - 1; i >= 0; --i) {
      const [month, races] = this._raceDistribution[i];
      if (monthsPassed >= month) {
        return races.choose();
      }
    }
    return "";
  }

  load(node: RuleAlienMissionDefinition): void {
    this._type = node.type || this._type;
    this._points = node.points ?? this._points;
    this._waves = node.waves.map(wave => ({ ...wave }));
    this._objective = node.objective ?? this._objective;
    this._spawnUfo = node.spawnUfo ?? this._spawnUfo;
    this._spawnZone = node.spawnZone ?? this._spawnZone;
    this._retaliationOdds = node.retaliationOdds ?? this._retaliationOdds;
    this._siteType = node.siteType ?? this._siteType;

    if (node.missionWeights) {
      this._weights.clear();
      for (const [month, weight] of Object.entries(node.missionWeights)) {
        this._weights.set(Number(month), weight);
      }
    }

    if (node.raceWeights) {
      const assoc = new Map<number, WeightedOptions>();
      for (const [month, races] of this._raceDistribution) {
        assoc.set(month, races);
      }
      for (const [monthText, values] of Object.entries(node.raceWeights)) {
        const month = Number(monthText);
        if (!Number.isFinite(month)) {
          continue;
        }
        let weighted = assoc.get(month);
        if (!weighted) {
          weighted = new WeightedOptions();
          assoc.set(month, weighted);
        }
        weighted.load(values);
      }
      this._raceDistribution = [...assoc.entries()]
        .filter(([, weighted]) => !weighted.empty())
        .sort((a, b) => a[0] - b[0]);
    }
  }

  getWaveCount(): number {
    return this._waves.length;
  }

  getWave(index: number): MissionWave {
    return this._waves[index];
  }

  getPoints(): number {
    return this._points;
  }

  getObjective(): MissionObjective {
    return this._objective;
  }

  getSpawnUfo(): string {
    return this._spawnUfo;
  }

  getSpawnZone(): number {
    return this._spawnZone;
  }

  getWeight(monthsPassed: number): number {
    if (this._weights.size === 0) {
      return 1;
    }
    let weight = 0;
    for (const [month, monthWeight] of [...this._weights.entries()].sort((a, b) => a[0] - b[0])) {
      if (month > monthsPassed) {
        break;
      }
      weight = monthWeight;
    }
    return weight;
  }

  getRetaliationOdds(): number {
    return this._retaliationOdds;
  }

  getSiteType(): string {
    return this._siteType;
  }

  getRaceDistribution(): Array<[number, WeightedOptions]> {
    return this._raceDistribution;
  }
}

export function parseAlienMissionsRul(source: string): RuleAlienMissionDefinition[] {
  const definitions: RuleAlienMissionDefinition[] = [];
  let current: RuleAlienMissionDefinition | null = null;
  let currentMonth: number | null = null;
  let currentWave: MissionWave | null = null;
  let section = "";

  for (const raw of source.split(/\r?\n/)) {
    const line = stripComment(raw);
    if (!line.trim() || line.trim().startsWith("alienMissions:")) {
      continue;
    }
    const indent = line.search(/\S|$/);
    const trimmed = line.trim();

    const start = /^-\s+type:\s*(.+)$/.exec(trimmed);
    if (indent === 2 && start) {
      current = { type: unquote(start[1]), waves: [], raceWeights: {} };
      definitions.push(current);
      currentMonth = null;
      currentWave = null;
      section = "";
      continue;
    }

    if (!current) {
      continue;
    }

    const prop = /^([A-Za-z0-9_]+):\s*(.*)$/.exec(trimmed);
    if (indent === 4 && prop) {
      currentMonth = null;
      currentWave = null;
      if (prop[1] === "raceWeights") {
        section = prop[2].trim() === "{}" ? "" : "raceWeights";
        current.raceWeights ||= {};
      } else if (prop[1] === "missionWeights") {
        section = prop[2].trim() === "{}" ? "" : "missionWeights";
        current.missionWeights ||= {};
      } else if (prop[1] === "waves") {
        section = "waves";
      } else {
        section = "";
        setMissionProp(current, prop[1], prop[2]);
      }
      continue;
    }

    if (section === "raceWeights" && indent === 6) {
      const monthProp = /^([0-9]+):\s*(.*)$/.exec(trimmed);
      if (monthProp) {
        currentMonth = Number(monthProp[1]);
        current.raceWeights ||= {};
        current.raceWeights[currentMonth] = {};
      }
      continue;
    }

    if (section === "raceWeights" && indent >= 8 && currentMonth != null) {
      const raceProp = /^([A-Za-z0-9_]+):\s*(.+)$/.exec(trimmed);
      if (raceProp) {
        const n = parseNumber(raceProp[2]);
        if (n != null) {
          current.raceWeights ||= {};
          current.raceWeights[currentMonth] ||= {};
          current.raceWeights[currentMonth][raceProp[1]] = n;
        }
      }
      continue;
    }

    if (section === "missionWeights" && indent === 6) {
      const weightProp = /^([0-9]+):\s*(.+)$/.exec(trimmed);
      if (weightProp) {
        const n = parseNumber(weightProp[2]);
        if (n != null) {
          current.missionWeights ||= {};
          current.missionWeights[Number(weightProp[1])] = n;
        }
      }
      continue;
    }

    if (section === "waves" && indent === 6) {
      const waveStart = /^-\s+([A-Za-z0-9_]+):\s*(.+)$/.exec(trimmed);
      if (waveStart) {
        currentWave = { ufoType: "", ufoCount: 0, trajectory: "", spawnTimer: 0, objective: false };
        setWaveProp(currentWave, waveStart[1], waveStart[2]);
        current.waves.push(currentWave);
      }
      continue;
    }

    if (section === "waves" && indent === 8 && currentWave) {
      const waveProp = /^([A-Za-z0-9_]+):\s*(.+)$/.exec(trimmed);
      if (waveProp) {
        setWaveProp(currentWave, waveProp[1], waveProp[2]);
      }
    }
  }

  return definitions;
}
