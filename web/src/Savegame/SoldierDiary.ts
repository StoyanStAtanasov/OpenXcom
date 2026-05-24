import type { Language } from "../Engine/Language.ts";
import type { BattleUnit, BattleUnitKill, BattleUnitStatistics } from "./BattleUnit.ts";
import type { MissionStatistics } from "./MissionStatistics.ts";
import { BattleType } from "../Mod/RuleItem.ts";

enum UnitStatus {
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

enum UnitFaction {
  FACTION_PLAYER = 0,
  FACTION_HOSTILE,
  FACTION_NEUTRAL
}

enum UnitSide {
  SIDE_FRONT = 0,
  SIDE_LEFT,
  SIDE_RIGHT,
  SIDE_REAR,
  SIDE_UNDER
}

enum UnitBodyPart {
  BODYPART_HEAD = 0,
  BODYPART_TORSO,
  BODYPART_RIGHTARM,
  BODYPART_LEFTARM,
  BODYPART_RIGHTLEG,
  BODYPART_LEFTLEG
}

export type SoldierCommendationSave = {
  commendationName?: string;
  noun?: string;
  decorationLevel?: number;
  isNew?: boolean;
};

export type BattleUnitKillsSave = {
  name?: string;
  type?: string;
  rank?: string;
  race?: string;
  weapon?: string;
  weaponAmmo?: string;
  faction?: number;
  status?: number;
  mission?: number;
  turn?: number;
  id?: number;
  side?: number;
  bodypart?: number;
};

export type SoldierDiarySave = {
  commendations?: SoldierCommendationSave[];
  killList?: BattleUnitKillsSave[];
  missionIdList?: number[];
  daysWoundedTotal?: number;
  totalShotByFriendlyCounter?: number;
  totalShotFriendlyCounter?: number;
  loneSurvivorTotal?: number;
  monthsService?: number;
  unconciousTotal?: number;
  shotAtCounterTotal?: number;
  hitCounterTotal?: number;
  ironManTotal?: number;
  longDistanceHitCounterTotal?: number;
  lowAccuracyHitCounterTotal?: number;
  shotsFiredCounterTotal?: number;
  shotsLandedCounterTotal?: number;
  shotAtCounter10in1Mission?: number;
  hitCounter5in1Mission?: number;
  timesWoundedTotal?: number;
  allAliensKilledTotal?: number;
  allAliensStunnedTotal?: number;
  woundsHealedTotal?: number;
  allUFOs?: number;
  allMissionTypes?: number;
  statGainTotal?: number;
  revivedUnitTotal?: number;
  revivedSoldierTotal?: number;
  revivedHostileTotal?: number;
  revivedNeutralTotal?: number;
  wholeMedikitTotal?: number;
  braveryGainTotal?: number;
  bestOfRank?: number;
  bestSoldier?: number | boolean;
  martyrKillsTotal?: number;
  postMortemKills?: number;
  globeTrotter?: boolean;
  slaveKillsTotal?: number;
};

export type KillCriteriaList = Array<Array<[number, string[]]>>;

export type RuleCommendationsLike = {
  getCriteria?: () => Map<string, number[]> | Record<string, number[]> | Array<[string, number[]]>;
  getKillCriteria?: () => KillCriteriaList | null;
  getDescription?: () => string;
  getSprite?: () => number;
};

export type SoldierDiaryModLike = {
  getCommendationsList?: () => Map<string, RuleCommendationsLike> | Record<string, RuleCommendationsLike>;
  getCommendation?: (type: string) => RuleCommendationsLike | null;
  getItem?: (type: string) => RuleItemLike | null;
  getUfosList?: () => string[];
  getDeploymentsList?: () => string[];
  getCountriesList?: () => string[];
};

type RuleItemLike = {
  getBattleType?: () => number;
  getDamageType?: () => number;
};

type UnitRulesLike = {
  getRank?: () => string;
  getRace?: () => string;
};

function intValue(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.trunc(value) : fallback;
}

function boolAsInt(value: unknown, fallback: number): number {
  if (typeof value === "boolean") {
    return value ? 1 : 0;
  }
  return intValue(value, fallback);
}

function stringValue(value: unknown, fallback: string): string {
  return typeof value === "string" ? value : fallback;
}

function boolValue(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function increment(map: Map<string, number>, key: string): void {
  map.set(key, (map.get(key) || 0) + 1);
}

function sortedMap(map: Map<string, number>): Map<string, number> {
  return new Map([...map.entries()].sort((a, b) => a[0].localeCompare(b[0])));
}

function entriesOf<T>(source: Map<string, T> | Record<string, T> | Array<[string, T]> | null | undefined): Array<[string, T]> {
  if (!source) {
    return [];
  }
  if (source instanceof Map) {
    return [...source.entries()];
  }
  if (Array.isArray(source)) {
    return source;
  }
  return Object.entries(source);
}

/**
 * Each entry will be its own commendation.
 */
export class SoldierCommendations {
  private _type = "";
  private _noun = "noNoun";
  private _decorationLevel = 0;
  private _isNew = false;

  constructor(node: SoldierCommendationSave);
  constructor(commendationName: string, noun?: string);
  constructor(nodeOrName: SoldierCommendationSave | string, noun = "noNoun") {
    if (typeof nodeOrName === "string") {
      this._type = nodeOrName;
      this._noun = noun;
      this._decorationLevel = 0;
      this._isNew = true;
    } else {
      this.load(nodeOrName);
    }
  }

  load(node: SoldierCommendationSave): void {
    this._type = stringValue(node.commendationName, this._type);
    this._noun = stringValue(node.noun, "noNoun");
    this._decorationLevel = intValue(node.decorationLevel, this._decorationLevel);
    this._isNew = boolValue(node.isNew, false);
  }

  save(): SoldierCommendationSave {
    const node: SoldierCommendationSave = {
      commendationName: this._type,
      decorationLevel: this._decorationLevel
    };
    if (this._noun !== "noNoun") {
      node.noun = this._noun;
    }
    return node;
  }

  getType(): string {
    return this._type;
  }

  getNoun(): string {
    return this._noun;
  }

  getDecorationLevelName(skipCounter: number): string {
    return `STR_AWARD_${this._decorationLevel - skipCounter}`;
  }

  getDecorationDescription(): string {
    return `STR_AWARD_DECOR_${this._decorationLevel}`;
  }

  getDecorationLevelInt(): number {
    return this._decorationLevel;
  }

  isNew(): boolean {
    return this._isNew;
  }

  makeOld(): void {
    this._isNew = false;
  }

  addDecoration(): void {
    this._decorationLevel++;
    this._isNew = true;
  }
}

/**
 * Container for battle unit kills statistics.
 */
export class BattleUnitKills {
  name = "";
  type = "";
  rank = "";
  race = "";
  weapon = "";
  weaponAmmo = "";
  faction = UnitFaction.FACTION_HOSTILE;
  status = UnitStatus.STATUS_IGNORE_ME;
  mission = 0;
  turn = 0;
  id = 0;
  side = UnitSide.SIDE_FRONT;
  bodypart = UnitBodyPart.BODYPART_HEAD;

  constructor(node?: BattleUnitKillsSave | BattleUnitKill) {
    if (node) {
      this.load(node);
    }
  }

  makeTurnUnique(): number {
    this.turn += this.mission * 300;
    return this.turn;
  }

  hostileTurn(): boolean {
    return (this.turn - 1) % 3 === 0;
  }

  setTurn(unitTurn: number, unitFaction: UnitFaction): void {
    this.turn = unitTurn * 3 + unitFaction;
  }

  load(node: BattleUnitKillsSave | BattleUnitKill): void {
    this.name = stringValue(node.name, this.name);
    this.type = stringValue(node.type, this.type);
    this.rank = stringValue(node.rank, this.rank);
    this.race = stringValue(node.race, this.race);
    this.weapon = stringValue(node.weapon, this.weapon);
    this.weaponAmmo = stringValue(node.weaponAmmo, this.weaponAmmo);
    this.status = intValue(node.status, this.status) as UnitStatus;
    this.faction = intValue(node.faction, this.faction) as UnitFaction;
    this.mission = intValue(node.mission, this.mission);
    this.turn = intValue(node.turn, this.turn);
    this.side = intValue(node.side, this.side) as UnitSide;
    this.bodypart = intValue(node.bodypart, this.bodypart) as UnitBodyPart;
    this.id = intValue(node.id, this.id);
  }

  save(): BattleUnitKillsSave {
    const node: BattleUnitKillsSave = {
      rank: this.rank,
      race: this.race,
      weapon: this.weapon,
      weaponAmmo: this.weaponAmmo,
      status: this.status,
      faction: this.faction,
      mission: this.mission,
      turn: this.turn,
      side: this.side,
      bodypart: this.bodypart,
      id: this.id
    };
    if (this.name) {
      node.name = this.name;
    }
    if (this.type) {
      node.type = this.type;
    }
    return node;
  }

  getKillStatusString(): string {
    switch (this.status) {
      case UnitStatus.STATUS_DEAD: return "STR_KILLED";
      case UnitStatus.STATUS_UNCONSCIOUS: return "STR_STUNNED";
      case UnitStatus.STATUS_PANICKING: return "STR_PANICKED";
      case UnitStatus.STATUS_TURNING: return "STR_MINDCONTROLLED";
      default: return "status error";
    }
  }

  getUnitStatusString(): string {
    switch (this.status) {
      case UnitStatus.STATUS_DEAD: return "STATUS_DEAD";
      case UnitStatus.STATUS_UNCONSCIOUS: return "STATUS_UNCONSCIOUS";
      case UnitStatus.STATUS_PANICKING: return "STATUS_PANICKING";
      case UnitStatus.STATUS_TURNING: return "STATUS_TURNING";
      default: return "status error";
    }
  }

  getUnitFactionString(): string {
    switch (this.faction) {
      case UnitFaction.FACTION_PLAYER: return "FACTION_PLAYER";
      case UnitFaction.FACTION_HOSTILE: return "FACTION_HOSTILE";
      case UnitFaction.FACTION_NEUTRAL: return "FACTION_NEUTRAL";
      default: return "faction error";
    }
  }

  getUnitSideString(): string {
    switch (this.side) {
      case UnitSide.SIDE_FRONT: return "SIDE_FRONT";
      case UnitSide.SIDE_LEFT: return "SIDE_LEFT";
      case UnitSide.SIDE_RIGHT: return "SIDE_RIGHT";
      case UnitSide.SIDE_REAR: return "SIDE_REAR";
      case UnitSide.SIDE_UNDER: return "SIDE_UNDER";
      default: return "side error";
    }
  }

  getUnitBodyPartString(): string {
    switch (this.bodypart) {
      case UnitBodyPart.BODYPART_HEAD: return "BODYPART_HEAD";
      case UnitBodyPart.BODYPART_TORSO: return "BODYPART_TORSO";
      case UnitBodyPart.BODYPART_RIGHTARM: return "BODYPART_RIGHTARM";
      case UnitBodyPart.BODYPART_LEFTARM: return "BODYPART_LEFTARM";
      case UnitBodyPart.BODYPART_RIGHTLEG: return "BODYPART_RIGHTLEG";
      case UnitBodyPart.BODYPART_LEFTLEG: return "BODYPART_LEFTLEG";
      default: return "body part error";
    }
  }

  getUnitName(lang: Language): string {
    if (this.name) {
      return this.name;
    }
    if (this.type) {
      return String(lang.getString(this.type));
    }
    return `${String(lang.getString(this.race))} ${String(lang.getString(this.rank))}`;
  }

  setUnitStats(unit: BattleUnit): void {
    this.name = "";
    this.type = "";
    const geoscapeSoldier = unit.getGeoscapeSoldier();
    const unitRules = unit.getUnitRules() as UnitRulesLike | null;
    if (geoscapeSoldier) {
      this.name = geoscapeSoldier.getName();
    } else {
      this.type = unit.getType();
    }

    if (unit.getOriginalFaction() === UnitFaction.FACTION_PLAYER) {
      if (geoscapeSoldier) {
        this.rank = geoscapeSoldier.getRankString() || "STR_SOLDIER";
        this.race = unitRules?.getRace?.() || "STR_FRIENDLY";
      } else {
        this.rank = unitRules?.getRank?.() || "STR_HWPS";
        this.race = unitRules?.getRace?.() || "STR_FRIENDLY";
      }
    } else if (unit.getOriginalFaction() === UnitFaction.FACTION_HOSTILE) {
      this.rank = unitRules?.getRank?.() || "STR_LIVE_SOLDIER";
      this.race = unitRules?.getRace?.() || "STR_HOSTILE";
    } else if (unit.getOriginalFaction() === UnitFaction.FACTION_NEUTRAL) {
      this.rank = unitRules?.getRank?.() || "STR_CIVILIAN";
      this.race = unitRules?.getRace?.() || "STR_NEUTRAL";
    } else {
      this.rank = "STR_UNKNOWN";
      this.race = "STR_UNKNOWN";
    }
  }
}

export class SoldierDiary {
  private _commendations: SoldierCommendations[] = [];
  private _killList: BattleUnitKills[] = [];
  private _missionIdList: number[] = [];
  private _daysWoundedTotal = 0;
  private _totalShotByFriendlyCounter = 0;
  private _totalShotFriendlyCounter = 0;
  private _loneSurvivorTotal = 0;
  private _monthsService = 0;
  private _unconciousTotal = 0;
  private _shotAtCounterTotal = 0;
  private _hitCounterTotal = 0;
  private _ironManTotal = 0;
  private _longDistanceHitCounterTotal = 0;
  private _lowAccuracyHitCounterTotal = 0;
  private _shotsFiredCounterTotal = 0;
  private _shotsLandedCounterTotal = 0;
  private _shotAtCounter10in1Mission = 0;
  private _hitCounter5in1Mission = 0;
  private _timesWoundedTotal = 0;
  private _KIA = 0;
  private _allAliensKilledTotal = 0;
  private _allAliensStunnedTotal = 0;
  private _woundsHealedTotal = 0;
  private _allUFOs = 0;
  private _allMissionTypes = 0;
  private _statGainTotal = 0;
  private _revivedUnitTotal = 0;
  private _wholeMedikitTotal = 0;
  private _braveryGainTotal = 0;
  private _bestOfRank = 0;
  private _MIA = 0;
  private _martyrKillsTotal = 0;
  private _postMortemKills = 0;
  private _slaveKillsTotal = 0;
  private _bestSoldier = 0;
  private _revivedSoldierTotal = 0;
  private _revivedHostileTotal = 0;
  private _revivedNeutralTotal = 0;
  private _globeTrotter = false;

  load(node: SoldierDiarySave, mod?: SoldierDiaryModLike | null): void {
    if (node.commendations) {
      for (const entry of node.commendations) {
        const commendation = new SoldierCommendations(entry);
        if (!mod?.getCommendation || mod.getCommendation(commendation.getType())) {
          this._commendations.push(commendation);
        }
      }
    }
    if (node.killList) {
      for (const entry of node.killList) {
        this._killList.push(new BattleUnitKills(entry));
      }
    }
    this._missionIdList = [...(node.missionIdList || this._missionIdList)].map(value => Math.trunc(value));
    this._daysWoundedTotal = intValue(node.daysWoundedTotal, this._daysWoundedTotal);
    this._totalShotByFriendlyCounter = intValue(node.totalShotByFriendlyCounter, this._totalShotByFriendlyCounter);
    this._totalShotFriendlyCounter = intValue(node.totalShotFriendlyCounter, this._totalShotFriendlyCounter);
    this._loneSurvivorTotal = intValue(node.loneSurvivorTotal, this._loneSurvivorTotal);
    this._monthsService = intValue(node.monthsService, this._monthsService);
    this._unconciousTotal = intValue(node.unconciousTotal, this._unconciousTotal);
    this._shotAtCounterTotal = intValue(node.shotAtCounterTotal, this._shotAtCounterTotal);
    this._hitCounterTotal = intValue(node.hitCounterTotal, this._hitCounterTotal);
    this._ironManTotal = intValue(node.ironManTotal, this._ironManTotal);
    this._longDistanceHitCounterTotal = intValue(node.longDistanceHitCounterTotal, this._longDistanceHitCounterTotal);
    this._lowAccuracyHitCounterTotal = intValue(node.lowAccuracyHitCounterTotal, this._lowAccuracyHitCounterTotal);
    this._shotsFiredCounterTotal = intValue(node.shotsFiredCounterTotal, this._shotsFiredCounterTotal);
    this._shotsLandedCounterTotal = intValue(node.shotsLandedCounterTotal, this._shotsLandedCounterTotal);
    this._shotAtCounter10in1Mission = intValue(node.shotAtCounter10in1Mission, this._shotAtCounter10in1Mission);
    this._hitCounter5in1Mission = intValue(node.hitCounter5in1Mission, this._hitCounter5in1Mission);
    this._timesWoundedTotal = intValue(node.timesWoundedTotal, this._timesWoundedTotal);
    this._allAliensKilledTotal = intValue(node.allAliensKilledTotal, this._allAliensKilledTotal);
    this._allAliensStunnedTotal = intValue(node.allAliensStunnedTotal, this._allAliensStunnedTotal);
    this._woundsHealedTotal = intValue(node.woundsHealedTotal, this._woundsHealedTotal);
    this._allUFOs = intValue(node.allUFOs, this._allUFOs);
    this._allMissionTypes = intValue(node.allMissionTypes, this._allMissionTypes);
    this._statGainTotal = intValue(node.statGainTotal, this._statGainTotal);
    this._revivedUnitTotal = intValue(node.revivedUnitTotal, this._revivedUnitTotal);
    this._revivedSoldierTotal = intValue(node.revivedSoldierTotal, this._revivedSoldierTotal);
    this._revivedHostileTotal = intValue(node.revivedHostileTotal, this._revivedHostileTotal);
    this._revivedNeutralTotal = intValue(node.revivedNeutralTotal, this._revivedNeutralTotal);
    this._wholeMedikitTotal = intValue(node.wholeMedikitTotal, this._wholeMedikitTotal);
    this._braveryGainTotal = intValue(node.braveryGainTotal, this._braveryGainTotal);
    this._bestOfRank = intValue(node.bestOfRank, this._bestOfRank);
    this._bestSoldier = boolAsInt(node.bestSoldier, this._bestSoldier);
    this._martyrKillsTotal = intValue(node.martyrKillsTotal, this._martyrKillsTotal);
    this._postMortemKills = intValue(node.postMortemKills, this._postMortemKills);
    this._globeTrotter = boolValue(node.globeTrotter, this._globeTrotter);
    this._slaveKillsTotal = intValue(node.slaveKillsTotal, this._slaveKillsTotal);
  }

  save(): SoldierDiarySave {
    const node: SoldierDiarySave = {};
    if (this._commendations.length) node.commendations = this._commendations.map(commendation => commendation.save());
    if (this._killList.length) node.killList = this._killList.map(kill => kill.save());
    if (this._missionIdList.length) node.missionIdList = [...this._missionIdList];
    if (this._daysWoundedTotal) node.daysWoundedTotal = this._daysWoundedTotal;
    if (this._totalShotByFriendlyCounter) node.totalShotByFriendlyCounter = this._totalShotByFriendlyCounter;
    if (this._totalShotFriendlyCounter) node.totalShotFriendlyCounter = this._totalShotFriendlyCounter;
    if (this._loneSurvivorTotal) node.loneSurvivorTotal = this._loneSurvivorTotal;
    if (this._monthsService) node.monthsService = this._monthsService;
    if (this._unconciousTotal) node.unconciousTotal = this._unconciousTotal;
    if (this._shotAtCounterTotal) node.shotAtCounterTotal = this._shotAtCounterTotal;
    if (this._hitCounterTotal) node.hitCounterTotal = this._hitCounterTotal;
    if (this._ironManTotal) node.ironManTotal = this._ironManTotal;
    if (this._longDistanceHitCounterTotal) node.longDistanceHitCounterTotal = this._longDistanceHitCounterTotal;
    if (this._lowAccuracyHitCounterTotal) node.lowAccuracyHitCounterTotal = this._lowAccuracyHitCounterTotal;
    if (this._shotsFiredCounterTotal) node.shotsFiredCounterTotal = this._shotsFiredCounterTotal;
    if (this._shotsLandedCounterTotal) node.shotsLandedCounterTotal = this._shotsLandedCounterTotal;
    if (this._shotAtCounter10in1Mission) node.shotAtCounter10in1Mission = this._shotAtCounter10in1Mission;
    if (this._hitCounter5in1Mission) node.hitCounter5in1Mission = this._hitCounter5in1Mission;
    if (this._timesWoundedTotal) node.timesWoundedTotal = this._timesWoundedTotal;
    if (this._allAliensKilledTotal) node.allAliensKilledTotal = this._allAliensKilledTotal;
    if (this._allAliensStunnedTotal) node.allAliensStunnedTotal = this._allAliensStunnedTotal;
    if (this._woundsHealedTotal) node.woundsHealedTotal = this._woundsHealedTotal;
    if (this._allUFOs) node.allUFOs = this._allUFOs;
    if (this._allMissionTypes) node.allMissionTypes = this._allMissionTypes;
    if (this._statGainTotal) node.statGainTotal = this._statGainTotal;
    if (this._revivedUnitTotal) node.revivedUnitTotal = this._revivedUnitTotal;
    if (this._revivedSoldierTotal) node.revivedSoldierTotal = this._revivedSoldierTotal;
    if (this._revivedHostileTotal) node.revivedHostileTotal = this._revivedHostileTotal;
    if (this._revivedNeutralTotal) node.revivedNeutralTotal = this._revivedNeutralTotal;
    if (this._wholeMedikitTotal) node.wholeMedikitTotal = this._wholeMedikitTotal;
    if (this._braveryGainTotal) node.braveryGainTotal = this._braveryGainTotal;
    if (this._bestOfRank) node.bestOfRank = this._bestOfRank;
    if (this._bestSoldier) node.bestSoldier = this._bestSoldier;
    if (this._martyrKillsTotal) node.martyrKillsTotal = this._martyrKillsTotal;
    if (this._postMortemKills) node.postMortemKills = this._postMortemKills;
    if (this._globeTrotter) node.globeTrotter = this._globeTrotter;
    if (this._slaveKillsTotal) node.slaveKillsTotal = this._slaveKillsTotal;
    return node;
  }

  updateDiary(unitStatistics: BattleUnitStatistics, allMissionStatistics: MissionStatistics[], rules: SoldierDiaryModLike): void {
    if (allMissionStatistics.length === 0) {
      return;
    }
    const missionStatistics = allMissionStatistics[allMissionStatistics.length - 1];
    for (const unitKill of unitStatistics.kills) {
      const kill = new BattleUnitKills(unitKill);
      kill.makeTurnUnique();
      this._killList.push(kill);
    }
    unitStatistics.kills.length = 0;

    if (missionStatistics.success) {
      if (unitStatistics.loneSurvivor) this._loneSurvivorTotal++;
      if (unitStatistics.ironMan) this._ironManTotal++;
      if (unitStatistics.nikeCross) this._allAliensKilledTotal++;
      if (unitStatistics.mercyCross) this._allAliensStunnedTotal++;
    }
    this._daysWoundedTotal += unitStatistics.daysWounded;
    if (unitStatistics.daysWounded) this._timesWoundedTotal++;

    if (unitStatistics.wasUnconcious) this._unconciousTotal++;
    this._shotAtCounterTotal += unitStatistics.shotAtCounter;
    this._shotAtCounter10in1Mission += Math.trunc(unitStatistics.shotAtCounter / 10);
    this._hitCounterTotal += unitStatistics.hitCounter;
    this._hitCounter5in1Mission += Math.trunc(unitStatistics.hitCounter / 5);
    this._totalShotByFriendlyCounter += unitStatistics.shotByFriendlyCounter;
    this._totalShotFriendlyCounter += unitStatistics.shotFriendlyCounter;
    this._longDistanceHitCounterTotal += unitStatistics.longDistanceHitCounter;
    this._lowAccuracyHitCounterTotal += unitStatistics.lowAccuracyHitCounter;
    this._shotsFiredCounterTotal += unitStatistics.shotsFiredCounter;
    this._shotsLandedCounterTotal += unitStatistics.shotsLandedCounter;
    if (unitStatistics.KIA) this._KIA++;
    if (unitStatistics.MIA) this._MIA++;
    this._woundsHealedTotal += unitStatistics.woundsHealed;
    if (rules.getUfosList && this.getUFOTotal(allMissionStatistics).size >= rules.getUfosList().length) {
      this._allUFOs = 1;
    }
    if (rules.getUfosList && rules.getDeploymentsList &&
      this.getUFOTotal(allMissionStatistics).size + this.getTypeTotal(allMissionStatistics).size === rules.getUfosList().length + rules.getDeploymentsList().length - 2) {
      this._allMissionTypes = 1;
    }
    if (rules.getCountriesList && this.getCountryTotal(allMissionStatistics).size === rules.getCountriesList().length) {
      this._globeTrotter = true;
    }
    this._martyrKillsTotal += unitStatistics.martyr;
    this._slaveKillsTotal += unitStatistics.slaveKills;

    this._statGainTotal = 0;
    this._statGainTotal += unitStatistics.delta.tu;
    this._statGainTotal += unitStatistics.delta.stamina;
    this._statGainTotal += unitStatistics.delta.health;
    this._statGainTotal += Math.trunc(unitStatistics.delta.bravery / 10);
    this._statGainTotal += unitStatistics.delta.reactions;
    this._statGainTotal += unitStatistics.delta.firing;
    this._statGainTotal += unitStatistics.delta.throwing;
    this._statGainTotal += unitStatistics.delta.strength;
    this._statGainTotal += unitStatistics.delta.psiStrength;
    this._statGainTotal += unitStatistics.delta.melee;
    this._statGainTotal += unitStatistics.delta.psiSkill;

    this._braveryGainTotal = unitStatistics.delta.bravery;
    this._revivedUnitTotal += unitStatistics.revivedSoldier + unitStatistics.revivedHostile + unitStatistics.revivedNeutral;
    this._revivedSoldierTotal += unitStatistics.revivedSoldier;
    this._revivedNeutralTotal += unitStatistics.revivedNeutral;
    this._revivedHostileTotal += unitStatistics.revivedHostile;
    this._wholeMedikitTotal += Math.min(unitStatistics.woundsHealed, unitStatistics.appliedStimulant, unitStatistics.appliedPainKill);
    this._missionIdList.push(missionStatistics.id);
  }

  getSoldierCommendations(): SoldierCommendations[] {
    return this._commendations;
  }

  manageCommendations(mod: SoldierDiaryModLike, missionStatistics: MissionStatistics[]): boolean {
    const battleTypeArray = ["BT_NONE", "BT_FIREARM", "BT_AMMO", "BT_MELEE", "BT_GRENADE", "BT_PROXIMITYGRENADE", "BT_MEDIKIT", "BT_SCANNER", "BT_MINDPROBE", "BT_PSIAMP", "BT_FLARE", "BT_CORPSE", "BT_END"];
    const damageTypeArray = ["DT_NONE", "DT_AP", "DT_IN", "DT_HE", "DT_LASER", "DT_PLASMA", "DT_STUN", "DT_MELEE", "DT_ACID", "DT_SMOKE", "DT_END"];
    const commendationsList = entriesOf(mod.getCommendationsList?.());
    let awardedCommendation = false;
    let i = 0;

    while (i < commendationsList.length) {
      const [commendationName, commendationRule] = commendationsList[i];
      let awardCommendationBool = true;
      const nextCommendationLevel = new Map<string, number>([["noNoun", 0]]);
      const modularCommendations: string[] = [];

      for (const commendation of this._commendations) {
        if (commendationName === commendation.getType()) {
          nextCommendationLevel.set(commendation.getNoun(), commendation.getDecorationLevelInt() + 1);
        }
      }

      criteriaLoop:
      for (const [criteriaName, criteriaValues] of entriesOf(commendationRule.getCriteria?.())) {
        const nextNoNounLevel = nextCommendationLevel.get("noNoun") || 0;
        if (nextNoNounLevel >= criteriaValues.length) {
          awardCommendationBool = false;
          break;
        }
        const criterion = criteriaValues[nextNoNounLevel];

        if (this.noNounCriteriaFailed(criteriaName, criterion, missionStatistics, mod)) {
          awardCommendationBool = false;
          break;
        } else if (criteriaName === "totalKillsWithAWeapon" || criteriaName === "totalMissionsInARegion" || criteriaName === "totalKillsByRace" || criteriaName === "totalKillsByRank") {
          const tempTotal = criteriaName === "totalKillsWithAWeapon"
            ? this.getWeaponTotal()
            : criteriaName === "totalMissionsInARegion"
              ? this.getRegionTotal(missionStatistics)
              : criteriaName === "totalKillsByRace"
                ? this.getAlienRaceTotal()
                : this.getAlienRankTotal();
          for (const [noun, total] of tempTotal) {
            let criteria = -1;
            const nextLevel = nextCommendationLevel.get(noun);
            if (nextLevel == null) {
              criteria = criteriaValues[0];
            } else if (nextLevel !== criteriaValues.length) {
              criteria = criteriaValues[nextLevel];
            }
            if (criteria !== -1 && total >= criteria) {
              modularCommendations.push(noun);
            }
          }
          if (modularCommendations.length === 0) {
            awardCommendationBool = false;
            break;
          }
        } else if (criteriaName === "killsWithCriteriaCareer" || criteriaName === "killsWithCriteriaMission" || criteriaName === "killsWithCriteriaTurn") {
          const killCriteriaList = commendationRule.getKillCriteria?.();
          if (!killCriteriaList) {
            break criteriaLoop;
          }
          let enoughForNextCommendation = false;
          let totalKillGroups = 0;

          for (const orCriteria of killCriteriaList) {
            const referenceBlockCounters = orCriteria.map(andCriteria => andCriteria[0]);
            const referenceTotalCounters = referenceBlockCounters.reduce((total, count) => total + count, 0);
            let currentBlockCounters = criteriaName === "killsWithCriteriaCareer" ? [...referenceBlockCounters] : [];
            let currentTotalCounters = referenceTotalCounters;
            let lastTimeSpan = -1;
            let skipThisTimeSpan = false;

            for (const singleKill of this._killList) {
              let thisTimeSpan = -1;
              if (criteriaName === "killsWithCriteriaMission") {
                thisTimeSpan = singleKill.mission;
              } else if (criteriaName === "killsWithCriteriaTurn") {
                thisTimeSpan = singleKill.turn;
              }
              if (thisTimeSpan !== lastTimeSpan) {
                lastTimeSpan = thisTimeSpan;
                skipThisTimeSpan = false;
                currentBlockCounters = [...referenceBlockCounters];
                currentTotalCounters = referenceTotalCounters;
              } else if (skipThisTimeSpan) {
                continue;
              }

              let andCriteriaMet = false;
              for (let index = 0; index < orCriteria.length; ++index) {
                const [, details] = orCriteria[index];
                let foundMatch = true;

                for (const detail of details) {
                  const battleType = battleTypeArray.indexOf(detail) === -1 ? battleTypeArray.length : battleTypeArray.indexOf(detail);
                  const damageType = damageTypeArray.indexOf(detail) === -1 ? damageTypeArray.length : damageTypeArray.indexOf(detail);
                  const weapon = mod.getItem?.(singleKill.weapon) || null;
                  const weaponAmmo = mod.getItem?.(singleKill.weaponAmmo) || null;
                  if (!weapon || !weaponAmmo ||
                    (singleKill.rank !== detail && singleKill.race !== detail &&
                      singleKill.weapon !== detail && singleKill.weaponAmmo !== detail &&
                      singleKill.getUnitStatusString() !== detail && singleKill.getUnitFactionString() !== detail &&
                      singleKill.getUnitSideString() !== detail && singleKill.getUnitBodyPartString() !== detail &&
                      weaponAmmo.getDamageType?.() !== damageType && weapon.getBattleType?.() !== battleType)) {
                    foundMatch = false;
                    break;
                  }
                }

                if (foundMatch && currentBlockCounters[index]-- > 0 && --currentTotalCounters <= 0) {
                  andCriteriaMet = true;
                  break;
                }
              }

              if (andCriteriaMet) {
                if (++totalKillGroups >= criteriaValues[nextNoNounLevel]) {
                  enoughForNextCommendation = true;
                  break;
                }
                if (criteriaName === "killsWithCriteriaTurn" || criteriaName === "killsWithCriteriaMission") {
                  skipThisTimeSpan = true;
                } else if (criteriaName === "killsWithCriteriaCareer") {
                  currentTotalCounters = 0;
                  for (let counter = 0; counter < currentBlockCounters.length; ++counter) {
                    currentBlockCounters[counter] += referenceBlockCounters[counter];
                    currentTotalCounters += Math.max(currentBlockCounters[counter], 0);
                  }
                }
              }
            }

            if (enoughForNextCommendation) {
              break;
            }
          }

          if (!enoughForNextCommendation) {
            awardCommendationBool = false;
          }
        }
      }

      if (awardCommendationBool) {
        if (modularCommendations.length === 0) {
          modularCommendations.push("noNoun");
        }
        for (const noun of modularCommendations) {
          this.awardCommendation(commendationName, noun);
        }
        awardedCommendation = true;
      } else {
        ++i;
      }
    }
    return awardedCommendation;
  }

  getMissionIdList(): number[] {
    return this._missionIdList;
  }

  getKills(): BattleUnitKills[] {
    return this._killList;
  }

  getAlienRankTotal(): Map<string, number> {
    const list = new Map<string, number>();
    for (const kill of this._killList) {
      increment(list, kill.rank);
    }
    return sortedMap(list);
  }

  getAlienRaceTotal(): Map<string, number> {
    const list = new Map<string, number>();
    for (const kill of this._killList) {
      increment(list, kill.race);
    }
    return sortedMap(list);
  }

  getWeaponTotal(): Map<string, number> {
    const list = new Map<string, number>();
    for (const kill of this._killList) {
      if (kill.faction === UnitFaction.FACTION_HOSTILE) {
        increment(list, kill.weapon);
      }
    }
    return sortedMap(list);
  }

  getWeaponAmmoTotal(): Map<string, number> {
    const list = new Map<string, number>();
    for (const kill of this._killList) {
      if (kill.faction === UnitFaction.FACTION_HOSTILE) {
        increment(list, kill.weaponAmmo);
      }
    }
    return sortedMap(list);
  }

  getRegionTotal(missionStatistics: MissionStatistics[]): Map<string, number> {
    return this.getMissionStringTotal(missionStatistics, mission => mission.region);
  }

  getCountryTotal(missionStatistics: MissionStatistics[]): Map<string, number> {
    return this.getMissionStringTotal(missionStatistics, mission => mission.country);
  }

  getTypeTotal(missionStatistics: MissionStatistics[]): Map<string, number> {
    return this.getMissionStringTotal(missionStatistics, mission => mission.type);
  }

  getUFOTotal(missionStatistics: MissionStatistics[]): Map<string, number> {
    return this.getMissionStringTotal(missionStatistics, mission => mission.ufo);
  }

  getKillTotal(): number {
    let killTotal = 0;
    for (const kill of this._killList) {
      if (kill.status === UnitStatus.STATUS_DEAD && kill.faction === UnitFaction.FACTION_HOSTILE) {
        killTotal++;
      }
    }
    return killTotal;
  }

  getMissionTotal(): number {
    return this._missionIdList.length;
  }

  getWinTotal(missionStatistics: MissionStatistics[]): number {
    let winTotal = 0;
    this.forEachSoldierMission(missionStatistics, mission => {
      if (mission.success) {
        winTotal++;
      }
    });
    return winTotal;
  }

  getStunTotal(): number {
    let stunTotal = 0;
    for (const kill of this._killList) {
      if (kill.status === UnitStatus.STATUS_UNCONSCIOUS && kill.faction === UnitFaction.FACTION_HOSTILE) {
        stunTotal++;
      }
    }
    return stunTotal;
  }

  getPanickTotal(): number {
    let panickTotal = 0;
    for (const kill of this._killList) {
      if (kill.status === UnitStatus.STATUS_PANICKING && kill.faction === UnitFaction.FACTION_HOSTILE) {
        panickTotal++;
      }
    }
    return panickTotal;
  }

  getControlTotal(): number {
    let controlTotal = 0;
    for (const kill of this._killList) {
      if (kill.status === UnitStatus.STATUS_TURNING && kill.faction === UnitFaction.FACTION_HOSTILE) {
        controlTotal++;
      }
    }
    return controlTotal;
  }

  getDaysWoundedTotal(): number {
    return this._daysWoundedTotal;
  }

  addMonthlyService(): void {
    this._monthsService++;
  }

  getMonthsService(): number {
    return this._monthsService;
  }

  awardOriginalEightCommendation(): void {
    this._commendations.push(new SoldierCommendations("STR_MEDAL_ORIGINAL8_NAME", "NoNoun"));
  }

  awardBestOfRank(score: number): void {
    this._bestOfRank = score;
  }

  awardBestOverall(score: number): void {
    this._bestSoldier = score;
  }

  awardPostMortemKill(kills: number): void {
    this._postMortemKills = kills;
  }

  getShotsFiredTotal(): number {
    return this._shotsFiredCounterTotal;
  }

  getShotsLandedTotal(): number {
    return this._shotsLandedCounterTotal;
  }

  getAccuracy(): number {
    if (this._shotsFiredCounterTotal !== 0) {
      return Math.trunc(100 * this._shotsLandedCounterTotal / this._shotsFiredCounterTotal);
    }
    return 0;
  }

  getTrapKillTotal(mod: SoldierDiaryModLike): number {
    let trapKillTotal = 0;
    for (const kill of this._killList) {
      const item = mod.getItem?.(kill.weapon) || null;
      if (kill.hostileTurn() && (item === null || item.getBattleType?.() === BattleType.BT_GRENADE || item.getBattleType?.() === BattleType.BT_PROXIMITYGRENADE)) {
        trapKillTotal++;
      }
    }
    return trapKillTotal;
  }

  getReactionFireKillTotal(mod: SoldierDiaryModLike): number {
    let reactionFireKillTotal = 0;
    for (const kill of this._killList) {
      const item = mod.getItem?.(kill.weapon) || null;
      if (kill.hostileTurn() && item !== null && item.getBattleType?.() !== BattleType.BT_GRENADE && item.getBattleType?.() !== BattleType.BT_PROXIMITYGRENADE) {
        reactionFireKillTotal++;
      }
    }
    return reactionFireKillTotal;
  }

  getTerrorMissionTotal(missionStatistics: MissionStatistics[]): number {
    let terrorMissionTotal = 0;
    this.forEachSoldierMission(missionStatistics, mission => {
      if (mission.success && !mission.isBaseDefense() && !mission.isUfoMission() && !mission.isAlienBase()) {
        terrorMissionTotal++;
      }
    });
    return terrorMissionTotal;
  }

  getNightMissionTotal(missionStatistics: MissionStatistics[]): number {
    let nightMissionTotal = 0;
    this.forEachSoldierMission(missionStatistics, mission => {
      if (mission.success && mission.isDarkness() && !mission.isBaseDefense() && !mission.isAlienBase()) {
        nightMissionTotal++;
      }
    });
    return nightMissionTotal;
  }

  getNightTerrorMissionTotal(missionStatistics: MissionStatistics[]): number {
    let nightTerrorMissionTotal = 0;
    this.forEachSoldierMission(missionStatistics, mission => {
      if (mission.success && mission.isDarkness() && !mission.isBaseDefense() && !mission.isUfoMission() && !mission.isAlienBase()) {
        nightTerrorMissionTotal++;
      }
    });
    return nightTerrorMissionTotal;
  }

  getBaseDefenseMissionTotal(missionStatistics: MissionStatistics[]): number {
    let baseDefenseMissionTotal = 0;
    this.forEachSoldierMission(missionStatistics, mission => {
      if (mission.success && mission.isBaseDefense()) {
        baseDefenseMissionTotal++;
      }
    });
    return baseDefenseMissionTotal;
  }

  getAlienBaseAssaultTotal(missionStatistics: MissionStatistics[]): number {
    let alienBaseAssaultTotal = 0;
    this.forEachSoldierMission(missionStatistics, mission => {
      if (mission.success && mission.isAlienBase()) {
        alienBaseAssaultTotal++;
      }
    });
    return alienBaseAssaultTotal;
  }

  getImportantMissionTotal(missionStatistics: MissionStatistics[]): number {
    let importantMissionTotal = 0;
    this.forEachSoldierMission(missionStatistics, mission => {
      if (mission.success && mission.type !== "STR_UFO_CRASH_RECOVERY") {
        importantMissionTotal++;
      }
    });
    return importantMissionTotal;
  }

  getScoreTotal(missionStatistics: MissionStatistics[]): number {
    let scoreTotal = 0;
    this.forEachSoldierMission(missionStatistics, mission => {
      scoreTotal += mission.score;
    });
    return scoreTotal;
  }

  getValiantCruxTotal(missionStatistics: MissionStatistics[]): number {
    let valiantCruxTotal = 0;
    this.forEachSoldierMission(missionStatistics, mission => {
      if (mission.valiantCrux) {
        valiantCruxTotal++;
      }
    });
    return valiantCruxTotal;
  }

  getLootValueTotal(missionStatistics: MissionStatistics[]): number {
    let lootValueTotal = 0;
    this.forEachSoldierMission(missionStatistics, mission => {
      lootValueTotal += mission.lootValue;
    });
    return lootValueTotal;
  }

  private awardCommendation(type: string, noun = "noNoun"): void {
    for (const commendation of this._commendations) {
      if (commendation.getType() === type && commendation.getNoun() === noun) {
        commendation.addDecoration();
        return;
      }
    }
    this._commendations.push(new SoldierCommendations(type, noun));
  }

  private getMissionStringTotal(missionStatistics: MissionStatistics[], getter: (mission: MissionStatistics) => string): Map<string, number> {
    const total = new Map<string, number>();
    this.forEachSoldierMission(missionStatistics, mission => {
      increment(total, getter(mission));
    });
    return sortedMap(total);
  }

  private forEachSoldierMission(missionStatistics: MissionStatistics[], fn: (mission: MissionStatistics) => void): void {
    for (const mission of missionStatistics) {
      for (const missionId of this._missionIdList) {
        if (missionId === mission.id) {
          fn(mission);
        }
      }
    }
  }

  private noNounCriteriaFailed(criteriaName: string, criterion: number, missionStatistics: MissionStatistics[], mod: SoldierDiaryModLike): boolean {
    switch (criteriaName) {
      case "totalKills": return this.getKillTotal() < criterion;
      case "totalMissions": return this._missionIdList.length < criterion;
      case "totalWins": return this.getWinTotal(missionStatistics) < criterion;
      case "totalScore": return this.getScoreTotal(missionStatistics) < criterion;
      case "totalStuns": return this.getStunTotal() < criterion;
      case "totalDaysWounded": return this._daysWoundedTotal < criterion;
      case "totalBaseDefenseMissions": return this.getBaseDefenseMissionTotal(missionStatistics) < criterion;
      case "totalTerrorMissions": return this.getTerrorMissionTotal(missionStatistics) < criterion;
      case "totalNightMissions": return this.getNightMissionTotal(missionStatistics) < criterion;
      case "totalNightTerrorMissions": return this.getNightTerrorMissionTotal(missionStatistics) < criterion;
      case "totalMonthlyService": return this._monthsService < criterion;
      case "totalFellUnconcious": return this._unconciousTotal < criterion;
      case "totalShotAt10Times": return this._shotAtCounter10in1Mission < criterion;
      case "totalHit5Times": return this._hitCounter5in1Mission < criterion;
      case "totalFriendlyFired": return this._totalShotByFriendlyCounter < criterion || Boolean(this._KIA) || Boolean(this._MIA);
      case "total_lone_survivor": return this._loneSurvivorTotal < criterion;
      case "totalIronMan": return this._ironManTotal < criterion;
      case "totalImportantMissions": return this.getImportantMissionTotal(missionStatistics) < criterion;
      case "totalLongDistanceHits": return this._longDistanceHitCounterTotal < criterion;
      case "totalLowAccuracyHits": return this._lowAccuracyHitCounterTotal < criterion;
      case "totalReactionFire": return this.getReactionFireKillTotal(mod) < criterion;
      case "totalTimesWounded": return this._timesWoundedTotal < criterion;
      case "totalValientCrux": return this.getValiantCruxTotal(missionStatistics) < criterion;
      case "isDead": return this._KIA < criterion;
      case "totalTrapKills": return this.getTrapKillTotal(mod) < criterion;
      case "totalAlienBaseAssaults": return this.getAlienBaseAssaultTotal(missionStatistics) < criterion;
      case "totalAllAliensKilled": return this._allAliensKilledTotal < criterion;
      case "totalAllAliensStunned": return this._allAliensStunnedTotal < criterion;
      case "totalWoundsHealed": return this._woundsHealedTotal < criterion;
      case "totalAllUFOs": return this._allUFOs < criterion;
      case "totalAllMissionTypes": return this._allMissionTypes < criterion;
      case "totalStatGain": return this._statGainTotal < criterion;
      case "totalRevives": return this._revivedUnitTotal < criterion;
      case "totalSoldierRevives": return this._revivedSoldierTotal < criterion;
      case "totalHostileRevives": return this._revivedHostileTotal < criterion;
      case "totalNeutralRevives": return this._revivedNeutralTotal < criterion;
      case "totalWholeMedikit": return this._wholeMedikitTotal < criterion;
      case "totalBraveryGain": return this._braveryGainTotal < criterion;
      case "bestOfRank": return this._bestOfRank < criterion;
      case "bestSoldier": return this._bestSoldier < criterion;
      case "isMIA": return this._MIA < criterion;
      case "totalMartyrKills": return this._martyrKillsTotal < criterion;
      case "totalPostMortemKills": return this._postMortemKills < criterion;
      case "globeTrotter": return Number(this._globeTrotter) < criterion;
      case "totalSlaveKills": return this._slaveKillsTotal < criterion;
      default: return false;
    }
  }
}
