import type { RuleCraft } from "../Mod/RuleCraft.ts";
import type { RuleCraftWeapon } from "../Mod/RuleCraftWeapon.ts";
import type { StartingCraftDefinition } from "../Mod/RuleBaseFacility.ts";
import type { Language } from "../Engine/Language.ts";
import { RNG } from "../Engine/RNG.ts";
import type { Base } from "./Base.ts";
import type { Mod } from "../Mod/Mod.ts";
import type { RuleItem } from "../Mod/RuleItem.ts";
import { CraftWeapon } from "./CraftWeapon.ts";
import { ItemContainer } from "./ItemContainer.ts";
import { Ufo } from "./Ufo.ts";
import { MovingTarget, type MovingTargetSaveNode } from "./MovingTarget.ts";
import { nautical, type TargetLike } from "./Target.ts";
import { Vehicle, type VehicleSave } from "./Vehicle.ts";

export type CraftSaveNode = StartingCraftDefinition & MovingTargetSaveNode & {
  lowFuel?: boolean;
  mission?: boolean;
  interceptionOrder?: number;
  takeoff?: number;
  inBattlescape?: boolean;
  inDogfight?: boolean;
  speed?: number;
  vehicles?: VehicleSave[];
};

export class Craft extends MovingTarget {
  private _base: Base | null = null;
  private _fuel = 0;
  private _damage = 0;
  private _interceptionOrder = 0;
  private _takeoff = 0;
  private _status = "STR_READY";
  private _items = new ItemContainer();
  private _weapons: Array<CraftWeapon | null> = [];
  private _vehicles: Vehicle[] = [];
  private _lowFuel = false;
  private _mission = false;
  private _inBattlescape = false;
  private _inDogfight = false;
  private _speedMaxRadian = 0.0;

  constructor(private _rules: RuleCraft, base: Base | null = null, id = 0) {
    super();
    this._id = id;
    for (let i = 0; i < this._rules.getWeapons(); ++i) {
      this._weapons.push(null);
    }
    if (base) {
      this.setBase(base);
    }
    this._speedMaxRadian = MovingTarget.calculateRadianSpeed(this._rules.getMaxSpeed()) * 120;
  }

  load(
    node: StartingCraftDefinition,
    weaponResolver: (type: string) => RuleCraftWeapon | null = () => null,
    itemResolver: (type: string) => RuleItem | null = () => null
  ): void {
    const saved = node as CraftSaveNode;
    super.load(saved);
    this._id = saved.id ?? this._id;
    this.setFuel(saved.fuel ?? this._fuel);
    this.setDamage(saved.damage ?? this._damage);
    this._status = saved.status ?? this._status;
    this._lowFuel = saved.lowFuel ?? this._lowFuel;
    this._mission = saved.mission ?? this._mission;
    this._interceptionOrder = saved.interceptionOrder ?? this._interceptionOrder;
    this._takeoff = saved.takeoff ?? this._takeoff;
    this._inBattlescape = saved.inBattlescape ?? this._inBattlescape;
    this._inDogfight = saved.inDogfight ?? this._inDogfight;
    if (saved.speed != null) {
      this.setSpeed(saved.speed);
    }
    this._items.load(node.items);
    this._weapons = [];
    const weapons = node.weapons || [];
    for (let i = 0; i < this._rules.getWeapons(); ++i) {
      const definition = weapons[i];
      if (!definition) {
        this._weapons.push(null);
        continue;
      }
      const rule = weaponResolver(definition.type);
      if (!rule) {
        this._weapons.push(null);
        continue;
      }
      const weapon = new CraftWeapon(rule);
      weapon.load(definition);
      this._weapons.push(weapon);
    }
    this._vehicles = [];
    for (const definition of saved.vehicles || []) {
      const type = definition.type || "";
      const rule = itemResolver(type);
      if (!rule) {
        continue;
      }
      const vehicle = new Vehicle(rule, 0, 4);
      vehicle.load(definition);
      this._vehicles.push(vehicle);
    }
  }

  save(): CraftSaveNode {
    const node = {
      ...super.save(),
      type: this._rules.getType(),
      id: this._id,
      fuel: this._fuel,
      damage: this._damage,
      weapons: this._weapons.map(weapon => {
        if (!weapon) {
          return { type: "0" };
        }
        return {
          type: weapon.getRules().getType(),
          ...weapon.save()
        };
      }),
      items: this._items.save(),
      vehicles: this._vehicles.map(vehicle => vehicle.save()),
      status: this._status
    } as CraftSaveNode;
    if (this._lowFuel) {
      node.lowFuel = true;
    }
    if (this._mission) {
      node.mission = true;
    }
    if (this._interceptionOrder) {
      node.interceptionOrder = this._interceptionOrder;
    }
    if (this._takeoff) {
      node.takeoff = this._takeoff;
    }
    if (this._inBattlescape) {
      node.inBattlescape = true;
    }
    if (this._inDogfight) {
      node.inDogfight = true;
    }
    return node;
  }

  override getMarker(): number {
    if (this._status !== "STR_OUT") {
      return -1;
    }
    return this._rules.getMarker() === -1 ? 1 : this._rules.getMarker();
  }

  getType(): string {
    return this._rules.getType();
  }

  override getDefaultName(lang: Language): string {
    return String(lang.getString("STR_CRAFTNAME").arg(lang.getString(this.getType())).arg(this._id));
  }

  getName(lang: Language): string {
    if (this._name.length === 0) {
      return this.getDefaultName(lang);
    }
    return this._name;
  }

  setName(name: string): void {
    this._name = name;
  }

  getRules(): RuleCraft {
    return this._rules;
  }

  changeRules(rules: RuleCraft): void {
    this._rules = rules;
    this._weapons = [];
    for (let i = 0; i < this._rules.getWeapons(); ++i) {
      this._weapons.push(null);
    }
    this._speedMaxRadian = MovingTarget.calculateRadianSpeed(this._rules.getMaxSpeed()) * 120;
  }

  getId(): number {
    return this._id;
  }

  getBase(): Base | null {
    return this._base;
  }

  setBase(base: Base, move = true): void {
    this._base = base;
    if (move) {
      this.setLongitude(base.getLongitude());
      this.setLatitude(base.getLatitude());
    }
  }

  getStatus(): string {
    return this._status;
  }

  setStatus(status: string): void {
    this._status = status;
  }

  getAltitude(): string {
    const ufo = this._dest instanceof Ufo ? this._dest : null;
    if (ufo && ufo.getAltitude() !== "STR_GROUND") {
      return ufo.getAltitude();
    }
    return "STR_VERY_LOW";
  }

  override setDestination(dest: TargetLike | null): void {
    if (this._status !== "STR_OUT") {
      this._takeoff = 60;
    }
    if (dest === null) {
      this.setSpeed(Math.floor(this._rules.getMaxSpeed() / 2));
    } else {
      this.setSpeed(this._rules.getMaxSpeed());
    }
    super.setDestination(dest);
  }

  getWeapons(): Array<CraftWeapon | null> {
    return this._weapons;
  }

  getItems(): ItemContainer {
    return this._items;
  }

  getFuel(): number {
    return this._fuel;
  }

  setFuel(fuel: number): void {
    this._fuel = fuel;
    if (this._fuel > this._rules.getMaxFuel()) {
      this._fuel = this._rules.getMaxFuel();
    } else if (this._fuel < 0) {
      this._fuel = 0;
    }
  }

  getFuelPercentage(): number {
    const maxFuel = this._rules.getMaxFuel();
    return maxFuel > 0 ? Math.floor((this._fuel / maxFuel) * 100.0) : 0;
  }

  getDamage(): number {
    return this._damage;
  }

  setDamage(damage: number): void {
    this._damage = damage;
    if (this._damage < 0) {
      this._damage = 0;
    }
  }

  getDamagePercentage(): number {
    const maxDamage = this._rules.getMaxDamage();
    return maxDamage > 0 ? Math.floor((this._damage / maxDamage) * 100.0) : 0;
  }

  getLowFuel(): boolean {
    return this._lowFuel;
  }

  setLowFuel(low: boolean): void {
    this._lowFuel = low;
  }

  getMissionComplete(): boolean {
    return this._mission;
  }

  setMissionComplete(mission: boolean): void {
    this._mission = mission;
  }

  getDistanceFromBase(): number {
    if (!this._base) {
      return 0.0;
    }
    return this.getDistance(this._base);
  }

  getFuelConsumption(speed = this._speed): number {
    if (this._rules.getRefuelItem().length !== 0) {
      return 1;
    }
    return Math.floor(speed / 100.0);
  }

  getFuelLimit(base: Base | null = this._base): number {
    if (!base || this._speedMaxRadian === 0) {
      return 0;
    }
    return Math.floor(this.getFuelConsumption(this._rules.getMaxSpeed()) * this.getDistance(base) / this._speedMaxRadian);
  }

  getBaseRange(): number {
    const consumption = this.getFuelConsumption(this._rules.getMaxSpeed());
    if (consumption === 0) {
      return 0.0;
    }
    return this._fuel / 2.0 / consumption * this._speedMaxRadian;
  }

  returnToBase(): void {
    this.setDestination(this._base);
  }

  detect(target: TargetLike): boolean {
    if (this._rules.getRadarRange() === 0 || !this.insideRadarRange(target)) {
      return false;
    }
    if (this._rules.getRadarChance() === 100) {
      return true;
    }
    let chance = this._rules.getRadarChance();
    if (target instanceof Ufo) {
      chance = Math.trunc(chance * (100 + target.getVisibility()) / 100);
    }
    return RNG.percent(chance);
  }

  insideRadarRange(target: TargetLike): boolean {
    const range = nautical(this._rules.getRadarRange());
    return this.getDistance(target) <= range;
  }

  consumeFuel(): void {
    this.setFuel(this._fuel - this.getFuelConsumption());
  }

  repair(): void {
    this.setDamage(this._damage - this._rules.getRepairRate());
    if (this._damage <= 0) {
      this._status = "STR_REARMING";
    }
  }

  refuel(): string {
    let fuel = "";
    if (this._fuel < this._rules.getMaxFuel()) {
      const item = this._rules.getRefuelItem();
      if (item.length === 0) {
        this.setFuel(this._fuel + this._rules.getRefuelRate());
      } else if ((this._base?.getStorageItems().getItem(item) || 0) > 0) {
        this._base?.getStorageItems().removeItem(item);
        this.setFuel(this._fuel + this._rules.getRefuelRate());
        this._lowFuel = false;
      } else if (!this._lowFuel) {
        fuel = item;
        if (this._fuel > 0) {
          this._status = "STR_READY";
        } else {
          this._lowFuel = true;
        }
      }
    }
    if (this._fuel >= this._rules.getMaxFuel()) {
      this._status = "STR_READY";
      for (const weapon of this._weapons) {
        if (weapon && weapon.isRearming()) {
          this._status = "STR_REARMING";
          break;
        }
      }
    }
    return fuel;
  }

  rearm(mod: Mod | null): string {
    let ammo = "";
    for (let i = 0; ; ++i) {
      if (i >= this._weapons.length) {
        this._status = "STR_REFUELLING";
        break;
      }
      const weapon = this._weapons[i];
      if (weapon && weapon.isRearming()) {
        const clip = weapon.getRules().getClipItem();
        const available = this._base?.getStorageItems().getItem(clip) || 0;
        if (clip.length === 0) {
          weapon.rearm(0, 0);
        } else if (available > 0) {
          const used = weapon.rearm(available, mod?.getItem(clip, true)?.getClipSize() || 0);
          if (used === available && weapon.isRearming()) {
            ammo = clip;
            weapon.setRearming(false);
          }
          this._base?.getStorageItems().removeItem(clip, used);
        } else {
          ammo = clip;
          weapon.setRearming(false);
        }
        break;
      }
    }
    return ammo;
  }

  reuseItem(item: string): void {
    if (this._status !== "STR_READY") {
      return;
    }
    for (const weapon of this._weapons) {
      if (weapon !== null && item === weapon.getRules().getClipItem() && weapon.getAmmo() < weapon.getRules().getAmmoMax()) {
        weapon.setRearming(true);
        this._status = "STR_REARMING";
      }
    }
    if (item === this._rules.getRefuelItem() && this._fuel < this._rules.getMaxFuel()) {
      this._status = "STR_REFUELLING";
    }
  }

  think(): void {
    if (this._takeoff === 0) {
      this.move();
    } else {
      --this._takeoff;
      this.resetMeetPoint();
    }
    if (this.reachedDestination() && this._dest === this._base) {
      this.setInterceptionOrder(0);
      this.checkup();
      super.setDestination(null);
      this.setSpeed(0);
      this._lowFuel = false;
      this._mission = false;
      this._takeoff = 0;
    }
  }

  checkup(): void {
    let available = 0;
    let full = 0;
    for (const weapon of this._weapons) {
      if (weapon === null) {
        continue;
      }
      ++available;
      if (weapon.getAmmo() >= weapon.getRules().getAmmoMax()) {
        ++full;
      } else {
        weapon.setRearming(true);
      }
    }
    if (this._damage > 0) {
      this._status = "STR_REPAIRS";
    } else if (available !== full) {
      this._status = "STR_REARMING";
    } else {
      this._status = "STR_REFUELLING";
    }
  }

  setInBattlescape(inbattle: boolean): void {
    if (inbattle) {
      this.setSpeed(0);
    }
    this._inBattlescape = inbattle;
  }

  isInBattlescape(): boolean {
    return this._inBattlescape;
  }

  isDestroyed(): boolean {
    return this._damage >= this._rules.getMaxDamage();
  }

  getNumWeapons(): number {
    if (this._rules.getWeapons() === 0) {
      return 0;
    }
    let total = 0;
    for (const weapon of this._weapons) {
      if (weapon !== null) {
        ++total;
      }
    }
    return total;
  }

  getNumSoldiers(): number {
    if (this._rules.getSoldiers() === 0) {
      return 0;
    }
    return this._base?.getSoldiers().filter(soldier => soldier.getCraft() === this).length || 0;
  }

  getNumEquipment(): number {
    return this._items.getTotalQuantity();
  }

  getNumVehicles(): number {
    return this._vehicles.length;
  }

  getVehicles(): Vehicle[] {
    return this._vehicles;
  }

  getSpaceAvailable(): number {
    return this._rules.getSoldiers() - this.getSpaceUsed();
  }

  getSpaceUsed(): number {
    let vehicleSpaceUsed = 0;
    for (const vehicle of this._vehicles) {
      vehicleSpaceUsed += vehicle.getSize();
    }
    return this.getNumSoldiers() + vehicleSpaceUsed;
  }

  getVehicleCount(vehicle: string): number {
    let total = 0;
    for (const stored of this._vehicles) {
      if (stored.getRules().getType() === vehicle) {
        ++total;
      }
    }
    return total;
  }

  setInDogfight(inDogfight: boolean): void {
    this._inDogfight = inDogfight;
  }

  isInDogfight(): boolean {
    return this._inDogfight;
  }

  setInterceptionOrder(order: number): void {
    this._interceptionOrder = order;
  }

  getInterceptionOrder(): number {
    return this._interceptionOrder;
  }

  getUniqueId(): [string, number] {
    return [this._rules.getType(), this._id];
  }

  unload(mod: Mod | null): void {
    if (!this._base) {
      return;
    }
    for (let i = 0; i < this._weapons.length; ++i) {
      const weapon = this._weapons[i];
      if (weapon) {
        this._base.getStorageItems().addItem(weapon.getRules().getLauncherItem());
        this._base.getStorageItems().addItem(weapon.getRules().getClipItem(), weapon.getClipsLoaded(mod));
        this._weapons[i] = null;
      }
    }
    for (const [id, qty] of this._items.getContents()) {
      this._base.getStorageItems().addItem(id, qty);
    }
    for (const vehicle of this._vehicles) {
      this._base.getStorageItems().addItem(vehicle.getRules().getType());
      const compatibleAmmo = vehicle.getRules().getCompatibleAmmo();
      if (compatibleAmmo.length > 0) {
        this._base.getStorageItems().addItem(compatibleAmmo[0], vehicle.getAmmo());
      }
    }
    this._vehicles = [];
    for (const soldier of this._base.getSoldiers()) {
      if (soldier.getCraft() === this) {
        soldier.setCraft(null);
      }
    }
  }
}
