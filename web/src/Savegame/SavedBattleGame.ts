import { BattleActionType } from "../Battlescape/BattleAction.ts";
import { AIModule } from "../Battlescape/AIModule.ts";
import { Pathfinding } from "../Battlescape/Pathfinding.ts";
import { Position, type PositionLike } from "../Battlescape/Position.ts";
import { TileEngine } from "../Battlescape/TileEngine.ts";
import { RNG } from "../Engine/RNG.ts";
import { ChronoTrigger } from "../Mod/AlienDeployment.ts";
import { MovementType, type Armor } from "../Mod/Armor.ts";
import { MapDataSet } from "../Mod/MapDataSet.ts";
import { SpecialTileType, TilePart } from "../Mod/MapData.ts";
import { InventoryType, type RuleInventory } from "../Mod/RuleInventory.ts";
import { ItemDamageType, type RuleItem } from "../Mod/RuleItem.ts";
import type { Unit } from "../Mod/Unit.ts";
import { BattleItem, type BattleItemSave } from "./BattleItem.ts";
import { BattleUnit, UnitFaction, UnitStatus, type BattleUnitSave, type StatAdjustment } from "./BattleUnit.ts";
import { Node, type NodeSave } from "./Node.ts";
import type { Soldier } from "./Soldier.ts";
import { Tile, type TileSave } from "./Tile.ts";
import type { BattlescapeState } from "../Battlescape/BattlescapeState.ts";
import type { BattlescapeGame } from "../Battlescape/BattlescapeGame.ts";
import type { State } from "../Engine/State.ts";
import { registerSavedBattleGame } from "./SavedBattleGameRegistry.ts";
import { serializeInt, unserializeInt } from "./SerializationHelper.ts";

type BattleUtilityModLike = {
  getVoxelData?: () => number[];
};

type ConvertUnitModLike = BattleUtilityModLike & {
  getUnit: (type: string, error?: boolean) => Unit | null;
  getArmor: (type: string, error?: boolean) => Armor | null;
  getItem: (type: string, error?: boolean) => RuleItem | null;
  getInventory: (id: string, error?: boolean) => RuleInventory | null;
  getMapDataSet?: (name: string) => MapDataSet;
  getStatAdjustment?: (difficulty: number) => StatAdjustment | null;
};

type ConvertUnitSavedGameLike = {
  getDifficulty?: () => number;
  getSoldier?: (id: number) => Soldier | null;
};

export type SavedBattleGameSave = {
  width?: number;
  length?: number;
  height?: number;
  missionType?: string;
  globalshade?: number;
  turn?: number;
  selectedUnit?: number;
  mapdatasets?: string[];
  tiles?: TileSave[];
  tileIndexSize?: number;
  tileTotalBytesPer?: number;
  tileFireSize?: number;
  tileSmokeSize?: number;
  tileIDSize?: number;
  tileSetIDSize?: number;
  tileBoolFieldsSize?: number;
  totalTiles?: number;
  binTiles?: string | number[];
  nodes?: NodeSave[];
  units?: ReturnType<BattleUnit["save"]>[];
  items?: ReturnType<BattleItem["save"]>[];
  tuReserved?: number;
  kneelReserved?: boolean;
  depth?: number;
  ambience?: number;
  ambientVolume?: number;
  recoverGuaranteed?: ReturnType<BattleItem["save"]>[];
  recoverConditional?: ReturnType<BattleItem["save"]>[];
  music?: string;
  turnLimit?: number;
  chronoTrigger?: number;
  cheatTurn?: number;
  objectiveType?: number;
  objectivesDestroyed?: number;
  objectivesNeeded?: number;
  moduleMap?: Array<Array<[number, number] | number[]>>;
};

export class SavedBattleGame {
  private _mapsize_x = 0;
  private _mapsize_y = 0;
  private _mapsize_z = 0;
  private _mapDataSets: MapDataSet[] = [];
  private _tiles: Tile[] = [];
  private _selectedUnit: BattleUnit | null = null;
  private _lastSelectedUnit: BattleUnit | null = null;
  private _nodes: Node[] = [];
  private _units: BattleUnit[] = [];
  private _items: BattleItem[] = [];
  private _deleted: BattleItem[] = [];
  private _missionType = "";
  private _globalShade = 0;
  private _side = UnitFaction.FACTION_PLAYER;
  private _turn = 1;
  private _debugMode = false;
  private _aborted = false;
  private _itemId = 0;
  private _objectiveType = -1;
  private _objectivesDestroyed = 0;
  private _objectivesNeeded = 0;
  private _fallingUnits: BattleUnit[] = [];
  private _unitsFalling = false;
  private _cheating = false;
  private _tileSearch: Position[] = [];
  private _storageSpace: Position[] = [];
  private _tuReserved = BattleActionType.BA_NONE;
  private _kneelReserved = false;
  private _baseModules: Array<Array<[number, number]>> = [];
  private _depth = 0;
  private _ambience = -1;
  private _ambientVolume = 0.5;
  private _recoverGuaranteed: BattleItem[] = [];
  private _recoverConditional: BattleItem[] = [];
  private _music = "";
  private _turnLimit = 0;
  private _cheatTurn = 20;
  private _chronoTrigger = ChronoTrigger.FORCE_LOSE;
  private _beforeGame = true;
  private _pathfinding: Pathfinding | null = null;
  private _tileEngine: TileEngine | null = null;
  private _battleState: BattlescapeState | null = null;

  constructor() {
    this._tileSearch = Array.from({ length: 11 * 11 }, (_, i) => new Position((i % 11) - 5, Math.trunc(i / 11) - 5, 0));
  }

  private static bytesToBase64(bytes: Uint8Array): string {
    let binary = "";
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
    }
    return btoa(binary);
  }

  private static bytesFromBinTiles(raw: string | number[] | undefined): Uint8Array {
    if (raw == null) {
      return new Uint8Array();
    }
    if (Array.isArray(raw)) {
      return Uint8Array.from(raw);
    }
    if (raw.length === 0) {
      return new Uint8Array();
    }
    return Uint8Array.from(atob(raw), char => char.charCodeAt(0));
  }

  load(node: SavedBattleGameSave, mod: ConvertUnitModLike | null = null, savedGame: ConvertUnitSavedGameLike | null = null): void {
    this.initMap(node.width ?? this._mapsize_x, node.length ?? this._mapsize_y, node.height ?? this._mapsize_z);
    this._missionType = node.missionType ?? this._missionType;
    this._globalShade = node.globalshade ?? this._globalShade;
    this._turn = node.turn ?? this._turn;
    this._depth = node.depth ?? this._depth;
    const selectedUnit = node.selectedUnit ?? -1;
    this._mapDataSets = (node.mapdatasets || []).map(name => mod?.getMapDataSet?.(name) || new MapDataSet(name));
    if (node.tileTotalBytesPer) {
      const serializationKey = {
        index: node.tileIndexSize ?? Tile.serializationKey.index,
        totalBytes: node.tileTotalBytesPer,
        _fire: node.tileFireSize ?? Tile.serializationKey._fire,
        _smoke: node.tileSmokeSize ?? Tile.serializationKey._smoke,
        _mapDataID: node.tileIDSize ?? Tile.serializationKey._mapDataID,
        _mapDataSetID: node.tileSetIDSize ?? Tile.serializationKey._mapDataSetID,
        boolFields: node.tileBoolFieldsSize ?? 1
      };
      const cursor = { buffer: SavedBattleGame.bytesFromBinTiles(node.binTiles), offset: 0 };
      const totalTiles = node.totalTiles ?? Math.trunc(cursor.buffer.length / serializationKey.totalBytes);
      for (let i = 0; i < totalTiles; ++i) {
        const start = cursor.offset;
        const index = unserializeInt(cursor, serializationKey.index);
        if (index < 0 || index >= this.getMapSizeXYZ()) {
          throw new Error(`SavedBattleGame tile index ${index} out of range.`);
        }
        this._tiles[index].loadBinary(cursor, serializationKey);
        cursor.offset = start + serializationKey.totalBytes;
      }
    } else {
      for (const tileNode of node.tiles || []) {
        const pos = Position.from(tileNode.position);
        this.getTile(pos)?.load(tileNode);
      }
    }
    this._nodes = [];
    for (const nodeSave of node.nodes || []) {
      const battleNode = new Node();
      battleNode.load(nodeSave);
      this._nodes.push(battleNode);
    }
    if (this._missionType === "STR_BASE_DEFENSE") {
      if (node.moduleMap) {
        this._baseModules = node.moduleMap.map(row => row.map(pair => [pair[0] || 0, pair[1] || 0]));
      } else {
        this.calculateModuleMap();
      }
    }
    this.loadUnits(node.units || [], selectedUnit, mod, savedGame);
    this.loadItems(node.items || [], this._items, mod);
    this.loadItems(node.recoverConditional || [], this._recoverConditional, mod);
    this.loadItems(node.recoverGuaranteed || [], this._recoverGuaranteed, mod);
    this.linkAmmo(node.items || [], mod);
    this._objectiveType = node.objectiveType ?? this._objectiveType;
    this._objectivesDestroyed = node.objectivesDestroyed ?? this._objectivesDestroyed;
    this._objectivesNeeded = node.objectivesNeeded ?? this._objectivesNeeded;
    this._tuReserved = node.tuReserved ?? this._tuReserved;
    this._kneelReserved = node.kneelReserved ?? this._kneelReserved;
    this._ambience = node.ambience ?? this._ambience;
    this._ambientVolume = node.ambientVolume ?? this._ambientVolume;
    this._music = node.music ?? this._music;
    this._turnLimit = node.turnLimit ?? this._turnLimit;
    this._chronoTrigger = node.chronoTrigger ?? this._chronoTrigger;
    this._cheatTurn = node.cheatTurn ?? this._cheatTurn;
  }

  private loadUnits(unitNodes: BattleUnitSave[], selectedUnit: number, mod: ConvertUnitModLike | null, savedGame: ConvertUnitSavedGameLike | null): void {
    this._units = [];
    this._selectedUnit = null;
    this._lastSelectedUnit = null;
    for (const unitNode of unitNodes) {
      const faction = (unitNode.faction ?? UnitFaction.FACTION_PLAYER) as UnitFaction;
      const originalFaction = (unitNode.originalFaction ?? faction) as UnitFaction;
      const id = unitNode.id ?? 0;
      let unit: BattleUnit | null = null;
      if (id < BattleUnit.MAX_SOLDIER_ID) {
        const soldier = savedGame?.getSoldier?.(id) || null;
        if (!soldier) {
          continue;
        }
        unit = new BattleUnit(soldier, this._depth);
      } else {
        const type = unitNode.genUnitType || "";
        const armorName = unitNode.genUnitArmor || "";
        const rule = mod?.getUnit(type) || null;
        const armor = mod?.getArmor(armorName) || null;
        if (!rule || !armor) {
          continue;
        }
        const adjustment = mod?.getStatAdjustment?.(savedGame?.getDifficulty?.() ?? 0) || null;
        unit = new BattleUnit(rule, originalFaction, id, armor, adjustment, this._depth);
      }
      unit.load(unitNode);
      if (mod) {
        unit.setSpecialWeapon(this, mod);
      }
      this._units.push(unit);
      if (faction === UnitFaction.FACTION_PLAYER && (unit.getId() === selectedUnit || (!this._selectedUnit && !unit.isOut()))) {
        this._selectedUnit = unit;
      }
      if (unit.getStatus() !== UnitStatus.STATUS_DEAD && unit.getStatus() !== UnitStatus.STATUS_IGNORE_ME && unitNode.AI && faction !== UnitFaction.FACTION_PLAYER) {
        const aiModule = new AIModule(this, unit, null);
        aiModule.load(unitNode.AI);
        unit.setAIModule(aiModule);
      }
    }
    this.resetUnitTiles();
  }

  private loadItems(itemNodes: BattleItemSave[], target: BattleItem[], mod: ConvertUnitModLike | null): void {
    target.length = 0;
    if (!mod) {
      return;
    }
    for (const itemNode of itemNodes) {
      if (itemNode.owner !== undefined && !itemNode.inventoryslot) {
        continue;
      }
      const type = itemNode.type || "";
      const rule = mod.getItem(type);
      if (!rule) {
        continue;
      }
      const id = itemNode.id ?? this._itemId;
      this._itemId = Math.max(this._itemId, id);
      const item = new BattleItem(rule, id);
      item.load(itemNode, mod);
      const owner = this.unitById(itemNode.owner);
      if (owner) {
        item.moveToOwner(owner);
      }
      const previousOwner = this.unitById(itemNode.previousOwner);
      if (previousOwner) {
        item.setPreviousOwner(previousOwner);
      }
      const unit = this.unitById(itemNode.unit);
      if (unit) {
        item.setUnit(unit);
      }
      if (item.getSlot()?.getType() === InventoryType.INV_GROUND) {
        const pos = Position.from(itemNode.position || [-1, -1, -1]);
        if (pos.x !== -1) {
          const ground = mod.getInventory("STR_GROUND", true);
          if (ground) {
            this.getTile(pos)?.addItem(item, ground);
          }
        }
      }
      target.push(item);
    }
    this._itemId++;
  }

  private linkAmmo(itemNodes: BattleItemSave[], mod: ConvertUnitModLike | null): void {
    if (!mod) {
      return;
    }
    let weaponIndex = 0;
    for (const itemNode of itemNodes) {
      if (itemNode.owner !== undefined && !itemNode.inventoryslot) {
        continue;
      }
      if (!mod.getItem(itemNode.type || "")) {
        continue;
      }
      const weapon = this._items[weaponIndex++];
      const ammoId = itemNode.ammoItem ?? -1;
      if (!weapon || ammoId === -1) {
        continue;
      }
      const ammo = this._items.find(candidate => candidate.getId() === ammoId) || null;
      weapon.setAmmoItem(ammo);
    }
  }

  private unitById(id: number | undefined): BattleUnit | null {
    if (id === undefined || id === -1) {
      return null;
    }
    return this._units.find(unit => unit.getId() === id) || null;
  }

  save(): SavedBattleGameSave {
    const savedTiles = this._tiles
      .map((tile, index) => ({ tile, index }))
      .filter(entry => !entry.tile.isVoid());
    const tileData = new Uint8Array(savedTiles.length * Tile.serializationKey.totalBytes);
    const cursor = { buffer: tileData, offset: 0 };
    for (const entry of savedTiles) {
      serializeInt(cursor, Tile.serializationKey.index, entry.index);
      entry.tile.saveBinary(cursor);
    }
    const node: SavedBattleGameSave = {
      width: this._mapsize_x,
      length: this._mapsize_y,
      height: this._mapsize_z,
      missionType: this._missionType,
      globalshade: this._globalShade,
      turn: this._turn,
      selectedUnit: this._selectedUnit ? this._selectedUnit.getId() : -1,
      mapdatasets: this._mapDataSets.map(set => set.getName()),
      tileIndexSize: Tile.serializationKey.index,
      tileTotalBytesPer: Tile.serializationKey.totalBytes,
      tileFireSize: Tile.serializationKey._fire,
      tileSmokeSize: Tile.serializationKey._smoke,
      tileIDSize: Tile.serializationKey._mapDataID,
      tileSetIDSize: Tile.serializationKey._mapDataSetID,
      tileBoolFieldsSize: Tile.serializationKey.boolFields,
      totalTiles: savedTiles.length,
      binTiles: SavedBattleGame.bytesToBase64(tileData),
      tuReserved: this._tuReserved,
      kneelReserved: this._kneelReserved,
      depth: this._depth,
      ambience: this._ambience,
      ambientVolume: this._ambientVolume,
      music: this._music,
      turnLimit: this._turnLimit,
      chronoTrigger: this._chronoTrigger,
      cheatTurn: this._cheatTurn,
      units: this._units.map(unit => unit.save()),
      nodes: this._nodes.map(node => node.save()),
      items: this._items.map(item => item.save()),
      recoverGuaranteed: this._recoverGuaranteed.map(item => item.save()),
      recoverConditional: this._recoverConditional.map(item => item.save())
    };
    if (this._missionType === "STR_BASE_DEFENSE") {
      node.moduleMap = this._baseModules.map(row => row.map(pair => [pair[0], pair[1]]));
    }
    if (this._objectivesNeeded) {
      node.objectivesDestroyed = this._objectivesDestroyed;
      node.objectivesNeeded = this._objectivesNeeded;
      node.objectiveType = this._objectiveType;
    }
    return node;
  }

  initMap(mapsize_x: number, mapsize_y: number, mapsize_z: number, resetTerrain = true): void {
    this._nodes = [];
    this._pathfinding = null;
    this._tileEngine = null;
    if (resetTerrain) {
      this._mapDataSets = [];
    }
    this._mapsize_x = mapsize_x;
    this._mapsize_y = mapsize_y;
    this._mapsize_z = mapsize_z;
    this._tiles = [];
    for (let i = 0; i < this.getMapSizeXYZ(); ++i) {
      this._tiles.push(new Tile(this.getTileCoords(i)));
    }
  }

  initUtilities(mod?: unknown): void {
    const utilityMod = mod as BattleUtilityModLike | null | undefined;
    this._pathfinding = new Pathfinding(this);
    this._tileEngine = new TileEngine(this, utilityMod?.getVoxelData?.() || []);
  }

  getMapDataSets(): MapDataSet[] {
    return this._mapDataSets;
  }

  async loadMapResources(mod: { loadMapDataSet: (name: string) => Promise<MapDataSet> }): Promise<void> {
    for (let i = 0; i < this._mapDataSets.length; ++i) {
      this._mapDataSets[i] = await mod.loadMapDataSet(this._mapDataSets[i].getName());
    }
    for (const tile of this._tiles) {
      for (let part = TilePart.O_FLOOR; part <= TilePart.O_OBJECT; ++part) {
        const tilePart = part as TilePart;
        const mapDataID = { value: -1 };
        const mapDataSetID = { value: -1 };
        tile.getMapData(mapDataID, mapDataSetID, tilePart);
        if (mapDataID.value !== -1 && mapDataSetID.value !== -1) {
          const dataSet = this._mapDataSets[mapDataSetID.value];
          tile.setMapData(dataSet?.getObject(mapDataID.value) || null, mapDataID.value, mapDataSetID.value, tilePart);
        }
      }
    }
    this.initUtilities(mod);
    this.getTileEngine()?.calculateSunShading();
    this.getTileEngine()?.calculateTerrainLighting();
    this.getTileEngine()?.calculateUnitLighting();
    this.getTileEngine()?.recalculateFOV();
  }

  getTiles(): Tile[] {
    return this._tiles;
  }

  getNodes(): Node[] {
    return this._nodes;
  }

  setMissionType(missionType: string): void {
    this._missionType = missionType;
  }

  getMissionType(): string {
    return this._missionType;
  }

  setGlobalShade(shade: number): void {
    this._globalShade = shade;
  }

  getGlobalShade(): number {
    return this._globalShade;
  }

  getItems(): BattleItem[] {
    return this._items;
  }

  getUnits(): BattleUnit[] {
    return this._units;
  }

  getSpawnNode(nodeRank: number, unit: BattleUnit): Node | null {
    let highestPriority = -1;
    const compliantNodes: Node[] = [];

    for (const node of this.getNodes()) {
      if (node.isDummy()) {
        continue;
      }
      if (node.getRank() === nodeRank &&
        (!(node.getType() & Node.TYPE_SMALL) || unit.getArmor().getSize() === 1) &&
        (!(node.getType() & Node.TYPE_FLYING) || unit.getMovementType() === MovementType.MT_FLY) &&
        node.getPriority() > 0 &&
        this.setUnitPosition(unit, node.getPosition(), true)) {
        if (node.getPriority() > highestPriority) {
          highestPriority = node.getPriority();
          compliantNodes.length = 0;
        }
        if (node.getPriority() === highestPriority) {
          compliantNodes.push(node);
        }
      }
    }

    if (compliantNodes.length === 0) {
      return null;
    }
    return compliantNodes[RNG.generate(0, compliantNodes.length - 1)];
  }

  getPatrolNode(scout: boolean, unit: BattleUnit, fromNode: Node | null): Node | null {
    const compliantNodes: Node[] = [];
    let preferred: Node | null = null;

    if (!fromNode) {
      if (this.getNodes().length === 0) {
        return null;
      }
      fromNode = this.getNodes()[RNG.generate(0, this.getNodes().length - 1)];
      let guard = 0;
      while (fromNode.isDummy() && guard < this.getNodes().length * 2) {
        fromNode = this.getNodes()[RNG.generate(0, this.getNodes().length - 1)];
        guard++;
      }
      if (fromNode.isDummy()) {
        return null;
      }
    }

    const end = scout ? this.getNodes().length : fromNode.getNodeLinks().length;
    for (let i = 0; i < end; ++i) {
      if (!scout && fromNode.getNodeLinks()[i] < 1) {
        continue;
      }
      const nodeIndex: number = scout ? i : fromNode.getNodeLinks()[i];
      const node: Node | undefined = this.getNodes()[nodeIndex];
      if (!node) {
        continue;
      }
      const tile = this.getTile(node.getPosition());
      if (!node.isDummy() &&
        (node.getFlags() > 0 || node.getRank() > 0 || scout) &&
        (!(node.getType() & Node.TYPE_SMALL) || unit.getArmor().getSize() === 1) &&
        (!(node.getType() & Node.TYPE_FLYING) || unit.getMovementType() === MovementType.MT_FLY) &&
        !node.isAllocated() &&
        !(node.getType() & Node.TYPE_DANGEROUS) &&
        this.setUnitPosition(unit, node.getPosition(), true) &&
        tile && !tile.getFire() &&
        (unit.getFaction() !== UnitFaction.FACTION_HOSTILE || !tile.getDangerous()) &&
        (!scout || node !== fromNode) &&
        node.getPosition().x > 0 && node.getPosition().y > 0) {
        if (!preferred ||
          (unit.getRankInt() >= 0 &&
            preferred.getRank() === Node.nodeRank[unit.getRankInt()]?.[0] &&
            preferred.getFlags() < node.getFlags()) ||
          preferred.getFlags() < node.getFlags()) {
          preferred = node;
        }
        compliantNodes.push(node);
      }
    }

    if (compliantNodes.length === 0) {
      if (unit.getArmor().getSize() > 1 && !scout) {
        return this.getPatrolNode(true, unit, fromNode);
      }
      return null;
    }
    if (scout) {
      return compliantNodes[RNG.generate(0, compliantNodes.length - 1)];
    }
    return preferred || compliantNodes[RNG.generate(0, compliantNodes.length - 1)];
  }

  getMapSizeX(): number {
    return this._mapsize_x;
  }

  getMapSizeY(): number {
    return this._mapsize_y;
  }

  getMapSizeZ(): number {
    return this._mapsize_z;
  }

  getMapSizeXYZ(): number {
    return this._mapsize_x * this._mapsize_y * this._mapsize_z;
  }

  getTileIndex(pos: PositionLike): number {
    return pos.z * this._mapsize_y * this._mapsize_x + pos.y * this._mapsize_x + pos.x;
  }

  getTileCoords(index: number): Position {
    const z = Math.trunc(index / (this._mapsize_y * this._mapsize_x));
    const y = Math.trunc((index % (this._mapsize_y * this._mapsize_x)) / this._mapsize_x);
    const x = (index % (this._mapsize_y * this._mapsize_x)) % this._mapsize_x;
    return new Position(x, y, z);
  }

  getTile(pos: PositionLike): Tile | null {
    if (pos.x < 0 || pos.y < 0 || pos.z < 0 || pos.x >= this._mapsize_x || pos.y >= this._mapsize_y || pos.z >= this._mapsize_z) {
      return null;
    }
    return this._tiles[this.getTileIndex(pos)] || null;
  }

  getSelectedUnit(): BattleUnit | null {
    return this._selectedUnit;
  }

  setSelectedUnit(unit: BattleUnit | null): void {
    this._selectedUnit = unit;
  }

  selectPreviousPlayerUnit(checkReselect = false, setReselect = false, checkInventory = false): BattleUnit | null {
    return this.selectPlayerUnit(-1, checkReselect, setReselect, checkInventory);
  }

  selectNextPlayerUnit(checkReselect = false, setReselect = false, checkInventory = false): BattleUnit | null {
    return this.selectPlayerUnit(1, checkReselect, setReselect, checkInventory);
  }

  private selectPlayerUnit(dir: number, checkReselect = false, setReselect = false, checkInventory = false): BattleUnit | null {
    if (this._selectedUnit && setReselect) {
      this._selectedUnit.dontReselect();
    }
    if (this._units.length === 0) {
      return null;
    }
    let index = this._selectedUnit ? this._units.indexOf(this._selectedUnit) : -1;
    const start = index;
    do {
      index = index === -1 ? (dir > 0 ? 0 : this._units.length - 1) : (index + dir + this._units.length) % this._units.length;
      const unit = this._units[index];
      if (unit?.isSelectable(this._side, checkReselect, checkInventory)) {
        this._selectedUnit = unit;
        return unit;
      }
    } while (index !== start && !(start === -1 && ((dir > 0 && index === this._units.length - 1) || (dir < 0 && index === 0))));
    if (checkReselect && this._selectedUnit && !this._selectedUnit.reselectAllowed()) {
      this._selectedUnit = null;
    }
    return this._selectedUnit;
  }

  selectUnit(pos: PositionLike): BattleUnit | null {
    const bu = this.getTile(pos)?.getUnit() || null;
    return bu && !bu.isOut() ? bu : null;
  }

  getPathfinding(): Pathfinding | null {
    return this._pathfinding;
  }

  getBattleState(): BattlescapeState | null {
    return this._battleState;
  }

  getBattleGame(): BattlescapeGame | null {
    return this._battleState?.getBattleGame() || null;
  }

  setBattleState(bs: BattlescapeState | null): void {
    this._battleState = bs;
  }

  getTileEngine(): TileEngine | null {
    return this._tileEngine;
  }

  getSide(): UnitFaction {
    return this._side;
  }

  getTurn(): number {
    return this._turn;
  }

  resetTurnCounter(): void {
    this._turn = 1;
    this._cheating = false;
    this._side = UnitFaction.FACTION_PLAYER;
    this._beforeGame = true;
  }

  endTurn(): void {
    if (this._side === UnitFaction.FACTION_PLAYER) {
      if (this._selectedUnit && this._selectedUnit.getOriginalFaction() === UnitFaction.FACTION_PLAYER) {
        this._lastSelectedUnit = this._selectedUnit;
      }
      this._selectedUnit = null;
      this._side = UnitFaction.FACTION_HOSTILE;
    } else if (this._side === UnitFaction.FACTION_HOSTILE) {
      this._side = UnitFaction.FACTION_NEUTRAL;
      if (!this.selectNextPlayerUnit()) {
        this.prepareNewTurn();
        this._turn++;
        this._side = UnitFaction.FACTION_PLAYER;
        this.restorePlayerSelection();
      }
    } else if (this._side === UnitFaction.FACTION_NEUTRAL) {
      this.prepareNewTurn();
      this._turn++;
      this._side = UnitFaction.FACTION_PLAYER;
      this.restorePlayerSelection();
    }

    const liveAliens = { value: 0 };
    const liveSoldiers = { value: 0 };
    const battleGame = this.getBattleGame();
    if (battleGame) {
      battleGame.tallyUnits(liveAliens, liveSoldiers);
    } else {
      for (const unit of this._units) {
        if (unit.isOut()) {
          continue;
        }
        if (unit.getOriginalFaction() === UnitFaction.FACTION_HOSTILE) {
          liveAliens.value++;
        } else if (unit.getOriginalFaction() === UnitFaction.FACTION_PLAYER && unit.getFaction() === UnitFaction.FACTION_PLAYER) {
          liveSoldiers.value++;
        }
      }
    }

    if ((this._turn > this._cheatTurn / 2 && liveAliens.value <= 2) || this._turn > this._cheatTurn) {
      this._cheating = true;
    }

    if (this._side === UnitFaction.FACTION_PLAYER) {
      for (const unit of this._units) {
        if (unit.getTurnsSinceSpotted() < 255) {
          unit.setTurnsSinceSpotted(unit.getTurnsSinceSpotted() + 1);
        }
        if (this._cheating && unit.getFaction() === UnitFaction.FACTION_PLAYER && !unit.isOut()) {
          unit.setTurnsSinceSpotted(0);
        }
        unit.getAIModule()?.reset?.();
      }
    }

    for (const unit of this._units) {
      if (unit.getFaction() === this._side) {
        unit.prepareNewTurn();
      }
      if (unit.getFaction() !== UnitFaction.FACTION_PLAYER) {
        unit.setVisible(false);
      }
    }
    this._tileEngine?.recalculateFOV();
    if (this._side !== UnitFaction.FACTION_PLAYER) {
      this.selectNextPlayerUnit();
    }
  }

  private restorePlayerSelection(): void {
    if (this._lastSelectedUnit?.isSelectable(UnitFaction.FACTION_PLAYER, false, false)) {
      this._selectedUnit = this._lastSelectedUnit;
    } else {
      this.selectNextPlayerUnit();
    }
    while (this._selectedUnit && this._selectedUnit.getFaction() !== UnitFaction.FACTION_PLAYER) {
      this.selectNextPlayerUnit();
    }
  }

  setDebugMode(): void {
    for (const tile of this._tiles) {
      tile.setDiscovered(true, TilePart.O_NORTHWALL);
    }
    this._debugMode = true;
  }

  getDebugMode(): boolean {
    return this._debugMode;
  }

  resetUnitTiles(): void {
    for (const unit of this._units) {
      if (!unit.isOut()) {
        const size = unit.getArmor().getSize() - 1;
        const tile = unit.getTile();
        if (tile?.getUnit?.() === unit && tile.getPosition) {
          for (let x = size; x >= 0; --x) {
            for (let y = size; y >= 0; --y) {
              this.getTile(tile.getPosition().add(new Position(x, y, 0)))?.setUnit(null);
            }
          }
        }
        for (let x = size; x >= 0; --x) {
          for (let y = size; y >= 0; --y) {
            const target = this.getTile(unit.getPosition().add(new Position(x, y, 0)));
            if (target) {
              target.setUnit(unit, this.getTile(target.getPosition().add(new Position(0, 0, -1))));
            }
          }
        }
      }
      if (unit.getFaction() === UnitFaction.FACTION_PLAYER) {
        unit.setVisible(true);
      }
    }
    this._beforeGame = false;
  }

  removeItem(item: BattleItem): void {
    if (this._deleted.includes(item)) {
      return;
    }
    const tileInventory = item.getTile()?.getInventory?.();
    if (tileInventory) {
      const tileIndex = tileInventory.indexOf(item);
      if (tileIndex !== -1) {
        tileInventory.splice(tileIndex, 1);
      }
    }
    const ownerInventory = item.getOwner()?.getInventory();
    if (ownerInventory) {
      const ownerIndex = ownerInventory.indexOf(item);
      if (ownerIndex !== -1) {
        ownerInventory.splice(ownerIndex, 1);
      }
    }
    const itemIndex = this._items.indexOf(item);
    if (itemIndex !== -1) {
      this._items.splice(itemIndex, 1);
    }
    this._deleted.push(item);
  }

  removeUnconsciousBodyItem(bu: BattleUnit): void {
    for (const item of [...this._items]) {
      if (item.getUnit() === bu) {
        this.removeItem(item);
        break;
      }
    }
  }

  convertUnit(unit: BattleUnit, _saveGame: ConvertUnitSavedGameLike | null | undefined, mod: ConvertUnitModLike): BattleUnit {
    const newType = unit.getSpawnUnit();
    const visible = unit.getVisible();
    this.removeUnconsciousBodyItem(unit);

    unit.instaKill();
    const tile = this.getTile(unit.getPosition());
    for (const item of [...unit.getInventory()]) {
      this.getTileEngine()?.itemDrop(tile, item, mod);
      item.setOwner(null);
    }
    unit.getInventory().length = 0;

    unit.setTile(null);
    tile?.setUnit(null);

    const newRule = mod.getUnit(newType, true);
    if (!newRule) {
      throw new Error(`Unit ${newType} not found.`);
    }
    const newArmorType = newRule.getArmor();
    const newArmor = mod.getArmor(newArmorType, true);
    if (!newArmor) {
      throw new Error(`Armor ${newArmorType} not found.`);
    }
    const terroristWeapon = `${newRule.getRace().slice(4)}_WEAPON`;
    const newItem = mod.getItem(terroristWeapon) || null;
    const nextId = (this.getUnits()[this.getUnits().length - 1]?.getId() || unit.getId()) + 1;
    const newUnit = new BattleUnit(newRule, UnitFaction.FACTION_HOSTILE, nextId, newArmor, null, this.getDepth());

    tile?.setUnit(newUnit, this.getTile(unit.getPosition().add(new Position(0, 0, -1))));
    newUnit.setPosition(unit.getPosition());
    newUnit.setDirection(unit.getDirection());
    newUnit.setCache(0);
    newUnit.setTimeUnits(0);
    newUnit.setSpecialWeapon(this, mod);
    this.getUnits().push(newUnit);
    newUnit.setAIModule(new AIModule(this, newUnit, null));

    if (newItem) {
      const battleItem = new BattleItem(newItem, this.getCurrentItemId());
      battleItem.moveToOwner(newUnit);
      battleItem.setSlot(mod.getInventory("STR_RIGHT_HAND", true));
      this.getItems().push(battleItem);
    }

    newUnit.setVisible(visible);
    this.getTileEngine()?.calculateFOV(newUnit.getPosition());
    this.getTileEngine()?.applyGravity(newUnit.getTile() as Tile | null);
    newUnit.dontReselect();
    return newUnit;
  }

  setAborted(flag: boolean): void {
    this._aborted = flag;
  }

  isAborted(): boolean {
    return this._aborted;
  }

  setObjectiveCount(counter: number): void {
    this._objectivesNeeded = counter;
    this._objectivesDestroyed = 0;
  }

  addDestroyedObjective(): void {
    if (!this.allObjectivesDestroyed()) {
      this._objectivesDestroyed++;
      if (this.allObjectivesDestroyed()) {
        if (this.getObjectiveType() === SpecialTileType.MUST_DESTROY) {
          this._battleState?.getBattleGame().autoEndBattle();
        } else {
          this._battleState?.getBattleGame().missionComplete();
        }
      }
    }
  }

  allObjectivesDestroyed(): boolean {
    return this._objectivesNeeded > 0 && this._objectivesDestroyed === this._objectivesNeeded;
  }

  getCurrentItemId(): { value: number } {
    const self = this;
    return {
      get value() {
        return self._itemId;
      },
      set value(value: number) {
        self._itemId = value;
      }
    };
  }

  prepareNewTurn(): void {
    const tilesOnFire: Tile[] = [];
    const tilesOnSmoke: Tile[] = [];
    const tileEngine = this.getTileEngine();

    for (const tile of this._tiles) {
      if (tile.getFire() > 0) {
        tilesOnFire.push(tile);
      }
    }

    for (const tile of tilesOnFire) {
      if (tile.getOverlaps() === 0) {
        tile.setFire(tile.getFire() - 1);
        if (tile.getFire()) {
          for (let dir = 0; dir <= 6; dir += 2) {
            const target = this.getTile(tile.getPosition().add(Pathfinding.directionToVector(dir)));
            if (target && (tileEngine?.horizontalBlockage(tile, target, ItemDamageType.DT_IN) ?? 0) === 0) {
              target.ignite(tile.getSmoke());
            }
          }
        } else {
          tile.setSmoke(0);
          const object = tile.getMapData(TilePart.O_OBJECT);
          if (object) {
            if (object.getFlammable() !== 255 && object.getArmor() !== 255) {
              if (tile.destroy(TilePart.O_OBJECT, this.getObjectiveType())) {
                this.addDestroyedObjective();
              }
              if (tile.destroy(TilePart.O_FLOOR, this.getObjectiveType())) {
                this.addDestroyedObjective();
              }
            }
          } else {
            const floor = tile.getMapData(TilePart.O_FLOOR);
            if (floor && floor.getFlammable() !== 255 && floor.getArmor() !== 255) {
              if (tile.destroy(TilePart.O_FLOOR, this.getObjectiveType())) {
                this.addDestroyedObjective();
              }
            }
          }
          tileEngine?.applyGravity(tile);
        }
      }
    }

    for (const tile of this._tiles) {
      if (tile.getSmoke() > 0) {
        tilesOnSmoke.push(tile);
      }
      tile.setDangerous(false);
    }

    for (const tile of tilesOnSmoke) {
      if (tile.getFire() === 0) {
        tile.setSmoke(tile.getSmoke() - 1);
        if (tile.getSmoke()) {
          for (let dir = 0; dir <= 6; dir += 2) {
            const target = this.getTile(tile.getPosition().add(Pathfinding.directionToVector(dir)));
            if (target && (tileEngine?.horizontalBlockage(tile, target, ItemDamageType.DT_SMOKE) ?? 0) === 0) {
              if (target.getSmoke() === 0 || (target.getFire() === 0 && target.getOverlaps() !== 0)) {
                target.addSmoke(tile.getSmoke());
              }
            }
          }
        }
      } else {
        let target = this.getTile(tile.getPosition().add(new Position(0, 0, 1)));
        if (target && target.hasNoFloor(tile)) {
          target.addSmoke(Math.trunc(tile.getSmoke() / 2));
        }
        for (let dir = 0; dir <= 6; dir += 2) {
          const pos = Pathfinding.directionToVector(dir);
          target = this.getTile(tile.getPosition().add(pos));
          if (target && (tileEngine?.horizontalBlockage(tile, target, ItemDamageType.DT_SMOKE) ?? 0) === 0) {
            target.addSmoke(Math.trunc(tile.getSmoke() / 2));
          }
        }
      }
    }

    if (tilesOnFire.length > 0 || tilesOnSmoke.length > 0) {
      for (const tile of this._tiles) {
        if (tile.getSmoke() !== 0) {
          tile.prepareNewTurn(this.getDepth() === 0);
        }
      }
      tileEngine?.calculateTerrainLighting();
    }
    this.reviveUnconsciousUnits();
  }

  reviveUnconsciousUnits(): void {
    for (const unit of this.getUnits()) {
      if (unit.getArmor().getSize() !== 1) {
        continue;
      }

      let originalPosition = unit.getPosition();
      if (originalPosition.equals(new Position(-1, -1, -1))) {
        for (const item of this._items) {
          if (item.getUnit() && item.getUnit() === unit && item.getOwner()) {
            originalPosition = item.getOwner()!.getPosition();
          }
        }
      }

      if (unit.getStatus() === UnitStatus.STATUS_UNCONSCIOUS &&
        unit.getStunlevel() < unit.getHealth() &&
        unit.getHealth() > 0) {
        const targetTile = this.getTile(originalPosition);
        const targetUnit = targetTile?.getUnit() || null;
        const largeUnit = Boolean(targetTile && targetUnit && targetUnit !== unit && targetUnit.getArmor().getSize() !== 1);
        if (this.placeUnitNearPosition(unit, originalPosition, largeUnit)) {
          unit.turn(false);
          unit.kneel(false);
          unit.setCache(0);
          this.getTileEngine()?.calculateFOV(unit);
          this.getTileEngine()?.calculateUnitLighting();
          this.removeUnconsciousBodyItem(unit);
        }
      }
    }
  }

  setUnitPosition(bu: BattleUnit, position: PositionLike, testOnly = false): boolean {
    const base = Position.from(position);
    const size = bu.getArmor().getSize() - 1;
    const zOffset = new Position();
    for (let x = size; x >= 0; --x) {
      for (let y = size; y >= 0; --y) {
        const pos = base.add(new Position(x, y, 0)).add(zOffset);
        const t = this.getTile(pos);
        const tb = this.getTile(pos.add(new Position(0, 0, -1)));
        const object = t?.getMapData(TilePart.O_OBJECT);
        if (!t ||
          (t.getUnit() && t.getUnit() !== bu) ||
          t.getTUCost(TilePart.O_OBJECT, bu.getMovementType()) === 255 ||
          (t.hasNoFloor(tb) && bu.getMovementType() !== MovementType.MT_FLY) ||
          (object && object.getBigWall() && object.getBigWall() <= 3)) {
          return false;
        }
        if (t.getTerrainLevel() === -24) {
          zOffset.z += 1;
          x = size;
          y = size + 1;
        }
      }
    }
    if (size > 0) {
      const pathfinding = this.getPathfinding();
      pathfinding?.setUnit(bu);
      for (let dir = 2; dir <= 4; ++dir) {
        if (pathfinding?.isBlocked(this.getTile(base.add(zOffset)), null, dir, null)) {
          return false;
        }
      }
    }
    if (testOnly) {
      return true;
    }
    for (let x = size; x >= 0; --x) {
      for (let y = size; y >= 0; --y) {
        const pos = base.add(new Position(x, y, 0)).add(zOffset);
        if (x === 0 && y === 0) {
          bu.setPosition(base.add(zOffset));
        }
        this.getTile(pos)?.setUnit(bu, this.getTile(pos.add(new Position(0, 0, -1))));
      }
    }
    return true;
  }

  placeUnitNearPosition(unit: BattleUnit, entryPointLike: PositionLike, largeFriend: boolean): boolean {
    const entryPoint = Position.from(entryPointLike);
    if (this.setUnitPosition(unit, entryPoint)) {
      return true;
    }

    const me = 0 - unit.getArmor().getSize();
    const you = largeFriend ? 2 : 1;
    const xArray = [0, you, you, you, 0, me, me, me];
    const yArray = [me, me, 0, you, you, you, 0, me];
    const pathfinding = this.getPathfinding();
    for (let dir = 0; dir <= 7; ++dir) {
      const offset = new Position(xArray[dir], yArray[dir], 0);
      const tile = this.getTile(entryPoint.add(offset));
      if (tile &&
        !pathfinding?.isBlocked(this.getTile(entryPoint.add(offset.divide(2))), tile, dir, null) &&
        this.setUnitPosition(unit, entryPoint.add(offset))) {
        return true;
      }
    }

    if (unit.getMovementType() === MovementType.MT_FLY) {
      const above = entryPoint.add(new Position(0, 0, 1));
      const tile = this.getTile(above);
      if (tile && tile.hasNoFloor(this.getTile(entryPoint)) && this.setUnitPosition(unit, above)) {
        return true;
      }
    }
    return false;
  }

  addFallingUnit(unit: BattleUnit): boolean {
    if (!this._fallingUnits.includes(unit)) {
      this._fallingUnits.unshift(unit);
      this._unitsFalling = true;
      return true;
    }
    return false;
  }

  getFallingUnits(): BattleUnit[] {
    return this._fallingUnits;
  }

  setUnitsFalling(fall: boolean): void {
    this._unitsFalling = fall;
  }

  getUnitsFalling(): boolean {
    return this._unitsFalling;
  }

  resetTiles(): void {
    for (const tile of this._tiles) {
      tile.setDiscovered(false, 0);
      tile.setDiscovered(false, 1);
      tile.setDiscovered(false, 2);
    }
  }

  randomizeItemLocations(t: Tile): void {
    if (this._storageSpace.length === 0) {
      return;
    }
    const inventory = t.getInventory();
    for (let i = 0; i < inventory.length;) {
      const item = inventory[i];
      const slot = item.getSlot();
      if (slot?.getId() === "STR_GROUND") {
        const destination = this.getTile(this._storageSpace[RNG.generate(0, this._storageSpace.length - 1)]);
        if (destination) {
          destination.addItem(item, slot);
        }
        inventory.splice(i, 1);
      } else {
        ++i;
      }
    }
  }

  getTileSearch(): Position[] {
    return this._tileSearch;
  }

  isCheating(): boolean {
    return this._cheating;
  }

  getTUReserved(): BattleActionType {
    return this._tuReserved;
  }

  setTUReserved(reserved: BattleActionType): void {
    this._tuReserved = reserved;
  }

  getKneelReserved(): boolean {
    return this._kneelReserved;
  }

  setKneelReserved(reserved: boolean): void {
    this._kneelReserved = reserved;
  }

  checkReservedTU(bu: BattleUnit, tu: number, justChecking = false): boolean {
    let effectiveTuReserved = this._tuReserved;
    if (this._side !== bu.getFaction() || this._side === UnitFaction.FACTION_NEUTRAL) {
      return tu <= bu.getTimeUnits();
    }
    if (this._side === UnitFaction.FACTION_HOSTILE) {
      switch (effectiveTuReserved) {
        case BattleActionType.BA_SNAPSHOT:
          return tu + Math.trunc(bu.getBaseStats().tu / 3) <= bu.getTimeUnits();
        case BattleActionType.BA_AUTOSHOT:
          return tu + Math.trunc(bu.getBaseStats().tu / 5) * 2 <= bu.getTimeUnits();
        case BattleActionType.BA_AIMEDSHOT:
          return tu + Math.trunc(bu.getBaseStats().tu / 2) <= bu.getTimeUnits();
        default:
          return tu <= bu.getTimeUnits();
      }
    }

    const slowestWeapon = bu.getMainHandWeapon(false);
    if (bu.getActionTUs(effectiveTuReserved, slowestWeapon) === 0 && effectiveTuReserved === BattleActionType.BA_AUTOSHOT) {
      effectiveTuReserved = BattleActionType.BA_SNAPSHOT;
    }
    if (bu.getActionTUs(effectiveTuReserved, slowestWeapon) === 0 && effectiveTuReserved === BattleActionType.BA_SNAPSHOT) {
      effectiveTuReserved = BattleActionType.BA_AIMEDSHOT;
    }
    const tuKneel = (this._kneelReserved && !bu.isKneeled() && bu.getType() === "SOLDIER") ? 4 : 0;
    if (bu.getActionTUs(effectiveTuReserved, slowestWeapon) === 0 && effectiveTuReserved === BattleActionType.BA_AIMEDSHOT) {
      if (tuKneel > 0) {
        effectiveTuReserved = BattleActionType.BA_NONE;
      } else {
        return true;
      }
    }

    if ((effectiveTuReserved !== BattleActionType.BA_NONE || this._kneelReserved) &&
      tu + tuKneel + bu.getActionTUs(effectiveTuReserved, slowestWeapon) > bu.getTimeUnits() &&
      (tuKneel + bu.getActionTUs(effectiveTuReserved, slowestWeapon) <= bu.getTimeUnits() || justChecking)) {
      return false;
    }
    return true;
  }

  getMoraleModifier(unit: BattleUnit | null = null): number {
    let result = 100;
    const rank = unit
      ? (unit.getFaction() === UnitFaction.FACTION_PLAYER ? unit.getRankInt() : -1)
      : this.getUnits()
        .filter(candidate => candidate.getOriginalFaction() === UnitFaction.FACTION_PLAYER && !candidate.isOut())
        .reduce((highest, candidate) => Math.max(highest, candidate.getRankInt()), -1);
    if (!unit) {
      if (rank >= 5) result += 25;
      if (rank >= 4) result += 10;
      if (rank >= 3) result += 5;
      if (rank >= 2) result += 10;
    } else {
      if (rank >= 5) result += 25;
      if (rank >= 4) result += 20;
      if (rank >= 3) result += 10;
      if (rank >= 2) result += 20;
    }
    return result;
  }

  getStorageSpace(): Position[] {
    return this._storageSpace;
  }

  getModuleMap(): Array<Array<[number, number]>> {
    return this._baseModules;
  }

  calculateModuleMap(): void {
    this._baseModules = Array.from({ length: Math.trunc(this._mapsize_x / 10) }, () =>
      Array.from({ length: Math.trunc(this._mapsize_y / 10) }, (): [number, number] => [-1, -1])
    );

    for (let x = 0; x !== this._mapsize_x; ++x) {
      for (let y = 0; y !== this._mapsize_y; ++y) {
        for (let z = 0; z !== this._mapsize_z; ++z) {
          const tile = this.getTile(new Position(x, y, z));
          const object = tile?.getMapData(TilePart.O_OBJECT);
          if (object?.isBaseModule()) {
            const module = this._baseModules[Math.trunc(x / 10)][Math.trunc(y / 10)];
            module[0] += module[0] > 0 ? 1 : 2;
            module[1] = module[0];
          }
        }
      }
    }
  }

  getDepth(): number {
    return this._depth;
  }

  setDepth(depth: number): void {
    this._depth = depth;
  }

  setPaletteByDepth(state: State): void {
    if (this._depth === 0) {
      state.setPaletteByName("PAL_BATTLESCAPE");
    } else {
      state.setPaletteByName(`PAL_BATTLESCAPE_${this._depth}`);
    }
  }

  setAmbientSound(sound: number): void {
    this._ambience = sound;
  }

  getAmbientSound(): number {
    return this._ambience;
  }

  getGuaranteedRecoveredItems(): BattleItem[] {
    return this._recoverGuaranteed;
  }

  getConditionalRecoveredItems(): BattleItem[] {
    return this._recoverConditional;
  }

  getMusic(): string {
    return this._music;
  }

  setMusic(track: string): void {
    this._music = track;
  }

  setObjectiveType(type: number): void {
    this._objectiveType = type;
  }

  getObjectiveType(): SpecialTileType {
    return this._objectiveType;
  }

  setAmbientVolume(volume: number): void {
    this._ambientVolume = volume;
  }

  getAmbientVolume(): number {
    return this._ambientVolume;
  }

  getTurnLimit(): number {
    return this._turnLimit;
  }

  getChronoTrigger(): ChronoTrigger {
    return this._chronoTrigger;
  }

  setTurnLimit(limit: number): void {
    this._turnLimit = limit;
  }

  setChronoTrigger(trigger: ChronoTrigger): void {
    this._chronoTrigger = trigger;
  }

  setCheatTurn(turn: number): void {
    this._cheatTurn = turn;
  }

  isBeforeGame(): boolean {
    return this._beforeGame;
  }

  getItemUsable(item: BattleItem): string {
    if (this._depth === 0 && (item.getRules().isWaterOnly() || Boolean(item.getAmmoItem()?.getRules().isWaterOnly()))) {
      return "STR_UNDERWATER_EQUIPMENT";
    }
    if (this._depth !== 0 && (item.getRules().isLandOnly() || Boolean(item.getAmmoItem()?.getRules().isLandOnly()))) {
      return "STR_LAND_EQUIPMENT";
    }
    return "";
  }

  isItemUsable(item: BattleItem): boolean {
    return this.getItemUsable(item).length === 0;
  }

  resetUnitHitStates(): void {
    for (const unit of this._units) {
      unit.resetHitState();
    }
  }
}

registerSavedBattleGame(SavedBattleGame);
