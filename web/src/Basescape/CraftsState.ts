import type { Action } from "../Engine/Action.ts";
import { Options } from "../Engine/Options.ts";
import { State } from "../Engine/State.ts";
import { Text } from "../Interface/Text.ts";
import { TextButton } from "../Interface/TextButton.ts";
import { TextList } from "../Interface/TextList.ts";
import { Window } from "../Interface/Window.ts";
import { ErrorMessageState } from "../Menu/ErrorMessageState.ts";
import type { Base } from "../Savegame/Base.ts";
import { CraftInfoState } from "./CraftInfoState.ts";
import { SellState } from "./SellState.ts";

/**
 * Equip Craft screen that lets the player manage all the crafts in a base.
 */
export class CraftsState extends State {
  private _btnOk: TextButton;
  private _window: Window;
  private _txtTitle: Text;
  private _txtBase: Text;
  private _txtName: Text;
  private _txtStatus: Text;
  private _txtWeapon: Text;
  private _txtCrew: Text;
  private _txtHwp: Text;
  private _lstCrafts: TextList;

  constructor(private _base: Base) {
    super();

    this._window = new Window(this, 320, 200, 0, 0);
    this._btnOk = new TextButton(288, 16, 16, 176);
    this._txtTitle = new Text(298, 17, 16, 8);
    this._txtBase = new Text(298, 17, 16, 24);
    this._txtName = new Text(94, 9, 16, 40);
    this._txtStatus = new Text(50, 9, 110, 40);
    this._txtWeapon = new Text(50, 17, 160, 40);
    this._txtCrew = new Text(58, 9, 210, 40);
    this._txtHwp = new Text(46, 9, 268, 40);
    this._lstCrafts = new TextList(288, 118, 8, 58);

    this.setInterface("craftSelect");

    this.add(this._window, "window", "craftSelect");
    this.add(this._btnOk, "button", "craftSelect");
    this.add(this._txtTitle, "text", "craftSelect");
    this.add(this._txtBase, "text", "craftSelect");
    this.add(this._txtName, "text", "craftSelect");
    this.add(this._txtStatus, "text", "craftSelect");
    this.add(this._txtWeapon, "text", "craftSelect");
    this.add(this._txtCrew, "text", "craftSelect");
    this.add(this._txtHwp, "text", "craftSelect");
    this.add(this._lstCrafts, "list", "craftSelect");

    this.centerAllSurfaces();

    const back14 = this.game().getMod()?.getSurface("BACK14.SCR");
    if (back14) {
      this._window.setBackground(back14);
    }

    this._btnOk.setText(String(this.tr("STR_OK")));
    this._btnOk.onMouseClick(this.btnOkClick.bind(this));
    this._btnOk.onKeyboardPress(this.btnOkClick.bind(this), Options.keyCancel);

    this._txtTitle.setBig();
    this._txtTitle.setText(String(this.tr("STR_INTERCEPTION_CRAFT")));

    this._txtBase.setBig();
    this._txtBase.setText(String(this.tr("STR_BASE_").arg(this._base.getName())));

    this._txtName.setText(String(this.tr("STR_NAME_UC")));
    this._txtStatus.setText(String(this.tr("STR_STATUS")));
    this._txtWeapon.setText(String(this.tr("STR_WEAPON_SYSTEMS")));
    this._txtWeapon.setWordWrap(true);
    this._txtCrew.setText(String(this.tr("STR_CREW")));
    this._txtHwp.setText(String(this.tr("STR_HWPS")));

    this._lstCrafts.setColumns(5, 94, 68, 44, 46, 28);
    this._lstCrafts.setSelectable(true);
    this._lstCrafts.setBackground(this._window);
    this._lstCrafts.setMargin(8);
    this._lstCrafts.onMouseClick(this.lstCraftsClick.bind(this));
  }

  /**
   * The soldier names can change after going into other screens.
   */
  override init(): void {
    super.init();
    this._lstCrafts.clearList();
    for (const craft of this._base.getCrafts()) {
      const weapons = `${craft.getNumWeapons()}/${craft.getRules().getWeapons()}`;
      const soldiers = `${craft.getNumSoldiers()}`;
      const vehicles = `${craft.getNumVehicles()}`;
      this._lstCrafts.addRow(
        5,
        craft.getName(this.game().getLanguage()),
        String(this.tr(craft.getStatus())),
        weapons,
        soldiers,
        vehicles
      );
    }
  }

  /**
   * Returns to the previous screen.
   */
  btnOkClick(_action?: Action): void {
    this.game().popState();

    if ((this.game().getSavedGame()?.getMonthsPassed() ?? -1) > -1 && Options.storageLimitsEnforced && this._base.storesOverfull()) {
      const menuInterface = this.game().getMod()?.getInterface("craftSelect");
      this.game().pushState(new SellState(this._base));
      this.game().pushState(new ErrorMessageState(
        String(this.tr("STR_STORAGE_EXCEEDED").arg(this._base.getName())),
        this._palette,
        menuInterface?.getElement("errorMessage")?.color || 1,
        "BACK01.SCR",
        menuInterface?.getElement("errorPalette")?.color ?? -1
      ));
    }
  }

  /**
   * Shows the selected craft's info.
   */
  lstCraftsClick(_action?: Action): void {
    const row = this._lstCrafts.getSelectedRow();
    const craft = row >= 0 ? this._base.getCrafts()[row] : null;
    if (craft && craft.getStatus() !== "STR_OUT") {
      this.game().pushState(new CraftInfoState(this._base, row));
    }
  }
}
