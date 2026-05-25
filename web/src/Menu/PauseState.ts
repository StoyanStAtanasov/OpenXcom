import { Options } from "../Engine/Options.ts";
import { State } from "../Engine/State.ts";
import type { Action } from "../Engine/Action.ts";
import { Text, ALIGN_CENTER } from "../Interface/Text.ts";
import { TextButton } from "../Interface/TextButton.ts";
import { Window, POPUP_BOTH } from "../Interface/Window.ts";
import { AbandonGameState } from "./AbandonGameState.ts";
import { ListLoadState } from "./ListLoadState.ts";
import { ListSaveState } from "./ListSaveState.ts";
import { OptionsBattlescapeState } from "./OptionsBattlescapeState.ts";
import { OptionsGeoscapeState } from "./OptionsGeoscapeState.ts";
import { OptionsVideoState } from "./OptionsVideoState.ts";
import { OPT_BATTLESCAPE, OPT_GEOSCAPE, type OptionsOrigin } from "./OptionsBaseState.ts";

export class PauseState extends State {
  private _btnLoad: TextButton;
  private _btnSave: TextButton;
  private _btnAbandon: TextButton;
  private _btnOptions: TextButton;
  private _btnCancel: TextButton;
  private _window: Window;
  private _txtTitle: Text;

  constructor(private _origin: OptionsOrigin) {
    super();
    this._screen = false;
    const x = this._origin === OPT_GEOSCAPE ? 20 : 52;
    this._window = new Window(this, 216, 160, x, 20, POPUP_BOTH);
    this._btnLoad = new TextButton(180, 18, x + 18, 52);
    this._btnSave = new TextButton(180, 18, x + 18, 74);
    this._btnAbandon = new TextButton(180, 18, x + 18, 96);
    this._btnOptions = new TextButton(180, 18, x + 18, 122);
    this._btnCancel = new TextButton(180, 18, x + 18, 150);
    this._txtTitle = new Text(206, 17, x + 5, 32);

    this.setInterface("pauseMenu");
    this.add(this._window, "window", "pauseMenu");
    this.add(this._btnLoad, "button", "pauseMenu");
    this.add(this._btnSave, "button", "pauseMenu");
    this.add(this._btnAbandon, "button", "pauseMenu");
    this.add(this._btnOptions, "button", "pauseMenu");
    this.add(this._btnCancel, "button", "pauseMenu");
    this.add(this._txtTitle, "text", "pauseMenu");
    this.centerAllSurfaces();
    const back01 = this.game().getMod()?.getSurface("BACK01.SCR");
    if (back01) {
      this._window.setBackground(back01);
    }

    this._btnLoad.setText(String(this.tr("STR_LOAD_GAME")));
    this._btnLoad.onMouseClick(this.btnLoadClick.bind(this));
    this._btnSave.setText(String(this.tr("STR_SAVE_GAME")));
    this._btnSave.onMouseClick(this.btnSaveClick.bind(this));
    this._btnAbandon.setText(String(this.tr("STR_ABANDON_GAME")));
    this._btnAbandon.onMouseClick(this.btnAbandonClick.bind(this));
    this._btnOptions.setText(String(this.tr("STR_GAME_OPTIONS")));
    this._btnOptions.onMouseClick(this.btnOptionsClick.bind(this));
    this._btnCancel.setText(String(this.tr("STR_CANCEL_UC")));
    this._btnCancel.onMouseClick(this.btnCancelClick.bind(this));
    this._btnCancel.onKeyboardPress(this.btnCancelClick.bind(this), Options.keyCancel);
    this._txtTitle.setAlign(ALIGN_CENTER);
    this._txtTitle.setBig();
    this._txtTitle.setText(String(this.tr("STR_OPTIONS_UC")));

    if (this._origin === OPT_BATTLESCAPE) {
      this.applyBattlescapeTheme();
    }
    if (this.game().getSavedGame()?.isIronman?.()) {
      this._btnLoad.setVisible(false);
      this._btnSave.setVisible(false);
      this._btnAbandon.setText(String(this.tr("STR_SAVE_AND_ABANDON_GAME")));
    }
  }

  btnLoadClick(_action?: Action): void { this.game().pushState(new ListLoadState(this._origin)); }
  btnSaveClick(_action?: Action): void { this.game().pushState(new ListSaveState(this._origin)); }
  btnAbandonClick(_action?: Action): void { this.game().pushState(new AbandonGameState(this._origin)); }

  btnOptionsClick(_action?: Action): void {
    Options.backupDisplay();
    if (this._origin === OPT_GEOSCAPE) {
      this.game().pushState(new OptionsGeoscapeState(this._origin));
    } else if (this._origin === OPT_BATTLESCAPE) {
      this.game().pushState(new OptionsBattlescapeState(this._origin));
    } else {
      this.game().pushState(new OptionsVideoState(this._origin));
    }
  }

  btnCancelClick(_action?: Action): void {
    this.game().popState();
  }
}
