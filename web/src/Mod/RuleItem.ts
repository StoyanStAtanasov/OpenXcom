import type { Surface } from "../Engine/Surface.ts";
import type { SurfaceSet } from "../Engine/SurfaceSet.ts";

export enum ItemDamageType {
  DT_NONE = 0,
  DT_AP,
  DT_IN,
  DT_HE,
  DT_LASER,
  DT_PLASMA,
  DT_STUN,
  DT_MELEE,
  DT_ACID,
  DT_SMOKE
}

export enum BattleType {
  BT_NONE = 0,
  BT_FIREARM,
  BT_AMMO,
  BT_MELEE,
  BT_GRENADE,
  BT_PROXIMITYGRENADE,
  BT_MEDIKIT,
  BT_SCANNER,
  BT_MINDPROBE,
  BT_PSIAMP,
  BT_FLARE,
  BT_CORPSE
}

export type RuleItemDefinition = {
  type: string;
  name?: string;
  requires: string[];
  size?: number;
  costBuy?: number;
  costSell?: number;
  transferTime?: number;
  weight?: number;
  bigSprite?: number;
  floorSprite?: number;
  handSprite?: number;
  bulletSprite?: number;
  fireSound?: number;
  hitSound?: number;
  hitAnimation?: number;
  meleeSound?: number;
  meleeAnimation?: number;
  meleeHitSound?: number;
  power?: number;
  compatibleAmmo: string[];
  damageType?: number;
  accuracyAuto?: number;
  accuracySnap?: number;
  accuracyAimed?: number;
  tuAuto?: number;
  tuSnap?: number;
  tuAimed?: number;
  clipSize?: number;
  accuracyMelee?: number;
  tuMelee?: number;
  battleType?: number;
  twoHanded?: boolean;
  fixedWeapon?: boolean;
  waypoints?: number;
  invWidth?: number;
  invHeight?: number;
  painKiller?: number;
  heal?: number;
  stimulant?: number;
  woundRecovery?: number;
  healthRecovery?: number;
  stunRecovery?: number;
  energyRecovery?: number;
  tuUse?: number;
  recoveryPoints?: number;
  armor?: number;
  turretType?: number;
  recover?: boolean;
  ignoreInBaseDefense?: boolean;
  liveAlien?: boolean;
  blastRadius?: number;
  attraction?: number;
  flatRate?: boolean;
  arcingShot?: boolean;
  listOrder?: number;
  maxRange?: number;
  aimRange?: number;
  snapRange?: number;
  autoRange?: number;
  minRange?: number;
  dropoff?: number;
  bulletSpeed?: number;
  explosionSpeed?: number;
  autoShots?: number;
  shotgunPellets?: number;
  zombieUnit?: string;
  strengthApplied?: boolean;
  skillApplied?: boolean;
  LOSRequired?: boolean;
  underwaterOnly?: boolean;
  landOnly?: boolean;
  meleePower?: number;
  specialType?: number;
  vaporColor?: number;
  vaporDensity?: number;
  vaporProbability?: number;
};

const numericKeys = new Set<string>([
  "size",
  "costBuy",
  "costSell",
  "transferTime",
  "weight",
  "bigSprite",
  "floorSprite",
  "handSprite",
  "bulletSprite",
  "fireSound",
  "hitSound",
  "hitAnimation",
  "meleeSound",
  "meleeAnimation",
  "meleeHitSound",
  "power",
  "damageType",
  "accuracyAuto",
  "accuracySnap",
  "accuracyAimed",
  "tuAuto",
  "tuSnap",
  "tuAimed",
  "clipSize",
  "accuracyMelee",
  "tuMelee",
  "battleType",
  "waypoints",
  "invWidth",
  "invHeight",
  "painKiller",
  "heal",
  "stimulant",
  "woundRecovery",
  "healthRecovery",
  "stunRecovery",
  "energyRecovery",
  "tuUse",
  "recoveryPoints",
  "armor",
  "turretType",
  "blastRadius",
  "attraction",
  "listOrder",
  "maxRange",
  "aimRange",
  "snapRange",
  "autoRange",
  "minRange",
  "dropoff",
  "bulletSpeed",
  "explosionSpeed",
  "autoShots",
  "shotgunPellets",
  "meleePower",
  "specialType",
  "vaporColor",
  "vaporDensity",
  "vaporProbability"
]);

const boolKeys = new Set<string>([
  "twoHanded",
  "fixedWeapon",
  "recover",
  "ignoreInBaseDefense",
  "liveAlien",
  "flatRate",
  "arcingShot",
  "strengthApplied",
  "skillApplied",
  "LOSRequired",
  "underwaterOnly",
  "landOnly"
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

function setItemProp(target: RuleItemDefinition, key: string, value: string): void {
  if (key === "name" || key === "zombieUnit") {
    target[key] = unquote(value);
    return;
  }
  if (key === "requires" || key === "compatibleAmmo") {
    const parsed = parseInlineList(value);
    if (parsed) {
      target[key] = parsed;
    }
    return;
  }
  if (numericKeys.has(key)) {
    const n = parseNumber(value);
    if (n != null) {
      (target as Record<string, unknown>)[key] = n;
    }
    return;
  }
  if (boolKeys.has(key)) {
    (target as Record<string, unknown>)[key] = parseBool(value);
  }
}

export class RuleItem {
  private _name: string;
  private _requires: string[] = [];
  private _size = 0.0;
  private _costBuy = 0;
  private _costSell = 0;
  private _transferTime = 24;
  private _weight = 3;
  private _bigSprite = -1;
  private _floorSprite = -1;
  private _handSprite = 120;
  private _bulletSprite = -1;
  private _fireSound = -1;
  private _hitSound = -1;
  private _hitAnimation = -1;
  private _power = 0;
  private _compatibleAmmo: string[] = [];
  private _damageType = ItemDamageType.DT_NONE;
  private _accuracyAuto = 0;
  private _accuracySnap = 0;
  private _accuracyAimed = 0;
  private _tuAuto = 0;
  private _tuSnap = 0;
  private _tuAimed = 0;
  private _clipSize = 0;
  private _accuracyMelee = 0;
  private _tuMelee = 0;
  private _battleType = BattleType.BT_NONE;
  private _twoHanded = false;
  private _fixedWeapon = false;
  private _waypoints = 0;
  private _invWidth = 1;
  private _invHeight = 1;
  private _painKiller = 0;
  private _heal = 0;
  private _stimulant = 0;
  private _woundRecovery = 0;
  private _healthRecovery = 0;
  private _stunRecovery = 0;
  private _energyRecovery = 0;
  private _tuUse = 0;
  private _recoveryPoints = 0;
  private _armor = 20;
  private _turretType = -1;
  private _recover = true;
  private _ignoreInBaseDefense = false;
  private _liveAlien = false;
  private _blastRadius = -1;
  private _attraction = 0;
  private _flatRate = false;
  private _arcingShot = false;
  private _listOrder = 0;
  private _maxRange = 200;
  private _aimRange = 200;
  private _snapRange = 15;
  private _autoRange = 7;
  private _minRange = 0;
  private _dropoff = 2;
  private _bulletSpeed = 0;
  private _explosionSpeed = 0;
  private _autoShots = 3;
  private _shotgunPellets = 0;
  private _zombieUnit = "";
  private _strengthApplied = false;
  private _skillApplied = true;
  private _LOSRequired = false;
  private _underwaterOnly = false;
  private _landOnly = false;
  private _meleeSound = 39;
  private _meleePower = 0;
  private _meleeAnimation = 0;
  private _meleeHitSound = -1;
  private _specialType = -1;
  private _vaporColor = -1;
  private _vaporDensity = 0;
  private _vaporProbability = 15;

  constructor(private _type: string) {
    this._name = _type;
  }

  load(node: RuleItemDefinition, listOrder = 0): void {
    this._type = node.type || this._type;
    this._name = node.name ?? this._name;
    this._requires = [...(node.requires || [])];
    this._size = node.size ?? this._size;
    this._costBuy = node.costBuy ?? this._costBuy;
    this._costSell = node.costSell ?? this._costSell;
    this._transferTime = node.transferTime ?? this._transferTime;
    this._weight = node.weight ?? this._weight;
    this._bigSprite = node.bigSprite ?? this._bigSprite;
    this._floorSprite = node.floorSprite ?? this._floorSprite;
    this._handSprite = node.handSprite ?? this._handSprite;
    this._bulletSprite = node.bulletSprite ?? this._bulletSprite;
    this._fireSound = node.fireSound ?? this._fireSound;
    this._hitSound = node.hitSound ?? this._hitSound;
    this._meleeSound = node.meleeSound ?? this._meleeSound;
    this._hitAnimation = node.hitAnimation ?? this._hitAnimation;
    this._meleeAnimation = node.meleeAnimation ?? this._meleeAnimation;
    this._meleeHitSound = node.meleeHitSound ?? this._meleeHitSound;
    this._power = node.power ?? this._power;
    this._compatibleAmmo = [...(node.compatibleAmmo || [])];
    this._damageType = node.damageType ?? this._damageType;
    this._accuracyAuto = node.accuracyAuto ?? this._accuracyAuto;
    this._accuracySnap = node.accuracySnap ?? this._accuracySnap;
    this._accuracyAimed = node.accuracyAimed ?? this._accuracyAimed;
    this._tuAuto = node.tuAuto ?? this._tuAuto;
    this._tuSnap = node.tuSnap ?? this._tuSnap;
    this._tuAimed = node.tuAimed ?? this._tuAimed;
    this._clipSize = node.clipSize ?? this._clipSize;
    this._accuracyMelee = node.accuracyMelee ?? this._accuracyMelee;
    this._tuMelee = node.tuMelee ?? this._tuMelee;
    this._battleType = node.battleType ?? this._battleType;
    if ((this._battleType === BattleType.BT_MELEE || this._battleType === BattleType.BT_FIREARM) && this._clipSize === 0 && this._compatibleAmmo.length === 0) {
      throw new Error(`Weapon ${this._type} has clip size 0 and no ammo defined. Please use 'clipSize: -1' for unlimited ammo, or allocate a compatibleAmmo item.`);
    }
    this._twoHanded = node.twoHanded ?? this._twoHanded;
    this._waypoints = node.waypoints ?? this._waypoints;
    this._fixedWeapon = node.fixedWeapon ?? this._fixedWeapon;
    this._invWidth = node.invWidth ?? this._invWidth;
    this._invHeight = node.invHeight ?? this._invHeight;
    this._painKiller = node.painKiller ?? this._painKiller;
    this._heal = node.heal ?? this._heal;
    this._stimulant = node.stimulant ?? this._stimulant;
    this._woundRecovery = node.woundRecovery ?? this._woundRecovery;
    this._healthRecovery = node.healthRecovery ?? this._healthRecovery;
    this._stunRecovery = node.stunRecovery ?? this._stunRecovery;
    this._energyRecovery = node.energyRecovery ?? this._energyRecovery;
    this._tuUse = node.tuUse ?? this._tuUse;
    this._recoveryPoints = node.recoveryPoints ?? this._recoveryPoints;
    this._armor = node.armor ?? this._armor;
    this._turretType = node.turretType ?? this._turretType;
    this._recover = node.recover ?? this._recover;
    this._ignoreInBaseDefense = node.ignoreInBaseDefense ?? this._ignoreInBaseDefense;
    this._liveAlien = node.liveAlien ?? this._liveAlien;
    this._blastRadius = node.blastRadius ?? this._blastRadius;
    this._attraction = node.attraction ?? this._attraction;
    this._flatRate = node.flatRate ?? this._flatRate;
    this._arcingShot = node.arcingShot ?? this._arcingShot;
    this._listOrder = node.listOrder ?? this._listOrder;
    this._maxRange = node.maxRange ?? this._maxRange;
    this._aimRange = node.aimRange ?? this._aimRange;
    this._snapRange = node.snapRange ?? this._snapRange;
    this._autoRange = node.autoRange ?? this._autoRange;
    this._minRange = node.minRange ?? this._minRange;
    this._dropoff = node.dropoff ?? this._dropoff;
    this._bulletSpeed = node.bulletSpeed ?? this._bulletSpeed;
    this._explosionSpeed = node.explosionSpeed ?? this._explosionSpeed;
    this._autoShots = node.autoShots ?? this._autoShots;
    this._shotgunPellets = node.shotgunPellets ?? this._shotgunPellets;
    this._zombieUnit = node.zombieUnit ?? this._zombieUnit;
    this._strengthApplied = node.strengthApplied ?? this._strengthApplied;
    this._skillApplied = node.skillApplied ?? this._skillApplied;
    this._LOSRequired = node.LOSRequired ?? this._LOSRequired;
    this._meleePower = node.meleePower ?? this._meleePower;
    this._underwaterOnly = node.underwaterOnly ?? this._underwaterOnly;
    this._landOnly = node.landOnly ?? this._landOnly;
    this._specialType = node.specialType ?? this._specialType;
    this._vaporColor = node.vaporColor ?? this._vaporColor;
    this._vaporDensity = node.vaporDensity ?? this._vaporDensity;
    this._vaporProbability = node.vaporProbability ?? this._vaporProbability;
    if (!this._listOrder) {
      this._listOrder = listOrder;
    }
  }

  getType(): string {
    return this._type;
  }

  getName(): string {
    return this._name;
  }

  getRequirements(): string[] {
    return this._requires;
  }

  getSize(): number {
    return this._size;
  }

  getBuyCost(): number {
    return this._costBuy;
  }

  getSellCost(): number {
    return this._costSell;
  }

  getTransferTime(): number {
    return this._transferTime;
  }

  getWeight(): number {
    return this._weight;
  }

  getBigSprite(): number {
    return this._bigSprite;
  }

  getFloorSprite(): number {
    return this._floorSprite;
  }

  getHandSprite(): number {
    return this._handSprite;
  }

  isTwoHanded(): boolean {
    return this._twoHanded;
  }

  isFixed(): boolean {
    return this._fixedWeapon;
  }

  getWaypoints(): number {
    return this._waypoints;
  }

  getBulletSprite(): number {
    return this._bulletSprite;
  }

  getFireSound(): number {
    return this._fireSound;
  }

  getHitSound(): number {
    return this._hitSound;
  }

  getHitAnimation(): number {
    return this._hitAnimation;
  }

  getPower(): number {
    return this._power;
  }

  getAccuracySnap(): number {
    return this._accuracySnap;
  }

  getAccuracyAuto(): number {
    return this._accuracyAuto;
  }

  getAccuracyAimed(): number {
    return this._accuracyAimed;
  }

  getAccuracyMelee(): number {
    return this._accuracyMelee;
  }

  getTUSnap(): number {
    return this._tuSnap;
  }

  getTUAuto(): number {
    return this._tuAuto;
  }

  getTUAimed(): number {
    return this._tuAimed;
  }

  getTUMelee(): number {
    return this._tuMelee;
  }

  getCompatibleAmmo(): string[] {
    return this._compatibleAmmo;
  }

  getDamageType(): ItemDamageType {
    return this._damageType;
  }

  getBattleType(): BattleType {
    return this._battleType;
  }

  getInventoryWidth(): number {
    return this._invWidth;
  }

  getInventoryHeight(): number {
    return this._invHeight;
  }

  getClipSize(): number {
    return this._clipSize;
  }

  drawHandSprite(texture: SurfaceSet, surface: Surface): void {
    const frame = texture.getFrame(this.getBigSprite());
    if (!frame) {
      return;
    }
    const slotW = 16;
    const slotH = 16;
    const handW = 2;
    const handH = 3;
    frame.setX((handW - this.getInventoryWidth()) * slotW / 2);
    frame.setY((handH - this.getInventoryHeight()) * slotH / 2);
    frame.blit(surface);
  }

  getHealQuantity(): number {
    return this._heal;
  }

  getPainKillerQuantity(): number {
    return this._painKiller;
  }

  getStimulantQuantity(): number {
    return this._stimulant;
  }

  getWoundRecovery(): number {
    return this._woundRecovery;
  }

  getHealthRecovery(): number {
    return this._healthRecovery;
  }

  getEnergyRecovery(): number {
    return this._energyRecovery;
  }

  getStunRecovery(): number {
    return this._stunRecovery;
  }

  getTUUse(): number {
    return this._tuUse;
  }

  getExplosionRadius(): number {
    if (this._blastRadius !== -1) {
      return this._blastRadius;
    }
    let radius = 0;
    if (this._damageType === ItemDamageType.DT_IN) {
      radius = Math.trunc(this._power / 30) + 1;
    } else if (this._damageType === ItemDamageType.DT_HE || this._damageType === ItemDamageType.DT_STUN || this._damageType === ItemDamageType.DT_SMOKE) {
      radius = Math.trunc(this._power / 20);
    }
    return Math.min(radius, 11);
  }

  getRecoveryPoints(): number {
    return this._recoveryPoints;
  }

  getArmor(): number {
    return this._armor;
  }

  isRecoverable(): boolean {
    return this._recover;
  }

  canBeEquippedBeforeBaseDefense(): boolean {
    return !this._ignoreInBaseDefense;
  }

  getTurretType(): number {
    return this._turretType;
  }

  isAlien(): boolean {
    return this._liveAlien;
  }

  getFlatRate(): boolean {
    return this._flatRate;
  }

  getArcingShot(): boolean {
    return this._arcingShot;
  }

  getAttraction(): number {
    return this._attraction;
  }

  getListOrder(): number {
    return this._listOrder;
  }

  getMaxRange(): number {
    return this._maxRange;
  }

  getMaxRangeSq(): number {
    return this._maxRange * this._maxRange;
  }

  getAimRange(): number {
    return this._aimRange;
  }

  getSnapRange(): number {
    return this._snapRange;
  }

  getAutoRange(): number {
    return this._autoRange;
  }

  getMinRange(): number {
    return this._minRange;
  }

  getDropoff(): number {
    return this._dropoff;
  }

  getBulletSpeed(): number {
    return this._bulletSpeed;
  }

  getExplosionSpeed(): number {
    return this._explosionSpeed;
  }

  getAutoShots(): number {
    return this._autoShots;
  }

  isRifle(): boolean {
    return (this._battleType === BattleType.BT_FIREARM || this._battleType === BattleType.BT_MELEE) && this._twoHanded;
  }

  isPistol(): boolean {
    return (this._battleType === BattleType.BT_FIREARM || this._battleType === BattleType.BT_MELEE) && !this._twoHanded;
  }

  getShotgunPellets(): number {
    return this._shotgunPellets;
  }

  getZombieUnit(): string {
    return this._zombieUnit;
  }

  isStrengthApplied(): boolean {
    return this._strengthApplied;
  }

  isSkillApplied(): boolean {
    return this._skillApplied;
  }

  getMeleeAttackSound(): number {
    return this._meleeSound;
  }

  getMeleeHitSound(): number {
    return this._meleeHitSound;
  }

  getMeleePower(): number {
    return this._meleePower;
  }

  isLOSRequired(): boolean {
    return this._LOSRequired;
  }

  getMeleeAnimation(): number {
    return this._meleeAnimation;
  }

  isWaterOnly(): boolean {
    return this._underwaterOnly;
  }

  isLandOnly(): boolean {
    return this._landOnly;
  }

  getSpecialType(): number {
    return this._specialType;
  }

  getVaporColor(): number {
    return this._vaporColor;
  }

  getVaporDensity(): number {
    return this._vaporDensity;
  }

  getVaporProbability(): number {
    return this._vaporProbability;
  }
}

export function parseItemsRul(source: string): RuleItemDefinition[] {
  const definitions: RuleItemDefinition[] = [];
  let current: RuleItemDefinition | null = null;
  let section = "";

  for (const raw of source.split(/\r?\n/)) {
    const line = stripComment(raw);
    if (!line.trim() || line.trim().startsWith("items:")) {
      continue;
    }
    const indent = line.search(/\S|$/);
    const trimmed = line.trim();

    const itemStart = /^-\s+type:\s*(.+)$/.exec(trimmed);
    if (indent === 2 && itemStart) {
      current = { type: unquote(itemStart[1]), requires: [], compatibleAmmo: [] };
      definitions.push(current);
      section = "";
      continue;
    }

    if (!current) {
      continue;
    }

    const prop = /^([A-Za-z0-9_]+):\s*(.*)$/.exec(trimmed);
    if (indent === 4 && prop) {
      section = prop[1] === "requires" || prop[1] === "compatibleAmmo" ? prop[1] : "";
      setItemProp(current, prop[1], prop[2]);
      continue;
    }

    const entry = /^-\s+(.+)$/.exec(trimmed);
    if (indent === 6 && entry && (section === "requires" || section === "compatibleAmmo")) {
      current[section].push(unquote(entry[1]));
    }
  }

  return definitions;
}
