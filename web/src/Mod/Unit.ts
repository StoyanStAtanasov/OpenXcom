export type UnitStats = {
  tu: number;
  stamina: number;
  health: number;
  bravery: number;
  reactions: number;
  firing: number;
  throwing: number;
  strength: number;
  psiStrength: number;
  psiSkill: number;
  melee: number;
};

export function createUnitStats(source: Partial<UnitStats> = {}): UnitStats {
  return {
    tu: source.tu || 0,
    stamina: source.stamina || 0,
    health: source.health || 0,
    bravery: source.bravery || 0,
    reactions: source.reactions || 0,
    firing: source.firing || 0,
    throwing: source.throwing || 0,
    strength: source.strength || 0,
    psiStrength: source.psiStrength || 0,
    psiSkill: source.psiSkill || 0,
    melee: source.melee || 0
  };
}

export function mergeUnitStats(target: UnitStats, source: Partial<UnitStats>): void {
  for (const key of Object.keys(target) as Array<keyof UnitStats>) {
    if (source[key]) {
      target[key] = source[key] || target[key];
    }
  }
}

export enum SpecialAbility {
  SPECAB_NONE = 0,
  SPECAB_EXPLODEONDEATH,
  SPECAB_BURNFLOOR,
  SPECAB_BURN_AND_EXPLODE
}

export type UnitDefinition = {
  type: string;
  race?: string;
  rank?: string;
  stats?: Partial<UnitStats>;
  armor?: string;
  standHeight?: number;
  kneelHeight?: number;
  floatHeight?: number;
  value?: number;
  deathSound?: number[];
  aggroSound?: number;
  moveSound?: number;
  intelligence?: number;
  aggression?: number;
  energyRecovery?: number;
  specab?: number;
  spawnUnit?: string;
  livingWeapon?: boolean;
  meleeWeapon?: string;
  psiWeapon?: string;
  capturable?: boolean;
  builtInWeaponSets?: string[][];
  builtInWeapons?: string[];
};

const statKeys = new Set<string>([
  "tu",
  "stamina",
  "health",
  "bravery",
  "reactions",
  "firing",
  "throwing",
  "strength",
  "psiStrength",
  "psiSkill",
  "melee"
]);

const numericUnitKeys = new Set<string>([
  "standHeight",
  "kneelHeight",
  "floatHeight",
  "value",
  "aggroSound",
  "moveSound",
  "intelligence",
  "aggression",
  "energyRecovery",
  "specab"
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

function parseBool(value: string): boolean {
  return value.trim() === "true";
}

function parseNumber(value: string): number | undefined {
  const n = Number(value.trim());
  return Number.isFinite(n) ? n : undefined;
}

function splitTopLevel(value: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let quoted = false;
  let quote = "";
  let start = 0;
  for (let i = 0; i < value.length; ++i) {
    const ch = value[i];
    if ((ch === "\"" || ch === "'") && (i === 0 || value[i - 1] !== "\\")) {
      if (!quoted) {
        quoted = true;
        quote = ch;
      } else if (quote === ch) {
        quoted = false;
      }
    } else if (!quoted && ch === "[") {
      ++depth;
    } else if (!quoted && ch === "]") {
      --depth;
    } else if (!quoted && ch === "," && depth === 0) {
      parts.push(value.slice(start, i).trim());
      start = i + 1;
    }
  }
  const tail = value.slice(start).trim();
  if (tail) {
    parts.push(tail);
  }
  return parts;
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
  return splitTopLevel(inside).map(part => unquote(part)).filter(Boolean);
}

function parseNumberList(value: string): number[] | null {
  const values = parseInlineList(value);
  if (!values) {
    return null;
  }
  const parsed: number[] = [];
  for (const part of values) {
    const n = parseNumber(part);
    if (n == null) {
      return null;
    }
    parsed.push(n);
  }
  return parsed;
}

function parseInlineNestedStringList(value: string): string[][] | null {
  const outer = parseInlineList(value);
  if (!outer) {
    return null;
  }
  const parsed: string[][] = [];
  for (const entry of outer) {
    const inner = parseInlineList(entry);
    parsed.push(inner || [unquote(entry)]);
  }
  return parsed;
}

function setUnitProp(target: UnitDefinition, key: string, value: string): void {
  switch (key) {
    case "type":
    case "race":
    case "rank":
    case "armor":
    case "spawnUnit":
    case "meleeWeapon":
    case "psiWeapon":
      (target as Record<string, unknown>)[key] = unquote(value);
      break;
    case "livingWeapon":
    case "capturable":
      (target as Record<string, unknown>)[key] = parseBool(value);
      break;
    case "deathSound": {
      const list = parseNumberList(value);
      if (list) {
        target.deathSound = list;
        break;
      }
      const n = parseNumber(value);
      if (n != null) {
        target.deathSound = [n];
      }
      break;
    }
    case "builtInWeapons": {
      const list = parseInlineList(value);
      if (list) {
        target.builtInWeapons = list;
      }
      break;
    }
    case "builtInWeaponSets": {
      const list = parseInlineNestedStringList(value);
      if (list) {
        target.builtInWeaponSets = list;
      }
      break;
    }
    default:
      if (numericUnitKeys.has(key)) {
        const n = parseNumber(value);
        if (n != null) {
          (target as Record<string, unknown>)[key] = n;
        }
      }
      break;
  }
}

function setStatsProp(target: Partial<UnitStats>, key: string, value: string): void {
  if (!statKeys.has(key)) {
    return;
  }
  const n = parseNumber(value);
  if (n != null) {
    (target as Record<string, number>)[key] = n;
  }
}

export class Unit {
  private _race = "";
  private _rank = "";
  private _stats = createUnitStats();
  private _armor = "";
  private _standHeight = 0;
  private _kneelHeight = 0;
  private _floatHeight = 0;
  private _deathSound: number[] = [];
  private _value = 0;
  private _aggroSound = -1;
  private _moveSound = -1;
  private _intelligence = 0;
  private _aggression = 0;
  private _energyRecovery = 30;
  private _specab = SpecialAbility.SPECAB_NONE;
  private _spawnUnit = "";
  private _livingWeapon = false;
  private _meleeWeapon = "";
  private _psiWeapon = "ALIEN_PSI_WEAPON";
  private _builtInWeapons: string[][] = [];
  private _capturable = true;

  constructor(private _type: string) {}

  load(node: UnitDefinition): void {
    this._type = node.type || this._type;
    this._race = node.race ?? this._race;
    this._rank = node.rank ?? this._rank;
    mergeUnitStats(this._stats, createUnitStats(node.stats || {}));
    this._armor = node.armor ?? this._armor;
    this._standHeight = node.standHeight ?? this._standHeight;
    this._kneelHeight = node.kneelHeight ?? this._kneelHeight;
    this._floatHeight = node.floatHeight ?? this._floatHeight;
    if (this._floatHeight + this._standHeight > 25) {
      throw new Error(`Error with unit ${this._type}: Unit height may not exceed 25`);
    }
    this._value = node.value ?? this._value;
    this._intelligence = node.intelligence ?? this._intelligence;
    this._aggression = node.aggression ?? this._aggression;
    this._energyRecovery = node.energyRecovery ?? this._energyRecovery;
    this._specab = node.specab ?? this._specab;
    this._spawnUnit = node.spawnUnit ?? this._spawnUnit;
    this._livingWeapon = node.livingWeapon ?? this._livingWeapon;
    this._meleeWeapon = node.meleeWeapon ?? this._meleeWeapon;
    this._psiWeapon = node.psiWeapon ?? this._psiWeapon;
    this._capturable = node.capturable ?? this._capturable;
    this._builtInWeapons = (node.builtInWeaponSets || this._builtInWeapons).map(set => [...set]);
    if (node.builtInWeapons) {
      this._builtInWeapons.push([...node.builtInWeapons]);
    }
    this._deathSound = [...(node.deathSound || this._deathSound)];
    this._aggroSound = node.aggroSound ?? this._aggroSound;
    this._moveSound = node.moveSound ?? this._moveSound;
  }

  getType(): string {
    return this._type;
  }

  getStats(): UnitStats {
    return this._stats;
  }

  getStandHeight(): number {
    return this._standHeight;
  }

  getKneelHeight(): number {
    return this._kneelHeight;
  }

  getFloatHeight(): number {
    return this._floatHeight;
  }

  getArmor(): string {
    return this._armor;
  }

  getRace(): string {
    return this._race;
  }

  getRank(): string {
    return this._rank;
  }

  getValue(): number {
    return this._value;
  }

  getDeathSounds(): number[] {
    return this._deathSound;
  }

  getMoveSound(): number {
    return this._moveSound;
  }

  getIntelligence(): number {
    return this._intelligence;
  }

  getAggression(): number {
    return this._aggression;
  }

  getSpecialAbility(): number {
    return this._specab;
  }

  getSpawnUnit(): string {
    return this._spawnUnit;
  }

  getAggroSound(): number {
    return this._aggroSound;
  }

  getEnergyRecovery(): number {
    return this._energyRecovery;
  }

  isLivingWeapon(): boolean {
    return this._livingWeapon;
  }

  getMeleeWeapon(): string {
    return this._meleeWeapon;
  }

  getPsiWeapon(): string {
    return this._psiWeapon;
  }

  getBuiltInWeapons(): string[][] {
    return this._builtInWeapons;
  }

  getCapturable(): boolean {
    return this._capturable;
  }
}

export function parseUnitsRul(source: string): UnitDefinition[] {
  const definitions: UnitDefinition[] = [];
  let current: UnitDefinition | null = null;
  let section = "";
  let currentWeaponSet: string[] | null = null;

  for (const raw of source.split(/\r?\n/)) {
    const line = stripComment(raw);
    if (!line.trim() || line.trim().startsWith("units:")) {
      continue;
    }
    const indent = line.search(/\S|$/);
    const trimmed = line.trim();

    const unitStart = /^-\s+type:\s*(.+)$/.exec(trimmed);
    if (indent === 2 && unitStart) {
      current = { type: unquote(unitStart[1]), stats: {} };
      definitions.push(current);
      section = "";
      currentWeaponSet = null;
      continue;
    }

    if (!current) {
      continue;
    }

    const prop = /^([A-Za-z0-9_]+):\s*(.*)$/.exec(trimmed);
    if (indent === 4 && prop) {
      currentWeaponSet = null;
      if (prop[1] === "stats") {
        section = "stats";
        current.stats ||= {};
      } else if (prop[1] === "builtInWeapons") {
        section = "builtInWeapons";
        current.builtInWeapons ||= [];
        setUnitProp(current, prop[1], prop[2]);
      } else if (prop[1] === "builtInWeaponSets") {
        section = "builtInWeaponSets";
        current.builtInWeaponSets ||= [];
        setUnitProp(current, prop[1], prop[2]);
      } else {
        section = "";
        setUnitProp(current, prop[1], prop[2]);
      }
      continue;
    }

    if (section === "stats" && indent === 6 && prop) {
      current.stats ||= {};
      setStatsProp(current.stats, prop[1], prop[2]);
      continue;
    }

    if (section === "builtInWeapons" && indent === 6) {
      const entry = /^-\s+(.+)$/.exec(trimmed);
      if (entry) {
        current.builtInWeapons ||= [];
        current.builtInWeapons.push(unquote(entry[1]));
      }
      continue;
    }

    if (section === "builtInWeaponSets" && indent === 6) {
      const inlineSet = /^-\s+(\[.*\])$/.exec(trimmed);
      if (inlineSet) {
        const values = parseInlineList(inlineSet[1]);
        if (values) {
          current.builtInWeaponSets ||= [];
          current.builtInWeaponSets.push(values);
        }
        currentWeaponSet = null;
        continue;
      }
      if (trimmed === "-") {
        currentWeaponSet = [];
        current.builtInWeaponSets ||= [];
        current.builtInWeaponSets.push(currentWeaponSet);
      }
      continue;
    }

    if (section === "builtInWeaponSets" && indent === 8 && currentWeaponSet) {
      const entry = /^-\s+(.+)$/.exec(trimmed);
      if (entry) {
        currentWeaponSet.push(unquote(entry[1]));
      }
    }
  }

  return definitions;
}

export function parseAlienItemLevelsRul(source: string): number[][] {
  const levels: number[][] = [];
  let inLevels = false;

  for (const raw of source.split(/\r?\n/)) {
    const line = stripComment(raw);
    if (!line.trim()) {
      continue;
    }
    const trimmed = line.trim();
    if (trimmed.startsWith("alienItemLevels:")) {
      inLevels = true;
      continue;
    }
    if (!inLevels) {
      continue;
    }
    const row = /^-\s+(\[.*\])$/.exec(trimmed);
    if (row) {
      const values = parseNumberList(row[1]);
      if (values) {
        levels.push(values);
      }
    }
  }

  return levels;
}
