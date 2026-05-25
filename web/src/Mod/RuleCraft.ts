import type { MapBlockDefinition } from "./MapBlock.ts";
import { RuleTerrain, type RuleTerrainDefinition, type MapDataSetResolver } from "./RuleTerrain.ts";

export type CraftWeaponDefinition = {
  type: string;
  ammo?: number;
};

export type CraftDefinition = {
  type: string;
  requires: string[];
  sprite?: number;
  marker?: number;
  fuelMax?: number;
  damageMax?: number;
  speedMax?: number;
  accel?: number;
  weapons?: number;
  soldiers?: number;
  vehicles?: number;
  costBuy?: number;
  costRent?: number;
  costSell?: number;
  refuelItem?: string;
  repairRate?: number;
  refuelRate?: number;
  radarRange?: number;
  radarChance?: number;
  sightRange?: number;
  transferTime?: number;
  score?: number;
  spacecraft?: boolean;
  listOrder?: number;
  maxItems?: number;
  maxAltitude?: number;
  battlescapeTerrainData?: RuleTerrainDefinition;
  deployment?: number[][];
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

function parseBool(value: string): boolean {
  return value.trim() === "true";
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

function setCraftProp(target: CraftDefinition, key: string, value: string): void {
  switch (key) {
    case "sprite":
    case "marker":
    case "fuelMax":
    case "damageMax":
    case "speedMax":
    case "accel":
    case "weapons":
    case "soldiers":
    case "vehicles":
    case "costBuy":
    case "costRent":
    case "costSell":
    case "repairRate":
    case "refuelRate":
    case "radarRange":
    case "radarChance":
    case "sightRange":
    case "transferTime":
    case "score":
    case "listOrder":
    case "maxItems":
    case "maxAltitude": {
      const n = parseNumber(value);
      if (n != null) {
        target[key] = n;
      }
      break;
    }
    case "spacecraft":
      target.spacecraft = parseBool(value);
      break;
    case "refuelItem":
      target.refuelItem = unquote(value);
      break;
    default:
      break;
  }
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

export class RuleCraft {
  private _requires: string[] = [];
  private _sprite = -1;
  private _marker = -1;
  private _fuelMax = 0;
  private _damageMax = 0;
  private _speedMax = 0;
  private _accel = 0;
  private _weapons = 0;
  private _soldiers = 0;
  private _vehicles = 0;
  private _costBuy = 0;
  private _costRent = 0;
  private _costSell = 0;
  private _refuelItem = "";
  private _repairRate = 1;
  private _refuelRate = 1;
  private _radarRange = 672;
  private _radarChance = 100;
  private _sightRange = 1696;
  private _transferTime = 0;
  private _score = 0;
  private _spacecraft = false;
  private _listOrder = 0;
  private _maxItems = 0;
  private _maxAltitude = -1;
  private _battlescapeTerrainData: RuleTerrain | null = null;
  private _deployment: number[][] = [];

  constructor(private _type: string) {}

  load(node: CraftDefinition, listOrder = 0, mod?: MapDataSetResolver): void {
    this._type = node.type || this._type;
    this._requires = [...(node.requires || [])];
    this._sprite = node.sprite ?? this._sprite;
    this._marker = node.marker ?? this._marker;
    this._fuelMax = node.fuelMax ?? this._fuelMax;
    this._damageMax = node.damageMax ?? this._damageMax;
    this._speedMax = node.speedMax ?? this._speedMax;
    this._accel = node.accel ?? this._accel;
    this._weapons = node.weapons ?? this._weapons;
    this._soldiers = node.soldiers ?? this._soldiers;
    this._vehicles = node.vehicles ?? this._vehicles;
    this._costBuy = node.costBuy ?? this._costBuy;
    this._costRent = node.costRent ?? this._costRent;
    this._costSell = node.costSell ?? this._costSell;
    this._refuelItem = node.refuelItem ?? this._refuelItem;
    this._repairRate = node.repairRate ?? this._repairRate;
    this._refuelRate = node.refuelRate ?? this._refuelRate;
    this._radarRange = node.radarRange ?? this._radarRange;
    this._radarChance = node.radarChance ?? this._radarChance;
    this._sightRange = node.sightRange ?? this._sightRange;
    this._transferTime = node.transferTime ?? this._transferTime;
    this._score = node.score ?? this._score;
    this._spacecraft = node.spacecraft ?? this._spacecraft;
    this._listOrder = node.listOrder ?? listOrder;
    this._maxItems = node.maxItems ?? this._maxItems;
    this._maxAltitude = node.maxAltitude ?? this._maxAltitude;
    if (node.battlescapeTerrainData) {
      const rule = new RuleTerrain(node.battlescapeTerrainData.name);
      rule.load(node.battlescapeTerrainData, mod);
      this._battlescapeTerrainData = rule;
    }
    if (node.deployment) {
      this._deployment = node.deployment.map(row => [...row]);
    }
  }

  getType(): string {
    return this._type;
  }

  getRequirements(): string[] {
    return this._requires;
  }

  getSprite(): number {
    return this._sprite;
  }

  getMarker(): number {
    return this._marker;
  }

  getMaxFuel(): number {
    return this._fuelMax;
  }

  getMaxDamage(): number {
    return this._damageMax;
  }

  getMaxSpeed(): number {
    return this._speedMax;
  }

  getAcceleration(): number {
    return this._accel;
  }

  getWeapons(): number {
    return this._weapons;
  }

  getSoldiers(): number {
    return this._soldiers;
  }

  getVehicles(): number {
    return this._vehicles;
  }

  getBuyCost(): number {
    return this._costBuy;
  }

  getRentCost(): number {
    return this._costRent;
  }

  getSellCost(): number {
    return this._costSell;
  }

  getRefuelItem(): string {
    return this._refuelItem;
  }

  getRepairRate(): number {
    return this._repairRate;
  }

  getRefuelRate(): number {
    return this._refuelRate;
  }

  getRadarRange(): number {
    return this._radarRange;
  }

  getRadarChance(): number {
    return this._radarChance;
  }

  getSightRange(): number {
    return this._sightRange;
  }

  getTransferTime(): number {
    return this._transferTime;
  }

  getScore(): number {
    return this._score;
  }

  getSpacecraft(): boolean {
    return this._spacecraft;
  }

  getListOrder(): number {
    return this._listOrder;
  }

  getMaxItems(): number {
    return this._maxItems;
  }

  getMaxAltitude(): number {
    return this._maxAltitude;
  }

  isWaterOnly(): boolean {
    return this._maxAltitude > -1;
  }

  getBattlescapeTerrainData(): RuleTerrain | null {
    return this._battlescapeTerrainData;
  }

  getDeployment(): number[][] {
    return this._deployment;
  }
}

export function parseCraftsRul(source: string): CraftDefinition[] {
  const definitions: CraftDefinition[] = [];
  let current: CraftDefinition | null = null;
  let terrain: RuleTerrainDefinition | null = null;
  let mapBlock: MapBlockDefinition | null = null;
  let inRequires = false;
  let section = "";

  for (const raw of source.split(/\r?\n/)) {
    const line = stripComment(raw);
    if (!line.trim() || line.trim() === "crafts:") {
      continue;
    }
    const indent = line.search(/\S|$/);
    const trimmed = line.trim();

    const craftStart = /^-\s+type:\s*(.+)$/.exec(trimmed);
    if (indent === 2 && craftStart) {
      current = { type: unquote(craftStart[1]), requires: [] };
      definitions.push(current);
      terrain = null;
      mapBlock = null;
      inRequires = false;
      section = "";
      continue;
    }

    if (!current) {
      continue;
    }

    const prop = /^([A-Za-z0-9_]+):\s*(.*)$/.exec(trimmed);
    if (indent === 4 && prop) {
      inRequires = prop[1] === "requires";
      terrain = null;
      mapBlock = null;
      if (prop[1] === "battlescapeTerrainData") {
        terrain = { name: current.type, mapDataSets: [], mapBlocks: [] };
        current.battlescapeTerrainData = terrain;
        section = "battlescapeTerrainData";
      } else if (prop[1] === "deployment") {
        current.deployment = [];
        section = "deployment";
      } else if (!inRequires) {
        section = "";
        setCraftProp(current, prop[1], prop[2]);
      }
      continue;
    }

    if (inRequires && indent === 6) {
      const required = /^-\s+(.+)$/.exec(trimmed);
      if (required) {
        current.requires.push(unquote(required[1]));
      }
      continue;
    }

    if (section === "deployment" && indent === 6) {
      const row = /^-\s+(.+)$/.exec(trimmed);
      const values = row ? parseNumberList(row[1]) : null;
      if (values && values.length >= 4) {
        (current.deployment ||= []).push(values);
      }
      continue;
    }

    if (!terrain) {
      continue;
    }

    if (indent === 6 && prop) {
      mapBlock = null;
      if (prop[1] === "mapDataSets") {
        section = "mapDataSets";
        terrain.mapDataSets = parseStringList(prop[2]) || terrain.mapDataSets || [];
      } else if (prop[1] === "mapBlocks") {
        section = "mapBlocks";
        terrain.mapBlocks = terrain.mapBlocks || [];
      } else {
        section = "battlescapeTerrainData";
        setTerrainProp(terrain, prop[1], prop[2]);
      }
      continue;
    }

    const listItem = /^-\s+(.+)$/.exec(trimmed);
    if (indent === 8 && listItem && section === "mapDataSets") {
      (terrain.mapDataSets ||= []).push(unquote(listItem[1]));
      continue;
    }

    const blockStart = /^-\s+name:\s*(.+)$/.exec(trimmed);
    if (indent === 8 && blockStart && section === "mapBlocks") {
      mapBlock = { name: unquote(blockStart[1]) };
      (terrain.mapBlocks ||= []).push(mapBlock);
      continue;
    }

    if (indent === 10 && mapBlock && prop) {
      setMapBlockProp(mapBlock, prop[1], prop[2]);
    }
  }

  return definitions;
}
