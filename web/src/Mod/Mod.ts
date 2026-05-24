import { Font, parseFontDat } from "../Engine/Font.ts";
import { Logger, LOG_WARNING } from "../Engine/Logger.ts";
import { Options } from "../Engine/Options.ts";
import { Palette } from "../Engine/Palette.ts";
import { Surface } from "../Engine/Surface.ts";
import { SurfaceSet } from "../Engine/SurfaceSet.ts";
import { SavedGame } from "../Savegame/SavedGame.ts";
import type { PaletteColor } from "../types.ts";
import { AlienDeployment, parseAlienDeploymentsRul } from "./AlienDeployment.ts";
import { AlienRace, parseAlienRacesRul } from "./AlienRace.ts";
import { Armor, parseArmorsRul } from "./Armor.ts";
import { RuleGlobe } from "./RuleGlobe.ts";
import { RuleManufacture, parseManufactureRul } from "./RuleManufacture.ts";
import { RuleInterface, parseInterfacesRul } from "./RuleInterface.ts";
import { RuleInventory, parseInventoriesRul } from "./RuleInventory.ts";
import { MapScript, parseMapScriptsRul } from "./MapScript.ts";
import { MapDataSet } from "./MapDataSet.ts";
import { MCDPatch, parseMCDPatchesRul } from "./MCDPatch.ts";
import { MissionObjective, RuleAlienMission, parseAlienMissionsRul } from "./RuleAlienMission.ts";
import { RuleMissionScript, parseMissionScriptsRul } from "./RuleMissionScript.ts";
import { RuleRegion, parseRegionsRul } from "./RuleRegion.ts";
import { RuleResearch, parseResearchRul } from "./RuleResearch.ts";
import { RuleUfo, parseUfosRul } from "./RuleUfo.ts";
import { RuleTerrain, parseTerrainsRul } from "./RuleTerrain.ts";
import { UfoTrajectory, parseUfoTrajectoriesRul } from "./UfoTrajectory.ts";
import { Unit, parseAlienItemLevelsRul, parseUnitsRul } from "./Unit.ts";
import { Region } from "../Savegame/Region.ts";
import { Country } from "../Savegame/Country.ts";
import { RuleBaseFacility, parseFacilitiesRul, parseStartingBaseRul, type StartingBaseDefinition } from "./RuleBaseFacility.ts";
import { BaseFacility } from "../Savegame/BaseFacility.ts";
import { RuleCountry, parseCountriesRul } from "./RuleCountry.ts";
import { RuleCraft, parseCraftsRul } from "./RuleCraft.ts";
import { RuleCraftWeapon, parseCraftWeaponsRul } from "./RuleCraftWeapon.ts";
import { RuleItem, parseItemsRul } from "./RuleItem.ts";
import { Craft } from "../Savegame/Craft.ts";
import type { Base } from "../Savegame/Base.ts";
import { RuleSoldier, parseSoldiersRul } from "./RuleSoldier.ts";
import { SoldierNamePool } from "./SoldierNamePool.ts";
import { StatString, parseStatStringsRul } from "./StatString.ts";
import { Soldier } from "../Savegame/Soldier.ts";
import { RNG } from "../Engine/RNG.ts";
import { resetDifficultyCoefficients, setDifficultyCoefficient } from "./ModStatics.ts";

type ResourceManifest = {
  ufoPalettesDat?: string | null;
  ufoBackPalsDat?: string | null;
  ufoBack01Scr?: string | null;
  ufoBack02Scr?: string | null;
  ufoBack05Scr?: string | null;
  ufoBack06Scr?: string | null;
  ufoBack07Scr?: string | null;
  ufoBack12Scr?: string | null;
  ufoBack13Scr?: string | null;
  ufoBack14Scr?: string | null;
  ufoBack15Scr?: string | null;
  ufoBack17Scr?: string | null;
  ufoGeobordScr?: string | null;
  ufoAltGeobordScr?: string | null;
  ufoGraphBdy?: string | null;
  ufoGraphsSpk?: string | null;
  ufoWorldDat?: string | null;
  ufoTextureDat?: string | null;
  ufoTerrainDir?: string | null;
  ufoMapsDir?: string | null;
  ufoRoutesDir?: string | null;
  ufoLoftempsDat?: string | null;
  ufoBasebitsPck?: string | null;
  ufoBasebitsTab?: string | null;
  ufoFloorobPck?: string | null;
  ufoFloorobTab?: string | null;
  ufoScangDat?: string | null;
  ufoScanbordPck?: string | null;
  ufoDetbordPck?: string | null;
  ufoDetbord2Pck?: string | null;
  ufoDetblobDat?: string | null;
  ufoMedibordPck?: string | null;
  ufoMedibitsDat?: string | null;
  ufoUnibordPck?: string | null;
  commonSoldierNameFiles?: string[];
  tftdPalettesDat?: string | null;
  tftdBackPalsDat?: string | null;
  tftdBack01Scr?: string | null;
  tftdBack12Scr?: string | null;
  tftdBack15Scr?: string | null;
  tftdBack17Scr?: string | null;
  tftdGeobordScr?: string | null;
  tftdAltGeobordScr?: string | null;
  tftdGraphBdy?: string | null;
  tftdGraphsSpk?: string | null;
  tftdWorldDat?: string | null;
  tftdTextureDat?: string | null;
  tftdTerrainDir?: string | null;
  tftdMapsDir?: string | null;
  tftdRoutesDir?: string | null;
  tftdLoftempsDat?: string | null;
  tftdBasebitsPck?: string | null;
  tftdBasebitsTab?: string | null;
  tftdFloorobPck?: string | null;
  tftdFloorobTab?: string | null;
};

export class Mod {
  static GEOSCAPE_CURSOR = 252;
  static BASESCAPE_CURSOR = 252;
  static BATTLESCAPE_CURSOR = 144;
  static UFOPAEDIA_CURSOR = 252;
  static GRAPHS_CURSOR = 252;

  private fonts = new Map<string, Font>();
  private palettes = new Map<string, PaletteColor[]>();
  private surfaces = new Map<string, Surface>();
  private surfaceSets = new Map<string, SurfaceSet>();
  private interfaces = new Map<string, RuleInterface>();
  private regions = new Map<string, RuleRegion>();
  private regionsIndex: string[] = [];
  private countries = new Map<string, RuleCountry>();
  private countriesIndex: string[] = [];
  private research = new Map<string, RuleResearch>();
  private researchIndex: string[] = [];
  private manufacture = new Map<string, RuleManufacture>();
  private manufactureIndex: string[] = [];
  private psiRequirements: string[] = [];
  private finalResearch = "";
  private baseFacilities = new Map<string, RuleBaseFacility>();
  private baseFacilitiesIndex: string[] = [];
  private crafts = new Map<string, RuleCraft>();
  private craftsIndex: string[] = [];
  private craftWeapons = new Map<string, RuleCraftWeapon>();
  private craftWeaponsIndex: string[] = [];
  private ufos = new Map<string, RuleUfo>();
  private ufosIndex: string[] = [];
  private terrains = new Map<string, RuleTerrain>();
  private terrainIndex: string[] = [];
  private mapScripts = new Map<string, MapScript[]>();
  private mapScriptIndex: string[] = [];
  private ufoTrajectories = new Map<string, UfoTrajectory>();
  private alienMissions = new Map<string, RuleAlienMission>();
  private alienMissionsIndex: string[] = [];
  private missionScripts = new Map<string, RuleMissionScript>();
  private missionScriptIndex: string[] = [];
  private alienRaces = new Map<string, AlienRace>();
  private alienRacesIndex: string[] = [];
  private alienDeployments = new Map<string, AlienDeployment>();
  private alienDeploymentsIndex: string[] = [];
  private items = new Map<string, RuleItem>();
  private itemsIndex: string[] = [];
  private invs = new Map<string, RuleInventory>();
  private invsIndex: string[] = [];
  private mapDataSets = new Map<string, MapDataSet>();
  private MCDPatches = new Map<string, MCDPatch>();
  private voxelData: number[] = [];
  private armors = new Map<string, Armor>();
  private armorsIndex: string[] = [];
  private units = new Map<string, Unit>();
  private unitsIndex: string[] = [];
  private alienItemLevels: number[][] = [];
  private soldiers = new Map<string, RuleSoldier>();
  private soldiersIndex: string[] = [];
  private statStrings: StatString[] = [];
  private startingBase: StartingBaseDefinition = { facilities: [], crafts: [], items: {} };
  private costEngineer = 0;
  private costScientist = 0;
  private timePersonnel = 0;
  private initialFunding = 6000;
  private turnAIUseGrenade = 3;
  private turnAIUseBlaster = 3;
  private globe = new RuleGlobe();
  private manifest: ResourceManifest = {};

  async loadAll(): Promise<void> {
    this.manifest = await this.loadResourceManifest();
    await this.loadVanillaResources();
    await this.loadVars();
    await this.loadMCDPatches();
    await this.loadVoxelData();
    await this.loadRuleFacilities();
    await this.loadRuleCrafts();
    await this.loadRuleCraftWeapons();
    await this.loadRuleUfos();
    await this.loadRuleTerrains();
    await this.loadMapScripts();
    await this.loadUfoTrajectories();
    await this.loadRuleAlienMissions();
    await this.loadAlienRaces();
    await this.loadAlienDeployments();
    await this.loadRuleItems();
    await this.loadRuleInventories();
    await this.loadRuleArmors();
    await this.loadRuleUnits();
    await this.loadAlienItemLevels();
    await this.loadRuleResearch();
    await this.loadRuleManufacture();
    await this.loadRuleSoldiers();
    await this.loadRuleStatStrings();
    await this.loadStartingBase();
    await this.loadRuleCountries();
    await this.loadRuleRegions();
    await this.loadRuleMissionScripts();
    await this.loadRuleInterfaces();
  }

  getFont(name: string): Font | null {
    return this.fonts.get(name) || null;
  }

  getPalette(name: string): PaletteColor[] | null {
    return this.palettes.get(name) || null;
  }

  getSurface(name: string): Surface | null {
    return this.surfaces.get(name) || null;
  }

  getSurfaceSet(name: string): SurfaceSet | null {
    return this.surfaceSets.get(name) || null;
  }

  getInterface(type: string): RuleInterface | null {
    return this.interfaces.get(type) || null;
  }

  getGlobe(): RuleGlobe {
    return this.globe;
  }

  getTurnAIUseGrenade(): number {
    return this.turnAIUseGrenade;
  }

  getTurnAIUseBlaster(): number {
    return this.turnAIUseBlaster;
  }

  getRegion(type: string): RuleRegion | null {
    return this.regions.get(type) || null;
  }

  getRegionsList(): string[] {
    return this.regionsIndex;
  }

  getCountry(type: string, error = false): RuleCountry | null {
    const country = this.countries.get(type) || null;
    if (!country && error) {
      throw new Error(`Country rule ${type} not found.`);
    }
    return country;
  }

  getCountriesList(): string[] {
    return this.countriesIndex;
  }

  getResearch(type: string, error = false): RuleResearch | null {
    const research = this.research.get(type) || null;
    if (!research && error) {
      throw new Error(`Research rule ${type} not found.`);
    }
    return research;
  }

  getResearchList(): string[] {
    return this.researchIndex;
  }

  getPsiRequirements(): string[] {
    return this.psiRequirements;
  }

  getFinalResearch(): string {
    return this.finalResearch;
  }

  getManufacture(type: string, error = false): RuleManufacture | null {
    const manufacture = this.manufacture.get(type) || null;
    if (!manufacture && error) {
      throw new Error(`Manufacture rule ${type} not found.`);
    }
    return manufacture;
  }

  getManufactureList(): string[] {
    return this.manufactureIndex;
  }

  getBaseFacility(type: string): RuleBaseFacility | null {
    return this.baseFacilities.get(type) || null;
  }

  getBaseFacilitiesList(): string[] {
    return this.baseFacilitiesIndex;
  }

  getCustomBaseFacilities(): RuleBaseFacility[] {
    const placeList: RuleBaseFacility[] = [];
    for (const facilityDefinition of this.startingBase.facilities) {
      const facility = this.getBaseFacility(facilityDefinition.type);
      if (facility && !facility.isLift()) {
        placeList.push(facility);
      }
    }
    return placeList;
  }

  getMinRadarRange(): number {
    let minRadarRange = 0;
    for (const type of this.baseFacilitiesIndex) {
      const facility = this.getBaseFacility(type);
      if (!facility) {
        continue;
      }
      const radarRange = facility.getRadarRange();
      if (radarRange > 0 && (minRadarRange === 0 || minRadarRange > radarRange)) {
        minRadarRange = radarRange;
      }
    }
    return minRadarRange;
  }

  getCraft(type: string): RuleCraft | null {
    return this.crafts.get(type) || null;
  }

  getCraftsList(): string[] {
    return this.craftsIndex;
  }

  getCraftWeapon(type: string): RuleCraftWeapon | null {
    return this.craftWeapons.get(type) || null;
  }

  getCraftWeaponsList(): string[] {
    return this.craftWeaponsIndex;
  }

  getUfo(type: string, error = false): RuleUfo | null {
    const ufo = this.ufos.get(type) || null;
    if (!ufo && error) {
      throw new Error(`UFO rule ${type} not found.`);
    }
    return ufo;
  }

  getUfosList(): string[] {
    return this.ufosIndex;
  }

  getTerrain(name: string, error = false): RuleTerrain | null {
    const terrain = this.terrains.get(name) || null;
    if (!terrain && error) {
      throw new Error(`Terrain rule ${name} not found.`);
    }
    return terrain;
  }

  getTerrainList(): string[] {
    return this.terrainIndex;
  }

  getMapScript(id: string): MapScript[] | null {
    return this.mapScripts.get(id) || null;
  }

  getMapScriptList(): string[] {
    return this.mapScriptIndex;
  }

  getUfoTrajectory(id: string, error = false): UfoTrajectory | null {
    const trajectory = this.ufoTrajectories.get(id) || null;
    if (!trajectory && error) {
      throw new Error(`Trajectory ${id} not found.`);
    }
    return trajectory;
  }

  getAlienMission(id: string, error = false): RuleAlienMission | null {
    const mission = this.alienMissions.get(id) || null;
    if (!mission && error) {
      throw new Error(`Alien Mission ${id} not found.`);
    }
    return mission;
  }

  getRandomMission(objective: MissionObjective, monthsPassed: number): RuleAlienMission | null {
    let totalWeight = 0;
    const possibilities: Array<[number, RuleAlienMission]> = [];
    const missions = [...this.alienMissions.values()].sort((a, b) => a.getType().localeCompare(b.getType()));
    for (const mission of missions) {
      const weight = mission.getWeight(monthsPassed);
      if (mission.getObjective() === objective && weight > 0) {
        totalWeight += weight;
        possibilities.push([totalWeight, mission]);
      }
    }
    if (totalWeight > 0) {
      const pick = RNG.generate(1, totalWeight);
      for (const [threshold, mission] of possibilities) {
        if (pick <= threshold) {
          return mission;
        }
      }
    }
    return null;
  }

  getAlienMissionList(): string[] {
    return this.alienMissionsIndex;
  }

  getMissionScript(name: string, error = false): RuleMissionScript | null {
    const script = this.missionScripts.get(name) || null;
    if (!script && error) {
      throw new Error(`Mission Script ${name} not found.`);
    }
    return script;
  }

  getMissionScriptList(): string[] {
    return this.missionScriptIndex;
  }

  getAlienRace(id: string, error = false): AlienRace | null {
    const race = this.alienRaces.get(id) || null;
    if (!race && error) {
      throw new Error(`Alien Race ${id} not found.`);
    }
    return race;
  }

  getAlienRacesList(): string[] {
    return this.alienRacesIndex;
  }

  getDeployment(type: string, error = false): AlienDeployment | null {
    const deployment = this.alienDeployments.get(type) || null;
    if (!deployment && error) {
      throw new Error(`Alien Deployment ${type} not found.`);
    }
    return deployment;
  }

  getDeploymentsList(): string[] {
    return this.alienDeploymentsIndex;
  }

  getItem(type: string, error = false): RuleItem | null {
    if (!type || type === "STR_NONE") {
      return null;
    }
    const item = this.items.get(type) || null;
    if (!item && error) {
      throw new Error(`Item rule ${type} not found.`);
    }
    return item;
  }

  getItemsList(): string[] {
    return this.itemsIndex;
  }

  getInventories(): Map<string, RuleInventory> {
    return this.invs;
  }

  getInventory(id: string, error = false): RuleInventory | null {
    const inv = this.invs.get(id) || null;
    if (!inv && error) {
      throw new Error(`Inventory ${id} not found.`);
    }
    return inv;
  }

  getInvsList(): string[] {
    return this.invsIndex;
  }

  getMapDataSet(name: string): MapDataSet {
    let set = this.mapDataSets.get(name);
    if (!set) {
      set = new MapDataSet(name);
      this.mapDataSets.set(name, set);
    }
    return set;
  }

  getMapDataSetsList(): string[] {
    return [...this.mapDataSets.keys()];
  }

  getMCDPatch(id: string): MCDPatch | null {
    return this.MCDPatches.get(id) || null;
  }

  getVoxelData(): number[] {
    return this.voxelData;
  }

  async loadMapDataSet(name: string, ruleset = "xcom1"): Promise<MapDataSet> {
    const set = this.getMapDataSet(name);
    if (set.getSize() > 0) {
      return set;
    }
    const terrainDir = ruleset === "xcom2" ? this.manifest.tftdTerrainDir : this.manifest.ufoTerrainDir;
    if (!terrainDir) {
      throw new Error(`Original TERRAIN directory not available for ${ruleset}.`);
    }
    const mcd = await this.fetchOptionalBinary(`${terrainDir}/${name}.MCD`);
    const pck = await this.fetchOptionalBinary(`${terrainDir}/${name}.PCK`);
    const tab = await this.fetchOptionalBinary(`${terrainDir}/${name}.TAB`);
    if (!mcd) {
      throw new Error(`TERRAIN/${name}.MCD not found`);
    }
    if (!pck || !tab) {
      throw new Error(`TERRAIN/${name}.PCK/TAB not found`);
    }
    set.loadData(mcd, pck, tab, this.getMCDPatch(name));
    return set;
  }

  async loadMapBlock(name: string, ruleset = "xcom1"): Promise<ArrayBuffer> {
    const mapsDir = ruleset === "xcom2" ? this.manifest.tftdMapsDir : this.manifest.ufoMapsDir;
    if (!mapsDir) {
      throw new Error(`Original MAPS directory not available for ${ruleset}.`);
    }
    const map = await this.fetchOptionalBinary(`${mapsDir}/${name}.MAP`);
    if (!map) {
      throw new Error(`MAPS/${name}.MAP not found`);
    }
    return map;
  }

  async loadRoute(name: string, ruleset = "xcom1"): Promise<ArrayBuffer> {
    const routesDir = ruleset === "xcom2" ? this.manifest.tftdRoutesDir : this.manifest.ufoRoutesDir;
    if (!routesDir) {
      throw new Error(`Original ROUTES directory not available for ${ruleset}.`);
    }
    const route = await this.fetchOptionalBinary(`${routesDir}/${name}.RMP`);
    if (!route) {
      throw new Error(`ROUTES/${name}.RMP not found`);
    }
    return route;
  }

  getArmor(type: string): Armor | null {
    return this.armors.get(type) || null;
  }

  getArmorsList(): string[] {
    return this.armorsIndex;
  }

  getUnit(type: string, error = false): Unit | null {
    const unit = this.units.get(type) || null;
    if (!unit && error) {
      throw new Error(`Unit ${type} not found.`);
    }
    return unit;
  }

  getUnitsList(): string[] {
    return this.unitsIndex;
  }

  getAlienItemLevels(): number[][] {
    return this.alienItemLevels;
  }

  getSoldier(type: string): RuleSoldier | null {
    return this.soldiers.get(type) || null;
  }

  getSoldiersList(): string[] {
    return this.soldiersIndex;
  }

  getStatStrings(): StatString[] {
    return this.statStrings;
  }

  getEngineerCost(): number {
    return this.costEngineer;
  }

  getScientistCost(): number {
    return this.costScientist;
  }

  getPersonnelTime(): number {
    return this.timePersonnel;
  }

  playMusic(name: string, _id = 0): void {
    Logger.log(LOG_WARNING, `Music ${name} is not translated yet; browser runtime stays muted.`);
  }

  genSoldier(save: SavedGame, type = ""): Soldier | null {
    let soldier: Soldier | null = null;
    const soldierType = type || this.soldiersIndex[0] || "";
    const rules = this.getSoldier(soldierType);
    if (!rules) {
      return null;
    }
    const newId = save.getId("STR_SOLDIER");
    const armor = this.getArmor(rules.getArmor());
    if (!armor) {
      Logger.log(LOG_WARNING, `Soldier armor ${rules.getArmor()} has no matching rule.`);
    }
    let duplicate = true;
    for (let tries = 0; tries < 10 && duplicate; ++tries) {
      soldier = new Soldier(rules, armor, newId);
      duplicate = false;
      for (const base of save.getBases()) {
        for (const existing of base.getSoldiers()) {
          if (existing.getName() === soldier.getName()) {
            duplicate = true;
            break;
          }
        }
        if (!duplicate) {
          for (const transfer of base.getTransfers()) {
            if (transfer.getSoldier()?.getName() === soldier.getName()) {
              duplicate = true;
              break;
            }
          }
        }
        if (duplicate) {
          break;
        }
      }
    }
    soldier?.calcStatString(this.getStatStrings(), Options.psiStrengthEval && save.isResearched(this.getPsiRequirements()));
    return soldier;
  }

  newSave(): SavedGame {
    const save = new SavedGame();
    for (const type of this.countriesIndex) {
      const rule = this.countries.get(type);
      if (rule && rule.getLonMin().length > 0) {
        save.getCountries().push(new Country(rule));
      }
    }
    if (save.getCountries().length > 0) {
      const missing = Math.trunc((this.initialFunding - Math.trunc(save.getCountryFunding() / 1000)) / save.getCountries().length) * 1000;
      for (const country of save.getCountries()) {
        const funding = country.getFunding().at(-1) || 0;
        const adjusted = funding + missing;
        country.setFunding(adjusted < 0 ? funding : adjusted);
      }
      save.setFunds(save.getCountryFunding());
    }
    for (const type of this.regionsIndex) {
      const rule = this.regions.get(type);
      if (rule) {
        save.getRegions().push(new Region(rule));
      }
    }
    this.loadStartingBaseIntoSave(save);
    return save;
  }

  setPalette(colors: PaletteColor[], firstcolor = 0, ncolors = colors.length): void {
    for (const font of this.fonts.values()) {
      font.setPalette(colors, firstcolor, ncolors);
    }
    for (const surface of this.surfaces.values()) {
      surface.setPalette(colors, firstcolor, ncolors);
    }
    for (const surfaceSet of this.surfaceSets.values()) {
      surfaceSet.setPalette(colors, firstcolor, ncolors);
    }
  }

  private async loadVanillaResources(): Promise<void> {
    await this.loadPalettes();
    await this.loadFonts();
    await this.loadSurfaces();
    await this.loadSurfaceSets();
    await this.loadGlobe();
  }

  private async loadFonts(): Promise<void> {
    const response = await fetch("../bin/common/Language/Font.dat");
    if (!response.ok) {
      throw new Error(`Font.dat: ${response.status} ${response.statusText}`);
    }
    const definitions = parseFontDat(await response.text());
    for (const definition of definitions) {
      if (definition.id !== "FONT_BIG" && definition.id !== "FONT_SMALL") {
        continue;
      }
      const font = new Font();
      await font.load(definition, "bin/common/Language");
      this.fonts.set(definition.id, font);
    }
  }

  private async loadPalettes(): Promise<void> {
    const names = ["PAL_GEOSCAPE", "PAL_BASESCAPE", "PAL_GRAPHS", "PAL_UFOPAEDIA", "PAL_BATTLEPEDIA"];
    for (const name of names) {
      this.palettes.set(name, Palette.createDefault());
    }
    this.palettes.set("PAL_BATTLESCAPE", Palette.createDefault());
    this.palettes.set("BACKPALS.DAT", Palette.createDefaultBackPals());

    if (!this.manifest.ufoPalettesDat) {
      Logger.log(LOG_WARNING, "Original GEODATA/PALETTES.DAT not available; using browser fallback palettes.");
      return;
    }

    const palettesDat = await this.fetchOptionalBinary(this.manifest.ufoPalettesDat);
    if (!palettesDat) {
      Logger.log(LOG_WARNING, `${this.manifest.ufoPalettesDat} not found; using browser fallback palettes.`);
      return;
    }

    names.forEach((name, index) => {
      this.palettes.set(name, Palette.loadDat(palettesDat, 256, Palette.palOffset(index)));
    });

    const battlescape = Palette.loadDat(palettesDat, 256, Palette.palOffset(4));
    const gradient: PaletteColor[] = [
      { r: 140, g: 152, b: 148, a: 255 },
      { r: 132, g: 136, b: 140, a: 255 },
      { r: 116, g: 124, b: 132, a: 255 },
      { r: 108, g: 116, b: 124, a: 255 },
      { r: 92, g: 104, b: 108, a: 255 },
      { r: 84, g: 92, b: 100, a: 255 },
      { r: 76, g: 80, b: 92, a: 255 },
      { r: 56, g: 68, b: 84, a: 255 },
      { r: 48, g: 56, b: 68, a: 255 },
      { r: 40, g: 48, b: 56, a: 255 },
      { r: 32, g: 36, b: 48, a: 255 },
      { r: 24, g: 28, b: 32, a: 255 },
      { r: 16, g: 20, b: 24, a: 255 },
      { r: 8, g: 12, b: 16, a: 255 },
      { r: 3, g: 4, b: 8, a: 255 },
      { r: 3, g: 3, b: 6, a: 255 }
    ];
    for (let i = 0; i < gradient.length; ++i) {
      battlescape[Palette.backPos + 16 + i] = gradient[i];
    }
    this.palettes.set("PAL_BATTLESCAPE", battlescape);

    const backpalsDat = await this.fetchOptionalBinary(this.manifest.ufoBackPalsDat);
    if (backpalsDat) {
      this.palettes.set("BACKPALS.DAT", Palette.loadDat(backpalsDat, 128));
    } else {
      Logger.log(LOG_WARNING, "Original GEODATA/BACKPALS.DAT not found; using browser fallback BACKPALS.");
    }
  }

  private async loadSurfaces(): Promise<void> {
    const back01 = new Surface(320, 200);
    const back01Scr = await this.fetchOptionalBinary(this.manifest.ufoBack01Scr);
    if (back01Scr) {
      back01.loadScr(back01Scr);
    } else {
      this.drawFallbackBack01(back01);
    }
    this.surfaces.set("BACK01.SCR", back01);

    await this.loadOptionalScrSurface("BACK02.SCR", this.manifest.ufoBack02Scr, surface => this.drawFallbackBack01(surface));
    await this.loadOptionalScrSurface("BACK05.SCR", this.manifest.ufoBack05Scr, surface => this.drawFallbackBack01(surface));
    await this.loadOptionalScrSurface("BACK06.SCR", this.manifest.ufoBack06Scr, surface => this.drawFallbackBack01(surface));
    await this.loadOptionalScrSurface("BACK07.SCR", this.manifest.ufoBack07Scr, surface => this.drawFallbackBack01(surface));
    const back07 = this.surfaces.get("BACK07.SCR");
    if (back07) {
      this.surfaces.set("ALTBACK07.SCR", this.createAltBack07(back07));
    }
    await this.loadOptionalScrSurface("BACK12.SCR", this.manifest.ufoBack12Scr, surface => this.drawFallbackBack01(surface));
    await this.loadOptionalScrSurface("BACK13.SCR", this.manifest.ufoBack13Scr, surface => this.drawFallbackBack01(surface));
    await this.loadOptionalScrSurface("BACK14.SCR", this.manifest.ufoBack14Scr, surface => this.drawFallbackBack01(surface));
    await this.loadOptionalScrSurface("BACK15.SCR", this.manifest.ufoBack15Scr, surface => this.drawFallbackBack01(surface));
    await this.loadOptionalScrSurface("BACK17.SCR", this.manifest.ufoBack17Scr, surface => this.drawFallbackBack01(surface));
    await this.loadOptionalBdySurface("GRAPH.BDY", this.manifest.ufoGraphBdy || this.manifest.tftdGraphBdy, surface => this.drawFallbackGraphs(surface));
    await this.loadOptionalSpkSurface("GRAPHS.SPK", this.manifest.ufoGraphsSpk || this.manifest.tftdGraphsSpk, surface => this.drawFallbackGraphs(surface));

    const geobord = new Surface(320, 200);
    const geobordScr = await this.fetchOptionalBinary(this.manifest.ufoGeobordScr);
    if (geobordScr) {
      geobord.loadScr(geobordScr);
    } else {
      this.drawFallbackBack01(geobord);
    }
    this.surfaces.set("GEOBORD.SCR", geobord);

    const altGeobordScr = await this.fetchOptionalBinary(this.manifest.ufoAltGeobordScr);
    if (altGeobordScr) {
      const alt = new Surface(320, 200);
      alt.loadScr(altGeobordScr);
      this.surfaces.set("ALTGEOBORD.SCR", alt);
    } else {
      this.surfaces.set("ALTGEOBORD.SCR", this.createAltGeobord(geobord));
    }

    await this.loadOptionalSpkSurface("SCANBORD.PCK", this.manifest.ufoScanbordPck, surface => this.drawFallbackMiniMapBorder(surface));
    await this.loadOptionalSpkSurface("DETBORD.PCK", this.manifest.ufoDetbordPck, surface => this.drawFallbackScannerBorder(surface));
    await this.loadOptionalSpkSurface("DETBORD2.PCK", this.manifest.ufoDetbord2Pck, surface => this.drawFallbackScannerScan(surface));
    await this.loadOptionalSpkSurface("MEDIBORD.PCK", this.manifest.ufoMedibordPck, surface => this.drawFallbackMedikitBorder(surface));
    await this.loadOptionalSpkSurface("UNIBORD.PCK", this.manifest.ufoUnibordPck, surface => this.drawFallbackUnitInfoBorder(surface));
    const unibord = this.surfaces.get("UNIBORD.PCK");
    if (unibord) {
      this.adjustUnitInfoBorder(unibord);
    }
  }

  private async loadSurfaceSets(): Promise<void> {
    this.surfaceSets.clear();
    const basebitsPck = await this.fetchOptionalBinary(this.manifest.ufoBasebitsPck);
    const basebitsTab = await this.fetchOptionalBinary(this.manifest.ufoBasebitsTab);
    if (basebitsPck && basebitsTab) {
      const basebits = new SurfaceSet(32, 40);
      basebits.loadPck(basebitsPck, basebitsTab);
      this.surfaceSets.set("BASEBITS.PCK", basebits);
    } else {
      Logger.log(LOG_WARNING, "Original GEOGRAPH/BASEBITS.PCK/TAB not found; basescape uses fallback facility blocks.");
    }

    const floorobPck = await this.fetchOptionalBinary(this.manifest.ufoFloorobPck);
    const floorobTab = await this.fetchOptionalBinary(this.manifest.ufoFloorobTab);
    if (floorobPck && floorobTab) {
      const floorob = new SurfaceSet(32, 40);
      floorob.loadPck(floorobPck, floorobTab);
      this.surfaceSets.set("FLOOROB.PCK", floorob);
    }

    const scangDat = await this.fetchOptionalBinary(this.manifest.ufoScangDat);
    if (scangDat) {
      const scang = new SurfaceSet(4, 4);
      scang.loadDat(scangDat);
      this.surfaceSets.set("SCANG.DAT", scang);
    } else {
      this.surfaceSets.set("SCANG.DAT", this.createFallbackScang());
    }

    const detblobDat = await this.fetchOptionalBinary(this.manifest.ufoDetblobDat);
    if (detblobDat) {
      const detblob = new SurfaceSet(16, 16);
      detblob.loadDat(detblobDat);
      this.surfaceSets.set("DETBLOB.DAT", detblob);
    } else {
      this.surfaceSets.set("DETBLOB.DAT", this.createFallbackDetblob());
    }

    const medibitsDat = await this.fetchOptionalBinary(this.manifest.ufoMedibitsDat);
    if (medibitsDat) {
      const medibits = new SurfaceSet(52, 58);
      medibits.loadDat(medibitsDat);
      this.surfaceSets.set("MEDIBITS.DAT", medibits);
    } else {
      this.surfaceSets.set("MEDIBITS.DAT", this.createFallbackMedibits());
    }
  }

  private async loadMCDPatches(): Promise<void> {
    const patchesResponse = await fetch("../bin/standard/xcom1/mcdPatches.rul");
    if (!patchesResponse.ok) {
      throw new Error(`mcdPatches.rul: ${patchesResponse.status} ${patchesResponse.statusText}`);
    }
    this.MCDPatches.clear();
    for (const definition of parseMCDPatchesRul(await patchesResponse.text())) {
      const patch = new MCDPatch();
      patch.load(definition);
      this.MCDPatches.set(definition.type, patch);
    }
  }

  private async loadVoxelData(): Promise<void> {
    this.voxelData = [];
    const loftemps = await this.fetchOptionalBinary(this.manifest.ufoLoftempsDat);
    if (!loftemps) {
      Logger.log(LOG_WARNING, "Original LOFTEMPS.DAT not found; battlescape voxel data is empty.");
      return;
    }
    this.voxelData = MapDataSet.loadLOFTEMPS(loftemps);
  }

  private async loadRuleInterfaces(): Promise<void> {
    const interfacesResponse = await fetch("../bin/standard/xcom1/interfaces.rul");
    if (!interfacesResponse.ok) {
      throw new Error(`interfaces.rul: ${interfacesResponse.status} ${interfacesResponse.statusText}`);
    }
    for (const definition of parseInterfacesRul(await interfacesResponse.text())) {
      const rule = new RuleInterface(definition.type);
      rule.load(definition);
      this.interfaces.set(definition.type, rule);
    }
  }

  private async loadVars(): Promise<void> {
    resetDifficultyCoefficients();
    const varsResponse = await fetch("../bin/standard/xcom1/vars.rul");
    if (!varsResponse.ok) {
      throw new Error(`vars.rul: ${varsResponse.status} ${varsResponse.statusText}`);
    }
    const source = await varsResponse.text();
    const lines = source.split(/\r?\n/);
    for (let i = 0; i < lines.length; ++i) {
      const raw = lines[i];
      const line = raw.split("#", 1)[0].trim();
      const difficultyCoefficient = /^difficultyCoefficient:\s*(.*)$/.exec(line);
      if (difficultyCoefficient) {
        const inline = difficultyCoefficient[1].trim();
        let values: number[] = [];
        if (inline.startsWith("[")) {
          values = inline.replace(/^\[/, "").replace(/\]$/, "").split(",").map(value => Number(value.trim())).filter(Number.isFinite);
        } else {
          while (i + 1 < lines.length) {
            const item = lines[i + 1].split("#", 1)[0].trim();
            const itemMatch = /^-\s*(-?\d+)/.exec(item);
            if (!itemMatch) {
              break;
            }
            values.push(Number(itemMatch[1]));
            ++i;
          }
        }
        for (let index = 0; index < values.length && index < 5; ++index) {
          setDifficultyCoefficient(index, values[index]);
        }
        continue;
      }
      const match = /^([A-Za-z0-9_]+):\s*(-?\d+)/.exec(line);
      if (!match) {
        continue;
      }
      const value = Number(match[2]);
      if (match[1] === "costEngineer") {
        this.costEngineer = value;
      } else if (match[1] === "costScientist") {
        this.costScientist = value;
      } else if (match[1] === "timePersonnel") {
        this.timePersonnel = value;
      } else if (match[1] === "initialFunding") {
        this.initialFunding = value;
      } else if (match[1] === "turnAIUseGrenade") {
        this.turnAIUseGrenade = value;
      } else if (match[1] === "turnAIUseBlaster") {
        this.turnAIUseBlaster = value;
      }
    }
  }

  private async loadRuleRegions(): Promise<void> {
    const regionsResponse = await fetch("../bin/standard/xcom1/regions.rul");
    if (!regionsResponse.ok) {
      throw new Error(`regions.rul: ${regionsResponse.status} ${regionsResponse.statusText}`);
    }
    this.regions.clear();
    this.regionsIndex = [];
    for (const definition of parseRegionsRul(await regionsResponse.text())) {
      const rule = new RuleRegion(definition.type);
      rule.load(definition);
      this.regions.set(definition.type, rule);
      this.regionsIndex.push(definition.type);
    }
  }

  private async loadRuleCountries(): Promise<void> {
    const countriesResponse = await fetch("../bin/standard/xcom1/countries.rul");
    if (!countriesResponse.ok) {
      throw new Error(`countries.rul: ${countriesResponse.status} ${countriesResponse.statusText}`);
    }
    this.countries.clear();
    this.countriesIndex = [];
    for (const definition of parseCountriesRul(await countriesResponse.text())) {
      const rule = new RuleCountry(definition.type);
      rule.load(definition);
      this.countries.set(definition.type, rule);
      this.countriesIndex.push(definition.type);
    }
  }

  private async loadRuleResearch(): Promise<void> {
    const researchResponse = await fetch("../bin/standard/xcom1/research.rul");
    if (!researchResponse.ok) {
      throw new Error(`research.rul: ${researchResponse.status} ${researchResponse.statusText}`);
    }
    this.research.clear();
    this.researchIndex = [];
    this.finalResearch = "";
    let listOrder = 0;
    for (const definition of parseResearchRul(await researchResponse.text())) {
      listOrder += 100;
      const rule = new RuleResearch(definition.name);
      rule.load(definition, listOrder);
      this.research.set(definition.name, rule);
      this.researchIndex.push(definition.name);
      if (definition.unlockFinalMission) {
        this.finalResearch = definition.name || this.finalResearch;
      }
    }
    this.refreshPsiRequirements();
  }

  private async loadRuleManufacture(): Promise<void> {
    const manufactureResponse = await fetch("../bin/standard/xcom1/manufacture.rul");
    if (!manufactureResponse.ok) {
      throw new Error(`manufacture.rul: ${manufactureResponse.status} ${manufactureResponse.statusText}`);
    }
    this.manufacture.clear();
    this.manufactureIndex = [];
    let listOrder = 0;
    for (const definition of parseManufactureRul(await manufactureResponse.text())) {
      listOrder += 100;
      const rule = new RuleManufacture(definition.name);
      rule.load(definition, listOrder);
      this.manufacture.set(definition.name, rule);
      this.manufactureIndex.push(definition.name);
    }
  }

  private refreshPsiRequirements(): void {
    this.psiRequirements = [];
    for (const type of this.baseFacilitiesIndex) {
      const rule = this.baseFacilities.get(type);
      if (rule && rule.getPsiLaboratories() > 0) {
        this.psiRequirements = [...rule.getRequirements()];
        break;
      }
    }
  }

  private async loadRuleFacilities(): Promise<void> {
    const facilitiesResponse = await fetch("../bin/standard/xcom1/facilities.rul");
    if (!facilitiesResponse.ok) {
      throw new Error(`facilities.rul: ${facilitiesResponse.status} ${facilitiesResponse.statusText}`);
    }
    this.baseFacilities.clear();
    this.baseFacilitiesIndex = [];
    let listOrder = 0;
    for (const definition of parseFacilitiesRul(await facilitiesResponse.text())) {
      const rule = new RuleBaseFacility(definition.type);
      rule.load(definition, listOrder++);
      this.baseFacilities.set(definition.type, rule);
      this.baseFacilitiesIndex.push(definition.type);
    }
  }

  private async loadRuleCrafts(): Promise<void> {
    const craftsResponse = await fetch("../bin/standard/xcom1/crafts.rul");
    if (!craftsResponse.ok) {
      throw new Error(`crafts.rul: ${craftsResponse.status} ${craftsResponse.statusText}`);
    }
    this.crafts.clear();
    this.craftsIndex = [];
    let listOrder = 0;
    for (const definition of parseCraftsRul(await craftsResponse.text())) {
      const rule = new RuleCraft(definition.type);
      rule.load(definition, listOrder++, this);
      this.crafts.set(definition.type, rule);
      this.craftsIndex.push(definition.type);
    }
  }

  private async loadRuleCraftWeapons(): Promise<void> {
    const craftWeaponsResponse = await fetch("../bin/standard/xcom1/craftWeapons.rul");
    if (!craftWeaponsResponse.ok) {
      throw new Error(`craftWeapons.rul: ${craftWeaponsResponse.status} ${craftWeaponsResponse.statusText}`);
    }
    this.craftWeapons.clear();
    this.craftWeaponsIndex = [];
    for (const definition of parseCraftWeaponsRul(await craftWeaponsResponse.text())) {
      const rule = new RuleCraftWeapon(definition.type);
      rule.load(definition);
      this.craftWeapons.set(definition.type, rule);
      this.craftWeaponsIndex.push(definition.type);
    }
  }

  private async loadRuleUfos(): Promise<void> {
    const ufosResponse = await fetch("../bin/standard/xcom1/ufos.rul");
    if (!ufosResponse.ok) {
      throw new Error(`ufos.rul: ${ufosResponse.status} ${ufosResponse.statusText}`);
    }
    this.ufos.clear();
    this.ufosIndex = [];
    for (const definition of parseUfosRul(await ufosResponse.text())) {
      const rule = new RuleUfo(definition.type);
      rule.load(definition, this);
      this.ufos.set(definition.type, rule);
      this.ufosIndex.push(definition.type);
    }
  }

  private async loadRuleTerrains(): Promise<void> {
    const terrainsResponse = await fetch("../bin/standard/xcom1/terrains.rul");
    if (!terrainsResponse.ok) {
      throw new Error(`terrains.rul: ${terrainsResponse.status} ${terrainsResponse.statusText}`);
    }
    this.terrains.clear();
    this.terrainIndex = [];
    for (const definition of parseTerrainsRul(await terrainsResponse.text())) {
      const rule = new RuleTerrain(definition.name);
      rule.load(definition, this);
      this.terrains.set(definition.name, rule);
      this.terrainIndex.push(definition.name);
    }
  }

  private async loadMapScripts(): Promise<void> {
    const mapScriptsResponse = await fetch("../bin/standard/xcom1/mapScripts.rul");
    if (!mapScriptsResponse.ok) {
      throw new Error(`mapScripts.rul: ${mapScriptsResponse.status} ${mapScriptsResponse.statusText}`);
    }
    this.mapScripts.clear();
    this.mapScriptIndex = [];
    for (const definition of parseMapScriptsRul(await mapScriptsResponse.text())) {
      const type = definition.delete ?? definition.type;
      if (this.mapScripts.has(type)) {
        this.mapScripts.delete(type);
        this.mapScriptIndex = this.mapScriptIndex.filter(id => id !== type);
      }
      const commands = definition.commands.map(commandDefinition => {
        const command = new MapScript();
        command.load(commandDefinition);
        return command;
      });
      this.mapScripts.set(type, commands);
      this.mapScriptIndex.push(type);
    }
  }

  private async loadUfoTrajectories(): Promise<void> {
    const trajectoriesResponse = await fetch("../bin/standard/xcom1/ufoTrajectories.rul");
    if (!trajectoriesResponse.ok) {
      throw new Error(`ufoTrajectories.rul: ${trajectoriesResponse.status} ${trajectoriesResponse.statusText}`);
    }
    this.ufoTrajectories.clear();
    for (const definition of parseUfoTrajectoriesRul(await trajectoriesResponse.text())) {
      const rule = new UfoTrajectory(definition.id);
      rule.load(definition);
      this.ufoTrajectories.set(definition.id, rule);
    }
  }

  private async loadRuleAlienMissions(): Promise<void> {
    const missionsResponse = await fetch("../bin/standard/xcom1/alienMissions.rul");
    if (!missionsResponse.ok) {
      throw new Error(`alienMissions.rul: ${missionsResponse.status} ${missionsResponse.statusText}`);
    }
    this.alienMissions.clear();
    this.alienMissionsIndex = [];
    for (const definition of parseAlienMissionsRul(await missionsResponse.text())) {
      const rule = new RuleAlienMission(definition.type);
      rule.load(definition);
      this.alienMissions.set(definition.type, rule);
      this.alienMissionsIndex.push(definition.type);
    }
  }

  private async loadRuleMissionScripts(): Promise<void> {
    const missionScriptsResponse = await fetch("../bin/standard/xcom1/missionScripts.rul");
    if (!missionScriptsResponse.ok) {
      throw new Error(`missionScripts.rul: ${missionScriptsResponse.status} ${missionScriptsResponse.statusText}`);
    }
    this.missionScripts.clear();
    this.missionScriptIndex = [];
    for (const definition of parseMissionScriptsRul(await missionScriptsResponse.text())) {
      const rule = new RuleMissionScript(definition.type);
      rule.load(definition);
      this.validateMissionScript(rule);
      this.missionScripts.set(definition.type, rule);
      this.missionScriptIndex.push(definition.type);
    }
  }

  private async loadAlienRaces(): Promise<void> {
    const alienRacesResponse = await fetch("../bin/standard/xcom1/alienRaces.rul");
    if (!alienRacesResponse.ok) {
      throw new Error(`alienRaces.rul: ${alienRacesResponse.status} ${alienRacesResponse.statusText}`);
    }
    this.alienRaces.clear();
    this.alienRacesIndex = [];
    for (const definition of parseAlienRacesRul(await alienRacesResponse.text())) {
      const rule = new AlienRace(definition.id);
      rule.load(definition);
      this.alienRaces.set(definition.id, rule);
      this.alienRacesIndex.push(definition.id);
    }
  }

  private async loadAlienDeployments(): Promise<void> {
    const alienDeploymentsResponse = await fetch("../bin/standard/xcom1/alienDeployments.rul");
    if (!alienDeploymentsResponse.ok) {
      throw new Error(`alienDeployments.rul: ${alienDeploymentsResponse.status} ${alienDeploymentsResponse.statusText}`);
    }
    this.alienDeployments.clear();
    this.alienDeploymentsIndex = [];
    for (const definition of parseAlienDeploymentsRul(await alienDeploymentsResponse.text())) {
      const rule = new AlienDeployment(definition.type);
      rule.load(definition);
      this.alienDeployments.set(definition.type, rule);
      this.alienDeploymentsIndex.push(definition.type);
    }
  }

  private validateMissionScript(rule: RuleMissionScript): void {
    const missions = [...rule.getAllMissionTypes()];
    if (missions.length === 0) {
      return;
    }
    const firstMission = this.getAlienMission(missions[0], true);
    if (!firstMission) {
      return;
    }
    const isSiteType = firstMission.getObjective() === MissionObjective.OBJECTIVE_SITE;
    rule.setSiteType(isSiteType);
    for (const missionName of missions) {
      const mission = this.getAlienMission(missionName, true);
      if (mission && (mission.getObjective() === MissionObjective.OBJECTIVE_SITE) !== isSiteType) {
        throw new Error(`Error with MissionScript ${rule.getType()}: cannot mix site and non-site alien missions in a single command.`);
      }
    }
  }

  private async loadRuleItems(): Promise<void> {
    const itemsResponse = await fetch("../bin/standard/xcom1/items.rul");
    if (!itemsResponse.ok) {
      throw new Error(`items.rul: ${itemsResponse.status} ${itemsResponse.statusText}`);
    }
    this.items.clear();
    this.itemsIndex = [];
    let listOrder = 0;
    for (const definition of parseItemsRul(await itemsResponse.text())) {
      const rule = new RuleItem(definition.type);
      rule.load(definition, listOrder++);
      this.items.set(definition.type, rule);
      this.itemsIndex.push(definition.type);
    }
  }

  private async loadRuleInventories(): Promise<void> {
    const inventoriesResponse = await fetch("../bin/standard/xcom1/inventories.rul");
    if (!inventoriesResponse.ok) {
      throw new Error(`inventories.rul: ${inventoriesResponse.status} ${inventoriesResponse.statusText}`);
    }
    this.invs.clear();
    this.invsIndex = [];
    let listOrder = 0;
    for (const definition of parseInventoriesRul(await inventoriesResponse.text())) {
      const rule = new RuleInventory(definition.id);
      rule.load(definition, listOrder++);
      this.invs.set(definition.id, rule);
      this.invsIndex.push(definition.id);
    }
    this.invsIndex.sort((a, b) => (this.invs.get(a)?.getListOrder() || 0) - (this.invs.get(b)?.getListOrder() || 0));
  }

  private async loadRuleArmors(): Promise<void> {
    const armorsResponse = await fetch("../bin/standard/xcom1/armors.rul");
    if (!armorsResponse.ok) {
      throw new Error(`armors.rul: ${armorsResponse.status} ${armorsResponse.statusText}`);
    }
    this.armors.clear();
    this.armorsIndex = [];
    for (const definition of parseArmorsRul(await armorsResponse.text())) {
      const armor = new Armor(definition.type);
      armor.load(definition);
      this.armors.set(definition.type, armor);
      this.armorsIndex.push(definition.type);
    }
  }

  private async loadRuleUnits(): Promise<void> {
    const unitsResponse = await fetch("../bin/standard/xcom1/units.rul");
    if (!unitsResponse.ok) {
      throw new Error(`units.rul: ${unitsResponse.status} ${unitsResponse.statusText}`);
    }
    this.units.clear();
    this.unitsIndex = [];
    for (const definition of parseUnitsRul(await unitsResponse.text())) {
      const unit = new Unit(definition.type);
      unit.load(definition);
      this.units.set(definition.type, unit);
      this.unitsIndex.push(definition.type);
    }
  }

  private async loadAlienItemLevels(): Promise<void> {
    const levelsResponse = await fetch("../bin/standard/xcom1/alienItemLevels.rul");
    if (!levelsResponse.ok) {
      throw new Error(`alienItemLevels.rul: ${levelsResponse.status} ${levelsResponse.statusText}`);
    }
    this.alienItemLevels = parseAlienItemLevelsRul(await levelsResponse.text());
  }

  private async loadRuleSoldiers(): Promise<void> {
    const soldiersResponse = await fetch("../bin/standard/xcom1/soldiers.rul");
    if (!soldiersResponse.ok) {
      throw new Error(`soldiers.rul: ${soldiersResponse.status} ${soldiersResponse.statusText}`);
    }
    this.soldiers.clear();
    this.soldiersIndex = [];
    for (const definition of parseSoldiersRul(await soldiersResponse.text())) {
      const rule = new RuleSoldier(definition.type);
      rule.load(definition);
      for (const path of definition.soldierNames) {
        for (const nameFile of this.resolveSoldierNameFiles(path)) {
          const source = await this.fetchOptionalText(nameFile);
          if (!source) {
            Logger.log(LOG_WARNING, `${nameFile} not found; skipping soldier name pool.`);
            continue;
          }
          const pool = new SoldierNamePool();
          pool.load(source);
          rule.addSoldierNamePool(pool);
        }
      }
      this.soldiers.set(rule.getType(), rule);
      this.soldiersIndex.push(rule.getType());
    }
  }

  private async loadRuleStatStrings(): Promise<void> {
    this.statStrings = [];
    const source = await this.fetchOptionalText("bin/standard/XcomUtil_Statstrings/XcomUtil_Statstrings.rul");
    if (!source) {
      return;
    }
    for (const definition of parseStatStringsRul(source)) {
      const statString = new StatString();
      statString.load(definition);
      this.statStrings.push(statString);
    }
  }

  private async loadStartingBase(): Promise<void> {
    const startingBaseResponse = await fetch("../bin/standard/xcom1/startingBase.rul");
    if (!startingBaseResponse.ok) {
      throw new Error(`startingBase.rul: ${startingBaseResponse.status} ${startingBaseResponse.statusText}`);
    }
    this.startingBase = parseStartingBaseRul(await startingBaseResponse.text());
  }

  private loadStartingBaseIntoSave(save: SavedGame): void {
    const base = save.getBases()[0];
    if (!base) {
      return;
    }
    base.setMod(this);
    base.getFacilities().length = 0;
    base.getCrafts().length = 0;
    base.getItems().load(this.startingBase.items);
    for (const facilityDefinition of this.startingBase.facilities) {
      const rule = this.baseFacilities.get(facilityDefinition.type);
      if (!rule) {
        Logger.log(LOG_WARNING, `Starting base facility ${facilityDefinition.type} has no matching rule.`);
        continue;
      }
      const facility = new BaseFacility(rule, base);
      facility.load(facilityDefinition);
      base.getFacilities().push(facility);
    }
    for (const craftDefinition of this.startingBase.crafts) {
      const rule = this.crafts.get(craftDefinition.type);
      if (!rule) {
        Logger.log(LOG_WARNING, `Starting base craft ${craftDefinition.type} has no matching rule.`);
        continue;
      }
      const craft = new Craft(rule, base, craftDefinition.id ?? 0);
      craft.load(craftDefinition, type => this.getCraftWeapon(type));
      base.getCrafts().push(craft);
    }
    this.loadStartingSoldiersIntoSave(save, base);
    base.setScientists(this.startingBase.scientists ?? 0);
    base.setEngineers(this.startingBase.engineers ?? 0);
  }

  private loadStartingSoldiersIntoSave(save: SavedGame, base: Base): void {
    base.getSoldiers().length = 0;
    const transportCraft = base.getCrafts().find(craft => craft.getRules().getSoldiers() > 0) || null;
    const soldierTypes = this.soldiersIndex.filter(type => this.soldiers.get(type)?.getRequirements().length === 0);
    const randomTypes: string[] = [];

    if (typeof this.startingBase.randomSoldiers === "number") {
      for (let s = 0; s < this.startingBase.randomSoldiers; ++s) {
        if (soldierTypes.length > 0) {
          randomTypes.push(soldierTypes[RNG.generate(0, soldierTypes.length - 1)]);
        }
      }
    } else if (this.startingBase.randomSoldiers && typeof this.startingBase.randomSoldiers === "object") {
      for (const [type, count] of Object.entries(this.startingBase.randomSoldiers)) {
        for (let s = 0; s < count; ++s) {
          randomTypes.push(type);
        }
      }
    }

    const maxSoldiersInTransportCraft = transportCraft?.getRules().getSoldiers() || 0;
    for (let i = 0; i < randomTypes.length; ++i) {
      const soldier = this.genSoldier(save, randomTypes[i]);
      if (!soldier) {
        continue;
      }
      if (transportCraft && i < maxSoldiersInTransportCraft) {
        soldier.setCraft(transportCraft);
      }
      base.getSoldiers().push(soldier);
    }
  }

  private async loadGlobe(): Promise<void> {
    const worldDat = await this.fetchOptionalBinary(this.manifest.ufoWorldDat);
    if (worldDat) {
      this.globe.loadDat(worldDat);
    } else {
      Logger.log(LOG_WARNING, "Original GEODATA/WORLD.DAT not found; using empty globe rules.");
    }
    const textureDat = await this.fetchOptionalBinary(this.manifest.ufoTextureDat);
    if (textureDat) {
      this.globe.loadTextureDat(textureDat);
    } else {
      Logger.log(LOG_WARNING, "Original GEOGRAPH/TEXTURE.DAT not found; using fallback globe texture colors.");
    }
  }

  private drawFallbackBack01(surface: Surface): void {
    for (let y = 0; y < surface.getHeight(); ++y) {
      for (let x = 0; x < surface.getWidth(); ++x) {
        surface.setPixel(x, y, 16 + ((x >> 4) + (y >> 3)) % 16);
      }
    }
  }

  private async loadOptionalSpkSurface(name: string, path: string | null | undefined, fallback: (surface: Surface) => void): Promise<void> {
    const surface = new Surface(320, 200);
    const data = await this.fetchOptionalBinary(path);
    if (data) {
      surface.loadSpk(data);
    } else {
      fallback(surface);
    }
    this.surfaces.set(name, surface);
  }

  private async loadOptionalBdySurface(name: string, path: string | null | undefined, fallback: (surface: Surface) => void): Promise<void> {
    const surface = new Surface(320, 200);
    const data = await this.fetchOptionalBinary(path);
    if (data) {
      surface.loadBdy(data);
    } else {
      fallback(surface);
    }
    this.surfaces.set(name, surface);
  }

  private async loadOptionalScrSurface(name: string, path: string | null | undefined, fallback: (surface: Surface) => void): Promise<void> {
    const surface = new Surface(320, 200);
    const data = await this.fetchOptionalBinary(path);
    if (data) {
      surface.loadScr(data);
    } else {
      fallback(surface);
    }
    this.surfaces.set(name, surface);
  }

  private createAltBack07(back07: Surface): Surface {
    const alt = new Surface(320, 200);
    back07.blit(alt);
    for (let y = 172; y >= 152; --y) {
      for (let x = 5; x <= 314; ++x) {
        alt.setPixel(x, y + 4, alt.getPixel(x, y));
      }
    }
    for (let y = 147; y >= 134; --y) {
      for (let x = 5; x <= 314; ++x) {
        alt.setPixel(x, y + 9, alt.getPixel(x, y));
      }
    }
    for (let y = 132; y >= 109; --y) {
      for (let x = 5; x <= 314; ++x) {
        alt.setPixel(x, y + 10, alt.getPixel(x, y));
      }
    }
    return alt;
  }

  private drawFallbackScannerBorder(surface: Surface): void {
    surface.clear(0);
    surface.drawRect(48, 16, 168, 168, 144);
    surface.drawRect(52, 20, 160, 160, 145);
    surface.drawRect(56, 24, 152, 152, 0);
  }

  private drawFallbackGraphs(surface: Surface): void {
    surface.clear(0);
    surface.drawRect(92, 0, 228, 24, 144);
    surface.drawRect(125, 49, 188, 127, 144);
    surface.drawRect(126, 50, 186, 125, 0);
  }

  private drawFallbackMiniMapBorder(surface: Surface): void {
    surface.clear(0);
    surface.drawRect(46, 14, 223, 151, 64);
    surface.drawRect(48, 16, 221, 148, 0);
    surface.drawRect(22, 60, 22, 24, 64);
    surface.drawRect(22, 86, 22, 24, 64);
    surface.drawRect(273, 143, 36, 36, 64);
    surface.drawLine(33, 65, 27, 77, 67);
    surface.drawLine(33, 65, 39, 77, 67);
    surface.drawLine(33, 105, 27, 93, 67);
    surface.drawLine(33, 105, 39, 93, 67);
  }

  private drawFallbackScannerScan(surface: Surface): void {
    surface.clear(0);
    surface.drawRect(56, 24, 152, 152, 32);
    for (let i = 0; i <= 18; ++i) {
      const p = 56 + i * 8;
      surface.drawLine(p, 24, p, 175, 34);
      surface.drawLine(56, p - 32, 207, p - 32, 34);
    }
  }

  private drawFallbackMedikitBorder(surface: Surface): void {
    surface.clear(0);
    surface.drawRect(67, 44, 190, 100, 240);
    surface.drawRect(72, 49, 180, 90, 241);
    surface.drawRect(94, 59, 54, 60, 0);
  }

  private drawFallbackUnitInfoBorder(surface: Surface): void {
    surface.clear(0);
    surface.drawRect(0, 0, 320, 200, 64);
    surface.drawRect(2, 2, 316, 196, 65);
    surface.drawRect(5, 30, 310, 165, 0);
    for (let y = 39; y < 199; y += 10) {
      surface.drawLine(0, y, 168, y, 64);
    }
    surface.drawRect(170, 38, 148, 154, 16);
  }

  private adjustUnitInfoBorder(surface: Surface): void {
    for (let y = 39; y < 199; y += 10) {
      for (let x = 0; x < 169; ++x) {
        surface.setPixel(x, y, surface.getPixel(x, 30));
      }
    }
    for (let y = 190; y > 37; y -= 9) {
      for (let x = 0; x < 169; ++x) {
        surface.setPixel(x, y, surface.getPixel(x, 199));
      }
    }
    for (let y = 37; y > 29; --y) {
      for (let x = 0; x < 320; ++x) {
        surface.setPixel(x, y, surface.getPixel(x, y - 8));
        surface.setPixel(x, y - 8, 0);
      }
    }
  }

  private createFallbackDetblob(): SurfaceSet {
    const set = new SurfaceSet(16, 16);
    for (let frame = 0; frame < 16; ++frame) {
      const surface = set.addFrame(frame);
      const radius = frame < 7 ? Math.max(2, Math.min(7, 2 + frame)) : 5;
      const color = frame < 7 ? 48 : 64;
      surface.drawCircle(8, 8, radius, color + (frame & 1));
      if (frame >= 7) {
        surface.drawLine(8, 2, 8, 13, 64);
        surface.drawLine(8, 2, 5, 6, 64);
        surface.drawLine(8, 2, 11, 6, 64);
      }
    }
    return set;
  }

  private createFallbackScang(): SurfaceSet {
    const set = new SurfaceSet(4, 4);
    for (let frame = 0; frame < 454; ++frame) {
      const surface = set.addFrame(frame);
      let color = 48;
      if (frame >= 35) {
        color = 16 + (frame % 12);
      } else if (frame >= 24) {
        color = 96 + (frame % 3);
      } else if (frame >= 12) {
        color = 64 + (frame % 3);
      } else if (frame >= 9) {
        color = 112 + (frame % 3);
      } else if (frame >= 6) {
        color = 80 + (frame % 3);
      } else if (frame >= 3) {
        color = 32 + (frame % 3);
      }
      surface.drawRect(0, 0, 4, 4, color);
      if (frame < 35) {
        surface.setPixel(1, 1, color + 1);
        surface.setPixel(2, 2, color + 1);
      }
    }
    return set;
  }

  private createFallbackMedibits(): SurfaceSet {
    const set = new SurfaceSet(52, 58);
    for (let frame = 0; frame < 6; ++frame) {
      const surface = set.addFrame(frame);
      const color = 32 + frame;
      switch (frame) {
        case 0:
          surface.drawCircle(26, 8, 6, color);
          break;
        case 1:
          surface.drawRect(18, 16, 16, 20, color);
          break;
        case 2:
          surface.drawRect(8, 18, 10, 24, color);
          break;
        case 3:
          surface.drawRect(34, 18, 10, 24, color);
          break;
        case 4:
          surface.drawRect(16, 36, 10, 20, color);
          break;
        case 5:
          surface.drawRect(28, 36, 10, 20, color);
          break;
        default:
          break;
      }
    }
    return set;
  }

  private createAltGeobord(oldGeo: Surface): Surface {
    const newWidth = 320 - 64;
    const newHeight = 200;
    const newGeo = new Surface(newWidth * 3, newHeight * 3);
    for (let x = 0; x < newWidth; ++x) {
      for (let y = 0; y < newHeight; ++y) {
        const pixel = oldGeo.getPixel(x, y);
        newGeo.setPixel(newWidth + x, newHeight + y, pixel);
        newGeo.setPixel(newWidth - x - 1, newHeight + y, pixel);
        newGeo.setPixel(newWidth * 3 - x - 1, newHeight + y, pixel);

        newGeo.setPixel(newWidth + x, newHeight - y - 1, pixel);
        newGeo.setPixel(newWidth - x - 1, newHeight - y - 1, pixel);
        newGeo.setPixel(newWidth * 3 - x - 1, newHeight - y - 1, pixel);

        newGeo.setPixel(newWidth + x, newHeight * 3 - y - 1, pixel);
        newGeo.setPixel(newWidth - x - 1, newHeight * 3 - y - 1, pixel);
        newGeo.setPixel(newWidth * 3 - x - 1, newHeight * 3 - y - 1, pixel);
      }
    }
    return newGeo;
  }

  private async loadResourceManifest(): Promise<ResourceManifest> {
    const response = await fetch("dist/resource-manifest.json", { cache: "no-store" });
    if (!response.ok) {
      return {};
    }
    return await response.json() as ResourceManifest;
  }

  private async fetchOptionalBinary(path?: string | null): Promise<ArrayBuffer | null> {
    if (!path) {
      return null;
    }
    const response = await fetch(`../${path}`.replaceAll("\\", "/"));
    if (!response.ok) {
      return null;
    }
    return await response.arrayBuffer();
  }

  private async fetchOptionalText(path?: string | null): Promise<string | null> {
    if (!path) {
      return null;
    }
    const response = await fetch(`../${path}`.replaceAll("\\", "/"));
    if (!response.ok) {
      return null;
    }
    return await response.text();
  }

  private resolveSoldierNameFiles(path: string): string[] {
    const normalized = path.replaceAll("\\", "/");
    if (normalized.endsWith("/")) {
      const prefix = `bin/common/${normalized}`;
      return (this.manifest.commonSoldierNameFiles || []).filter(file => file.startsWith(prefix));
    }
    if (normalized.startsWith("bin/")) {
      return [normalized];
    }
    return [`bin/common/${normalized}`];
  }
}
