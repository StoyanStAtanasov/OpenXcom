import { MovementType } from "./Armor.ts";
import { ItemDamageType } from "./RuleItem.ts";
import type { SurfaceSet } from "../Engine/SurfaceSet.ts";

export enum SpecialTileType {
  TILE = 0,
  START_POINT,
  UFO_POWER_SOURCE,
  UFO_NAVIGATION,
  UFO_CONSTRUCTION,
  ALIEN_FOOD,
  ALIEN_REPRODUCTION,
  ALIEN_ENTERTAINMENT,
  ALIEN_SURGERY,
  EXAM_ROOM,
  ALIEN_ALLOYS,
  ALIEN_HABITAT,
  DEAD_TILE,
  END_POINT,
  MUST_DESTROY
}

export enum VoxelType {
  V_EMPTY = -1,
  V_FLOOR,
  V_WESTWALL,
  V_NORTHWALL,
  V_OBJECT,
  V_UNIT,
  V_OUTOFBOUNDS
}

export enum TilePart {
  O_FLOOR = 0,
  O_WESTWALL,
  O_NORTHWALL,
  O_OBJECT
}

export type MapDataSetLike = {
  getObject?: (id: number) => MapData | null;
  getSurfaceset?: () => SurfaceSet | null;
};

export class MapData {
  static O_DUMMY = 999;

  private _specialType = SpecialTileType.TILE;
  private _isUfoDoor = false;
  private _stopLOS = false;
  private _isNoFloor = false;
  private _isGravLift = false;
  private _isDoor = false;
  private _blockFire = false;
  private _blockSmoke = false;
  private _baseModule = false;
  private _yOffset = 0;
  private _TUWalk = 0;
  private _TUFly = 0;
  private _TUSlide = 0;
  private _terrainLevel = 0;
  private _footstepSound = 0;
  private _dieMCD = 0;
  private _altMCD = 0;
  private _objectType = TilePart.O_FLOOR;
  private _lightSource = 0;
  private _armor = 0;
  private _flammable = 0;
  private _fuel = 0;
  private _explosive = 0;
  private _explosiveType = 0;
  private _bigWall = 0;
  private _sprite = Array.from({ length: 8 }, () => 0);
  private _block = Array.from({ length: 6 }, () => 0);
  private _loftID = Array.from({ length: 12 }, () => 0);
  private _miniMapIndex = 0;

  constructor(private _dataset: MapDataSetLike | null = null) {}

  getDataset(): MapDataSetLike | null {
    return this._dataset;
  }

  getSprite(frameID: number): number {
    return this._sprite[frameID] || 0;
  }

  setSprite(frameID: number, value: number): void {
    this._sprite[frameID] = value;
  }

  isUFODoor(): boolean {
    return this._isUfoDoor;
  }

  isNoFloor(): boolean {
    return this._isNoFloor;
  }

  getBigWall(): number {
    return this._bigWall;
  }

  isDoor(): boolean {
    return this._isDoor;
  }

  isGravLift(): boolean {
    return this._isGravLift;
  }

  setFlags(isUfoDoor: boolean, stopLOS: boolean, isNoFloor: boolean, bigWall: number, isGravLift: boolean, isDoor: boolean, blockFire: boolean, blockSmoke: boolean, baseModule: boolean): void {
    this._isUfoDoor = isUfoDoor;
    this._stopLOS = stopLOS;
    this._isNoFloor = isNoFloor;
    this._bigWall = bigWall;
    this._isGravLift = isGravLift;
    this._isDoor = isDoor;
    this._blockFire = blockFire;
    this._blockSmoke = blockSmoke;
    this._baseModule = baseModule;
  }

  getBlock(type: ItemDamageType): number {
    switch (type) {
      case ItemDamageType.DT_NONE:
        return this._block[1];
      case ItemDamageType.DT_SMOKE:
        return this._block[3];
      case ItemDamageType.DT_HE:
      case ItemDamageType.DT_IN:
      case ItemDamageType.DT_STUN:
        return this._block[2];
      default:
        return 0;
    }
  }

  setBlockValue(lightBlock: number, visionBlock: number, HEBlock: number, smokeBlock: number, fireBlock: number, gasBlock: number): void {
    this._block[0] = lightBlock;
    this._block[1] = visionBlock === 1 ? 255 : 0;
    this._block[2] = HEBlock;
    this._block[3] = smokeBlock === 1 ? 256 : 0;
    this._block[4] = fireBlock;
    this._block[5] = gasBlock;
  }

  setHEBlock(HEBlock: number): void {
    this._block[2] = HEBlock;
  }

  getYOffset(): number {
    return this._yOffset;
  }

  setYOffset(value: number): void {
    this._yOffset = value;
  }

  setObjectType(type: TilePart): void {
    this._objectType = type;
  }

  getObjectType(): TilePart {
    return this._objectType;
  }

  getSpecialType(): SpecialTileType {
    return this._specialType;
  }

  setSpecialType(value: number, otype: TilePart): void {
    this._specialType = value;
    this._objectType = otype;
  }

  getTUCost(movementType: MovementType): number {
    switch (movementType) {
      case MovementType.MT_WALK:
        return this._TUWalk;
      case MovementType.MT_FLY:
        return this._TUFly;
      case MovementType.MT_SLIDE:
        return this._TUSlide;
      default:
        return 0;
    }
  }

  setTUCosts(walk: number, fly: number, slide: number): void {
    this._TUWalk = walk;
    this._TUFly = fly;
    this._TUSlide = slide;
  }

  getTerrainLevel(): number {
    return this._terrainLevel;
  }

  setTerrainLevel(value: number): void {
    this._terrainLevel = value;
  }

  getFootstepSound(): number {
    return this._footstepSound;
  }

  setFootstepSound(value: number): void {
    this._footstepSound = value;
  }

  getAltMCD(): number {
    return this._altMCD;
  }

  setAltMCD(value: number): void {
    this._altMCD = value;
  }

  getDieMCD(): number {
    return this._dieMCD;
  }

  setDieMCD(value: number): void {
    this._dieMCD = value;
  }

  getLightSource(): number {
    return this._lightSource === 1 ? 15 : this._lightSource - 1;
  }

  setLightSource(value: number): void {
    this._lightSource = value;
  }

  getArmor(): number {
    return this._armor;
  }

  setArmor(value: number): void {
    this._armor = value;
  }

  getFlammable(): number {
    return this._flammable;
  }

  setFlammable(value: number): void {
    this._flammable = value;
  }

  getFuel(): number {
    return this._fuel;
  }

  setFuel(value: number): void {
    this._fuel = value;
  }

  getLoftID(layer: number): number {
    return this._loftID[layer] || 0;
  }

  setLoftID(loft: number, layer: number): void {
    this._loftID[layer] = loft;
  }

  getExplosive(): number {
    return this._explosive;
  }

  setExplosive(value: number): void {
    this._explosive = value;
  }

  getExplosiveType(): number {
    return this._explosiveType;
  }

  setExplosiveType(value: number): void {
    this._explosiveType = value;
  }

  setMiniMapIndex(i: number): void {
    this._miniMapIndex = i;
  }

  getMiniMapIndex(): number {
    return this._miniMapIndex;
  }

  setBigWall(bigWall: number): void {
    this._bigWall = bigWall;
  }

  setTUWalk(TUWalk: number): void {
    this._TUWalk = TUWalk;
  }

  setTUFly(TUFly: number): void {
    this._TUFly = TUFly;
  }

  setTUSlide(TUSlide: number): void {
    this._TUSlide = TUSlide;
  }

  isBaseModule(): boolean {
    return this._baseModule;
  }

  setNoFloor(isNoFloor: boolean): void {
    this._isNoFloor = isNoFloor;
  }

  setStopLOS(stopLOS: boolean): void {
    this._stopLOS = stopLOS;
    this._block[1] = stopLOS ? 255 : 0;
  }
}
