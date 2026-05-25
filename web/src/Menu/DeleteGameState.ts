import { Options } from "../Engine/Options.ts";
import { deleteFile } from "../Engine/CrossPlatform.ts";
import { State } from "../Engine/State.ts";
import type { Action } from "../Engine/Action.ts";
import { Text, ALIGN_CENTER } from "../Interface/Text.ts";
import { TextButton } from "../Interface/TextButton.ts";
import { Window, POPUP_BOTH } from "../Interface/Window.ts";
import { ErrorMessageState } from "./ErrorMessageState.ts";
import { OPT_BATTLESCAPE, type OptionsOrigin } from "./OptionsBaseState.ts";

export class DeleteGameState extends State {
  private _btnNo: TextButton;
  private _btnYes: TextButton;
  private _window: Window;
  private _txtMessage: Text;
  private _filename: string;

  constructor(private _origin: OptionsOrigin, save: string) {
    super();
    this._filename = Options.getMasterUserFolder() + save;
    this._screen = false;
    this._window = new Window(this, 256, 100, 32, 50, POPUP_BOTH);
    this._btnYes = new TextButton(60, 18, 60, 122);
    this._btnNo = new TextButton(60, 18, 200, 122);
    this._txtMessage = new Text(246, 32, 37, 70);

    this.setInterface("saveMenus");
    this.add(this._window, "confirmDelete", "saveMenus");
    this.add(this._btnYes, "confirmDelete", "saveMenus");
    this.add(this._btnNo, "confirmDelete", "saveMenus");
    this.add(this._txtMessage, "confirmDelete", "saveMenus");
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
    this._txtMessage.setAlign(ALIGN_CENTER);
    this._txtMessage.setBig();
    this._txtMessage.setWordWrap(true);
    this._txtMessage.setText(String(this.tr("STR_IS_IT_OK_TO_DELETE_THE_SAVED_GAME")));

    if (this._origin === OPT_BATTLESCAPE) {
      this.applyBattlescapeTheme();
    }
  }

  btnNoClick(_action?: Action): void {
    this.game().popState();
  }

  btnYesClick(_action?: Action): void {
    this.game().popState();
    let ok = false;
    try {
      ok = deleteFile(this._filename);
    } catch {
      ok = false;
    }
    if (!ok) {
      const errorMessages = this.game().getMod()?.getInterface("errorMessages");
      const colorId = this._origin !== OPT_BATTLESCAPE ? "geoscapeColor" : "battlescapeColor";
      const paletteId = this._origin !== OPT_BATTLESCAPE ? "geoscapePalette" : "battlescapePalette";
      const bg = this._origin !== OPT_BATTLESCAPE ? "BACK01.SCR" : "TAC00.SCR";
      const color = errorMessages?.getElement(colorId)?.color ?? 1;
      const palette = errorMessages?.getElement(paletteId)?.color ?? -1;
      this.game().pushState(new ErrorMessageState(String(this.tr("STR_DELETE_UNSUCCESSFUL")), this._palette, color, bg, palette));
    }
  }
}
