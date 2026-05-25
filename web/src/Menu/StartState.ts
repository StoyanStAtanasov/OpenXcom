import { State } from "../Engine/State.ts";
import { Screen } from "../Engine/Screen.ts";
import { Options, MUSIC_MIDI } from "../Engine/Options.ts";
import { Palette } from "../Engine/Palette.ts";
import { Timer } from "../Engine/Timer.ts";
import { Logger, LOG_ERROR, LOG_INFO } from "../Engine/Logger.ts";
import { Font } from "../Engine/Font.ts";
import { Text } from "../Interface/Text.ts";
import type { Action } from "../Engine/Action.ts";
import { SDL_KEYDOWN } from "../types.ts";
import { OPENXCOM_VERSION_GIT, OPENXCOM_VERSION_SHORT } from "../version.ts";
import { GoToMainMenuState } from "./MainMenuState.ts";

export const LOADING_STARTED = "LOADING_STARTED";
export const LOADING_FAILED = "LOADING_FAILED";
export const LOADING_SUCCESSFUL = "LOADING_SUCCESSFUL";
export const LOADING_DONE = "LOADING_DONE";
export type LoadingPhase = typeof LOADING_STARTED | typeof LOADING_FAILED | typeof LOADING_SUCCESSFUL | typeof LOADING_DONE;

export class StartState extends State {
  static loading: LoadingPhase = LOADING_STARTED;
  static error = "";

  private _text: Text;
  private _cursor: Text;
  private _font: Font;
  private _timer: Timer;
  private _anim = 0;
  private _oldMaster: string;
  private _output = "";

  constructor() {
    super();
    Options.newDisplayWidth = Options.displayWidth;
    Options.newDisplayHeight = Options.displayHeight;
    const geoW = { value: Options.baseXGeoscape };
    const geoH = { value: Options.baseYGeoscape };
    const battleW = { value: Options.baseXBattlescape };
    const battleH = { value: Options.baseYBattlescape };
    Screen.updateScale(Options.geoscapeScale, geoW, geoH, false);
    Screen.updateScale(Options.battlescapeScale, battleW, battleH, false);
    Options.baseXGeoscape = geoW.value;
    Options.baseYGeoscape = geoH.value;
    Options.baseXBattlescape = battleW.value;
    Options.baseYBattlescape = battleH.value;
    Options.baseXResolution = Options.displayWidth;
    Options.baseYResolution = Options.displayHeight;
    this.game().getScreen().resetDisplay();

    StartState.loading = LOADING_STARTED;
    StartState.error = "";
    this._oldMaster = Options.getActiveMaster();
    this._font = new Font();
    this._font.loadTerminal();
    this._text = new Text(Options.baseXResolution, Options.baseYResolution, 0, 0);
    this._cursor = new Text(this._font.getWidth(), this._font.getHeight(), 0, 0);
    this._timer = new Timer(150);

    this.setPalette(Palette.terminal(), 0, 2);
    this.add(this._text);
    this.add(this._cursor);
    this._text.initText(this._font, this._font, this.game().getLanguage());
    this._cursor.initText(this._font, this._font, this.game().getLanguage());
    this._text.setColor(0);
    this._text.setWordWrap(true);
    this._cursor.setColor(0);
    this._cursor.setText("_");
    this._timer.onTimer(this.animate.bind(this));
    this._timer.start();

    // Browser canvas CSS hides the native pointer, so keep the translated cursor visible while loading.
    this.game().getCursor().setVisible(true);
    this.game().getFpsCounter().setVisible(false);

    if (Options.reload) {
      this.addLine("Restarting...");
      this.addLine("");
    } else {
      this.addLine("C:\\OPENXCOM>openxcom");
    }
  }

  override init(): void {
    super.init();
    void StartState.load(this.game());
  }

  override think(): void {
    super.think();
    this._timer.think(this, null);
    switch (StartState.loading) {
      case LOADING_FAILED:
        this.addLine("");
        this.addLine(`ERROR: ${StartState.error}`);
        this.addLine("");
        this.addLine(`More details here: ${Logger.logFile()}`);
        this.addLine("Make sure OpenXcom and any mods are installed correctly.");
        this.addLine("");
        this.addLine("Press any key to continue.");
        StartState.loading = LOADING_DONE;
        break;
      case LOADING_SUCCESSFUL:
        Logger.log(LOG_INFO, "OpenXcom started successfully!");
        this.game().setState(new GoToMainMenuState());
        if (Options.reload) {
          Options.reload = false;
        }
        this.game().getCursor().setVisible(true);
        this.game().getFpsCounter().setVisible(Options.fpsCounter);
        break;
      default:
        break;
    }
  }

  override handle(action: Action): void {
    super.handle(action);
    if (StartState.loading === LOADING_DONE && action.getDetails().type === SDL_KEYDOWN) {
      this.game().quit();
    }
  }

  animate(): void {
    this._cursor.setVisible(!this._cursor.getVisible());
    this._anim++;
    if (StartState.loading === LOADING_STARTED) {
      const version = `Loading OpenXcom ${OPENXCOM_VERSION_SHORT}${OPENXCOM_VERSION_GIT}...`;
      if (Options.reload) {
        if (this._anim === 2) {
          this.addLine(version);
        }
      } else {
        switch (this._anim) {
          case 1:
            this.addLine("OpenXcom Browser Runtime");
            this.addLine("TypeScript/WebCanvas adapter");
            break;
          case 6:
            this.addLine("");
            this.addLine("OpenXcom initialisation");
            break;
          case 7:
            this.addLine("");
            if (Options.mute) {
              this.addLine("No Sound Detected");
            } else {
              this.addLine("WebAudio Sound Effects");
              this.addLine(Options.preferredMusic === MUSIC_MIDI ? "General MIDI Music" : "WebAudio Music");
            }
            this.addLine("");
            break;
          case 9:
            this.addLine(version);
            break;
        }
      }
    }
  }

  addLine(str: string): void {
    this._output += `\n${str}`;
    this._text.setText(this._output);
    const y = this._text.getTextHeight() - 13;
    const x = this._text.getTextWidth(Math.max(0, Math.floor(y / 13)));
    this._cursor.setX(x);
    this._cursor.setY(y);
  }

  static async load(game: { loadMods: () => Promise<void>; loadLanguages: () => Promise<void> }): Promise<number> {
    try {
      Logger.log(LOG_INFO, "Loading data...");
      Options.updateMods();
      await game.loadMods();
      Logger.log(LOG_INFO, "Data loaded successfully.");
      Logger.log(LOG_INFO, "Loading language...");
      await game.loadLanguages();
      Logger.log(LOG_INFO, "Language loaded successfully.");
      StartState.loading = LOADING_SUCCESSFUL;
    } catch (e) {
      StartState.error = e instanceof Error ? e.message : String(e);
      Logger.log(LOG_ERROR, StartState.error);
      StartState.loading = LOADING_FAILED;
    }
    return 0;
  }
}
