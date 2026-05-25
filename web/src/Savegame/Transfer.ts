import type { Language } from "../Engine/Language.ts";
import type { Mod } from "../Mod/Mod.ts";
import type { Base } from "./Base.ts";
import { Craft, type CraftSaveNode } from "./Craft.ts";
import { Soldier, type SoldierSaveNode } from "./Soldier.ts";
import type { SavedGame } from "./SavedGame.ts";

export enum TransferType {
  TRANSFER_ITEM = 0,
  TRANSFER_CRAFT,
  TRANSFER_SOLDIER,
  TRANSFER_SCIENTIST,
  TRANSFER_ENGINEER
}

export type TransferRow = {
  type: TransferType;
  rule: unknown;
  name: string;
  cost: number;
  qtySrc: number;
  qtyDst: number;
  amount: number;
};

export type TransferSaveNode = {
  hours?: number;
  soldier?: SoldierSaveNode;
  craft?: CraftSaveNode;
  itemId?: string;
  itemQty?: number;
  scientists?: number;
  engineers?: number;
  delivered?: boolean;
};

function intValue(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.trunc(value) : fallback;
}

function boolValue(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

export class Transfer {
  private _soldier: Soldier | null = null;
  private _craft: Craft | null = null;
  private _itemId = "";
  private _itemQty = 0;
  private _scientists = 0;
  private _engineers = 0;
  private _delivered = false;

  constructor(private _hours: number) {}

  load(node: TransferSaveNode | null | undefined, base: Base, mod: Mod | null, save: SavedGame | null = null): boolean {
    if (!node) {
      return true;
    }
    this._hours = intValue(node.hours, this._hours);
    if (node.soldier) {
      const fallbackType = mod?.getSoldiersList()[0] || "";
      const type = node.soldier.type || fallbackType;
      const rule = mod?.getSoldier(type) || null;
      if (!rule) {
        return false;
      }
      const armor = mod?.getArmor(node.soldier.armor || rule.getArmor()) || null;
      const soldier = new Soldier(rule, armor);
      soldier.load(node.soldier, mod, save);
      this._soldier = soldier;
    }
    if (node.craft) {
      const type = node.craft.type || "";
      const rule = mod?.getCraft(type) || null;
      if (!rule) {
        return false;
      }
      const craft = new Craft(rule, base);
      craft.load(
        node.craft,
        weaponType => mod?.getCraftWeapon(weaponType) || null,
        itemType => mod?.getItem(itemType) || null
      );
      this._craft = craft;
    }
    if (node.itemId) {
      this._itemId = node.itemId;
      if (!mod?.getItem(this._itemId)) {
        return false;
      }
    }
    this._itemQty = intValue(node.itemQty, this._itemQty);
    this._scientists = intValue(node.scientists, this._scientists);
    this._engineers = intValue(node.engineers, this._engineers);
    this._delivered = boolValue(node.delivered, this._delivered);
    return true;
  }

  save(): TransferSaveNode {
    const node: TransferSaveNode = {
      hours: this._hours
    };
    if (this._soldier) {
      node.soldier = this._soldier.save();
    } else if (this._craft) {
      node.craft = this._craft.save();
    } else if (this._itemQty !== 0) {
      node.itemId = this._itemId;
      node.itemQty = this._itemQty;
    } else if (this._scientists !== 0) {
      node.scientists = this._scientists;
    } else if (this._engineers !== 0) {
      node.engineers = this._engineers;
    }
    if (this._delivered) {
      node.delivered = this._delivered;
    }
    return node;
  }

  setSoldier(soldier: Soldier | null): void {
    this._soldier = soldier;
  }

  setCraft(craft: Craft | null): void {
    this._craft = craft;
  }

  getCraft(): Craft | null {
    return this._craft;
  }

  getItems(): string {
    return this._itemId;
  }

  setItems(id: string, qty = 1): void {
    this._itemId = id;
    this._itemQty = qty;
  }

  setScientists(scientists: number): void {
    this._scientists = scientists;
  }

  setEngineers(engineers: number): void {
    this._engineers = engineers;
  }

  getName(lang: Language): string {
    if (this._soldier) {
      return this._soldier.getName();
    } else if (this._craft) {
      return this._craft.getName(lang);
    } else if (this._scientists !== 0) {
      return String(lang.getString("STR_SCIENTISTS"));
    } else if (this._engineers !== 0) {
      return String(lang.getString("STR_ENGINEERS"));
    }
    return String(lang.getString(this._itemId));
  }

  getHours(): number {
    return this._hours;
  }

  getQuantity(): number {
    if (this._itemQty !== 0) {
      return this._itemQty;
    } else if (this._scientists !== 0) {
      return this._scientists;
    } else if (this._engineers !== 0) {
      return this._engineers;
    }
    return 1;
  }

  getType(): TransferType {
    if (this._soldier) {
      return TransferType.TRANSFER_SOLDIER;
    } else if (this._craft) {
      return TransferType.TRANSFER_CRAFT;
    } else if (this._scientists !== 0) {
      return TransferType.TRANSFER_SCIENTIST;
    } else if (this._engineers !== 0) {
      return TransferType.TRANSFER_ENGINEER;
    }
    return TransferType.TRANSFER_ITEM;
  }

  advance(base: Base): void {
    --this._hours;
    if (this._hours <= 0) {
      if (this._soldier) {
        base.getSoldiers().push(this._soldier);
      } else if (this._craft) {
        base.getCrafts().push(this._craft);
        this._craft.setBase(base);
        (this._craft as Craft & { checkup?: () => void }).checkup?.();
      } else if (this._itemQty !== 0) {
        base.getStorageItems().addItem(this._itemId, this._itemQty);
      } else if (this._scientists !== 0) {
        base.setScientists(base.getScientists() + this._scientists);
      } else if (this._engineers !== 0) {
        base.setEngineers(base.getEngineers() + this._engineers);
      }
      this._delivered = true;
    }
  }

  getSoldier(): Soldier | null {
    return this._soldier;
  }

  isDelivered(): boolean {
    return this._delivered;
  }
}
