import { Options } from "../Engine/Options.ts";
import { Screen } from "../Engine/Screen.ts";
import { State } from "../Engine/State.ts";
import { Timer } from "../Engine/Timer.ts";
import type { Action } from "../Engine/Action.ts";
import { Text, ALIGN_CENTER } from "../Interface/Text.ts";
import { TextButton } from "../Interface/TextButton.ts";
import { Window, POPUP_BOTH } from "../Interface/Window.ts";
import { OPT_BATTLESCAPE, type OptionsOrigin, OptionsBaseState } from "./OptionsBaseState.ts";

export class OptionsConfirmState extends State {
  private _btnYes: TextButton;
  private _btnNo: TextButton;
  private _window: Window;
  private _txtTitle: Text;
  private _txtTimer: Text;
  private _timer: Timer;
  private _countdown = 15;

  constructor(private _origin: OptionsOrigin) {
    super();
    this._screen = false;
    this._window = new Window(this, 216, 100, 52, 50, POPUP_BOTH);
    this._btnYes = new TextButton(50, 20, 70, 120);
    this._btnNo = new TextButton(50, 20, 200, 120);
    this._txtTitle = new Text(206, 20, 57, 70);
    this._txtTimer = new Text(206, 20, 57, 100);
    this._timer = new Timer(1000);

    this.setInterface("optionsMenu", false, this.game().getSavedGame()?.getSavedBattle?.() ?? null);
    this.add(this._window, "confirmVideo", "optionsMenu");
    this.add(this._btnYes, "confirmVideo", "optionsMenu");
    this.add(this._btnNo, "confirmVideo", "optionsMenu");
    this.add(this._txtTitle, "confirmVideo", "optionsMenu");
    this.add(this._txtTimer, "confirmVideo", "optionsMenu");
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
    this._txtTitle.setWordWrap(true);
    this._txtTitle.setText(String(this.tr("STR_DISPLAY_OPTIONS_CONFIRM")));
    this._txtTimer.setAlign(ALIGN_CENTER);
    this._txtTimer.setWordWrap(true);
    this._txtTimer.setText(this.revertText());

    if (this._origin === OPT_BATTLESCAPE) {
      this.applyBattlescapeTheme();
    }
    this._timer.onTimer(this.countdown.bind(this));
    this._timer.start();
  }

  override think(): void {
    super.think();
    this._timer.think(this, null);
  }

  countdown(): void {
    this._countdown--;
    this._txtTimer.setText(this.revertText());
    if (this._countdown === 0) {
      this.btnNoClick();
    }
  }

  btnYesClick(_action?: Action): void {
    this.game().popState();
    OptionsBaseState.restart(this._origin);
  }

  btnNoClick(_action?: Action): void {
    Options.switchDisplay();
    const battleW = { value: Options.baseXBattlescape };
    const battleH = { value: Options.baseYBattlescape };
    const geoW = { value: Options.baseXGeoscape };
    const geoH = { value: Options.baseYGeoscape };
    Screen.updateScale(Options.battlescapeScale, battleW, battleH, this._origin === OPT_BATTLESCAPE);
    Screen.updateScale(Options.geoscapeScale, geoW, geoH, this._origin !== OPT_BATTLESCAPE);
    Options.baseXBattlescape = battleW.value;
    Options.baseYBattlescape = battleH.value;
    Options.baseXGeoscape = geoW.value;
    Options.baseYGeoscape = geoH.value;
    Options.save();
    this.game().getScreen().resetDisplay();
    this.game().popState();
    OptionsBaseState.restart(this._origin);
  }

  private revertText(): string {
    return String(this.tr("STR_DISPLAY_OPTIONS_REVERT")).replace("{0}", String(this._countdown).padStart(2, "0"));
  }
}
