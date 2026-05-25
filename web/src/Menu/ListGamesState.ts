import { Logger, LOG_ERROR } from "../Engine/Logger.ts";
import { Options } from "../Engine/Options.ts";
import { State } from "../Engine/State.ts";
import { InteractiveSurface } from "../Engine/InteractiveSurface.ts";
import type { Action } from "../Engine/Action.ts";
import { Text, ALIGN_CENTER } from "../Interface/Text.ts";
import { TextButton } from "../Interface/TextButton.ts";
import { TextList } from "../Interface/TextList.ts";
import { Window, POPUP_BOTH } from "../Interface/Window.ts";
import { SDL_BUTTON_RIGHT } from "../types.ts";
import type { Game } from "../Engine/Game.ts";
import { OPT_BATTLESCAPE, type OptionsOrigin } from "./OptionsBaseState.ts";
import { DeleteGameState } from "./DeleteGameState.ts";
import { SavedGame, type SaveInfo } from "../Savegame/SavedGame.ts";

export const SORT_NAME_ASC = 0;
export const SORT_NAME_DESC = 1;
export const SORT_DATE_ASC = 2;
export const SORT_DATE_DESC = 3;
export type SaveSort = typeof SORT_NAME_ASC | typeof SORT_NAME_DESC | typeof SORT_DATE_ASC | typeof SORT_DATE_DESC;

export type SaveInfoLike = SaveInfo;

const saveOrderState = {
  value: SORT_NAME_ASC as SaveSort
};

const naturalSorter = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

const ARROW_NONE = "ARROW_NONE";
const ARROW_SMALL_UP = "ARROW_SMALL_UP";
const ARROW_SMALL_DOWN = "ARROW_SMALL_DOWN";
type ArrowShape = typeof ARROW_NONE | typeof ARROW_SMALL_UP | typeof ARROW_SMALL_DOWN;

class ArrowButton extends InteractiveSurface {
  private _shape: ArrowShape;
  private _color = 0;

  constructor(shape: ArrowShape, width: number, height: number, x = 0, y = 0) {
    super(width, height, x, y);
    this._shape = shape;
  }

  setShape(shape: ArrowShape): void {
    this._shape = shape;
    this.invalidate();
  }

  override setColor(color: number): void {
    this._color = color;
    this.invalidate();
  }

  override setSecondaryColor(color: number): void {
    this._color = color;
    this.invalidate();
  }

  override draw(): void {
    super.draw();
    if (this._shape === ARROW_NONE) {
      return;
    }
    const color = this._color || 1;
    if (this._shape === ARROW_SMALL_UP) {
      this.drawLine(5, 1, 1, 6, color);
      this.drawLine(5, 1, 9, 6, color);
      this.drawLine(1, 6, 9, 6, color);
    } else {
      this.drawLine(1, 1, 9, 1, color);
      this.drawLine(1, 1, 5, 6, color);
      this.drawLine(9, 1, 5, 6, color);
    }
    if (this.isButtonPressed()) {
      this.invert(color + 3);
    }
  }
}

function compareSaveName(a: SaveInfoLike, b: SaveInfoLike, descending = false): number {
  if (a.reserved !== b.reserved) {
    return descending ? (a.reserved ? 1 : -1) : (a.reserved ? -1 : 1);
  }
  const cmp = naturalSorter.compare(a.displayName, b.displayName);
  return descending ? -cmp : cmp;
}

function compareSaveTimestamp(a: SaveInfoLike, b: SaveInfoLike, descending = false): number {
  if (a.reserved !== b.reserved) {
    return descending ? (a.reserved ? 1 : -1) : (a.reserved ? -1 : 1);
  }
  return descending ? b.timestamp - a.timestamp : a.timestamp - b.timestamp;
}

function getSaveList(game: Game, autoquick: boolean): SaveInfoLike[] {
  try {
    return SavedGame.getList(game.getLanguage(), autoquick);
  } catch (error) {
    Logger.log(LOG_ERROR, error instanceof Error ? error.message : String(error));
  }
  return [];
}

export class ListGamesState extends State {
  protected _btnCancel: TextButton;
  protected _window: Window;
  protected _txtTitle: Text;
  protected _txtName: Text;
  protected _txtDate: Text;
  protected _txtDelete: Text;
  protected _txtDetails: Text;
  protected _lstSaves: TextList;
  protected _sortName: ArrowButton;
  protected _sortDate: ArrowButton;
  protected _origin: OptionsOrigin;
  protected _saves: SaveInfoLike[] = [];
  protected _firstValidRow: number;
  protected _autoquick: boolean;
  protected _sortable: boolean;

  constructor(origin: OptionsOrigin, firstValidRow: number, autoquick: boolean) {
    super();
    this._origin = origin;
    this._firstValidRow = firstValidRow;
    this._autoquick = autoquick;
    this._sortable = true;
    this._screen = false;

    this._window = new Window(this, 320, 200, 0, 0, POPUP_BOTH);
    this._btnCancel = new TextButton(80, 16, 120, 172);
    this._txtTitle = new Text(310, 17, 5, 7);
    this._txtDelete = new Text(310, 9, 5, 23);
    this._txtName = new Text(150, 9, 16, 32);
    this._txtDate = new Text(110, 9, 204, 32);
    this._lstSaves = new TextList(288, 112, 8, 42);
    this._txtDetails = new Text(288, 16, 16, 156);
    this._sortName = new ArrowButton(ARROW_NONE, 11, 8, 16, 32);
    this._sortDate = new ArrowButton(ARROW_NONE, 11, 8, 204, 32);

    this.setInterface("geoscape", true, this.game().getSavedGame()?.getSavedBattle?.() ?? null);

    this.add(this._window, "window", "saveMenus");
    this.add(this._btnCancel, "button", "saveMenus");
    this.add(this._txtTitle, "text", "saveMenus");
    this.add(this._txtDelete, "text", "saveMenus");
    this.add(this._txtName, "text", "saveMenus");
    this.add(this._txtDate, "text", "saveMenus");
    this.add(this._lstSaves, "list", "saveMenus");
    this.add(this._txtDetails, "text", "saveMenus");
    this.add(this._sortName, "text", "saveMenus");
    this.add(this._sortDate, "text", "saveMenus");

    const back01 = this.game().getMod()?.getSurface("BACK01.SCR");
    if (back01) {
      this._window.setBackground(back01);
    }

    this._btnCancel.setText(String(this.tr("STR_CANCEL")));
    this._btnCancel.onMouseClick(this.btnCancelClick.bind(this));
    this._btnCancel.onKeyboardPress(this.btnCancelClick.bind(this), Options.keyCancel);

    this._txtTitle.setBig();
    this._txtTitle.setAlign(ALIGN_CENTER);
    this._txtDelete.setAlign(ALIGN_CENTER);
    this._txtDelete.setText(String(this.tr("STR_RIGHT_CLICK_TO_DELETE")));
    this._txtName.setText(String(this.tr("STR_NAME")));
    this._txtDate.setText(String(this.tr("STR_DATE")));

    this._lstSaves.setColumns(3, 188, 60, 40);
    this._lstSaves.setSelectable(true);
    this._lstSaves.setBackground(this._window);
    this._lstSaves.setMargin(8);
    this._lstSaves.onMouseOver(this.lstSavesMouseOver.bind(this));
    this._lstSaves.onMouseOut(this.lstSavesMouseOut.bind(this));
    this._lstSaves.onMousePress(this.lstSavesPress.bind(this));

    this._txtDetails.setWordWrap(true);
    this._txtDetails.setText(String(this.tr("STR_DETAILS").arg("")));

    this._sortName.setX(this._sortName.getX() + this._txtName.getTextWidth() + 5);
    this._sortName.onMouseClick(this.sortNameClick.bind(this));

    this._sortDate.setX(this._sortDate.getX() + this._txtDate.getTextWidth() + 5);
    this._sortDate.onMouseClick(this.sortDateClick.bind(this));

    this.updateArrows();
  }

  override init(): void {
    super.init();
    if (this._origin === OPT_BATTLESCAPE) {
      this.applyBattlescapeTheme();
    }
    try {
      this._saves = getSaveList(this.game(), this._autoquick);
      this._lstSaves.clearList();
      this.sortList(saveOrderState.value);
    } catch (error) {
      Logger.log(LOG_ERROR, error instanceof Error ? error.message : String(error));
    }
  }

  protected updateArrows(): void {
    this._sortName.setShape(ARROW_NONE);
    this._sortDate.setShape(ARROW_NONE);
    switch (saveOrderState.value) {
      case SORT_NAME_ASC:
        this._sortName.setShape(ARROW_SMALL_UP);
        break;
      case SORT_NAME_DESC:
        this._sortName.setShape(ARROW_SMALL_DOWN);
        break;
      case SORT_DATE_ASC:
        this._sortDate.setShape(ARROW_SMALL_UP);
        break;
      case SORT_DATE_DESC:
        this._sortDate.setShape(ARROW_SMALL_DOWN);
        break;
    }
  }

  sortList(sort: SaveSort): void {
    switch (sort) {
      case SORT_NAME_ASC:
        this._saves.sort((a, b) => compareSaveName(a, b));
        break;
      case SORT_NAME_DESC:
        this._saves.sort((a, b) => compareSaveName(a, b, true));
        break;
      case SORT_DATE_ASC:
        this._saves.sort((a, b) => compareSaveTimestamp(a, b));
        break;
      case SORT_DATE_DESC:
        this._saves.sort((a, b) => compareSaveTimestamp(a, b, true));
        break;
    }
    this.updateList();
  }

  updateList(): void {
    let row = 0;
    const color = this._lstSaves.getSecondaryColor();
    for (const saveInfo of this._saves) {
      this._lstSaves.addRow(3, String(saveInfo.displayName), String(saveInfo.isoDate), String(saveInfo.isoTime));
      if (saveInfo.reserved && this._origin !== OPT_BATTLESCAPE) {
        this._lstSaves.setRowColor(row, color);
      }
      row++;
    }
  }

  btnCancelClick(_action?: Action): void {
    this.game().popState();
  }

  lstSavesMouseOver(_action?: Action): void {
    const sel = this._lstSaves.getSelectedRow() - this._firstValidRow;
    let details = "";
    if (sel >= 0 && sel < this._saves.length) {
      details = this._saves[sel].details;
    }
    this._txtDetails.setText(String(this.tr("STR_DETAILS").arg(details)));
  }

  lstSavesMouseOut(_action?: Action): void {
    this._txtDetails.setText(String(this.tr("STR_DETAILS").arg("")));
  }

  lstSavesPress(action: Action): void {
    if (action.getDetails().button?.button === SDL_BUTTON_RIGHT && this._lstSaves.getSelectedRow() >= this._firstValidRow) {
      const row = this._lstSaves.getSelectedRow() - this._firstValidRow;
      const saveInfo = this._saves[row];
      if (saveInfo) {
        this.game().pushState(new DeleteGameState(this._origin, saveInfo.fileName));
      }
    }
  }

  sortNameClick(_action?: Action): void {
    if (!this._sortable) {
      return;
    }
    saveOrderState.value = saveOrderState.value === SORT_NAME_ASC ? SORT_NAME_DESC : SORT_NAME_ASC;
    this.updateArrows();
    this._lstSaves.clearList();
    this.sortList(saveOrderState.value);
  }

  sortDateClick(_action?: Action): void {
    if (!this._sortable) {
      return;
    }
    saveOrderState.value = saveOrderState.value === SORT_DATE_ASC ? SORT_DATE_DESC : SORT_DATE_ASC;
    this.updateArrows();
    this._lstSaves.clearList();
    this.sortList(saveOrderState.value);
  }

  disableSort(): void {
    this._sortable = false;
  }
}
