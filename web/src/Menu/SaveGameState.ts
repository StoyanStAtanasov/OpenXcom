import { Logger, LOG_ERROR } from "../Engine/Logger.ts";
import { Options } from "../Engine/Options.ts";
import { Screen } from "../Engine/Screen.ts";
import { State } from "../Engine/State.ts";
import { Text } from "../Interface/Text.ts";
import { ErrorMessageState } from "./ErrorMessageState.ts";
import { MainMenuState } from "./MainMenuState.ts";
import { type OptionsOrigin, OPT_BATTLESCAPE } from "./OptionsBaseState.ts";
import { SavedGame } from "../Savegame/SavedGame.ts";
import type { PaletteColor } from "../types.ts";

export enum SaveType {
  SAVE_DEFAULT = 0,
  SAVE_QUICK = 1,
  SAVE_AUTO_GEOSCAPE = 2,
  SAVE_AUTO_BATTLESCAPE = 3,
  SAVE_IRONMAN = 4,
  SAVE_IRONMAN_END = 5
}

const QUICKSAVE = "_quick_.asav";
const AUTOSAVE_GEOSCAPE = "_autogeo_.asav";
const AUTOSAVE_BATTLESCAPE = "_autobattle_.asav";

type SavedGameSaver = SavedGame & {
  save?: (filename: string) => void;
  getName?: () => string;
};

function sanitizeFilename(name: string): string {
  return name
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_")
    .replace(/[. ]+$/g, "")
    .trim();
}

function saveGame(save: SavedGame, filename: string): void {
  const saver = save as SavedGameSaver;
  if (!saver.save) {
    throw new Error("SavedGame.save is not translated yet.");
  }
  saver.save(filename);
}

export class SaveGameState extends State {
  private _firstRun = 0;
  private _origin: OptionsOrigin;
  private _txtStatus!: Text;
  private _filename = "";
  private _type = SaveType.SAVE_DEFAULT;

  constructor(origin: OptionsOrigin, filename: string, palette: PaletteColor[] | null);
  constructor(origin: OptionsOrigin, type: SaveType, palette: PaletteColor[] | null);
  constructor(origin: OptionsOrigin, filenameOrType: string | SaveType, palette: PaletteColor[] | null) {
    super();
    this._origin = origin;
    if (typeof filenameOrType === "number") {
      this._type = filenameOrType;
      switch (filenameOrType) {
        case SaveType.SAVE_QUICK:
          this._filename = QUICKSAVE;
          break;
        case SaveType.SAVE_AUTO_GEOSCAPE:
          this._filename = AUTOSAVE_GEOSCAPE;
          break;
        case SaveType.SAVE_AUTO_BATTLESCAPE:
          this._filename = AUTOSAVE_BATTLESCAPE;
          break;
        case SaveType.SAVE_IRONMAN:
        case SaveType.SAVE_IRONMAN_END: {
          const currentName = this.game().getSavedGame() as SavedGameSaver | null;
          this._filename = `${sanitizeFilename(currentName?.getName?.() || "ironman")}.sav`;
          break;
        }
        default:
          break;
      }
    } else {
      this._filename = filenameOrType;
      this._type = SaveType.SAVE_DEFAULT;
    }
    this.buildUi(palette);
  }

  buildUi(palette: PaletteColor[] | null): void {
    this._screen = false;
    this._txtStatus = new Text(320, 17, 0, 92);
    this.setPalette(palette);
    if (this._origin === OPT_BATTLESCAPE) {
      this.add(this._txtStatus, "textLoad", "battlescape");
      this._txtStatus.setHighContrast(true);
    } else {
      this.add(this._txtStatus, "textLoad", "geoscape");
    }
    this.centerAllSurfaces();
    this._txtStatus.setBig();
    this._txtStatus.setAlign("ALIGN_CENTER");
    this._txtStatus.setText(String(this.tr("STR_SAVING_GAME")));
  }

  override think(): void {
    super.think();
    if (this._firstRun < 10) {
      this._firstRun++;
      return;
    }

    this.game().popState();
    switch (this._type) {
      case SaveType.SAVE_DEFAULT:
        this.game().popState();
        if (!this.game().getSavedGame()?.isIronman()) {
          this.game().popState();
        }
        break;
      case SaveType.SAVE_QUICK:
      case SaveType.SAVE_AUTO_GEOSCAPE:
      case SaveType.SAVE_AUTO_BATTLESCAPE:
        this.game().getSavedGame()?.setName(this._filename);
        break;
      default:
        break;
    }

    try {
      saveGame(this.game().getSavedGame() || new SavedGame(), this._filename);
      if (this._type === SaveType.SAVE_IRONMAN_END) {
        Options.baseXResolution = Options.baseXGeoscape;
        Options.baseYResolution = Options.baseYGeoscape;
        this.game().getScreen().resetDisplay();
        this.game().setState(new MainMenuState());
        this.game().setSavedGame(null);
      }
    } catch (error) {
      this.error(error instanceof Error ? error.message : String(error));
    }
  }

  error(msg: string): void {
    Logger.log(LOG_ERROR, msg);
    const error = `${String(this.tr("STR_SAVE_UNSUCCESSFUL"))}${String.fromCharCode(2)}${msg}`;
    const errorMessages = this.game().getMod()?.getInterface("errorMessages");
    const colorId = this._origin !== OPT_BATTLESCAPE ? "geoscapeColor" : "battlescapeColor";
    const paletteId = this._origin !== OPT_BATTLESCAPE ? "geoscapePalette" : "battlescapePalette";
    const bg = this._origin !== OPT_BATTLESCAPE ? "BACK01.SCR" : "TAC00.SCR";
    const color = errorMessages?.getElement(colorId)?.color ?? 1;
    const palette = errorMessages?.getElement(paletteId)?.color ?? -1;
    this.game().pushState(new ErrorMessageState(error, this._palette, color, bg, palette));
  }
}
