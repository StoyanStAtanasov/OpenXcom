import type { Action } from "../Engine/Action.ts";
import { Options } from "../Engine/Options.ts";
import { ALIGN_CENTER, Text } from "../Interface/Text.ts";
import { TextButton } from "../Interface/TextButton.ts";
import { TextList } from "../Interface/TextList.ts";
import { POPUP_BOTH, Window } from "../Interface/Window.ts";
import { Armor } from "../Mod/Armor.ts";
import type { Base } from "../Savegame/Base.ts";
import { State } from "../Engine/State.ts";

export class SoldierArmorState extends State {
  private _btnCancel: TextButton;
  private _window: Window;
  private _txtTitle: Text;
  private _txtType: Text;
  private _txtQuantity: Text;
  private _lstArmor: TextList;
  private _armors: Armor[] = [];

  constructor(private _base: Base, private _soldier: number) {
    super();
    this._screen = false;

    this._window = new Window(this, 192, 160, 64, 20, POPUP_BOTH);
    this._btnCancel = new TextButton(140, 16, 90, 156);
    this._txtTitle = new Text(182, 16, 69, 28);
    this._txtType = new Text(90, 9, 80, 52);
    this._txtQuantity = new Text(70, 9, 190, 52);
    this._lstArmor = new TextList(160, 80, 73, 68);

    this.setInterface("soldierArmor");

    this.add(this._window, "window", "soldierArmor");
    this.add(this._btnCancel, "button", "soldierArmor");
    this.add(this._txtTitle, "text", "soldierArmor");
    this.add(this._txtType, "text", "soldierArmor");
    this.add(this._txtQuantity, "text", "soldierArmor");
    this.add(this._lstArmor, "list", "soldierArmor");

    this.centerAllSurfaces();

    const back14 = this.game().getMod()?.getSurface("BACK14.SCR");
    if (back14) {
      this._window.setBackground(back14);
    }

    this._btnCancel.setText(String(this.tr("STR_CANCEL_UC")));
    this._btnCancel.onMouseClick(this.btnCancelClick.bind(this));
    this._btnCancel.onKeyboardPress(this.btnCancelClick.bind(this), Options.keyCancel);

    const soldier = this._base.getSoldiers()[this._soldier];
    this._txtTitle.setAlign(ALIGN_CENTER);
    this._txtTitle.setText(String(this.tr("STR_SELECT_ARMOR_FOR_SOLDIER").arg(soldier?.getName() || "")));

    this._txtType.setText(String(this.tr("STR_TYPE")));
    this._txtQuantity.setText(String(this.tr("STR_QUANTITY_UC")));

    this._lstArmor.setColumns(2, 132, 21);
    this._lstArmor.setSelectable(true);
    this._lstArmor.setBackground(this._window);
    this._lstArmor.setMargin(8);

    this.populateArmorRows();
    this._lstArmor.onMouseClick(this.lstArmorClick.bind(this));
  }

  btnCancelClick(_action?: Action): void {
    this.game().popState();
  }

  lstArmorClick(_action?: Action): void {
    const row = this._lstArmor.getSelectedRow();
    if (row < 0 || row >= this._armors.length) {
      return;
    }
    const soldier = this._base.getSoldiers()[this._soldier];
    const armor = this._armors[row];
    if (!soldier || !armor) {
      return;
    }

    const save = this.game().getSavedGame();
    if ((save?.getMonthsPassed() ?? -1) !== -1) {
      const oldStoreItem = soldier.getArmor()?.getStoreItem() || Armor.NONE;
      if (oldStoreItem !== Armor.NONE) {
        this._base.getStorageItems().addItem(oldStoreItem);
      }
      if (armor.getStoreItem() !== Armor.NONE) {
        this._base.getStorageItems().removeItem(armor.getStoreItem());
      }
    }

    soldier.setArmor(armor);
    save?.setLastSelectedArmor(armor.getType());
    this.game().popState();
  }

  private populateArmorRows(): void {
    const mod = this.game().getMod();
    const soldier = this._base.getSoldiers()[this._soldier];
    if (!mod || !soldier) {
      return;
    }

    for (const type of mod.getArmorsList()) {
      const armor = mod.getArmor(type);
      if (!armor) {
        continue;
      }

      const units = armor.getUnits();
      if (units.length > 0 && !units.includes(soldier.getRules().getType())) {
        continue;
      }

      const storeItem = armor.getStoreItem();
      const quantity = this._base.getStorageItems().getItem(storeItem);
      if (quantity > 0) {
        this._armors.push(armor);
        const quantityText = (this.game().getSavedGame()?.getMonthsPassed() ?? -1) > -1 ? String(quantity) : "-";
        this._lstArmor.addRow(2, String(this.tr(armor.getType())), quantityText);
      } else if (storeItem === Armor.NONE) {
        this._armors.push(armor);
        this._lstArmor.addRow(1, String(this.tr(armor.getType())));
      }
    }
  }
}
