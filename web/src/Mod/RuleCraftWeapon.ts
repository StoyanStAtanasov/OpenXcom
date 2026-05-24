export type CraftWeaponDefinition = {
  type: string;
  sprite?: number;
  sound?: number;
  damage?: number;
  range?: number;
  accuracy?: number;
  reloadCautious?: number;
  reloadStandard?: number;
  reloadAggressive?: number;
  ammoMax?: number;
  rearmRate?: number;
  launcher?: string;
  clip?: string;
  projectileType?: number;
  projectileSpeed?: number;
  underwaterOnly?: boolean;
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

function setCraftWeaponProp(target: CraftWeaponDefinition, key: string, value: string): void {
  switch (key) {
    case "sprite":
    case "sound":
    case "damage":
    case "range":
    case "accuracy":
    case "reloadCautious":
    case "reloadStandard":
    case "reloadAggressive":
    case "ammoMax":
    case "rearmRate":
    case "projectileType":
    case "projectileSpeed": {
      const n = parseNumber(value);
      if (n != null) {
        target[key] = n;
      }
      break;
    }
    case "launcher":
      target.launcher = unquote(value);
      break;
    case "clip":
      target.clip = unquote(value);
      break;
    case "underwaterOnly":
      target.underwaterOnly = parseBool(value);
      break;
    default:
      break;
  }
}

export class RuleCraftWeapon {
  private _sprite = -1;
  private _sound = -1;
  private _damage = 0;
  private _range = 0;
  private _accuracy = 0;
  private _reloadCautious = 0;
  private _reloadStandard = 0;
  private _reloadAggressive = 0;
  private _ammoMax = 0;
  private _rearmRate = 1;
  private _launcher = "";
  private _clip = "";
  private _projectileType = 2;
  private _projectileSpeed = 0;
  private _underwaterOnly = false;

  constructor(private _type: string) {}

  load(node: CraftWeaponDefinition): void {
    this._type = node.type || this._type;
    this._sprite = node.sprite ?? this._sprite;
    this._sound = node.sound ?? this._sound;
    this._damage = node.damage ?? this._damage;
    this._range = node.range ?? this._range;
    this._accuracy = node.accuracy ?? this._accuracy;
    this._reloadCautious = node.reloadCautious ?? this._reloadCautious;
    this._reloadStandard = node.reloadStandard ?? this._reloadStandard;
    this._reloadAggressive = node.reloadAggressive ?? this._reloadAggressive;
    this._ammoMax = node.ammoMax ?? this._ammoMax;
    this._rearmRate = node.rearmRate ?? this._rearmRate;
    this._launcher = node.launcher ?? this._launcher;
    this._clip = node.clip ?? this._clip;
    this._projectileType = node.projectileType ?? this._projectileType;
    this._projectileSpeed = node.projectileSpeed ?? this._projectileSpeed;
    this._underwaterOnly = node.underwaterOnly ?? this._underwaterOnly;
  }

  getType(): string {
    return this._type;
  }

  getSprite(): number {
    return this._sprite;
  }

  getSound(): number {
    return this._sound;
  }

  getDamage(): number {
    return this._damage;
  }

  getRange(): number {
    return this._range;
  }

  getAccuracy(): number {
    return this._accuracy;
  }

  getCautiousReload(): number {
    return this._reloadCautious;
  }

  getStandardReload(): number {
    return this._reloadStandard;
  }

  getAggressiveReload(): number {
    return this._reloadAggressive;
  }

  getAmmoMax(): number {
    return this._ammoMax;
  }

  getRearmRate(): number {
    return this._rearmRate;
  }

  getLauncherItem(): string {
    return this._launcher;
  }

  getClipItem(): string {
    return this._clip;
  }

  getProjectileType(): number {
    return this._projectileType;
  }

  getProjectileSpeed(): number {
    return this._projectileSpeed;
  }

  isWaterOnly(): boolean {
    return this._underwaterOnly;
  }
}

export function parseCraftWeaponsRul(source: string): CraftWeaponDefinition[] {
  const definitions: CraftWeaponDefinition[] = [];
  let current: CraftWeaponDefinition | null = null;

  for (const raw of source.split(/\r?\n/)) {
    const line = stripComment(raw);
    if (!line.trim() || line.trim() === "craftWeapons:") {
      continue;
    }
    const indent = line.search(/\S|$/);
    const trimmed = line.trim();

    const weaponStart = /^-\s+type:\s*(.+)$/.exec(trimmed);
    if (indent === 2 && weaponStart) {
      current = { type: unquote(weaponStart[1]) };
      definitions.push(current);
      continue;
    }

    if (!current) {
      continue;
    }

    const prop = /^([A-Za-z0-9_]+):\s*(.*)$/.exec(trimmed);
    if (indent === 4 && prop) {
      setCraftWeaponProp(current, prop[1], prop[2]);
    }
  }

  return definitions;
}
