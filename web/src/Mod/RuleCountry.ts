import { RNG } from "../Engine/RNG.ts";

export type CountryDefinition = {
  type: string;
  fundingBase?: number;
  fundingCap?: number;
  labelLon?: number;
  labelLat?: number;
  areas: number[][];
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

function parseNumberList(value: string): number[] {
  const match = /^\[\s*(.*)\s*\]$/.exec(value.trim());
  if (!match) {
    return [];
  }
  const values: number[] = [];
  for (const part of match[1].split(",")) {
    const number = Number(part.trim());
    if (Number.isFinite(number)) {
      values.push(number);
    } else {
      break;
    }
  }
  return values;
}

export class RuleCountry {
  private _fundingBase = 0;
  private _fundingCap = 0;
  private _labelLon = 0.0;
  private _labelLat = 0.0;
  private _lonMin: number[] = [];
  private _lonMax: number[] = [];
  private _latMin: number[] = [];
  private _latMax: number[] = [];

  constructor(private _type: string) {}

  load(node: CountryDefinition): void {
    this._type = node.type || this._type;
    this._fundingBase = node.fundingBase ?? this._fundingBase;
    this._fundingCap = node.fundingCap ?? this._fundingCap;
    this._labelLon = node.labelLon != null ? deg2Rad(node.labelLon) : this._labelLon;
    this._labelLat = node.labelLat != null ? deg2Rad(node.labelLat) : this._labelLat;
    this._lonMin = [];
    this._lonMax = [];
    this._latMin = [];
    this._latMax = [];
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
  }

  getType(): string {
    return this._type;
  }

  generateFunding(): number {
    return RNG.generate(this._fundingBase, this._fundingBase * 2) * 1000;
  }

  getFundingCap(): number {
    return this._fundingCap;
  }

  getLabelLongitude(): number {
    return this._labelLon;
  }

  getLabelLatitude(): number {
    return this._labelLat;
  }

  insideCountry(lon: number, lat: number): boolean {
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

  getLonMax(): number[] {
    return this._lonMax;
  }

  getLonMin(): number[] {
    return this._lonMin;
  }

  getLatMax(): number[] {
    return this._latMax;
  }

  getLatMin(): number[] {
    return this._latMin;
  }
}

export function parseCountriesRul(source: string): CountryDefinition[] {
  const definitions: CountryDefinition[] = [];
  let current: CountryDefinition | null = null;
  let inAreas = false;

  for (const raw of source.split(/\r?\n/)) {
    const line = stripComment(raw);
    if (!line.trim() || line.trim().startsWith("countries:")) {
      continue;
    }
    const indent = line.search(/\S|$/);
    const trimmed = line.trim();

    const countryStart = /^-\s+type:\s*(.+)$/.exec(trimmed);
    if (indent === 2 && countryStart) {
      current = { type: unquote(countryStart[1]), areas: [] };
      definitions.push(current);
      inAreas = false;
      continue;
    }

    if (!current) {
      continue;
    }

    const prop = /^([A-Za-z0-9_]+):\s*(.*)$/.exec(trimmed);
    if (indent === 4 && prop) {
      inAreas = prop[1] === "areas";
      const number = Number(prop[2]);
      if (prop[1] === "fundingBase" && Number.isFinite(number)) {
        current.fundingBase = number;
      } else if (prop[1] === "fundingCap" && Number.isFinite(number)) {
        current.fundingCap = number;
      } else if (prop[1] === "labelLon" && Number.isFinite(number)) {
        current.labelLon = number;
      } else if (prop[1] === "labelLat" && Number.isFinite(number)) {
        current.labelLat = number;
      }
      continue;
    }

    if (inAreas && indent === 6) {
      const areaStart = /^-\s+(\[.*\])$/.exec(trimmed);
      if (areaStart) {
        const area = parseNumberList(areaStart[1]);
        if (area.length >= 4) {
          current.areas.push(area);
        }
      }
    }
  }

  return definitions;
}
