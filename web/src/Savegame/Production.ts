import type { Mod } from "../Mod/Mod.ts";
import type { RuleManufacture } from "../Mod/RuleManufacture.ts";
import { BattleType } from "../Mod/RuleItem.ts";
import { INT_MAX } from "../Mod/RuleInterface.ts";
import type { Base } from "./Base.ts";
import { Craft } from "./Craft.ts";
import type { SavedGame } from "./SavedGame.ts";

export enum productionProgress_e {
  PROGRESS_NOT_COMPLETE,
  PROGRESS_COMPLETE,
  PROGRESS_NOT_ENOUGH_MONEY,
  PROGRESS_NOT_ENOUGH_MATERIALS,
  PROGRESS_MAX,
  PROGRESS_CONSTRUCTION
}

export type ProductionSave = {
  item?: string;
  assigned?: number;
  spent?: number;
  amount?: number;
  infinite?: boolean;
  sell?: boolean;
};

export class Production {
  private _infinite = false;
  private _timeSpent = 0;
  private _engineers = 0;
  private _sell = false;

  constructor(private _rules: RuleManufacture, private _amount: number) {}

  getAmountTotal(): number {
    return this._amount;
  }

  setAmountTotal(amount: number): void {
    this._amount = amount;
  }

  getInfiniteAmount(): boolean {
    return this._infinite;
  }

  setInfiniteAmount(inf: boolean): void {
    this._infinite = inf;
  }

  getTimeSpent(): number {
    return this._timeSpent;
  }

  setTimeSpent(done: number): void {
    this._timeSpent = done;
  }

  getAssignedEngineers(): number {
    return this._engineers;
  }

  setAssignedEngineers(engineers: number): void {
    this._engineers = engineers;
  }

  getSellItems(): boolean {
    return this._sell;
  }

  setSellItems(sell: boolean): void {
    this._sell = sell;
  }

  step(b: Base, g: SavedGame, m: Mod): productionProgress_e {
    const done = this.getAmountProduced();
    this._timeSpent += this._engineers;

    if (done < this.getAmountProduced()) {
      let produced: number;
      if (!this.getInfiniteAmount()) {
        produced = Math.min(this.getAmountProduced(), this._amount) - done;
      } else {
        produced = this.getAmountProduced() - done;
      }
      let count = 0;
      do {
        for (const [id, quantity] of this._rules.getProducedItems()) {
          if (this._rules.getCategory() === "STR_CRAFT") {
            const craftRules = m.getCraft(id);
            if (craftRules) {
              const craft = new Craft(craftRules, b, g.getId(id));
              craft.setStatus("STR_REFUELLING");
              b.getCrafts().push(craft);
            }
            break;
          } else {
            const itemRules = m.getItem(id, true);
            if (itemRules?.getBattleType() === BattleType.BT_NONE) {
              for (const craft of b.getCrafts()) {
                (craft as Craft & { reuseItem?: (item: string) => void }).reuseItem?.(id);
              }
            }
            if (this.getSellItems()) {
              g.setFunds(g.getFunds() + ((itemRules?.getSellCost() || 0) * quantity));
            } else {
              b.getStorageItems().addItem(id, quantity);
            }
          }
        }
        count++;
        if (count < produced) {
          if (!this.haveEnoughMoneyForOneMoreUnit(g)) return productionProgress_e.PROGRESS_NOT_ENOUGH_MONEY;
          if (!this.haveEnoughMaterialsForOneMoreUnit(b, m)) return productionProgress_e.PROGRESS_NOT_ENOUGH_MATERIALS;
          this.startItem(b, g, m);
        }
      } while (count < produced);
    }
    if (this.getAmountProduced() >= this._amount && !this.getInfiniteAmount()) return productionProgress_e.PROGRESS_COMPLETE;
    if (done < this.getAmountProduced()) {
      if (!this.haveEnoughMoneyForOneMoreUnit(g)) return productionProgress_e.PROGRESS_NOT_ENOUGH_MONEY;
      if (!this.haveEnoughMaterialsForOneMoreUnit(b, m)) return productionProgress_e.PROGRESS_NOT_ENOUGH_MATERIALS;
      this.startItem(b, g, m);
    }
    return productionProgress_e.PROGRESS_NOT_COMPLETE;
  }

  getAmountProduced(): number {
    if (this._rules.getManufactureTime() > 0) {
      return Math.trunc(this._timeSpent / this._rules.getManufactureTime());
    }
    return this._amount;
  }

  getRules(): RuleManufacture {
    return this._rules;
  }

  startItem(b: Base, g: SavedGame, m: Mod): void {
    g.setFunds(g.getFunds() - this._rules.getManufactureCost());
    for (const [id, quantity] of this._rules.getRequiredItems()) {
      if (m.getItem(id) !== null) {
        b.getStorageItems().removeItem(id, quantity);
      } else if (m.getCraft(id) !== null) {
        for (const craft of [...b.getCrafts()]) {
          if (craft.getRules().getType() === id) {
            b.removeCraft(craft, true);
            break;
          }
        }
      }
    }
  }

  save(): ProductionSave {
    const node: ProductionSave = {};
    node.item = this.getRules().getName();
    node.assigned = this.getAssignedEngineers();
    node.spent = this.getTimeSpent();
    node.amount = this.getAmountTotal();
    node.infinite = this.getInfiniteAmount();
    if (this.getSellItems()) {
      node.sell = this.getSellItems();
    }
    return node;
  }

  load(node: ProductionSave): void {
    this.setAssignedEngineers(node.assigned ?? this.getAssignedEngineers());
    this.setTimeSpent(node.spent ?? this.getTimeSpent());
    this.setAmountTotal(node.amount ?? this.getAmountTotal());
    this.setInfiniteAmount(node.infinite ?? this.getInfiniteAmount());
    this.setSellItems(node.sell ?? this.getSellItems());
    if (this.getAmountTotal() === INT_MAX) {
      this.setAmountTotal(999);
      this.setInfiniteAmount(true);
      this.setSellItems(true);
    }
  }

  private haveEnoughMoneyForOneMoreUnit(g: SavedGame): boolean {
    return this._rules.haveEnoughMoneyForOneMoreUnit(g.getFunds());
  }

  private haveEnoughMaterialsForOneMoreUnit(b: Base, m: Mod): boolean {
    for (const [id, quantity] of this._rules.getRequiredItems()) {
      if (m.getItem(id) !== null && b.getStorageItems().getItem(id) < quantity) {
        return false;
      } else if (m.getCraft(id) !== null && b.getCraftCount(id) < quantity) {
        return false;
      }
    }
    return true;
  }
}
