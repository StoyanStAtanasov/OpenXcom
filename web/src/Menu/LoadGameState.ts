import { Logger, LOG_ERROR } from "../Engine/Logger.ts";
import { Options } from "../Engine/Options.ts";
import { Screen } from "../Engine/Screen.ts";
import { fileExists } from "../Engine/CrossPlatform.ts";
import { State } from "../Engine/State.ts";
import { Text } from "../Interface/Text.ts";
import { ErrorMessageState } from "./ErrorMessageState.ts";
import { type OptionsOrigin, OPT_BATTLESCAPE } from "./OptionsBaseState.ts";
import { GeoscapeState } from "../Geoscape/GeoscapeState.ts";
import { BattlescapeState } from "../Battlescape/BattlescapeState.ts";
import { StatisticsState } from "./StatisticsState.ts";
import { SavedGame, GameEnding } from "../Savegame/SavedGame.ts";
import type { PaletteColor } from "../types.ts";

type SoundDepthModLike = {
  getSoundByDepth?: (depth: number, sound: number, error?: boolean) => { stopLoop?: () => void } | null;
};

function saveExists(filename: string): boolean {
  return fileExists(`${Options.getMasterUserFolder()}${filename}`);
}

export class LoadGameState extends State {
  private _firstRun = 0;
  private _origin: OptionsOrigin;
  private _txtStatus!: Text;
  private _filename: string;

  constructor(origin: OptionsOrigin, filename: string, palette: PaletteColor[] | null);
  constructor(origin: OptionsOrigin, type: number, palette: PaletteColor[] | null);
  constructor(origin: OptionsOrigin, filenameOrType: string | number, palette: PaletteColor[] | null) {
    super();
    this._origin = origin;
    this._filename = "";
    if (typeof filenameOrType === "number") {
      switch (filenameOrType) {
        case 1:
          this._filename = SavedGame.QUICKSAVE;
          break;
        case 2:
          this._filename = SavedGame.AUTOSAVE_GEOSCAPE;
          break;
        case 3:
          this._filename = SavedGame.AUTOSAVE_BATTLESCAPE;
          break;
        default:
          break;
      }
    } else {
      this._filename = filenameOrType;
    }
    this.buildUi(palette);
  }

  override init(): void {
    super.init();
    if (this._filename === SavedGame.QUICKSAVE && !saveExists(this._filename)) {
      this.game().popState();
    }
  }

  buildUi(palette: PaletteColor[] | null): void {
    this._screen = false;
    this._txtStatus = new Text(320, 17, 0, 92);
    this.setPalette(palette);
    if (this._origin === OPT_BATTLESCAPE) {
      this.add(this._txtStatus, "textLoad", "battlescape");
      this._txtStatus.setHighContrast(true);
      const ambient = this.game().getSavedGame()?.getSavedBattle?.()?.getAmbientSound?.() ?? -1;
      if (ambient !== -1) {
        (this.game().getMod() as SoundDepthModLike | null)?.getSoundByDepth?.(0, ambient)?.stopLoop?.();
      }
    } else {
      this.add(this._txtStatus, "textLoad", "geoscape");
    }
    this.centerAllSurfaces();
    this._txtStatus.setBig();
    this._txtStatus.setAlign("ALIGN_CENTER");
    this._txtStatus.setText(String(this.tr("STR_LOADING_GAME")));
  }

  override think(): void {
    super.think();
    if (this._firstRun < 10) {
      this._firstRun++;
      return;
    }

    this.game().popState();
    const save = new SavedGame();
    try {
      save.load(this._filename, this.game().getMod());
      this.game().setSavedGame(save);
      if (save.getEnding() !== GameEnding.END_NONE) {
        Options.baseXResolution = Screen.ORIGINAL_WIDTH;
        Options.baseYResolution = Screen.ORIGINAL_HEIGHT;
        this.game().getScreen().resetDisplay();
        this.game().setState(new StatisticsState());
      } else {
        Options.baseXResolution = Options.baseXGeoscape;
        Options.baseYResolution = Options.baseYGeoscape;
        this.game().getScreen().resetDisplay();
        this.game().setState(new GeoscapeState());
        const battle = save.getSavedBattle();
        const mod = this.game().getMod();
        if (battle && mod) {
          void battle.loadMapResources(mod).then(() => {
            Options.baseXResolution = Options.baseXBattlescape;
            Options.baseYResolution = Options.baseYBattlescape;
            this.game().getScreen().resetDisplay();
            const bs = new BattlescapeState();
            this.game().pushState(bs);
            battle.setBattleState(bs);
          }).catch(error => {
            this.error(error instanceof Error ? error.message : String(error), save);
          });
        }
      }
    } catch (error) {
      this.error(error instanceof Error ? error.message : String(error), save);
    }
  }

  error(msg: string, save: SavedGame): void {
    Logger.log(LOG_ERROR, msg);
    const error = `${String(this.tr("STR_LOAD_UNSUCCESSFUL"))}${String.fromCharCode(2)}${msg}`;
    const errorMessages = this.game().getMod()?.getInterface("errorMessages");
    const colorId = this._origin !== OPT_BATTLESCAPE ? "geoscapeColor" : "battlescapeColor";
    const paletteId = this._origin !== OPT_BATTLESCAPE ? "geoscapePalette" : "battlescapePalette";
    const bg = this._origin !== OPT_BATTLESCAPE ? "BACK01.SCR" : "TAC00.SCR";
    const color = errorMessages?.getElement(colorId)?.color ?? 1;
    const palette = errorMessages?.getElement(paletteId)?.color ?? -1;
    this.game().pushState(new ErrorMessageState(error, this._palette, color, bg, palette));
    if (this.game().getSavedGame() === save) {
      this.game().setSavedGame(null);
    }
  }
}
