import { TilePart } from "./MapData.ts";
import type { MapDataSet } from "./MapDataSet.ts";

export type MCDPatchEntry = {
  MCDIndex: number;
  bigWall?: number;
  TUWalk?: number;
  TUFly?: number;
  TUSlide?: number;
  deathTile?: number;
  terrainHeight?: number;
  specialType?: number;
  explosive?: number;
  armor?: number;
  flammability?: number;
  fuel?: number;
  HEBlock?: number;
  footstepSound?: number;
  objectType?: number;
  noFloor?: boolean;
  stopLOS?: boolean;
  LOFTS?: number[];
};

export type MCDPatchDefinition = {
  type: string;
  data: MCDPatchEntry[];
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

function parseNumberList(value: string): number[] | null {
  const trimmed = value.trim();
  if (!trimmed.startsWith("[") || !trimmed.endsWith("]")) {
    return null;
  }
  const inner = trimmed.slice(1, -1).trim();
  if (!inner) {
    return [];
  }
  const numbers = inner.split(",").map(part => Number(part.trim()));
  return numbers.every(Number.isFinite) ? numbers : null;
}

function parsePatchValue(key: string, value: string): number | boolean | number[] | null {
  if (key === "LOFTS") {
    return parseNumberList(value);
  }
  if (value.trim() === "true") {
    return true;
  }
  if (value.trim() === "false") {
    return false;
  }
  const number = Number(unquote(value));
  return Number.isFinite(number) ? number : null;
}

export class MCDPatch {
  private _data: MCDPatchEntry[] = [];

  load(node: MCDPatchDefinition): void {
    this._data = node.data.map(entry => ({ ...entry, LOFTS: entry.LOFTS ? [...entry.LOFTS] : undefined }));
  }

  modifyData(dataSet: MapDataSet): void {
    for (const entry of this._data) {
      const object = dataSet.getObject(entry.MCDIndex);
      if (entry.bigWall != null) {
        object.setBigWall(entry.bigWall);
      }
      if (entry.TUWalk != null) {
        object.setTUWalk(entry.TUWalk);
      }
      if (entry.TUFly != null) {
        object.setTUFly(entry.TUFly);
      }
      if (entry.TUSlide != null) {
        object.setTUSlide(entry.TUSlide);
      }
      if (entry.deathTile != null) {
        object.setDieMCD(entry.deathTile);
      }
      if (entry.terrainHeight != null) {
        object.setTerrainLevel(entry.terrainHeight);
      }
      if (entry.specialType != null) {
        object.setSpecialType(entry.specialType, object.getObjectType());
      }
      if (entry.explosive != null) {
        object.setExplosive(entry.explosive);
      }
      if (entry.armor != null) {
        object.setArmor(entry.armor);
      }
      if (entry.flammability != null) {
        object.setFlammable(entry.flammability);
      }
      if (entry.fuel != null) {
        object.setFuel(entry.fuel);
      }
      if (entry.HEBlock != null) {
        object.setHEBlock(entry.HEBlock);
      }
      if (entry.footstepSound != null) {
        object.setFootstepSound(entry.footstepSound);
      }
      if (entry.objectType != null) {
        object.setObjectType(entry.objectType as TilePart);
      }
      if (entry.noFloor != null) {
        object.setNoFloor(entry.noFloor);
      }
      if (entry.stopLOS != null) {
        object.setStopLOS(entry.stopLOS);
      }
      if (entry.LOFTS) {
        for (let layer = 0; layer < entry.LOFTS.length; ++layer) {
          object.setLoftID(entry.LOFTS[layer], layer);
        }
      }
    }
  }

  getEntries(): MCDPatchEntry[] {
    return this._data.map(entry => ({ ...entry, LOFTS: entry.LOFTS ? [...entry.LOFTS] : undefined }));
  }
}

export function parseMCDPatchesRul(source: string): MCDPatchDefinition[] {
  const patches: MCDPatchDefinition[] = [];
  let current: MCDPatchDefinition | null = null;
  let currentEntry: MCDPatchEntry | null = null;

  for (const rawLine of source.split(/\r?\n/)) {
    const line = stripComment(rawLine);
    if (!line.trim()) {
      continue;
    }

    const patchMatch = /^\s*-\s+type:\s*(.+)$/.exec(line);
    if (patchMatch) {
      current = { type: unquote(patchMatch[1]), data: [] };
      patches.push(current);
      currentEntry = null;
      continue;
    }

    const entryMatch = /^\s*-\s+MCDIndex:\s*(-?\d+)\s*$/.exec(line);
    if (entryMatch && current) {
      currentEntry = { MCDIndex: Number(entryMatch[1]) };
      current.data.push(currentEntry);
      continue;
    }

    if (!currentEntry) {
      continue;
    }

    const propMatch = /^\s+([A-Za-z][A-Za-z0-9_]*):\s*(.+)$/.exec(line);
    if (!propMatch || propMatch[1] === "data") {
      continue;
    }
    const key = propMatch[1] as keyof MCDPatchEntry;
    const parsed = parsePatchValue(propMatch[1], propMatch[2]);
    if (parsed != null) {
      (currentEntry as Record<string, unknown>)[key] = parsed;
    }
  }

  return patches;
}
