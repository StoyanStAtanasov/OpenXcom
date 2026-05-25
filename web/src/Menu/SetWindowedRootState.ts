import { Options } from "../Engine/Options.ts";
import { State } from "../Engine/State.ts";
import type { Action } from "../Engine/Action.ts";
import { Text, ALIGN_CENTER } from "../Interface/Text.ts";
import { TextButton } from "../Interface/TextButton.ts";
import { Window, POPUP_BOTH } from "../Interface/Window.ts";
import { OPT_BATTLESCAPE, type OptionsOrigin } from "./OptionsBaseState.ts";
import type { OptionsVideoState } from "./OptionsVideoState.ts";

export class SetWindowedRootState extends State {
  private _btnOk: TextButton;
  private _btnCancel: TextButton;
  private _window: Window;
  private _txtTitle: Text;

  constructor(private _origin: OptionsOrigin, private _parent: OptionsVideoState) {
    super();
    this._screen = false;
    this._window = new Window(this, 216, 100, 52, 50, POPUP_BOTH);
    this._btnOk = new TextButton(50, 20, 70, 120);
    this._btnCancel = new TextButton(50, 20, 200, 120);
    this._txtTitle = new Text(204, 58, 58, 60);
    this.setInterface("optionsMenu", false, this.game().getSavedGame()?.getSavedBattle?.() ?? null);
    this.add(this._window, "confirmVideo", "optionsMenu");
    this.add(this._btnOk, "confirmVideo", "optionsMenu");
    this.add(this._btnCancel, "confirmVideo", "optionsMenu");
    this.add(this._txtTitle, "confirmVideo", "optionsMenu");
    this.centerAllSurfaces();
    const back01 = this.game().getMod()?.getSurface("BACK01.SCR");
    if (back01) {
      this._window.setBackground(back01);
    }
    this._btnOk.setText(String(this.tr("STR_OK")));
    this._btnOk.onMouseClick(this.btnOkClick.bind(this));
    this._btnOk.onKeyboardPress(this.btnOkClick.bind(this), Options.keyOk);
    this._btnCancel.setText(String(this.tr("STR_CANCEL")));
    this._btnCancel.onMouseClick(this.btnCancelClick.bind(this));
    this._btnCancel.onKeyboardPress(this.btnCancelClick.bind(this), Options.keyCancel);
    this._txtTitle.setAlign(ALIGN_CENTER);
    this._txtTitle.setBig();
    this._txtTitle.setWordWrap(true);
    this._txtTitle.setText(String(this.tr("STR_FIXED_WINDOW_POSITION")));

    if (this._origin === OPT_BATTLESCAPE) {
      this.applyBattlescapeTheme();
    }
  }

  btnOkClick(_action?: Action): void {
    Options.newRootWindowedMode = true;
    Options.newWindowedModePositionX = Options.windowedModePositionX;
    Options.newWindowedModePositionY = Options.windowedModePositionY;
    this.game().popState();
  }

  btnCancelClick(_action?: Action): void {
    Options.newRootWindowedMode = false;
    this._parent.unpressRootWindowedMode();
    this.game().popState();
  }
}
