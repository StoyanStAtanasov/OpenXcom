import { Base } from "./Base.ts";
import { AlienBase, type AlienBaseSave } from "./AlienBase.ts";
import { AlienMission, type AlienMissionSaveNode } from "./AlienMission.ts";
import { Country, type CountrySave } from "./Country.ts";
import { GameTime } from "./GameTime.ts";
import { getBrowserFile, putBrowserFile } from "../Engine/CrossPlatform.ts";
import type { Mod } from "../Mod/Mod.ts";
import type { RuleManufacture } from "../Mod/RuleManufacture.ts";
import type { RuleResearch } from "../Mod/RuleResearch.ts";
import { Region, type RegionSave } from "./Region.ts";
import { SoldierDeath, type BattleUnitKills } from "./SoldierDeath.ts";
import { Ufo, type UfoSaveNode } from "./Ufo.ts";
import type { SavedBattleGame, SavedBattleGameSave } from "./SavedBattleGame.ts";
import { createRegisteredSavedBattleGame } from "./SavedBattleGameRegistry.ts";
import type { GameTimeSave, MissionStatistics, MissionStatisticsSave } from "./MissionStatistics.ts";
import { MissionSite, type MissionSiteSave } from "./MissionSite.ts";
import { getDifficultyCoefficient } from "../Mod/ModStatics.ts";
import type { MissionObjective } from "../Mod/RuleAlienMission.ts";
import type { TargetLike, TargetSaveNode } from "./Target.ts";
import { Options } from "../Engine/Options.ts";
import { SoldierRank, Soldier, type SoldierSaveNode } from "./Soldier.ts";
import { Transfer, TransferType, type TransferSaveNode } from "./Transfer.ts";
import { ResearchProject, type ResearchProjectSaveNode } from "./ResearchProject.ts";
import { AlienStrategy, type AlienStrategySave } from "./AlienStrategy.ts";
import { Waypoint } from "./Waypoint.ts";
import { Craft, type CraftSaveNode } from "./Craft.ts";
import { Production, type ProductionSave } from "./Production.ts";
import { BaseFacility, type BaseFacilitySave } from "./BaseFacility.ts";

export type GlobeTarget = TargetLike;

type PromotionInfo = {
  totalCommanders: number;
  totalColonels: number;
  totalCaptains: number;
  totalSergeants: number;
};

type SavedGameBaseNode = {
  lon?: number;
  lat?: number;
  name?: string;
  items?: Record<string, number>;
  scientists?: number;
  engineers?: number;
  facilities?: BaseFacilitySave[];
  inBattlescape?: boolean;
  retaliationTarget?: boolean;
  soldiers?: SoldierSaveNode[];
  transfers?: TransferSaveNode[];
  research?: ResearchProjectSaveNode[];
  productions?: ProductionSave[];
  crafts?: CraftSaveNode[];
};

type SavedGameNode = {
  name?: string;
  time?: GameTimeSave;
  ironman?: boolean;
  difficulty?: number;
  end?: number;
  monthsPassed?: number;
  graphRegionToggles?: string;
  graphCountryToggles?: string;
  graphFinanceToggles?: string;
  funds?: number[];
  maintenance?: number[];
  researchScores?: number[];
  incomes?: number[];
  expenditures?: number[];
  warned?: boolean;
  globeLon?: number;
  globeLat?: number;
  globeZoom?: number;
  ids?: Record<string, number>;
  countries?: CountrySave[];
  regions?: RegionSave[];
  bases?: SavedGameBaseNode[];
  waypoints?: TargetSaveNode[];
  missionSites?: MissionSiteSave[];
  alienBases?: AlienBaseSave[];
  alienMissions?: AlienMissionSaveNode[];
  ufos?: UfoSaveNode[];
  discovered?: string[];
  poppedResearch?: string[];
  selectedBase?: number;
  lastSelectedArmor?: string;
  alienStrategy?: AlienStrategySave;
  deadSoldiers?: SoldierSaveNode[];
  missionStatistics?: MissionStatisticsSave[];
  battleGame?: SavedBattleGameSave;
};

type ResearchProjectSavable = {
  save?: () => ResearchProjectSaveNode;
};

type ProductionSavable = {
  save?: () => ProductionSave;
};

function intValue(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.trunc(value) : fallback;
}

function numberValue(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function boolValue(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function stringValue(value: unknown, fallback: string): string {
  return typeof value === "string" ? value : fallback;
}

function numberArray(value: unknown, fallback: number[]): number[] {
  if (!Array.isArray(value)) {
    return [...fallback];
  }
  const result = value.filter(entry => typeof entry === "number" && Number.isFinite(entry)).map(entry => Math.trunc(entry));
  return result.length > 0 ? result : [...fallback];
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter(entry => typeof entry === "string") : [];
}

function saveGameTime(time: GameTime): GameTimeSave {
  return {
    second: time.getSecond(),
    minute: time.getMinute(),
    hour: time.getHour(),
    weekday: time.getWeekday(),
    day: time.getDay(),
    month: time.getMonth(),
    year: time.getYear()
  };
}

function loadGameTime(node: GameTimeSave | undefined, fallback: GameTime): GameTime {
  if (!node) {
    return fallback.clone();
  }
  return new GameTime(
    intValue(node.weekday, fallback.getWeekday()),
    intValue(node.day, fallback.getDay()),
    intValue(node.month, fallback.getMonth()),
    intValue(node.year, fallback.getYear()),
    intValue(node.hour, fallback.getHour()),
    intValue(node.minute, fallback.getMinute()),
    intValue(node.second, fallback.getSecond())
  );
}

function researchByName(mod: Mod | null | undefined, name: string): RuleResearch | null {
  return name ? mod?.getResearch(name) || null : null;
}

export enum GameDifficulty {
  DIFF_BEGINNER = 0,
  DIFF_EXPERIENCED,
  DIFF_VETERAN,
  DIFF_GENIUS,
  DIFF_SUPERHUMAN
}

export enum GameEnding {
  END_NONE = 0,
  END_WIN,
  END_LOSE
}

export class SavedGame {
  private _name = "";
  private _difficulty = GameDifficulty.DIFF_BEGINNER;
  private _end = GameEnding.END_NONE;
  private _ironman = false;
  private _time = new GameTime();
  private _funds = [0];
  private _maintenance = [0];
  private _incomes = [0];
  private _expenditures = [0];
  private _bases: Base[] = [];
  private _countries: Country[] = [];
  private _regions: Region[] = [];
  private _ufos: Ufo[] = [];
  private _waypoints: GlobeTarget[] = [];
  private _missionSites: MissionSite[] = [];
  private _alienBases: AlienBase[] = [];
  private _alienMissions: AlienMission[] = [];
  private _ids = new Map<string, number>();
  private _discovered: RuleResearch[] = [];
  private _poppedResearch: RuleResearch[] = [];
  private _researchScores = [0];
  private _debug = false;
  private _warned = false;
  private _battleGame: SavedBattleGame | null = null;
  private _monthsPassed = -1;
  private _deadSoldiers: Soldier[] = [];
  private _selectedBase = 0;
  private _lastSelectedArmor = "STR_NONE_UC";
  private _missionStatistics: MissionStatistics[] = [];
  private _alienStrategy = new AlienStrategy();
  private _battleGameNode: SavedBattleGameSave | null = null;
  private _globeLon = 0;
  private _globeLat = 0;
  private _globeZoom = 0;
  private _graphRegionToggles = "";
  private _graphCountryToggles = "";
  private _graphFinanceToggles = "";

  constructor() {
    this._bases.push(new Base());
  }

  save(filename = this._name): void {
    const doc = this.saveNode();
    const brief: SavedGameNode = {
      name: this._name,
      time: saveGameTime(this._time),
      ironman: this._ironman
    };
    putBrowserFile(`${Options.getMasterUserFolder()}${filename || this._name || "save.sav"}`, JSON.stringify([brief, doc]));
  }

  load(filename: string, mod: Mod | null): void {
    const path = `${Options.getMasterUserFolder()}${filename}`;
    const raw = getBrowserFile(path) ?? getBrowserFile(filename);
    if (raw == null) {
      throw new Error(`Save file ${filename} not found.`);
    }
    const parsed = JSON.parse(raw) as SavedGameNode | [SavedGameNode, SavedGameNode];
    const brief = Array.isArray(parsed) ? parsed[0] || {} : {};
    const doc = Array.isArray(parsed) ? parsed[1] || {} : parsed;
    this._time = loadGameTime(brief.time ?? doc.time, this._time);
    this._name = stringValue(brief.name ?? doc.name, this._name || filename);
    this._ironman = boolValue(brief.ironman ?? doc.ironman, this._ironman);
    this.loadNode(doc, mod);
  }

  getDifficulty(): GameDifficulty {
    return this._difficulty;
  }

  getDifficultyCoefficient(): number {
    return getDifficultyCoefficient(this._difficulty);
  }

  setDifficulty(difficulty: GameDifficulty): void {
    this._difficulty = difficulty;
  }

  getEnding(): GameEnding {
    return this._end;
  }

  setEnding(end: GameEnding): void {
    this._end = end;
  }

  getName(): string {
    return this._name;
  }

  setName(name: string): void {
    this._name = name;
  }

  isIronman(): boolean {
    return this._ironman;
  }

  setIronman(ironman: boolean): void {
    this._ironman = ironman;
  }

  getFunds(): number {
    return this._funds[this._funds.length - 1] || 0;
  }

  getFundsList(): number[] {
    return this._funds;
  }

  setFunds(funds: number): void {
    const current = this.getFunds();
    if (current > funds) {
      this._expenditures[this._expenditures.length - 1] += current - funds;
    } else {
      this._incomes[this._incomes.length - 1] += funds - current;
    }
    this._funds[this._funds.length - 1] = funds;
  }

  getTime(): GameTime {
    return this._time;
  }

  setTime(time: GameTime): void {
    this._time = time.clone();
  }

  getBases(): Base[] {
    return this._bases;
  }

  getSavedBattle(): SavedBattleGame | null {
    return this._battleGame;
  }

  setSavedBattle(battle: SavedBattleGame | null): void {
    this._battleGame = battle;
    this._battleGameNode = null;
  }

  getSavedBattleNode(): SavedBattleGameSave | null {
    return this._battleGameNode;
  }

  getMonthsPassed(): number {
    return this._monthsPassed;
  }

  setMonthsPassed(months: number): void {
    this._monthsPassed = months;
  }

  addMonth(): void {
    ++this._monthsPassed;
  }

  getDeadSoldiers(): Soldier[] {
    return this._deadSoldiers;
  }

  getSoldier(id: number): Soldier | null {
    for (const base of this._bases) {
      for (const soldier of base.getSoldiers()) {
        if (soldier.getId() === id) {
          return soldier;
        }
      }
    }
    for (const soldier of this._deadSoldiers) {
      if (soldier.getId() === id) {
        return soldier;
      }
    }
    return null;
  }

  getSelectedBase(): Base | null {
    if (this._bases.length === 0) {
      return null;
    }
    if (this._selectedBase < this._bases.length) {
      return this._bases[this._selectedBase];
    }
    return this._bases[0];
  }

  setSelectedBase(base: number): void {
    this._selectedBase = base;
  }

  killSoldier(soldier: Soldier, cause: BattleUnitKills | null = null): number {
    for (const base of this._bases) {
      const soldiers = base.getSoldiers();
      const index = soldiers.indexOf(soldier);
      if (index !== -1) {
        soldier.die(new SoldierDeath(this._time, cause));
        this._deadSoldiers.push(soldier);
        soldiers.splice(index, 1);
        return index;
      }
    }
    return -1;
  }

  setLastSelectedArmor(value: string): void {
    this._lastSelectedArmor = value;
  }

  getLastSelectedArmor(): string {
    return this._lastSelectedArmor;
  }

  getMissionStatistics(): MissionStatistics[] {
    return this._missionStatistics;
  }

  getAlienBases(): AlienBase[] {
    return this._alienBases;
  }

  getCountries(): Country[] {
    return this._countries;
  }

  getCountryFunding(): number {
    let total = 0;
    for (const country of this._countries) {
      total += country.getFunding().at(-1) || 0;
    }
    return total;
  }

  getBaseMaintenance(): number {
    let total = 0;
    for (const base of this._bases) {
      total += base.getMonthlyMaintenace();
    }
    return total;
  }

  monthlyFunding(): void {
    this._funds[this._funds.length - 1] += this.getCountryFunding() - this.getBaseMaintenance();
    this._funds.push(this.getFunds());
    this._maintenance[this._maintenance.length - 1] = this.getBaseMaintenance();
    this._maintenance.push(0);
    this._incomes.push(this.getCountryFunding());
    this._expenditures.push(this.getBaseMaintenance());
    this._researchScores.push(0);
    this.truncateMonthlyVectors();
  }

  getMaintenances(): number[] {
    return this._maintenance;
  }

  getIncomes(): number[] {
    return this._incomes;
  }

  getExpenditures(): number[] {
    return this._expenditures;
  }

  getRegions(): Region[] {
    return this._regions;
  }

  getUfos(): Ufo[] {
    return this._ufos;
  }

  getWaypoints(): GlobeTarget[] {
    return this._waypoints;
  }

  getMissionSites(): MissionSite[] {
    return this._missionSites;
  }

  getAlienMissions(): AlienMission[] {
    return this._alienMissions;
  }

  getAlienStrategy(): AlienStrategy {
    return this._alienStrategy;
  }

  findAlienMission(region: string, objective: MissionObjective): AlienMission | null {
    for (const mission of this._alienMissions) {
      if (mission.getRegion() === region && mission.getRules().getObjective() === objective) {
        return mission;
      }
    }
    return null;
  }

  getId(name: string): number {
    const next = this._ids.get(name);
    if (next != null) {
      this._ids.set(name, next + 1);
      return next;
    }
    this._ids.set(name, 2);
    return 1;
  }

  getAllIds(): Map<string, number> {
    return this._ids;
  }

  setAllIds(ids: Map<string, number>): void {
    this._ids = new Map(ids);
  }

  addFinishedResearchSimple(research: RuleResearch): void {
    this._discovered.push(research);
  }

  addFinishedResearch(research: RuleResearch, mod: Mod, base: Base | null = null, score = true): void {
    const queue: RuleResearch[] = [research];
    let currentQueueIndex = 0;
    while (queue.length > currentQueueIndex) {
      const currentQueueItem = queue[currentQueueIndex];
      const hasUndiscoveredProtectedUnlocks = this.hasUndiscoveredProtectedUnlock(currentQueueItem, mod);
      let checkRelatedZeroCostTopics = true;
      if (!this.isResearched(currentQueueItem.getName(), false)) {
        this._discovered.push(currentQueueItem);
        if (!hasUndiscoveredProtectedUnlocks && this.isResearched(currentQueueItem.getGetOneFree(), false)) {
          this.removePoppedResearch(currentQueueItem);
        }
        if (score) {
          this.addResearchScore(currentQueueItem.getPoints());
        }
      } else if (!hasUndiscoveredProtectedUnlocks) {
        checkRelatedZeroCostTopics = false;
      }

      if (checkRelatedZeroCostTopics) {
        const availableResearch = this.getAvailableResearchProjects(mod, base, false);
        for (const projectToTest of availableResearch) {
          if (projectToTest.getCost() !== 0) {
            continue;
          }
          if (queue.some(item => item.getName() === projectToTest.getName())) {
            continue;
          }
          if (projectToTest.getRequirements().length === 0) {
            queue.push(projectToTest);
          } else if (currentQueueItem.getUnlocked().includes(projectToTest.getName())) {
            queue.push(projectToTest);
          }
        }
      }
      ++currentQueueIndex;
    }
  }

  getDiscoveredResearch(): RuleResearch[] {
    return this._discovered;
  }

  getAvailableResearchProjects(mod: Mod, base: Base | null = null, considerDebugMode = false): RuleResearch[] {
    const projects: RuleResearch[] = [];
    const unlocked: RuleResearch[] = [];
    for (const discovered of this._discovered) {
      for (const unlockedName of discovered.getUnlocked()) {
        const rule = mod.getResearch(unlockedName, true);
        if (rule) {
          unlocked.push(rule);
        }
      }
    }

    for (const type of mod.getResearchList()) {
      const research = mod.getResearch(type);
      if (!research) {
        continue;
      }
      if (!((considerDebugMode && this._debug) || unlocked.includes(research))) {
        if (!this.isResearched(research.getDependencies(), considerDebugMode)) {
          continue;
        }
      }
      if (!this.isResearched(research.getRequirements(), considerDebugMode)) {
        continue;
      }
      if (this.isResearched(research.getName(), false)) {
        if (!this.isResearched(research.getGetOneFree(), false)) {
          // Keep it; this topic can still grant a random free discovery.
        } else if (this.hasUndiscoveredProtectedUnlock(research, mod)) {
          // Keep it; this topic can still unlock a protected zero-cost topic.
        } else {
          continue;
        }
      }
      if (base) {
        if (base.getResearch().some(project => project.getRules() === research)) {
          continue;
        }
        if (research.needItem() && base.getStorageItems().getItem(research.getName()) === 0) {
          continue;
        }
      } else if (research.needItem() && research.getCost() === 0) {
        continue;
      }
      projects.push(research);
    }
    return projects;
  }

  getNewlyAvailableResearchProjects(before: RuleResearch[], after: RuleResearch[]): RuleResearch[] {
    const sortedBefore = [...before].sort((a, b) => a.getName().localeCompare(b.getName()));
    const beforeNames = new Set(sortedBefore.map(rule => rule.getName()));
    return [...after]
      .sort((a, b) => a.getName().localeCompare(b.getName()))
      .filter(rule => !beforeNames.has(rule.getName()));
  }

  getAvailableProductions(mod: Mod, base: Base): RuleManufacture[] {
    const productions: RuleManufacture[] = [];
    const baseProductions = base.getProductions();
    for (const type of mod.getManufactureList()) {
      const manufacture = mod.getManufacture(type);
      if (!manufacture) {
        continue;
      }
      if (!this.isResearched(manufacture.getRequirements())) {
        continue;
      }
      if (baseProductions.some(production => production.getRules() === manufacture)) {
        continue;
      }
      productions.push(manufacture);
    }
    return productions;
  }

  getDependableManufacture(research: RuleResearch, mod: Mod, _base: Base | null = null): RuleManufacture[] {
    const dependables: RuleManufacture[] = [];
    for (const type of mod.getManufactureList()) {
      const manufacture = mod.getManufacture(type);
      if (!manufacture) {
        continue;
      }
      const requirements = manufacture.getRequirements();
      if (this.isResearched(requirements) && requirements.includes(research.getName())) {
        dependables.push(manufacture);
      }
    }
    return dependables;
  }

  hasUndiscoveredProtectedUnlock(research: RuleResearch, mod: Mod): boolean {
    for (const unlockedName of research.getUnlocked()) {
      const unlock = mod.getResearch(unlockedName, true);
      if (unlock && unlock.getRequirements().length > 0 && !this.isResearched(unlock.getName(), false)) {
        return true;
      }
    }
    return false;
  }

  isResearched(research: string | string[], considerDebugMode = true): boolean {
    if (Array.isArray(research)) {
      if (research.length === 0) {
        return true;
      }
      if (considerDebugMode && this._debug) {
        return true;
      }
      const matches = new Set(research);
      for (const discovered of this._discovered) {
        matches.delete(discovered.getName());
        if (matches.size === 0) {
          return true;
        }
      }
      return false;
    }
    if (considerDebugMode && this._debug) {
      return true;
    }
    return this._discovered.some(discovered => discovered.getName() === research);
  }

  addResearchScore(score: number): void {
    this._researchScores[this._researchScores.length - 1] += score;
  }

  getResearchScores(): number[] {
    return this._researchScores;
  }

  getWarned(): boolean {
    return this._warned;
  }

  setWarned(warned: boolean): void {
    this._warned = warned;
  }

  getGlobeLongitude(): number {
    return this._globeLon;
  }

  setGlobeLongitude(lon: number): void {
    this._globeLon = lon;
  }

  getGlobeLatitude(): number {
    return this._globeLat;
  }

  setGlobeLatitude(lat: number): void {
    this._globeLat = lat;
  }

  getGlobeZoom(): number {
    return this._globeZoom;
  }

  setGlobeZoom(zoom: number): void {
    this._globeZoom = Math.trunc(zoom);
  }

  getGraphRegionToggles(): string {
    return this._graphRegionToggles;
  }

  getGraphCountryToggles(): string {
    return this._graphCountryToggles;
  }

  getGraphFinanceToggles(): string {
    return this._graphFinanceToggles;
  }

  setGraphRegionToggles(value: string): void {
    this._graphRegionToggles = value;
  }

  setGraphCountryToggles(value: string): void {
    this._graphCountryToggles = value;
  }

  setGraphFinanceToggles(value: string): void {
    this._graphFinanceToggles = value;
  }

  addPoppedResearch(research: RuleResearch): void {
    if (!this.wasResearchPopped(research)) {
      this._poppedResearch.push(research);
    }
  }

  wasResearchPopped(research: RuleResearch): boolean {
    return this._poppedResearch.includes(research);
  }

  removePoppedResearch(research: RuleResearch): void {
    const index = this._poppedResearch.indexOf(research);
    if (index !== -1) {
      this._poppedResearch.splice(index, 1);
    }
  }

  locateRegion(lon: number, lat: number): Region | null {
    for (const region of this._regions) {
      if (region.getRules().insideRegion(lon, lat)) {
        return region;
      }
    }
    return null;
  }

  /**
   * Handles the higher promotions, matching the C++ soldier-count quotas.
   */
  handlePromotions(participants: Soldier[]): boolean {
    let soldiersPromoted = 0;
    let highestRanked: Soldier | null = null;
    const soldierData: PromotionInfo = {
      totalCommanders: 0,
      totalColonels: 0,
      totalCaptains: 0,
      totalSergeants: 0
    };
    const soldiers: Soldier[] = [];

    for (const base of this._bases) {
      for (const soldier of base.getSoldiers()) {
        soldiers.push(soldier);
        this.processSoldier(soldier, soldierData);
      }
      for (const transfer of base.getTransfers()) {
        if (transfer.getType() === TransferType.TRANSFER_SOLDIER) {
          const soldier = transfer.getSoldier();
          if (soldier) {
            soldiers.push(soldier);
            this.processSoldier(soldier, soldierData);
          }
        }
      }
    }

    const totalSoldiers = soldiers.length;

    if (soldierData.totalCommanders === 0) {
      if (totalSoldiers >= 30) {
        highestRanked = this.inspectSoldiers(soldiers, participants, SoldierRank.RANK_COLONEL);
        if (highestRanked) {
          highestRanked.promoteRank();
          ++soldiersPromoted;
          ++soldierData.totalCommanders;
          --soldierData.totalColonels;
        }
      }
    }

    while (Math.trunc(totalSoldiers / 23) > soldierData.totalColonels) {
      highestRanked = this.inspectSoldiers(soldiers, participants, SoldierRank.RANK_CAPTAIN);
      if (highestRanked) {
        highestRanked.promoteRank();
        ++soldiersPromoted;
        ++soldierData.totalColonels;
        --soldierData.totalCaptains;
      } else {
        break;
      }
    }

    while (Math.trunc(totalSoldiers / 11) > soldierData.totalCaptains) {
      highestRanked = this.inspectSoldiers(soldiers, participants, SoldierRank.RANK_SERGEANT);
      if (highestRanked) {
        highestRanked.promoteRank();
        ++soldiersPromoted;
        ++soldierData.totalCaptains;
        --soldierData.totalSergeants;
      } else {
        break;
      }
    }

    while (Math.trunc(totalSoldiers / 5) > soldierData.totalSergeants) {
      highestRanked = this.inspectSoldiers(soldiers, participants, SoldierRank.RANK_SQUADDIE);
      if (highestRanked) {
        highestRanked.promoteRank();
        ++soldiersPromoted;
        ++soldierData.totalSergeants;
      } else {
        break;
      }
    }

    return soldiersPromoted > 0;
  }

  private processSoldier(soldier: Soldier, soldierData: PromotionInfo): void {
    switch (soldier.getRank()) {
      case SoldierRank.RANK_COMMANDER:
        ++soldierData.totalCommanders;
        break;
      case SoldierRank.RANK_COLONEL:
        ++soldierData.totalColonels;
        break;
      case SoldierRank.RANK_CAPTAIN:
        ++soldierData.totalCaptains;
        break;
      case SoldierRank.RANK_SERGEANT:
        ++soldierData.totalSergeants;
        break;
      default:
        break;
    }
  }

  private inspectSoldiers(soldiers: Soldier[], participants: Soldier[], rank: SoldierRank): Soldier | null {
    let highestScore = 0;
    let highestRanked: Soldier | null = null;
    for (const soldier of soldiers) {
      if (soldier.getRank() === rank) {
        const score = this.getSoldierScore(soldier);
        if (score > highestScore && (!Options.fieldPromotions || participants.includes(soldier))) {
          highestScore = score;
          highestRanked = soldier;
        }
      }
    }
    return highestRanked;
  }

  private getSoldierScore(soldier: Soldier): number {
    const stats = soldier.getCurrentStats();
    const v1 = 2 * stats.health + 2 * stats.stamina + 4 * stats.reactions + 4 * stats.bravery;
    const v2 = v1 + 3 * (stats.tu + 2 * stats.firing);
    let v3 = v2 + stats.melee + stats.throwing + stats.strength;
    if (stats.psiSkill > 0) {
      v3 += stats.psiStrength + 2 * stats.psiSkill;
    }
    return v3 + 10 * (soldier.getMissions() + soldier.getKills());
  }

  private saveNode(): SavedGameNode {
    return {
      name: this._name,
      time: saveGameTime(this._time),
      ironman: this._ironman,
      difficulty: this._difficulty,
      end: this._end,
      monthsPassed: this._monthsPassed,
      graphRegionToggles: this._graphRegionToggles,
      graphCountryToggles: this._graphCountryToggles,
      graphFinanceToggles: this._graphFinanceToggles,
      funds: [...this._funds],
      maintenance: [...this._maintenance],
      researchScores: [...this._researchScores],
      incomes: [...this._incomes],
      expenditures: [...this._expenditures],
      warned: this._warned,
      globeLon: this._globeLon,
      globeLat: this._globeLat,
      globeZoom: this._globeZoom,
      ids: Object.fromEntries(this._ids),
      countries: this._countries.map(country => country.save()),
      regions: this._regions.map(region => region.save()),
      waypoints: this._waypoints
        .filter((target): target is Waypoint => target instanceof Waypoint)
        .map(waypoint => waypoint.save()),
      missionSites: this._missionSites.map(site => site.save()),
      alienBases: this._alienBases.map(base => base.save()),
      alienMissions: this._alienMissions.map(mission => mission.save()),
      ufos: this._ufos.map(ufo => ufo.save(this._monthsPassed === -1)),
      bases: this._bases.map(base => this.saveBaseNode(base)),
      discovered: this._discovered.map(research => research.getName()),
      poppedResearch: this._poppedResearch.map(research => research.getName()),
      selectedBase: this._selectedBase,
      lastSelectedArmor: this._lastSelectedArmor,
      alienStrategy: this._alienStrategy.save(),
      deadSoldiers: this._deadSoldiers.map(soldier => soldier.save()),
      missionStatistics: this._missionStatistics
        .map(stat => (stat as MissionStatistics & { save?: () => MissionStatisticsSave }).save?.() || (stat as unknown as MissionStatisticsSave)),
      battleGame: this._battleGame?.save() || this._battleGameNode || undefined
    };
  }

  private loadNode(doc: SavedGameNode, mod: Mod | null): void {
    this._difficulty = intValue(doc.difficulty, this._difficulty) as GameDifficulty;
    this._end = intValue(doc.end, this._end) as GameEnding;
    this._monthsPassed = intValue(doc.monthsPassed, this._monthsPassed);
    this._graphRegionToggles = stringValue(doc.graphRegionToggles, this._graphRegionToggles);
    this._graphCountryToggles = stringValue(doc.graphCountryToggles, this._graphCountryToggles);
    this._graphFinanceToggles = stringValue(doc.graphFinanceToggles, this._graphFinanceToggles);
    this._funds = numberArray(doc.funds, this._funds);
    this._maintenance = numberArray(doc.maintenance, this._maintenance);
    this._researchScores = numberArray(doc.researchScores, this._researchScores);
    this._incomes = numberArray(doc.incomes, this._incomes);
    this._expenditures = numberArray(doc.expenditures, this._expenditures);
    this._warned = boolValue(doc.warned, this._warned);
    this._globeLon = numberValue(doc.globeLon, this._globeLon);
    this._globeLat = numberValue(doc.globeLat, this._globeLat);
    this._globeZoom = intValue(doc.globeZoom, this._globeZoom);
    this._selectedBase = intValue(doc.selectedBase, this._selectedBase);
    this._lastSelectedArmor = stringValue(doc.lastSelectedArmor, this._lastSelectedArmor);
    this._ids = new Map(Object.entries(doc.ids || {}).map(([key, value]) => [key, intValue(value, 0)]));

    this._countries = [];
    for (const countryNode of doc.countries || []) {
      const rule = mod?.getCountry(countryNode.type || "");
      if (!rule) {
        continue;
      }
      const country = new Country(rule, false);
      country.load(countryNode);
      this._countries.push(country);
    }

    this._regions = [];
    for (const regionNode of doc.regions || []) {
      const rule = mod?.getRegion(regionNode.type || "");
      if (!rule) {
        continue;
      }
      const region = new Region(rule);
      region.load(regionNode);
      this._regions.push(region);
    }

    this._alienBases = [];
    for (const alienBaseNode of doc.alienBases || []) {
      const deployment = mod?.getDeployment(alienBaseNode.deployment || "STR_ALIEN_BASE_ASSAULT");
      if (!deployment) {
        continue;
      }
      const alienBase = new AlienBase(deployment);
      alienBase.load(alienBaseNode);
      this._alienBases.push(alienBase);
    }

    this._alienMissions = [];
    for (const missionNode of doc.alienMissions || []) {
      const rule = mod?.getAlienMission(missionNode.type || "");
      if (!rule) {
        continue;
      }
      const mission = new AlienMission(rule);
      mission.load(missionNode, this);
      this._alienMissions.push(mission);
    }

    this._ufos = [];
    for (const ufoNode of doc.ufos || []) {
      const rule = mod?.getUfo(ufoNode.type || "");
      if (!rule) {
        continue;
      }
      const ufo = new Ufo(rule);
      ufo.load(ufoNode, mod, this);
      this._ufos.push(ufo);
    }

    this._waypoints = [];
    for (const waypointNode of doc.waypoints || []) {
      const waypoint = new Waypoint();
      waypoint.load(waypointNode);
      this._waypoints.push(waypoint);
    }

    this._missionSites = [];
    for (const siteNode of doc.missionSites || []) {
      const rule = mod?.getAlienMission(siteNode.type || "");
      const deployment = mod?.getDeployment(siteNode.deployment || "STR_TERROR_MISSION");
      if (!rule || !deployment) {
        continue;
      }
      const site = new MissionSite(rule, deployment);
      site.load(siteNode);
      this._missionSites.push(site);
    }

    this._discovered = stringArray(doc.discovered)
      .map(name => researchByName(mod, name))
      .filter((research): research is RuleResearch => research !== null);
    this._poppedResearch = stringArray(doc.poppedResearch)
      .map(name => researchByName(mod, name))
      .filter((research): research is RuleResearch => research !== null);
    if (doc.alienStrategy) {
      this._alienStrategy.load(doc.alienStrategy);
    } else if (mod) {
      this._alienStrategy.init(mod);
    }

    this._bases = (doc.bases || []).map(baseNode => this.loadBaseNode(baseNode, mod));
    if (this._bases.length === 0) {
      this._bases.push(new Base(mod));
    }
    this._deadSoldiers = [];
    for (const soldierNode of doc.deadSoldiers || []) {
      const soldier = this.loadSoldierNode(soldierNode, mod, null);
      if (soldier) {
        this._deadSoldiers.push(soldier);
      }
    }
    this._missionStatistics = (doc.missionStatistics || []).map(stat => ({ ...stat }) as unknown as MissionStatistics);
    if (doc.battleGame) {
      const battle = createRegisteredSavedBattleGame();
      if (battle) {
        battle.load(doc.battleGame, mod, this);
        this._battleGame = battle;
        this._battleGameNode = null;
      } else {
        this._battleGame = null;
        this._battleGameNode = doc.battleGame;
      }
    } else {
      this._battleGame = null;
      this._battleGameNode = null;
    }
  }

  private saveBaseNode(base: Base): SavedGameBaseNode {
    const node: SavedGameBaseNode = {
      lon: base.getLongitude(),
      lat: base.getLatitude(),
      name: base.getName(),
      items: base.getStorageItems().save(),
      scientists: base.getScientists(),
      engineers: base.getEngineers()
    };
    if (base.getFacilities().length > 0) {
      node.facilities = base.getFacilities().map(facility => facility.save());
    }
    if (base.isInBattlescape()) {
      node.inBattlescape = base.isInBattlescape();
    }
    if (base.getRetaliationTarget()) {
      node.retaliationTarget = base.getRetaliationTarget();
    }
    if (base.getSoldiers().length > 0) {
      node.soldiers = base.getSoldiers().map(soldier => soldier.save());
    }
    if (base.getCrafts().length > 0) {
      node.crafts = base.getCrafts().map(craft => craft.save());
    }
    if (base.getTransfers().length > 0) {
      node.transfers = base.getTransfers().map(transfer => transfer.save());
    }
    const research = base.getResearch()
      .map(project => (project as ResearchProjectSavable).save?.())
      .filter((project): project is ResearchProjectSaveNode => Boolean(project));
    if (research.length > 0) {
      node.research = research;
    }
    const productions = base.getProductions()
      .map(production => (production as ProductionSavable).save?.())
      .filter((production): production is ProductionSave => Boolean(production));
    if (productions.length > 0) {
      node.productions = productions;
    }
    return node;
  }

  private loadBaseNode(node: SavedGameBaseNode, mod: Mod | null): Base {
    const base = new Base(mod);
    base.setLongitude(numberValue(node.lon, base.getLongitude()));
    base.setLatitude(numberValue(node.lat, base.getLatitude()));
    base.setName(stringValue(node.name, base.getName()));
    base.getStorageItems().load(node.items);
    base.setScientists(intValue(node.scientists, base.getScientists()));
    base.setEngineers(intValue(node.engineers, base.getEngineers()));
    base.setInBattlescape(boolValue(node.inBattlescape, base.isInBattlescape()));
    base.setRetaliationTarget(boolValue(node.retaliationTarget, base.getRetaliationTarget()));

    base.getFacilities().length = 0;
    for (const facilityNode of node.facilities || []) {
      const rule = mod?.getBaseFacility(facilityNode.type || "") || null;
      if (!rule) {
        continue;
      }
      const facility = new BaseFacility(rule, base);
      facility.load(facilityNode);
      base.getFacilities().push(facility);
    }

    base.getCrafts().length = 0;
    for (const craftNode of node.crafts || []) {
      const rule = mod?.getCraft(craftNode.type || "");
      if (!rule) {
        continue;
      }
      const craft = new Craft(rule, base);
      craft.load(
        craftNode,
        type => mod?.getCraftWeapon(type) || null,
        type => mod?.getItem(type) || null
      );
      const destination = this.resolveSavedTarget(craftNode.dest, base);
      if (destination) {
        craft.setDestination(destination);
      }
      base.getCrafts().push(craft);
    }

    base.getSoldiers().length = 0;
    for (const soldierNode of node.soldiers || []) {
      const soldier = this.loadSoldierNode(soldierNode, mod, base);
      if (!soldier) {
        continue;
      }
      base.getSoldiers().push(soldier);
    }

    base.getTransfers().length = 0;
    for (const transferNode of node.transfers || []) {
      const transfer = new Transfer(intValue(transferNode.hours, 0));
      if (transfer.load(transferNode, base, mod, this)) {
        base.getTransfers().push(transfer);
      }
    }

    base.getResearch().length = 0;
    for (const researchNode of node.research || []) {
      const rule = researchByName(mod, researchNode.project || "");
      if (!rule) {
        base.setScientists(base.getScientists() + intValue(researchNode.assigned, 0));
        continue;
      }
      const project = new ResearchProject(rule);
      project.load(researchNode);
      base.addResearch(project);
    }

    base.getProductions().length = 0;
    for (const productionNode of node.productions || []) {
      const rule = mod?.getManufacture(productionNode.item || "") || null;
      if (!rule) {
        base.setEngineers(base.getEngineers() + intValue(productionNode.assigned, 0));
        continue;
      }
      const production = new Production(rule, 0);
      production.load(productionNode);
      base.addProduction(production);
    }
    return base;
  }

  private loadSoldierNode(soldierNode: SoldierSaveNode, mod: Mod | null, base: Base | null): Soldier | null {
    const fallbackType = mod?.getSoldiersList()[0] || "";
    const rule = mod?.getSoldier(soldierNode.type || fallbackType) || null;
    if (!rule) {
      return null;
    }
    const armor = mod?.getArmor(soldierNode.armor || rule.getArmor()) || null;
    const soldier = new Soldier(rule, armor);
    soldier.load(soldierNode, mod, this);
    if (base) {
      const craftId = soldierNode.craft;
      if (craftId) {
        const craft = base.getCrafts().find(candidate => candidate.getType() === craftId.type && candidate.getId() === intValue(craftId.id, 0));
        if (craft) {
          soldier.setCraft(craft);
        }
      }
    }
    return soldier;
  }

  private resolveSavedTarget(node: TargetSaveNode | null | undefined, currentBase: Base | null = null): TargetLike | null {
    if (!node) {
      return null;
    }
    let type = node.type || "";
    const id = intValue(node.id, 0);
    if (type === "STR_BASE") {
      return currentBase || this._bases.find(base => base.getLongitude() === node.lon && base.getLatitude() === node.lat) || null;
    }
    if (type === "STR_UFO") {
      return this._ufos.find(ufo => ufo.getId() === id) || null;
    }
    if (type === "STR_WAY_POINT") {
      return this._waypoints.find(waypoint => waypoint.getId?.() === id) || null;
    }
    if (type === "STR_ALIEN_TERROR") {
      type = "STR_TERROR_SITE";
    }
    const missionSite = this._missionSites.find(site => site.getId() === id && site.getDeployment().getMarkerName() === type);
    if (missionSite) {
      return missionSite;
    }
    return this._alienBases.find(base => base.getId() === id && base.getDeployment().getMarkerName() === type) || null;
  }

  private truncateMonthlyVectors(): void {
    for (const vector of [this._incomes, this._expenditures, this._researchScores, this._funds, this._maintenance]) {
      if (vector.length > 12) {
        vector.shift();
      }
    }
  }
}
