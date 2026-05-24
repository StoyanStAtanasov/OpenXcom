import { Options } from "../Engine/Options.ts";
import { State } from "../Engine/State.ts";
import type { Action } from "../Engine/Action.ts";
import { Text, ALIGN_CENTER } from "../Interface/Text.ts";
import { TextButton } from "../Interface/TextButton.ts";
import { TextList } from "../Interface/TextList.ts";
import { Window } from "../Interface/Window.ts";
import type { Base } from "../Savegame/Base.ts";

export class StoresState extends State {
  private _btnOk: TextButton;
  private _window: Window;
  private _txtTitle: Text;
  private _txtItem: Text;
  private _txtQuantity: Text;
  private _txtSpaceUsed: Text;
  private _lstStores: TextList;

  constructor(private _base: Base) {
    super();

    this._window = new Window(this, 320, 200, 0, 0);
    this._btnOk = new TextButton(300, 16, 10, 176);
    this._txtTitle = new Text(310, 17, 5, 8);
    this._txtItem = new Text(142, 9, 10, 32);
    this._txtQuantity = new Text(88, 9, 152, 32);
    this._txtSpaceUsed = new Text(74, 9, 240, 32);
    this._lstStores = new TextList(288, 128, 8, 40);

    this.setInterface("storesInfo");

    this.add(this._window, "window", "storesInfo");
    this.add(this._btnOk, "button", "storesInfo");
    this.add(this._txtTitle, "text", "storesInfo");
    this.add(this._txtItem, "text", "storesInfo");
    this.add(this._txtQuantity, "text", "storesInfo");
    this.add(this._txtSpaceUsed, "text", "storesInfo");
    this.add(this._lstStores, "list", "storesInfo");

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
    this._txtTitle.setText(String(this.tr("STR_STORES")));

    this._txtItem.setText(String(this.tr("STR_ITEM")));
    this._txtQuantity.setText(String(this.tr("STR_QUANTITY_UC")));
    this._txtSpaceUsed.setText(String(this.tr("STR_SPACE_USED_UC")));

    this._lstStores.setColumns(3, 162, 92, 32);
    this._lstStores.setSelectable(true);
    this._lstStores.setBackground(this._window);
    this._lstStores.setMargin(2);

    const mod = this.game().getMod();
    if (mod) {
      for (const type of mod.getItemsList()) {
        const qty = this._base.getStorageItems().getItem(type);
        if (qty <= 0) {
          continue;
        }
        const rule = mod.getItem(type, true);
        this._lstStores.addRow(3, String(this.tr(type)), `${qty}`, `${qty * (rule?.getSize() || 0)}`);
      }
    }
  }

  btnOkClick(_action?: Action): void {
    this.game().popState();
  }
}
