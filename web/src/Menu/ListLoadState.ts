import type { Action } from "../Engine/Action.ts";
import { Options } from "../Engine/Options.ts";
import { TextButton } from "../Interface/TextButton.ts";
import { SDL_BUTTON_LEFT } from "../types.ts";
import { SavedGame } from "../Savegame/SavedGame.ts";
import { LoadGameState } from "./LoadGameState.ts";
import { ConfirmLoadState } from "./ConfirmLoadState.ts";
import { ListGamesState, type SaveInfoLike } from "./ListGamesState.ts";
import { ListLoadOriginalState } from "./ListLoadOriginalState.ts";
import { type OptionsOrigin } from "./OptionsBaseState.ts";

function sanitizeModName(name: string): string {
  return SavedGame.sanitizeModName(name);
}

function needsConfirmation(saveInfo: SaveInfoLike): boolean {
  for (const mod of saveInfo.mods) {
    const name = sanitizeModName(mod);
    if (!Options.mods.some(([id, enabled]) => id === name && enabled)) {
      return true;
    }
  }
  return false;
}

export class ListLoadState extends ListGamesState {
  private _btnOld: TextButton;

  constructor(origin: OptionsOrigin) {
    super(origin, 0, true);
    this._btnOld = new TextButton(80, 16, 60, 172);
    this._btnCancel.setX(180);

    this.add(this._btnOld, "button", "saveMenus");

    this._txtTitle.setText(String(this.tr("STR_SELECT_GAME_TO_LOAD")));
    this._btnOld.setText(String(this.tr("STR_ORIGINAL_XCOM")));
    this._btnOld.onMouseClick(this.btnOldClick.bind(this));

    this.centerAllSurfaces();
  }

  btnOldClick(_action?: Action): void {
    this.game().pushState(new ListLoadOriginalState(this._origin));
  }

  override lstSavesPress(action: Action): void {
    super.lstSavesPress(action);
    if (action.getDetails().button?.button !== SDL_BUTTON_LEFT) {
      return;
    }
    const selected = this._lstSaves.getSelectedRow();
    if (selected < 0 || selected >= this._saves.length) {
      return;
    }
    const saveInfo = this._saves[selected];
    if (needsConfirmation(saveInfo)) {
      this.game().pushState(new ConfirmLoadState(this._origin, saveInfo.fileName));
      return;
    }
    this.game().pushState(new LoadGameState(this._origin, saveInfo.fileName, this._palette));
  }
}
