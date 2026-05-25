import { RNG } from "../Engine/RNG.ts";
import { Options } from "../Engine/Options.ts";
import type { Language } from "../Engine/Language.ts";
import type { Armor } from "../Mod/Armor.ts";
import type { RuleSoldier } from "../Mod/RuleSoldier.ts";
import { StatString } from "../Mod/StatString.ts";
import type { UnitStats } from "../Mod/Unit.ts";
import { createUnitStats } from "../Mod/Unit.ts";
import type { Craft } from "./Craft.ts";
import type { EquipmentLayoutItemSave } from "./EquipmentLayoutItem.ts";
import type { Mod } from "../Mod/Mod.ts";
import { SoldierDeath, type SoldierDeathSave } from "./SoldierDeath.ts";
import { SoldierDiary, type SoldierDiarySave } from "./SoldierDiary.ts";
import type { TargetSaveNode } from "./Target.ts";

export enum SoldierRank {
  RANK_ROOKIE = 0,
  RANK_SQUADDIE,
  RANK_SERGEANT,
  RANK_CAPTAIN,
  RANK_COLONEL,
  RANK_COMMANDER
}

export enum SoldierGender {
  GENDER_MALE = 0,
  GENDER_FEMALE
}

export enum SoldierLook {
  LOOK_BLONDE = 0,
  LOOK_BROWNHAIR,
  LOOK_ORIENTAL,
  LOOK_AFRICAN
}

export type SoldierSaveNode = {
  type?: string;
  id?: number;
  name?: string;
  initialStats?: Partial<UnitStats>;
  currentStats?: Partial<UnitStats>;
  rank?: number;
  craft?: TargetSaveNode;
  gender?: number;
  look?: number;
  missions?: number;
  kills?: number;
  recovery?: number;
  armor?: string;
  psiTraining?: boolean;
  improvement?: number;
  psiStrImprovement?: number;
  equipmentLayout?: EquipmentLayoutItemSave[];
  death?: SoldierDeathSave;
  diary?: SoldierDiarySave;
};

function intValue(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.trunc(value) : fallback;
}

function boolValue(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

export class Soldier {
  private _name = "";
  private _initialStats = createUnitStats();
  private _currentStats = createUnitStats();
  private _rank = SoldierRank.RANK_ROOKIE;
  private _craft: Craft | null = null;
  private _gender = SoldierGender.GENDER_MALE;
  private _look = SoldierLook.LOOK_BLONDE;
  private _missions = 0;
  private _kills = 0;
  private _recovery = 0;
  private _recentlyPromoted = false;
  private _psiTraining = false;
  private _improvement = 0;
  private _psiStrImprovement = 0;
  private _statString = "";
  private _death: SoldierDeath | null = null;
  private _diary = new SoldierDiary();
  private _equipmentLayout: EquipmentLayoutItemSave[] = [];

  constructor(private _rules: RuleSoldier, private _armor: Armor | null = null, private _id = 0) {
    if (this._id !== 0) {
      this.generate();
    }
  }

  getName(statstring = false, maxLength = 20): string {
    if (statstring && this._statString.length > 0) {
      const name = Array.from(this._name);
      if (name.length + this._statString.length > maxLength) {
        return `${name.slice(0, Math.max(0, maxLength - this._statString.length)).join("")}/${this._statString}`;
      }
      return `${this._name}/${this._statString}`;
    }
    return this._name;
  }

  setName(name: string): void {
    this._name = name;
  }

  load(node: SoldierSaveNode | null | undefined, mod: Mod | null = null, save: { isResearched?: (research: string | string[]) => boolean } | null = null): void {
    if (!node) {
      return;
    }
    this._id = intValue(node.id, this._id);
    this._name = node.name ?? this._name;
    this._initialStats = createUnitStats({ ...this._initialStats, ...(node.initialStats || {}) });
    this._currentStats = createUnitStats({ ...this._currentStats, ...(node.currentStats || {}) });
    this._rank = intValue(node.rank, this._rank) as SoldierRank;
    this._gender = intValue(node.gender, this._gender) as SoldierGender;
    this._look = intValue(node.look, this._look) as SoldierLook;
    this._missions = intValue(node.missions, this._missions);
    this._kills = intValue(node.kills, this._kills);
    this._recovery = intValue(node.recovery, this._recovery);
    const armorName = node.armor || this._armor?.getType?.() || this._rules.getArmor();
    this._armor = mod?.getArmor(armorName) || mod?.getArmor(this._rules.getArmor()) || this._armor;
    this._psiTraining = boolValue(node.psiTraining, this._psiTraining);
    this._improvement = intValue(node.improvement, this._improvement);
    this._psiStrImprovement = intValue(node.psiStrImprovement, this._psiStrImprovement);
    this._equipmentLayout = [];
    for (const layoutItem of node.equipmentLayout || []) {
      const slot = layoutItem.slot || "";
      if (!mod || !slot || mod.getInventory(slot)) {
        this._equipmentLayout.push({ ...layoutItem });
      }
    }
    if (node.death) {
      this._death = new SoldierDeath();
      this._death.load(node.death);
    }
    if (node.diary) {
      this._diary = new SoldierDiary();
      this._diary.load(node.diary, mod);
    }
    if (mod) {
      this.calcStatString(mod.getStatStrings(), Options.psiStrengthEval && !!save?.isResearched?.(mod.getPsiRequirements()));
    }
  }

  save(): SoldierSaveNode {
    const node: SoldierSaveNode = {
      type: this._rules.getType(),
      id: this._id,
      name: this._name,
      initialStats: { ...this._initialStats },
      currentStats: { ...this._currentStats },
      rank: this._rank,
      gender: this._gender,
      look: this._look,
      missions: this._missions,
      kills: this._kills,
      armor: this._armor?.getType() || this._rules.getArmor(),
      improvement: this._improvement,
      psiStrImprovement: this._psiStrImprovement
    };
    if (this._craft) {
      node.craft = this._craft.saveId();
    }
    if (this._recovery > 0) {
      node.recovery = this._recovery;
    }
    if (this._psiTraining) {
      node.psiTraining = this._psiTraining;
    }
    if (this._equipmentLayout.length > 0) {
      node.equipmentLayout = this._equipmentLayout.map(item => ({ ...item }));
    }
    if (this._death) {
      node.death = this._death.save();
    }
    if (Options.soldierDiaries && (this._diary.getMissionIdList().length > 0 || this._diary.getSoldierCommendations().length > 0 || this._diary.getMonthsService() > 0)) {
      node.diary = this._diary.save();
    }
    return node;
  }

  getCraft(): Craft | null {
    return this._craft;
  }

  setCraft(craft: Craft | null): void {
    this._craft = craft;
  }

  getCraftString(lang: Language): string {
    if (this._recovery > 0) {
      return String(lang.getString("STR_WOUNDED"));
    }
    if (this._craft === null) {
      return String(lang.getString("STR_NONE_UC"));
    }
    return this._craft.getName(lang);
  }

  getRank(): SoldierRank {
    return this._rank;
  }

  promoteRank(): void {
    this._rank = Math.min(SoldierRank.RANK_COMMANDER, this._rank + 1);
    if (this._rank > SoldierRank.RANK_SQUADDIE) {
      this._recentlyPromoted = true;
    }
  }

  isPromoted(): boolean {
    const promoted = this._recentlyPromoted;
    this._recentlyPromoted = false;
    return promoted;
  }

  getRankString(): string {
    switch (this._rank) {
      case SoldierRank.RANK_ROOKIE:
        return "STR_ROOKIE";
      case SoldierRank.RANK_SQUADDIE:
        return "STR_SQUADDIE";
      case SoldierRank.RANK_SERGEANT:
        return "STR_SERGEANT";
      case SoldierRank.RANK_CAPTAIN:
        return "STR_CAPTAIN";
      case SoldierRank.RANK_COLONEL:
        return "STR_COLONEL";
      case SoldierRank.RANK_COMMANDER:
        return "STR_COMMANDER";
      default:
        return "";
    }
  }

  getRankSprite(): number {
    return 42 + this._rank;
  }

  getGender(): SoldierGender {
    return this._gender;
  }

  getLook(): SoldierLook {
    return this._look;
  }

  getRules(): RuleSoldier {
    return this._rules;
  }

  getArmor(): Armor | null {
    return this._armor;
  }

  setArmor(armor: Armor | null): void {
    this._armor = armor;
  }

  getId(): number {
    return this._id;
  }

  getInitStats(): UnitStats {
    return this._initialStats;
  }

  getCurrentStats(): UnitStats {
    return this._currentStats;
  }

  getMissions(): number {
    return this._missions;
  }

  getKills(): number {
    return this._kills;
  }

  addMissionCount(): void {
    ++this._missions;
  }

  addKillCount(count: number): void {
    this._kills += count;
  }

  getWoundRecovery(): number {
    return this._recovery;
  }

  getEquipmentLayout(): EquipmentLayoutItemSave[] {
    return this._equipmentLayout;
  }

  setWoundRecovery(recovery: number): void {
    this._recovery = recovery;
    if (this._recovery > 0) {
      this._craft = null;
    }
  }

  heal(): void {
    --this._recovery;
  }

  isInPsiTraining(): boolean {
    return this._psiTraining;
  }

  setPsiTraining(psi: boolean): void {
    this._psiTraining = psi;
  }

  getImprovement(): number {
    return this._improvement;
  }

  getPsiStrImprovement(): number {
    return this._psiStrImprovement;
  }

  calcStatString(statStrings: StatString[], psiStrengthEval: boolean): void {
    this._statString = StatString.calcStatString(this._currentStats, statStrings, psiStrengthEval, this._psiTraining);
  }

  trainPsi(): void {
    const caps = this._rules.getStatCaps();
    const minStats = this._rules.getMinStats();
    const maxStats = this._rules.getMaxStats();

    this._improvement = 0;
    this._psiStrImprovement = 0;
    if (this._currentStats.psiSkill < -10 + minStats.psiSkill) {
      this._currentStats.psiSkill = minStats.psiSkill;
    } else if (this._currentStats.psiSkill <= maxStats.psiSkill) {
      this._improvement = RNG.generate(maxStats.psiSkill, maxStats.psiSkill + Math.trunc(maxStats.psiSkill / 2));
    } else {
      if (this._currentStats.psiSkill <= Math.trunc(caps.psiSkill / 2)) {
        this._improvement = RNG.generate(5, 12);
      } else if (this._currentStats.psiSkill < caps.psiSkill) {
        this._improvement = RNG.generate(1, 3);
      }
      if (Options.allowPsiStrengthImprovement) {
        if (this._currentStats.psiStrength <= Math.trunc(caps.psiStrength / 2)) {
          this._psiStrImprovement = RNG.generate(5, 12);
        } else if (this._currentStats.psiStrength < caps.psiStrength) {
          this._psiStrImprovement = RNG.generate(1, 3);
        }
      }
    }
    this._currentStats.psiSkill += this._improvement;
    this._currentStats.psiStrength += this._psiStrImprovement;
    if (this._currentStats.psiSkill > caps.psiSkill) {
      this._currentStats.psiSkill = caps.psiSkill;
    }
    if (this._currentStats.psiStrength > caps.psiStrength) {
      this._currentStats.psiStrength = caps.psiStrength;
    }
  }

  trainPsi1Day(): void {
    if (!this._psiTraining) {
      this._improvement = 0;
      return;
    }

    const caps = this._rules.getStatCaps();
    const minStats = this._rules.getMinStats();
    const maxStats = this._rules.getMaxStats();
    if (this._currentStats.psiSkill > 0) {
      if (8 * 100 >= this._currentStats.psiSkill * RNG.generate(1, 100) && this._currentStats.psiSkill < caps.psiSkill) {
        ++this._improvement;
        ++this._currentStats.psiSkill;
      }
      if (Options.allowPsiStrengthImprovement && 8 * 100 >= this._currentStats.psiStrength * RNG.generate(1, 100) && this._currentStats.psiStrength < caps.psiStrength) {
        ++this._psiStrImprovement;
        ++this._currentStats.psiStrength;
      }
    } else if (this._currentStats.psiSkill < minStats.psiSkill) {
      if (++this._currentStats.psiSkill === minStats.psiSkill) {
        this._improvement = maxStats.psiSkill + RNG.generate(0, Math.trunc(maxStats.psiSkill / 2));
        this._currentStats.psiSkill = this._improvement;
      }
    } else {
      this._currentStats.psiSkill -= RNG.generate(30, 60);
    }
  }

  getDeath(): SoldierDeath | null {
    return this._death;
  }

  getDiary(): SoldierDiary {
    return this._diary;
  }

  die(death: SoldierDeath | null): void {
    this._death = death;
    this._craft = null;
    this._psiTraining = false;
    this._recovery = 0;
  }

  private generate(): void {
    const minStats = this._rules.getMinStats();
    const maxStats = this._rules.getMaxStats();

    this._initialStats = {
      tu: RNG.generate(minStats.tu, maxStats.tu),
      stamina: RNG.generate(minStats.stamina, maxStats.stamina),
      health: RNG.generate(minStats.health, maxStats.health),
      bravery: RNG.generate(Math.trunc(minStats.bravery / 10), Math.trunc(maxStats.bravery / 10)) * 10,
      reactions: RNG.generate(minStats.reactions, maxStats.reactions),
      firing: RNG.generate(minStats.firing, maxStats.firing),
      throwing: RNG.generate(minStats.throwing, maxStats.throwing),
      strength: RNG.generate(minStats.strength, maxStats.strength),
      psiStrength: RNG.generate(minStats.psiStrength, maxStats.psiStrength),
      melee: RNG.generate(minStats.melee, maxStats.melee),
      psiSkill: minStats.psiSkill
    };
    this._currentStats = { ...this._initialStats };

    const names = this._rules.getNames();
    if (names.length > 0) {
      const nationality = RNG.generate(0, names.length - 1);
      const generated = names[nationality].genName(this._rules.getFemaleFrequency());
      this._name = generated.name;
      this._gender = generated.gender;
      this._look = names[nationality].genLook(4);
    } else {
      this._gender = RNG.percent(this._rules.getFemaleFrequency()) ? SoldierGender.GENDER_FEMALE : SoldierGender.GENDER_MALE;
      this._look = RNG.generate(0, 3);
      this._name = this._gender === SoldierGender.GENDER_FEMALE ? "Jane Doe" : "John Doe";
    }
  }
}
