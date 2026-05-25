import type { Language } from "../Engine/Language.ts";
import { createUnitStats, type UnitStats } from "../Mod/Unit.ts";
import { BattleUnit, UnitBodyPart, UnitFaction, UnitSide, UnitStatus } from "./BattleUnit.ts";

export type BattleUnitKillsSave = {
  name?: string;
  type?: string;
  rank?: string;
  race?: string;
  weapon?: string;
  weaponAmmo?: string;
  status?: number;
  faction?: number;
  mission?: number;
  turn?: number;
  side?: number;
  bodypart?: number;
  id?: number;
};

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

  constructor(node?: BattleUnitKillsSave) {
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

  load(node: BattleUnitKillsSave): void {
    this.name = node.name ?? this.name;
    this.type = node.type ?? this.type;
    this.rank = node.rank ?? this.rank;
    this.race = node.race ?? this.race;
    this.weapon = node.weapon ?? this.weapon;
    this.weaponAmmo = node.weaponAmmo ?? this.weaponAmmo;
    this.status = node.status ?? this.status;
    this.faction = node.faction ?? this.faction;
    this.mission = node.mission ?? this.mission;
    this.turn = node.turn ?? this.turn;
    this.side = node.side ?? this.side;
    this.bodypart = node.bodypart ?? this.bodypart;
    this.id = node.id ?? this.id;
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
    return UnitStatus[this.status] || "status error";
  }

  getUnitFactionString(): string {
    return UnitFaction[this.faction] || "faction error";
  }

  getUnitSideString(): string {
    return UnitSide[this.side] || "side error";
  }

  getUnitBodyPartString(): string {
    return UnitBodyPart[this.bodypart] || "body part error";
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
    const soldier = unit.getGeoscapeSoldier();
    if (soldier) {
      this.name = soldier.getName();
    } else {
      this.type = unit.getType();
    }
    const rules = unit.getUnitRules?.();
    if (unit.getOriginalFaction() === UnitFaction.FACTION_PLAYER) {
      if (soldier) {
        this.rank = soldier.getRankString() || "STR_SOLDIER";
        this.race = rules?.getRace?.() || "STR_FRIENDLY";
      } else {
        this.rank = rules?.getRank?.() || "STR_HWPS";
        this.race = rules?.getRace?.() || "STR_FRIENDLY";
      }
    } else if (unit.getOriginalFaction() === UnitFaction.FACTION_HOSTILE) {
      this.rank = rules?.getRank?.() || "STR_LIVE_SOLDIER";
      this.race = rules?.getRace?.() || "STR_HOSTILE";
    } else if (unit.getOriginalFaction() === UnitFaction.FACTION_NEUTRAL) {
      this.rank = rules?.getRank?.() || "STR_CIVILIAN";
      this.race = rules?.getRace?.() || "STR_NEUTRAL";
    } else {
      this.rank = "STR_UNKNOWN";
      this.race = "STR_UNKNOWN";
    }
  }
}

export type BattleUnitStatisticsSave = {
  wasUnconcious?: boolean;
  kills?: BattleUnitKillsSave[];
  shotAtCounter?: number;
  hitCounter?: number;
  shotByFriendlyCounter?: number;
  shotFriendlyCounter?: number;
  loneSurvivor?: boolean;
  ironMan?: boolean;
  longDistanceHitCounter?: number;
  lowAccuracyHitCounter?: number;
  shotsFiredCounter?: number;
  shotsLandedCounter?: number;
  nikeCross?: boolean;
  mercyCross?: boolean;
  woundsHealed?: number;
  appliedStimulant?: number;
  appliedPainKill?: number;
  revivedSoldier?: number;
  revivedHostile?: number;
  revivedNeutral?: number;
  martyr?: number;
  slaveKills?: number;
};

export class BattleUnitStatistics {
  wasUnconcious = false;
  shotAtCounter = 0;
  hitCounter = 0;
  shotByFriendlyCounter = 0;
  shotFriendlyCounter = 0;
  loneSurvivor = false;
  ironMan = false;
  longDistanceHitCounter = 0;
  lowAccuracyHitCounter = 0;
  shotsFiredCounter = 0;
  shotsLandedCounter = 0;
  kills: BattleUnitKills[] = [];
  daysWounded = 0;
  KIA = false;
  nikeCross = false;
  mercyCross = false;
  woundsHealed = 0;
  delta: UnitStats = createUnitStats();
  appliedStimulant = 0;
  appliedPainKill = 0;
  revivedSoldier = 0;
  revivedHostile = 0;
  revivedNeutral = 0;
  MIA = false;
  martyr = 0;
  slaveKills = 0;

  constructor(node?: BattleUnitStatisticsSave) {
    if (node) {
      this.load(node);
    }
  }

  duplicateEntry(status: UnitStatus, id: number): boolean {
    return this.kills.some(kill => kill.id === id && kill.status === status);
  }

  hasFriendlyFired(): boolean {
    return this.kills.some(kill => kill.faction === UnitFaction.FACTION_PLAYER);
  }

  load(node: BattleUnitStatisticsSave): void {
    this.wasUnconcious = node.wasUnconcious ?? this.wasUnconcious;
    this.kills = (node.kills || []).map(kill => new BattleUnitKills(kill));
    this.shotAtCounter = node.shotAtCounter ?? this.shotAtCounter;
    this.hitCounter = node.hitCounter ?? this.hitCounter;
    this.shotByFriendlyCounter = node.shotByFriendlyCounter ?? this.shotByFriendlyCounter;
    this.shotFriendlyCounter = node.shotFriendlyCounter ?? this.shotFriendlyCounter;
    this.loneSurvivor = node.loneSurvivor ?? this.loneSurvivor;
    this.ironMan = node.ironMan ?? this.ironMan;
    this.longDistanceHitCounter = node.longDistanceHitCounter ?? this.longDistanceHitCounter;
    this.lowAccuracyHitCounter = node.lowAccuracyHitCounter ?? this.lowAccuracyHitCounter;
    this.shotsFiredCounter = node.shotsFiredCounter ?? this.shotsFiredCounter;
    this.shotsLandedCounter = node.shotsLandedCounter ?? this.shotsLandedCounter;
    this.nikeCross = node.nikeCross ?? this.nikeCross;
    this.mercyCross = node.mercyCross ?? this.mercyCross;
    this.woundsHealed = node.woundsHealed ?? this.woundsHealed;
    this.appliedStimulant = node.appliedStimulant ?? this.appliedStimulant;
    this.appliedPainKill = node.appliedPainKill ?? this.appliedPainKill;
    this.revivedSoldier = node.revivedSoldier ?? this.revivedSoldier;
    this.revivedHostile = node.revivedHostile ?? this.revivedHostile;
    this.revivedNeutral = node.revivedNeutral ?? this.revivedNeutral;
    this.martyr = node.martyr ?? this.martyr;
    this.slaveKills = node.slaveKills ?? this.slaveKills;
  }

  save(): BattleUnitStatisticsSave {
    const node: BattleUnitStatisticsSave = {
      wasUnconcious: this.wasUnconcious
    };
    if (this.kills.length) node.kills = this.kills.map(kill => kill.save());
    if (this.shotAtCounter) node.shotAtCounter = this.shotAtCounter;
    if (this.hitCounter) node.hitCounter = this.hitCounter;
    if (this.shotByFriendlyCounter) node.shotByFriendlyCounter = this.shotByFriendlyCounter;
    if (this.shotFriendlyCounter) node.shotFriendlyCounter = this.shotFriendlyCounter;
    if (this.loneSurvivor) node.loneSurvivor = this.loneSurvivor;
    if (this.ironMan) node.ironMan = this.ironMan;
    if (this.longDistanceHitCounter) node.longDistanceHitCounter = this.longDistanceHitCounter;
    if (this.lowAccuracyHitCounter) node.lowAccuracyHitCounter = this.lowAccuracyHitCounter;
    if (this.shotsFiredCounter) node.shotsFiredCounter = this.shotsFiredCounter;
    if (this.shotsLandedCounter) node.shotsLandedCounter = this.shotsLandedCounter;
    if (this.nikeCross) node.nikeCross = this.nikeCross;
    if (this.mercyCross) node.mercyCross = this.mercyCross;
    if (this.woundsHealed) node.woundsHealed = this.woundsHealed;
    if (this.appliedStimulant) node.appliedStimulant = this.appliedStimulant;
    if (this.appliedPainKill) node.appliedPainKill = this.appliedPainKill;
    if (this.revivedSoldier) node.revivedSoldier = this.revivedSoldier;
    if (this.revivedHostile) node.revivedHostile = this.revivedHostile;
    if (this.revivedNeutral) node.revivedNeutral = this.revivedNeutral;
    if (this.martyr) node.martyr = this.martyr;
    if (this.slaveKills) node.slaveKills = this.slaveKills;
    return node;
  }
}
