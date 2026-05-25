import { Options } from "../Engine/Options.ts";
import { State } from "../Engine/State.ts";
import type { Action } from "../Engine/Action.ts";
import { Text, ALIGN_CENTER } from "../Interface/Text.ts";
import { TextButton } from "../Interface/TextButton.ts";
import { Window, POPUP_BOTH } from "../Interface/Window.ts";
import { LoadGameState } from "./LoadGameState.ts";
import { OPT_BATTLESCAPE, type OptionsOrigin } from "./OptionsBaseState.ts";

export class ConfirmLoadState extends State {
  private _btnYes: TextButton;
  private _btnNo: TextButton;
  private _window: Window;
  private _txtText: Text;

  constructor(private _origin: OptionsOrigin, private _fileName: string) {
    super();
    this._screen = false;
    this._window = new Window(this, 216, 100, 52, 50, POPUP_BOTH);
    this._btnYes = new TextButton(50, 20, 70, 120);
    this._btnNo = new TextButton(50, 20, 200, 120);
    this._txtText = new Text(204, 58, 58, 60);

    this.setInterface("saveMenus");
    this.add(this._window, "confirmLoad", "saveMenus");
    this.add(this._btnYes, "confirmLoad", "saveMenus");
    this.add(this._btnNo, "confirmLoad", "saveMenus");
    this.add(this._txtText, "confirmLoad", "saveMenus");
    this.centerAllSurfaces();

    const back01 = this.game().getMod()?.getSurface("BACK01.SCR");
    if (back01) {
      this._window.setBackground(back01);
    }

    this._btnYes.setText(String(this.tr("STR_YES")));
    this._btnYes.onMouseClick(this.btnYesClick.bind(this));
    this._btnYes.onKeyboardPress(this.btnYesClick.bind(this), Options.keyOk);
    this._btnNo.setText(String(this.tr("STR_NO")));
    this._btnNo.onMouseClick(this.btnNoClick.bind(this));
    this._btnNo.onKeyboardPress(this.btnNoClick.bind(this), Options.keyCancel);
    this._txtText.setAlign(ALIGN_CENTER);
    this._txtText.setBig();
    this._txtText.setWordWrap(true);
    this._txtText.setText(String(this.tr("STR_MISSING_CONTENT_PROMPT")));

    if (this._origin === OPT_BATTLESCAPE) {
      this.applyBattlescapeTheme();
    }
  }

  btnYesClick(_action?: Action): void {
    this.game().popState();
    this.game().pushState(new LoadGameState(this._origin, this._fileName, this._palette));
  }

  btnNoClick(_action?: Action): void {
    this.game().popState();
  }
}
