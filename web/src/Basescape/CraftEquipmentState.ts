import type { Action } from "../Engine/Action.ts";
import { Options } from "../Engine/Options.ts";
import { State } from "../Engine/State.ts";
import { Timer } from "../Engine/Timer.ts";
import { TOK_COLOR_FLIP } from "../Engine/Unicode.ts";
import { BattlescapeGenerator } from "../Battlescape/BattlescapeGenerator.ts";
import { InventoryState } from "../Battlescape/InventoryState.ts";
import { Text } from "../Interface/Text.ts";
import { TextButton } from "../Interface/TextButton.ts";
import { ARROW_HORIZONTAL, TextList } from "../Interface/TextList.ts";
import { Window } from "../Interface/Window.ts";
import { ErrorMessageState } from "../Menu/ErrorMessageState.ts";
import { BattleType, type RuleItem } from "../Mod/RuleItem.ts";
import { INT_MAX } from "../Mod/RuleInterface.ts";
import type { Base } from "../Savegame/Base.ts";
import type { Craft } from "../Savegame/Craft.ts";
import { SavedBattleGame } from "../Savegame/SavedBattleGame.ts";
import { Vehicle } from "../Savegame/Vehicle.ts";
import { SDL_BUTTON_LEFT, SDL_BUTTON_RIGHT, SDL_BUTTON_WHEELDOWN, SDL_BUTTON_WHEELUP } from "../types.ts";

/**
 * Equipment screen that lets the player pick the equipment to carry on a craft.
 */
export class CraftEquipmentState extends State {
  private _btnOk: TextButton;
  private _btnClear: TextButton;
  private _btnInventory: TextButton;
  private _window: Window;
  private _txtTitle: Text;
  private _txtItem: Text;
  private _txtStores: Text;
  private _txtAvailable: Text;
  private _txtUsed: Text;
  private _txtCrew: Text;
  private _lstEquipment: TextList;
  private _timerLeft: Timer;
  private _timerRight: Timer;
  private _sel = 0;
  private _items: string[] = [];
  private _totalItems = 0;
  private _ammoColor = 0;

  constructor(private _base: Base, private _craft: number) {
    super();
    const craft = this._base.getCrafts()[this._craft];
    const craftHasACrew = (craft?.getNumSoldiers() || 0) > 0;
    const isNewBattle = (this.game().getSavedGame()?.getMonthsPassed() ?? -1) === -1;

    this._window = new Window(this, 320, 200, 0, 0);
    this._btnOk = new TextButton((craftHasACrew || isNewBattle) ? 148 : 288, 16, (craftHasACrew || isNewBattle) ? 164 : 16, 176);
    this._btnClear = new TextButton(148, 16, 8, 176);
    this._btnInventory = new TextButton(148, 16, 8, 176);
    this._txtTitle = new Text(300, 17, 16, 7);
    this._txtItem = new Text(144, 9, 16, 32);
    this._txtStores = new Text(150, 9, 160, 32);
    this._txtAvailable = new Text(110, 9, 16, 24);
    this._txtUsed = new Text(110, 9, 130, 24);
    this._txtCrew = new Text(71, 9, 244, 24);
    this._lstEquipment = new TextList(288, 128, 8, 40);

    this.setInterface("craftEquipment");

    this._ammoColor = this.elementColor("ammoColor", this._lstEquipment.getColor());

    this.add(this._window, "window", "craftEquipment");
    this.add(this._btnOk, "button", "craftEquipment");
    this.add(this._btnClear, "button", "craftEquipment");
    this.add(this._btnInventory, "button", "craftEquipment");
    this.add(this._txtTitle, "text", "craftEquipment");
    this.add(this._txtItem, "text", "craftEquipment");
    this.add(this._txtStores, "text", "craftEquipment");
    this.add(this._txtAvailable, "text", "craftEquipment");
    this.add(this._txtUsed, "text", "craftEquipment");
    this.add(this._txtCrew, "text", "craftEquipment");
    this.add(this._lstEquipment, "list", "craftEquipment");

    this.centerAllSurfaces();

    const back04 = this.game().getMod()?.getSurface("BACK04.SCR");
    if (back04) {
      this._window.setBackground(back04);
    }

    this._btnOk.setText(String(this.tr("STR_OK")));
    this._btnOk.onMouseClick(this.btnOkClick.bind(this));
    this._btnOk.onKeyboardPress(this.btnOkClick.bind(this), Options.keyCancel);

    this._btnClear.setText(String(this.tr("STR_UNLOAD_CRAFT")));
    this._btnClear.onMouseClick(this.btnClearClick.bind(this));
    this._btnClear.setVisible(isNewBattle);

    this._btnInventory.setText(String(this.tr("STR_INVENTORY")));
    this._btnInventory.onMouseClick(this.btnInventoryClick.bind(this));
    this._btnInventory.setVisible(craftHasACrew && !isNewBattle);

    this._txtTitle.setBig();
    this._txtTitle.setText(String(this.tr("STR_EQUIPMENT_FOR_CRAFT").arg(craft?.getName(this.game().getLanguage()) || "")));

    this._txtItem.setText(String(this.tr("STR_ITEM")));
    this._txtStores.setText(String(this.tr("STR_STORES")));
    this._txtAvailable.setText(String(this.tr("STR_SPACE_AVAILABLE").arg(craft ? craft.getSpaceAvailable() : 0)));
    this._txtUsed.setText(String(this.tr("STR_SPACE_USED").arg(craft ? craft.getSpaceUsed() : 0)));
    this._txtCrew.setText(`${String(this.tr("STR_SOLDIERS_UC"))}>${String.fromCharCode(TOK_COLOR_FLIP)}${craft?.getNumSoldiers() || 0}`);

    this._lstEquipment.setArrowColumn(203, ARROW_HORIZONTAL);
    this._lstEquipment.setColumns(3, 156, 83, 41);
    this._lstEquipment.setSelectable(true);
    this._lstEquipment.setBackground(this._window);
    this._lstEquipment.setMargin(8);
    this._lstEquipment.onLeftArrowPress(this.lstEquipmentLeftArrowPress.bind(this));
    this._lstEquipment.onLeftArrowRelease(this.lstEquipmentLeftArrowRelease.bind(this));
    this._lstEquipment.onLeftArrowClick(this.lstEquipmentLeftArrowClick.bind(this));
    this._lstEquipment.onRightArrowPress(this.lstEquipmentRightArrowPress.bind(this));
    this._lstEquipment.onRightArrowRelease(this.lstEquipmentRightArrowRelease.bind(this));
    this._lstEquipment.onRightArrowClick(this.lstEquipmentRightArrowClick.bind(this));
    this._lstEquipment.onMousePress(this.lstEquipmentMousePress.bind(this));

    this.populateEquipmentRows(craft || null);

    this._timerLeft = new Timer(250);
    this._timerLeft.onTimer(this.moveLeft.bind(this));
    this._timerRight = new Timer(250);
    this._timerRight.onTimer(this.moveRight.bind(this));
  }

  /**
   * Resets the savegame when coming back from the inventory.
   */
  override init(): void {
    super.init();

    this.game().getSavedGame()?.setSavedBattle(null);
    const craft = this._base.getCrafts()[this._craft];
    craft?.setInBattlescape(false);
  }

  /**
   * Runs the arrow timers.
   */
  override think(): void {
    super.think();

    this._timerLeft.think(this, null);
    this._timerRight.think(this, null);
  }

  /**
   * Returns to the previous screen.
   */
  btnOkClick(_action?: Action): void {
    this.game().popState();
  }

  /**
   * Starts moving the item to the base.
   */
  lstEquipmentLeftArrowPress(action: Action): void {
    this._sel = this._lstEquipment.getSelectedRow();
    if (action.getDetails().button?.button === SDL_BUTTON_LEFT && !this._timerLeft.isRunning()) {
      this._timerLeft.start();
    }
  }

  /**
   * Stops moving the item to the base.
   */
  lstEquipmentLeftArrowRelease(action: Action): void {
    if (action.getDetails().button?.button === SDL_BUTTON_LEFT) {
      this._timerLeft.stop();
    }
  }

  /**
   * Moves all the items to the base on right-click.
   */
  lstEquipmentLeftArrowClick(action: Action): void {
    if (action.getDetails().button?.button === SDL_BUTTON_RIGHT) {
      this.moveLeftByValue(INT_MAX);
    }
    if (action.getDetails().button?.button === SDL_BUTTON_LEFT) {
      this.moveLeftByValue(1);
      this._timerRight.setInterval(250);
      this._timerLeft.setInterval(250);
    }
  }

  /**
   * Starts moving the item to the craft.
   */
  lstEquipmentRightArrowPress(action: Action): void {
    this._sel = this._lstEquipment.getSelectedRow();
    if (action.getDetails().button?.button === SDL_BUTTON_LEFT && !this._timerRight.isRunning()) {
      this._timerRight.start();
    }
  }

  /**
   * Stops moving the item to the craft.
   */
  lstEquipmentRightArrowRelease(action: Action): void {
    if (action.getDetails().button?.button === SDL_BUTTON_LEFT) {
      this._timerRight.stop();
    }
  }

  /**
   * Moves all the items as much as possible to the craft on right-click.
   */
  lstEquipmentRightArrowClick(action: Action): void {
    if (action.getDetails().button?.button === SDL_BUTTON_RIGHT) {
      this.moveRightByValue(INT_MAX);
    }
    if (action.getDetails().button?.button === SDL_BUTTON_LEFT) {
      this.moveRightByValue(1);
      this._timerRight.setInterval(250);
      this._timerLeft.setInterval(250);
    }
  }

  /**
   * Handles the mouse-wheels on the arrow-buttons.
   */
  lstEquipmentMousePress(action: Action): void {
    this._sel = this._lstEquipment.getSelectedRow();
    if (action.getDetails().button?.button === SDL_BUTTON_WHEELUP) {
      this._timerRight.stop();
      this._timerLeft.stop();
      if (action.getAbsoluteXMouse() >= this._lstEquipment.getArrowsLeftEdge() &&
        action.getAbsoluteXMouse() <= this._lstEquipment.getArrowsRightEdge()) {
        this.moveRightByValue(Options.changeValueByMouseWheel);
      }
    } else if (action.getDetails().button?.button === SDL_BUTTON_WHEELDOWN) {
      this._timerRight.stop();
      this._timerLeft.stop();
      if (action.getAbsoluteXMouse() >= this._lstEquipment.getArrowsLeftEdge() &&
        action.getAbsoluteXMouse() <= this._lstEquipment.getArrowsRightEdge()) {
        this.moveLeftByValue(Options.changeValueByMouseWheel);
      }
    }
  }

  /**
   * Moves the selected item to the base.
   */
  moveLeft(): void {
    this._timerLeft.setInterval(50);
    this._timerRight.setInterval(50);
    this.moveLeftByValue(1);
  }

  /**
   * Moves the given number of selected items to the base.
   */
  moveLeftByValue(change: number): void {
    const craft = this._base.getCrafts()[this._craft];
    const type = this._items[this._sel];
    const item = this.itemForSelection();
    if (!craft || !type || !item) {
      return;
    }

    let cQty = 0;
    if (item.isFixed()) {
      cQty = craft.getVehicleCount(type);
    } else {
      cQty = craft.getItems().getItem(type);
    }
    if (change <= 0 || cQty <= 0) {
      return;
    }
    change = Math.min(cQty, change);
    const monthsPassed = this.game().getSavedGame()?.getMonthsPassed() ?? -1;

    if (item.isFixed()) {
      if (item.getCompatibleAmmo().length > 0) {
        const ammo = this.game().getMod()?.getItem(item.getCompatibleAmmo()[0], true);
        if (!ammo) {
          return;
        }
        let ammoPerVehicle: number;
        if (ammo.getClipSize() > 0 && item.getClipSize() > 0) {
          ammoPerVehicle = Math.trunc(item.getClipSize() / ammo.getClipSize());
        } else {
          ammoPerVehicle = ammo.getClipSize();
        }
        if (monthsPassed !== -1) {
          this._base.getStorageItems().addItem(type, change);
          this._base.getStorageItems().addItem(ammo.getType(), ammoPerVehicle * change);
        }
        this.removeVehicles(craft.getVehicles(), item, change);
      } else {
        if (monthsPassed !== -1) {
          this._base.getStorageItems().addItem(type, change);
        }
        this.removeVehicles(craft.getVehicles(), item, change);
      }
    } else {
      craft.getItems().removeItem(type, change);
      this._totalItems -= change;
      if (monthsPassed > -1) {
        this._base.getStorageItems().addItem(type, change);
      }
    }
    this.updateQuantity();
  }

  /**
   * Moves the selected item to the craft.
   */
  moveRight(): void {
    this._timerLeft.setInterval(50);
    this._timerRight.setInterval(50);
    this.moveRightByValue(1);
  }

  /**
   * Moves the given number of selected items to the craft.
   */
  moveRightByValue(change: number): void {
    const craft = this._base.getCrafts()[this._craft];
    const type = this._items[this._sel];
    const item = this.itemForSelection();
    if (!craft || !type || !item) {
      return;
    }

    let bqty = this._base.getStorageItems().getItem(type);
    const monthsPassed = this.game().getSavedGame()?.getMonthsPassed() ?? -1;
    if (monthsPassed === -1) {
      if (change === INT_MAX) {
        change = 10;
      }
      bqty = change;
    }
    if (0 >= change || 0 >= bqty) {
      return;
    }
    change = Math.min(bqty, change);

    if (item.isFixed()) {
      let size = 4;
      const unit = this.game().getMod()?.getUnit(item.getType());
      const armor = unit ? this.game().getMod()?.getArmor(unit.getArmor()) : null;
      if (armor) {
        size = armor.getSize();
        size *= size;
      }

      const room = Math.min(craft.getRules().getVehicles() - craft.getNumVehicles(), Math.trunc(craft.getSpaceAvailable() / size));
      if (room > 0) {
        change = Math.min(room, change);
        if (item.getCompatibleAmmo().length > 0) {
          const ammo = this.game().getMod()?.getItem(item.getCompatibleAmmo()[0], true);
          if (!ammo) {
            return;
          }
          let ammoPerVehicle: number;
          let clipSize: number;
          if (ammo.getClipSize() > 0 && item.getClipSize() > 0) {
            clipSize = item.getClipSize();
            ammoPerVehicle = Math.trunc(clipSize / ammo.getClipSize());
          } else {
            clipSize = ammo.getClipSize();
            ammoPerVehicle = clipSize;
          }

          let baseQty = Math.trunc(this._base.getStorageItems().getItem(ammo.getType()) / ammoPerVehicle);
          if (monthsPassed === -1) {
            baseQty = change;
          }
          const canBeAdded = Math.min(change, baseQty);
          if (canBeAdded > 0) {
            for (let i = 0; i < canBeAdded; ++i) {
              if (monthsPassed !== -1) {
                this._base.getStorageItems().removeItem(ammo.getType(), ammoPerVehicle);
                this._base.getStorageItems().removeItem(type);
              }
              craft.getVehicles().push(new Vehicle(item, clipSize, size));
            }
          } else {
            this._timerRight.stop();
            const msg = String(this.tr("STR_NOT_ENOUGH_AMMO_TO_ARM_HWP").arg(ammoPerVehicle).arg(this.tr(ammo.getType())));
            this.pushEquipmentError(msg);
          }
        } else {
          for (let i = 0; i < change; ++i) {
            craft.getVehicles().push(new Vehicle(item, item.getClipSize(), size));
            if (monthsPassed !== -1) {
              this._base.getStorageItems().removeItem(type);
            }
          }
        }
      }
    } else {
      const maxItems = craft.getRules().getMaxItems();
      if (maxItems > 0 && this._totalItems + change > maxItems) {
        this._timerRight.stop();
        const msg = String(this.tr("STR_NO_MORE_EQUIPMENT_ALLOWED", maxItems));
        this.pushEquipmentError(msg);
        change = maxItems - this._totalItems;
      }
      craft.getItems().addItem(type, change);
      this._totalItems += change;
      if (monthsPassed > -1) {
        this._base.getStorageItems().removeItem(type, change);
      }
    }
    this.updateQuantity();
  }

  /**
   * Empties the contents of the craft, moving all of the items back to the base.
   */
  btnClearClick(_action?: Action): void {
    for (this._sel = 0; this._sel !== this._items.length; ++this._sel) {
      this.moveLeftByValue(INT_MAX);
    }
  }

  /**
   * Displays the inventory screen for the soldiers inside the craft.
   */
  btnInventoryClick(_action?: Action): void {
    const craft = this._base.getCrafts()[this._craft];
    if (!craft || craft.getNumSoldiers() === 0) {
      return;
    }

    const bgame = new SavedBattleGame();
    this.game().getSavedGame()?.setSavedBattle(bgame);
    const bgen = new BattlescapeGenerator(bgame, this.game().getMod());
    bgen.runInventory(craft);

    this.game().getScreen().clear();
    this.game().pushState(new InventoryState(false, null));
  }

  /**
   * Updates the displayed quantities of the selected item on the list.
   */
  private updateQuantity(): void {
    const craft = this._base.getCrafts()[this._craft];
    const type = this._items[this._sel];
    const item = this.itemForSelection();
    if (!craft || !type || !item) {
      return;
    }

    let cQty = 0;
    if (item.isFixed()) {
      cQty = craft.getVehicleCount(type);
    } else {
      cQty = craft.getItems().getItem(type);
    }

    const storageText = (this.game().getSavedGame()?.getMonthsPassed() ?? -1) > -1
      ? `${this._base.getStorageItems().getItem(type)}`
      : "-";
    const craftText = `${cQty}`;

    let color: number;
    if (cQty === 0) {
      if (item.getBattleType() === BattleType.BT_AMMO) {
        color = this._ammoColor;
      } else {
        color = this._lstEquipment.getColor();
      }
    } else {
      color = this._lstEquipment.getSecondaryColor();
    }
    this._lstEquipment.setRowColor(this._sel, color);
    this._lstEquipment.setCellText(this._sel, 1, storageText);
    this._lstEquipment.setCellText(this._sel, 2, craftText);

    this._txtAvailable.setText(String(this.tr("STR_SPACE_AVAILABLE").arg(craft.getSpaceAvailable())));
    this._txtUsed.setText(String(this.tr("STR_SPACE_USED").arg(craft.getSpaceUsed())));
  }

  private populateEquipmentRows(craft: Craft | null): void {
    if (!craft) {
      return;
    }
    const mod = this.game().getMod();
    const save = this.game().getSavedGame();
    let row = 0;
    for (const type of mod?.getItemsList() || []) {
      const rule = mod?.getItem(type);
      if (!rule) {
        continue;
      }

      let cQty = 0;
      if (rule.isFixed()) {
        cQty = craft.getVehicleCount(type);
      } else {
        cQty = craft.getItems().getItem(type);
        this._totalItems += cQty;
      }
      if (rule.getBigSprite() > -1 &&
        rule.getBattleType() !== BattleType.BT_NONE &&
        rule.getBattleType() !== BattleType.BT_CORPSE &&
        Boolean(save?.isResearched(rule.getRequirements())) &&
        (this._base.getStorageItems().getItem(type) > 0 || cQty > 0)) {
        this._items.push(type);
        const storageText = (save?.getMonthsPassed() ?? -1) > -1 ? `${this._base.getStorageItems().getItem(type)}` : "-";
        const craftText = `${cQty}`;
        let name = String(this.tr(type));
        if (rule.getBattleType() === BattleType.BT_AMMO) {
          name = `  ${name}`;
        }
        this._lstEquipment.addRow(3, name, storageText, craftText);

        let color: number;
        if (cQty === 0) {
          if (rule.getBattleType() === BattleType.BT_AMMO) {
            color = this._ammoColor;
          } else {
            color = this._lstEquipment.getColor();
          }
        } else {
          color = this._lstEquipment.getSecondaryColor();
        }
        this._lstEquipment.setRowColor(row, color);

        ++row;
      }
    }
  }

  private itemForSelection(): RuleItem | null {
    const type = this._items[this._sel];
    return type ? this.game().getMod()?.getItem(type, true) || null : null;
  }

  private removeVehicles(vehicles: Vehicle[], item: RuleItem, change: number): void {
    for (let i = 0; i < vehicles.length && change > 0;) {
      if (vehicles[i].getRules() === item) {
        vehicles.splice(i, 1);
        --change;
      } else {
        ++i;
      }
    }
  }

  private pushEquipmentError(msg: string): void {
    this.game().pushState(new ErrorMessageState(
      msg,
      this._palette,
      this.elementColor("errorMessage", this._lstEquipment.getColor()),
      "BACK04.SCR",
      this.elementColor("errorPalette", -1)
    ));
  }

  private elementColor(id: string, fallback: number): number {
    const color = this.game().getMod()?.getInterface("craftEquipment")?.getElement(id)?.color;
    return color != null && color !== INT_MAX ? color : fallback;
  }
}
