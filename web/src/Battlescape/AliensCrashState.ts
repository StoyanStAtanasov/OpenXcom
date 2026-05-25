import { Options } from "../Engine/Options.ts";
import { State } from "../Engine/State.ts";
import type { Action } from "../Engine/Action.ts";
import { ALIGN_CENTER, ALIGN_MIDDLE, Text } from "../Interface/Text.ts";
import { TextButton } from "../Interface/TextButton.ts";
import { Window } from "../Interface/Window.ts";
import { DebriefingState } from "./DebriefingState.ts";

/**
 * Screen shown when all aliens died during a crash site.
 */
export class AliensCrashState extends State {
  private _btnOk: TextButton;
  private _window: Window;
  private _txtTitle: Text;

  constructor() {
    super();

    this._window = new Window(this, 256, 160, 32, 20);
    this._btnOk = new TextButton(120, 18, 100, 154);
    this._txtTitle = new Text(246, 80, 37, 50);

    this.setPaletteByName("PAL_BATTLESCAPE");

    this.add(this._window, "messageWindowBorder", "battlescape");
    this.add(this._btnOk, "messageWindowButtons", "battlescape");
    this.add(this._txtTitle, "messageWindows", "battlescape");

    this.centerAllSurfaces();

    this._window.setHighContrast(true);
    const tac = this.game().getMod()?.getSurface("TAC00.SCR");
    if (tac) {
      this._window.setBackground(tac);
    }

    this._btnOk.setHighContrast(true);
    this._btnOk.setText(String(this.tr("STR_OK")));
    this._btnOk.onMouseClick(this.btnOkClick.bind(this));
    this._btnOk.onKeyboardPress(this.btnOkClick.bind(this), Options.keyOk);
    this._btnOk.onKeyboardPress(this.btnOkClick.bind(this), Options.keyCancel);

    this._txtTitle.setHighContrast(true);
    this._txtTitle.setText(String(this.tr("STR_ALL_ALIENS_KILLED_IN_CRASH")));
    this._txtTitle.setAlign(ALIGN_CENTER);
    this._txtTitle.setVerticalAlign(ALIGN_MIDDLE);
    this._txtTitle.setBig();
    this._txtTitle.setWordWrap(true);
  }

  btnOkClick(_action?: Action): void {
    this.game().popState();
    this.game().pushState(new DebriefingState());
  }
}
