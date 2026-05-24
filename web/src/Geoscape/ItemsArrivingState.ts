import { Options } from "../Engine/Options.ts";
import { State } from "../Engine/State.ts";
import type { Action } from "../Engine/Action.ts";
import { ALIGN_CENTER, Text } from "../Interface/Text.ts";
import { TextButton } from "../Interface/TextButton.ts";
import { TextList } from "../Interface/TextList.ts";
import { POPUP_BOTH, Window } from "../Interface/Window.ts";
import { BasescapeState } from "../Basescape/BasescapeState.ts";
import { BattleType } from "../Mod/RuleItem.ts";
import type { GeoscapeState } from "./GeoscapeState.ts";
import type { Base } from "../Savegame/Base.ts";
import type { Craft } from "../Savegame/Craft.ts";
import { TransferType } from "../Savegame/Transfer.ts";

type GeoscapeTimerBoundary = {
  timerReset?: () => void;
};

type CraftReuseItemBoundary = Craft & {
  reuseItem?: (item: string) => void;
};

export class ItemsArrivingState extends State {
  private _base: Base | null = null;
  private _btnOk: TextButton;
  private _btnGotoBase: TextButton;
  private _window: Window;
  private _txtTitle: Text;
  private _txtItem: Text;
  private _txtQuantity: Text;
  private _txtDestination: Text;
  private _lstTransfers: TextList;

  constructor(private _state: GeoscapeState) {
    super();
    this._screen = false;

    this._window = new Window(this, 320, 184, 0, 8, POPUP_BOTH);
    this._btnOk = new TextButton(142, 16, 16, 166);
    this._btnGotoBase = new TextButton(142, 16, 162, 166);
    this._txtTitle = new Text(310, 17, 5, 18);
    this._txtItem = new Text(114, 9, 16, 34);
    this._txtQuantity = new Text(54, 9, 152, 34);
    this._txtDestination = new Text(112, 9, 212, 34);
    this._lstTransfers = new TextList(271, 112, 14, 50);

    this.setInterface("itemsArriving");

    this.add(this._window, "window", "itemsArriving");
    this.add(this._btnOk, "button", "itemsArriving");
    this.add(this._btnGotoBase, "button", "itemsArriving");
    this.add(this._txtTitle, "text1", "itemsArriving");
    this.add(this._txtItem, "text1", "itemsArriving");
    this.add(this._txtQuantity, "text1", "itemsArriving");
    this.add(this._txtDestination, "text1", "itemsArriving");
    this.add(this._lstTransfers, "text2", "itemsArriving");

    this.centerAllSurfaces();

    const back13 = this.game().getMod()?.getSurface("BACK13.SCR");
    if (back13) {
      this._window.setBackground(back13);
    }

    this._btnOk.setText(String(this.tr("STR_OK")));
    this._btnOk.onMouseClick(this.btnOkClick.bind(this));
    this._btnOk.onKeyboardPress(this.btnOkClick.bind(this), Options.keyCancel);

    this._btnGotoBase.setText(String(this.tr("STR_GO_TO_BASE")));
    this._btnGotoBase.onMouseClick(this.btnGotoBaseClick.bind(this));
    this._btnGotoBase.onKeyboardPress(this.btnGotoBaseClick.bind(this), Options.keyOk);

    this._txtTitle.setBig();
    this._txtTitle.setAlign(ALIGN_CENTER);
    this._txtTitle.setText(String(this.tr("STR_ITEMS_ARRIVING")));

    this._txtItem.setText(String(this.tr("STR_ITEM")));
    this._txtQuantity.setText(String(this.tr("STR_QUANTITY_UC")));
    this._txtDestination.setText(String(this.tr("STR_DESTINATION_UC")));

    this._lstTransfers.setColumns(3, 155, 41, 98);
    this._lstTransfers.setSelectable(true);
    this._lstTransfers.setBackground(this._window);
    this._lstTransfers.setMargin(2);

    const save = this.game().getSavedGame();
    const mod = this.game().getMod();
    for (const base of save?.getBases() || []) {
      const transfers = base.getTransfers();
      for (let i = 0; i < transfers.length;) {
        const transfer = transfers[i];
        if (transfer.getHours() === 0) {
          this._base = base;

          if (transfer.getType() === TransferType.TRANSFER_ITEM) {
            const item = mod?.getItem(transfer.getItems(), true);
            if (item?.getBattleType() === BattleType.BT_NONE) {
              for (const craft of base.getCrafts()) {
                (craft as CraftReuseItemBoundary).reuseItem?.(transfer.getItems());
              }
            }
          }

          this._lstTransfers.addRow(3, transfer.getName(this.game().getLanguage()), `${transfer.getQuantity()}`, base.getName());
          transfers.splice(i, 1);
        } else {
          ++i;
        }
      }
    }
  }

  btnOkClick(_action?: Action): void {
    this.game().popState();
  }

  btnGotoBaseClick(_action?: Action): void {
    (this._state as GeoscapeState & GeoscapeTimerBoundary).timerReset?.();
    this.game().popState();
    this.game().pushState(new BasescapeState(this._base, this._state.getGlobe()));
  }
}
