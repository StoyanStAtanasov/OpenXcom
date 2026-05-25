export type EquipmentLayoutItemSave = {
  itemType?: string;
  slot?: string;
  slotX?: number;
  slotY?: number;
  ammoItem?: string;
  fuseTimer?: number;
};

/**
 * Represents a soldier-equipment layout item used on the beginning of the Battlescape.
 */
export class EquipmentLayoutItem {
  private _itemType = "";
  private _slot = "";
  private _slotX = 0;
  private _slotY = 0;
  private _ammoItem = "NONE";
  private _fuseTimer = -1;

  constructor(node: EquipmentLayoutItemSave);
  constructor(itemType: string, slot: string, slotX: number, slotY: number, ammoItem: string, fuseTimer: number);
  constructor(nodeOrItemType: EquipmentLayoutItemSave | string, slot?: string, slotX = 0, slotY = 0, ammoItem = "NONE", fuseTimer = -1) {
    if (typeof nodeOrItemType === "string") {
      this._itemType = nodeOrItemType;
      this._slot = slot || "";
      this._slotX = slotX;
      this._slotY = slotY;
      this._ammoItem = ammoItem;
      this._fuseTimer = fuseTimer;
    } else {
      this.load(nodeOrItemType);
    }
  }

  getItemType(): string {
    return this._itemType;
  }

  getSlot(): string {
    return this._slot;
  }

  getSlotX(): number {
    return this._slotX;
  }

  getSlotY(): number {
    return this._slotY;
  }

  getAmmoItem(): string {
    return this._ammoItem;
  }

  getFuseTimer(): number {
    return this._fuseTimer;
  }

  load(node: EquipmentLayoutItemSave): void {
    this._itemType = node.itemType ?? this._itemType;
    this._slot = node.slot ?? this._slot;
    this._slotX = node.slotX ?? 0;
    this._slotY = node.slotY ?? 0;
    this._ammoItem = node.ammoItem ?? "NONE";
    this._fuseTimer = node.fuseTimer ?? -1;
  }

  save(): EquipmentLayoutItemSave {
    const node: EquipmentLayoutItemSave = {
      itemType: this._itemType,
      slot: this._slot
    };
    if (this._slotX !== 0) {
      node.slotX = this._slotX;
    }
    if (this._slotY !== 0) {
      node.slotY = this._slotY;
    }
    if (this._ammoItem !== "NONE") {
      node.ammoItem = this._ammoItem;
    }
    if (this._fuseTimer >= 0) {
      node.fuseTimer = this._fuseTimer;
    }
    return node;
  }
}
