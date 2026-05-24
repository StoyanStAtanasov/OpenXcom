import type { Language } from "../Engine/Language.ts";
import type { Base } from "./Base.ts";
import type { Craft } from "./Craft.ts";
import type { Soldier } from "./Soldier.ts";

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

export class Transfer {
  private _soldier: Soldier | null = null;
  private _craft: Craft | null = null;
  private _itemId = "";
  private _itemQty = 0;
  private _scientists = 0;
  private _engineers = 0;
  private _delivered = false;

  constructor(private _hours: number) {}

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
