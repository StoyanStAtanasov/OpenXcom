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
import { OPT_BATTLESCAPE, OptionsOrigin } from "../Menu/OptionsBaseState.ts";
import type { Base } from "../Savegame/Base.ts";
import type { Craft } from "../Savegame/Craft.ts";
import type { Soldier } from "../Savegame/Soldier.ts";
import { TransferType, type TransferRow } from "../Savegame/Transfer.ts";
import { Armor } from "../Mod/Armor.ts";
import { BattleType, type RuleItem } from "../Mod/RuleItem.ts";
import { INT_MAX } from "../Mod/RuleInterface.ts";
import { SDL_BUTTON_LEFT, SDL_BUTTON_RIGHT, SDL_BUTTON_WHEELDOWN, SDL_BUTTON_WHEELUP } from "../types.ts";

export class SellState extends State {
  private _btnOk: TextButton;
  private _btnCancel: TextButton;
  private _window: Window;
  private _txtTitle: Text;
  private _txtSales: Text;
  private _txtFunds: Text;
  private _txtQuantity: Text;
  private _txtSell: Text;
  private _txtValue: Text;
  private _txtSpaceUsed: Text;
  private _cbxCategory: ComboBox;
  private _lstItems: TextList;
  private _items: TransferRow[] = [];
  private _rows: number[] = [];
  private _cats: string[] = [];
  private _craftWeapons = new Set<string>();
  private _armors = new Set<string>();
  private _sel = 0;
  private _total = 0;
  private _spaceChange = 0.0;
  private _timerInc: Timer;
  private _timerDec: Timer;
  private _ammoColor = 0;

  constructor(private _base: Base, private _origin: OptionsOrigin = OptionsOrigin.OPT_GEOSCAPE) {
    super();
    const overfull = Options.storageLimitsEnforced && this._base.storesOverfull();

    this._window = new Window(this, 320, 200, 0, 0);
    this._btnOk = new TextButton(overfull ? 288 : 148, 16, overfull ? 16 : 8, 176);
    this._btnCancel = new TextButton(148, 16, 164, 176);
    this._txtTitle = new Text(310, 17, 5, 8);
    this._txtSales = new Text(150, 9, 10, 24);
    this._txtFunds = new Text(150, 9, 160, 24);
    this._txtSpaceUsed = new Text(150, 9, 160, 34);
    this._txtQuantity = new Text(54, 9, 136, 44);
    this._txtSell = new Text(96, 9, 190, 44);
    this._txtValue = new Text(40, 9, 270, 44);
    this._cbxCategory = new ComboBox(this, 120, 16, 10, 36);
    this._lstItems = new TextList(287, 120, 8, 54);

    this.setInterface("sellMenu");
    this._ammoColor = this.game().getMod()?.getInterface("sellMenu")?.getElement("ammoColor")?.color || 0;

    this.add(this._window, "window", "sellMenu");
    this.add(this._btnOk, "button", "sellMenu");
    this.add(this._btnCancel, "button", "sellMenu");
    this.add(this._txtTitle, "text", "sellMenu");
    this.add(this._txtSales, "text", "sellMenu");
    this.add(this._txtFunds, "text", "sellMenu");
    this.add(this._txtSpaceUsed, "text", "sellMenu");
    this.add(this._txtQuantity, "text", "sellMenu");
    this.add(this._txtSell, "text", "sellMenu");
    this.add(this._txtValue, "text", "sellMenu");
    this.add(this._lstItems, "list", "sellMenu");
    this.add(this._cbxCategory, "text", "sellMenu");

    this.centerAllSurfaces();

    const back13 = this.game().getMod()?.getSurface("BACK13.SCR");
    if (back13) {
      this._window.setBackground(back13);
    }

    this._btnOk.setText(String(this.tr("STR_SELL_SACK")));
    this._btnOk.onMouseClick(this.btnOkClick.bind(this));
    this._btnOk.onKeyboardPress(this.btnOkClick.bind(this), Options.keyOk);

    this._btnCancel.setText(String(this.tr("STR_CANCEL")));
    this._btnCancel.onMouseClick(this.btnCancelClick.bind(this));
    this._btnCancel.onKeyboardPress(this.btnCancelClick.bind(this), Options.keyCancel);

    if (overfull) {
      this._btnCancel.setVisible(false);
      this._btnOk.setVisible(false);
    }

    this._txtTitle.setBig();
    this._txtTitle.setAlign(ALIGN_CENTER);
    this._txtTitle.setText(String(this.tr("STR_SELL_ITEMS_SACK_PERSONNEL")));
    this._txtSales.setText(String(this.tr("STR_VALUE_OF_SALES").arg(formatFunding(this._total))));
    this._txtFunds.setText(String(this.tr("STR_FUNDS").arg(formatFunding(this.game().getSavedGame()?.getFunds() || 0))));
    this._txtSpaceUsed.setVisible(Options.storageLimitsEnforced);
    this._txtSpaceUsed.setText(String(this.tr("STR_SPACE_USED").arg(`${this._base.getUsedStores()}:${this._base.getAvailableStores()}`)));
    this._txtQuantity.setText(String(this.tr("STR_QUANTITY_UC")));
    this._txtSell.setText(String(this.tr("STR_SELL_SACK")));
    this._txtValue.setText(String(this.tr("STR_VALUE")));

    this._lstItems.setArrowColumn(182, ARROW_VERTICAL);
    this._lstItems.setColumns(4, 156, 54, 24, 53);
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
      this._lstItems.addRow(4, name, `${this._items[i].qtySrc - this._items[i].amount}`, `${this._items[i].amount}`, formatFunding(this._items[i].cost));
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
    if (save) {
      save.setFunds(save.getFunds() + this._total);
    }

    for (const row of this._items) {
      if (row.amount <= 0) {
        continue;
      }
      switch (row.type) {
        case TransferType.TRANSFER_SOLDIER: {
          const soldier = row.rule as Soldier;
          const index = this._base.getSoldiers().indexOf(soldier);
          if (index !== -1) {
            const storeItem = soldier.getArmor()?.getStoreItem() || Armor.NONE;
            if (storeItem !== Armor.NONE) {
              this._base.getStorageItems().addItem(storeItem);
            }
            this._base.getSoldiers().splice(index, 1);
          }
          break;
        }
        case TransferType.TRANSFER_CRAFT:
          this._base.removeCraft(row.rule as Craft, true);
          break;
        case TransferType.TRANSFER_SCIENTIST:
          this._base.setScientists(this._base.getScientists() - row.amount);
          break;
        case TransferType.TRANSFER_ENGINEER:
          this._base.setEngineers(this._base.getEngineers() - row.amount);
          break;
        case TransferType.TRANSFER_ITEM:
          this.removeSoldItems(row.rule as RuleItem, row.amount);
          break;
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
      this.changeByValue(INT_MAX, 1);
    }
    if (action.getDetails().button?.button === SDL_BUTTON_LEFT) {
      this.changeByValue(1, 1);
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
      this.changeByValue(INT_MAX, -1);
    }
    if (action.getDetails().button?.button === SDL_BUTTON_LEFT) {
      this.changeByValue(1, -1);
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
        this.changeByValue(Options.changeValueByMouseWheel, 1);
      }
    } else if (action.getDetails().button?.button === SDL_BUTTON_WHEELDOWN) {
      this._timerInc.stop();
      this._timerDec.stop();
      if (action.getAbsoluteXMouse() >= this._lstItems.getArrowsLeftEdge() && action.getAbsoluteXMouse() <= this._lstItems.getArrowsRightEdge()) {
        this.changeByValue(Options.changeValueByMouseWheel, -1);
      }
    }
  }

  increase(): void {
    this._timerDec.setInterval(50);
    this._timerInc.setInterval(50);
    this.changeByValue(1, 1);
  }

  decrease(): void {
    this._timerInc.setInterval(50);
    this._timerDec.setInterval(50);
    this.changeByValue(1, -1);
  }

  changeByValue(change: number, dir: number): void {
    const row = this.getRow();
    if (dir > 0) {
      if (change <= 0 || row.qtySrc <= row.amount) {
        return;
      }
      change = Math.min(row.qtySrc - row.amount, change);
    } else {
      if (change <= 0 || row.amount <= 0) {
        return;
      }
      change = Math.min(row.amount, change);
    }
    row.amount += dir * change;
    this._total += dir * row.cost * change;

    const mod = this.game().getMod();
    switch (row.type) {
      case TransferType.TRANSFER_SOLDIER: {
        const soldier = row.rule as Soldier;
        const storeItem = soldier.getArmor()?.getStoreItem() || Armor.NONE;
        if (storeItem !== Armor.NONE) {
          const armor = mod?.getItem(storeItem, true);
          this._spaceChange += dir * (armor?.getSize() || 0);
        }
        break;
      }
      case TransferType.TRANSFER_CRAFT: {
        const craft = row.rule as Craft;
        let total = 0.0;
        for (const weaponSlot of craft.getWeapons()) {
          if (!weaponSlot) {
            continue;
          }
          const weapon = mod?.getItem(weaponSlot.getRules().getLauncherItem(), true);
          total += weapon?.getSize() || 0;
          const ammo = mod?.getItem(weaponSlot.getRules().getClipItem());
          if (ammo) {
            total += ammo.getSize() * weaponSlot.getClipsLoaded(mod);
          }
        }
        this._spaceChange += dir * total;
        break;
      }
      case TransferType.TRANSFER_ITEM:
        this._spaceChange -= dir * change * (row.rule as RuleItem).getSize();
        break;
      default:
        break;
    }

    this.updateItemStrings();
  }

  updateItemStrings(): void {
    const row = this.getRow();
    this._lstItems.setCellText(this._sel, 2, `${row.amount}`);
    this._lstItems.setCellText(this._sel, 1, `${row.qtySrc - row.amount}`);
    this._txtSales.setText(String(this.tr("STR_VALUE_OF_SALES").arg(formatFunding(this._total))));

    if (row.amount > 0) {
      this._lstItems.setRowColor(this._sel, this._lstItems.getSecondaryColor());
    } else {
      this._lstItems.setRowColor(this._sel, this._lstItems.getColor());
      if (row.type === TransferType.TRANSFER_ITEM) {
        const rule = row.rule as RuleItem;
        if (rule.getBattleType() === BattleType.BT_AMMO || (rule.getBattleType() === BattleType.BT_NONE && rule.getClipSize() > 0)) {
          this._lstItems.setRowColor(this._sel, this._ammoColor);
        }
      }
    }

    let usedStores = `${this._base.getUsedStores()}`;
    if (Math.abs(this._spaceChange) > 0.05) {
      usedStores += `(${this._spaceChange > 0.05 ? "+" : ""}${this._spaceChange.toFixed(1)})`;
    }
    usedStores += `:${this._base.getAvailableStores()}`;
    this._txtSpaceUsed.setText(String(this.tr("STR_SPACE_USED").arg(usedStores)));
    if (Options.storageLimitsEnforced) {
      this._btnOk.setVisible(!this._base.storesOverfull(this._spaceChange));
    }
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

    for (const soldier of this._base.getSoldiers()) {
      if (soldier.getCraft() === null) {
        this.addSellRow({ type: TransferType.TRANSFER_SOLDIER, rule: soldier, name: soldier.getName(true), cost: 0, qtySrc: 1, qtyDst: 0, amount: 0 });
      }
    }
    for (const craft of this._base.getCrafts()) {
      if (craft.getStatus() !== "STR_OUT") {
        this.addSellRow({ type: TransferType.TRANSFER_CRAFT, rule: craft, name: craft.getName(lang), cost: craft.getRules().getSellCost(), qtySrc: 1, qtyDst: 0, amount: 0 });
      }
    }
    if (this._base.getAvailableScientists() > 0) {
      this.addSellRow({ type: TransferType.TRANSFER_SCIENTIST, rule: null, name: String(this.tr("STR_SCIENTIST")), cost: 0, qtySrc: this._base.getAvailableScientists(), qtyDst: 0, amount: 0 });
    }
    if (this._base.getAvailableEngineers() > 0) {
      this.addSellRow({ type: TransferType.TRANSFER_ENGINEER, rule: null, name: String(this.tr("STR_ENGINEER")), cost: 0, qtySrc: this._base.getAvailableEngineers(), qtyDst: 0, amount: 0 });
    }
    for (const type of mod?.getItemsList() || []) {
      let qty = this._base.getStorageItems().getItem(type);
      if (Options.storageLimitsEnforced && this._origin === OPT_BATTLESCAPE) {
        for (const transfer of this._base.getTransfers()) {
          if (transfer.getItems() === type) {
            qty += transfer.getQuantity();
          }
        }
        for (const craft of this._base.getCrafts()) {
          qty += craft.getItems().getItem(type);
        }
      }
      const rule = mod?.getItem(type, true);
      if (rule && qty > 0 && (Options.canSellLiveAliens || !rule.isAlien())) {
        this.addSellRow({ type: TransferType.TRANSFER_ITEM, rule, name: String(this.tr(type)), cost: rule.getSellCost(), qtySrc: qty, qtyDst: 0, amount: 0 });
      }
    }
  }

  private addSellRow(row: TransferRow): void {
    this._items.push(row);
    const cat = this.getCategory(this._items.length - 1);
    if (!this._cats.includes(cat)) {
      this._cats.push(cat);
    }
  }

  private removeSoldItems(item: RuleItem, amount: number): void {
    if (this._base.getStorageItems().getItem(item.getType()) < amount) {
      let toRemove = amount - this._base.getStorageItems().getItem(item.getType());
      this._base.getStorageItems().removeItem(item.getType(), INT_MAX);

      for (const craft of this._base.getCrafts()) {
        if (toRemove <= 0) {
          break;
        }
        const craftQty = craft.getItems().getItem(item.getType());
        if (craftQty < toRemove) {
          toRemove -= craftQty;
          craft.getItems().removeItem(item.getType(), INT_MAX);
        } else {
          craft.getItems().removeItem(item.getType(), toRemove);
          toRemove = 0;
        }
      }

      for (let i = 0; i < this._base.getTransfers().length && toRemove > 0;) {
        const transfer = this._base.getTransfers()[i];
        if (transfer.getItems() === item.getType()) {
          if (transfer.getQuantity() <= toRemove) {
            toRemove -= transfer.getQuantity();
            this._base.getTransfers().splice(i, 1);
          } else {
            transfer.setItems(transfer.getItems(), transfer.getQuantity() - toRemove);
            toRemove = 0;
          }
        } else {
          ++i;
        }
      }
    } else {
      this._base.getStorageItems().removeItem(item.getType(), amount);
    }
  }

  private getRow(): TransferRow {
    return this._items[this._rows[this._sel]];
  }
}
