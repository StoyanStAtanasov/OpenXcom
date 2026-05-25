import type { Action } from "../Engine/Action.ts";
import { Options } from "../Engine/Options.ts";
import { State } from "../Engine/State.ts";
import { ALIGN_CENTER, Text } from "../Interface/Text.ts";
import { TextButton } from "../Interface/TextButton.ts";
import { TextList } from "../Interface/TextList.ts";
import { Window } from "../Interface/Window.ts";
import type { ReequipStat } from "./DebriefingState.ts";

/**
 * Screen shown when there's not enough equipment to re-equip a craft after a mission.
 */
export class CannotReequipState extends State {
  private _btnOk: TextButton;
  private _window: Window;
  private _txtTitle: Text;
  private _txtItem: Text;
  private _txtQuantity: Text;
  private _txtCraft: Text;
  private _lstItems: TextList;

  constructor(missingItems: ReequipStat[]) {
    super();
    this._window = new Window(this, 320, 200, 0, 0);
    this._btnOk = new TextButton(120, 18, 100, 174);
    this._txtTitle = new Text(220, 32, 50, 8);
    this._txtItem = new Text(142, 9, 10, 50);
    this._txtQuantity = new Text(88, 9, 152, 50);
    this._txtCraft = new Text(74, 9, 218, 50);
    this._lstItems = new TextList(288, 112, 8, 58);

    this.setInterface("cannotReequip");

    this.add(this._window, "window", "cannotReequip");
    this.add(this._btnOk, "button", "cannotReequip");
    this.add(this._txtTitle, "heading", "cannotReequip");
    this.add(this._txtItem, "text", "cannotReequip");
    this.add(this._txtQuantity, "text", "cannotReequip");
    this.add(this._txtCraft, "text", "cannotReequip");
    this.add(this._lstItems, "list", "cannotReequip");

    this.centerAllSurfaces();

    const back01 = this.game().getMod()?.getSurface("BACK01.SCR");
    if (back01) {
      this._window.setBackground(back01);
    }

    this._btnOk.setText(String(this.tr("STR_OK")));
    this._btnOk.onMouseClick(this.btnOkClick.bind(this));
    this._btnOk.onKeyboardPress(this.btnOkClick.bind(this), Options.keyOk);
    this._btnOk.onKeyboardPress(this.btnOkClick.bind(this), Options.keyCancel);

    this._txtTitle.setText(String(this.tr("STR_NOT_ENOUGH_EQUIPMENT_TO_FULLY_RE_EQUIP_SQUAD")));
    this._txtTitle.setAlign(ALIGN_CENTER);
    this._txtTitle.setBig();
    this._txtTitle.setWordWrap(true);

    this._txtItem.setText(String(this.tr("STR_ITEM")));
    this._txtQuantity.setText(String(this.tr("STR_QUANTITY_UC")));
    this._txtCraft.setText(String(this.tr("STR_CRAFT")));

    this._lstItems.setColumns(3, 162, 46, 80);
    this._lstItems.setSelectable(true);
    this._lstItems.setBackground(this._window);
    this._lstItems.setMargin(2);

    for (const item of missingItems) {
      this._lstItems.addRow(3, String(this.tr(item.item)), String(item.qty), item.craft);
    }
  }

  btnOkClick(_action?: Action): void {
    this.game().popState();
  }
}
