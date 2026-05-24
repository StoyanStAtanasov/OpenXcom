export type BaseFacilityDefinition = {
  type: string;
  requires: string[];
  spriteShape?: number;
  spriteFacility?: number;
  lift?: boolean;
  hyper?: boolean;
  mind?: boolean;
  grav?: boolean;
  size?: number;
  buildCost?: number;
  buildTime?: number;
  monthlyCost?: number;
  storage?: number;
  personnel?: number;
  aliens?: number;
  crafts?: number;
  labs?: number;
  workshops?: number;
  psiLabs?: number;
  radarRange?: number;
  radarChance?: number;
  defense?: number;
  hitRatio?: number;
  fireSound?: number;
  hitSound?: number;
  mapName?: string;
  listOrder?: number;
};

export type BaseFacilityPlacement = {
  type: string;
  x?: number;
  y?: number;
  buildTime?: number;
};

export type StartingCraftDefinition = {
  type: string;
  id?: number;
  fuel?: number;
  damage?: number;
  status?: string;
  items: Record<string, number>;
  weapons: Array<{ type: string; ammo?: number }>;
};

export type StartingBaseDefinition = {
  facilities: BaseFacilityPlacement[];
  crafts: StartingCraftDefinition[];
  items: Record<string, number>;
  randomSoldiers?: number | Record<string, number>;
  scientists?: number;
  engineers?: number;
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

function setFacilityProp(target: BaseFacilityDefinition, key: string, value: string): void {
  switch (key) {
    case "spriteShape":
    case "spriteFacility":
    case "size":
    case "buildCost":
    case "buildTime":
    case "monthlyCost":
    case "storage":
    case "personnel":
    case "aliens":
    case "crafts":
    case "labs":
    case "workshops":
    case "psiLabs":
    case "radarRange":
    case "radarChance":
    case "defense":
    case "hitRatio":
    case "fireSound":
    case "hitSound":
    case "listOrder": {
      const n = parseNumber(value);
      if (n != null) {
        target[key] = n;
      }
      break;
    }
    case "lift":
    case "hyper":
    case "mind":
    case "grav":
      target[key] = parseBool(value);
      break;
    case "mapName":
      target.mapName = unquote(value);
      break;
    default:
      break;
  }
}

export class RuleBaseFacility {
  private _requires: string[] = [];
  private _spriteShape = 0;
  private _spriteFacility = 0;
  private _lift = false;
  private _hyper = false;
  private _mind = false;
  private _grav = false;
  private _size = 1;
  private _buildCost = 0;
  private _buildTime = 0;
  private _monthlyCost = 0;
  private _storage = 0;
  private _personnel = 0;
  private _aliens = 0;
  private _crafts = 0;
  private _labs = 0;
  private _workshops = 0;
  private _psiLabs = 0;
  private _radarRange = 0;
  private _radarChance = 0;
  private _defense = 0;
  private _hitRatio = 0;
  private _fireSound = -1;
  private _hitSound = -1;
  private _mapName = "";
  private _listOrder = 0;

  constructor(private _type: string) {}

  load(node: BaseFacilityDefinition, listOrder = 0): void {
    this._type = node.type || this._type;
    this._requires = [...(node.requires || [])];
    this._spriteShape = node.spriteShape ?? this._spriteShape;
    this._spriteFacility = node.spriteFacility ?? this._spriteFacility;
    this._lift = node.lift ?? this._lift;
    this._hyper = node.hyper ?? this._hyper;
    this._mind = node.mind ?? this._mind;
    this._grav = node.grav ?? this._grav;
    this._size = node.size ?? this._size;
    this._buildCost = node.buildCost ?? this._buildCost;
    this._buildTime = node.buildTime ?? this._buildTime;
    this._monthlyCost = node.monthlyCost ?? this._monthlyCost;
    this._storage = node.storage ?? this._storage;
    this._personnel = node.personnel ?? this._personnel;
    this._aliens = node.aliens ?? this._aliens;
    this._crafts = node.crafts ?? this._crafts;
    this._labs = node.labs ?? this._labs;
    this._workshops = node.workshops ?? this._workshops;
    this._psiLabs = node.psiLabs ?? this._psiLabs;
    this._radarRange = node.radarRange ?? this._radarRange;
    this._radarChance = node.radarChance ?? this._radarChance;
    this._defense = node.defense ?? this._defense;
    this._hitRatio = node.hitRatio ?? this._hitRatio;
    this._fireSound = node.fireSound ?? this._fireSound;
    this._hitSound = node.hitSound ?? this._hitSound;
    this._mapName = node.mapName ?? this._mapName;
    this._listOrder = node.listOrder ?? listOrder;
  }

  getType(): string {
    return this._type;
  }

  getRequirements(): string[] {
    return this._requires;
  }

  getSpriteShape(): number {
    return this._spriteShape;
  }

  getSpriteFacility(): number {
    return this._spriteFacility;
  }

  isLift(): boolean {
    return this._lift;
  }

  isHyper(): boolean {
    return this._hyper;
  }

  isMind(): boolean {
    return this._mind;
  }

  isGrav(): boolean {
    return this._grav;
  }

  getSize(): number {
    return this._size;
  }

  getBuildCost(): number {
    return this._buildCost;
  }

  getBuildTime(): number {
    return this._buildTime;
  }

  getMonthlyCost(): number {
    return this._monthlyCost;
  }

  getStorage(): number {
    return this._storage;
  }

  getPersonnel(): number {
    return this._personnel;
  }

  getAliens(): number {
    return this._aliens;
  }

  getCrafts(): number {
    return this._crafts;
  }

  getLaboratories(): number {
    return this._labs;
  }

  getWorkshops(): number {
    return this._workshops;
  }

  getPsiLaboratories(): number {
    return this._psiLabs;
  }

  getRadarRange(): number {
    return this._radarRange;
  }

  getRadarChance(): number {
    return this._radarChance;
  }

  getDefenseValue(): number {
    return this._defense;
  }

  getHitRatio(): number {
    return this._hitRatio;
  }

  getFireSound(): number {
    return this._fireSound;
  }

  getHitSound(): number {
    return this._hitSound;
  }

  getMapName(): string {
    return this._mapName;
  }

  getListOrder(): number {
    return this._listOrder;
  }
}

export function parseFacilitiesRul(source: string): BaseFacilityDefinition[] {
  const definitions: BaseFacilityDefinition[] = [];
  let current: BaseFacilityDefinition | null = null;
  let inRequires = false;

  for (const raw of source.split(/\r?\n/)) {
    const line = stripComment(raw);
    if (!line.trim() || line.trim() === "facilities:") {
      continue;
    }
    const indent = line.search(/\S|$/);
    const trimmed = line.trim();

    const facilityStart = /^-\s+type:\s*(.+)$/.exec(trimmed);
    if (indent === 2 && facilityStart) {
      current = { type: unquote(facilityStart[1]), requires: [] };
      definitions.push(current);
      inRequires = false;
      continue;
    }

    if (!current) {
      continue;
    }

    const prop = /^([A-Za-z0-9_]+):\s*(.*)$/.exec(trimmed);
    if (indent === 4 && prop) {
      inRequires = prop[1] === "requires";
      if (!inRequires) {
        setFacilityProp(current, prop[1], prop[2]);
      }
      continue;
    }

    if (inRequires && indent === 6) {
      const required = /^-\s+(.+)$/.exec(trimmed);
      if (required) {
        current.requires.push(unquote(required[1]));
      }
    }
  }

  return definitions;
}

export function parseStartingBaseRul(source: string): StartingBaseDefinition {
  const definition: StartingBaseDefinition = { facilities: [], crafts: [], items: {} };
  let section = "";
  let currentFacility: BaseFacilityPlacement | null = null;
  let currentCraft: StartingCraftDefinition | null = null;
  let currentWeapon: { type: string; ammo?: number } | null = null;
  let craftSubsection = "";

  for (const raw of source.split(/\r?\n/)) {
    const line = stripComment(raw);
    if (!line.trim() || line.trim() === "startingBase:") {
      continue;
    }
    const indent = line.search(/\S|$/);
    const trimmed = line.trim();

    const topProp = /^([A-Za-z0-9_]+):\s*(.*)$/.exec(trimmed);
    if (indent === 2 && topProp) {
      section = topProp[1];
      currentFacility = null;
      currentCraft = null;
      currentWeapon = null;
      craftSubsection = "";
      if (topProp[1] === "randomSoldiers") {
        definition.randomSoldiers = parseNumber(topProp[2]);
      } else if (topProp[1] === "scientists") {
        definition.scientists = parseNumber(topProp[2]);
      } else if (topProp[1] === "engineers") {
        definition.engineers = parseNumber(topProp[2]);
      }
      continue;
    }

    if (section === "facilities") {
      const facilityStart = /^-\s+type:\s*(.+)$/.exec(trimmed);
      if (indent === 4 && facilityStart) {
        currentFacility = { type: unquote(facilityStart[1]) };
        definition.facilities.push(currentFacility);
        continue;
      }

      if (indent === 6 && currentFacility) {
        const prop = /^([A-Za-z0-9_]+):\s*(.*)$/.exec(trimmed);
        const n = prop ? parseNumber(prop[2]) : undefined;
        if (prop && n != null && (prop[1] === "x" || prop[1] === "y" || prop[1] === "buildTime")) {
          currentFacility[prop[1]] = n;
        }
      }
      continue;
    }

    if (section === "crafts") {
      const craftStart = /^-\s+type:\s*(.+)$/.exec(trimmed);
      if (indent === 4 && craftStart) {
        currentCraft = { type: unquote(craftStart[1]), items: {}, weapons: [] };
        definition.crafts.push(currentCraft);
        currentWeapon = null;
        craftSubsection = "";
        continue;
      }

      if (!currentCraft) {
        continue;
      }

      const prop = /^([A-Za-z0-9_]+):\s*(.*)$/.exec(trimmed);
      if (indent === 6 && prop) {
        craftSubsection = prop[1] === "items" || prop[1] === "weapons" ? prop[1] : "";
        const n = parseNumber(prop[2]);
        if (prop[1] === "id" && n != null) {
          currentCraft.id = n;
        } else if (prop[1] === "fuel" && n != null) {
          currentCraft.fuel = n;
        } else if (prop[1] === "damage" && n != null) {
          currentCraft.damage = n;
        } else if (prop[1] === "status") {
          currentCraft.status = unquote(prop[2]);
        }
        continue;
      }

      if (craftSubsection === "items" && indent === 8) {
        const item = /^([A-Za-z0-9_]+):\s*(.*)$/.exec(trimmed);
        const n = item ? parseNumber(item[2]) : undefined;
        if (item && n != null) {
          currentCraft.items[unquote(item[1])] = n;
        }
        continue;
      }

      if (craftSubsection === "weapons") {
        const weaponStart = /^-\s+type:\s*(.+)$/.exec(trimmed);
        if (indent === 8 && weaponStart) {
          currentWeapon = { type: unquote(weaponStart[1]) };
          currentCraft.weapons.push(currentWeapon);
          continue;
        }
        if (indent === 10 && currentWeapon) {
          const weaponProp = /^([A-Za-z0-9_]+):\s*(.*)$/.exec(trimmed);
          const n = weaponProp ? parseNumber(weaponProp[2]) : undefined;
          if (weaponProp && weaponProp[1] === "ammo" && n != null) {
            currentWeapon.ammo = n;
          }
        }
      }
      continue;
    }

    if (section === "items" && indent === 4) {
      const item = /^([A-Za-z0-9_]+):\s*(.*)$/.exec(trimmed);
      const n = item ? parseNumber(item[2]) : undefined;
      if (item && n != null) {
        definition.items[unquote(item[1])] = n;
      }
    }
  }

  return definition;
}
