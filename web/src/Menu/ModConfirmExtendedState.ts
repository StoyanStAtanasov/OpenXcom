import { State } from "../Engine/State.ts";
import type { Action } from "../Engine/Action.ts";
import type { ModInfo } from "../Engine/ModInfo.ts";
import { Text, ALIGN_CENTER } from "../Interface/Text.ts";
import { TextButton } from "../Interface/TextButton.ts";
import { Window, POPUP_BOTH } from "../Interface/Window.ts";
import type { ModListState } from "./ModListState.ts";

export class ModConfirmExtendedState extends State {
  private _isMaster: boolean;
  private _btnYes: TextButton;
  private _btnNo: TextButton;
  private _window: Window;
  private _txtTitle: Text;

  constructor(private _state: ModListState, modInfo: ModInfo) {
    super();
    this._isMaster = modInfo.isMaster();
    this._screen = false;
    this._window = new Window(this, 256, 100, 32, 50, POPUP_BOTH);
    this._btnYes = new TextButton(60, 18, 60, 122);
    this._btnNo = new TextButton(60, 18, 200, 122);
    this._txtTitle = new Text(246, 50, 37, 64);
    this.setInterface("optionsMenu");
    this.add(this._window, "confirmDefaults", "optionsMenu");
    this.add(this._btnYes, "confirmDefaults", "optionsMenu");
    this.add(this._btnNo, "confirmDefaults", "optionsMenu");
    this.add(this._txtTitle, "confirmDefaults", "optionsMenu");
    this.centerAllSurfaces();
    const back01 = this.game().getMod()?.getSurface("BACK01.SCR");
    if (back01) {
      this._window.setBackground(back01);
    }
    this._btnYes.setText(String(this.tr("STR_YES")));
    this._btnYes.onMouseClick(this.btnYesClick.bind(this));
    this._btnNo.setText(String(this.tr("STR_NO")));
    this._btnNo.onMouseClick(this.btnNoClick.bind(this));
    this._txtTitle.setAlign(ALIGN_CENTER);
    this._txtTitle.setBig();
    this._txtTitle.setWordWrap(true);
    this._txtTitle.setText(String(this.tr("STR_OXCE_REQUIRED_QUESTION").arg(modInfo.getRequiredExtendedEngine())));
  }

  btnYesClick(_action?: Action): void {
    this.game().popState();
    if (this._isMaster) {
      this._state.changeMasterMod();
    } else {
      this._state.toggleMod();
    }
  }

  btnNoClick(_action?: Action): void {
    this.game().popState();
    if (this._isMaster) {
      this._state.revertMasterMod();
    }
  }
}
