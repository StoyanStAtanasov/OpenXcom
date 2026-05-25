import type { Action } from "../Engine/Action.ts";
import { Options } from "../Engine/Options.ts";
import { State } from "../Engine/State.ts";
import { ALIGN_CENTER, Text } from "../Interface/Text.ts";
import { TextButton } from "../Interface/TextButton.ts";
import { TextList } from "../Interface/TextList.ts";
import { Window } from "../Interface/Window.ts";

/**
 * Promotions screen that displays new soldier ranks.
 */
export class PromotionsState extends State {
  private _btnOk: TextButton;
  private _window: Window;
  private _txtTitle: Text;
  private _txtName: Text;
  private _txtRank: Text;
  private _txtBase: Text;
  private _lstSoldiers: TextList;

  constructor() {
    super();
    this._window = new Window(this, 320, 200, 0, 0);
    this._btnOk = new TextButton(288, 16, 16, 176);
    this._txtTitle = new Text(300, 17, 10, 8);
    this._txtName = new Text(114, 9, 16, 32);
    this._txtRank = new Text(90, 9, 130, 32);
    this._txtBase = new Text(80, 9, 220, 32);
    this._lstSoldiers = new TextList(288, 128, 8, 40);

    this.setInterface("promotions");
    this.add(this._window, "window", "promotions");
    this.add(this._btnOk, "button", "promotions");
    this.add(this._txtTitle, "heading", "promotions");
    this.add(this._txtName, "text", "promotions");
    this.add(this._txtRank, "text", "promotions");
    this.add(this._txtBase, "text", "promotions");
    this.add(this._lstSoldiers, "list", "promotions");
    this.centerAllSurfaces();

    const back01 = this.game().getMod()?.getSurface("BACK01.SCR");
    if (back01) {
      this._window.setBackground(back01);
    }
    this._btnOk.setText(String(this.tr("STR_OK")));
    this._btnOk.onMouseClick(this.btnOkClick.bind(this));
    this._btnOk.onKeyboardPress(this.btnOkClick.bind(this), Options.keyOk);
    this._btnOk.onKeyboardPress(this.btnOkClick.bind(this), Options.keyCancel);

    this._txtTitle.setText(String(this.tr("STR_PROMOTIONS")));
    this._txtTitle.setAlign(ALIGN_CENTER);
    this._txtTitle.setBig();
    this._txtName.setText(String(this.tr("STR_NAME")));
    this._txtRank.setText(String(this.tr("STR_NEW_RANK")));
    this._txtBase.setText(String(this.tr("STR_BASE")));

    this._lstSoldiers.setColumns(3, 114, 90, 84);
    this._lstSoldiers.setSelectable(true);
    this._lstSoldiers.setBackground(this._window);
    this._lstSoldiers.setMargin(8);

    for (const base of this.game().getSavedGame()?.getBases() || []) {
      for (const soldier of base.getSoldiers()) {
        if (soldier.isPromoted()) {
          this._lstSoldiers.addRow(3, soldier.getName(), String(this.tr(soldier.getRankString())), base.getName());
        }
      }
    }
  }

  btnOkClick(_action?: Action): void {
    this.game().popState();
  }
}
