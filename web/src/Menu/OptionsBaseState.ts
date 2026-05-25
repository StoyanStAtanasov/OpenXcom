import { Options } from "../Engine/Options.ts";
import { Screen } from "../Engine/Screen.ts";
import { State } from "../Engine/State.ts";
import type { Action } from "../Engine/Action.ts";
import { Text } from "../Interface/Text.ts";
import { TextButton } from "../Interface/TextButton.ts";
import { Window } from "../Interface/Window.ts";
import { BattlescapeState } from "../Battlescape/BattlescapeState.ts";
import { GeoscapeState } from "../Geoscape/GeoscapeState.ts";
import { MainMenuState } from "./MainMenuState.ts";
import { OptionsConfirmState } from "./OptionsConfirmState.ts";
import { OptionsDefaultsState } from "./OptionsDefaultsState.ts";
import { OptionsOrigin, OPT_MENU, OPT_GEOSCAPE, OPT_BATTLESCAPE } from "./OptionsOrigin.ts";
import { StartState } from "./StartState.ts";

export { OptionsOrigin, OPT_MENU, OPT_GEOSCAPE, OPT_BATTLESCAPE } from "./OptionsOrigin.ts";

type OptionsStateCtor = new (origin: OptionsOrigin) => State;

export class OptionsBaseState extends State {
  protected _origin: OptionsOrigin;
  protected _window: Window;
  protected _btnVideo: TextButton;
  protected _btnAudio: TextButton;
  protected _btnControls: TextButton;
  protected _btnGeoscape: TextButton;
  protected _btnBattlescape: TextButton;
  protected _btnAdvanced: TextButton;
  protected _btnFolders: TextButton;
  protected _btnOk: TextButton;
  protected _btnCancel: TextButton;
  protected _btnDefault: TextButton;
  protected _txtTooltip: Text;
  protected _currentTooltip = "";
  protected _group: { value: TextButton | null } = { value: null };

  constructor(origin: OptionsOrigin) {
    super();
    this._origin = origin;

    this._window = new Window(this, 320, 200, 0, 0);
    this._btnVideo = new TextButton(80, 16, 8, 8);
    this._btnAudio = new TextButton(80, 16, 8, 28);
    this._btnControls = new TextButton(80, 16, 8, 48);
    this._btnGeoscape = new TextButton(80, 16, 8, 68);
    this._btnBattlescape = new TextButton(80, 16, 8, 88);
    this._btnAdvanced = new TextButton(80, 16, 8, 108);
    this._btnFolders = new TextButton(80, 16, 8, 128);
    this._btnOk = new TextButton(100, 16, 8, 176);
    this._btnCancel = new TextButton(100, 16, 110, 176);
    this._btnDefault = new TextButton(100, 16, 212, 176);
    this._txtTooltip = new Text(305, 25, 8, 148);

    this.setInterface("optionsMenu", false, this.game().getSavedGame()?.getSavedBattle?.() ?? null);
    this.add(this._window, "window", "optionsMenu");
    this.add(this._btnVideo, "button", "optionsMenu");
    this.add(this._btnAudio, "button", "optionsMenu");
    this.add(this._btnControls, "button", "optionsMenu");
    this.add(this._btnGeoscape, "button", "optionsMenu");
    this.add(this._btnBattlescape, "button", "optionsMenu");
    this.add(this._btnAdvanced, "button", "optionsMenu");
    this.add(this._btnFolders, "button", "optionsMenu");
    this.add(this._btnOk, "button", "optionsMenu");
    this.add(this._btnCancel, "button", "optionsMenu");
    this.add(this._btnDefault, "button", "optionsMenu");
    this.add(this._txtTooltip, "tooltip", "optionsMenu");

    const back01 = this.game().getMod()?.getSurface("BACK01.SCR");
    if (back01) {
      this._window.setBackground(back01);
    }

    this._btnVideo.setText(String(this.tr("STR_VIDEO")));
    this._btnVideo.onMousePress(this.btnGroupPress.bind(this));
    this._btnAudio.setText(String(this.tr("STR_AUDIO")));
    this._btnAudio.onMousePress(this.btnGroupPress.bind(this));
    this._btnControls.setText(String(this.tr("STR_CONTROLS")));
    this._btnControls.onMousePress(this.btnGroupPress.bind(this));
    this._btnGeoscape.setText(String(this.tr("STR_GEOSCAPE_UC")));
    this._btnGeoscape.onMousePress(this.btnGroupPress.bind(this));
    this._btnBattlescape.setText(String(this.tr("STR_BATTLESCAPE_UC")));
    this._btnBattlescape.onMousePress(this.btnGroupPress.bind(this));
    this._btnAdvanced.setText(String(this.tr("STR_ADVANCED")));
    this._btnAdvanced.onMousePress(this.btnGroupPress.bind(this));
    this._btnFolders.setText(String(this.tr("STR_FOLDERS")));
    this._btnFolders.onMousePress(this.btnGroupPress.bind(this));

    this._btnOk.setText(String(this.tr("STR_OK")));
    this._btnOk.onMouseClick(this.btnOkClick.bind(this));
    this._btnOk.onKeyboardPress(this.btnOkClick.bind(this), Options.keyOk);
    this._btnCancel.setText(String(this.tr("STR_CANCEL")));
    this._btnCancel.onMouseClick(this.btnCancelClick.bind(this));
    this._btnCancel.onKeyboardPress(this.btnCancelClick.bind(this), Options.keyCancel);
    this._btnDefault.setText(String(this.tr("STR_RESTORE_DEFAULTS")));
    this._btnDefault.onMouseClick(this.btnDefaultClick.bind(this));
    this._txtTooltip.setWordWrap(true);
  }

  static restart(origin: OptionsOrigin): void {
    if (origin === OPT_MENU) {
      OptionsBaseState._game.setState(new MainMenuState());
    } else if (origin === OPT_GEOSCAPE) {
      OptionsBaseState._game.setState(new GeoscapeState());
    } else if (origin === OPT_BATTLESCAPE) {
      OptionsBaseState._game.setState(new GeoscapeState());
      const bs = new BattlescapeState();
      OptionsBaseState._game.pushState(bs);
      const savedBattle = OptionsBaseState._game.getSavedGame()?.getSavedBattle?.();
      savedBattle?.setBattleState?.(bs);
    }
  }

  override init(): void {
    super.init();
    if (this._origin === OPT_BATTLESCAPE) {
      this.applyBattlescapeTheme();
    }
  }

  setCategory(button: TextButton): void {
    this._group.value = button;
    this._btnVideo.setGroup(this._group);
    this._btnAudio.setGroup(this._group);
    this._btnControls.setGroup(this._group);
    this._btnGeoscape.setGroup(this._group);
    this._btnBattlescape.setGroup(this._group);
    this._btnAdvanced.setGroup(this._group);
    this._btnFolders.setGroup(this._group);
  }

  btnOkClick(_action?: Action): void {
    Options.switchDisplay();
    const oldX = Options.baseXResolution;
    const oldY = Options.baseYResolution;
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
    this.recenter(Options.baseXResolution - oldX, Options.baseYResolution - oldY);
    Options.save();
    if (Options.reload && this._origin === OPT_MENU) {
      Options.mapResources();
    }
    void this.game().loadLanguages();
    this.game().getScreen().resetDisplay();
    this.game().setVolume(Options.soundVolume, Options.musicVolume, Options.uiVolume);
    if (Options.reload && this._origin === OPT_MENU) {
      this.game().setState(new StartState());
    } else if (
      Options.displayWidth !== Options.newDisplayWidth ||
      Options.displayHeight !== Options.newDisplayHeight ||
      Options.useOpenGL !== Options.newOpenGL ||
      Options.useScaleFilter !== Options.newScaleFilter ||
      Options.useHQXFilter !== Options.newHQXFilter ||
      Options.useOpenGLShader !== Options.newOpenGLShader
    ) {
      this.game().pushState(new OptionsConfirmState(this._origin));
    } else {
      OptionsBaseState.restart(this._origin);
    }
  }

  btnCancelClick(_action?: Action): void {
    Options.reload = false;
    Options.load();
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
    this.game().setVolume(Options.soundVolume, Options.musicVolume, Options.uiVolume);
    this.game().popState();
  }

  btnDefaultClick(_action?: Action): void {
    this.game().pushState(new OptionsDefaultsState(this._origin, this));
  }

  async btnGroupPress(action: Action): Promise<void> {
    const sender = action.getSender();
    this.game().popState();
    const ctor = await this.optionStateForSender(sender);
    this.game().pushState(new ctor(this._origin));
  }

  txtTooltipIn(action: Action): void {
    const sender = action.getSender() as { getTooltip?: () => string } | null;
    this._currentTooltip = sender?.getTooltip?.() || "";
    this._txtTooltip.setText(String(this.tr(this._currentTooltip)));
  }

  txtTooltipOut(action: Action): void {
    const sender = action.getSender() as { getTooltip?: () => string } | null;
    if (this._currentTooltip === (sender?.getTooltip?.() || "")) {
      this._txtTooltip.setText("");
    }
  }

  override resize(dX: { value: number }, dY: { value: number }): void {
    Options.newDisplayWidth = Options.displayWidth;
    Options.newDisplayHeight = Options.displayHeight;
    super.resize(dX, dY);
  }

  private async optionStateForSender(sender: unknown): Promise<OptionsStateCtor> {
    if (sender === this._btnVideo) {
      return (await import("./OptionsVideoState.js")).OptionsVideoState;
    }
    if (sender === this._btnAudio) {
      return Options.mute
        ? (await import("./OptionsNoAudioState.js")).OptionsNoAudioState
        : (await import("./OptionsAudioState.js")).OptionsAudioState;
    }
    if (sender === this._btnControls) {
      return (await import("./OptionsControlsState.js")).OptionsControlsState;
    }
    if (sender === this._btnGeoscape) {
      return (await import("./OptionsGeoscapeState.js")).OptionsGeoscapeState;
    }
    if (sender === this._btnBattlescape) {
      return (await import("./OptionsBattlescapeState.js")).OptionsBattlescapeState;
    }
    if (sender === this._btnAdvanced) {
      return (await import("./OptionsAdvancedState.js")).OptionsAdvancedState;
    }
    if (sender === this._btnFolders) {
      return (await import("./OptionsFoldersState.js")).OptionsFoldersState;
    }
    return (await import("./OptionsVideoState.js")).OptionsVideoState;
  }
}
