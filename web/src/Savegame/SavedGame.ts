import { Base } from "./Base.ts";
import type { AlienBase } from "./AlienBase.ts";
import type { AlienMission } from "./AlienMission.ts";
import type { Country } from "./Country.ts";
import { GameTime } from "./GameTime.ts";
import type { Mod } from "../Mod/Mod.ts";
import type { RuleManufacture } from "../Mod/RuleManufacture.ts";
import type { RuleResearch } from "../Mod/RuleResearch.ts";
import type { Region } from "./Region.ts";
import type { Soldier } from "./Soldier.ts";
import { SoldierDeath, type BattleUnitKills } from "./SoldierDeath.ts";
import type { Ufo } from "./Ufo.ts";
import type { SavedBattleGame } from "./SavedBattleGame.ts";
import type { MissionStatistics } from "./MissionStatistics.ts";
import type { MissionSite } from "./MissionSite.ts";
import { getDifficultyCoefficient } from "../Mod/ModStatics.ts";
import type { TargetLike } from "./Target.ts";

export type GlobeTarget = TargetLike;

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
  private _globeLon = 0;
  private _globeLat = 0;
  private _graphRegionToggles = "";
  private _graphCountryToggles = "";
  private _graphFinanceToggles = "";

  constructor() {
    this._bases.push(new Base());
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

  getBases(): Base[] {
    return this._bases;
  }

  getSavedBattle(): SavedBattleGame | null {
    return this._battleGame;
  }

  setSavedBattle(battle: SavedBattleGame | null): void {
    this._battleGame = battle;
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

  private truncateMonthlyVectors(): void {
    for (const vector of [this._incomes, this._expenditures, this._researchScores, this._funds, this._maintenance]) {
      if (vector.length > 12) {
        vector.splice(0, vector.length - 12);
      }
    }
  }
}
