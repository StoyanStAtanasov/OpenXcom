import { Options } from "../Engine/Options.ts";
import { State } from "../Engine/State.ts";
import type { Action } from "../Engine/Action.ts";
import { ALIGN_CENTER, Text } from "../Interface/Text.ts";
import { TextButton } from "../Interface/TextButton.ts";
import { POPUP_BOTH, Window } from "../Interface/Window.ts";
import type { Craft } from "../Savegame/Craft.ts";
import type { GeoscapeState } from "./GeoscapeState.ts";

type GeoscapeTimerBoundary = {
  timerReset?: () => void;
};

export class LowFuelState extends State {
  private _btnOk: TextButton;
  private _btnOk5Secs: TextButton;
  private _window: Window;
  private _txtTitle: Text;
  private _txtMessage: Text;

  constructor(private _craft: Craft, private _state: GeoscapeState) {
    super();
    this._screen = false;

    this._window = new Window(this, 224, 120, 16, 40, POPUP_BOTH);
    this._btnOk = new TextButton(90, 18, 30, 120);
    this._btnOk5Secs = new TextButton(90, 18, 136, 120);
    this._txtTitle = new Text(214, 17, 21, 60);
    this._txtMessage = new Text(214, 17, 21, 90);

    this.setInterface("lowFuel");

    this.add(this._window, "window", "lowFuel");
    this.add(this._btnOk, "button", "lowFuel");
    this.add(this._btnOk5Secs, "button", "lowFuel");
    this.add(this._txtTitle, "text", "lowFuel");
    this.add(this._txtMessage, "text", "lowFuel");

    this.centerAllSurfaces();

    const back12 = this.game().getMod()?.getSurface("BACK12.SCR");
    if (back12) {
      this._window.setBackground(back12);
    }

    this._btnOk.setText(String(this.tr("STR_OK")));
    this._btnOk.onMouseClick(this.btnOkClick.bind(this));
    this._btnOk.onKeyboardPress(this.btnOkClick.bind(this), Options.keyCancel);

    this._btnOk5Secs.setText(String(this.tr("STR_OK_5_SECONDS")));
    this._btnOk5Secs.onMouseClick(this.btnOk5SecsClick.bind(this));
    this._btnOk5Secs.onKeyboardPress(this.btnOk5SecsClick.bind(this), Options.keyOk);

    this._txtTitle.setAlign(ALIGN_CENTER);
    this._txtTitle.setBig();
    this._txtTitle.setText(this._craft.getName(this.game().getLanguage()));

    this._txtMessage.setAlign(ALIGN_CENTER);
    this._txtMessage.setText(String(this.tr("STR_IS_LOW_ON_FUEL_RETURNING_TO_BASE")));
  }

  btnOkClick(_action?: Action): void {
    this.game().popState();
  }

  btnOk5SecsClick(_action?: Action): void {
    (this._state as GeoscapeState & GeoscapeTimerBoundary).timerReset?.();
    this.game().popState();
  }
}
