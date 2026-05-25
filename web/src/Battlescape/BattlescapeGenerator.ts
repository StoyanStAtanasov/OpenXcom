import { Options } from "../Engine/Options.ts";
import { RNG } from "../Engine/RNG.ts";
import { MovementType } from "../Mod/Armor.ts";
import type { Armor } from "../Mod/Armor.ts";
import type { AlienDeployment, DeploymentData } from "../Mod/AlienDeployment.ts";
import type { AlienRace } from "../Mod/AlienRace.ts";
import { MapBlock, MapBlockType } from "../Mod/MapBlock.ts";
import { SpecialTileType, TilePart } from "../Mod/MapData.ts";
import { MapDataSet } from "../Mod/MapDataSet.ts";
import { MapDirection, MapScriptCommand, type MapScript, type Rect } from "../Mod/MapScript.ts";
import type { RuleTerrain } from "../Mod/RuleTerrain.ts";
import { InventoryType, type RuleInventory } from "../Mod/RuleInventory.ts";
import { BattleType, type RuleItem } from "../Mod/RuleItem.ts";
import type { RuleCraft } from "../Mod/RuleCraft.ts";
import type { RuleUfo } from "../Mod/RuleUfo.ts";
import type { Unit } from "../Mod/Unit.ts";
import { BattleItem } from "../Savegame/BattleItem.ts";
import { BattleUnit, UnitFaction } from "../Savegame/BattleUnit.ts";
import { GameDifficulty } from "../Savegame/SavedGame.ts";
import { Node, NodeRank } from "../Savegame/Node.ts";
import type { Base } from "../Savegame/Base.ts";
import type { SavedBattleGame } from "../Savegame/SavedBattleGame.ts";
import type { Tile } from "../Savegame/Tile.ts";
import { AIModule } from "./AIModule.ts";
import { Position } from "./Position.ts";

export type BattlescapeGeneratorModLike = {
  loadMapDataSet?: (name: string, ruleset?: string) => Promise<MapDataSet>;
  loadMapBlock?: (name: string, ruleset?: string) => Promise<ArrayBuffer>;
  loadRoute?: (name: string, ruleset?: string) => Promise<ArrayBuffer>;
  getItem?: (type: string, error?: boolean) => RuleItem | null;
  getInventory?: (id: string, error?: boolean) => RuleInventory | null;
  getInvsList?: () => string[];
  getUfo?: (type: string, error?: boolean) => RuleUfo | null;
  getAlienRace?: (id: string, error?: boolean) => AlienRace | null;
  getAlienRacesList?: () => string[];
  getUnit?: (type: string, error?: boolean) => Unit | null;
  getArmor?: (type: string, error?: boolean) => Armor | null;
  getAlienItemLevels?: () => number[][];
  getDeployment?: (type: string, error?: boolean) => AlienDeployment | null;
  getTerrain?: (type: string, error?: boolean) => RuleTerrain | null;
  getTerrainList?: () => string[];
  getMapScript?: (id: string) => MapScript[] | null;
};

type CraftLike = {
  getRules(): RuleCraft;
  getBase?: () => Base | null;
  getItems?: () => { getContents?: () => Map<string, number> };
  setInBattlescape?: (inbattle: boolean) => void;
};

type UfoLike = {
  getRules(): RuleUfo;
  setInBattlescape?: (inbattle: boolean) => void;
};

type MissionSiteLike = {
  setInBattlescape?: (inbattle: boolean) => void;
  getAlienRace?: () => string;
};

type AlienBaseLike = {
  setInBattlescape?: (inbattle: boolean) => void;
  getAlienRace?: () => string;
};

type WorldTextureLike = {
  getRandomTerrain?: (target: unknown) => string;
};

function bytes(data: ArrayBuffer | Uint8Array): Uint8Array {
  return data instanceof ArrayBuffer ? new Uint8Array(data) : data;
}

export class BattlescapeGenerator {
  private _craftZ = 0;
  private _generateFuel = true;
  private _terrain: RuleTerrain | null = null;
  private _mapsize_x = 0;
  private _mapsize_y = 0;
  private _mapsize_z = 0;
  private _blocksToDo = 0;
  private _blocks: Array<Array<MapBlock | null>> = [];
  private _landingzone: boolean[][] = [];
  private _segments: number[][] = [];
  private _drillMap: MapDirection[][] = [];
  private _dummy: MapBlock | null = null;
  private _craft: CraftLike | null = null;
  private _ufo: UfoLike | null = null;
  private _base: Base | null = null;
  private _mission: MissionSiteLike | null = null;
  private _alienBase: AlienBaseLike | null = null;
  private _worldTexture: WorldTextureLike | null = null;
  private _worldShade = 0;
  private _craftPos: Rect = { x: 0, y: 0, w: 0, h: 0 };
  private _ufoPos: Rect[] = [];
  private _craftDeployed = false;
  private _craftInventoryTile: Tile | null = null;
  private _alienRace = "";
  private _alienItemLevel = 0;
  private _unitSequence = BattleUnit.MAX_SOLDIER_ID;
  private _difficulty = GameDifficulty.DIFF_BEGINNER;
  private _baseInventory = false;
  private _allowAutoLoadout = !(Options as any).disableAutoEquip;

  constructor(private _save: SavedBattleGame, private _mod: BattlescapeGeneratorModLike | null = null) {}

  async generateMap(script: MapScript[], terrain: RuleTerrain, mapsize_x: number, mapsize_y: number, mapsize_z: number, resetTerrain = true): Promise<void> {
    this._terrain = terrain;
    this._mapsize_x = mapsize_x;
    this._mapsize_y = mapsize_y;
    this._mapsize_z = mapsize_z;
    this._craftPos = { x: 0, y: 0, w: 0, h: 0 };
    this._ufoPos = [];
    this._craftDeployed = false;
    this._craftInventoryTile = null;
    this._save.setAmbientSound(terrain.getAmbience());
    this._save.setAmbientVolume(terrain.getAmbientVolume());
    this._dummy = new MapBlock("dummy");
    this.init(resetTerrain);
    const mapDataSetIDOffset = await this.loadTerrainMapDataSets(terrain);
    let craftDataSetIDOffset = 0;
    let craftMap: MapBlock | null = null;
    const ufoMaps: MapBlock[] = [];
    let ufoTerrain: RuleTerrain | null = null;

    if (this._save.getMissionType() === "STR_BASE_DEFENSE") {
      await this.generateBaseMap();
    }

    const conditionals = new Map<number, boolean>();
    for (const command of script) {
      const label = command.getLabel();
      if (label > 0 && conditionals.has(label)) {
        throw new Error("Map generator encountered an error: multiple commands are sharing the same label.");
      }
      let success = false;
      conditionals.set(label, success);

      if (command.getConditionals().length > 0) {
        let execute = true;
        for (const condition of command.getConditionals()) {
          const key = Math.abs(condition);
          if (conditionals.has(key)) {
            const conditionalSuccess = conditionals.get(key) || false;
            if ((condition > 0 && !conditionalSuccess) || (condition < 0 && conditionalSuccess)) {
              execute = false;
              break;
            }
          } else {
            throw new Error("Map generator encountered an error: conditional command expected a label that did not exist before this command.");
          }
        }
        if (!execute) {
          continue;
        }
      }

      if (RNG.percent(command.getChancesOfExecution())) {
        command.init();
        for (let j = 0; j < command.getExecutions(); ++j) {
          const result = await this.executeMapScriptCommand(command, success, {
            setCraftMap: map => { craftMap = map; },
            addUfoMap: (map, pos, terrainRule) => {
              ufoMaps.push(map);
              this._ufoPos.push(pos);
              ufoTerrain = terrainRule;
            }
          });
          success = result.success;
          if (result.craftMap) {
            craftMap = result.craftMap;
          }
        }
      }
      conditionals.set(label, success);
    }

    if (this._blocksToDo) {
      throw new Error("Map failed to fully generate.");
    }

    await this.loadNodes();

    if (ufoMaps.length > 0 && ufoTerrain) {
      craftDataSetIDOffset = await this.loadTerrainMapDataSets(ufoTerrain);
      for (let i = 0; i < ufoMaps.length; ++i) {
        const map = ufoMaps[i];
        const pos = this._ufoPos[i];
        await this.loadMAP(map, pos.x * 10, pos.y * 10, ufoTerrain, mapDataSetIDOffset);
        await this.loadRMP(map, pos.x * 10, pos.y * 10, Node.UFOSEGMENT);
        for (let j = 0; j < Math.trunc(map.getSizeX() / 10); ++j) {
          for (let k = 0; k < Math.trunc(map.getSizeY() / 10); ++k) {
            this._segments[pos.x + j][pos.y + k] = Node.UFOSEGMENT;
          }
        }
      }
    }

    if (craftMap && this._craft) {
      const craftTerrain = this._craft.getRules().getBattlescapeTerrainData();
      if (!craftTerrain) {
        throw new Error(`Craft ${this._craft.getRules().getType()} has no battlescape terrain data.`);
      }
      await this.loadTerrainMapDataSets(craftTerrain);
      await this.loadMAP(craftMap, this._craftPos.x * 10, this._craftPos.y * 10, craftTerrain, mapDataSetIDOffset + craftDataSetIDOffset, true, true);
      await this.loadRMP(craftMap, this._craftPos.x * 10, this._craftPos.y * 10, Node.CRAFTSEGMENT);
      for (let i = 0; i < Math.trunc(craftMap.getSizeX() / 10); ++i) {
        for (let j = 0; j < Math.trunc(craftMap.getSizeY() / 10); ++j) {
          this._segments[this._craftPos.x + i][this._craftPos.y + j] = Node.CRAFTSEGMENT;
        }
      }
      for (let i = (this._craftPos.x * 10) - 1; i <= (this._craftPos.x * 10) + craftMap.getSizeX(); ++i) {
        for (let j = (this._craftPos.y * 10) - 1; j <= (this._craftPos.y * 10) + craftMap.getSizeY(); ++j) {
          for (let k = this._mapsize_z - 1; k >= this._craftZ; --k) {
            this._save.getTile(new Position(i, j, k))?.setDiscovered(true, TilePart.O_NORTHWALL);
          }
        }
      }
    }

    const scorchedEarth = MapDataSet.getScorchedEarthTile();
    if (scorchedEarth) {
      for (let x = 0; x < this._mapsize_x; ++x) {
        for (let y = 0; y < this._mapsize_y; ++y) {
          const tile = this._save.getTile(new Position(x, y, 0));
          if (tile && !tile.getMapData(TilePart.O_FLOOR)) {
            tile.setMapData(scorchedEarth, 1, 0, TilePart.O_FLOOR);
          }
        }
      }
    }

    this.attachNodeLinks();
    this._dummy = null;
  }

  setTerrain(terrain: RuleTerrain | null): void {
    this._terrain = terrain;
  }

  setCraft(craft: CraftLike | null): void {
    this._craft = craft;
    craft?.setInBattlescape?.(true);
  }

  setUfo(ufo: UfoLike | null): void {
    this._ufo = ufo;
    ufo?.setInBattlescape?.(true);
  }

  setWorldTexture(texture: unknown | null): void {
    this._worldTexture = texture && typeof texture === "object" ? texture as WorldTextureLike : null;
  }

  setWorldShade(shade: number): void {
    this._worldShade = Math.max(0, Math.min(15, Math.trunc(shade)));
  }

  setBase(base: Base | null): void {
    this._base = base;
    base?.setInBattlescape(true);
  }

  setMissionSite(mission: MissionSiteLike | null): void {
    this._mission = mission;
    mission?.setInBattlescape?.(true);
  }

  setAlienBase(base: AlienBaseLike | null): void {
    this._alienBase = base;
    base?.setInBattlescape?.(true);
  }

  setAlienRace(alienRace: string): void {
    this._alienRace = alienRace;
  }

  setAlienItemlevel(alienItemLevel: number): void {
    this._alienItemLevel = Math.max(0, Math.trunc(alienItemLevel));
  }

  setDifficulty(difficulty: GameDifficulty | number): void {
    this._difficulty = difficulty as GameDifficulty;
  }

  async run(): Promise<void> {
    this._baseInventory = false;
    const deploymentId = this._ufo?.getRules().getType() || this._save.getMissionType();
    const deployment = this._mod?.getDeployment?.(deploymentId, true);
    if (!deployment) {
      throw new Error(`BattlescapeGenerator deployment ${deploymentId} not found.`);
    }

    this._save.setTurnLimit(deployment.getTurnLimit());
    this._save.setChronoTrigger(deployment.getChronoTrigger());
    this._save.setCheatTurn(deployment.getCheatTurn());
    const [width, length, height] = deployment.getDimensions();
    this._mapsize_x = width;
    this._mapsize_y = length;
    this._mapsize_z = height;
    this._unitSequence = BattleUnit.MAX_SOLDIER_ID;

    if (!this._terrain) {
      this._terrain = this.selectRunTerrain(deployment);
    }
    if (!this._terrain) {
      throw new Error("Map generator encountered an error: No valid terrain found.");
    }

    this.setDepth(deployment, this._terrain);
    if (deployment.getShade() !== -1) {
      this._worldShade = deployment.getShade();
    }

    const terrainScript = this._mod?.getMapScript?.(this._terrain.getScript()) || null;
    const deploymentScript = deployment.getScript() ? this._mod?.getMapScript?.(deployment.getScript()) || null : null;
    if (!deploymentScript && deployment.getScript()) {
      throw new Error(`Map generator encountered an error: ${deployment.getScript()} script not found.`);
    }
    const script = deploymentScript || terrainScript;
    if (!script) {
      throw new Error(`Map generator encountered an error: ${this._terrain.getScript()} script not found.`);
    }

    this._save.setObjectiveType(deployment.getObjectiveType());
    if (deployment.getObjectivesRequired() > 0) {
      this._save.setObjectiveCount(deployment.getObjectivesRequired());
    }
    await this.generateMap(script, this._terrain, width, length, height);
    this.deployXCOM();

    const unitsBefore = this._save.getUnits().length;
    this.deployAliens(deployment);
    if (unitsBefore === this._save.getUnits().length) {
      throw new Error("Map generator encountered an error: no alien units could be placed on the map.");
    }
    this.deployCivilians(deployment.getCivilians());
    this._save.setAborted(false);
    this.setMusic(deployment, this._terrain);
    this._save.setGlobalShade(this._worldShade);
    this._save.initUtilities(this._mod || undefined);
    this._save.getTileEngine()?.calculateSunShading();
    this._save.getTileEngine()?.calculateTerrainLighting();
    this._save.getTileEngine()?.calculateUnitLighting();
    this._save.resetUnitTiles();
  }

  /**
   * Creates a mini-battle-save for managing inventory from the Geoscape.
   * Kids, don't try this at home!
   */
  runInventory(craft: CraftLike): void {
    this._baseInventory = true;
    this._mapsize_x = 2;
    this._mapsize_y = 2;
    this._mapsize_z = 1;
    this._save.initMap(this._mapsize_x, this._mapsize_y, this._mapsize_z);
    this._craftInventoryTile = this._save.getTiles()[0] || null;

    this.setCraft(craft);
    this.deployXCOM();
  }

  deployAliens(deployment: AlienDeployment): number {
    if (!this._mod?.getAlienRace || !this._mod?.getUnit || !this._mod?.getArmor || !this._mod?.getAlienItemLevels) {
      throw new Error("BattlescapeGenerator requires alien race, unit, armor and item level rules to deploy aliens.");
    }

    let alienRace = this._alienRace || deployment.getRace();
    if (!alienRace) {
      alienRace = this._mod.getAlienRacesList?.()[0] || "";
    }
    if (!alienRace) {
      throw new Error(`Map generator encountered an error: alien race not defined for deployment ${deployment.getType()}.`);
    }
    if (this._save.getDepth() > 0 && !alienRace.includes("_UNDERWATER")) {
      alienRace += "_UNDERWATER";
    }

    const race = this._mod.getAlienRace(alienRace, true);
    if (!race) {
      throw new Error(`Map generator encountered an error: Unknown race: ${alienRace} defined in deployment: ${deployment.getType()}.`);
    }

    const itemLevelChoices = this.getItemLevelChoices();
    let spawned = 0;

    for (const data of deployment.getDeploymentData()) {
      const alienName = race.getMember(data.alienRank);
      if (!alienName) {
        continue;
      }
      const quantity = this.getDeploymentQuantity(data);
      const rule = this._mod.getUnit(alienName, true);
      if (!rule) {
        throw new Error(`Unit generator encountered an error: unknown unit ${alienName}.`);
      }
      for (let i = 0; i < quantity; ++i) {
        let outside = RNG.percent(data.percentageOutsideUfo);
        if (!this._ufo) {
          outside = false;
        }
        const unit = this.addAlien(rule, data.alienRank, outside);
        if (!unit) {
          continue;
        }
        spawned++;
        const itemLevel = itemLevelChoices[RNG.generate(0, itemLevelChoices.length - 1)] || 0;
        this.addAlienEquipment(rule, data, itemLevel, unit);
      }
    }
    return spawned;
  }

  deployCivilians(max: number): number {
    if (!max || !this._terrain) {
      return 0;
    }
    if (!this._mod?.getUnit || !this._mod?.getArmor || !this._mod?.getAlienItemLevels) {
      throw new Error("BattlescapeGenerator requires unit, armor and item level rules to deploy civilians.");
    }
    const civilianTypes = this._terrain.getCivilianTypes();
    if (civilianTypes.length === 0) {
      return 0;
    }

    const number = RNG.generate(Math.trunc(max / 2), max);
    const itemLevelChoices = this.getItemLevelChoices();
    let spawned = 0;
    for (let i = 0; i < number; ++i) {
      const type = civilianTypes[RNG.generate(0, civilianTypes.length - 1)];
      const rule = this._mod.getUnit(type, true);
      if (!rule) {
        throw new Error(`Unit generator encountered an error: unknown civilian unit ${type}.`);
      }
      const civilian = this.addCivilian(rule);
      if (!civilian) {
        continue;
      }
      spawned++;
      const itemLevel = itemLevelChoices[RNG.generate(0, itemLevelChoices.length - 1)] || 0;
      this.addBuiltInWeapons(rule, itemLevel, civilian);
    }
    return spawned;
  }

  private selectRunTerrain(deployment: AlienDeployment): RuleTerrain | null {
    if (!this._mod?.getTerrain) {
      return null;
    }
    const deploymentTerrains = deployment.getTerrains();
    if (!this._worldTexture?.getRandomTerrain || deploymentTerrains.length > 0) {
      if (deploymentTerrains.length > 0) {
        return this._mod.getTerrain(deploymentTerrains[RNG.generate(0, deploymentTerrains.length - 1)], true);
      }
      const firstTerrain = this._mod.getTerrainList?.()[0] || "";
      return firstTerrain ? this._mod.getTerrain(firstTerrain, true) : null;
    }
    const target = this._mission || this._alienBase || this._ufo;
    const terrainId = this._worldTexture.getRandomTerrain(target);
    return terrainId ? this._mod.getTerrain(terrainId, true) : null;
  }

  private setDepth(deployment: AlienDeployment, terrain: RuleTerrain): void {
    const minDepth = deployment.getMinDepth();
    const maxDepth = deployment.getMaxDepth();
    if (minDepth !== 0 || maxDepth !== 0) {
      this._save.setDepth(RNG.generate(minDepth, maxDepth));
      return;
    }
    this._save.setDepth(RNG.generate(terrain.getMinDepth(), terrain.getMaxDepth()));
  }

  private setMusic(deployment: AlienDeployment, terrain: RuleTerrain): void {
    const deploymentMusic = deployment.getMusic();
    if (deploymentMusic.length > 0) {
      this._save.setMusic(deploymentMusic[RNG.generate(0, deploymentMusic.length - 1)]);
      return;
    }
    const terrainMusic = terrain.getMusic();
    if (terrainMusic.length > 0) {
      this._save.setMusic(terrainMusic[RNG.generate(0, terrainMusic.length - 1)]);
    }
  }

  private deployXCOM(): void {
    const base = this._base || this._craft?.getBase?.() || null;
    this._base = base;
    const ground = this._mod?.getInventory?.("STR_GROUND", true) || null;
    if (!ground) {
      throw new Error("Inventory STR_GROUND not found.");
    }

    const soldiers = base?.getSoldiers().filter(soldier => !this._craft || soldier.getCraft() === this._craft) || [];
    let selectedFirstSoldier = false;
    for (const soldier of soldiers) {
      if (!soldier.getArmor()) {
        continue;
      }
      const unit = new BattleUnit(soldier, this._save.getDepth());
      unit.setTurnsSinceSpotted(255);
      unit.clearVisibleTiles();
      unit.setCache(0);
      if (!this.addXCOMUnit(unit)) {
        continue;
      }
      if (!this._baseInventory && !this._craftInventoryTile) {
        this._craftInventoryTile = unit.getTile() as Tile | null;
      }
      this._craftInventoryTile?.setUnit(unit);
      unit.setVisible(false);
      unit.prepareNewTurn(false);
      if (!selectedFirstSoldier && unit.getOriginalFaction() === UnitFaction.FACTION_PLAYER) {
        this._save.setSelectedUnit(unit);
        selectedFirstSoldier = true;
      }
    }
    if (this._save.getUnits().every(unit => unit.getOriginalFaction() !== UnitFaction.FACTION_PLAYER)) {
      throw new Error("Map generator encountered an error: no xcom units could be placed on the map.");
    }
    if (!this._save.getSelectedUnit()) {
      this._save.selectNextPlayerUnit();
    }

    this.addCraftItemsToInventoryTile(ground);
    this.prepareCraftInventoryLoadout(ground);
  }

  private addXCOMUnit(unit: BattleUnit): BattleUnit | null {
    if (this._baseInventory) {
      if (unit.hasInventory()) {
        this._save.getUnits().push(unit);
        this.setUnitSpecialWeapon(unit);
        return unit;
      }
      return null;
    }

    if (!this._craft || !this._craftDeployed) {
      const node = this._save.getSpawnNode(NodeRank.NR_XCOM, unit);
      if (node && this._save.setUnitPosition(unit, node.getPosition())) {
        this._craftInventoryTile = this._save.getTile(node.getPosition());
        unit.setDirection(RNG.generate(0, 7));
        this._save.getUnits().push(unit);
        this._save.getTileEngine()?.calculateFOV(unit);
        this.setUnitSpecialWeapon(unit);
        return unit;
      }
      if (this._save.getMissionType() !== "STR_BASE_DEFENSE" && this.placeUnitNearFriend(unit)) {
        this._craftInventoryTile = unit.getTile() as Tile | null;
        unit.setDirection(RNG.generate(0, 7));
        this._save.getUnits().push(unit);
        this._save.getTileEngine()?.calculateFOV(unit);
        this.setUnitSpecialWeapon(unit);
        return unit;
      }
      return null;
    }

    const deployment = this._craft.getRules().getDeployment();
    if (deployment.length > 0) {
      for (const entry of deployment) {
        const pos = new Position(entry[0] + this._craftPos.x * 10, entry[1] + this._craftPos.y * 10, entry[2] + this._craftZ);
        const direction = entry[3];
        let canPlace = true;
        for (let x = 0; x < unit.getArmor().getSize(); ++x) {
          for (let y = 0; y < unit.getArmor().getSize(); ++y) {
            canPlace = canPlace && this.canPlaceXCOMUnit(this._save.getTile(pos.add(new Position(x, y, 0))));
          }
        }
        if (canPlace && this._save.setUnitPosition(unit, pos)) {
          this._save.getUnits().push(unit);
          unit.setDirection(direction);
          this.setUnitSpecialWeapon(unit);
          return unit;
        }
      }
      return null;
    }

    for (const tile of this._save.getTiles()) {
      if (this.canPlaceXCOMUnit(tile) && this._save.setUnitPosition(unit, tile.getPosition())) {
        this._save.getUnits().push(unit);
        this.setUnitSpecialWeapon(unit);
        return unit;
      }
    }
    return null;
  }

  private canPlaceXCOMUnit(tile: Tile | null): boolean {
    const floor = tile?.getMapData(TilePart.O_FLOOR) || null;
    if (tile &&
      floor &&
      floor.getSpecialType() === SpecialTileType.START_POINT &&
      !tile.getMapData(TilePart.O_OBJECT) &&
      floor.getTUCost(MovementType.MT_WALK) < 255) {
      if (!this._craftInventoryTile) {
        this._craftInventoryTile = tile;
      }
      return true;
    }
    return false;
  }

  private placeUnitNearFriend(unit: BattleUnit): boolean {
    if (this._save.getUnits().length === 0) {
      return false;
    }
    for (let i = 0; i !== 10; ++i) {
      let entryPoint = new Position(-1, -1, -1);
      let tries = 100;
      let largeUnit = false;
      while (entryPoint.equals(new Position(-1, -1, -1)) && tries) {
        const friend = this._save.getUnits()[RNG.generate(0, this._save.getUnits().length - 1)];
        if (friend.getFaction() === unit.getFaction() &&
          !friend.getPosition().equals(new Position(-1, -1, -1)) &&
          friend.getArmor().getSize() >= unit.getArmor().getSize()) {
          entryPoint = friend.getPosition();
          largeUnit = friend.getArmor().getSize() !== 1;
        }
        tries--;
      }
      if (tries && this._save.placeUnitNearPosition(unit, entryPoint, largeUnit)) {
        return true;
      }
    }
    return false;
  }

  private setUnitSpecialWeapon(unit: BattleUnit): void {
    if (this._mod?.getItem) {
      unit.setSpecialWeapon(this._save, { getItem: this._mod.getItem.bind(this._mod) });
    }
  }

  private addCraftItemsToInventoryTile(ground: RuleInventory): void {
    if (!this._craft || !this._craftInventoryTile) {
      return;
    }
    const contents = this._craft.getItems?.().getContents?.() || new Map<string, number>();
    for (const [type, qty] of contents) {
      const rule = this._mod?.getItem?.(type, true);
      if (!rule) {
        continue;
      }
      for (let count = 0; count < qty; ++count) {
        this._craftInventoryTile.addItem(new BattleItem(rule, this._save.getCurrentItemId()), ground);
      }
    }
  }

  private prepareCraftInventoryLoadout(ground: RuleInventory): void {
    const inventory = this._craftInventoryTile?.getInventory();
    if (!inventory) {
      return;
    }

    for (const item of [...inventory]) {
      item.setXCOMProperty(true);
      if (item.getRules().getBattleType() !== BattleType.BT_AMMO) {
        this.placeItemByLayout(item, ground);
      }
    }

    this.loadWeapons(ground);

    for (const item of [...inventory]) {
      if (item.getRules().getBattleType() === BattleType.BT_AMMO) {
        this.placeItemByLayout(item, ground);
      }
    }

    this.autoEquip(this._save.getUnits(), inventory, ground, false);
  }

  private loadWeapons(ground: RuleInventory): void {
    const inventory = this._craftInventoryTile?.getInventory();
    if (!inventory) {
      return;
    }
    const rightHand = this._mod?.getInventory?.("STR_RIGHT_HAND", true) || null;
    for (const item of [...inventory]) {
      if (!rightHand ||
        item.getRules().isFixed() ||
        item.getRules().getCompatibleAmmo().length === 0 ||
        item.getAmmoItem() ||
        (item.getRules().getBattleType() !== BattleType.BT_FIREARM && item.getRules().getBattleType() !== BattleType.BT_MELEE)) {
        continue;
      }
      for (const ammo of [...inventory]) {
        if (ammo.getSlot() === ground && item.setAmmoItem(ammo) === 0) {
          this._save.getItems().push(ammo);
          ammo.setSlot(rightHand);
          break;
        }
      }
    }
    for (let i = inventory.length - 1; i >= 0; --i) {
      if (inventory[i].getSlot() !== ground) {
        inventory.splice(i, 1);
      }
    }
  }

  private placeItemByLayout(item: BattleItem, ground: RuleInventory): boolean {
    if (item.getSlot() !== ground || !this._mod?.getInventory) {
      return false;
    }
    const rightHand = this._mod.getInventory("STR_RIGHT_HAND", true);
    for (const unit of this._save.getUnits()) {
      const soldier = unit.getGeoscapeSoldier();
      const layout = soldier?.getEquipmentLayout?.() || [];
      if (unit.getArmor().getSize() > 1 || !soldier || layout.length === 0) {
        continue;
      }
      for (const layoutItem of layout) {
        const source = layoutItem as any;
        const itemType = typeof source.getItemType === "function" ? source.getItemType() : source.itemType;
        const slotId = typeof source.getSlot === "function" ? source.getSlot() : source.slot;
        const slotX = typeof source.getSlotX === "function" ? source.getSlotX() : source.slotX || 0;
        const slotY = typeof source.getSlotY === "function" ? source.getSlotY() : source.slotY || 0;
        const ammoItem = typeof source.getAmmoItem === "function" ? source.getAmmoItem() : source.ammoItem || "NONE";
        const fuseTimer = typeof source.getFuseTimer === "function" ? source.getFuseTimer() : source.fuseTimer ?? -1;
        const slot = slotId ? this._mod.getInventory(slotId, true) : null;
        if (item.getRules().getType() !== itemType || !slot || this.inventoryOverlaps(unit, item, slot, slotX, slotY)) {
          continue;
        }

        let loaded = ammoItem === "NONE";
        if (!loaded && rightHand) {
          for (const ammo of [...(this._craftInventoryTile?.getInventory() || [])]) {
            if (ammo.getRules().getType() === ammoItem && ammo.getSlot() === ground && item.setAmmoItem(ammo) === 0) {
              this._save.getItems().push(ammo);
              ammo.setSlot(rightHand);
              loaded = true;
              break;
            }
          }
        }
        if (!loaded) {
          continue;
        }

        item.moveToOwner(unit);
        item.setSlot(slot);
        item.setSlotX(slotX);
        item.setSlotY(slotY);
        if ((Options as any).includePrimeStateInSavedLayout &&
          (item.getRules().getBattleType() === BattleType.BT_GRENADE ||
            item.getRules().getBattleType() === BattleType.BT_PROXIMITYGRENADE)) {
          item.setFuseTimer(fuseTimer);
        }
        this._save.getItems().push(item);
        return true;
      }
    }
    return false;
  }

  autoEquip(
    units: BattleUnit[],
    craftInv: BattleItem[],
    ground: RuleInventory,
    overrideEquipmentLayout: boolean,
    allowAutoLoadout = this._allowAutoLoadout,
    addToSave: SavedBattleGame | null = this._save
  ): void {
    for (let pass = 0; pass < 4; ++pass) {
      for (let j = 0; j < craftInv.length;) {
        const item = craftInv[j];
        let add = false;
        if (item.getSlot() === ground) {
          switch (pass) {
            case 0:
              add = this.isRuleRifle(item.getRules());
              break;
            case 1:
              add = this.isRulePistol(item.getRules());
              break;
            case 2:
              add = item.getRules().getBattleType() === BattleType.BT_AMMO;
              break;
            case 3:
              add = !this.isRulePistol(item.getRules()) && !this.isRuleRifle(item.getRules());
              break;
            default:
              break;
          }
        }

        if (add) {
          let placed = false;
          for (const unit of units) {
            const soldier = unit.getGeoscapeSoldier();
            const layout = soldier?.getEquipmentLayout?.() || [];
            if (!unit.hasInventory() || !soldier || (!overrideEquipmentLayout && layout.length > 0)) {
              continue;
            }
            if (allowAutoLoadout && this.addItem(item, unit, pass === 3, addToSave)) {
              craftInv.splice(j, 1);
              placed = true;
              break;
            }
          }
          if (placed) {
            continue;
          }
        }
        ++j;
      }
    }

    for (let i = 0; i < craftInv.length;) {
      const item = craftInv[i];
      if (item.getSlot() !== ground) {
        craftInv.splice(i, 1);
      } else {
        if (addToSave && !addToSave.getItems().includes(item)) {
          addToSave.getItems().push(item);
        }
        ++i;
      }
    }
  }

  private isRuleRifle(rule: RuleItem): boolean {
    return Boolean((rule as any).isRifle?.());
  }

  private isRulePistol(rule: RuleItem): boolean {
    if (typeof (rule as any).isPistol === "function") {
      return Boolean((rule as any).isPistol());
    }
    const battleType = rule.getBattleType();
    return battleType === BattleType.BT_FIREARM || battleType === BattleType.BT_MELEE;
  }

  addAlien(rules: Unit, alienRank: number, outside: boolean): BattleUnit | null {
    const mod = this._mod;
    if (!mod?.getArmor || !mod.getItem) {
      throw new Error("BattlescapeGenerator requires armor rules to place aliens.");
    }
    const armor = mod.getArmor(rules.getArmor(), true);
    if (!armor) {
      throw new Error(`Unit ${rules.getType()} has no matching armor ${rules.getArmor()}.`);
    }
    const unit = new BattleUnit(rules, UnitFaction.FACTION_HOSTILE, this._unitSequence++, armor, null, this._save.getDepth());
    const rank = Math.max(0, Math.min(7, Math.trunc(alienRank)));
    const ranks = outside ? [0, 0, 0, 0, 0, 0, 0] : (Node.nodeRank[rank] || Node.nodeRank[0]);
    let node: Node | null = null;
    for (const nodeRank of ranks) {
      node = this._save.getSpawnNode(nodeRank, unit);
      if (node) {
        break;
      }
    }

    if (!node || !this._save.setUnitPosition(unit, node.getPosition())) {
      return null;
    }

    unit.setAIModule(new AIModule(this._save, unit, node));
    unit.setRankInt(rank);
    const player = this._save.getUnits().find(candidate => candidate.getFaction() === UnitFaction.FACTION_PLAYER);
    let direction = this._save.getTileEngine()?.faceWindow(node.getPosition()) ?? -1;
    if (direction === -1 && player && (this._save.getTileEngine()?.distance(node.getPosition(), player.getPosition()) ?? 21) <= 20) {
      direction = unit.directionTo(player.getPosition());
    }
    unit.setDirection(direction !== -1 ? direction : RNG.generate(0, 7));
    unit.setSpecialWeapon(this._save, { getItem: mod.getItem.bind(mod) });
    this._save.getUnits().push(unit);
    return unit;
  }

  addCivilian(rules: Unit): BattleUnit | null {
    const mod = this._mod;
    if (!mod?.getArmor || !mod.getItem) {
      throw new Error("BattlescapeGenerator requires armor rules to place civilians.");
    }
    const armor = mod.getArmor(rules.getArmor(), true);
    if (!armor) {
      throw new Error(`Unit ${rules.getType()} has no matching armor ${rules.getArmor()}.`);
    }
    const unit = new BattleUnit(rules, UnitFaction.FACTION_NEUTRAL, this._unitSequence++, armor, null, this._save.getDepth());
    const node = this._save.getSpawnNode(0, unit);
    if (!node || !this._save.setUnitPosition(unit, node.getPosition())) {
      return null;
    }
    unit.setAIModule(new AIModule(this._save, unit, node));
    unit.setDirection(RNG.generate(0, 7));
    unit.setSpecialWeapon(this._save, { getItem: mod.getItem.bind(mod) });
    this._save.getUnits().push(unit);
    return unit;
  }

  init(resetTerrain: boolean): void {
    this._blocks = [];
    this._landingzone = [];
    this._segments = [];
    this._drillMap = [];

    const blockWidth = Math.trunc(this._mapsize_x / 10);
    const blockHeight = Math.trunc(this._mapsize_y / 10);
    this._blocks = Array.from({ length: blockWidth }, () => Array.from({ length: blockHeight }, (): MapBlock | null => null));
    this._landingzone = Array.from({ length: blockWidth }, () => Array.from({ length: blockHeight }, () => false));
    this._segments = Array.from({ length: blockWidth }, () => Array.from({ length: blockHeight }, () => 0));
    this._drillMap = Array.from({ length: blockWidth }, () => Array.from({ length: blockHeight }, () => MapDirection.MD_NONE));

    this._blocksToDo = blockWidth * blockHeight;
    this._save.initMap(this._mapsize_x, this._mapsize_y, this._mapsize_z, resetTerrain);
    this._save.initUtilities(this._mod);
  }

  async loadMAP(mapblock: MapBlock, xoff: number, yoff: number, terrain: RuleTerrain, mapDataSetOffset: number, discovered = false, craft = false): Promise<number> {
    if (!this._mod?.loadMapBlock) {
      throw new Error("BattlescapeGenerator requires a Mod with loadMapBlock() to load MAP files.");
    }
    const map = await this._mod.loadMapBlock(mapblock.getName());
    return this.loadMAPData(map, mapblock, xoff, yoff, terrain, mapDataSetOffset, discovered, craft);
  }

  async loadRMP(mapblock: MapBlock, xoff: number, yoff: number, segment: number): Promise<void> {
    if (!this._mod?.loadRoute) {
      throw new Error("BattlescapeGenerator requires a Mod with loadRoute() to load RMP files.");
    }
    const route = await this._mod.loadRoute(mapblock.getName());
    this.loadRMPData(route, mapblock, xoff, yoff, segment);
  }

  loadMAPData(map: ArrayBuffer | Uint8Array, mapblock: MapBlock, xoff: number, yoff: number, terrain: RuleTerrain, mapDataSetOffset: number, discovered = false, craft = false): number {
    const data = bytes(map);
    if (data.length < 3) {
      throw new Error(`Invalid MAP file: MAPS/${mapblock.getName()}.MAP`);
    }

    const sizey = data[0];
    const sizex = data[1];
    const sizez = data[2];
    mapblock.setSizeZ(sizez);

    if (sizez > this._save.getMapSizeZ()) {
      throw new Error(`Height of map MAPS/${mapblock.getName()}.MAP too big for this mission, block is ${sizez}, expected: ${this._save.getMapSizeZ()}`);
    }
    if (sizex !== mapblock.getSizeX() || sizey !== mapblock.getSizeY()) {
      throw new Error(`Map block is not of the size specified MAPS/${mapblock.getName()}.MAP is ${sizex}x${sizey} , expected: ${mapblock.getSizeX()}x${mapblock.getSizeY()}`);
    }

    let x = xoff;
    let y = yoff;
    let z = sizez - 1;
    for (let i = this._save.getMapSizeZ() - 1; i > 0; --i) {
      const floor = this._save.getTile(new Position(x, y, i))?.getMapData(TilePart.O_FLOOR) || null;
      if (floor) {
        z += i;
        if (craft) {
          this._craftZ = i;
        }
        break;
      }
    }

    if (z > this._save.getMapSizeZ() - 1) {
      if (this._save.getMissionType() === "STR_BASE_DEFENSE") {
        throw new Error("Something is wrong with your base, check your log file for additional information.");
      }
      throw new Error("Something is wrong in your map definitions, craft/ufo map is too tall?");
    }

    const expectedLength = 3 + sizex * sizey * sizez * 4;
    if (data.length !== expectedLength) {
      throw new Error(`Invalid MAP file: MAPS/${mapblock.getName()}.MAP`);
    }

    for (let offset = 3; offset < data.length; offset += 4) {
      const tile = this._save.getTile(new Position(x, y, z));
      if (!tile) {
        throw new Error(`MAPS/${mapblock.getName()}.MAP writes outside the battle map at ${x},${y},${z}`);
      }

      for (let part = TilePart.O_FLOOR; part <= TilePart.O_OBJECT; ++part) {
        const terrainObjectID = data[offset + part];
        if (terrainObjectID > 0) {
          const mapDataSetID = { value: mapDataSetOffset };
          const mapDataID = { value: terrainObjectID };
          const md = terrain.getMapData(mapDataID, mapDataSetID);
          if (mapDataSetOffset > 0) {
            tile.setMapData(null, -1, -1, TilePart.O_OBJECT);
          }
          tile.setMapData(md, mapDataID.value, mapDataSetID.value, part as TilePart);
        }
      }

      tile.setDiscovered(discovered || mapblock.isFloorRevealed(z), TilePart.O_NORTHWALL);

      x++;
      if (x === sizex + xoff) {
        x = xoff;
        y++;
      }
      if (y === sizey + yoff) {
        y = yoff;
        z--;
      }
    }

    this.placeMapBlockItems(mapblock, xoff, yoff);
    return sizez;
  }

  loadRMPData(route: ArrayBuffer | Uint8Array, mapblock: MapBlock, xoff: number, yoff: number, segment: number): void {
    const data = bytes(route);
    if (data.length % 24 !== 0) {
      throw new Error(`Invalid RMP file: ROUTES/${mapblock.getName()}.RMP`);
    }

    const nodeOffset = this._save.getNodes().length;
    const badNodes: number[] = [];
    let nodesAdded = 0;

    for (let offset = 0; offset < data.length; offset += 24) {
      const posX = data[offset + 1];
      const posY = data[offset];
      const posZ = data[offset + 2];
      let node: Node;

      if (posX >= 0 && posX < mapblock.getSizeX() &&
        posY >= 0 && posY < mapblock.getSizeY() &&
        posZ >= 0 && posZ < mapblock.getSizeZ()) {
        const pos = new Position(xoff + posX, yoff + posY, mapblock.getSizeZ() - 1 - posZ);
        const type = data[offset + 19];
        const rank = data[offset + 20];
        const flags = data[offset + 21];
        const reserved = data[offset + 22];
        const priority = data[offset + 23];
        node = new Node(this._save.getNodes().length, pos, segment, type, rank, flags, reserved, priority);
        for (let j = 0; j < 5; ++j) {
          let connectID = data[offset + 4 + j * 3];
          if (connectID <= 250) {
            connectID += nodeOffset;
          } else {
            connectID -= 256;
          }
          node.getNodeLinks().push(connectID);
        }
      } else {
        node = new Node();
        node.setDummy(true);
        badNodes.push(nodesAdded);
      }

      this._save.getNodes().push(node);
      nodesAdded++;
    }

    for (const badNode of badNodes) {
      let nodeCounter = nodesAdded;
      for (let i = this._save.getNodes().length - 1; i >= 0 && nodeCounter > 0; --i) {
        const node = this._save.getNodes()[i];
        if (!node.isDummy()) {
          const links = node.getNodeLinks();
          for (let k = 0; k < links.length; ++k) {
            if (links[k] - nodeOffset === badNode) {
              links[k] = -1;
            }
          }
        }
        nodeCounter--;
      }
    }
  }

  getCraftZ(): number {
    return this._craftZ;
  }

  getGenerateFuel(): boolean {
    return this._generateFuel;
  }

  selectPosition(rects: Rect[], sizeX: number, sizeY: number): { x: number; y: number } | null {
    const wholeMap = { x: 0, y: 0, w: Math.trunc(this._mapsize_x / 10), h: Math.trunc(this._mapsize_y / 10) };
    const available = rects.length === 0 ? [wholeMap] : rects;
    const valid: Array<{ x: number; y: number }> = [];
    const seen = new Set<string>();
    sizeX = Math.trunc(sizeX / 10);
    sizeY = Math.trunc(sizeY / 10);

    for (const rect of available) {
      if (sizeX > rect.w || sizeY > rect.h) {
        continue;
      }
      for (let x = rect.x; x + sizeX <= rect.x + rect.w && x + sizeX <= wholeMap.w; ++x) {
        for (let y = rect.y; y + sizeY <= rect.y + rect.h && y + sizeY <= wholeMap.h; ++y) {
          const key = `${x},${y}`;
          if (seen.has(key)) {
            continue;
          }
          seen.add(key);
          let add = true;
          for (let xCheck = x; xCheck !== x + sizeX; ++xCheck) {
            for (let yCheck = y; yCheck !== y + sizeY; ++yCheck) {
              if (this._blocks[xCheck]?.[yCheck]) {
                add = false;
              }
            }
          }
          if (add) {
            valid.push({ x, y });
          }
        }
      }
    }

    if (valid.length === 0) {
      return null;
    }
    return valid[RNG.generate(0, valid.length - 1)];
  }

  async addBlock(x: number, y: number, block: MapBlock | null): Promise<boolean> {
    if (!block) {
      return false;
    }
    if (!this._terrain) {
      throw new Error("BattlescapeGenerator requires a terrain before adding map blocks.");
    }

    const xSize = Math.trunc((block.getSizeX() - 1) / 10);
    const ySize = Math.trunc((block.getSizeY() - 1) / 10);

    for (let xd = 0; xd <= xSize; ++xd) {
      for (let yd = 0; yd !== ySize; ++yd) {
        if (this._blocks[x + xd]?.[y + yd]) {
          return false;
        }
      }
    }

    for (let xd = 0; xd <= xSize; ++xd) {
      for (let yd = 0; yd <= ySize; ++yd) {
        if (!this._blocks[x + xd]) {
          throw new Error("Map block writes outside the battle map.");
        }
        this._blocks[x + xd][y + yd] = this._dummy;
        this._blocksToDo--;
      }
    }

    for (let xd = 0; xd <= xSize; ++xd) {
      this._drillMap[x + xd][y + ySize] = MapDirection.MD_VERTICAL;
    }
    for (let yd = 0; yd <= ySize; ++yd) {
      this._drillMap[x + xSize][y + yd] = MapDirection.MD_HORIZONTAL;
    }
    this._drillMap[x + xSize][y + ySize] = MapDirection.MD_BOTH;

    this._blocks[x][y] = block;
    const visible = this._save.getMissionType() === "STR_BASE_DEFENSE";
    await this.loadMAP(block, x * 10, y * 10, this._terrain, 0, visible);
    return true;
  }

  addCraft(craftMap: MapBlock, command: MapScript): Rect | null {
    if (!this._terrain) {
      throw new Error("BattlescapeGenerator requires a terrain before adding craft.");
    }
    const selected = this.selectPosition(command.getRects(), craftMap.getSizeX(), craftMap.getSizeY());
    if (!selected) {
      return null;
    }

    const craftPos = {
      x: selected.x,
      y: selected.y,
      w: Math.trunc(craftMap.getSizeX() / 10),
      h: Math.trunc(craftMap.getSizeY() / 10)
    };
    for (let x = 0; x < craftPos.w; ++x) {
      for (let y = 0; y < craftPos.h; ++y) {
        this._landingzone[craftPos.x + x][craftPos.y + y] = true;
        const block = command.getNextBlock(this._terrain);
        if (block && !this._blocks[craftPos.x + x][craftPos.y + y]) {
          this._blocks[craftPos.x + x][craftPos.y + y] = block;
          this._blocksToDo--;
        }
      }
    }
    return craftPos;
  }

  clearModule(x: number, y: number, sizeX: number, sizeY: number): void {
    for (let z = 0; z !== this._mapsize_z; ++z) {
      for (let dx = x; dx !== x + sizeX; ++dx) {
        for (let dy = y; dy !== y + sizeY; ++dy) {
          const tile = this._save.getTile(new Position(dx, dy, z));
          if (!tile) {
            continue;
          }
          for (let i = TilePart.O_FLOOR; i <= TilePart.O_OBJECT; ++i) {
            tile.setMapData(null, -1, -1, i as TilePart);
          }
        }
      }
    }
  }

  drillModules(data: NonNullable<ReturnType<MapScript["getTunnelData"]>>, rects: Rect[], dir: MapDirection): void {
    if (!this._terrain) {
      throw new Error("BattlescapeGenerator requires a terrain before drilling map modules.");
    }
    const wWall = data.getMCDReplacement("westWall");
    const nWall = data.getMCDReplacement("northWall");
    const corner = data.getMCDReplacement("corner");
    const floor = data.getMCDReplacement("floor");
    const rect = rects.length > 0 ? rects[0] : { x: 3, y: 3, w: 3, h: 3 };

    for (let i = 0; i < Math.trunc(this._mapsize_x / 10); ++i) {
      for (let j = 0; j < Math.trunc(this._mapsize_y / 10); ++j) {
        if (!this._blocks[i][j]) {
          continue;
        }

        if (dir !== MapDirection.MD_VERTICAL) {
          if (i < Math.trunc(this._mapsize_x / 10) - 1 &&
            (this._drillMap[i][j] === MapDirection.MD_HORIZONTAL || this._drillMap[i][j] === MapDirection.MD_BOTH) &&
            this._blocks[i + 1][j]) {
            for (let k = rect.y; k !== rect.y + rect.h; ++k) {
              let tile = this._save.getTile(new Position((i * 10) + 9, (j * 10) + k, data.level));
              if (tile) {
                tile.setMapData(null, -1, -1, TilePart.O_WESTWALL);
                tile.setMapData(null, -1, -1, TilePart.O_OBJECT);
                if (floor) {
                  const md = this._terrain.getMapDataSets()[floor.set].getObject(floor.entry);
                  tile.setMapData(md, floor.entry, floor.set, TilePart.O_FLOOR);
                }

                tile = this._save.getTile(new Position((i + 1) * 10, (j * 10) + k, data.level));
                tile?.setMapData(null, -1, -1, TilePart.O_WESTWALL);
                const obj = tile?.getMapData(TilePart.O_OBJECT);
                if (obj && obj.getTUCost(MovementType.MT_WALK) === 0) {
                  tile?.setMapData(null, -1, -1, TilePart.O_OBJECT);
                }
              }
            }

            if (nWall) {
              const md = this._terrain.getMapDataSets()[nWall.set].getObject(nWall.entry);
              this._save.getTile(new Position((i * 10) + 9, (j * 10) + rect.y, data.level))?.setMapData(md, nWall.entry, nWall.set, TilePart.O_NORTHWALL);
              this._save.getTile(new Position((i * 10) + 9, (j * 10) + rect.y + rect.h, data.level))?.setMapData(md, nWall.entry, nWall.set, TilePart.O_NORTHWALL);
            }

            if (corner) {
              const md = this._terrain.getMapDataSets()[corner.set].getObject(corner.entry);
              const tile = this._save.getTile(new Position((i + 1) * 10, (j * 10) + rect.y, data.level));
              if (tile && !tile.getMapData(TilePart.O_NORTHWALL)) {
                tile.setMapData(md, corner.entry, corner.set, TilePart.O_NORTHWALL);
              }
            }
          }
        }

        if (dir !== MapDirection.MD_HORIZONTAL) {
          if (j < Math.trunc(this._mapsize_y / 10) - 1 &&
            (this._drillMap[i][j] === MapDirection.MD_VERTICAL || this._drillMap[i][j] === MapDirection.MD_BOTH) &&
            this._blocks[i][j + 1]) {
            for (let k = rect.x; k !== rect.x + rect.w; ++k) {
              let tile = this._save.getTile(new Position((i * 10) + k, (j * 10) + 9, data.level));
              if (tile) {
                tile.setMapData(null, -1, -1, TilePart.O_NORTHWALL);
                tile.setMapData(null, -1, -1, TilePart.O_OBJECT);
                if (floor) {
                  const md = this._terrain.getMapDataSets()[floor.set].getObject(floor.entry);
                  tile.setMapData(md, floor.entry, floor.set, TilePart.O_FLOOR);
                }

                tile = this._save.getTile(new Position((i * 10) + k, (j + 1) * 10, data.level));
                tile?.setMapData(null, -1, -1, TilePart.O_NORTHWALL);
                const obj = tile?.getMapData(TilePart.O_OBJECT);
                if (obj && obj.getTUCost(MovementType.MT_WALK) === 0) {
                  tile?.setMapData(null, -1, -1, TilePart.O_OBJECT);
                }
              }
            }

            if (wWall) {
              const md = this._terrain.getMapDataSets()[wWall.set].getObject(wWall.entry);
              this._save.getTile(new Position((i * 10) + rect.x, (j * 10) + 9, data.level))?.setMapData(md, wWall.entry, wWall.set, TilePart.O_WESTWALL);
              this._save.getTile(new Position((i * 10) + rect.x + rect.w, (j * 10) + 9, data.level))?.setMapData(md, wWall.entry, wWall.set, TilePart.O_WESTWALL);
            }

            if (corner) {
              const md = this._terrain.getMapDataSets()[corner.set].getObject(corner.entry);
              const tile = this._save.getTile(new Position((i * 10) + rect.x, (j + 1) * 10, data.level));
              if (tile && !tile.getMapData(TilePart.O_WESTWALL)) {
                tile.setMapData(md, corner.entry, corner.set, TilePart.O_WESTWALL);
              }
            }
          }
        }
      }
    }
  }

  async generateBaseMap(): Promise<void> {
    if (!this._base || !this._terrain) {
      throw new Error("BattlescapeGenerator requires a base and terrain for base defense map generation.");
    }

    for (const facility of this._base.getFacilities()) {
      if (facility.getBuildTime() !== 0) {
        continue;
      }
      let num = 0;
      const xLimit = facility.getX() + facility.getRules().getSize() - 1;
      const yLimit = facility.getY() + facility.getRules().getSize() - 1;

      for (let y = facility.getY(); y <= yLimit; ++y) {
        for (let x = facility.getX(); x <= xLimit; ++x) {
          const mapname = facility.getRules().getMapName();
          const prefix = mapname.slice(0, Math.max(0, mapname.length - 2));
          const baseNumber = Number.parseInt(mapname.slice(Math.max(0, mapname.length - 2)), 10) || 0;
          const mapnum = baseNumber + num;
          const newname = `${prefix}${mapnum < 10 ? "0" : ""}${mapnum}`;
          await this.addBlock(x, y, this._terrain.getMapBlock(newname));
          this._drillMap[x][y] = MapDirection.MD_NONE;
          num++;

          if (facility.getRules().getStorage() > 0) {
            let groundLevel = this._mapsize_z - 1;
            for (; groundLevel >= 0; --groundLevel) {
              if (!this._save.getTile(new Position(x * 10, y * 10, groundLevel))?.hasNoFloor(null)) {
                break;
              }
            }
            for (let k = x * 10; k !== (x + 1) * 10; ++k) {
              for (let l = y * 10; l !== (y + 1) * 10; ++l) {
                if ((k + l) % 2 === 0) {
                  const t = this._save.getTile(new Position(k, l, groundLevel));
                  const tEast = this._save.getTile(new Position(k + 1, l, groundLevel));
                  const tSouth = this._save.getTile(new Position(k, l + 1, groundLevel));
                  if (t && t.getMapData(TilePart.O_FLOOR) && !t.getMapData(TilePart.O_OBJECT) &&
                    tEast && !tEast.getMapData(TilePart.O_WESTWALL) &&
                    tSouth && !tSouth.getMapData(TilePart.O_NORTHWALL)) {
                    this._save.getStorageSpace().push(new Position(k, l, groundLevel));
                  }
                }
              }
            }
            if (!this._craftInventoryTile) {
              this._craftInventoryTile = this._save.getTile(new Position((x * 10) + 5, (y * 10) + 5, groundLevel - 1));
            }
          }
        }
      }

      for (let x = facility.getX(); x <= xLimit; ++x) {
        this._drillMap[x][yLimit] = MapDirection.MD_VERTICAL;
      }
      for (let y = facility.getY(); y <= yLimit; ++y) {
        this._drillMap[xLimit][y] = MapDirection.MD_HORIZONTAL;
      }
      this._drillMap[xLimit][yLimit] = MapDirection.MD_BOTH;
    }
    this._save.calculateModuleMap();
  }

  async loadNodes(): Promise<void> {
    let segment = 0;
    for (let itY = 0; itY < Math.trunc(this._mapsize_y / 10); ++itY) {
      for (let itX = 0; itX < Math.trunc(this._mapsize_x / 10); ++itX) {
        this._segments[itX][itY] = segment;
        const block = this._blocks[itX][itY];
        if (block && block !== this._dummy) {
          if (!(block.isInGroup(MapBlockType.MT_LANDINGZONE) && this._landingzone[itX][itY])) {
            await this.loadRMP(block, itX * 10, itY * 10, segment++);
          }
        }
      }
    }
  }

  attachNodeLinks(): void {
    for (const node of this._save.getNodes()) {
      if (node.isDummy()) {
        continue;
      }
      const segmentX = Math.trunc(node.getPosition().x / 10);
      const segmentY = Math.trunc(node.getPosition().y / 10);
      const neighbourDirections = [-2, -3, -4, -5];
      const neighbourDirectionsInverted = [-4, -5, -2, -3];
      const neighbourSegments = [
        segmentX === Math.trunc(this._mapsize_x / 10) - 1 ? -1 : this._segments[segmentX + 1][segmentY],
        segmentY === Math.trunc(this._mapsize_y / 10) - 1 ? -1 : this._segments[segmentX][segmentY + 1],
        segmentX === 0 ? -1 : this._segments[segmentX - 1][segmentY],
        segmentY === 0 ? -1 : this._segments[segmentX][segmentY - 1]
      ];

      const links = node.getNodeLinks();
      for (let j = 0; j < links.length; ++j) {
        for (let n = 0; n < 4; ++n) {
          if (links[j] === neighbourDirections[n]) {
            for (const other of this._save.getNodes()) {
              if (other.isDummy()) {
                continue;
              }
              if (other.getSegment() === neighbourSegments[n]) {
                const otherLinks = other.getNodeLinks();
                for (let l = 0; l < otherLinks.length; ++l) {
                  if (otherLinks[l] === neighbourDirectionsInverted[n]) {
                    otherLinks[l] = node.getID();
                    links[j] = other.getID();
                  }
                }
              }
            }
          }
        }
      }
    }
  }

  getBlocksToDo(): number {
    return this._blocksToDo;
  }

  getSegments(): number[][] {
    return this._segments;
  }

  isCraftDeployed(): boolean {
    return this._craftDeployed;
  }

  getCraftInventoryTile(): Tile | null {
    return this._craftInventoryTile;
  }

  getBlocks(): Array<Array<MapBlock | null>> {
    return this._blocks;
  }

  private getDeploymentQuantity(data: DeploymentData): number {
    const deltaQuantity = RNG.generate(0, Math.max(0, data.dQty));
    let quantity: number;
    if (this._difficulty < GameDifficulty.DIFF_VETERAN) {
      quantity = data.lowQty + deltaQuantity;
    } else if (this._difficulty < GameDifficulty.DIFF_SUPERHUMAN) {
      quantity = data.lowQty + Math.trunc((data.highQty - data.lowQty) / 2) + deltaQuantity;
    } else {
      quantity = data.highQty + deltaQuantity;
    }
    return Math.max(0, quantity + RNG.generate(0, Math.max(0, data.extraQty)));
  }

  private getItemLevelChoices(): number[] {
    const itemLevels = this._mod?.getAlienItemLevels?.() || [];
    if (itemLevels.length === 0) {
      return [0];
    }
    const month = Math.max(0, Math.min(itemLevels.length - 1, this._alienItemLevel));
    return itemLevels[month]?.length ? itemLevels[month] : [0];
  }

  private addBuiltInWeapons(rule: Unit, itemLevel: number, unit: BattleUnit): void {
    const builtInWeapons = rule.getBuiltInWeapons();
    if (builtInWeapons.length === 0) {
      return;
    }
    const level = Math.max(0, Math.min(builtInWeapons.length - 1, itemLevel));
    for (const type of builtInWeapons[level]) {
      const item = this.addRuleItemToUnit(type, unit);
      if (item && item.getRules().getTurretType() !== -1) {
        unit.setTurretType(item.getRules().getTurretType());
      }
    }
  }

  private addAlienEquipment(rule: Unit, data: DeploymentData, itemLevel: number, unit: BattleUnit): void {
    if (!this._mod?.getItem) {
      throw new Error("BattlescapeGenerator requires item rules to equip aliens.");
    }

    this.addBuiltInWeapons(rule, itemLevel, unit);

    if (rule.isLivingWeapon()) {
      const terroristWeapon = `${rule.getRace().slice(4)}_WEAPON`;
      const item = this.addRuleItemToUnit(terroristWeapon, unit);
      if (item) {
        unit.setTurretType(item.getRules().getTurretType());
      }
      return;
    }

    if (data.itemSets.length === 0) {
      throw new Error("Unit generator encountered an error: item set not defined.");
    }
    const level = Math.max(0, Math.min(data.itemSets.length - 1, itemLevel));
    for (const type of data.itemSets[level].items) {
      this.addRuleItemToUnit(type, unit);
    }
  }

  private addRuleItemToUnit(type: string, unit: BattleUnit): BattleItem | null {
    const ruleItem = this._mod?.getItem?.(type);
    if (!ruleItem) {
      return null;
    }
    const item = new BattleItem(ruleItem, this._save.getCurrentItemId());
    return this.addItem(item, unit) ? item : null;
  }

  addItem(item: BattleItem, unit: BattleUnit, _allowSecondClip = true, addToSave: SavedBattleGame | null = this._save): boolean {
    if (!this._mod?.getInventory || !this._mod?.getInvsList) {
      throw new Error("BattlescapeGenerator requires inventory rules to equip units.");
    }

    const rightHand = this._mod.getInventory("STR_RIGHT_HAND", true);
    const leftHand = this._mod.getInventory("STR_LEFT_HAND", true);
    if (!rightHand || !leftHand) {
      throw new Error("Hand inventory slots not found.");
    }

    let placed = false;
    const rightWeapon = unit.getItem("STR_RIGHT_HAND");
    const leftWeapon = unit.getItem("STR_LEFT_HAND");
    const rules = item.getRules();

    if (rules.isFixed()) {
      if (!rightWeapon || !leftWeapon) {
        item.moveToOwner(unit);
        item.setSlot(!rightWeapon ? rightHand : leftHand);
        placed = true;
      }
      return this.finishUnitItemPlacement(item, unit, placed, addToSave);
    }

    switch (rules.getBattleType()) {
      case BattleType.BT_FIREARM:
      case BattleType.BT_MELEE:
        if (!rightWeapon) {
          item.moveToOwner(unit);
          item.setSlot(rightHand);
          placed = true;
        } else if (!leftWeapon && unit.getFaction() !== UnitFaction.FACTION_PLAYER) {
          item.moveToOwner(unit);
          item.setSlot(leftHand);
          placed = true;
        }
        break;
      case BattleType.BT_AMMO:
        if (rightWeapon &&
          rightWeapon.getRules().getCompatibleAmmo().length > 0 &&
          !rightWeapon.getAmmoItem() &&
          rightWeapon.setAmmoItem(item) === 0) {
          item.setSlot(rightHand);
          placed = true;
          break;
        }
        if (leftWeapon &&
          leftWeapon.getRules().getCompatibleAmmo().length > 0 &&
          !leftWeapon.getAmmoItem() &&
          leftWeapon.setAmmoItem(item) === 0) {
          item.setSlot(leftHand);
          placed = true;
          break;
        }
        placed = this.placeItemInInventory(item, unit);
        break;
      default:
        placed = this.placeItemInInventory(item, unit);
        break;
    }

    return this.finishUnitItemPlacement(item, unit, placed, addToSave);
  }

  private placeItemInInventory(item: BattleItem, unit: BattleUnit): boolean {
    if (!this._mod?.getInventory || !this._mod?.getInvsList) {
      return false;
    }
    for (const slotName of this._mod.getInvsList()) {
      const slot = this._mod.getInventory(slotName);
      if (!slot || slot.getType() !== InventoryType.INV_SLOT) {
        continue;
      }
      for (const position of slot.getSlots()) {
        if (!slot.fitItemInSlot(item.getRules(), position.x, position.y)) {
          continue;
        }
        if (this.inventoryOverlaps(unit, item, slot, position.x, position.y)) {
          continue;
        }
        item.moveToOwner(unit);
        item.setSlot(slot);
        item.setSlotX(position.x);
        item.setSlotY(position.y);
        return true;
      }
    }
    return false;
  }

  private inventoryOverlaps(unit: BattleUnit, item: BattleItem, slot: RuleInventory, x: number, y: number): boolean {
    return unit.getInventory().some(existing => existing.getSlot() === slot && existing.occupiesSlot(x, y, item));
  }

  private finishUnitItemPlacement(item: BattleItem, unit: BattleUnit, placed: boolean, addToSave: SavedBattleGame | null = this._save): boolean {
    if (placed) {
      if (addToSave && !addToSave.getItems().includes(item)) {
        addToSave.getItems().push(item);
      }
    }
    item.setXCOMProperty(unit.getFaction() === UnitFaction.FACTION_PLAYER);
    return placed;
  }

  private placeMapBlockItems(mapblock: MapBlock, xoff: number, yoff: number): void {
    if (this._generateFuel) {
      this._generateFuel = mapblock.getItems().size === 0;
    }
    if (mapblock.getItems().size === 0) {
      return;
    }
    if (!this._mod?.getItem || !this._mod?.getInventory) {
      throw new Error("BattlescapeGenerator requires item and inventory rules to place map block items.");
    }
    const ground = this._mod.getInventory("STR_GROUND", true);
    if (!ground) {
      throw new Error("Inventory STR_GROUND not found.");
    }
    for (const [type, positions] of mapblock.getItems()) {
      const rule = this._mod.getItem(type, true);
      if (!rule) {
        throw new Error(`Item rule ${type} not found.`);
      }
      for (const position of positions) {
        const item = new BattleItem(rule, this._save.getCurrentItemId());
        this._save.getItems().push(item);
        const tile = this._save.getTile(new Position(position.x + xoff, position.y + yoff, position.z));
        if (!tile) {
          throw new Error(`Map block item ${type} is outside the battle map at ${position.x + xoff},${position.y + yoff},${position.z}.`);
        }
        tile.addItem(item, ground);
      }
    }
  }

  private async loadTerrainMapDataSets(terrain: RuleTerrain): Promise<number> {
    let mapDataSetIDOffset = 0;
    const mapDataSets = terrain.getMapDataSets();
    for (let i = 0; i < mapDataSets.length; ++i) {
      let set = mapDataSets[i];
      if (set.getSize() === 0) {
        if (!this._mod?.loadMapDataSet) {
          throw new Error("BattlescapeGenerator requires a Mod with loadMapDataSet() to generate maps.");
        }
        set = await this._mod.loadMapDataSet(set.getName());
        mapDataSets[i] = set;
      }
      this._save.getMapDataSets().push(set);
      mapDataSetIDOffset++;
    }
    return mapDataSetIDOffset;
  }

  private async executeMapScriptCommand(
    command: MapScript,
    previousSuccess: boolean,
    context: {
      setCraftMap: (map: MapBlock) => void;
      addUfoMap: (map: MapBlock, pos: Rect, terrain: RuleTerrain) => void;
    }
  ): Promise<{ success: boolean; craftMap: MapBlock | null }> {
    if (!this._terrain) {
      throw new Error("BattlescapeGenerator requires a terrain before executing map scripts.");
    }

    let success = previousSuccess;
    let craftMapResult: MapBlock | null = null;
    let block: MapBlock | null = null;
    switch (command.getType()) {
      case MapScriptCommand.MSC_ADDBLOCK: {
        block = command.getNextBlock(this._terrain);
        if (block) {
          const pos = this.selectPosition(command.getRects(), block.getSizeX(), block.getSizeY());
          if (pos) {
            success = await this.addBlock(pos.x, pos.y, block) || success;
          }
        }
        break;
      }
      case MapScriptCommand.MSC_ADDLINE:
        success = await this.addLine(command.getDirection(), command.getRects());
        break;
      case MapScriptCommand.MSC_ADDCRAFT:
        if (this._craft) {
          const craftTerrain = this._craft.getRules().getBattlescapeTerrainData();
          const craftMap = craftTerrain?.getRandomMapBlock(999, 999, 0, false) || null;
          if (craftTerrain && craftMap) {
            const pos = this.addCraft(craftMap, command);
            if (pos) {
              this._craftPos = pos;
              craftMapResult = craftMap;
              context.setCraftMap(craftMap);
              for (let x = this._craftPos.x; x < this._craftPos.x + this._craftPos.w; ++x) {
                for (let y = this._craftPos.y; y < this._craftPos.y + this._craftPos.h; ++y) {
                  const terrainBlock = this._blocks[x][y];
                  if (terrainBlock) {
                    await this.loadMAP(terrainBlock, x * 10, y * 10, this._terrain, 0);
                  }
                }
              }
              this._craftDeployed = true;
              success = true;
            }
          }
        }
        break;
      case MapScriptCommand.MSC_ADDUFO: {
        let ufoTerrain: RuleTerrain | null = null;
        const ufoName = command.getUFOName();
        if (ufoName && this._mod?.getUfo) {
          ufoTerrain = this._mod.getUfo(ufoName)?.getBattlescapeTerrainData() || null;
        }
        if (!ufoTerrain && this._ufo) {
          ufoTerrain = this._ufo.getRules().getBattlescapeTerrainData();
        }
        if (ufoTerrain) {
          const ufoMap = ufoTerrain.getRandomMapBlock(999, 999, 0, false);
          if (ufoMap) {
            const pos = this.addCraft(ufoMap, command);
            if (pos) {
              context.addUfoMap(ufoMap, pos, ufoTerrain);
              for (let x = pos.x; x < pos.x + pos.w; ++x) {
                for (let y = pos.y; y < pos.y + pos.h; ++y) {
                  const terrainBlock = this._blocks[x][y];
                  if (terrainBlock) {
                    await this.loadMAP(terrainBlock, x * 10, y * 10, this._terrain, 0);
                  }
                }
              }
              success = true;
            }
          }
        }
        break;
      }
      case MapScriptCommand.MSC_DIGTUNNEL:
        if (!command.getTunnelData()) {
          throw new Error("BattlescapeGenerator digTunnel command requires tunnelData.");
        }
        this.drillModules(command.getTunnelData()!, command.getRects(), command.getDirection());
        success = true;
        break;
      case MapScriptCommand.MSC_FILLAREA:
        block = command.getNextBlock(this._terrain);
        while (block) {
          const pos = this.selectPosition(command.getRects(), block.getSizeX(), block.getSizeY());
          if (pos) {
            success = await this.addBlock(pos.x, pos.y, block) || success;
          } else {
            break;
          }
          block = command.getNextBlock(this._terrain);
        }
        break;
      case MapScriptCommand.MSC_CHECKBLOCK:
        success = this.checkBlock(command) || success;
        break;
      case MapScriptCommand.MSC_REMOVE:
        success = this.removeBlocks(command);
        break;
      case MapScriptCommand.MSC_RESIZE:
        this.resizeMap(command);
        break;
      default:
        break;
    }
    return { success, craftMap: craftMapResult };
  }

  private async addLine(direction: MapDirection, rects: Rect[]): Promise<boolean> {
    if (!this._terrain) {
      throw new Error("BattlescapeGenerator requires a terrain before adding map lines.");
    }
    if (direction === MapDirection.MD_BOTH) {
      if (await this.addLine(MapDirection.MD_VERTICAL, rects)) {
        await this.addLine(MapDirection.MD_HORIZONTAL, rects);
        return true;
      }
      return false;
    }

    let tries = 0;
    let placed = false;
    let roadX = 0;
    let roadY = 0;
    let comparator = MapBlockType.MT_NSROAD;
    let typeToAdd = MapBlockType.MT_EWROAD;
    let limit = Math.trunc(this._mapsize_x / 10);
    const vertical = direction === MapDirection.MD_VERTICAL;
    if (vertical) {
      comparator = MapBlockType.MT_EWROAD;
      typeToAdd = MapBlockType.MT_NSROAD;
      limit = Math.trunc(this._mapsize_y / 10);
    }

    while (!placed) {
      const selected = this.selectPosition(rects, 10, 10);
      if (!selected) {
        return false;
      }
      roadX = selected.x;
      roadY = selected.y;
      placed = true;
      for (let iteratorValue = 0; iteratorValue < limit; iteratorValue += 1) {
        if (vertical) {
          roadY = iteratorValue;
        } else {
          roadX = iteratorValue;
        }
        const block = this._blocks[roadX][roadY];
        if (block && !block.isInGroup(comparator)) {
          placed = false;
          break;
        }
      }
      if (tries++ > 20) {
        return false;
      }
    }

    for (let iteratorValue = 0; iteratorValue < limit; iteratorValue += 1) {
      if (vertical) {
        roadY = iteratorValue;
      } else {
        roadX = iteratorValue;
      }
      const block = this._blocks[roadX][roadY];
      if (!block) {
        await this.addBlock(roadX, roadY, this._terrain.getRandomMapBlock(10, 10, typeToAdd));
      } else if (block.isInGroup(comparator)) {
        const crossing = this._terrain.getRandomMapBlock(10, 10, MapBlockType.MT_CROSSING);
        if (!crossing) {
          return false;
        }
        this._blocks[roadX][roadY] = crossing;
        this.clearModule(roadX * 10, roadY * 10, 10, 10);
        await this.loadMAP(crossing, roadX * 10, roadY * 10, this._terrain, 0);
      }
    }
    return true;
  }

  private checkBlock(command: MapScript): boolean {
    if (!this._terrain) {
      throw new Error("BattlescapeGenerator requires a terrain before checking map blocks.");
    }
    let success = false;
    for (const rect of command.getRects()) {
      for (let x = rect.x; x !== rect.x + rect.w && x !== Math.trunc(this._mapsize_x / 10) && !success; ++x) {
        for (let y = rect.y; y !== rect.y + rect.h && y !== Math.trunc(this._mapsize_y / 10) && !success; ++y) {
          const block = this._blocks[x]?.[y] || null;
          if (command.getGroups().length > 0) {
            for (const group of command.getGroups()) {
              success = !!block && block.isInGroup(group);
              if (success) {
                break;
              }
            }
          } else if (command.getBlocks().length > 0) {
            for (const blockIndex of command.getBlocks()) {
              if (blockIndex < this._terrain.getMapBlocks().length) {
                success = block === this._terrain.getMapBlocks()[blockIndex];
              }
              if (success) {
                break;
              }
            }
          } else {
            success = block !== null;
          }
        }
      }
      if (success) {
        break;
      }
    }
    return success;
  }

  private removeBlocks(command: MapScript): boolean {
    if (!this._terrain) {
      throw new Error("BattlescapeGenerator requires a terrain before removing map blocks.");
    }
    const deleted: Array<{ x: number; y: number }> = [];
    const deletedKeys = new Set<string>();
    let success = false;

    for (const rect of command.getRects()) {
      for (let x = rect.x; x !== rect.x + rect.w && x !== Math.trunc(this._mapsize_x / 10); ++x) {
        for (let y = rect.y; y !== rect.y + rect.h && y !== Math.trunc(this._mapsize_y / 10); ++y) {
          const block = this._blocks[x]?.[y] || null;
          if (block && block !== this._dummy) {
            const key = `${x},${y}`;
            if (command.getGroups().length > 0) {
              for (const group of command.getGroups()) {
                if (block.isInGroup(group) && !deletedKeys.has(key)) {
                  deleted.push({ x, y });
                  deletedKeys.add(key);
                }
              }
            } else if (command.getBlocks().length > 0) {
              for (const blockIndex of command.getBlocks()) {
                if (blockIndex < this._terrain.getMapBlocks().length && !deletedKeys.has(key)) {
                  deleted.push({ x, y });
                  deletedKeys.add(key);
                }
              }
            } else if (!deletedKeys.has(key)) {
              deleted.push({ x, y });
              deletedKeys.add(key);
            }
          }
        }
      }
    }

    for (const pos of deleted) {
      const block = this._blocks[pos.x][pos.y];
      if (!block) {
        continue;
      }
      this.clearModule(pos.x * 10, pos.y * 10, block.getSizeX(), block.getSizeY());
      const delx = Math.trunc(block.getSizeX() / 10);
      const dely = Math.trunc(block.getSizeY() / 10);
      for (let dx = pos.x; dx !== pos.x + delx; ++dx) {
        for (let dy = pos.y; dy !== pos.y + dely; ++dy) {
          this._blocks[dx][dy] = null;
          this._blocksToDo++;
        }
      }
      success = true;
    }
    return success;
  }

  private resizeMap(command: MapScript): void {
    if (this._save.getMissionType() === "STR_BASE_DEFENSE") {
      throw new Error("Map Generator encountered an error: Base defense map cannot be resized.");
    }
    if (this._blocksToDo < Math.trunc(this._mapsize_x / 10) * Math.trunc(this._mapsize_y / 10)) {
      throw new Error("Map Generator encountered an error: One does not simply resize the map after adding blocks.");
    }

    if (command.getSizeX() > 0 && command.getSizeX() !== Math.trunc(this._mapsize_x / 10)) {
      this._mapsize_x = command.getSizeX() * 10;
    }
    if (command.getSizeY() > 0 && command.getSizeY() !== Math.trunc(this._mapsize_y / 10)) {
      this._mapsize_y = command.getSizeY() * 10;
    }
    if (command.getSizeZ() > 0 && command.getSizeZ() !== this._mapsize_z) {
      this._mapsize_z = command.getSizeZ();
    }
    this.init(false);
  }
}
