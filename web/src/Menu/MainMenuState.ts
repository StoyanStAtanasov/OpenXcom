import { State } from "../Engine/State.ts";
import { Screen } from "../Engine/Screen.ts";
import { Options } from "../Engine/Options.ts";
import { Text, ALIGN_CENTER } from "../Interface/Text.ts";
import { TextButton } from "../Interface/TextButton.ts";
import { Window, POPUP_BOTH } from "../Interface/Window.ts";
import type { Action } from "../Engine/Action.ts";
import { TOK_NL_SMALL } from "../Engine/Unicode.ts";
import { OPENXCOM_VERSION_GIT, OPENXCOM_VERSION_SHORT } from "../version.ts";
import { NewGameState } from "./NewGameState.ts";
import { NewBattleState } from "./NewBattleState.ts";
import { ListLoadState } from "./ListLoadState.ts";
import { ModListState } from "./ModListState.ts";
import { OptionsVideoState } from "./OptionsVideoState.ts";
import { OPT_MENU } from "./OptionsBaseState.ts";

export class GoToMainMenuState extends State {
  override init(): void {
    const width = { value: Options.baseXGeoscape };
    const height = { value: Options.baseYGeoscape };
    Screen.updateScale(Options.geoscapeScale, width, height, true);
    Options.baseXGeoscape = width.value;
    Options.baseYGeoscape = height.value;
    this.game().getScreen().resetDisplay();
    this.game().setState(new MainMenuState());
  }
}

export class MainMenuState extends State {
  private _btnNewGame: TextButton;
  private _btnNewBattle: TextButton;
  private _btnLoad: TextButton;
  private _btnOptions: TextButton;
  private _btnMods: TextButton;
  private _btnQuit: TextButton;
  private _window: Window;
  private _txtTitle: Text;

  constructor() {
    super();
    this._window = new Window(this, 256, 160, 32, 20, POPUP_BOTH);
    this._btnNewGame = new TextButton(92, 20, 64, 90);
    this._btnNewBattle = new TextButton(92, 20, 164, 90);
    this._btnLoad = new TextButton(92, 20, 64, 118);
    this._btnOptions = new TextButton(92, 20, 164, 118);
    this._btnMods = new TextButton(92, 20, 64, 146);
    this._btnQuit = new TextButton(92, 20, 164, 146);
    this._txtTitle = new Text(256, 30, 32, 45);

    this.setInterface("mainMenu");
    this.add(this._window, "window", "mainMenu");
    this.add(this._btnNewGame, "button", "mainMenu");
    this.add(this._btnNewBattle, "button", "mainMenu");
    this.add(this._btnLoad, "button", "mainMenu");
    this.add(this._btnOptions, "button", "mainMenu");
    this.add(this._btnMods, "button", "mainMenu");
    this.add(this._btnQuit, "button", "mainMenu");
    this.add(this._txtTitle, "text", "mainMenu");
    this.centerAllSurfaces();

    const back01 = this.game().getMod()?.getSurface("BACK01.SCR");
    if (back01) {
      this._window.setBackground(back01);
    }

    this._btnNewGame.setText(String(this.tr("STR_NEW_GAME")));
    this._btnNewGame.onMouseClick(this.btnNewGameClick.bind(this));
    this._btnNewBattle.setText(String(this.tr("STR_NEW_BATTLE")));
    this._btnNewBattle.onMouseClick(this.btnNewBattleClick.bind(this));
    this._btnLoad.setText(String(this.tr("STR_LOAD_SAVED_GAME")));
    this._btnLoad.onMouseClick(this.btnLoadClick.bind(this));
    this._btnOptions.setText(String(this.tr("STR_OPTIONS")));
    this._btnOptions.onMouseClick(this.btnOptionsClick.bind(this));
    this._btnMods.setText(String(this.tr("STR_MODS")));
    this._btnMods.onMouseClick(this.btnModsClick.bind(this));
    this._btnQuit.setText(String(this.tr("STR_QUIT")));
    this._btnQuit.onMouseClick(this.btnQuitClick.bind(this));

    this._txtTitle.setAlign(ALIGN_CENTER);
    this._txtTitle.setBig();
    this._txtTitle.setText(`${String(this.tr("STR_OPENXCOM"))}${String.fromCharCode(TOK_NL_SMALL)}${OPENXCOM_VERSION_SHORT}${OPENXCOM_VERSION_GIT}`);
  }

  btnNewGameClick(_action: Action): void {
    this.game().pushState(new NewGameState());
  }

  btnNewBattleClick(_action: Action): void {
    this.game().pushState(new NewBattleState());
  }

  btnLoadClick(_action: Action): void {
    this.game().pushState(new ListLoadState(OPT_MENU));
  }

  btnOptionsClick(_action: Action): void {
    Options.backupDisplay();
    this.game().pushState(new OptionsVideoState(OPT_MENU));
  }

  btnModsClick(_action: Action): void {
    this.game().pushState(new ModListState());
  }

  btnQuitClick(_action: Action): void {
    this.game().quit();
  }

  override resize(dX: { value: number }, dY: { value: number }): void {
    dX.value = Options.baseXResolution;
    dY.value = Options.baseYResolution;
    const width = { value: Options.baseXGeoscape };
    const height = { value: Options.baseYGeoscape };
    Screen.updateScale(Options.geoscapeScale, width, height, true);
    Options.baseXGeoscape = width.value;
    Options.baseYGeoscape = height.value;
    dX.value = Options.baseXResolution - dX.value;
    dY.value = Options.baseYResolution - dY.value;
    super.resize(dX, dY);
  }
}
