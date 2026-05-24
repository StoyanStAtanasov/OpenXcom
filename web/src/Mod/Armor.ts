import { ItemDamageType } from "./RuleItem.ts";
import { createUnitStats, mergeUnitStats, type UnitStats } from "./Unit.ts";

export enum MovementType {
  MT_WALK = 0,
  MT_FLY,
  MT_SLIDE,
  MT_FLOAT,
  MT_SINK
}

export enum ForcedTorso {
  TORSO_USE_GENDER = 0,
  TORSO_ALWAYS_MALE,
  TORSO_ALWAYS_FEMALE
}

export type ArmorDefinition = {
  type: string;
  spriteSheet?: string;
  spriteInv?: string;
  allowInv?: boolean;
  corpseItem?: string;
  corpseBattle: string[];
  corpseGeo?: string;
  storeItem?: string;
  specialWeapon?: string;
  frontArmor?: number;
  sideArmor?: number;
  rearArmor?: number;
  underArmor?: number;
  drawingRoutine?: number;
  drawBubbles?: boolean;
  movementType?: number;
  size?: number;
  weight?: number;
  stats?: Partial<UnitStats>;
  damageModifier: number[];
  loftempsSet: number[];
  loftemps?: number;
  deathFrames?: number;
  constantAnimation?: boolean;
  forcedTorso?: number;
  spriteFaceGroup?: number;
  spriteHairGroup?: number;
  spriteUtileGroup?: number;
  spriteRankGroup?: number;
  spriteFaceColor: number[];
  spriteHairColor: number[];
  spriteUtileColor: number[];
  spriteRankColor: number[];
  units: string[];
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

function parseInlineList(value: string): string[] | null {
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

function parseInlineNumberList(value: string): number[] | null {
  const parsed = parseInlineList(value);
  if (!parsed) {
    return null;
  }
  return parsed.map(Number).filter(Number.isFinite);
}

function setArmorProp(target: ArmorDefinition, key: string, value: string): void {
  switch (key) {
    case "spriteSheet":
    case "spriteInv":
    case "corpseItem":
    case "corpseGeo":
    case "storeItem":
    case "specialWeapon":
      target[key] = unquote(value);
      break;
    case "allowInv":
    case "drawBubbles":
    case "constantAnimation":
      target[key] = parseBool(value);
      break;
    case "frontArmor":
    case "sideArmor":
    case "rearArmor":
    case "underArmor":
    case "drawingRoutine":
    case "movementType":
    case "size":
    case "weight":
    case "loftemps":
    case "deathFrames":
    case "forcedTorso":
    case "spriteFaceGroup":
    case "spriteHairGroup":
    case "spriteUtileGroup":
    case "spriteRankGroup": {
      const n = parseNumber(value);
      if (n != null) {
        target[key] = n;
      }
      break;
    }
    case "damageModifier":
    case "loftempsSet":
    case "spriteFaceColor":
    case "spriteHairColor":
    case "spriteUtileColor":
    case "spriteRankColor": {
      const numbers = parseInlineNumberList(value);
      if (numbers) {
        target[key] = numbers;
      }
      break;
    }
    case "corpseBattle":
    case "units": {
      const list = parseInlineList(value);
      if (list) {
        target[key] = list;
      }
      break;
    }
    default:
      break;
  }
}

export class Armor {
  static DAMAGE_TYPES = 10;
  static NONE = "STR_NONE";

  private _spriteSheet = "";
  private _spriteInv = "";
  private _corpseGeo = "";
  private _storeItem = "";
  private _specWeapon = "";
  private _corpseBattle: string[] = [];
  private _frontArmor = 0;
  private _sideArmor = 0;
  private _rearArmor = 0;
  private _underArmor = 0;
  private _drawingRoutine = 0;
  private _drawBubbles = false;
  private _movementType = MovementType.MT_WALK;
  private _size = 1;
  private _weight = 0;
  private _damageModifier = Array.from({ length: Armor.DAMAGE_TYPES }, () => 1.0);
  private _loftempsSet: number[] = [];
  private _stats = createUnitStats();
  private _deathFrames = 3;
  private _constantAnimation = false;
  private _hasInventory = true;
  private _forcedTorso = ForcedTorso.TORSO_USE_GENDER;
  private _faceColorGroup = 0;
  private _hairColorGroup = 0;
  private _utileColorGroup = 0;
  private _rankColorGroup = 0;
  private _faceColor: number[] = [];
  private _hairColor: number[] = [];
  private _utileColor: number[] = [];
  private _rankColor: number[] = [];
  private _units: string[] = [];

  constructor(private _type: string) {}

  load(node: ArmorDefinition): void {
    this._type = node.type || this._type;
    this._spriteSheet = node.spriteSheet ?? this._spriteSheet;
    this._spriteInv = node.spriteInv ?? this._spriteInv;
    this._hasInventory = node.allowInv ?? this._hasInventory;
    if (node.corpseItem) {
      this._corpseBattle = [node.corpseItem];
      this._corpseGeo = node.corpseItem;
    } else if (node.corpseBattle.length > 0) {
      this._corpseBattle = [...node.corpseBattle];
      this._corpseGeo = node.corpseBattle[0];
    }
    this._corpseGeo = node.corpseGeo ?? this._corpseGeo;
    this._storeItem = node.storeItem ?? this._storeItem;
    this._specWeapon = node.specialWeapon ?? this._specWeapon;
    this._frontArmor = node.frontArmor ?? this._frontArmor;
    this._sideArmor = node.sideArmor ?? this._sideArmor;
    this._rearArmor = node.rearArmor ?? this._rearArmor;
    this._underArmor = node.underArmor ?? this._underArmor;
    this._drawingRoutine = node.drawingRoutine ?? this._drawingRoutine;
    this._drawBubbles = node.drawBubbles ?? this._drawBubbles;
    this._movementType = node.movementType ?? this._movementType;
    this._size = node.size ?? this._size;
    this._weight = node.weight ?? this._weight;
    mergeUnitStats(this._stats, node.stats || {});
    for (let i = 0; i < node.damageModifier.length && i < Armor.DAMAGE_TYPES; ++i) {
      this._damageModifier[i] = node.damageModifier[i];
    }
    this._loftempsSet = [...node.loftempsSet];
    if (node.loftemps != null) {
      this._loftempsSet = [node.loftemps];
    }
    this._deathFrames = node.deathFrames ?? this._deathFrames;
    this._constantAnimation = node.constantAnimation ?? this._constantAnimation;
    this._forcedTorso = node.forcedTorso ?? this._forcedTorso;
    this._faceColorGroup = node.spriteFaceGroup ?? this._faceColorGroup;
    this._hairColorGroup = node.spriteHairGroup ?? this._hairColorGroup;
    this._rankColorGroup = node.spriteRankGroup ?? this._rankColorGroup;
    this._utileColorGroup = node.spriteUtileGroup ?? this._utileColorGroup;
    this._faceColor = [...node.spriteFaceColor];
    this._hairColor = [...node.spriteHairColor];
    this._rankColor = [...node.spriteRankColor];
    this._utileColor = [...node.spriteUtileColor];
    this._units = [...node.units];
  }

  getType(): string {
    return this._type;
  }

  getSpriteSheet(): string {
    return this._spriteSheet;
  }

  getSpriteInventory(): string {
    return this._spriteInv;
  }

  getFrontArmor(): number {
    return this._frontArmor;
  }

  getSideArmor(): number {
    return this._sideArmor;
  }

  getRearArmor(): number {
    return this._rearArmor;
  }

  getUnderArmor(): number {
    return this._underArmor;
  }

  getCorpseGeoscape(): string {
    return this._corpseGeo;
  }

  getCorpseBattlescape(): string[] {
    return this._corpseBattle;
  }

  getStoreItem(): string {
    return this._storeItem;
  }

  getSpecialWeapon(): string {
    return this._specWeapon;
  }

  getDrawingRoutine(): number {
    return this._drawingRoutine;
  }

  drawBubbles(): boolean {
    return this._drawBubbles;
  }

  getMovementType(): MovementType {
    return this._movementType;
  }

  getSize(): number {
    return this._size;
  }

  getDamageModifier(dt: ItemDamageType | number): number {
    return this._damageModifier[dt] ?? 1.0;
  }

  getLoftempsSet(): number[] {
    return this._loftempsSet;
  }

  getStats(): UnitStats {
    return this._stats;
  }

  getWeight(): number {
    return this._weight;
  }

  getDeathFrames(): number {
    return this._deathFrames;
  }

  getConstantAnimation(): boolean {
    return this._constantAnimation;
  }

  getForcedTorso(): ForcedTorso {
    return this._forcedTorso;
  }

  getFaceColorGroup(): number {
    return this._faceColorGroup;
  }

  getHairColorGroup(): number {
    return this._hairColorGroup;
  }

  getUtileColorGroup(): number {
    return this._utileColorGroup;
  }

  getRankColorGroup(): number {
    return this._rankColorGroup;
  }

  getFaceColor(i: number): number {
    return this._faceColor[i] || 0;
  }

  getHairColor(i: number): number {
    return this._hairColor[i] || 0;
  }

  getUtileColor(i: number): number {
    return this._utileColor[i] || 0;
  }

  getRankColor(i: number): number {
    return this._rankColor[i] || 0;
  }

  hasInventory(): boolean {
    return this._hasInventory;
  }

  getUnits(): string[] {
    return this._units;
  }
}

export function parseArmorsRul(source: string): ArmorDefinition[] {
  const definitions: ArmorDefinition[] = [];
  let current: ArmorDefinition | null = null;
  let section = "";

  for (const raw of source.split(/\r?\n/)) {
    const line = stripComment(raw);
    if (!line.trim() || line.trim().startsWith("armors:")) {
      continue;
    }
    const indent = line.search(/\S|$/);
    const trimmed = line.trim();

    const armorStart = /^-\s+type:\s*(.+)$/.exec(trimmed);
    if (indent === 2 && armorStart) {
      current = {
        type: unquote(armorStart[1]),
        corpseBattle: [],
        damageModifier: [],
        loftempsSet: [],
        spriteFaceColor: [],
        spriteHairColor: [],
        spriteUtileColor: [],
        spriteRankColor: [],
        units: [],
        stats: createUnitStats()
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
      section = ["corpseBattle", "damageModifier", "loftempsSet", "units", "stats"].includes(prop[1]) ? prop[1] : "";
      setArmorProp(current, prop[1], prop[2]);
      continue;
    }

    const entry = /^-\s+(.+)$/.exec(trimmed);
    if (indent === 6 && entry) {
      if (section === "corpseBattle" || section === "units") {
        current[section].push(unquote(entry[1]));
      } else if (section === "damageModifier" || section === "loftempsSet") {
        const n = parseNumber(entry[1]);
        if (n != null) {
          current[section].push(n);
        }
      }
      continue;
    }

    if (indent === 6 && prop && section === "stats" && current.stats) {
      const n = parseNumber(prop[2]);
      if (n != null && prop[1] in current.stats) {
        current.stats[prop[1] as keyof UnitStats] = n;
      }
    }
  }

  return definitions;
}
