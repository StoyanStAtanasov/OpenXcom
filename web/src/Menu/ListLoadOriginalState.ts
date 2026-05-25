import type { Action } from "../Engine/Action.ts";
import { Logger, LOG_ERROR } from "../Engine/Logger.ts";
import { Options } from "../Engine/Options.ts";
import { State } from "../Engine/State.ts";
import { Text, ALIGN_CENTER } from "../Interface/Text.ts";
import { TextButton } from "../Interface/TextButton.ts";
import { Window } from "../Interface/Window.ts";
import { BattlescapeState } from "../Battlescape/BattlescapeState.ts";
import { GeoscapeState } from "../Geoscape/GeoscapeState.ts";
import { ErrorMessageState } from "./ErrorMessageState.ts";
import { type OptionsOrigin, OPT_BATTLESCAPE } from "./OptionsBaseState.ts";
import { SDL_BUTTON_RIGHT } from "../types.ts";
import { type Game } from "../Engine/Game.ts";
import { SaveConverter, type SaveOriginal } from "../Savegame/SaveConverter.ts";

const NUM_SAVES = 10;

function getSaveConverterList(game: Game): SaveOriginal[] {
  return SaveConverter.getList(game.getLanguage());
}

async function loadOriginalSave(game: Game, id: number): Promise<boolean> {
  const converter = new SaveConverter(id, game.getMod());
  const save = converter.loadOriginal();
  game.setSavedGame(save);
  Options.baseXResolution = Options.baseXGeoscape;
  Options.baseYResolution = Options.baseYGeoscape;
  game.getScreen().resetDisplay();
  game.setState(new GeoscapeState());
  const battle = save.getSavedBattle();
  const mod = game.getMod();
  if (battle && mod) {
    await battle.loadMapResources(mod);
    Options.baseXResolution = Options.baseXBattlescape;
    Options.baseYResolution = Options.baseYBattlescape;
    game.getScreen().resetDisplay();
    const bs = new BattlescapeState(battle);
    game.pushState(bs);
    battle.setBattleState(bs);
  }
  return true;
}

export class ListLoadOriginalState extends State {
  private _btnNew: TextButton;
  private _btnImport: TextButton;
  private _btnCancel: TextButton;
  private _window: Window;
  private _txtTitle: Text;
  private _txtName: Text;
  private _txtTime: Text;
  private _txtDate: Text;
  private _btnSlot: TextButton[] = [];
  private _txtSlotName: Text[] = [];
  private _txtSlotTime: Text[] = [];
  private _txtSlotDate: Text[] = [];
  private _saves: SaveOriginal[] = [];
  private _origin: OptionsOrigin;

  constructor(origin: OptionsOrigin) {
    super();
    this._origin = origin;
    this._screen = false;

    this._window = new Window(this, 320, 200, 0, 0);
    this._btnNew = new TextButton(80, 16, 20, 172);
    this._btnImport = new TextButton(80, 16, 120, 172);
    this._btnCancel = new TextButton(80, 16, 220, 172);
    this._txtTitle = new Text(310, 17, 5, 7);
    this._txtName = new Text(160, 9, 36, 24);
    this._txtTime = new Text(30, 9, 195, 24);
    this._txtDate = new Text(90, 9, 225, 24);

    this.setInterface("geoscape", true, this.game().getSavedGame()?.getSavedBattle?.() ?? null);

    this.add(this._window, "window", "saveMenus");
    this.add(this._btnNew, "button", "saveMenus");
    this.add(this._btnImport, "button", "saveMenus");
    this.add(this._btnCancel, "button", "saveMenus");
    this.add(this._txtTitle, "text", "saveMenus");
    this.add(this._txtName, "text", "saveMenus");
    this.add(this._txtTime, "text", "saveMenus");
    this.add(this._txtDate, "text", "saveMenus");

    let y = 34;
    for (let i = 0; i < NUM_SAVES; ++i) {
      const slotButton = new TextButton(24, 12, 10, y - 2);
      const slotName = new Text(160, 9, 36, y);
      const slotTime = new Text(30, 9, 195, y);
      const slotDate = new Text(90, 9, 225, y);
      this._btnSlot.push(slotButton);
      this._txtSlotName.push(slotName);
      this._txtSlotTime.push(slotTime);
      this._txtSlotDate.push(slotDate);
      this.add(slotButton, "button", "saveMenus");
      this.add(slotName, "list", "saveMenus");
      this.add(slotTime, "list", "saveMenus");
      this.add(slotDate, "list", "saveMenus");
      y += 14;
    }

    this.centerAllSurfaces();

    const back01 = this.game().getMod()?.getSurface("BACK01.SCR");
    if (back01) {
      this._window.setBackground(back01);
    }

    this._btnNew.setText(String(this.tr("STR_OPENXCOM")));
    this._btnNew.onMouseClick(this.btnNewClick.bind(this));
    this._btnNew.onKeyboardPress(this.btnNewClick.bind(this), Options.keyCancel);

    this._btnImport.setText("IMPORT");
    this._btnImport.onMouseClick(this.btnImportClick.bind(this));

    this._btnCancel.setText(String(this.tr("STR_CANCEL")));
    this._btnCancel.onMouseClick(this.btnCancelClick.bind(this));
    this._btnCancel.onKeyboardPress(this.btnCancelClick.bind(this), Options.keyCancel);

    this._txtTitle.setBig();
    this._txtTitle.setAlign(ALIGN_CENTER);
    this._txtTitle.setText(String(this.tr("STR_SELECT_GAME_TO_LOAD")));
    this._txtName.setText(String(this.tr("STR_NAME")));
    this._txtTime.setText(String(this.tr("STR_TIME")));
    this._txtDate.setText(String(this.tr("STR_DATE")));

    this.refreshList();
  }

  private refreshList(): void {
    const dots = ".".repeat(80);
    this._saves = getSaveConverterList(this.game());
    for (let i = 0; i < NUM_SAVES; ++i) {
      const slotNumber = String(i + 1);
      this._btnSlot[i].setText(slotNumber);
      this._btnSlot[i].onMouseClick(this.btnSlotClick.bind(this));
      this._txtSlotName[i].setText(`${this._saves[i].error || this._saves[i].name}${dots}`);
      this._txtSlotTime[i].setText(this._saves[i].time);
      this._txtSlotDate[i].setText(this._saves[i].date);
    }
  }

  override init(): void {
    super.init();
    if (this._origin === OPT_BATTLESCAPE) {
      this.applyBattlescapeTheme();
    }
  }

  btnNewClick(_action?: Action): void {
    this.game().popState();
  }

  btnImportClick(_action?: Action): void {
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = true;
    input.setAttribute("webkitdirectory", "");
    input.style.display = "none";
    input.addEventListener("change", () => {
      const files = input.files ? Array.from(input.files) : [];
      input.remove();
      void SaveConverter.importOriginalFiles(files, this.game().getLanguage())
        .then(() => this.refreshList())
        .catch(error => this.showError(error instanceof Error ? error.message : String(error)));
    }, { once: true });
    document.body.appendChild(input);
    input.click();
  }

  private showError(message: string): void {
    const interfaceRules = this.game().getMod()?.getInterface("errorMessages");
    const color = interfaceRules?.getElement("geoscapeColor")?.color ?? 1;
    const palette = interfaceRules?.getElement("geoscapePalette")?.color ?? -1;
    const error = `${String(this.tr("STR_LOAD_UNSUCCESSFUL"))}${String.fromCharCode(2)}${message}`;
    this.game().pushState(new ErrorMessageState(error, this._palette, color, "BACK01.SCR", palette));
  }

  btnCancelClick(_action?: Action): void {
    this.game().popState();
    this.game().popState();
  }

  btnSlotClick(action: Action): void {
    let n = 0;
    for (let i = 0; i < NUM_SAVES; ++i) {
      if (action.getSender() === this._btnSlot[i]) {
        n = i;
        break;
      }
    }
    if (this._saves[n]?.id > 0) {
      if (this._saves[n].tactical) {
        const interfaceRules = this.game().getMod()?.getInterface("errorMessages");
        const color = interfaceRules?.getElement("geoscapeColor")?.color ?? 1;
        const palette = interfaceRules?.getElement("geoscapePalette")?.color ?? -1;
        const error = `${String(this.tr("STR_LOAD_UNSUCCESSFUL"))}${String.fromCharCode(2)}Battlescape saves aren't supported.`;
        this.game().pushState(new ErrorMessageState(error, this._palette, color, "BACK01.SCR", palette));
      } else {
        void loadOriginalSave(this.game(), this._saves[n].id).catch(error => {
          Logger.log(LOG_ERROR, error instanceof Error ? error.message : String(error));
          this.showError(error instanceof Error ? error.message : String(error));
        });
      }
    }
  }
}
