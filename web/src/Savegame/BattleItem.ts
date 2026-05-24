import { BattleType, type RuleItem } from "../Mod/RuleItem.ts";
import { InventoryType, type RuleInventory } from "../Mod/RuleInventory.ts";
import { Position } from "../Battlescape/Position.ts";
import type { BattleUnit } from "./BattleUnit.ts";

export type BattleItemSave = {
  id?: number;
  type?: string;
  owner?: number;
  previousOwner?: number;
  unit?: number;
  inventoryslot?: string;
  inventoryX?: number;
  inventoryY?: number;
  position?: [number, number, number] | number[];
  ammoqty?: number;
  ammoItem?: number;
  painKiller?: number;
  heal?: number;
  stimulant?: number;
  fuseTimer?: number;
  droppedOnAlienTurn?: boolean;
  XCOMProperty?: boolean;
};

export class BattleItem {
  private _id = 0;
  private _owner: BattleUnit | null = null;
  private _previousOwner: BattleUnit | null = null;
  private _unit: BattleUnit | null = null;
  private _tile: { getPosition?: () => Position; getInventory?: () => BattleItem[] } | null = null;
  private _inventorySlot: RuleInventory | null = null;
  private _inventoryX = 0;
  private _inventoryY = 0;
  private _ammoItem: BattleItem | null = null;
  private _fuseTimer = -1;
  private _ammoQuantity = 0;
  private _painKiller = 0;
  private _heal = 0;
  private _stimulant = 0;
  private _XCOMProperty = false;
  private _droppedOnAlienTurn = false;
  private _isAmmo = false;

  constructor(private _rules: RuleItem | null, id: { value: number } | number) {
    if (typeof id === "number") {
      this._id = id;
    } else {
      this._id = id.value;
      id.value++;
    }
    if (this._rules) {
      this.setAmmoQuantity(this._rules.getClipSize());
      if (this._rules.getBattleType() === BattleType.BT_MEDIKIT) {
        this.setHealQuantity(this._rules.getHealQuantity());
        this.setPainKillerQuantity(this._rules.getPainKillerQuantity());
        this.setStimulantQuantity(this._rules.getStimulantQuantity());
      } else if (
        (this._rules.getBattleType() === BattleType.BT_FIREARM || this._rules.getBattleType() === BattleType.BT_MELEE) &&
        this._rules.getCompatibleAmmo().length === 0
      ) {
        this._ammoItem = this;
      }
    }
  }

  load(node: BattleItemSave, mod?: { getInventory?: (id: string, error?: boolean) => RuleInventory | null }): void {
    const slot = node.inventoryslot ?? "NULL";
    if (slot !== "NULL") {
      this._inventorySlot = mod?.getInventory?.(slot) || mod?.getInventory?.("STR_GROUND") || null;
    }
    this._inventoryX = node.inventoryX ?? this._inventoryX;
    this._inventoryY = node.inventoryY ?? this._inventoryY;
    this._ammoQuantity = node.ammoqty ?? this._ammoQuantity;
    this._painKiller = node.painKiller ?? this._painKiller;
    this._heal = node.heal ?? this._heal;
    this._stimulant = node.stimulant ?? this._stimulant;
    this._fuseTimer = node.fuseTimer ?? this._fuseTimer;
    this._droppedOnAlienTurn = node.droppedOnAlienTurn ?? this._droppedOnAlienTurn;
    this._XCOMProperty = node.XCOMProperty ?? this._XCOMProperty;
  }

  save(): BattleItemSave {
    const node: BattleItemSave = {
      id: this._id,
      type: this._rules?.getType(),
      inventoryX: this._inventoryX,
      inventoryY: this._inventoryY
    };
    if (this._owner) {
      node.owner = this._owner.getId();
    }
    if (this._previousOwner) {
      node.previousOwner = this._previousOwner.getId();
    }
    if (this._unit) {
      node.unit = this._unit.getId();
    }
    if (this._inventorySlot) {
      node.inventoryslot = this._inventorySlot.getId();
    }
    if (this._tile?.getPosition) {
      node.position = this._tile.getPosition().toArray();
    }
    if (this._ammoQuantity) {
      node.ammoqty = this._ammoQuantity;
    }
    if (this._ammoItem) {
      node.ammoItem = this._ammoItem.getId();
    }
    if (this._rules?.getBattleType() === BattleType.BT_MEDIKIT) {
      node.painKiller = this._painKiller;
      node.heal = this._heal;
      node.stimulant = this._stimulant;
    }
    if (this._fuseTimer !== -1) {
      node.fuseTimer = this._fuseTimer;
    }
    if (this._droppedOnAlienTurn) {
      node.droppedOnAlienTurn = this._droppedOnAlienTurn;
    }
    if (this._XCOMProperty) {
      node.XCOMProperty = this._XCOMProperty;
    }
    return node;
  }

  getRules(): RuleItem {
    if (!this._rules) {
      throw new Error(`BattleItem ${this._id} has no rules.`);
    }
    return this._rules;
  }

  getAmmoQuantity(): number {
    if (this.getRules().getClipSize() === -1) {
      return 255;
    }
    return this._ammoQuantity;
  }

  setAmmoQuantity(qty: number): void {
    this._ammoQuantity = qty;
  }

  getFuseTimer(): number {
    return this._fuseTimer;
  }

  setFuseTimer(turns: number): void {
    this._fuseTimer = turns;
  }

  spendBullet(): boolean {
    if (this._ammoQuantity > 0) {
      this._ammoQuantity--;
    }
    return this._ammoQuantity !== 0;
  }

  getOwner(): BattleUnit | null {
    return this._owner;
  }

  getPreviousOwner(): BattleUnit | null {
    return this._previousOwner;
  }

  setOwner(owner: BattleUnit | null): void {
    this._previousOwner = this._owner;
    this._owner = owner;
  }

  setPreviousOwner(owner: BattleUnit | null): void {
    this._previousOwner = owner;
  }

  moveToOwner(owner: BattleUnit | null): void {
    this._previousOwner = this._owner || owner;
    this._owner = owner;
    if (this._previousOwner) {
      const inventory = this._previousOwner.getInventory();
      const index = inventory.indexOf(this);
      if (index !== -1) {
        inventory.splice(index, 1);
      }
    }
    if (this._owner) {
      this._owner.getInventory().push(this);
    }
  }

  getSlot(): RuleInventory | null {
    return this._inventorySlot;
  }

  setSlot(slot: RuleInventory | null): void {
    this._inventorySlot = slot;
  }

  getSlotX(): number {
    return this._inventoryX;
  }

  setSlotX(x: number): void {
    this._inventoryX = x;
  }

  getSlotY(): number {
    return this._inventoryY;
  }

  setSlotY(y: number): void {
    this._inventoryY = y;
  }

  occupiesSlot(x: number, y: number, item: BattleItem | null = null): boolean {
    if (item === this) {
      return false;
    }
    if (this._inventorySlot?.getType() === InventoryType.INV_HAND) {
      return true;
    }
    const rules = this.getRules();
    if (!item) {
      return x >= this._inventoryX && x < this._inventoryX + rules.getInventoryWidth() &&
        y >= this._inventoryY && y < this._inventoryY + rules.getInventoryHeight();
    }
    return !(x >= this._inventoryX + rules.getInventoryWidth() ||
      x + item.getRules().getInventoryWidth() <= this._inventoryX ||
      y >= this._inventoryY + rules.getInventoryHeight() ||
      y + item.getRules().getInventoryHeight() <= this._inventoryY);
  }

  getAmmoItem(): BattleItem | null {
    return this._ammoItem;
  }

  needsAmmo(): boolean {
    return this._ammoItem !== this;
  }

  setAmmoItem(item: BattleItem | null): number {
    if (!this.needsAmmo()) {
      return -2;
    }
    if (!item) {
      if (this._ammoItem) {
        this._ammoItem.setIsAmmo(false);
      }
      this._ammoItem = null;
      return 0;
    }
    if (this._ammoItem) {
      return -1;
    }
    if (this.getRules().getCompatibleAmmo().includes(item.getRules().getType())) {
      this._ammoItem = item;
      item.setIsAmmo(true);
      return 0;
    }
    return -2;
  }

  getTile(): { getPosition?: () => Position; getInventory?: () => BattleItem[] } | null {
    return this._tile;
  }

  setTile(tile: { getPosition?: () => Position; getInventory?: () => BattleItem[] } | null): void {
    this._tile = tile;
  }

  getId(): number {
    return this._id;
  }

  getUnit(): BattleUnit | null {
    return this._unit;
  }

  setUnit(unit: BattleUnit | null): void {
    this._unit = unit;
  }

  setHealQuantity(heal: number): void {
    this._heal = heal;
  }

  getHealQuantity(): number {
    return this._heal;
  }

  setPainKillerQuantity(pk: number): void {
    this._painKiller = pk;
  }

  getPainKillerQuantity(): number {
    return this._painKiller;
  }

  setStimulantQuantity(stimulant: number): void {
    this._stimulant = stimulant;
  }

  getStimulantQuantity(): number {
    return this._stimulant;
  }

  setXCOMProperty(flag: boolean): void {
    this._XCOMProperty = flag;
  }

  getXCOMProperty(): boolean {
    return this._XCOMProperty;
  }

  getTurnFlag(): boolean {
    return this._droppedOnAlienTurn;
  }

  setTurnFlag(flag: boolean): void {
    this._droppedOnAlienTurn = flag;
  }

  convertToCorpse(rules: RuleItem): void {
    if (this._unit && this._rules?.getBattleType() === BattleType.BT_CORPSE && rules.getBattleType() === BattleType.BT_CORPSE) {
      this._rules = rules;
    }
  }

  setIsAmmo(ammo: boolean): void {
    this._isAmmo = ammo;
  }

  isAmmo(): boolean {
    return this._isAmmo;
  }
}
