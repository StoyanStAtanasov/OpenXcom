import type { Action } from "../Engine/Action.ts";
import { Options } from "../Engine/Options.ts";
import { State } from "../Engine/State.ts";
import { ALIGN_CENTER, ALIGN_MIDDLE, Text } from "../Interface/Text.ts";
import { TextButton } from "../Interface/TextButton.ts";
import { POPUP_BOTH, Window } from "../Interface/Window.ts";

type GeoscapeStateLike = {
  timerReset?: () => void;
};

/**
 * Window used to notify the player when an error occurs with a craft procedure.
 */
export class CraftErrorState extends State {
  private _btnOk: TextButton;
  private _btnOk5Secs: TextButton;
  private _window: Window;
  private _txtMessage: Text;

  constructor(private _state: GeoscapeStateLike, msg: string) {
    super();
    this._screen = false;

    this._window = new Window(this, 256, 160, 32, 20, POPUP_BOTH);
    this._btnOk = new TextButton(100, 18, 48, 150);
    this._btnOk5Secs = new TextButton(100, 18, 172, 150);
    this._txtMessage = new Text(246, 96, 37, 42);

    this.setInterface("craftError");

    this.add(this._window, "window", "craftError");
    this.add(this._btnOk, "button", "craftError");
    this.add(this._btnOk5Secs, "button", "craftError");
    this.add(this._txtMessage, "text1", "craftError");

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

    this._txtMessage.setAlign(ALIGN_CENTER);
    this._txtMessage.setVerticalAlign(ALIGN_MIDDLE);
    this._txtMessage.setBig();
    this._txtMessage.setWordWrap(true);
    this._txtMessage.setText(msg);
  }

  btnOkClick(_action?: Action): void {
    this.game().popState();
  }

  btnOk5SecsClick(_action?: Action): void {
    this._state.timerReset?.();
    this.game().popState();
  }
}
