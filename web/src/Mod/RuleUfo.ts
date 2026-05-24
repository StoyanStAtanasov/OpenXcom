import type { MapBlockDefinition, Position } from "./MapBlock.ts";
import { RuleTerrain, type RuleTerrainDefinition, type MapDataSetResolver } from "./RuleTerrain.ts";

export type RuleUfoDefinition = {
  type: string;
  size?: string;
  sprite?: number;
  marker?: number;
  markerLand?: number;
  markerCrash?: number;
  damageMax?: number;
  speedMax?: number;
  power?: number;
  range?: number;
  score?: number;
  reload?: number;
  breakOffTime?: number;
  sightRange?: number;
  missionScore?: number;
  battlescapeTerrainData?: RuleTerrainDefinition;
  modSprite?: string;
};

const ufoNumberKeys = new Set<string>([
  "sprite",
  "marker",
  "markerLand",
  "markerCrash",
  "damageMax",
  "speedMax",
  "power",
  "range",
  "score",
  "reload",
  "breakOffTime",
  "sightRange",
  "missionScore"
]);

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
  const numbers: number[] = [];
  const inside = trimmed.slice(1, -1).trim();
  if (!inside) {
    return [];
  }
  for (const part of inside.split(",")) {
    const n = parseNumber(part);
    if (n == null) {
      return null;
    }
    numbers.push(n);
  }
  return numbers;
}

function parsePosition(value: string): Position | null {
  const numbers = parseNumberList(value);
  if (!numbers || numbers.length < 3) {
    return null;
  }
  return { x: numbers[0], y: numbers[1], z: numbers[2] };
}

function setUfoProp(target: RuleUfoDefinition, key: string, value: string): void {
  if (key === "size" || key === "modSprite") {
    (target as Record<string, unknown>)[key] = unquote(value);
    return;
  }
  if (ufoNumberKeys.has(key)) {
    const n = parseNumber(value);
    if (n != null) {
      (target as Record<string, unknown>)[key] = n;
    }
  }
}

function setTerrainProp(target: RuleTerrainDefinition, key: string, value: string): void {
  if (key === "name" || key === "script") {
    (target as Record<string, unknown>)[key] = unquote(value);
    return;
  }
  if (key === "civilianTypes" || key === "music") {
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

export class RuleUfo {
  private _size = "STR_VERY_SMALL";
  private _sprite = -1;
  private _marker = -1;
  private _markerLand = -1;
  private _markerCrash = -1;
  private _damageMax = 0;
  private _speedMax = 0;
  private _power = 0;
  private _range = 0;
  private _score = 0;
  private _reload = 0;
  private _breakOffTime = 0;
  private _sightRange = 268;
  private _missionScore = 1;
  private _battlescapeTerrainData: RuleTerrain | null = null;
  private _modSprite = "";

  constructor(private _type: string) {}

  load(node: RuleUfoDefinition, mod?: MapDataSetResolver): void {
    this._type = node.type || this._type;
    this._size = node.size ?? this._size;
    this._sprite = node.sprite ?? this._sprite;
    this._marker = node.marker ?? this._marker;
    this._markerLand = node.markerLand ?? this._markerLand;
    this._markerCrash = node.markerCrash ?? this._markerCrash;
    this._damageMax = node.damageMax ?? this._damageMax;
    this._speedMax = node.speedMax ?? this._speedMax;
    this._power = node.power ?? this._power;
    this._range = node.range ?? this._range;
    this._score = node.score ?? this._score;
    this._reload = node.reload ?? this._reload;
    this._breakOffTime = node.breakOffTime ?? this._breakOffTime;
    this._sightRange = node.sightRange ?? this._sightRange;
    this._missionScore = node.missionScore ?? this._missionScore;
    if (node.battlescapeTerrainData) {
      const rule = new RuleTerrain(node.battlescapeTerrainData.name);
      rule.load(node.battlescapeTerrainData, mod);
      this._battlescapeTerrainData = rule;
    }
    this._modSprite = node.modSprite ?? this._modSprite;
  }

  getType(): string {
    return this._type;
  }

  getSize(): string {
    return this._size;
  }

  getRadius(): number {
    if (this._size === "STR_VERY_SMALL") {
      return 2;
    } else if (this._size === "STR_SMALL") {
      return 3;
    } else if (this._size === "STR_MEDIUM_UC") {
      return 4;
    } else if (this._size === "STR_LARGE") {
      return 5;
    } else if (this._size === "STR_VERY_LARGE") {
      return 6;
    }
    return 0;
  }

  getSprite(): number {
    return this._sprite;
  }

  getMarker(): number {
    return this._marker;
  }

  getLandMarker(): number {
    return this._markerLand;
  }

  getCrashMarker(): number {
    return this._markerCrash;
  }

  getMaxDamage(): number {
    return this._damageMax;
  }

  getMaxSpeed(): number {
    return this._speedMax;
  }

  getWeaponPower(): number {
    return this._power;
  }

  getWeaponRange(): number {
    return this._range;
  }

  getScore(): number {
    return this._score;
  }

  getBattlescapeTerrainData(): RuleTerrain | null {
    return this._battlescapeTerrainData;
  }

  getWeaponReload(): number {
    return this._reload;
  }

  getBreakOffTime(): number {
    return this._breakOffTime;
  }

  getModSprite(): string {
    return this._modSprite;
  }

  getSightRange(): number {
    return this._sightRange;
  }

  getMissionScore(): number {
    return this._missionScore;
  }
}

export function parseUfosRul(source: string): RuleUfoDefinition[] {
  const definitions: RuleUfoDefinition[] = [];
  let current: RuleUfoDefinition | null = null;
  let terrain: RuleTerrainDefinition | null = null;
  let mapBlock: MapBlockDefinition | null = null;
  let section = "";
  let currentItem = "";

  for (const raw of source.split(/\r?\n/)) {
    const line = stripComment(raw);
    if (!line.trim() || line.trim().startsWith("ufos:")) {
      continue;
    }
    const indent = line.search(/\S|$/);
    const trimmed = line.trim();

    const ufoStart = /^-\s+type:\s*(.+)$/.exec(trimmed);
    if (indent === 2 && ufoStart) {
      current = { type: unquote(ufoStart[1]) };
      definitions.push(current);
      terrain = null;
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
      if (prop[1] === "battlescapeTerrainData") {
        terrain = { name: "", mapDataSets: [], mapBlocks: [] };
        current.battlescapeTerrainData = terrain;
        section = "";
      } else {
        setUfoProp(current, prop[1], prop[2]);
      }
      continue;
    }

    if (!terrain) {
      continue;
    }

    if (indent === 6 && prop) {
      mapBlock = null;
      currentItem = "";
      if (prop[1] === "mapDataSets") {
        section = "mapDataSets";
        terrain.mapDataSets = parseStringList(prop[2]) || terrain.mapDataSets || [];
      } else if (prop[1] === "mapBlocks") {
        section = "mapBlocks";
        terrain.mapBlocks = terrain.mapBlocks || [];
      } else {
        section = "";
        setTerrainProp(terrain, prop[1], prop[2]);
      }
      continue;
    }

    if (indent === 8 && section === "mapDataSets") {
      const item = /^-\s+(.+)$/.exec(trimmed);
      if (item) {
        (terrain.mapDataSets ||= []).push(unquote(item[1]));
      }
      continue;
    }

    if (indent === 8 && section === "mapBlocks") {
      const blockStart = /^-\s+name:\s*(.+)$/.exec(trimmed);
      if (blockStart) {
        mapBlock = { name: unquote(blockStart[1]) };
        (terrain.mapBlocks ||= []).push(mapBlock);
      }
      continue;
    }

    if (!mapBlock) {
      continue;
    }

    if (indent === 10 && prop) {
      currentItem = "";
      if (prop[1] === "items") {
        section = "mapBlockItems";
        mapBlock.items ||= {};
      } else {
        setMapBlockProp(mapBlock, prop[1], prop[2]);
      }
      continue;
    }

    if (indent === 12 && section === "mapBlockItems") {
      const itemType = /^([A-Za-z0-9_]+):\s*$/.exec(trimmed);
      if (itemType) {
        currentItem = itemType[1];
        (mapBlock.items ||= {})[currentItem] = [];
      }
      continue;
    }

    if (indent === 14 && section === "mapBlockItems" && currentItem) {
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
