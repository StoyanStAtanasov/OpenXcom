import type { Action } from "../Engine/Action.ts";
import { Options } from "../Engine/Options.ts";
import { State } from "../Engine/State.ts";
import { Text } from "../Interface/Text.ts";
import { TextButton } from "../Interface/TextButton.ts";
import { TextList } from "../Interface/TextList.ts";
import { Window } from "../Interface/Window.ts";
import { Armor } from "../Mod/Armor.ts";
import { INT_MAX } from "../Mod/RuleInterface.ts";
import type { Base } from "../Savegame/Base.ts";
import { SDL_BUTTON_LEFT, SDL_BUTTON_RIGHT } from "../types.ts";
import { SoldierArmorState } from "./SoldierArmorState.ts";

/**
 * Select Armor screen that lets the player pick armor for the soldiers on the craft.
 */
export class CraftArmorState extends State {
  private _btnOk: TextButton;
  private _window: Window;
  private _txtTitle: Text;
  private _txtName: Text;
  private _txtCraft: Text;
  private _txtArmor: Text;
  private _lstSoldiers: TextList;

  constructor(private _base: Base, private _craft: number) {
    super();

    this._window = new Window(this, 320, 200, 0, 0);
    this._btnOk = new TextButton(288, 16, 16, 176);
    this._txtTitle = new Text(300, 17, 16, 7);
    this._txtName = new Text(114, 9, 16, 32);
    this._txtCraft = new Text(76, 9, 130, 32);
    this._txtArmor = new Text(100, 9, 199, 32);
    this._lstSoldiers = new TextList(292, 128, 8, 40);

    this.setInterface("craftArmor");

    this.add(this._window, "window", "craftArmor");
    this.add(this._btnOk, "button", "craftArmor");
    this.add(this._txtTitle, "text", "craftArmor");
    this.add(this._txtName, "text", "craftArmor");
    this.add(this._txtCraft, "text", "craftArmor");
    this.add(this._txtArmor, "text", "craftArmor");
    this.add(this._lstSoldiers, "list", "craftArmor");

    this.centerAllSurfaces();

    const back14 = this.game().getMod()?.getSurface("BACK14.SCR");
    if (back14) {
      this._window.setBackground(back14);
    }

    this._btnOk.setText(String(this.tr("STR_OK")));
    this._btnOk.onMouseClick(this.btnOkClick.bind(this));
    this._btnOk.onKeyboardPress(this.btnOkClick.bind(this), Options.keyCancel);

    this._txtTitle.setBig();
    this._txtTitle.setText(String(this.tr("STR_SELECT_ARMOR")));

    this._txtName.setText(String(this.tr("STR_NAME_UC")));
    this._txtCraft.setText(String(this.tr("STR_CRAFT")));
    this._txtArmor.setText(String(this.tr("STR_ARMOR")));

    this._lstSoldiers.setColumns(3, 114, 69, 101);
    this._lstSoldiers.setSelectable(true);
    this._lstSoldiers.setBackground(this._window);
    this._lstSoldiers.setMargin(8);
    this._lstSoldiers.setScrolling(true, 0);
    this._lstSoldiers.onMousePress(this.lstSoldiersClick.bind(this));

    const otherCraftColor = this.elementColor("otherCraft", this._lstSoldiers.getColor());
    let row = 0;
    const craft = this._base.getCrafts()[this._craft];
    for (const soldier of this._base.getSoldiers()) {
      this._lstSoldiers.addRow(
        3,
        soldier.getName(true),
        soldier.getCraftString(this.game().getLanguage()),
        String(this.tr(soldier.getArmor()?.getType() || ""))
      );

      let color: number;
      if (soldier.getCraft() === craft) {
        color = this._lstSoldiers.getSecondaryColor();
      } else if (soldier.getCraft() !== null) {
        color = otherCraftColor;
      } else {
        color = this._lstSoldiers.getColor();
      }
      this._lstSoldiers.setRowColor(row, color);
      row++;
    }
  }

  /**
   * The soldier armors can change after going into other screens.
   */
  override init(): void {
    super.init();
    let row = 0;
    for (const soldier of this._base.getSoldiers()) {
      this._lstSoldiers.setCellText(row, 2, String(this.tr(soldier.getArmor()?.getType() || "")));
      row++;
    }
  }

  /**
   * Returns to the previous screen.
   */
  btnOkClick(_action?: Action): void {
    this.game().popState();
  }

  /**
   * Shows the Select Armor window.
   */
  lstSoldiersClick(action: Action): void {
    const row = this._lstSoldiers.getSelectedRow();
    const soldier = this._base.getSoldiers()[row];
    if (row < 0 || !soldier) {
      return;
    }

    if (!(soldier.getCraft() && soldier.getCraft()?.getStatus() === "STR_OUT")) {
      if (action.getDetails().button?.button === SDL_BUTTON_LEFT) {
        this.game().pushState(new SoldierArmorState(this._base, row));
      } else if (action.getDetails().button?.button === SDL_BUTTON_RIGHT) {
        const save = this.game().getSavedGame();
        const armor = this.game().getMod()?.getArmor(save?.getLastSelectedArmor() || "") || null;
        if (armor && (armor.getUnits().length === 0 || armor.getUnits().includes(soldier.getRules().getType()))) {
          if ((save?.getMonthsPassed() ?? -1) !== -1) {
            if (this._base.getStorageItems().getItem(armor.getStoreItem()) > 0 || armor.getStoreItem() === Armor.NONE) {
              const oldStoreItem = soldier.getArmor()?.getStoreItem() || Armor.NONE;
              if (oldStoreItem !== Armor.NONE) {
                this._base.getStorageItems().addItem(oldStoreItem);
              }
              if (armor.getStoreItem() !== Armor.NONE) {
                this._base.getStorageItems().removeItem(armor.getStoreItem());
              }

              soldier.setArmor(armor);
              this._lstSoldiers.setCellText(row, 2, String(this.tr(armor.getType())));
            }
          } else {
            soldier.setArmor(armor);
            this._lstSoldiers.setCellText(row, 2, String(this.tr(armor.getType())));
          }
        }
      }
    }
  }

  private elementColor(id: string, fallback: number): number {
    const color = this.game().getMod()?.getInterface("craftArmor")?.getElement(id)?.color;
    return color != null && color !== INT_MAX ? color : fallback;
  }
}
