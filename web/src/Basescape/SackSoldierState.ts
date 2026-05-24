import { Options } from "../Engine/Options.ts";
import { State } from "../Engine/State.ts";
import type { Action } from "../Engine/Action.ts";
import { Text, ALIGN_CENTER } from "../Interface/Text.ts";
import { TextButton } from "../Interface/TextButton.ts";
import { Window } from "../Interface/Window.ts";
import { Armor } from "../Mod/Armor.ts";
import type { Base } from "../Savegame/Base.ts";

export class SackSoldierState extends State {
  private _window: Window;
  private _btnOk: TextButton;
  private _btnCancel: TextButton;
  private _txtTitle: Text;
  private _txtSoldier: Text;

  constructor(private _base: Base, private _soldierId: number) {
    super();
    this._screen = false;

    this._window = new Window(this, 152, 80, 84, 60);
    this._btnOk = new TextButton(44, 16, 100, 115);
    this._btnCancel = new TextButton(44, 16, 176, 115);
    this._txtTitle = new Text(142, 9, 89, 75);
    this._txtSoldier = new Text(142, 9, 89, 85);

    this.setInterface("sackSoldier");

    this.add(this._window, "window", "sackSoldier");
    this.add(this._btnOk, "button", "sackSoldier");
    this.add(this._btnCancel, "button", "sackSoldier");
    this.add(this._txtTitle, "text", "sackSoldier");
    this.add(this._txtSoldier, "text", "sackSoldier");

    this.centerAllSurfaces();

    const back13 = this.game().getMod()?.getSurface("BACK13.SCR");
    if (back13) {
      this._window.setBackground(back13);
    }

    this._btnOk.setText(String(this.tr("STR_OK")));
    this._btnOk.onMouseClick(this.btnOkClick.bind(this));
    this._btnOk.onKeyboardPress(this.btnOkClick.bind(this), Options.keyOk);

    this._btnCancel.setText(String(this.tr("STR_CANCEL_UC")));
    this._btnCancel.onMouseClick(this.btnCancelClick.bind(this));
    this._btnCancel.onKeyboardPress(this.btnCancelClick.bind(this), Options.keyCancel);

    this._txtTitle.setAlign(ALIGN_CENTER);
    this._txtTitle.setText(String(this.tr("STR_SACK")));

    this._txtSoldier.setAlign(ALIGN_CENTER);
    this._txtSoldier.setText(`${this._base.getSoldiers()[this._soldierId]?.getName(true) || ""}?`);
  }

  btnOkClick(_action?: Action): void {
    const soldier = this._base.getSoldiers()[this._soldierId];
    if (soldier) {
      const storeItem = soldier.getArmor()?.getStoreItem() || Armor.NONE;
      if (storeItem !== Armor.NONE) {
        this._base.getStorageItems().addItem(storeItem);
      }
      this._base.getSoldiers().splice(this._soldierId, 1);
    }
    this.game().popState();
  }

  btnCancelClick(_action?: Action): void {
    this.game().popState();
  }
}
