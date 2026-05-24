import { Options } from "../Engine/Options.ts";
import { State } from "../Engine/State.ts";
import type { Action } from "../Engine/Action.ts";
import { ALIGN_CENTER, Text } from "../Interface/Text.ts";
import { TextButton } from "../Interface/TextButton.ts";
import { POPUP_BOTH, Window } from "../Interface/Window.ts";

/**
 * Notifies the player when a targeted UFO goes outside radar range.
 */
export class UfoLostState extends State {
  private _btnOk: TextButton;
  private _window: Window;
  private _txtTitle: Text;

  constructor(private _id: string) {
    super();
    this._screen = false;

    this._window = new Window(this, 192, 104, 32, 48, POPUP_BOTH);
    this._btnOk = new TextButton(60, 12, 98, 112);
    this._txtTitle = new Text(160, 32, 48, 72);

    this.setInterface("UFOLost");

    this.add(this._window, "window", "UFOLost");
    this.add(this._btnOk, "button", "UFOLost");
    this.add(this._txtTitle, "text", "UFOLost");

    this.centerAllSurfaces();

    const back15 = this.game().getMod()?.getSurface("BACK15.SCR");
    if (back15) {
      this._window.setBackground(back15);
    }

    this._btnOk.setText(String(this.tr("STR_OK")));
    this._btnOk.onMouseClick(this.btnOkClick.bind(this));
    this._btnOk.onKeyboardPress(this.btnOkClick.bind(this), Options.keyOk);
    this._btnOk.onKeyboardPress(this.btnOkClick.bind(this), Options.keyCancel);

    this._txtTitle.setBig();
    this._txtTitle.setAlign(ALIGN_CENTER);
    this._txtTitle.setText(`${this._id}\n${String(this.tr("STR_TRACKING_LOST"))}`);
  }

  btnOkClick(_action?: Action): void {
    this.game().popState();
  }
}
