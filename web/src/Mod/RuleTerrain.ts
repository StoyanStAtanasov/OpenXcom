import { RNG } from "../Engine/RNG.ts";
import type { MapData } from "./MapData.ts";
import { MapBlock, type MapBlockDefinition, type Position } from "./MapBlock.ts";
import { MapDataSet } from "./MapDataSet.ts";

export type RuleTerrainDefinition = {
  name: string;
  mapDataSets?: string[];
  mapBlocks?: MapBlockDefinition[];
  civilianTypes?: string[];
  music?: string[];
  depth?: number[];
  ambience?: number;
  ambientVolume?: number;
  script?: string;
};

export type MapDataSetResolver = {
  getMapDataSet(name: string): MapDataSet;
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

function parseStringList(value: string): string[] | null {
  const trimmed = value.trim();
  if (!trimmed.startsWith("[") || !trimmed.endsWith("]")) {
    return null;
  }
  const inside = trimmed.slice(1, -1).trim();
  if (!inside) {
    return [];
  }
  return inside.split(",").map(part => unquote(part)).filter(Boolean);
}

function parseNumberList(value: string): number[] | null {
  const trimmed = value.trim();
  if (!trimmed.startsWith("[") || !trimmed.endsWith("]")) {
    return null;
  }
  const inside = trimmed.slice(1, -1).trim();
  if (!inside) {
    return [];
  }
  const numbers = inside.split(",").map(part => parseNumber(part));
  return numbers.every(number => number != null) ? numbers as number[] : null;
}

function parsePosition(value: string): Position | null {
  const numbers = parseNumberList(value);
  if (!numbers || numbers.length < 3) {
    return null;
  }
  return { x: numbers[0], y: numbers[1], z: numbers[2] };
}

function setTerrainProp(target: RuleTerrainDefinition, key: string, value: string): void {
  if (key === "name" || key === "script") {
    (target as Record<string, unknown>)[key] = unquote(value);
    return;
  }
  if (key === "civilianTypes" || key === "music" || key === "mapDataSets") {
    const list = parseStringList(value);
    if (list) {
      (target as Record<string, unknown>)[key] = list;
    }
    return;
  }
  if (key === "depth") {
    const list = parseNumberList(value);
    if (list) {
      target.depth = list;
    }
    return;
  }
  if (key === "ambience" || key === "ambientVolume") {
    const n = parseNumber(value);
    if (n != null) {
      (target as Record<string, unknown>)[key] = n;
    }
  }
}

function setMapBlockProp(target: MapBlockDefinition, key: string, value: string): void {
  if (key === "name") {
    target.name = unquote(value);
    return;
  }
  if (key === "width" || key === "length" || key === "height") {
    const n = parseNumber(value);
    if (n != null) {
      (target as Record<string, unknown>)[key] = n;
    }
    return;
  }
  if (key === "groups" || key === "revealedFloors") {
    const list = parseNumberList(value);
    if (list) {
      (target as Record<string, unknown>)[key] = list;
    } else {
      const n = parseNumber(value);
      if (n != null) {
        (target as Record<string, unknown>)[key] = [n];
      }
    }
  }
}

export class RuleTerrain {
  private _mapDataSetNames: string[] = [];
  private _mapDataSets: MapDataSet[] = [];
  private _mapBlocks: MapBlock[] = [];
  private _script = "DEFAULT";
  private _civilianTypes = ["MALE_CIVILIAN", "FEMALE_CIVILIAN"];
  private _music: string[] = [];
  private _minDepth = 0;
  private _maxDepth = 0;
  private _ambience = -1;
  private _ambientVolume = 0.5;

  constructor(private _name: string) {}

  load(node: RuleTerrainDefinition, mod?: MapDataSetResolver): void {
    if (node.mapDataSets) {
      this._mapDataSetNames = [...node.mapDataSets];
      this._mapDataSets = this._mapDataSetNames.map(name => mod?.getMapDataSet(name) || new MapDataSet(name));
    }
    if (node.mapBlocks) {
      this._mapBlocks = [];
      for (const definition of node.mapBlocks) {
        const mapBlock = new MapBlock(definition.name);
        mapBlock.load(definition);
        this._mapBlocks.push(mapBlock);
      }
    }
    this._name = node.name || this._name;
    this._civilianTypes = [...(node.civilianTypes || this._civilianTypes)];
    if (node.music) {
      this._music.push(...node.music);
    }
    if (node.depth && node.depth.length >= 2) {
      this._minDepth = node.depth[0];
      this._maxDepth = node.depth[1];
    }
    this._ambience = node.ambience ?? this._ambience;
    this._ambientVolume = node.ambientVolume ?? this._ambientVolume;
    this._script = node.script ?? this._script;
  }

  getName(): string {
    return this._name;
  }

  getMapBlocks(): MapBlock[] {
    return this._mapBlocks;
  }

  getMapDataSets(): MapDataSet[] {
    return this._mapDataSets;
  }

  getMapDataSetNames(): string[] {
    return this._mapDataSetNames;
  }

  getRandomMapBlock(maxSizeX: number, maxSizeY: number, group: number, force = true): MapBlock | null {
    const compliant = this._mapBlocks.filter(mapBlock =>
      (mapBlock.getSizeX() === maxSizeX || (!force && mapBlock.getSizeX() < maxSizeX)) &&
      (mapBlock.getSizeY() === maxSizeY || (!force && mapBlock.getSizeY() < maxSizeY)) &&
      mapBlock.isInGroup(group)
    );
    if (compliant.length === 0) {
      return null;
    }
    return compliant[RNG.generate(0, compliant.length - 1)];
  }

  getMapBlock(name: string): MapBlock | null {
    return this._mapBlocks.find(mapBlock => mapBlock.getName() === name) || null;
  }

  getMapData(id: { value: number }, mapDataSetID: { value: number }): MapData {
    if (this._mapDataSets.length === 0) {
      throw new Error(`Terrain ${this._name} has no map data sets.`);
    }
    let mdf = this._mapDataSets[0];
    let i = 0;
    for (; i < this._mapDataSets.length; ++i) {
      mdf = this._mapDataSets[i];
      if (id.value < mdf.getSize()) {
        break;
      }
      id.value -= mdf.getSize();
      mapDataSetID.value++;
    }
    if (i === this._mapDataSets.length) {
      mdf = this._mapDataSets[0];
      id.value = 0;
      mapDataSetID.value = 0;
    }
    return mdf.getObject(id.value);
  }

  getCivilianTypes(): string[] {
    return this._civilianTypes;
  }

  getMinDepth(): number {
    return this._minDepth;
  }

  getMaxDepth(): number {
    return this._maxDepth;
  }

  getAmbience(): number {
    return this._ambience;
  }

  getScript(): string {
    return this._script;
  }

  getMusic(): string[] {
    return this._music;
  }

  getAmbientVolume(): number {
    return this._ambientVolume;
  }
}

export function parseTerrainsRul(source: string): RuleTerrainDefinition[] {
  const definitions: RuleTerrainDefinition[] = [];
  let current: RuleTerrainDefinition | null = null;
  let mapBlock: MapBlockDefinition | null = null;
  let section = "";
  let currentItem = "";

  for (const raw of source.split(/\r?\n/)) {
    const line = stripComment(raw);
    if (!line.trim() || line.trim().startsWith("terrains:")) {
      continue;
    }
    const indent = line.search(/\S|$/);
    const trimmed = line.trim();

    const terrainStart = /^-\s+name:\s*(.+)$/.exec(trimmed);
    if (indent === 2 && terrainStart) {
      current = { name: unquote(terrainStart[1]), mapDataSets: [], mapBlocks: [] };
      definitions.push(current);
      mapBlock = null;
      section = "";
      currentItem = "";
      continue;
    }

    if (!current) {
      continue;
    }

    const prop = /^([A-Za-z0-9_]+):\s*(.*)$/.exec(trimmed);
    if (indent === 4 && prop) {
      mapBlock = null;
      currentItem = "";
      if (prop[1] === "mapDataSets") {
        section = "mapDataSets";
        current.mapDataSets = parseStringList(prop[2]) || current.mapDataSets || [];
      } else if (prop[1] === "mapBlocks") {
        section = "mapBlocks";
        current.mapBlocks = current.mapBlocks || [];
      } else if (prop[1] === "civilianTypes") {
        section = "civilianTypes";
        current.civilianTypes = parseStringList(prop[2]) || current.civilianTypes || [];
      } else if (prop[1] === "music") {
        section = "music";
        current.music = parseStringList(prop[2]) || current.music || [];
      } else {
        section = "";
        setTerrainProp(current, prop[1], prop[2]);
      }
      continue;
    }

    if (indent === 6) {
      const blockStart = /^-\s+name:\s*(.+)$/.exec(trimmed);
      if (blockStart) {
        mapBlock = { name: unquote(blockStart[1]) };
        (current.mapBlocks ||= []).push(mapBlock);
        section = "mapBlocks";
        currentItem = "";
        continue;
      }
    }

    const listItem = /^-\s+(.+)$/.exec(trimmed);
    if (indent === 6 && listItem) {
      if (section === "mapDataSets") {
        (current.mapDataSets ||= []).push(unquote(listItem[1]));
      } else if (section === "civilianTypes") {
        (current.civilianTypes ||= []).push(unquote(listItem[1]));
      } else if (section === "music") {
        (current.music ||= []).push(unquote(listItem[1]));
      }
      continue;
    }

    if (!mapBlock) {
      continue;
    }

    if (indent === 8 && prop) {
      currentItem = "";
      if (prop[1] === "items") {
        section = "mapBlockItems";
        mapBlock.items ||= {};
      } else {
        setMapBlockProp(mapBlock, prop[1], prop[2]);
      }
      continue;
    }

    if (indent === 10 && section === "mapBlockItems") {
      const itemType = /^([A-Za-z0-9_]+):\s*$/.exec(trimmed);
      if (itemType) {
        currentItem = itemType[1];
        (mapBlock.items ||= {})[currentItem] = [];
      }
      continue;
    }

    if (indent === 12 && section === "mapBlockItems" && currentItem) {
      const positionLine = /^-\s+(\[.*\])$/.exec(trimmed);
      if (positionLine) {
        const position = parsePosition(positionLine[1]);
        if (position) {
          (mapBlock.items ||= {})[currentItem].push(position);
        }
      }
    }
  }

  return definitions;
}
