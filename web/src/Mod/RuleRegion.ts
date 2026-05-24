import { RNG } from "../Engine/RNG.ts";
import { WeightedOptions } from "../Savegame/WeightedOptions.ts";

export type MissionAreaDefinition = {
  lonMin: number;
  lonMax: number;
  latMin: number;
  latMax: number;
  texture: number;
  name: string;
};

export type MissionArea = MissionAreaDefinition;

export type MissionZone = {
  areas: MissionArea[];
};

export type CityDefinition = {
  name: string;
  lon: number;
  lat: number;
};

export type RegionDefinition = {
  type: string;
  cost?: number;
  areas: number[][];
  missionWeights?: Record<string, number>;
  regionWeight?: number;
  missionZones?: MissionAreaDefinition[][];
  missionRegion?: string;
};

function deg2Rad(deg: number): number {
  return deg * Math.PI / 180.0;
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

function parseInlineList(value: string): string[] {
  const match = /^\[\s*(.*)\s*\]$/.exec(value.trim());
  if (!match) {
    return [];
  }
  const items: string[] = [];
  let quoted = false;
  let quote = "";
  let current = "";
  for (let i = 0; i < match[1].length; ++i) {
    const ch = match[1][i];
    if ((ch === "\"" || ch === "'") && (i === 0 || match[1][i - 1] !== "\\")) {
      if (!quoted) {
        quoted = true;
        quote = ch;
      } else if (quote === ch) {
        quoted = false;
      }
    }
    if (ch === "," && !quoted) {
      items.push(unquote(current.trim()));
      current = "";
    } else {
      current += ch;
    }
  }
  items.push(unquote(current.trim()));
  return items;
}

function parseMapping(line: string): [string, string] | null {
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
    if (ch === ":" && !quoted) {
      return [unquote(line.slice(0, i).trim()), line.slice(i + 1).trim()];
    }
  }
  return null;
}

function parseNumberList(value: string): number[] {
  const parts = parseInlineList(value);
  const values: number[] = [];
  for (const part of parts) {
    const number = Number(part.trim());
    if (Number.isFinite(number)) {
      values.push(number);
    } else {
      break;
    }
  }
  return values;
}

export class RuleRegion {
  private _cost = 0;
  private _lonMin: number[] = [];
  private _lonMax: number[] = [];
  private _latMin: number[] = [];
  private _latMax: number[] = [];
  private _cities: CityDefinition[] = [];
  private _missionWeights = new WeightedOptions();
  private _regionWeight = 0;
  private _missionZones: MissionZone[] = [];
  private _missionRegion = "";

  constructor(private _type: string) {}

  load(node: RegionDefinition): void {
    this._type = node.type || this._type;
    this._cost = node.cost ?? this._cost;
    this._missionRegion = node.missionRegion ?? this._missionRegion;
    if (node.missionWeights) {
      this._missionWeights.load(node.missionWeights);
    }
    this._regionWeight = node.regionWeight ?? this._regionWeight;
    for (const area of node.areas || []) {
      if (area.length < 4) {
        continue;
      }
      let latMin = deg2Rad(area[2]);
      let latMax = deg2Rad(area[3]);
      if (latMin > latMax) {
        const tmp = latMin;
        latMin = latMax;
        latMax = tmp;
      }
      this._lonMin.push(deg2Rad(area[0]));
      this._lonMax.push(deg2Rad(area[1]));
      this._latMin.push(latMin);
      this._latMax.push(latMax);
    }
    if (node.missionZones) {
      const missionZones: MissionZone[] = [];
      for (const zoneDefinition of node.missionZones) {
        const zone: MissionZone = { areas: [] };
        for (const area of zoneDefinition) {
          let latMin = deg2Rad(area.latMin);
          let latMax = deg2Rad(area.latMax);
          if (latMin > latMax) {
            const tmp = latMin;
            latMin = latMax;
            latMax = tmp;
          }
          zone.areas.push({
            lonMin: deg2Rad(area.lonMin),
            lonMax: deg2Rad(area.lonMax),
            latMin,
            latMax,
            texture: area.texture,
            name: area.name
          });
        }
        missionZones.push(zone);
      }
      this._missionZones = missionZones;
    }
  }

  getType(): string {
    return this._type;
  }

  getBaseCost(): number {
    return this._cost;
  }

  getMissionRegion(): string {
    return this._missionRegion;
  }

  getCities(): CityDefinition[] {
    if (this._cities.length === 0) {
      for (const zone of this._missionZones) {
        for (const area of zone.areas) {
          if (this.isPoint(area) && area.name) {
            this._cities.push({ name: area.name, lon: area.lonMin, lat: area.latMin });
          }
        }
      }
    }
    return this._cities;
  }

  getWeight(): number {
    return this._regionWeight;
  }

  getAvailableMissions(): WeightedOptions {
    return this._missionWeights;
  }

  getRandomPoint(zone: number): [number, number] {
    if (zone < this._missionZones.length && this._missionZones[zone].areas.length > 0) {
      const area = this._missionZones[zone].areas[RNG.generate(0, this._missionZones[zone].areas.length - 1)];
      let lonMin = area.lonMin;
      let lonMax = area.lonMax;
      let latMin = area.latMin;
      let latMax = area.latMax;
      if (lonMin > lonMax) {
        lonMin = area.lonMax;
        lonMax = area.lonMin;
      }
      if (latMin > latMax) {
        latMin = area.latMax;
        latMax = area.latMin;
      }
      return [RNG.generate(lonMin, lonMax), RNG.generate(latMin, latMax)];
    }
    throw new Error(`Invalid mission zone ${zone} for region ${this._type}.`);
  }

  getMissionZones(): MissionZone[] {
    return this._missionZones;
  }

  insideRegion(lon: number, lat: number): boolean {
    for (let i = 0; i < this._lonMin.length; ++i) {
      let inLon = false;
      let inLat = false;

      if (this._lonMin[i] <= this._lonMax[i]) {
        inLon = lon >= this._lonMin[i] && lon < this._lonMax[i];
      } else {
        inLon = (lon >= this._lonMin[i] && lon < Math.PI * 2.0) || (lon >= 0 && lon < this._lonMax[i]);
      }

      if (lat > 0) {
        inLat = lat > this._latMin[i] && lat <= this._latMax[i];
      } else {
        inLat = lat >= this._latMin[i] && lat < this._latMax[i];
      }

      if (inLon && inLat) {
        return true;
      }
    }
    return false;
  }

  private isPoint(area: MissionArea): boolean {
    return Math.abs(area.lonMin - area.lonMax) <= Number.EPSILON * Math.max(1.0, Math.abs(area.lonMin), Math.abs(area.lonMax)) &&
      Math.abs(area.latMin - area.latMax) <= Number.EPSILON * Math.max(1.0, Math.abs(area.latMin), Math.abs(area.latMax));
  }
}

export function parseRegionsRul(source: string): RegionDefinition[] {
  const definitions: RegionDefinition[] = [];
  let current: RegionDefinition | null = null;
  let section = "";
  let currentZone: MissionAreaDefinition[] | null = null;

  for (const raw of source.split(/\r?\n/)) {
    const line = stripComment(raw);
    if (!line.trim() || line.trim() === "regions:") {
      continue;
    }
    const indent = line.search(/\S|$/);
    const trimmed = line.trim();

    const regionStart = /^-\s+type:\s*(.+)$/.exec(trimmed);
    if (indent === 2 && regionStart) {
      current = { type: unquote(regionStart[1]), areas: [], missionWeights: {}, missionZones: [] };
      definitions.push(current);
      section = "";
      currentZone = null;
      continue;
    }

    if (!current) {
      continue;
    }

    const prop = parseMapping(trimmed);
    if (indent === 4 && prop) {
      currentZone = null;
      section = prop[0] === "areas" || prop[0] === "missionWeights" || prop[0] === "missionZones" ? prop[0] : "";
      if (prop[0] === "cost") {
        current.cost = Number(prop[1]);
      } else if (prop[0] === "regionWeight") {
        current.regionWeight = Number(prop[1]);
      } else if (prop[0] === "missionRegion") {
        current.missionRegion = unquote(prop[1]);
      }
      continue;
    }

    if (section === "areas" && indent === 6) {
      const areaStart = /^-\s+(\[.*\])$/.exec(trimmed);
      if (areaStart) {
        const area = parseNumberList(areaStart[1]);
        if (area.length >= 4) {
          current.areas.push(area);
        }
      }
      continue;
    }

    if (section === "missionWeights" && indent === 6) {
      const weight = parseMapping(trimmed);
      if (weight) {
        const n = Number(weight[1]);
        if (Number.isFinite(n)) {
          current.missionWeights ||= {};
          current.missionWeights[weight[0]] = n;
        }
      }
      continue;
    }

    if (section === "missionZones" && indent === 6 && trimmed === "-") {
      currentZone = [];
      current.missionZones ||= [];
      current.missionZones.push(currentZone);
      continue;
    }

    if (section === "missionZones" && indent === 8 && currentZone) {
      const zoneArea = /^-\s+(\[.*\])$/.exec(trimmed);
      if (zoneArea) {
        const parts = parseInlineList(zoneArea[1]);
        const lonMin = Number(parts[0]);
        const lonMax = Number(parts[1]);
        const latMin = Number(parts[2]);
        const latMax = Number(parts[3]);
        if ([lonMin, lonMax, latMin, latMax].every(Number.isFinite)) {
          const texture = Number(parts[4]);
          currentZone.push({
            lonMin,
            lonMax,
            latMin,
            latMax,
            texture: Number.isFinite(texture) ? texture : -1,
            name: parts[5] || ""
          });
        }
      }
    }
  }

  return definitions;
}
