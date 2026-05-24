import { Options } from "../Engine/Options.ts";
import { State } from "../Engine/State.ts";
import { formatFunding, TOK_COLOR_FLIP } from "../Engine/Unicode.ts";
import type { Action } from "../Engine/Action.ts";
import { Text, ALIGN_CENTER } from "../Interface/Text.ts";
import { TextButton } from "../Interface/TextButton.ts";
import { Window } from "../Interface/Window.ts";
import type { Base } from "../Savegame/Base.ts";
import type { TransferItemsState } from "./TransferItemsState.ts";

export class TransferConfirmState extends State {
  private _btnCancel: TextButton;
  private _btnOk: TextButton;
  private _window: Window;
  private _txtTitle: Text;
  private _txtCost: Text;
  private _txtTotal: Text;

  constructor(private _base: Base, private _state: TransferItemsState) {
    super();
    this._screen = false;

    this._window = new Window(this, 320, 80, 0, 60);
    this._btnCancel = new TextButton(128, 16, 176, 115);
    this._btnOk = new TextButton(128, 16, 16, 115);
    this._txtTitle = new Text(310, 17, 5, 75);
    this._txtCost = new Text(60, 17, 110, 95);
    this._txtTotal = new Text(100, 17, 170, 95);

    this.setInterface("transferConfirm");

    this.add(this._window, "window", "transferConfirm");
    this.add(this._btnCancel, "button", "transferConfirm");
    this.add(this._btnOk, "button", "transferConfirm");
    this.add(this._txtTitle, "text", "transferConfirm");
    this.add(this._txtCost, "text", "transferConfirm");
    this.add(this._txtTotal, "text", "transferConfirm");

    this.centerAllSurfaces();

    const back13 = this.game().getMod()?.getSurface("BACK13.SCR");
    if (back13) {
      this._window.setBackground(back13);
    }

    this._btnCancel.setText(String(this.tr("STR_CANCEL_UC")));
    this._btnCancel.onMouseClick(this.btnCancelClick.bind(this));
    this._btnCancel.onKeyboardPress(this.btnCancelClick.bind(this), Options.keyCancel);

    this._btnOk.setText(String(this.tr("STR_OK")));
    this._btnOk.onMouseClick(this.btnOkClick.bind(this));
    this._btnOk.onKeyboardPress(this.btnOkClick.bind(this), Options.keyOk);

    this._txtTitle.setBig();
    this._txtTitle.setAlign(ALIGN_CENTER);
    this._txtTitle.setText(String(this.tr("STR_TRANSFER_ITEMS_TO").arg(this._base.getName())));

    this._txtCost.setBig();
    this._txtCost.setText(String(this.tr("STR_COST")));

    this._txtTotal.setBig();
    this._txtTotal.setText(`${String.fromCharCode(TOK_COLOR_FLIP)}${formatFunding(this._state.getTotal())}`);
  }

  btnCancelClick(_action?: Action): void {
    this.game().popState();
  }

  btnOkClick(_action?: Action): void {
    this._state.completeTransfer();
    this.game().popState();
    this.game().popState();
    this.game().popState();
  }
}
