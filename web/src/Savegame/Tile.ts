import { RNG } from "../Engine/RNG.ts";
import { MovementType } from "../Mod/Armor.ts";
import { MapData, SpecialTileType, TilePart } from "../Mod/MapData.ts";
import { ItemDamageType } from "../Mod/RuleItem.ts";
import type { RuleInventory } from "../Mod/RuleInventory.ts";
import { BattleActionType } from "../Battlescape/BattlescapeGame.ts";
import { Position } from "../Battlescape/Position.ts";
import { BattleItem } from "./BattleItem.ts";
import { BattleUnit } from "./BattleUnit.ts";

export type TileSave = {
  position?: [number, number, number] | number[];
  mapDataID?: number[];
  mapDataSetID?: number[];
  smoke?: number;
  fire?: number;
  discovered?: boolean[];
  openDoorWest?: boolean;
  openDoorNorth?: boolean;
};

const LIGHTLAYERS = 3;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export class Tile {
  static NOT_CALCULATED = -1;

  private _objects: Array<MapData | null> = [null, null, null, null];
  private _mapDataID = [-1, -1, -1, -1];
  private _mapDataSetID = [-1, -1, -1, -1];
  private _currentFrame = [0, 0, 0, 0];
  private _discovered = [false, false, false];
  private _light = Array.from({ length: LIGHTLAYERS }, () => 0);
  private _lastLight = Array.from({ length: LIGHTLAYERS }, () => -1);
  private _smoke = 0;
  private _fire = 0;
  private _explosive = 0;
  private _explosiveType = 0;
  private _unit: BattleUnit | null = null;
  private _inventory: BattleItem[] = [];
  private _animationOffset = 0;
  private _markerColor = 0;
  private _visible = 0;
  private _preview = -1;
  private _TUMarker = -1;
  private _overlaps = 0;
  private _danger = false;
  private _particles: Array<{ animate?: () => boolean }> = [];
  private _obstacle = 0;

  constructor(private _pos = new Position()) {}

  load(node: TileSave): void {
    for (let i = 0; i < 4; ++i) {
      this._mapDataID[i] = node.mapDataID?.[i] ?? this._mapDataID[i];
      this._mapDataSetID[i] = node.mapDataSetID?.[i] ?? this._mapDataSetID[i];
    }
    this._fire = node.fire ?? this._fire;
    this._smoke = node.smoke ?? this._smoke;
    if (node.discovered) {
      for (let i = 0; i < 3; ++i) {
        this._discovered[i] = node.discovered[i] ?? this._discovered[i];
      }
    }
    if (node.openDoorWest) {
      this._currentFrame[TilePart.O_WESTWALL] = 7;
    }
    if (node.openDoorNorth) {
      this._currentFrame[TilePart.O_NORTHWALL] = 7;
    }
    if (this._fire || this._smoke) {
      this._animationOffset = RNG.generate(0, 3);
    }
  }

  save(): TileSave {
    const node: TileSave = {
      position: this._pos.toArray(),
      mapDataID: [...this._mapDataID],
      mapDataSetID: [...this._mapDataSetID]
    };
    if (this._smoke) {
      node.smoke = this._smoke;
    }
    if (this._fire) {
      node.fire = this._fire;
    }
    if (this._discovered[TilePart.O_FLOOR] || this._discovered[TilePart.O_WESTWALL] || this._discovered[TilePart.O_NORTHWALL]) {
      node.discovered = [
        this._discovered[TilePart.O_FLOOR],
        this._discovered[TilePart.O_WESTWALL],
        this._discovered[TilePart.O_NORTHWALL]
      ];
    }
    if (this.isUfoDoorOpen(TilePart.O_WESTWALL)) {
      node.openDoorWest = true;
    }
    if (this.isUfoDoorOpen(TilePart.O_NORTHWALL)) {
      node.openDoorNorth = true;
    }
    return node;
  }

  getMapData(part: TilePart): MapData | null;
  getMapData(mapDataID: { value: number }, mapDataSetID: { value: number }, part: TilePart): void;
  getMapData(partOrId: TilePart | { value: number }, setId?: { value: number }, part?: TilePart): MapData | null | void {
    if (typeof partOrId === "number") {
      return this._objects[partOrId];
    }
    if (setId && part != null) {
      partOrId.value = this._mapDataID[part];
      setId.value = this._mapDataSetID[part];
    }
  }

  setMapData(dat: MapData | null, mapDataID: number, mapDataSetID: number, part: TilePart): void {
    this._objects[part] = dat;
    this._mapDataID[part] = mapDataID;
    this._mapDataSetID[part] = mapDataSetID;
  }

  isVoid(): boolean {
    return !this._objects[0] && !this._objects[1] && !this._objects[2] && !this._objects[3] && this._smoke === 0 && this._inventory.length === 0;
  }

  getTUCost(part: TilePart, movementType: MovementType): number {
    const object = this._objects[part];
    if (!object) {
      return 0;
    }
    if (object.isUFODoor() && this._currentFrame[part] > 1) {
      return 0;
    }
    if (part === TilePart.O_OBJECT && object.getBigWall() >= 4) {
      return 0;
    }
    return object.getTUCost(movementType);
  }

  hasNoFloor(tileBelow: Tile | null): boolean {
    if (tileBelow && tileBelow.getTerrainLevel() === -24) {
      return false;
    }
    const floor = this._objects[TilePart.O_FLOOR];
    return floor ? floor.isNoFloor() : true;
  }

  isBigWall(): boolean {
    const object = this._objects[TilePart.O_OBJECT];
    return object ? object.getBigWall() !== 0 : false;
  }

  getTerrainLevel(): number {
    let level = 0;
    const floor = this._objects[TilePart.O_FLOOR];
    const object = this._objects[TilePart.O_OBJECT];
    if (floor) {
      level = floor.getTerrainLevel();
    }
    if (object) {
      level = Math.min(object.getTerrainLevel(), level);
    }
    return level;
  }

  getPosition(): Position {
    return this._pos;
  }

  getFootstepSound(tileBelow: Tile | null): number {
    let sound = -1;
    const floor = this._objects[TilePart.O_FLOOR];
    const object = this._objects[TilePart.O_OBJECT];
    if (floor) {
      sound = floor.getFootstepSound();
    }
    if (object && object.getBigWall() <= 1 && object.getFootstepSound() > -1) {
      sound = object.getFootstepSound();
    }
    if (!floor && !object && tileBelow && tileBelow.getTerrainLevel() === -24) {
      sound = tileBelow.getMapData(TilePart.O_OBJECT)?.getFootstepSound() ?? sound;
    }
    return sound;
  }

  openDoor(part: TilePart, unit: BattleUnit | null = null, reserve = BattleActionType.BA_NONE): number {
    const object = this._objects[part];
    if (!object) {
      return -1;
    }
    if (object.isDoor()) {
      if (unit && unit.getArmor().getSize() > 1) {
        return -1;
      }
      if (unit && unit.getTimeUnits() < object.getTUCost(unit.getMovementType()) + unit.getActionTUs(reserve, unit.getMainHandWeapon(false))) {
        return 4;
      }
      if (this._unit && this._unit !== unit && !this._unit.getPosition().equals(this.getPosition())) {
        return -1;
      }
      const dead = object.getDataset()?.getObject?.(object.getAltMCD()) || null;
      if (dead) {
        this.setMapData(dead, object.getAltMCD(), this._mapDataSetID[part], dead.getObjectType());
      }
      this.setMapData(null, -1, -1, part);
      return 0;
    }
    if (object.isUFODoor() && this._currentFrame[part] === 0) {
      if (unit && unit.getTimeUnits() < object.getTUCost(unit.getMovementType()) + unit.getActionTUs(reserve, unit.getMainHandWeapon(false))) {
        return 4;
      }
      this._currentFrame[part] = 1;
      return 1;
    }
    if (object.isUFODoor() && this._currentFrame[part] !== 7) {
      return 3;
    }
    return -1;
  }

  isUfoDoorOpen(tp: TilePart): boolean {
    const object = this._objects[tp];
    return Boolean(object?.isUFODoor() && this._currentFrame[tp] !== 0);
  }

  closeUfoDoor(): number {
    let retval = 0;
    for (let part = TilePart.O_FLOOR; part <= TilePart.O_NORTHWALL; ++part) {
      if (this.isUfoDoorOpen(part)) {
        this._currentFrame[part] = 0;
        retval = 1;
      }
    }
    return retval;
  }

  setDiscovered(flag: boolean, part: number): void {
    if (this._discovered[part] !== flag) {
      this._discovered[part] = flag;
      if (part === 2 && flag) {
        this._discovered[0] = true;
        this._discovered[1] = true;
      }
      this._unit?.invalidateCache();
    }
  }

  isDiscovered(part: number): boolean {
    return this._discovered[part] || false;
  }

  resetLight(layer: number): void {
    this._light[layer] = 0;
    this._lastLight[layer] = this._light[layer];
  }

  addLight(light: number, layer: number): void {
    if (this._light[layer] < light) {
      this._light[layer] = light;
    }
  }

  getShade(): number {
    let light = 0;
    for (let layer = 0; layer < LIGHTLAYERS; ++layer) {
      if (this._light[layer] > light) {
        light = this._light[layer];
      }
    }
    return Math.max(0, 15 - light);
  }

  destroy(part: TilePart, type: SpecialTileType): boolean {
    let objective = false;
    const object = this._objects[part];
    if (object) {
      if (object.isGravLift()) {
        return false;
      }
      objective = object.getSpecialType() === type;
      const originalMapDataSetID = this._mapDataSetID[part];
      this.setMapData(null, -1, -1, part);
      if (object.getDieMCD()) {
        const dead = object.getDataset()?.getObject?.(object.getDieMCD()) || null;
        if (dead) {
          this.setMapData(dead, object.getDieMCD(), originalMapDataSetID, dead.getObjectType());
        }
      }
      if (object.getExplosive()) {
        this.setExplosive(object.getExplosive(), object.getExplosiveType());
      }
    }
    return objective;
  }

  damage(part: TilePart, power: number, type: SpecialTileType): boolean {
    const object = this._objects[part];
    return object ? (power >= object.getArmor() && this.destroy(part, type)) : false;
  }

  setExplosive(power: number, damageType: number, force = false): void {
    if (force || this._explosive < power) {
      this._explosive = power;
      this._explosiveType = damageType;
    }
  }

  getExplosive(): number {
    return this._explosive;
  }

  getExplosiveType(): number {
    return this._explosiveType;
  }

  getFlammability(): number;
  getFlammability(part: TilePart): number;
  getFlammability(part?: TilePart): number {
    if (part != null) {
      return this._objects[part]?.getFlammable() ?? 255;
    }
    let flam = 255;
    for (const object of this._objects) {
      if (object && object.getFlammable() < flam) {
        flam = object.getFlammable();
      }
    }
    return flam;
  }

  getFuel(): number;
  getFuel(part: TilePart): number;
  getFuel(part?: TilePart): number {
    if (part != null) {
      return this._objects[part]?.getFuel() ?? 0;
    }
    let fuel = 0;
    for (const object of this._objects) {
      if (object && object.getFuel() > fuel) {
        fuel = object.getFuel();
      }
    }
    return fuel;
  }

  ignite(power: number): void {
    if (this.getFlammability() !== 255) {
      let chance = power - Math.trunc(this.getFlammability() / 10) + 15;
      if (chance < 0) {
        chance = 0;
      }
      if (RNG.percent(chance) && this.getFuel()) {
        if (this._fire === 0) {
          this._smoke = 15 - clamp(Math.trunc(this.getFlammability() / 10), 1, 12);
          this._overlaps = 1;
          this._fire = this.getFuel() + 1;
          this._animationOffset = RNG.generate(0, 3);
        }
      }
    }
  }

  animate(): void {
    for (let i = 0; i < 4; ++i) {
      const object = this._objects[i];
      if (!object) {
        continue;
      }
      if (object.isUFODoor() && (this._currentFrame[i] === 0 || this._currentFrame[i] === 7)) {
        continue;
      }
      let newframe = this._currentFrame[i] + 1;
      if (object.isUFODoor() && object.getSpecialType() === SpecialTileType.START_POINT && newframe === 3) {
        newframe = 7;
      }
      if (newframe === 8) {
        newframe = 0;
      }
      this._currentFrame[i] = newframe;
    }
    this._particles = this._particles.filter(particle => particle.animate?.() ?? true);
  }

  setUnit(unit: BattleUnit | null): void {
    if (unit) {
      unit.setTile(this);
    }
    this._unit = unit;
  }

  getUnit(): BattleUnit | null {
    return this._unit;
  }

  setFire(fire: number): void {
    this._fire = fire;
    this._animationOffset = RNG.generate(0, 3);
  }

  getFire(): number {
    return this._fire;
  }

  addSmoke(smoke: number): void {
    if (this._fire === 0) {
      if (this._overlaps === 0) {
        this._smoke = clamp(this._smoke + smoke, 1, 15);
      } else {
        this._smoke += smoke;
      }
      this._animationOffset = RNG.generate(0, 3);
      this.addOverlap();
    }
  }

  setSmoke(smoke: number): void {
    this._smoke = smoke;
    this._animationOffset = RNG.generate(0, 3);
  }

  getSmoke(): number {
    return this._smoke;
  }

  getAnimationOffset(): number {
    return this._animationOffset;
  }

  addItem(item: BattleItem, ground: RuleInventory): void {
    item.setSlot(ground);
    this._inventory.push(item);
    item.setTile(this);
  }

  removeItem(item: BattleItem): void {
    const index = this._inventory.indexOf(item);
    if (index !== -1) {
      this._inventory.splice(index, 1);
    }
    item.setTile(null);
  }

  getTopItemSprite(): number {
    let biggestWeight = -1;
    let biggestItem = -1;
    for (const item of this._inventory) {
      if (item.getRules().getWeight() > biggestWeight) {
        biggestWeight = item.getRules().getWeight();
        biggestItem = item.getRules().getFloorSprite();
      }
    }
    return biggestItem;
  }

  prepareNewTurn(smokeDamage: boolean): void {
    if (this._overlaps !== 0 && this._smoke !== 0 && this._fire === 0) {
      this._smoke = clamp(Math.trunc(this._smoke / this._overlaps) - 1, 0, 15);
    }
    if (this._smoke && this._unit && !this._unit.isOut()) {
      if (this._fire) {
        if ((this._unit.getArmor().getSize() === 1 || !this._unit.tookFireDamage()) &&
          this._unit.getSpecialAbility() !== 2 && this._unit.getSpecialAbility() !== 3) {
          this._unit.toggleFireDamage();
          this._unit.damage(new Position(), this._smoke, ItemDamageType.DT_IN, true);
          if (RNG.percent(40 * this._unit.getArmor().getDamageModifier(ItemDamageType.DT_IN))) {
            const burnTime = RNG.generate(0, Math.trunc(5.0 * this._unit.getArmor().getDamageModifier(ItemDamageType.DT_IN)));
            if (this._unit.getFire() < burnTime) {
              this._unit.setFire(burnTime);
            }
          }
        }
      } else if (smokeDamage && this._unit.getArmor().getDamageModifier(ItemDamageType.DT_SMOKE) > 0.0 && this._unit.getArmor().getSize() === 1) {
        this._unit.damage(new Position(), Math.trunc(this._smoke / 4) + 1, ItemDamageType.DT_SMOKE, true);
      }
    }
    this._overlaps = 0;
  }

  getInventory(): BattleItem[] {
    return this._inventory;
  }

  setMarkerColor(color: number): void {
    this._markerColor = color;
  }

  getMarkerColor(): number {
    return this._markerColor;
  }

  setVisible(visibility: number): void {
    this._visible += visibility;
  }

  getVisible(): number {
    return this._visible;
  }

  setPreview(dir: number): void {
    this._preview = dir;
  }

  getPreview(): number {
    return this._preview;
  }

  setTUMarker(tu: number): void {
    this._TUMarker = tu;
  }

  getTUMarker(): number {
    return this._TUMarker;
  }

  getOverlaps(): number {
    return this._overlaps;
  }

  addOverlap(): void {
    ++this._overlaps;
  }

  setDangerous(danger: boolean): void {
    this._danger = danger;
  }

  getDangerous(): boolean {
    return this._danger;
  }

  addParticle(particle: { animate?: () => boolean }): void {
    this._particles.push(particle);
  }

  getParticleCloud(): Array<{ animate?: () => boolean }> {
    return this._particles;
  }

  setObstacle(part: number): void {
    this._obstacle |= (1 << part);
  }

  getObstacle(part: number): boolean {
    return (this._obstacle & (1 << part)) !== 0;
  }

  isObstacle(): boolean {
    return this._obstacle !== 0;
  }

  resetObstacle(): void {
    this._obstacle = 0;
  }
}
