import { Options } from "../Engine/Options.ts";
import { State } from "../Engine/State.ts";
import { Timer } from "../Engine/Timer.ts";
import { formatFunding } from "../Engine/Unicode.ts";
import type { Action } from "../Engine/Action.ts";
import { Text, ALIGN_CENTER } from "../Interface/Text.ts";
import { TextButton } from "../Interface/TextButton.ts";
import { ARROW_VERTICAL, TextList } from "../Interface/TextList.ts";
import { Window } from "../Interface/Window.ts";
import { ComboBox } from "../Interface/ComboBox.ts";
import { ErrorMessageState } from "../Menu/ErrorMessageState.ts";
import type { Base } from "../Savegame/Base.ts";
import { Craft } from "../Savegame/Craft.ts";
import { Transfer, TransferType, type TransferRow } from "../Savegame/Transfer.ts";
import { BattleType, type RuleItem } from "../Mod/RuleItem.ts";
import type { RuleCraft } from "../Mod/RuleCraft.ts";
import type { RuleSoldier } from "../Mod/RuleSoldier.ts";
import { INT_MAX } from "../Mod/RuleInterface.ts";
import { SDL_BUTTON_LEFT, SDL_BUTTON_RIGHT, SDL_BUTTON_WHEELDOWN, SDL_BUTTON_WHEELUP } from "../types.ts";

export class PurchaseState extends State {
  private _btnOk: TextButton;
  private _btnCancel: TextButton;
  private _window: Window;
  private _txtTitle: Text;
  private _txtFunds: Text;
  private _txtPurchases: Text;
  private _txtSpaceUsed: Text;
  private _txtCost: Text;
  private _txtQuantity: Text;
  private _cbxCategory: ComboBox;
  private _lstItems: TextList;
  private _items: TransferRow[] = [];
  private _rows: number[] = [];
  private _cats: string[] = [];
  private _craftWeapons = new Set<string>();
  private _armors = new Set<string>();
  private _sel = 0;
  private _total = 0;
  private _pQty = 0;
  private _cQty = 0;
  private _iQty = 0.0;
  private _ammoColor = 0;
  private _timerInc: Timer;
  private _timerDec: Timer;

  constructor(private _base: Base) {
    super();

    this._window = new Window(this, 320, 200, 0, 0);
    this._btnOk = new TextButton(148, 16, 8, 176);
    this._btnCancel = new TextButton(148, 16, 164, 176);
    this._txtTitle = new Text(310, 17, 5, 8);
    this._txtFunds = new Text(150, 9, 10, 24);
    this._txtPurchases = new Text(150, 9, 160, 24);
    this._txtSpaceUsed = new Text(150, 9, 160, 34);
    this._txtCost = new Text(102, 9, 152, 44);
    this._txtQuantity = new Text(60, 9, 256, 44);
    this._cbxCategory = new ComboBox(this, 120, 16, 10, 36);
    this._lstItems = new TextList(287, 120, 8, 54);

    this.setInterface("buyMenu");
    this._ammoColor = this.game().getMod()?.getInterface("buyMenu")?.getElement("ammoColor")?.color || 0;

    this.add(this._window, "window", "buyMenu");
    this.add(this._btnOk, "button", "buyMenu");
    this.add(this._btnCancel, "button", "buyMenu");
    this.add(this._txtTitle, "text", "buyMenu");
    this.add(this._txtFunds, "text", "buyMenu");
    this.add(this._txtPurchases, "text", "buyMenu");
    this.add(this._txtSpaceUsed, "text", "buyMenu");
    this.add(this._txtCost, "text", "buyMenu");
    this.add(this._txtQuantity, "text", "buyMenu");
    this.add(this._lstItems, "list", "buyMenu");
    this.add(this._cbxCategory, "text", "buyMenu");

    this.centerAllSurfaces();

    const back13 = this.game().getMod()?.getSurface("BACK13.SCR");
    if (back13) {
      this._window.setBackground(back13);
    }

    this._btnOk.setText(String(this.tr("STR_OK")));
    this._btnOk.onMouseClick(this.btnOkClick.bind(this));
    this._btnOk.onKeyboardPress(this.btnOkClick.bind(this), Options.keyOk);

    this._btnCancel.setText(String(this.tr("STR_CANCEL")));
    this._btnCancel.onMouseClick(this.btnCancelClick.bind(this));
    this._btnCancel.onKeyboardPress(this.btnCancelClick.bind(this), Options.keyCancel);

    this._txtTitle.setBig();
    this._txtTitle.setAlign(ALIGN_CENTER);
    this._txtTitle.setText(String(this.tr("STR_PURCHASE_HIRE_PERSONNEL")));

    this._txtFunds.setText(String(this.tr("STR_CURRENT_FUNDS").arg(formatFunding(this.game().getSavedGame()?.getFunds() || 0))));
    this._txtPurchases.setText(String(this.tr("STR_COST_OF_PURCHASES").arg(formatFunding(this._total))));
    this._txtSpaceUsed.setVisible(Options.storageLimitsEnforced);
    this._txtSpaceUsed.setText(String(this.tr("STR_SPACE_USED").arg(`${this._base.getUsedStores()}:${this._base.getAvailableStores()}`)));
    this._txtCost.setText(String(this.tr("STR_COST_PER_UNIT_UC")));
    this._txtQuantity.setText(String(this.tr("STR_QUANTITY_UC")));

    this._lstItems.setArrowColumn(227, ARROW_VERTICAL);
    this._lstItems.setColumns(4, 150, 55, 50, 32);
    this._lstItems.setSelectable(true);
    this._lstItems.setBackground(this._window);
    this._lstItems.setMargin(2);
    this._lstItems.onLeftArrowPress(this.lstItemsLeftArrowPress.bind(this));
    this._lstItems.onLeftArrowRelease(this.lstItemsLeftArrowRelease.bind(this));
    this._lstItems.onLeftArrowClick(this.lstItemsLeftArrowClick.bind(this));
    this._lstItems.onRightArrowPress(this.lstItemsRightArrowPress.bind(this));
    this._lstItems.onRightArrowRelease(this.lstItemsRightArrowRelease.bind(this));
    this._lstItems.onRightArrowClick(this.lstItemsRightArrowClick.bind(this));
    this._lstItems.onMousePress(this.lstItemsMousePress.bind(this));

    this.populateRows();

    this._cbxCategory.setOptions(this._cats, true);
    this._cbxCategory.onChange(this.cbxCategoryChange.bind(this));
    this.updateList();

    this._timerInc = new Timer(250);
    this._timerInc.onTimer(this.increase.bind(this));
    this._timerDec = new Timer(250);
    this._timerDec.onTimer(this.decrease.bind(this));
  }

  override think(): void {
    super.think();
    this._timerInc.think(this, null);
    this._timerDec.think(this, null);
  }

  getCategory(sel: number): string {
    const row = this._items[sel];
    if (!row) {
      return "STR_ALL_ITEMS";
    }
    switch (row.type) {
      case TransferType.TRANSFER_SOLDIER:
      case TransferType.TRANSFER_SCIENTIST:
      case TransferType.TRANSFER_ENGINEER:
        return "STR_PERSONNEL";
      case TransferType.TRANSFER_CRAFT:
        return "STR_CRAFT_ARMAMENT";
      case TransferType.TRANSFER_ITEM: {
        const rule = row.rule as RuleItem;
        if (rule.getBattleType() === BattleType.BT_CORPSE || rule.isAlien()) {
          return "STR_ALIENS";
        }
        if (rule.getBattleType() === BattleType.BT_NONE) {
          if (this._craftWeapons.has(rule.getType())) {
            return "STR_CRAFT_ARMAMENT";
          }
          if (this._armors.has(rule.getType())) {
            return "STR_EQUIPMENT";
          }
          return "STR_COMPONENTS";
        }
        return "STR_EQUIPMENT";
      }
      default:
        return "STR_ALL_ITEMS";
    }
  }

  updateList(): void {
    this._lstItems.clearList();
    this._rows = [];
    const cat = this._cats[this._cbxCategory.getSelected()] || "STR_ALL_ITEMS";
    for (let i = 0; i < this._items.length; ++i) {
      if (cat !== "STR_ALL_ITEMS" && cat !== this.getCategory(i)) {
        continue;
      }
      let name = this._items[i].name;
      let ammo = false;
      if (this._items[i].type === TransferType.TRANSFER_ITEM) {
        const rule = this._items[i].rule as RuleItem;
        ammo = rule.getBattleType() === BattleType.BT_AMMO || (rule.getBattleType() === BattleType.BT_NONE && rule.getClipSize() > 0);
        if (ammo) {
          name = `  ${name}`;
        }
      }
      this._lstItems.addRow(4, name, formatFunding(this._items[i].cost), `${this._items[i].qtySrc}`, `${this._items[i].amount}`);
      this._rows.push(i);
      if (this._items[i].amount > 0) {
        this._lstItems.setRowColor(this._rows.length - 1, this._lstItems.getSecondaryColor());
      } else if (ammo) {
        this._lstItems.setRowColor(this._rows.length - 1, this._ammoColor);
      }
    }
    if (this._sel >= this._rows.length) {
      this._sel = Math.max(0, this._rows.length - 1);
    }
  }

  btnOkClick(_action?: Action): void {
    const save = this.game().getSavedGame();
    const mod = this.game().getMod();
    if (!save || !mod) {
      this.game().popState();
      return;
    }
    save.setFunds(save.getFunds() - this._total);
    for (const row of this._items) {
      if (row.amount <= 0) {
        continue;
      }
      let transfer: Transfer | null = null;
      switch (row.type) {
        case TransferType.TRANSFER_SOLDIER:
          for (let s = 0; s < row.amount; ++s) {
            const rule = row.rule as RuleSoldier;
            let time = rule.getTransferTime();
            if (time === 0) {
              time = mod.getPersonnelTime();
            }
            const soldier = mod.genSoldier(save, rule.getType());
            if (soldier) {
              transfer = new Transfer(time);
              transfer.setSoldier(soldier);
              this._base.getTransfers().push(transfer);
            }
          }
          break;
        case TransferType.TRANSFER_SCIENTIST:
          transfer = new Transfer(mod.getPersonnelTime());
          transfer.setScientists(row.amount);
          this._base.getTransfers().push(transfer);
          break;
        case TransferType.TRANSFER_ENGINEER:
          transfer = new Transfer(mod.getPersonnelTime());
          transfer.setEngineers(row.amount);
          this._base.getTransfers().push(transfer);
          break;
        case TransferType.TRANSFER_CRAFT:
          for (let c = 0; c < row.amount; ++c) {
            const rule = row.rule as RuleCraft;
            transfer = new Transfer(rule.getTransferTime());
            const craft = new Craft(rule, this._base, save.getId(rule.getType()));
            craft.setStatus("STR_REFUELLING");
            transfer.setCraft(craft);
            this._base.getTransfers().push(transfer);
          }
          break;
        case TransferType.TRANSFER_ITEM: {
          const rule = row.rule as RuleItem;
          transfer = new Transfer(rule.getTransferTime());
          transfer.setItems(rule.getType(), row.amount);
          this._base.getTransfers().push(transfer);
          break;
        }
      }
    }
    this.game().popState();
  }

  btnCancelClick(_action?: Action): void {
    this.game().popState();
  }

  lstItemsLeftArrowPress(action: Action): void {
    this._sel = this._lstItems.getSelectedRow();
    if (action.getDetails().button?.button === SDL_BUTTON_LEFT && !this._timerInc.isRunning()) {
      this._timerInc.start();
    }
  }

  lstItemsLeftArrowRelease(action: Action): void {
    if (action.getDetails().button?.button === SDL_BUTTON_LEFT) {
      this._timerInc.stop();
    }
  }

  lstItemsLeftArrowClick(action: Action): void {
    if (action.getDetails().button?.button === SDL_BUTTON_RIGHT) {
      this.increaseByValue(INT_MAX);
    }
    if (action.getDetails().button?.button === SDL_BUTTON_LEFT) {
      this.increaseByValue(1);
      this._timerInc.setInterval(250);
      this._timerDec.setInterval(250);
    }
  }

  lstItemsRightArrowPress(action: Action): void {
    this._sel = this._lstItems.getSelectedRow();
    if (action.getDetails().button?.button === SDL_BUTTON_LEFT && !this._timerDec.isRunning()) {
      this._timerDec.start();
    }
  }

  lstItemsRightArrowRelease(action: Action): void {
    if (action.getDetails().button?.button === SDL_BUTTON_LEFT) {
      this._timerDec.stop();
    }
  }

  lstItemsRightArrowClick(action: Action): void {
    if (action.getDetails().button?.button === SDL_BUTTON_RIGHT) {
      this.decreaseByValue(INT_MAX);
    }
    if (action.getDetails().button?.button === SDL_BUTTON_LEFT) {
      this.decreaseByValue(1);
      this._timerInc.setInterval(250);
      this._timerDec.setInterval(250);
    }
  }

  lstItemsMousePress(action: Action): void {
    this._sel = this._lstItems.getSelectedRow();
    if (action.getDetails().button?.button === SDL_BUTTON_WHEELUP) {
      this._timerInc.stop();
      this._timerDec.stop();
      if (action.getAbsoluteXMouse() >= this._lstItems.getArrowsLeftEdge() && action.getAbsoluteXMouse() <= this._lstItems.getArrowsRightEdge()) {
        this.increaseByValue(Options.changeValueByMouseWheel);
      }
    } else if (action.getDetails().button?.button === SDL_BUTTON_WHEELDOWN) {
      this._timerInc.stop();
      this._timerDec.stop();
      if (action.getAbsoluteXMouse() >= this._lstItems.getArrowsLeftEdge() && action.getAbsoluteXMouse() <= this._lstItems.getArrowsRightEdge()) {
        this.decreaseByValue(Options.changeValueByMouseWheel);
      }
    }
  }

  increase(): void {
    this._timerDec.setInterval(50);
    this._timerInc.setInterval(50);
    this.increaseByValue(1);
  }

  increaseByValue(change: number): void {
    if (change <= 0) {
      return;
    }
    let errorMessage = "";
    const save = this.game().getSavedGame();
    if (this._total + this.getRow().cost > (save?.getFunds() || 0)) {
      errorMessage = String(this.tr("STR_NOT_ENOUGH_MONEY"));
    } else {
      switch (this.getRow().type) {
        case TransferType.TRANSFER_SOLDIER:
        case TransferType.TRANSFER_SCIENTIST:
        case TransferType.TRANSFER_ENGINEER:
          if (this._pQty + 1 > this._base.getAvailableQuarters() - this._base.getUsedQuarters()) {
            errorMessage = String(this.tr("STR_NOT_ENOUGH_LIVING_SPACE"));
          }
          break;
        case TransferType.TRANSFER_CRAFT:
          if (this._cQty + 1 > this._base.getAvailableHangars() - this._base.getUsedHangars()) {
            errorMessage = String(this.tr("STR_NO_FREE_HANGARS_FOR_PURCHASE"));
          }
          break;
        case TransferType.TRANSFER_ITEM: {
          const rule = this.getRow().rule as RuleItem;
          if (this._base.storesOverfull(this._iQty + rule.getSize())) {
            errorMessage = String(this.tr("STR_NOT_ENOUGH_STORE_SPACE"));
          }
          break;
        }
      }
    }

    if (errorMessage.length === 0) {
      const maxByMoney = Math.trunc(((save?.getFunds() || 0) - this._total) / this.getRow().cost);
      if (maxByMoney >= 0) {
        change = Math.min(maxByMoney, change);
      }
      switch (this.getRow().type) {
        case TransferType.TRANSFER_SOLDIER:
        case TransferType.TRANSFER_SCIENTIST:
        case TransferType.TRANSFER_ENGINEER: {
          const maxByQuarters = this._base.getAvailableQuarters() - this._base.getUsedQuarters() - this._pQty;
          change = Math.min(maxByQuarters, change);
          this._pQty += change;
          break;
        }
        case TransferType.TRANSFER_CRAFT: {
          const maxByHangars = this._base.getAvailableHangars() - this._base.getUsedHangars() - this._cQty;
          change = Math.min(maxByHangars, change);
          this._cQty += change;
          break;
        }
        case TransferType.TRANSFER_ITEM: {
          const rule = this.getRow().rule as RuleItem;
          const storesNeededPerItem = rule.getSize();
          const freeStores = this._base.getAvailableStores() - this._base.getUsedStores() - this._iQty;
          let maxByStores = INT_MAX;
          if (storesNeededPerItem !== 0.0) {
            maxByStores = Math.trunc((freeStores + 0.05) / storesNeededPerItem);
          }
          change = Math.min(maxByStores, change);
          this._iQty += change * storesNeededPerItem;
          break;
        }
      }
      this.getRow().amount += change;
      this._total += this.getRow().cost * change;
      this.updateItemStrings();
    } else {
      this._timerInc.stop();
      const menuInterface = this.game().getMod()?.getInterface("buyMenu");
      this.game().pushState(new ErrorMessageState(
        errorMessage,
        this._palette,
        menuInterface?.getElement("errorMessage")?.color || 1,
        "BACK13.SCR",
        menuInterface?.getElement("errorPalette")?.color ?? -1
      ));
    }
  }

  decrease(): void {
    this._timerInc.setInterval(50);
    this._timerDec.setInterval(50);
    this.decreaseByValue(1);
  }

  decreaseByValue(change: number): void {
    if (change <= 0 || this.getRow().amount <= 0) {
      return;
    }
    change = Math.min(this.getRow().amount, change);
    switch (this.getRow().type) {
      case TransferType.TRANSFER_SOLDIER:
      case TransferType.TRANSFER_SCIENTIST:
      case TransferType.TRANSFER_ENGINEER:
        this._pQty -= change;
        break;
      case TransferType.TRANSFER_CRAFT:
        this._cQty -= change;
        break;
      case TransferType.TRANSFER_ITEM:
        this._iQty -= (this.getRow().rule as RuleItem).getSize() * change;
        break;
    }
    this.getRow().amount -= change;
    this._total -= this.getRow().cost * change;
    this.updateItemStrings();
  }

  updateItemStrings(): void {
    this._txtPurchases.setText(String(this.tr("STR_COST_OF_PURCHASES").arg(formatFunding(this._total))));
    this._lstItems.setCellText(this._sel, 3, `${this.getRow().amount}`);
    if (this.getRow().amount > 0) {
      this._lstItems.setRowColor(this._sel, this._lstItems.getSecondaryColor());
    } else {
      this._lstItems.setRowColor(this._sel, this._lstItems.getColor());
      if (this.getRow().type === TransferType.TRANSFER_ITEM) {
        const rule = this.getRow().rule as RuleItem;
        if (rule.getBattleType() === BattleType.BT_AMMO || (rule.getBattleType() === BattleType.BT_NONE && rule.getClipSize() > 0)) {
          this._lstItems.setRowColor(this._sel, this._ammoColor);
        }
      }
    }
    let usedStores = `${this._base.getUsedStores()}`;
    if (Math.abs(this._iQty) > 0.05) {
      usedStores += `(${this._iQty > 0.05 ? "+" : ""}${this._iQty.toFixed(1)})`;
    }
    usedStores += `:${this._base.getAvailableStores()}`;
    this._txtSpaceUsed.setText(String(this.tr("STR_SPACE_USED").arg(usedStores)));
  }

  cbxCategoryChange(_action?: Action): void {
    this.updateList();
  }

  private populateRows(): void {
    const mod = this.game().getMod();
    const save = this.game().getSavedGame();
    this._cats.push("STR_ALL_ITEMS");
    for (const type of mod?.getCraftWeaponsList() || []) {
      const rule = mod?.getCraftWeapon(type);
      if (rule) {
        this._craftWeapons.add(rule.getLauncherItem());
        this._craftWeapons.add(rule.getClipItem());
      }
    }
    for (const type of mod?.getArmorsList() || []) {
      const armor = mod?.getArmor(type);
      if (armor) {
        this._armors.add(armor.getStoreItem());
      }
    }
    for (const type of mod?.getSoldiersList() || []) {
      const rule = mod?.getSoldier(type);
      if (rule && rule.getBuyCost() !== 0 && save?.isResearched(rule.getRequirements())) {
        this.addPurchaseRow({ type: TransferType.TRANSFER_SOLDIER, rule, name: String(this.tr(rule.getType())), cost: rule.getBuyCost(), qtySrc: this._base.getSoldierCount(rule.getType()), qtyDst: 0, amount: 0 });
      }
    }
    if (mod) {
      this.addPurchaseRow({ type: TransferType.TRANSFER_SCIENTIST, rule: null, name: String(this.tr("STR_SCIENTIST")), cost: mod.getScientistCost() * 2, qtySrc: this._base.getTotalScientists(), qtyDst: 0, amount: 0 });
      this.addPurchaseRow({ type: TransferType.TRANSFER_ENGINEER, rule: null, name: String(this.tr("STR_ENGINEER")), cost: mod.getEngineerCost() * 2, qtySrc: this._base.getTotalEngineers(), qtyDst: 0, amount: 0 });
    }
    for (const type of mod?.getCraftsList() || []) {
      const rule = mod?.getCraft(type);
      if (rule && rule.getBuyCost() !== 0 && save?.isResearched(rule.getRequirements())) {
        this.addPurchaseRow({ type: TransferType.TRANSFER_CRAFT, rule, name: String(this.tr(rule.getType())), cost: rule.getBuyCost(), qtySrc: this._base.getCraftCount(rule.getType()), qtyDst: 0, amount: 0 });
      }
    }
    for (const type of mod?.getItemsList() || []) {
      const rule = mod?.getItem(type);
      if (rule && rule.getBuyCost() !== 0 && save?.isResearched(rule.getRequirements())) {
        this.addPurchaseRow({ type: TransferType.TRANSFER_ITEM, rule, name: String(this.tr(rule.getType())), cost: rule.getBuyCost(), qtySrc: this._base.getStorageItems().getItem(rule.getType()), qtyDst: 0, amount: 0 });
      }
    }
  }

  private addPurchaseRow(row: TransferRow): void {
    this._items.push(row);
    const cat = this.getCategory(this._items.length - 1);
    if (!this._cats.includes(cat)) {
      this._cats.push(cat);
    }
  }

  private getRow(): TransferRow {
    return this._items[this._rows[this._sel]];
  }
}
