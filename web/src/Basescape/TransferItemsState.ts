import { Options } from "../Engine/Options.ts";
import { State } from "../Engine/State.ts";
import { Timer } from "../Engine/Timer.ts";
import type { Action } from "../Engine/Action.ts";
import { Text, ALIGN_CENTER } from "../Interface/Text.ts";
import { TextButton } from "../Interface/TextButton.ts";
import { ARROW_VERTICAL, TextList } from "../Interface/TextList.ts";
import { Window } from "../Interface/Window.ts";
import { ComboBox } from "../Interface/ComboBox.ts";
import { ErrorMessageState } from "../Menu/ErrorMessageState.ts";
import type { Base } from "../Savegame/Base.ts";
import type { Craft } from "../Savegame/Craft.ts";
import type { Soldier } from "../Savegame/Soldier.ts";
import { Transfer, TransferType, type TransferRow } from "../Savegame/Transfer.ts";
import { BattleType, type RuleItem } from "../Mod/RuleItem.ts";
import { INT_MAX } from "../Mod/RuleInterface.ts";
import { SDL_BUTTON_LEFT, SDL_BUTTON_RIGHT, SDL_BUTTON_WHEELDOWN, SDL_BUTTON_WHEELUP } from "../types.ts";
import { TransferConfirmState } from "./TransferConfirmState.ts";

export class TransferItemsState extends State {
  private _btnOk: TextButton;
  private _btnCancel: TextButton;
  private _window: Window;
  private _txtTitle: Text;
  private _txtQuantity: Text;
  private _txtAmountTransfer: Text;
  private _txtAmountDestination: Text;
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
  private _aQty = 0;
  private _iQty = 0.0;
  private _distance = 0.0;
  private _ammoColor = 0;
  private _timerInc: Timer;
  private _timerDec: Timer;

  constructor(private _baseFrom: Base, private _baseTo: Base) {
    super();

    this._window = new Window(this, 320, 200, 0, 0);
    this._btnOk = new TextButton(148, 16, 8, 176);
    this._btnCancel = new TextButton(148, 16, 164, 176);
    this._txtTitle = new Text(310, 17, 5, 8);
    this._txtQuantity = new Text(50, 9, 150, 24);
    this._txtAmountTransfer = new Text(60, 17, 200, 24);
    this._txtAmountDestination = new Text(60, 17, 260, 24);
    this._cbxCategory = new ComboBox(this, 120, 16, 10, 24);
    this._lstItems = new TextList(287, 128, 8, 44);

    this.setInterface("transferMenu");
    this._ammoColor = this.game().getMod()?.getInterface("transferMenu")?.getElement("ammoColor")?.color || 0;

    this.add(this._window, "window", "transferMenu");
    this.add(this._btnOk, "button", "transferMenu");
    this.add(this._btnCancel, "button", "transferMenu");
    this.add(this._txtTitle, "text", "transferMenu");
    this.add(this._txtQuantity, "text", "transferMenu");
    this.add(this._txtAmountTransfer, "text", "transferMenu");
    this.add(this._txtAmountDestination, "text", "transferMenu");
    this.add(this._lstItems, "list", "transferMenu");
    this.add(this._cbxCategory, "text", "transferMenu");

    this.centerAllSurfaces();

    const back13 = this.game().getMod()?.getSurface("BACK13.SCR");
    if (back13) {
      this._window.setBackground(back13);
    }

    this._btnOk.setText(String(this.tr("STR_TRANSFER")));
    this._btnOk.onMouseClick(this.btnOkClick.bind(this));
    this._btnOk.onKeyboardPress(this.btnOkClick.bind(this), Options.keyOk);

    this._btnCancel.setText(String(this.tr("STR_CANCEL")));
    this._btnCancel.onMouseClick(this.btnCancelClick.bind(this));
    this._btnCancel.onKeyboardPress(this.btnCancelClick.bind(this), Options.keyCancel);

    this._txtTitle.setBig();
    this._txtTitle.setAlign(ALIGN_CENTER);
    this._txtTitle.setText(String(this.tr("STR_TRANSFER")));
    this._txtQuantity.setText(String(this.tr("STR_QUANTITY_UC")));
    this._txtAmountTransfer.setText(String(this.tr("STR_AMOUNT_TO_TRANSFER")));
    this._txtAmountTransfer.setWordWrap(true);
    this._txtAmountDestination.setText(String(this.tr("STR_AMOUNT_AT_DESTINATION")));
    this._txtAmountDestination.setWordWrap(true);

    this._lstItems.setArrowColumn(193, ARROW_VERTICAL);
    this._lstItems.setColumns(4, 162, 58, 40, 27);
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

    this._distance = this.getDistance();
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
      this._lstItems.addRow(4, name, `${this._items[i].qtySrc - this._items[i].amount}`, `${this._items[i].amount}`, `${this._items[i].qtyDst}`);
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
    this.game().pushState(new TransferConfirmState(this._baseTo, this));
  }

  completeTransfer(): void {
    const time = Math.floor(6 + this._distance / 10.0);
    const save = this.game().getSavedGame();
    save?.setFunds((save.getFunds() || 0) - this._total);
    for (const row of this._items) {
      if (row.amount <= 0) {
        continue;
      }
      let transfer: Transfer | null = null;
      switch (row.type) {
        case TransferType.TRANSFER_SOLDIER: {
          const soldier = row.rule as Soldier;
          const index = this._baseFrom.getSoldiers().indexOf(soldier);
          if (index !== -1) {
            soldier.setPsiTraining(false);
            transfer = new Transfer(time);
            transfer.setSoldier(soldier);
            this._baseTo.getTransfers().push(transfer);
            this._baseFrom.getSoldiers().splice(index, 1);
          }
          break;
        }
        case TransferType.TRANSFER_CRAFT: {
          const craft = row.rule as Craft;
          for (let i = 0; i < this._baseFrom.getSoldiers().length;) {
            const soldier = this._baseFrom.getSoldiers()[i];
            if (soldier.getCraft() === craft) {
              soldier.setPsiTraining(false);
              if (craft.getStatus() === "STR_OUT") {
                this._baseTo.getSoldiers().push(soldier);
              } else {
                transfer = new Transfer(time);
                transfer.setSoldier(soldier);
                this._baseTo.getTransfers().push(transfer);
              }
              this._baseFrom.getSoldiers().splice(i, 1);
            } else {
              ++i;
            }
          }
          this._baseFrom.removeCraft(craft, false);
          if (craft.getStatus() === "STR_OUT") {
            this._baseTo.getCrafts().push(craft);
            craft.setBase(this._baseTo, false);
          } else {
            transfer = new Transfer(time);
            transfer.setCraft(craft);
            this._baseTo.getTransfers().push(transfer);
          }
          break;
        }
        case TransferType.TRANSFER_SCIENTIST:
          this._baseFrom.setScientists(this._baseFrom.getScientists() - row.amount);
          transfer = new Transfer(time);
          transfer.setScientists(row.amount);
          this._baseTo.getTransfers().push(transfer);
          break;
        case TransferType.TRANSFER_ENGINEER:
          this._baseFrom.setEngineers(this._baseFrom.getEngineers() - row.amount);
          transfer = new Transfer(time);
          transfer.setEngineers(row.amount);
          this._baseTo.getTransfers().push(transfer);
          break;
        case TransferType.TRANSFER_ITEM: {
          const rule = row.rule as RuleItem;
          this._baseFrom.getStorageItems().removeItem(rule.getType(), row.amount);
          transfer = new Transfer(time);
          transfer.setItems(rule.getType(), row.amount);
          this._baseTo.getTransfers().push(transfer);
          break;
        }
      }
    }
  }

  btnCancelClick(_action?: Action): void {
    this.game().popState();
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
    if (change <= 0 || this.getRow().qtySrc <= this.getRow().amount) {
      return;
    }
    let errorMessage = "";
    let selItem: RuleItem | null = null;
    let craft: Craft | null = null;

    switch (this.getRow().type) {
      case TransferType.TRANSFER_SOLDIER:
      case TransferType.TRANSFER_SCIENTIST:
      case TransferType.TRANSFER_ENGINEER:
        if (this._pQty + 1 > this._baseTo.getAvailableQuarters() - this._baseTo.getUsedQuarters()) {
          errorMessage = String(this.tr("STR_NO_FREE_ACCOMODATION"));
        }
        break;
      case TransferType.TRANSFER_CRAFT:
        craft = this.getRow().rule as Craft;
        if (this._cQty + 1 > this._baseTo.getAvailableHangars() - this._baseTo.getUsedHangars()) {
          errorMessage = String(this.tr("STR_NO_FREE_HANGARS_FOR_TRANSFER"));
        } else if (this._pQty + craft.getNumSoldiers() > this._baseTo.getAvailableQuarters() - this._baseTo.getUsedQuarters()) {
          errorMessage = String(this.tr("STR_NO_FREE_ACCOMODATION_CREW"));
        } else if (Options.storageLimitsEnforced && this._baseTo.storesOverfull(this._iQty + craft.getItems().getTotalSize(this.game().getMod()))) {
          errorMessage = String(this.tr("STR_NOT_ENOUGH_STORE_SPACE_FOR_CRAFT"));
        }
        break;
      case TransferType.TRANSFER_ITEM:
        selItem = this.getRow().rule as RuleItem;
        if (!selItem.isAlien() && this._baseTo.storesOverfull(selItem.getSize() + this._iQty)) {
          errorMessage = String(this.tr("STR_NOT_ENOUGH_STORE_SPACE"));
        } else if (selItem.isAlien()) {
          const enforced = Options.storageLimitsEnforced ? 1 : 0;
          if (enforced * this._aQty + 1 > this._baseTo.getAvailableContainment() - enforced * this._baseTo.getUsedContainment()) {
            errorMessage = String(this.tr("STR_NO_ALIEN_CONTAINMENT_FOR_TRANSFER"));
          }
        }
        break;
    }

    if (errorMessage.length === 0) {
      const freeQuarters = this._baseTo.getAvailableQuarters() - this._baseTo.getUsedQuarters() - this._pQty;
      switch (this.getRow().type) {
        case TransferType.TRANSFER_SOLDIER:
        case TransferType.TRANSFER_SCIENTIST:
        case TransferType.TRANSFER_ENGINEER:
          change = Math.min(freeQuarters, this.getRow().qtySrc - this.getRow().amount, change);
          this._pQty += change;
          this.getRow().amount += change;
          this._total += this.getRow().cost * change;
          break;
        case TransferType.TRANSFER_CRAFT:
          craft = this.getRow().rule as Craft;
          this._cQty++;
          this._pQty += craft.getNumSoldiers();
          this._iQty += craft.getItems().getTotalSize(this.game().getMod());
          this.getRow().amount++;
          if (!Options.canTransferCraftsWhileAirborne || craft.getStatus() !== "STR_OUT") {
            this._total += this.getRow().cost;
          }
          break;
        case TransferType.TRANSFER_ITEM:
          selItem = this.getRow().rule as RuleItem;
          if (!selItem.isAlien()) {
            const storesNeededPerItem = selItem.getSize();
            const freeStores = this._baseTo.getAvailableStores() - this._baseTo.getUsedStores() - this._iQty;
            let freeStoresForItem = INT_MAX;
            if (storesNeededPerItem !== 0.0) {
              freeStoresForItem = Math.trunc((freeStores + 0.05) / storesNeededPerItem);
            }
            change = Math.min(freeStoresForItem, this.getRow().qtySrc - this.getRow().amount, change);
            this._iQty += change * storesNeededPerItem;
            this.getRow().amount += change;
            this._total += this.getRow().cost * change;
          } else {
            const freeContainment = Options.storageLimitsEnforced ? this._baseTo.getAvailableContainment() - this._baseTo.getUsedContainment() - this._aQty : INT_MAX;
            change = Math.min(freeContainment, this.getRow().qtySrc - this.getRow().amount, change);
            this._aQty += change;
            this.getRow().amount += change;
            this._total += this.getRow().cost * change;
          }
          break;
      }
      this.updateItemStrings();
    } else {
      this._timerInc.stop();
      const menuInterface = this.game().getMod()?.getInterface("transferMenu");
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
    let craft: Craft | null = null;
    switch (this.getRow().type) {
      case TransferType.TRANSFER_SOLDIER:
      case TransferType.TRANSFER_SCIENTIST:
      case TransferType.TRANSFER_ENGINEER:
        this._pQty -= change;
        break;
      case TransferType.TRANSFER_CRAFT:
        craft = this.getRow().rule as Craft;
        this._cQty--;
        this._pQty -= craft.getNumSoldiers();
        this._iQty -= craft.getItems().getTotalSize(this.game().getMod());
        break;
      case TransferType.TRANSFER_ITEM: {
        const selItem = this.getRow().rule as RuleItem;
        if (!selItem.isAlien()) {
          this._iQty -= selItem.getSize() * change;
        } else {
          this._aQty -= change;
        }
        break;
      }
    }
    this.getRow().amount -= change;
    if (!Options.canTransferCraftsWhileAirborne || craft === null || craft.getStatus() !== "STR_OUT") {
      this._total -= this.getRow().cost * change;
    }
    this.updateItemStrings();
  }

  updateItemStrings(): void {
    this._lstItems.setCellText(this._sel, 1, `${this.getRow().qtySrc - this.getRow().amount}`);
    this._lstItems.setCellText(this._sel, 2, `${this.getRow().amount}`);
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
  }

  getTotal(): number {
    return this._total;
  }

  getDistance(): number {
    const x = [0, 0, 0];
    const y = [0, 0, 0];
    const z = [0, 0, 0];
    const r = 51.2;
    let base = this._baseFrom;
    for (let i = 0; i < 2; ++i) {
      x[i] = r * Math.cos(base.getLatitude()) * Math.cos(base.getLongitude());
      y[i] = r * Math.cos(base.getLatitude()) * Math.sin(base.getLongitude());
      z[i] = r * -Math.sin(base.getLatitude());
      base = this._baseTo;
    }
    x[2] = x[1] - x[0];
    y[2] = y[1] - y[0];
    z[2] = z[1] - z[0];
    return Math.sqrt(x[2] * x[2] + y[2] * y[2] + z[2] * z[2]);
  }

  cbxCategoryChange(_action?: Action): void {
    this.updateList();
  }

  private populateRows(): void {
    const mod = this.game().getMod();
    const lang = this.game().getLanguage();
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
    for (const soldier of this._baseFrom.getSoldiers()) {
      if (soldier.getCraft() === null) {
        this.addTransferRow({ type: TransferType.TRANSFER_SOLDIER, rule: soldier, name: soldier.getName(true), cost: Math.trunc(5 * this._distance), qtySrc: 1, qtyDst: 0, amount: 0 });
      }
    }
    for (const craft of this._baseFrom.getCrafts()) {
      const fuelLimit = (craft as Craft & { getFuelLimit?: (base: Base) => number }).getFuelLimit?.(this._baseTo);
      if (craft.getStatus() !== "STR_OUT" || (Options.canTransferCraftsWhileAirborne && fuelLimit != null && craft.getFuel() >= fuelLimit)) {
        this.addTransferRow({ type: TransferType.TRANSFER_CRAFT, rule: craft, name: craft.getName(lang), cost: Math.trunc(25 * this._distance), qtySrc: 1, qtyDst: 0, amount: 0 });
      }
    }
    if (this._baseFrom.getAvailableScientists() > 0) {
      this.addTransferRow({ type: TransferType.TRANSFER_SCIENTIST, rule: null, name: String(this.tr("STR_SCIENTIST")), cost: Math.trunc(5 * this._distance), qtySrc: this._baseFrom.getAvailableScientists(), qtyDst: this._baseTo.getAvailableScientists(), amount: 0 });
    }
    if (this._baseFrom.getAvailableEngineers() > 0) {
      this.addTransferRow({ type: TransferType.TRANSFER_ENGINEER, rule: null, name: String(this.tr("STR_ENGINEER")), cost: Math.trunc(5 * this._distance), qtySrc: this._baseFrom.getAvailableEngineers(), qtyDst: this._baseTo.getAvailableEngineers(), amount: 0 });
    }
    for (const type of mod?.getItemsList() || []) {
      const qty = this._baseFrom.getStorageItems().getItem(type);
      if (qty > 0) {
        const rule = mod?.getItem(type);
        if (rule) {
          this.addTransferRow({ type: TransferType.TRANSFER_ITEM, rule, name: String(this.tr(type)), cost: Math.trunc(1 * this._distance), qtySrc: qty, qtyDst: this._baseTo.getStorageItems().getItem(type), amount: 0 });
        }
      }
    }
  }

  private addTransferRow(row: TransferRow): void {
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
