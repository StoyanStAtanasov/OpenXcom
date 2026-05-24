import { Options } from "../Engine/Options.ts";
import { State } from "../Engine/State.ts";
import type { Action } from "../Engine/Action.ts";
import { Text, ALIGN_CENTER } from "../Interface/Text.ts";
import { TextButton } from "../Interface/TextButton.ts";
import { TextList } from "../Interface/TextList.ts";
import { Window, POPUP_BOTH } from "../Interface/Window.ts";
import type { Base } from "../Savegame/Base.ts";

export class TransfersState extends State {
  private _btnOk: TextButton;
  private _window: Window;
  private _txtTitle: Text;
  private _txtItem: Text;
  private _txtQuantity: Text;
  private _txtArrivalTime: Text;
  private _lstTransfers: TextList;

  constructor(private _base: Base) {
    super();
    this._screen = false;

    this._window = new Window(this, 320, 184, 0, 8, POPUP_BOTH);
    this._btnOk = new TextButton(288, 16, 16, 166);
    this._txtTitle = new Text(278, 17, 21, 18);
    this._txtItem = new Text(114, 9, 16, 34);
    this._txtQuantity = new Text(54, 9, 152, 34);
    this._txtArrivalTime = new Text(112, 9, 212, 34);
    this._lstTransfers = new TextList(273, 112, 14, 50);

    this.setInterface("transferInfo");

    this.add(this._window, "window", "transferInfo");
    this.add(this._btnOk, "button", "transferInfo");
    this.add(this._txtTitle, "text", "transferInfo");
    this.add(this._txtItem, "text", "transferInfo");
    this.add(this._txtQuantity, "text", "transferInfo");
    this.add(this._txtArrivalTime, "text", "transferInfo");
    this.add(this._lstTransfers, "list", "transferInfo");

    this.centerAllSurfaces();

    const back13 = this.game().getMod()?.getSurface("BACK13.SCR");
    if (back13) {
      this._window.setBackground(back13);
    }

    this._btnOk.setText(String(this.tr("STR_OK")));
    this._btnOk.onMouseClick(this.btnOkClick.bind(this));
    this._btnOk.onKeyboardPress(this.btnOkClick.bind(this), Options.keyOk);
    this._btnOk.onKeyboardPress(this.btnOkClick.bind(this), Options.keyCancel);

    this._txtTitle.setBig();
    this._txtTitle.setAlign(ALIGN_CENTER);
    this._txtTitle.setText(String(this.tr("STR_TRANSFERS")));

    this._txtItem.setText(String(this.tr("STR_ITEM")));
    this._txtQuantity.setText(String(this.tr("STR_QUANTITY_UC")));
    this._txtArrivalTime.setText(String(this.tr("STR_ARRIVAL_TIME_HOURS")));

    this._lstTransfers.setColumns(3, 155, 75, 46);
    this._lstTransfers.setSelectable(true);
    this._lstTransfers.setBackground(this._window);
    this._lstTransfers.setMargin(2);

    const language = this.game().getLanguage();
    for (const transfer of this._base.getTransfers()) {
      this._lstTransfers.addRow(3, transfer.getName(language), `${transfer.getQuantity()}`, `${transfer.getHours()}`);
    }
  }

  btnOkClick(_action?: Action): void {
    this.game().popState();
  }
}
