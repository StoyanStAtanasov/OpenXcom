import { BattleActionType, type BattleAction } from "../Battlescape/BattleAction.ts";
import { TilePart, SpecialTileType } from "../Mod/MapData.ts";
import { Position, type PositionLike } from "../Battlescape/Position.ts";
import { RNG } from "../Engine/RNG.ts";
import { Armor, MovementType } from "../Mod/Armor.ts";
import { BattleType, ItemDamageType, type RuleItem } from "../Mod/RuleItem.ts";
import { InventoryType, type RuleInventory } from "../Mod/RuleInventory.ts";
import { SpecialAbility, Unit, createUnitStats, type UnitStats } from "../Mod/Unit.ts";
import { Soldier, SoldierGender, SoldierRank } from "./Soldier.ts";
import type { SavedGame } from "./SavedGame.ts";
import { BattleItem } from "./BattleItem.ts";
import type { Tile } from "./Tile.ts";
import type { AIModuleSave } from "../Battlescape/AIModule.ts";

export enum UnitStatus {
  STATUS_STANDING = 0,
  STATUS_WALKING,
  STATUS_FLYING,
  STATUS_TURNING,
  STATUS_AIMING,
  STATUS_COLLAPSING,
  STATUS_DEAD,
  STATUS_UNCONSCIOUS,
  STATUS_PANICKING,
  STATUS_BERSERK,
  STATUS_IGNORE_ME
}

export enum UnitFaction {
  FACTION_PLAYER = 0,
  FACTION_HOSTILE,
  FACTION_NEUTRAL
}

export enum UnitSide {
  SIDE_FRONT = 0,
  SIDE_LEFT,
  SIDE_RIGHT,
  SIDE_REAR,
  SIDE_UNDER
}

export enum UnitBodyPart {
  BODYPART_HEAD = 0,
  BODYPART_TORSO,
  BODYPART_RIGHTARM,
  BODYPART_LEFTARM,
  BODYPART_RIGHTLEG,
  BODYPART_LEFTLEG
}

export type StatAdjustment = {
  statGrowth: UnitStats;
  growthMultiplier: number;
  aimAndArmorMultiplier: number;
};

export type BattleUnitSave = {
  id?: number;
  genUnitType?: string;
  genUnitArmor?: string;
  faction?: number;
  status?: number;
  position?: [number, number, number] | number[] | PositionLike;
  direction?: number;
  directionTurret?: number;
  tu?: number;
  health?: number;
  stunlevel?: number;
  energy?: number;
  morale?: number;
  kneeled?: boolean;
  floating?: boolean;
  armor?: number[];
  fatalWounds?: number[];
  fire?: number;
  expBravery?: number;
  expReactions?: number;
  expFiring?: number;
  expThrowing?: number;
  expPsiSkill?: number;
  expPsiStrength?: number;
  expMelee?: number;
  turretType?: number;
  visible?: boolean;
  turnsSinceSpotted?: number;
  killedBy?: number;
  moraleRestored?: number;
  rankInt?: number;
  originalFaction?: number;
  kills?: number;
  dontReselect?: boolean;
  spawnUnit?: string;
  motionPoints?: number;
  respawn?: boolean;
  activeHand?: string;
  murdererId?: number;
  fatalShotSide?: number;
  fatalShotBodyPart?: number;
  murdererWeapon?: string;
  murdererWeaponAmmo?: string;
  recolor?: Array<[number, number] | number[]>;
  mindControllerID?: number;
  AI?: AIModuleSave;
};

export type BattleUnitStatistics = {
  wasUnconcious: boolean;
  shotAtCounter: number;
  hitCounter: number;
  shotByFriendlyCounter: number;
  shotFriendlyCounter: number;
  loneSurvivor: boolean;
  ironMan: boolean;
  longDistanceHitCounter: number;
  lowAccuracyHitCounter: number;
  shotsFiredCounter: number;
  shotsLandedCounter: number;
  kills: BattleUnitKill[];
  daysWounded: number;
  KIA: boolean;
  nikeCross: boolean;
  mercyCross: boolean;
  woundsHealed: number;
  delta: UnitStats;
  appliedStimulant: number;
  appliedPainKill: number;
  revivedSoldier: number;
  revivedHostile: number;
  revivedNeutral: number;
  MIA: boolean;
  martyr: number;
  slaveKills: number;
  duplicateEntry(status: UnitStatus, id: number): boolean;
};

export type BattleUnitKill = {
  name: string;
  type: string;
  rank: string;
  race: string;
  weapon: string;
  weaponAmmo: string;
  faction: UnitFaction;
  status: UnitStatus;
  mission: number;
  turn: number;
  id: number;
  side: UnitSide;
  bodypart: UnitBodyPart;
};

type TileLike = {
  getInventory?: () => BattleItem[];
  getPosition?: () => Position;
  getUnit?: () => BattleUnit | null;
  getDangerous?: () => boolean;
  getFootstepSound?: (tileBelow: Tile | null) => number;
  getMapData?: (part: TilePart) => { getSpecialType?: () => number } | null;
  hasNoFloor?: (tileBelow: Tile | null) => boolean;
  setUnit?: (unit: BattleUnit | null, tileBelow?: Tile | null) => void;
  setVisible?: (visibility: number) => void;
};

type AIModuleLike = {
  think?: (action: BattleAction) => void;
  getTarget?: () => BattleUnit | null;
  getWasHitBy?: (attacker: number) => boolean;
  setWasHitBy?: (attacker: BattleUnit) => void;
  explosiveEfficacy?: (pos: PositionLike, unit: BattleUnit, radius: number, diff: number, grenade?: boolean) => boolean;
  reset?: () => void;
  save?: () => AIModuleSave;
  freePatrolTarget?: () => void;
};

type SpecialWeaponSaveLike = {
  getCurrentItemId: () => { value: number };
  removeItem: (item: BattleItem) => void;
};

type SpecialWeaponModLike = {
  getItem: (type: string, error?: boolean) => RuleItem | null;
};

function cloneStats(stats: Partial<UnitStats> = {}): UnitStats {
  return createUnitStats(stats);
}

function addStats(target: UnitStats, source: Partial<UnitStats>): void {
  for (const key of Object.keys(target) as Array<keyof UnitStats>) {
    target[key] += source[key] || 0;
  }
}

function subtractStats(target: UnitStats, source: Partial<UnitStats>): void {
  for (const key of Object.keys(target) as Array<keyof UnitStats>) {
    target[key] -= source[key] || 0;
  }
}

type BattleUnitGeoscapeLike = SavedGame & {
  getSoldier?: (id: number) => Soldier | null;
};

type BattleUnitSoldierLike = Soldier & {
  addMissionCount?: () => void;
  addKillCount?: (count: number) => void;
};

function createBattleUnitStatistics(): BattleUnitStatistics {
  return {
    wasUnconcious: false,
    shotAtCounter: 0,
    hitCounter: 0,
    shotByFriendlyCounter: 0,
    shotFriendlyCounter: 0,
    loneSurvivor: false,
    ironMan: false,
    longDistanceHitCounter: 0,
    lowAccuracyHitCounter: 0,
    shotsFiredCounter: 0,
    shotsLandedCounter: 0,
    kills: [],
    daysWounded: 0,
    KIA: false,
    nikeCross: false,
    mercyCross: false,
    woundsHealed: 0,
    delta: createUnitStats(),
    appliedStimulant: 0,
    appliedPainKill: 0,
    revivedSoldier: 0,
    revivedHostile: 0,
    revivedNeutral: 0,
    MIA: false,
    martyr: 0,
    slaveKills: 0,
    duplicateEntry(status: UnitStatus, id: number): boolean {
      return this.kills.some(kill => kill.id === id && kill.status === status);
    }
  };
}

function normalizeMovementType(armor: Armor, depth: number): MovementType {
  const movementType = armor.getMovementType();
  if (movementType === MovementType.MT_FLOAT) {
    return depth > 0 ? MovementType.MT_FLY : MovementType.MT_WALK;
  }
  if (movementType === MovementType.MT_SINK) {
    return depth === 0 ? MovementType.MT_FLY : MovementType.MT_WALK;
  }
  return movementType;
}

export class BattleUnit {
  static MAX_SOLDIER_ID = 1000000;
  private static SPEC_WEAPON_MAX = 3;

  private _faction = UnitFaction.FACTION_PLAYER;
  private _originalFaction = UnitFaction.FACTION_PLAYER;
  private _killedBy = UnitFaction.FACTION_PLAYER;
  private _id = 0;
  private _pos = new Position();
  private _tile: TileLike | null = null;
  private _lastPos = new Position();
  private _direction = 0;
  private _toDirection = 0;
  private _directionTurret = 0;
  private _toDirectionTurret = 0;
  private _verticalDirection = 0;
  private _destination = new Position();
  private _status = UnitStatus.STATUS_STANDING;
  private _walkPhase = 0;
  private _fallPhase = 0;
  private _tu = 0;
  private _energy = 0;
  private _health = 0;
  private _morale = 100;
  private _stunlevel = 0;
  private _kneeled = false;
  private _floating = false;
  private _dontReselect = false;
  private _currentArmor = [0, 0, 0, 0, 0];
  private _maxArmor = [0, 0, 0, 0, 0];
  private _fatalWounds = [0, 0, 0, 0, 0, 0];
  private _fire = 0;
  private _currentAIState: AIModuleLike | null = null;
  private _inventory: BattleItem[] = [];
  private _specWeapon: Array<BattleItem | null> = Array.from({ length: BattleUnit.SPEC_WEAPON_MAX }, () => null);
  private _visible = false;
  private _cacheInvalid = true;
  private _expBravery = 0;
  private _expReactions = 0;
  private _expFiring = 0;
  private _expThrowing = 0;
  private _expPsiSkill = 0;
  private _expPsiStrength = 0;
  private _expMelee = 0;
  private _motionPoints = 0;
  private _kills = 0;
  private _faceDirection = -1;
  private _hitByFire = false;
  private _hitByAnything = false;
  private _moraleRestored = 0;
  private _charging: BattleUnit | null = null;
  private _turnsSinceSpotted = 255;
  private _unitsSpottedThisTurn: BattleUnit[] = [];
  private _visibleUnits: BattleUnit[] = [];
  private _visibleTiles: TileLike[] = [];
  private _spawnUnit = "";
  private _activeHand = "STR_RIGHT_HAND";
  private _statistics = createBattleUnitStatistics();
  private _murdererId = 0;
  private _mindControllerID = 0;
  private _fatalShotSide = UnitSide.SIDE_FRONT;
  private _fatalShotBodyPart = UnitBodyPart.BODYPART_HEAD;
  private _murdererWeapon = "";
  private _murdererWeaponAmmo = "";

  private _type = "";
  private _rank = "";
  private _race = "";
  private _name = "";
  private _stats = createUnitStats();
  private _standHeight = 0;
  private _kneelHeight = 0;
  private _floatHeight = 0;
  private _deathSound: number[] = [];
  private _value = 0;
  private _aggroSound = -1;
  private _moveSound = -1;
  private _intelligence = 0;
  private _aggression = 0;
  private _specab = SpecialAbility.SPECAB_NONE;
  private _armor: Armor;
  private _gender = SoldierGender.GENDER_MALE;
  private _geoscapeSoldier: Soldier | null = null;
  private _loftempsSet: number[] = [];
  private _unitRules: Unit | null = null;
  private _rankInt = 0;
  private _turretType = -1;
  private _breathFrame = -1;
  private _breathing = false;
  private _hidingForTurn = false;
  private _floorAbove = false;
  private _respawn = false;
  private _movementType = MovementType.MT_WALK;
  private _recolor: Array<[number, number]> = [];
  private _capturable = true;

  lastCover = new Position(-1, -1, -1);

  constructor(soldier: Soldier, depth: number);
  constructor(unit: Unit, faction: UnitFaction, id: number, armor: Armor, adjustment: StatAdjustment | null | undefined, depth: number);
  constructor(source: Soldier | Unit, depthOrFaction: number, id = 0, armor: Armor | null = null, adjustment: StatAdjustment | null | undefined = null, depth = 0) {
    if (source instanceof Soldier) {
      const soldier = source;
      const soldierArmor = soldier.getArmor();
      if (!soldierArmor) {
        throw new Error(`Soldier ${soldier.getId()} has no armor.`);
      }
      this._armor = soldierArmor;
      this.initFromSoldier(soldier, depthOrFaction);
    } else {
      if (!armor) {
        throw new Error(`Unit ${source.getType()} has no armor.`);
      }
      this._armor = armor;
      this.initFromUnit(source, depthOrFaction as UnitFaction, id, armor, adjustment || null, depth);
    }
  }

  private initFromSoldier(soldier: Soldier, depth: number): void {
    this._faction = UnitFaction.FACTION_PLAYER;
    this._originalFaction = UnitFaction.FACTION_PLAYER;
    this._killedBy = UnitFaction.FACTION_PLAYER;
    this._geoscapeSoldier = soldier;
    this._name = soldier.getName(true);
    this._id = soldier.getId();
    this._type = "SOLDIER";
    this._rank = soldier.getRankString();
    this._stats = cloneStats(soldier.getCurrentStats());
    this._standHeight = soldier.getRules().getStandHeight();
    this._kneelHeight = soldier.getRules().getKneelHeight();
    this._floatHeight = soldier.getRules().getFloatHeight();
    this._deathSound = [];
    this._aggroSound = -1;
    this._moveSound = -1;
    this._intelligence = 2;
    this._aggression = 1;
    this._specab = SpecialAbility.SPECAB_NONE;
    this._movementType = normalizeMovementType(this._armor, depth);
    addStats(this._stats, this._armor.getStats());
    this._loftempsSet = [...this._armor.getLoftempsSet()];
    this._gender = soldier.getGender();
    this._breathFrame = this._armor.drawBubbles() ? 0 : -1;

    let rankbonus = 0;
    switch (soldier.getRank()) {
      case SoldierRank.RANK_SERGEANT: rankbonus = 1; break;
      case SoldierRank.RANK_CAPTAIN: rankbonus = 3; break;
      case SoldierRank.RANK_COLONEL: rankbonus = 6; break;
      case SoldierRank.RANK_COMMANDER: rankbonus = 10; break;
      default: rankbonus = 0; break;
    }
    this._value = soldier.getRules().getValue() + soldier.getMissions() + rankbonus;
    this.finishInitialization();
    this.deriveRank();
    const look = soldier.getGender() + 2 * soldier.getLook();
    this.setRecolor(look, look, this._rankInt);
  }

  private initFromUnit(unit: Unit, faction: UnitFaction, id: number, armor: Armor, adjustment: StatAdjustment | null, depth: number): void {
    this._faction = faction;
    this._originalFaction = faction;
    this._killedBy = faction;
    this._id = id;
    this._armor = armor;
    this._unitRules = unit;
    this._type = unit.getType();
    this._rank = unit.getRank();
    this._race = unit.getRace();
    this._stats = cloneStats(unit.getStats());
    this._standHeight = unit.getStandHeight();
    this._kneelHeight = unit.getKneelHeight();
    this._floatHeight = unit.getFloatHeight();
    this._loftempsSet = [...armor.getLoftempsSet()];
    this._deathSound = [...unit.getDeathSounds()];
    this._aggroSound = unit.getAggroSound();
    this._moveSound = unit.getMoveSound();
    this._intelligence = unit.getIntelligence();
    this._aggression = unit.getAggression();
    this._specab = unit.getSpecialAbility();
    this._spawnUnit = unit.getSpawnUnit();
    this._value = unit.getValue();
    this._capturable = unit.getCapturable();
    this._movementType = normalizeMovementType(armor, depth);
    addStats(this._stats, armor.getStats());
    this._breathFrame = armor.drawBubbles() ? 0 : -1;
    this.setMaxArmorFromArmor();
    if (faction === UnitFaction.FACTION_HOSTILE && adjustment) {
      this.adjustStats(adjustment);
    }
    this.finishInitialization(false);

    let generalRank = 0;
    if (faction === UnitFaction.FACTION_HOSTILE) {
      const rankList = [
        "STR_LIVE_SOLDIER",
        "STR_LIVE_ENGINEER",
        "STR_LIVE_MEDIC",
        "STR_LIVE_NAVIGATOR",
        "STR_LIVE_LEADER",
        "STR_LIVE_COMMANDER",
        "STR_LIVE_TERRORIST"
      ];
      generalRank = Math.max(0, rankList.indexOf(this._rank));
    } else if (faction === UnitFaction.FACTION_NEUTRAL) {
      generalRank = RNG.generate(0, 7);
    }
    this.setRecolor(RNG.generate(0, 7), RNG.generate(0, 7), generalRank);
  }

  private finishInitialization(setArmor = true): void {
    this._tu = this._stats.tu;
    this._energy = this._stats.stamina;
    this._health = this._stats.health;
    this._morale = 100;
    this._stunlevel = 0;
    if (setArmor) {
      this.setMaxArmorFromArmor();
    }
    this._currentArmor = [...this._maxArmor];
    this._fatalWounds = [0, 0, 0, 0, 0, 0];
    this._activeHand = "STR_RIGHT_HAND";
  }

  private setMaxArmorFromArmor(): void {
    this._maxArmor[UnitSide.SIDE_FRONT] = this._armor.getFrontArmor();
    this._maxArmor[UnitSide.SIDE_LEFT] = this._armor.getSideArmor();
    this._maxArmor[UnitSide.SIDE_RIGHT] = this._armor.getSideArmor();
    this._maxArmor[UnitSide.SIDE_REAR] = this._armor.getRearArmor();
    this._maxArmor[UnitSide.SIDE_UNDER] = this._armor.getUnderArmor();
  }

  private setRecolor(basicLook: number, utileLook: number, rankLook: number): void {
    const colors: Array<[number, number]> = [
      [this._armor.getFaceColorGroup(), this._armor.getFaceColor(basicLook)],
      [this._armor.getHairColorGroup(), this._armor.getHairColor(basicLook)],
      [this._armor.getUtileColorGroup(), this._armor.getUtileColor(utileLook)],
      [this._armor.getRankColorGroup(), this._armor.getRankColor(rankLook)]
    ];
    for (const [group, color] of colors) {
      if (group > 0 && color > 0) {
        this._recolor.push([group << 4, color]);
      }
    }
  }

  load(node: BattleUnitSave): void {
    this._id = node.id ?? this._id;
    this._faction = this._originalFaction = node.faction ?? this._faction;
    this._status = node.status ?? this._status;
    this._pos = Position.from(node.position);
    this._direction = this._toDirection = node.direction ?? this._direction;
    this._directionTurret = this._toDirectionTurret = node.directionTurret ?? this._directionTurret;
    this._tu = node.tu ?? this._tu;
    this._health = node.health ?? this._health;
    this._stunlevel = node.stunlevel ?? this._stunlevel;
    this._energy = node.energy ?? this._energy;
    this._morale = node.morale ?? this._morale;
    this._kneeled = node.kneeled ?? this._kneeled;
    this._floating = node.floating ?? this._floating;
    for (let i = 0; i < 5; ++i) {
      this._currentArmor[i] = node.armor?.[i] ?? this._currentArmor[i];
    }
    for (let i = 0; i < 6; ++i) {
      this._fatalWounds[i] = node.fatalWounds?.[i] ?? this._fatalWounds[i];
    }
    this._fire = node.fire ?? this._fire;
    this._expBravery = node.expBravery ?? this._expBravery;
    this._expReactions = node.expReactions ?? this._expReactions;
    this._expFiring = node.expFiring ?? this._expFiring;
    this._expThrowing = node.expThrowing ?? this._expThrowing;
    this._expPsiSkill = node.expPsiSkill ?? this._expPsiSkill;
    this._expPsiStrength = node.expPsiStrength ?? this._expPsiStrength;
    this._expMelee = node.expMelee ?? this._expMelee;
    this._turretType = node.turretType ?? this._turretType;
    this._visible = node.visible ?? this._visible;
    this._turnsSinceSpotted = node.turnsSinceSpotted ?? this._turnsSinceSpotted;
    this._killedBy = node.killedBy ?? this._killedBy;
    this._moraleRestored = node.moraleRestored ?? this._moraleRestored;
    this._rankInt = node.rankInt ?? this._rankInt;
    this._originalFaction = node.originalFaction ?? this._originalFaction;
    this._kills = node.kills ?? this._kills;
    this._dontReselect = node.dontReselect ?? this._dontReselect;
    this._charging = null;
    this._spawnUnit = node.spawnUnit ?? this._spawnUnit;
    this._motionPoints = node.motionPoints ?? this._motionPoints;
    this._respawn = node.respawn ?? this._respawn;
    this._activeHand = node.activeHand ?? this._activeHand;
    this._murdererId = node.murdererId ?? this._murdererId;
    this._fatalShotSide = node.fatalShotSide ?? this._fatalShotSide;
    this._fatalShotBodyPart = node.fatalShotBodyPart ?? this._fatalShotBodyPart;
    this._murdererWeapon = node.murdererWeapon ?? this._murdererWeapon;
    this._murdererWeaponAmmo = node.murdererWeaponAmmo ?? this._murdererWeaponAmmo;
    if (node.recolor) {
      this._recolor = node.recolor.map(pair => [pair[0] || 0, pair[1] || 0]);
    }
    this._mindControllerID = node.mindControllerID ?? this._mindControllerID;
  }

  save(): BattleUnitSave {
    const node: BattleUnitSave = {
      id: this._id,
      genUnitType: this._type,
      genUnitArmor: this._armor.getType(),
      faction: this._faction,
      status: this._status,
      position: this._pos.toArray(),
      direction: this._direction,
      directionTurret: this._directionTurret,
      tu: this._tu,
      health: this._health,
      stunlevel: this._stunlevel,
      energy: this._energy,
      morale: this._morale,
      kneeled: this._kneeled,
      floating: this._floating,
      armor: [...this._currentArmor],
      fatalWounds: [...this._fatalWounds],
      fire: this._fire,
      expBravery: this._expBravery,
      expReactions: this._expReactions,
      expFiring: this._expFiring,
      expThrowing: this._expThrowing,
      expPsiSkill: this._expPsiSkill,
      expPsiStrength: this._expPsiStrength,
      expMelee: this._expMelee,
      turretType: this._turretType,
      visible: this._visible,
      turnsSinceSpotted: this._turnsSinceSpotted,
      rankInt: this._rankInt,
      moraleRestored: this._moraleRestored,
      killedBy: this._killedBy,
      motionPoints: this._motionPoints,
      respawn: this._respawn,
      activeHand: this._activeHand,
      murdererId: this._murdererId,
      fatalShotSide: this._fatalShotSide,
      fatalShotBodyPart: this._fatalShotBodyPart,
      murdererWeapon: this._murdererWeapon,
      murdererWeaponAmmo: this._murdererWeaponAmmo,
      recolor: this._recolor.map(pair => [...pair]),
      mindControllerID: this._mindControllerID
    };
    if (this._originalFaction !== this._faction) {
      node.originalFaction = this._originalFaction;
    }
    if (this._kills) {
      node.kills = this._kills;
    }
    if (this._currentAIState?.save) {
      node.AI = this._currentAIState.save();
    }
    if (this._faction === UnitFaction.FACTION_PLAYER && this._dontReselect) {
      node.dontReselect = this._dontReselect;
    }
    if (this._spawnUnit) {
      node.spawnUnit = this._spawnUnit;
    }
    return node;
  }

  getId(): number {
    return this._id;
  }

  setPosition(pos: PositionLike, updateLastPos = true): void {
    if (updateLastPos) {
      this._lastPos = this._pos.clone();
    }
    this._pos = Position.from(pos);
  }

  getPosition(): Position {
    return this._pos;
  }

  getLastPosition(): Position {
    return this._lastPos;
  }

  setDirection(direction: number): void {
    this._direction = direction;
    this._toDirection = direction;
    this._directionTurret = direction;
  }

  lookAt(direction: number | PositionLike, forceOrTurret = false): void {
    if (typeof direction !== "number") {
      const targetDirection = this.directionTo(direction);
      if (forceOrTurret) {
        this._toDirectionTurret = targetDirection;
        if (this._toDirectionTurret !== this._directionTurret) {
          this._status = UnitStatus.STATUS_TURNING;
        }
      } else {
        this._toDirection = targetDirection;
        if (this._toDirection !== this._direction && this._toDirection < 8 && this._toDirection > -1) {
          this._status = UnitStatus.STATUS_TURNING;
        }
      }
      return;
    }

    if (!forceOrTurret) {
      if (direction < 0 || direction >= 8) {
        return;
      }
      this._toDirection = direction;
      if (this._toDirection !== this._direction) {
        this._status = UnitStatus.STATUS_TURNING;
      }
    } else {
      this._toDirection = direction;
      this._direction = direction;
    }
  }

  turn(turret = false): void {
    let delta = 0;
    if (turret) {
      if (this._directionTurret === this._toDirectionTurret) {
        this.abortTurn();
        return;
      }
      delta = this._toDirectionTurret - this._directionTurret;
    } else {
      if (this._direction === this._toDirection) {
        this.abortTurn();
        return;
      }
      delta = this._toDirection - this._direction;
    }

    if (delta !== 0) {
      const increment = delta > 0 ? (delta <= 4 ? 1 : -1) : (delta > -4 ? -1 : 1);
      if (!turret) {
        if (this._turretType > -1) {
          this._directionTurret += increment;
        }
        this._direction += increment;
      } else {
        this._directionTurret += increment;
      }
      if (this._direction < 0) this._direction = 7;
      if (this._direction > 7) this._direction = 0;
      if (this._directionTurret < 0) this._directionTurret = 7;
      if (this._directionTurret > 7) this._directionTurret = 0;
      if (this._visible || this._faction === UnitFaction.FACTION_PLAYER) {
        this._cacheInvalid = true;
      }
    }

    if (turret) {
      if (this._toDirectionTurret === this._directionTurret) {
        this._status = UnitStatus.STATUS_STANDING;
      }
    } else if (this._toDirection === this._direction || this._status === UnitStatus.STATUS_UNCONSCIOUS) {
      this._status = UnitStatus.STATUS_STANDING;
    }
  }

  setFaceDirection(direction: number): void {
    this._faceDirection = direction;
  }

  getDirection(): number {
    return this._direction;
  }

  getFaceDirection(): number {
    return this._faceDirection;
  }

  getFaction(): UnitFaction {
    return this._faction;
  }

  getTurretDirection(): number {
    return this._directionTurret;
  }

  getTurretToDirection(): number {
    return this._toDirectionTurret;
  }

  getVerticalDirection(): number {
    return this._verticalDirection;
  }

  getStatus(): UnitStatus {
    return this._status;
  }

  getWalkingPhase(): number {
    return this._walkPhase % 8;
  }

  getFallingPhase(): number {
    return this._fallPhase;
  }

  getDestination(): Position {
    return this._destination;
  }

  kneel(kneeled: boolean): void {
    this._kneeled = kneeled;
    this._cacheInvalid = true;
  }

  isKneeled(): boolean {
    return this._kneeled;
  }

  isFloating(): boolean {
    return this._floating;
  }

  aim(aiming: boolean): void {
    this._status = aiming ? UnitStatus.STATUS_AIMING : UnitStatus.STATUS_STANDING;
    if (this._visible || this._faction === UnitFaction.FACTION_PLAYER) {
      this._cacheInvalid = true;
    }
  }

  startWalking(direction: number, destination: PositionLike, tileBelowMe: Tile | null, cache = true): void {
    if (direction >= 8) {
      this._verticalDirection = direction;
      this._status = UnitStatus.STATUS_FLYING;
    } else {
      this._verticalDirection = 0;
      this._direction = direction;
      this._status = UnitStatus.STATUS_WALKING;
    }

    const floorFound = this._tile && !this._tile.hasNoFloor?.(tileBelowMe);
    if (!floorFound || direction >= 8) {
      this._status = UnitStatus.STATUS_FLYING;
      this._floating = true;
    } else {
      this._floating = false;
    }

    this._walkPhase = 0;
    this._destination = Position.from(destination);
    this._lastPos = this._pos.clone();
    this._cacheInvalid = cache;
    this._kneeled = false;
    if (this._breathFrame >= 0) {
      this._breathing = false;
      this._breathFrame = 0;
    }
  }

  keepWalking(tileBelowMe: Tile | null, cache = true): void {
    let middle: number;
    let end: number;
    if (this._verticalDirection) {
      middle = 4;
      end = 8;
    } else {
      middle = 4 + 4 * (this._direction % 2);
      end = 8 + 8 * (this._direction % 2);
      if (this._armor.getSize() > 1) {
        if (this._direction < 1 || this._direction > 5) {
          middle = end;
        } else if (this._direction === 5) {
          middle = 12;
        } else if (this._direction === 1) {
          middle = 5;
        } else {
          middle = 1;
        }
      }
    }
    if (!cache) {
      this._pos = this._destination.clone();
      end = 2;
    }

    this._walkPhase++;
    if (this._walkPhase === middle) {
      this._pos = this._destination.clone();
    }
    if (this._walkPhase >= end) {
      if (this._floating && this._tile && !this._tile.hasNoFloor?.(tileBelowMe)) {
        this._floating = false;
      }
      this._status = UnitStatus.STATUS_STANDING;
      this._walkPhase = 0;
      this._verticalDirection = 0;
      if (this._faceDirection >= 0) {
        this._direction = this._faceDirection;
        this._faceDirection = -1;
      }
      this._motionPoints += this._armor.getSize() > 1 ? 30 : (this.getStandHeight() > 16 ? 4 : 3);
    }
    this._cacheInvalid = cache;
  }

  abortTurn(): void {
    this._status = UnitStatus.STATUS_STANDING;
  }

  setCache(_cache: unknown = null, _part = 0): void {
    this._cacheInvalid = true;
  }

  directionTo(point: PositionLike): number {
    const ox = point.x - this._pos.x;
    const oy = point.y - this._pos.y;
    const angle = Math.atan2(ox, -oy);
    const quarter = Math.PI / 4;
    const pie = [
      quarter * 4.0 - quarter / 2.0,
      quarter * 3.0 - quarter / 2.0,
      quarter * 2.0 - quarter / 2.0,
      quarter - quarter / 2.0
    ];
    if (angle > pie[0] || angle < -pie[0]) return 4;
    if (angle > pie[1]) return 3;
    if (angle > pie[2]) return 2;
    if (angle > pie[3]) return 1;
    if (angle < -pie[1]) return 5;
    if (angle < -pie[2]) return 6;
    if (angle < -pie[3]) return 7;
    return 0;
  }

  getTimeUnits(): number {
    return this._tu;
  }

  getReactionScore(): number {
    return this.getBaseStats().tu === 0 ? 0 : this.getBaseStats().reactions * this.getTimeUnits() / this.getBaseStats().tu;
  }

  getEnergy(): number {
    return this._energy;
  }

  getHealth(): number {
    return this._health;
  }

  getMorale(): number {
    return this._morale;
  }

  getStunlevel(): number {
    return this._stunlevel;
  }

  damage(relativeLike: PositionLike, power: number, type: ItemDamageType, ignoreArmor = false): number {
    this._hitByAnything = true;
    if (power <= 0) {
      return 0;
    }
    const relative = Position.from(relativeLike);
    let side = UnitSide.SIDE_FRONT;
    let bodypart = UnitBodyPart.BODYPART_TORSO;
    let adjustedPower = Math.trunc(power * this._armor.getDamageModifier(type));
    if (type === ItemDamageType.DT_SMOKE) {
      type = ItemDamageType.DT_STUN;
    }
    if (!ignoreArmor) {
      if (relative.equals(new Position())) {
        side = UnitSide.SIDE_UNDER;
      } else {
        let relativeDirection = 8;
        const absX = Math.abs(relative.x);
        const absY = Math.abs(relative.y);
        if (absY > absX * 2) {
          relativeDirection = 8 + 4 * (relative.y > 0 ? 1 : 0);
        } else if (absX > absY * 2) {
          relativeDirection = 10 + 4 * (relative.x < 0 ? 1 : 0);
        } else if (relative.x < 0) {
          relativeDirection = relative.y > 0 ? 13 : 15;
        } else {
          relativeDirection = relative.y > 0 ? 11 : 9;
        }

        switch (((relativeDirection - this._direction) % 8 + 8) % 8) {
          case 0:
            side = UnitSide.SIDE_FRONT;
            break;
          case 1:
            side = RNG.generate(0, 2) < 2 ? UnitSide.SIDE_FRONT : UnitSide.SIDE_RIGHT;
            break;
          case 2:
            side = UnitSide.SIDE_RIGHT;
            break;
          case 3:
            side = RNG.generate(0, 2) < 2 ? UnitSide.SIDE_REAR : UnitSide.SIDE_RIGHT;
            break;
          case 4:
            side = UnitSide.SIDE_REAR;
            break;
          case 5:
            side = RNG.generate(0, 2) < 2 ? UnitSide.SIDE_REAR : UnitSide.SIDE_LEFT;
            break;
          case 6:
            side = UnitSide.SIDE_LEFT;
            break;
          case 7:
            side = RNG.generate(0, 2) < 2 ? UnitSide.SIDE_FRONT : UnitSide.SIDE_LEFT;
            break;
          default:
            break;
        }
        if (relative.z >= this.getHeight()) {
          bodypart = UnitBodyPart.BODYPART_HEAD;
        } else if (relative.z > 4) {
          switch (side) {
            case UnitSide.SIDE_LEFT:
              bodypart = UnitBodyPart.BODYPART_LEFTARM;
              break;
            case UnitSide.SIDE_RIGHT:
              bodypart = UnitBodyPart.BODYPART_RIGHTARM;
              break;
            default:
              bodypart = UnitBodyPart.BODYPART_TORSO;
              break;
          }
        } else {
          switch (side) {
            case UnitSide.SIDE_LEFT:
              bodypart = UnitBodyPart.BODYPART_LEFTLEG;
              break;
            case UnitSide.SIDE_RIGHT:
              bodypart = UnitBodyPart.BODYPART_RIGHTLEG;
              break;
            default:
              bodypart = RNG.generate(UnitBodyPart.BODYPART_RIGHTLEG, UnitBodyPart.BODYPART_LEFTLEG);
              break;
          }
        }
      }
      adjustedPower -= this.getArmor(side) as number;
    }
    if (adjustedPower > 0) {
      if (type === ItemDamageType.DT_STUN) {
        this._stunlevel += adjustedPower;
      } else {
        this._health = Math.max(0, this._health - adjustedPower);
        if (type !== ItemDamageType.DT_IN) {
          if (this._armor.getDamageModifier(ItemDamageType.DT_STUN) > 0.0) {
            this._stunlevel += RNG.generate(0, Math.trunc(adjustedPower / 4));
          }
          if (this.isWoundable() && RNG.generate(0, 10) < adjustedPower) {
            this._fatalWounds[bodypart] += RNG.generate(1, 3);
            if (this._fatalWounds[bodypart]) {
              this.moraleChange(-this._fatalWounds[bodypart]);
            }
          }
          this.setArmor((this.getArmor(side) as number) - Math.trunc(adjustedPower / 10) - 1, side);
        }
      }
    }
    this.setFatalShotInfo(side, bodypart);
    return Math.max(0, adjustedPower);
  }

  healStun(power: number): void {
    this._stunlevel = Math.max(0, this._stunlevel - power);
  }

  heal(part: number, woundAmount: number, healthAmount: number): void {
    if (part < 0 || part > 5 || !this._fatalWounds[part]) {
      return;
    }

    this._fatalWounds[part] -= woundAmount;
    if (this._fatalWounds[part] < 0) {
      this._fatalWounds[part] = 0;
    }

    this._health += healthAmount;
    if (this._health > this.getBaseStats().health) {
      this._health = this.getBaseStats().health;
    }
  }

  painKillers(): void {
    const lostHealth = this.getBaseStats().health - this._health;
    if (lostHealth > this._moraleRestored) {
      this._morale = Math.min(100, lostHealth - this._moraleRestored + this._morale);
      this._moraleRestored = lostHealth;
    }
  }

  stimulant(energy: number, s: number): void {
    this._energy += energy;
    if (this._energy > this.getBaseStats().stamina) {
      this._energy = this.getBaseStats().stamina;
    }
    this.healStun(s);
  }

  isOut(): boolean {
    return this._status === UnitStatus.STATUS_DEAD ||
      this._status === UnitStatus.STATUS_UNCONSCIOUS ||
      this._status === UnitStatus.STATUS_IGNORE_ME;
  }

  isInExitArea(stt: SpecialTileType = SpecialTileType.START_POINT): boolean {
    return Boolean(this._tile?.getMapData?.(TilePart.O_FLOOR)?.getSpecialType?.() === stt);
  }

  getActionTUs(actionType: BattleActionType, item: BattleItem | RuleItem | null): number {
    if (!item) {
      return 0;
    }
    const rules = item instanceof BattleItem ? item.getRules() : item;
    let cost = 0;
    switch (actionType) {
      case BattleActionType.BA_PRIME: cost = 50; break;
      case BattleActionType.BA_THROW: cost = 25; break;
      case BattleActionType.BA_AUTOSHOT: cost = rules.getTUAuto(); break;
      case BattleActionType.BA_SNAPSHOT: cost = rules.getTUSnap(); break;
      case BattleActionType.BA_HIT: cost = rules.getTUMelee(); break;
      case BattleActionType.BA_LAUNCH:
      case BattleActionType.BA_AIMEDSHOT: cost = rules.getTUAimed(); break;
      case BattleActionType.BA_USE:
      case BattleActionType.BA_MINDCONTROL:
      case BattleActionType.BA_PANIC: cost = rules.getTUUse(); break;
      default: cost = 0; break;
    }
    if (!rules.getFlatRate() || actionType === BattleActionType.BA_THROW || actionType === BattleActionType.BA_PRIME) {
      cost = Math.floor(this.getBaseStats().tu * cost / 100.0);
    }
    return cost;
  }

  spendTimeUnits(tu: number): boolean {
    if (tu <= this._tu) {
      this._tu -= tu;
      return true;
    }
    return false;
  }

  spendEnergy(tu: number): boolean {
    const eu = Math.trunc(tu / 2);
    if (eu <= this._energy) {
      this._energy -= eu;
      return true;
    }
    return false;
  }

  setTimeUnits(tu: number): void {
    this._tu = Math.max(0, tu);
  }

  getFiringAccuracy(actionType: BattleActionType, item: BattleItem): number {
    let weaponAcc = item.getRules().getAccuracySnap();
    if (actionType === BattleActionType.BA_AIMEDSHOT || actionType === BattleActionType.BA_LAUNCH) {
      weaponAcc = item.getRules().getAccuracyAimed();
    } else if (actionType === BattleActionType.BA_AUTOSHOT) {
      weaponAcc = item.getRules().getAccuracyAuto();
    } else if (actionType === BattleActionType.BA_HIT) {
      if (item.getRules().isSkillApplied()) {
        return Math.trunc((this.getBaseStats().melee * item.getRules().getAccuracyMelee() / 100) * this.getAccuracyModifier(item) / 100);
      }
      return Math.trunc(item.getRules().getAccuracyMelee() * this.getAccuracyModifier(item) / 100);
    }
    let result = Math.trunc(this.getBaseStats().firing * weaponAcc / 100);
    if (this._kneeled) {
      result = Math.trunc(result * 115 / 100);
    }
    if (item.getRules().isTwoHanded() && this.getItem("STR_RIGHT_HAND") && this.getItem("STR_LEFT_HAND")) {
      result = Math.trunc(result * 80 / 100);
    }
    return Math.trunc(result * this.getAccuracyModifier(item) / 100);
  }

  getAccuracyModifier(item: BattleItem | null = null): number {
    let wounds = this._fatalWounds[UnitBodyPart.BODYPART_HEAD];
    if (item) {
      if (item.getRules().isTwoHanded()) {
        wounds += this._fatalWounds[UnitBodyPart.BODYPART_RIGHTARM] + this._fatalWounds[UnitBodyPart.BODYPART_LEFTARM];
      } else if (this.getItem("STR_RIGHT_HAND") === item) {
        wounds += this._fatalWounds[UnitBodyPart.BODYPART_RIGHTARM];
      } else {
        wounds += this._fatalWounds[UnitBodyPart.BODYPART_LEFTARM];
      }
    }
    return Math.max(10, Math.trunc(25 * this._health / this.getBaseStats().health + 75 - 10 * wounds));
  }

  getThrowingAccuracy(): number {
    return this.getBaseStats().throwing * this.getAccuracyModifier() / 100.0;
  }

  setArmor(armor: number, side: UnitSide): void {
    this._currentArmor[side] = Math.max(0, armor);
  }

  getArmor(): Armor;
  getArmor(side: UnitSide): number;
  getArmor(side?: UnitSide): Armor | number {
    if (side == null) {
      return this._armor;
    }
    return this._currentArmor[side] || 0;
  }

  getMaxArmor(side: UnitSide): number {
    return this._maxArmor[side] || 0;
  }

  getFatalWounds(part?: UnitBodyPart): number {
    if (part != null) {
      return this._fatalWounds[part] || 0;
    }
    return this._fatalWounds.reduce((total, wounds) => total + wounds, 0);
  }

  getInventory(): BattleItem[] {
    return this._inventory;
  }

  setVisible(flag: boolean): void {
    this._visible = flag;
  }

  getVisible(): boolean {
    return this._visible;
  }

  addToVisibleUnits(unit: BattleUnit): boolean {
    if (!this._unitsSpottedThisTurn.includes(unit)) {
      this._unitsSpottedThisTurn.push(unit);
    }
    if (this._visibleUnits.includes(unit)) {
      return false;
    }
    this._visibleUnits.push(unit);
    return true;
  }

  getVisibleUnits(): BattleUnit[] {
    return this._visibleUnits;
  }

  clearVisibleUnits(): void {
    this._visibleUnits.length = 0;
  }

  addToVisibleTiles(tile: TileLike | null): boolean {
    if (!tile) {
      return false;
    }
    this._visibleTiles.push(tile);
    return true;
  }

  getVisibleTiles(): TileLike[] {
    return this._visibleTiles;
  }

  clearVisibleTiles(): void {
    for (const tile of this._visibleTiles) {
      tile.setVisible?.(-1);
    }
    this._visibleTiles.length = 0;
  }

  setTile(tile: TileLike | null, tileBelow: Tile | null = null): void {
    this._tile = tile;
    if (!this._tile) {
      this._floating = false;
      return;
    }
    const hasNoFloor = this._tile.hasNoFloor?.(tileBelow) ?? true;
    if (this._status === UnitStatus.STATUS_WALKING && hasNoFloor && this._movementType === MovementType.MT_FLY) {
      this._status = UnitStatus.STATUS_FLYING;
      this._floating = true;
    } else if (this._status === UnitStatus.STATUS_FLYING && !hasNoFloor && this._verticalDirection === 0) {
      this._status = UnitStatus.STATUS_WALKING;
      this._floating = false;
    } else if (this._status === UnitStatus.STATUS_UNCONSCIOUS) {
      this._floating = this._movementType === MovementType.MT_FLY && hasNoFloor;
    }
  }

  getTile(): TileLike | null {
    return this._tile;
  }

  setFire(fire: number): void {
    this._fire = fire;
  }

  getFire(): number {
    return this._fire;
  }

  getItem(slot: RuleInventory | string, x = 0, y = 0): BattleItem | null {
    if (typeof slot !== "string") {
      if (slot.getType() !== InventoryType.INV_GROUND) {
        return this._inventory.find(item => item.getSlot() === slot && item.occupiesSlot(x, y)) || null;
      }
      return this._tile?.getInventory?.().find(item => item.occupiesSlot(x, y)) || null;
    }
    if (slot !== "STR_GROUND") {
      return this._inventory.find(item => item.getSlot()?.getId() === slot && item.occupiesSlot(x, y)) || null;
    }
    return this._tile?.getInventory?.().find(item => item.getSlot() && item.occupiesSlot(x, y)) || null;
  }

  getMainHandWeapon(quickest = true): BattleItem | null {
    let weaponRightHand = this.getItem("STR_RIGHT_HAND");
    let weaponLeftHand = this.getItem("STR_LEFT_HAND");

    if (!weaponRightHand?.getAmmoItem()?.getAmmoQuantity()) {
      weaponRightHand = null;
    }
    if (!weaponLeftHand?.getAmmoItem()?.getAmmoQuantity()) {
      weaponLeftHand = null;
    }
    if (weaponRightHand && !weaponLeftHand) {
      return weaponRightHand;
    }
    if (!weaponRightHand && weaponLeftHand) {
      return weaponLeftHand;
    }
    if (!weaponRightHand || !weaponLeftHand) {
      return null;
    }

    const tuRightHand = weaponRightHand.getRules().getTUSnap();
    const tuLeftHand = weaponLeftHand.getRules().getTUSnap();
    const weaponCurrentHand = this.getItem(this.getActiveHand());
    if (!quickest && this._faction !== UnitFaction.FACTION_PLAYER) {
      if (weaponRightHand.getRules().getWaypoints() !== 0 || weaponRightHand.getAmmoItem()?.getRules().getWaypoints() !== 0) {
        return weaponRightHand;
      }
      if (weaponLeftHand.getRules().getWaypoints() !== 0 || weaponLeftHand.getAmmoItem()?.getRules().getWaypoints() !== 0) {
        return weaponLeftHand;
      }
    }
    if (tuLeftHand <= 0 && tuRightHand > 0) {
      return weaponRightHand;
    }
    if (tuRightHand <= 0 && tuLeftHand > 0) {
      return weaponLeftHand;
    }
    if (tuLeftHand >= tuRightHand) {
      return quickest ? weaponRightHand : (this._faction === UnitFaction.FACTION_PLAYER ? weaponCurrentHand : weaponLeftHand);
    }
    return quickest ? weaponLeftHand : (this._faction === UnitFaction.FACTION_PLAYER ? weaponCurrentHand : weaponRightHand);
  }

  getGrenadeFromBelt(): BattleItem | null {
    return this._inventory.find(item => item.getRules().getBattleType() === BattleType.BT_GRENADE) || null;
  }

  checkAmmo(): boolean {
    let weapon = this.getItem("STR_RIGHT_HAND");
    if (!weapon ||
      weapon.getAmmoItem() !== null ||
      weapon.getRules().getBattleType() === BattleType.BT_MELEE ||
      this.getTimeUnits() < 15) {
      weapon = this.getItem("STR_LEFT_HAND");
      if (!weapon ||
        weapon.getAmmoItem() !== null ||
        weapon.getRules().getBattleType() === BattleType.BT_MELEE ||
        this.getTimeUnits() < 15) {
        return false;
      }
    }

    let ammo: BattleItem | null = null;
    let wrong = true;
    for (const item of this.getInventory()) {
      ammo = item;
      for (const compatible of weapon.getRules().getCompatibleAmmo()) {
        if (compatible === ammo.getRules().getType()) {
          wrong = false;
          break;
        }
      }
      if (!wrong) {
        break;
      }
    }

    if (wrong || !ammo) {
      return false;
    }

    this.spendTimeUnits(15);
    weapon.setAmmoItem(ammo);
    ammo.moveToOwner(null);
    return true;
  }

  getHeight(): number {
    return this.isKneeled() ? this.getKneelHeight() : this.getStandHeight();
  }

  addReactionExp(): void { this._expReactions++; }
  addFiringExp(): void { this._expFiring++; }
  addThrowingExp(): void { this._expThrowing++; }
  addPsiSkillExp(): void { this._expPsiSkill++; }
  addPsiStrengthExp(): void { this._expPsiStrength++; }
  addMeleeExp(): void { this._expMelee++; }

  getMiniMapSpriteIndex(): number {
    if (this.isOut()) {
      return 9;
    }
    switch (this.getFaction()) {
      case UnitFaction.FACTION_HOSTILE:
        return this._armor.getSize() === 1 ? 3 : 24;
      case UnitFaction.FACTION_NEUTRAL:
        return this._armor.getSize() === 1 ? 6 : 12;
      case UnitFaction.FACTION_PLAYER:
      default:
        return this._armor.getSize() === 1 ? 0 : 12;
    }
  }

  setTurretType(turretType: number): void {
    this._turretType = turretType;
  }

  getTurretType(): number {
    return this._turretType;
  }

  getFatalWound(part: UnitBodyPart): number {
    return this._fatalWounds[part] || 0;
  }

  getMotionPoints(): number {
    return this._motionPoints;
  }

  getName(lang: { getString: (id: string) => { toString: () => string } } | null = null, debugAppendId = false): string {
    if (this._type !== "SOLDIER" && lang) {
      let ret = this._type.includes("STR_") ? lang.getString(this._type).toString() : lang.getString(this._race).toString();
      if (debugAppendId) {
        ret = `${ret} ${this._id}`;
      }
      return ret;
    }
    return this._name;
  }

  getBaseStats(): UnitStats {
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

  getLoftemps(entry = 0): number {
    return this._loftempsSet[entry] || 0;
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

  isWoundable(): boolean {
    return this._armor.getSize() === 1;
  }

  isFearable(): boolean {
    return this._armor.getSize() === 1;
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

  setRespawn(respawn: boolean): void {
    this._respawn = respawn;
  }

  getRespawn(): boolean {
    return this._respawn;
  }

  getSpawnUnit(): string {
    return this._spawnUnit;
  }

  setSpawnUnit(spawnUnit: string): void {
    this._spawnUnit = spawnUnit;
  }

  getRankString(): string {
    return this._rank;
  }

  getGender(): SoldierGender {
    return this._gender;
  }

  getGeoscapeSoldier(): Soldier | null {
    return this._geoscapeSoldier;
  }

  addKillCount(): void {
    this._kills++;
  }

  updateGeoscapeStats(soldier: Soldier): void {
    const geoscapeSoldier = soldier as BattleUnitSoldierLike;
    geoscapeSoldier.addMissionCount?.();
    geoscapeSoldier.addKillCount?.(this._kills);
  }

  postMissionProcedures(geoscape: SavedGame, statsDiff: UnitStats): boolean {
    const save = geoscape as BattleUnitGeoscapeLike;
    const soldier = save.getSoldier?.(this._id);
    if (!soldier) {
      return false;
    }

    this.updateGeoscapeStats(soldier);

    const stats = soldier.getCurrentStats();
    subtractStats(statsDiff, stats);
    const caps = soldier.getRules().getStatCaps();
    const healthLoss = this._stats.health - this._health;

    soldier.setWoundRecovery(RNG.generate(healthLoss * 0.5, healthLoss * 1.5));

    if (this._expBravery && stats.bravery < caps.bravery) {
      if (this._expBravery > RNG.generate(0, 10)) {
        stats.bravery += 10;
      }
    }
    if (this._expReactions && stats.reactions < caps.reactions) {
      stats.reactions += this.improveStat(this._expReactions);
    }
    if (this._expFiring && stats.firing < caps.firing) {
      stats.firing += this.improveStat(this._expFiring);
    }
    if (this._expMelee && stats.melee < caps.melee) {
      stats.melee += this.improveStat(this._expMelee);
    }
    if (this._expThrowing && stats.throwing < caps.throwing) {
      stats.throwing += this.improveStat(this._expThrowing);
    }
    if (this._expPsiSkill && stats.psiSkill < caps.psiSkill) {
      stats.psiSkill += this.improveStat(this._expPsiSkill);
    }
    if (this._expPsiStrength && stats.psiStrength < caps.psiStrength) {
      stats.psiStrength += this.improveStat(this._expPsiStrength);
    }

    let hasImproved = false;
    if (this._expBravery || this._expReactions || this._expFiring || this._expPsiSkill || this._expPsiStrength || this._expMelee) {
      hasImproved = true;
      if (soldier.getRank() === SoldierRank.RANK_ROOKIE) {
        soldier.promoteRank();
      }

      let v = caps.tu - stats.tu;
      if (v > 0) {
        stats.tu += RNG.generate(0, Math.trunc(v / 10) + 2);
      }
      v = caps.health - stats.health;
      if (v > 0) {
        stats.health += RNG.generate(0, Math.trunc(v / 10) + 2);
      }
      v = caps.strength - stats.strength;
      if (v > 0) {
        stats.strength += RNG.generate(0, Math.trunc(v / 10) + 2);
      }
      v = caps.stamina - stats.stamina;
      if (v > 0) {
        stats.stamina += RNG.generate(0, Math.trunc(v / 15) + 2);
      }
    }

    addStats(statsDiff, stats);

    return hasImproved;
  }

  private improveStat(exp: number): number {
    if (exp > 10) {
      return RNG.generate(2, 6);
    }
    if (exp > 5) {
      return RNG.generate(1, 4);
    }
    if (exp > 2) {
      return RNG.generate(1, 3);
    }
    if (exp > 0) {
      return RNG.generate(0, 1);
    }
    return 0;
  }

  moraleChange(change: number): void {
    if (!this.isFearable()) {
      return;
    }
    this._morale = Math.max(0, Math.min(100, this._morale + change));
  }

  getType(): string {
    return this._type;
  }

  setActiveHand(slot: string): void {
    this._activeHand = slot;
  }

  getActiveHand(): string {
    if (this.getItem(this._activeHand)) {
      return this._activeHand;
    }
    if (this.getItem("STR_LEFT_HAND")) {
      return "STR_LEFT_HAND";
    }
    return "STR_RIGHT_HAND";
  }

  convertToFaction(f: UnitFaction): void {
    this._faction = f;
  }

  kill(): void {
    this._health = 0;
  }

  instaKill(): void {
    this._health = 0;
    this._status = UnitStatus.STATUS_DEAD;
  }

  getAggroSound(): number {
    return this._aggroSound;
  }

  killedBy(): UnitFaction;
  killedBy(f: UnitFaction): void;
  killedBy(f?: UnitFaction): UnitFaction | void {
    if (f == null) {
      return this._killedBy;
    }
    this._killedBy = f;
  }

  setCharging(chargeTarget: BattleUnit | null): void {
    this._charging = chargeTarget;
  }

  getCharging(): BattleUnit | null {
    return this._charging;
  }

  getCarriedWeight(draggingItem: BattleItem | null = null): number {
    let weight = this._armor.getWeight();
    for (const item of this._inventory) {
      if (item === draggingItem) {
        continue;
      }
      weight += item.getRules().getWeight();
      const ammo = item.getAmmoItem();
      if (ammo && ammo !== item) {
        weight += ammo.getRules().getWeight();
      }
    }
    return Math.max(0, weight);
  }

  setTurnsSinceSpotted(turns: number): void {
    this._turnsSinceSpotted = turns;
  }

  getTurnsSinceSpotted(): number {
    return this._turnsSinceSpotted;
  }

  getUnitsSpottedThisTurn(): BattleUnit[] {
    return this._unitsSpottedThisTurn;
  }

  getOriginalFaction(): UnitFaction {
    return this._originalFaction;
  }

  invalidateCache(): void {
    this._cacheInvalid = true;
  }

  isCacheInvalid(): boolean {
    return this._cacheInvalid;
  }

  getRecolor(): Array<[number, number]> {
    return this._recolor;
  }

  setRankInt(rank: number): void {
    this._rankInt = rank;
  }

  getRankInt(): number {
    return this._rankInt;
  }

  deriveRank(): void {
    if (!this._geoscapeSoldier) {
      return;
    }
    switch (this._geoscapeSoldier.getRank()) {
      case SoldierRank.RANK_ROOKIE: this._rankInt = 0; break;
      case SoldierRank.RANK_SQUADDIE: this._rankInt = 1; break;
      case SoldierRank.RANK_SERGEANT: this._rankInt = 2; break;
      case SoldierRank.RANK_CAPTAIN: this._rankInt = 3; break;
      case SoldierRank.RANK_COLONEL: this._rankInt = 4; break;
      case SoldierRank.RANK_COMMANDER: this._rankInt = 5; break;
      default: this._rankInt = 0; break;
    }
  }

  checkViewSector(pos: PositionLike): boolean {
    const deltaX = pos.x - this._pos.x;
    const deltaY = this._pos.y - pos.y;
    switch (this._direction) {
      case 0: return deltaX + deltaY >= 0 && deltaY - deltaX >= 0;
      case 1: return deltaX >= 0 && deltaY >= 0;
      case 2: return deltaX + deltaY >= 0 && deltaY - deltaX <= 0;
      case 3: return deltaY <= 0 && deltaX >= 0;
      case 4: return deltaX + deltaY <= 0 && deltaY - deltaX <= 0;
      case 5: return deltaX <= 0 && deltaY <= 0;
      case 6: return deltaX + deltaY <= 0 && deltaY - deltaX >= 0;
      case 7: return deltaY >= 0 && deltaX <= 0;
      default: return false;
    }
  }

  adjustStats(adjustment: StatAdjustment): void {
    for (const key of Object.keys(this._stats) as Array<keyof UnitStats>) {
      this._stats[key] += Math.trunc(adjustment.statGrowth[key] * adjustment.growthMultiplier * this._stats[key] / 100);
    }
    this._stats.firing = Math.trunc(this._stats.firing * adjustment.aimAndArmorMultiplier);
    for (let i = 0; i < this._maxArmor.length; ++i) {
      this._maxArmor[i] = Math.trunc(this._maxArmor[i] * adjustment.aimAndArmorMultiplier);
    }
  }

  tookFireDamage(): boolean {
    return this._hitByFire;
  }

  toggleFireDamage(): void {
    this._hitByFire = !this._hitByFire;
  }

  isSelectable(faction: UnitFaction, checkReselect: boolean, checkInventory: boolean): boolean {
    return this._faction === faction && !this.isOut() && (!checkReselect || this.reselectAllowed()) && (!checkInventory || this.hasInventory());
  }

  dontReselect(): void {
    this._dontReselect = true;
  }

  allowReselect(): void {
    this._dontReselect = false;
  }

  reselectAllowed(): boolean {
    return !this._dontReselect;
  }

  hasInventory(): boolean {
    return this._armor.hasInventory();
  }

  getBreathFrame(): number {
    if (this._floorAbove) {
      return 0;
    }
    return this._breathFrame;
  }

  breathe(): void {
    if (this._breathFrame < 0 || this.isOut()) {
      this._breathing = false;
      return;
    }
    if (!this._breathing || this._status === UnitStatus.STATUS_WALKING) {
      this._breathing = this._status !== UnitStatus.STATUS_WALKING && RNG.generate(0, 99) < (105 - this._morale);
      this._breathFrame = 0;
    }
    if (this._breathing) {
      this._breathFrame++;
      if (this._breathFrame >= 17) {
        this._breathFrame = 0;
        this._breathing = false;
      }
    }
  }

  setFloorAbove(floor: boolean): void {
    this._floorAbove = floor;
  }

  getFloorAbove(): boolean {
    return this._floorAbove;
  }

  getMeleeWeapon(): BattleItem | null {
    let melee = this.getItem("STR_RIGHT_HAND");
    if (melee?.getRules().getBattleType() === BattleType.BT_MELEE) {
      return melee;
    }
    melee = this.getItem("STR_LEFT_HAND");
    if (melee?.getRules().getBattleType() === BattleType.BT_MELEE) {
      return melee;
    }
    return this.getSpecialWeapon(BattleType.BT_MELEE);
  }

  getMovementType(): MovementType {
    return this._movementType;
  }

  isHiding(): boolean {
    return this._hidingForTurn;
  }

  setHiding(hiding: boolean): void {
    this._hidingForTurn = hiding;
  }

  goToTimeOut(): void {
    this._status = UnitStatus.STATUS_IGNORE_ME;
  }

  setSpecialWeapon(save: SpecialWeaponSaveLike, mod: SpecialWeaponModLike): void {
    let i = 0;
    const createItem = (rule: RuleItem | null): void => {
      if (!rule || i >= BattleUnit.SPEC_WEAPON_MAX) {
        return;
      }
      const item = new BattleItem(rule, save.getCurrentItemId());
      item.setOwner(this);
      save.removeItem(item);
      this._specWeapon[i++] = item;
    };

    if (this.getUnitRules()) {
      createItem(mod.getItem(this.getUnitRules()!.getMeleeWeapon()));
    }
    createItem(mod.getItem(this.getArmor().getSpecialWeapon()));
    if (this.getBaseStats().psiSkill > 0 && this.getOriginalFaction() === UnitFaction.FACTION_HOSTILE && this.getUnitRules()) {
      createItem(mod.getItem(this.getUnitRules()!.getPsiWeapon()));
    }
  }

  prepareNewTurn(fullProcess = true): void {
    if (this._status === UnitStatus.STATUS_IGNORE_ME) {
      return;
    }

    this._unitsSpottedThisTurn.length = 0;
    if (this._faction !== this._originalFaction) {
      this._faction = this._originalFaction;
      if (this._faction === UnitFaction.FACTION_PLAYER && this._currentAIState) {
        this._currentAIState = null;
      }
    } else {
      this.recoverTimeUnits();
    }
    this._dontReselect = false;
    this._motionPoints = 0;

    if (!fullProcess) {
      if (this._kneeled) {
        this._kneeled = false;
      }
      return;
    }

    this._health -= this.getFatalWounds();
    if (!this._hitByFire && this._fire > 0) {
      this._health -= this._armor.getDamageModifier(ItemDamageType.DT_IN) * RNG.generate(5, 10);
      this._fire--;
    }
    if (this._health < 0) {
      this._health = 0;
    }
    if (this._health === 0 && this._currentAIState) {
      this._currentAIState = null;
    }
    if (this._stunlevel > 0 && (this._armor.getSize() === 1 || !this.isOut())) {
      this.healStun(1);
    }
    if (!this.isOut()) {
      const chance = 100 - (2 * this.getMorale());
      if (RNG.generate(1, 100) <= chance) {
        const type = RNG.generate(0, 100);
        this._status = type <= 33 ? UnitStatus.STATUS_BERSERK : UnitStatus.STATUS_PANICKING;
      } else if (chance > 1) {
        this._expBravery++;
      }
    }
    this._hitByFire = false;
  }

  getSpecialWeapon(type: BattleType): BattleItem | null {
    for (const weapon of this._specWeapon) {
      if (weapon?.getRules().getBattleType() === type) {
        return weapon;
      }
    }
    return null;
  }

  recoverTimeUnits(): void {
    let TURecovery = this.getBaseStats().tu;
    const carriedWeight = this.getCarriedWeight();
    const encumbrance = carriedWeight > 0 ? this.getBaseStats().strength / carriedWeight : 1;
    if (encumbrance < 1) {
      TURecovery = Math.trunc(encumbrance * TURecovery);
    }
    TURecovery -= Math.trunc(TURecovery * ((this._fatalWounds[UnitBodyPart.BODYPART_LEFTLEG] + this._fatalWounds[UnitBodyPart.BODYPART_RIGHTLEG]) * 10) / 100);
    this.setTimeUnits(TURecovery);

    if (!this.isOut()) {
      let ENRecovery = this._geoscapeSoldier ? Math.trunc(this._geoscapeSoldier.getInitStats().tu / 3) : (this._unitRules?.getEnergyRecovery() || 0);
      ENRecovery -= Math.trunc(this._energy * (this._fatalWounds[UnitBodyPart.BODYPART_TORSO] * 10) / 100);
      this._energy = Math.max(0, Math.min(this.getBaseStats().stamina, this._energy + ENRecovery));
    }
  }

  getStatistics(): BattleUnitStatistics {
    return this._statistics;
  }

  setMurdererId(id: number): void {
    this._murdererId = id;
  }

  getMurdererId(): number {
    return this._murdererId;
  }

  setFatalShotInfo(side: UnitSide, bodypart: UnitBodyPart): void {
    this._fatalShotSide = side;
    this._fatalShotBodyPart = bodypart;
  }

  getFatalShotSide(): UnitSide {
    return this._fatalShotSide;
  }

  getFatalShotBodyPart(): UnitBodyPart {
    return this._fatalShotBodyPart;
  }

  getMurdererWeapon(): string {
    return this._murdererWeapon;
  }

  setMurdererWeapon(weapon: string): void {
    this._murdererWeapon = weapon;
  }

  getMurdererWeaponAmmo(): string {
    return this._murdererWeaponAmmo;
  }

  setMurdererWeaponAmmo(weaponAmmo: string): void {
    this._murdererWeaponAmmo = weaponAmmo;
  }

  setMindControllerId(id: number): void {
    this._mindControllerID = id;
  }

  getMindControllerId(): number {
    return this._mindControllerID;
  }

  getFiringXP(): number {
    return this._expFiring;
  }

  nerfFiringXP(newXP: number): void {
    this._expFiring = newXP;
  }

  getHitState(): boolean {
    return this._hitByAnything;
  }

  resetHitState(): void {
    this._hitByAnything = false;
  }

  getCapturable(): boolean {
    return this._capturable;
  }

  getUnitRules(): Unit | null {
    return this._unitRules;
  }

  think(action: BattleAction): void {
    this.checkAmmo();
    this._currentAIState?.think?.(action);
  }

  getAIModule(): AIModuleLike | null {
    return this._currentAIState;
  }

  setAIModule(ai: AIModuleLike | null): void {
    this._currentAIState = ai;
  }

  knockOut(battle?: { convertUnit?: (unit: BattleUnit) => BattleUnit }): void {
    if (this._spawnUnit && battle?.convertUnit) {
      this.setRespawn(false);
      battle.convertUnit(this).knockOut(battle);
      return;
    }
    this._stunlevel = this._health;
  }

  startFalling(): void {
    this._status = UnitStatus.STATUS_COLLAPSING;
    this._fallPhase = 0;
    this._cacheInvalid = true;
  }

  keepFalling(): void {
    this._fallPhase++;
    if (this._fallPhase >= this._armor.getDeathFrames()) {
      this._fallPhase = this._armor.getDeathFrames() - 1;
      this._status = this._health === 0 ? UnitStatus.STATUS_DEAD : UnitStatus.STATUS_UNCONSCIOUS;
    }
    this._cacheInvalid = true;
  }

  freePatrolTarget(): void {
    this._currentAIState?.freePatrolTarget?.();
  }
}
