import { Options } from "../Engine/Options.ts";
import { State } from "../Engine/State.ts";
import type { Action } from "../Engine/Action.ts";
import { ALIGN_CENTER, ALIGN_MIDDLE, Text } from "../Interface/Text.ts";
import { TextButton } from "../Interface/TextButton.ts";
import { POPUP_BOTH, Window } from "../Interface/Window.ts";
import { BasescapeState } from "../Basescape/BasescapeState.ts";
import { ManufactureState } from "../Basescape/ManufactureState.ts";
import type { GeoscapeState } from "./GeoscapeState.ts";
import type { Base } from "../Savegame/Base.ts";
import { productionProgress_e } from "../Savegame/Production.ts";

type GeoscapeTimerBoundary = {
  timerReset?: () => void;
};

export class ProductionCompleteState extends State {
  private _btnOk: TextButton;
  private _btnGotoBase: TextButton;
  private _window: Window;
  private _txtMessage: Text;

  constructor(private _base: Base, item: string, private _state: GeoscapeState, private _endType = productionProgress_e.PROGRESS_COMPLETE) {
    super();
    this._screen = false;

    this._window = new Window(this, 256, 160, 32, 20, POPUP_BOTH);
    this._btnOk = new TextButton(118, 18, 40, 154);
    this._btnGotoBase = new TextButton(118, 18, 162, 154);
    this._txtMessage = new Text(246, 110, 37, 35);

    this.setInterface("geoManufactureComplete");

    this.add(this._window, "window", "geoManufactureComplete");
    this.add(this._btnOk, "button", "geoManufactureComplete");
    this.add(this._btnGotoBase, "button", "geoManufactureComplete");
    this.add(this._txtMessage, "text1", "geoManufactureComplete");

    this.centerAllSurfaces();

    const back17 = this.game().getMod()?.getSurface("BACK17.SCR");
    if (back17) {
      this._window.setBackground(back17);
    }

    this._btnOk.setText(String(this.tr("STR_OK")));
    this._btnOk.onMouseClick(this.btnOkClick.bind(this));
    this._btnOk.onKeyboardPress(this.btnOkClick.bind(this), Options.keyCancel);

    if (this._endType !== productionProgress_e.PROGRESS_CONSTRUCTION) {
      this._btnGotoBase.setText(String(this.tr("STR_ALLOCATE_MANUFACTURE")));
    } else {
      this._btnGotoBase.setText(String(this.tr("STR_GO_TO_BASE")));
    }
    this._btnGotoBase.onMouseClick(this.btnGotoBaseClick.bind(this));

    this._txtMessage.setAlign(ALIGN_CENTER);
    this._txtMessage.setVerticalAlign(ALIGN_MIDDLE);
    this._txtMessage.setBig();
    this._txtMessage.setWordWrap(true);
    let message = "";
    switch (this._endType) {
      case productionProgress_e.PROGRESS_CONSTRUCTION:
        message = String(this.tr("STR_CONSTRUCTION_OF_FACILITY_AT_BASE_IS_COMPLETE").arg(item).arg(this._base.getName()));
        break;
      case productionProgress_e.PROGRESS_COMPLETE:
        message = String(this.tr("STR_PRODUCTION_OF_ITEM_AT_BASE_IS_COMPLETE").arg(item).arg(this._base.getName()));
        break;
      case productionProgress_e.PROGRESS_NOT_ENOUGH_MONEY:
        message = String(this.tr("STR_NOT_ENOUGH_MONEY_TO_PRODUCE_ITEM_AT_BASE").arg(item).arg(this._base.getName()));
        break;
      case productionProgress_e.PROGRESS_NOT_ENOUGH_MATERIALS:
        message = String(this.tr("STR_NOT_ENOUGH_SPECIAL_MATERIALS_TO_PRODUCE_ITEM_AT_BASE").arg(item).arg(this._base.getName()));
        break;
      default:
        throw new Error(`Unexpected production progress: ${this._endType}`);
    }
    this._txtMessage.setText(message);
  }

  btnOkClick(_action?: Action): void {
    this.game().popState();
  }

  btnGotoBaseClick(_action?: Action): void {
    (this._state as GeoscapeState & GeoscapeTimerBoundary).timerReset?.();
    this.game().popState();
    if (this._endType !== productionProgress_e.PROGRESS_CONSTRUCTION) {
      this.game().pushState(new ManufactureState(this._base));
    } else {
      this.game().pushState(new BasescapeState(this._base, this._state.getGlobe()));
    }
  }
}
