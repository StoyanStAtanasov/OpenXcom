import type { Action } from "../Engine/Action.ts";
import { TextButton } from "../Interface/TextButton.ts";
import { TextEdit } from "../Interface/TextEdit.ts";
import { ListGamesState } from "./ListGamesState.ts";
import { SaveGameState } from "./SaveGameState.ts";
import { OPT_BATTLESCAPE, type OptionsOrigin } from "./OptionsBaseState.ts";

function sanitizeFilename(name: string): string {
  return name
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_")
    .replace(/[. ]+$/g, "")
    .trim();
}

function getMasterUserFolder(): string {
  return "";
}

function fileExists(_path: string): boolean {
  return false;
}

function moveFile(_src: string, _dest: string): void {
  console.log("CrossPlatform.moveFile is not translated yet.");
}

export class ListSaveState extends ListGamesState {
  private _edtSave: TextEdit;
  private _btnSaveGame: TextButton;
  private _selected = "";
  private _previousSelectedRow = -1;
  private _selectedRow = -1;

  constructor(origin: OptionsOrigin) {
    super(origin, 1, false);

    this._edtSave = new TextEdit(this, 168, 9, 0, 0);
    this._btnSaveGame = new TextButton(this.game().getSavedGame()?.isIronman() ? 200 : 80, 16, 60, 172);

    this.add(this._edtSave);
    this.add(this._btnSaveGame, "button", "saveMenus");

    this._txtTitle.setText(String(this.tr("STR_SELECT_SAVE_POSITION")));

    if (this.game().getSavedGame()?.isIronman()) {
      this._btnCancel.setVisible(false);
    } else {
      this._btnCancel.setX(180);
    }

    this._btnSaveGame.setText(String(this.tr("STR_SAVE_GAME")));
    this._btnSaveGame.onMouseClick(this.btnSaveGameClick.bind(this));

    this._edtSave.setColor(this._lstSaves.getSecondaryColor());
    this._edtSave.setVisible(false);
    this._edtSave.onKeyboardPress(this.edtSaveKeyPress.bind(this));

    this.centerAllSurfaces();
  }

  override updateList(): void {
    this._lstSaves.addRow(1, String(this.tr("STR_NEW_SAVED_GAME_SLOT")));
    if (this._origin !== OPT_BATTLESCAPE) {
      this._lstSaves.setRowColor(0, this._lstSaves.getSecondaryColor());
    }
    super.updateList();
  }

  override lstSavesPress(action: Action): void {
    if (action.getDetails().button?.button === 3 && this._edtSave.isFocused()) {
      this._edtSave.setText("");
      this._edtSave.setVisible(false);
      this._edtSave.setFocus(false, false);
      this._lstSaves.setScrolling(true);
    }
    super.lstSavesPress(action);
    if (action.getDetails().button?.button === 1) {
      this._previousSelectedRow = this._selectedRow;
      this._selectedRow = this._lstSaves.getSelectedRow();

      switch (this._previousSelectedRow) {
        case -1:
          break;
        case 0:
          this._lstSaves.setCellText(this._previousSelectedRow, 0, String(this.tr("STR_NEW_SAVED_GAME_SLOT")));
          break;
        default:
          this._lstSaves.setCellText(this._previousSelectedRow, 0, this._selected);
      }

      this._selected = this._lstSaves.getCellText(this._lstSaves.getSelectedRow(), 0);
      this._lstSaves.setCellText(this._lstSaves.getSelectedRow(), 0, "");
      if (this._lstSaves.getSelectedRow() === 0) {
        this._edtSave.setText("");
        this._selected = "";
      } else {
        this._edtSave.setText(this._selected);
      }
      this._edtSave.setX(this._lstSaves.getColumnX(0));
      this._edtSave.setY(this._lstSaves.getRowY(this._selectedRow));
      this._edtSave.setVisible(true);
      this._edtSave.setFocus(true, false);
      this._lstSaves.setScrolling(false);
      this.disableSort();
    }
  }

  edtSaveKeyPress(action: Action): void {
    if (action.getDetails().key?.keysym.sym === "Enter" || action.getDetails().key?.keysym.sym === "NumpadEnter") {
      this.saveGame();
    }
  }

  btnSaveGameClick(_action?: Action): void {
    if (this._selectedRow !== -1) {
      this.saveGame();
    }
  }

  saveGame(): void {
    this.game().getSavedGame()?.setName(this._edtSave.getText());
    const sanitized = sanitizeFilename(this._edtSave.getText());
    let newFilename = sanitized.length > 0 ? sanitized : "save";
    if (this._selectedRow > 0) {
      const oldFilename = this._saves[this._selectedRow - 1]?.fileName || "";
      if (oldFilename !== `${newFilename}.sav`) {
        const userFolder = getMasterUserFolder();
        while (fileExists(`${userFolder}${newFilename}.sav`)) {
          newFilename += "_";
        }
        const oldPath = `${userFolder}${oldFilename}`;
        const newPath = `${userFolder}${newFilename}.sav`;
        moveFile(oldPath, newPath);
      }
    } else {
      const userFolder = getMasterUserFolder();
      while (fileExists(`${userFolder}${newFilename}.sav`)) {
        newFilename += "_";
      }
    }
    newFilename += ".sav";
    this.game().pushState(new SaveGameState(this._origin, newFilename, this._palette));
  }
}
