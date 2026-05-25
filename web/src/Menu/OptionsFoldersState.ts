import type { Action } from "../Engine/Action.ts";
import { Options } from "../Engine/Options.ts";
import { Text } from "../Interface/Text.ts";
import { OptionsBaseState, type OptionsOrigin } from "./OptionsBaseState.ts";

export class OptionsFoldersState extends OptionsBaseState {
  private _txtDataFolder: Text;
  private _txtUserFolder: Text;
  private _txtSaveFolder: Text;
  private _txtConfigFolder: Text;
  private _txtDataFolderPath1: Text;
  private _txtDataFolderPath2: Text;
  private _txtUserFolderPath: Text;
  private _txtSaveFolderPath: Text;
  private _txtConfigFolderPath: Text;

  constructor(origin: OptionsOrigin) {
    super(origin);
    this.setCategory(this._btnFolders);
    this._txtDataFolder = new Text(218, 9, 94, 8);
    this._txtUserFolder = new Text(218, 9, 94, 59);
    this._txtSaveFolder = new Text(218, 9, 94, 86);
    this._txtConfigFolder = new Text(218, 9, 94, 121);
    this._txtDataFolderPath1 = new Text(218, 17, 94, 18);
    this._txtDataFolderPath2 = new Text(218, 17, 94, 38);
    this._txtUserFolderPath = new Text(218, 17, 94, 69);
    this._txtSaveFolderPath = new Text(218, 25, 94, 96);
    this._txtConfigFolderPath = new Text(218, 17, 94, 131);

    for (const surface of [this._txtDataFolder, this._txtUserFolder, this._txtSaveFolder, this._txtConfigFolder]) {
      this.add(surface, "text1", "foldersMenu");
    }
    for (const surface of [this._txtDataFolderPath1, this._txtDataFolderPath2, this._txtUserFolderPath, this._txtSaveFolderPath, this._txtConfigFolderPath]) {
      this.add(surface, "text2", "foldersMenu");
    }
    this.centerAllSurfaces();

    this._txtDataFolder.setText(String(this.tr("STR_DATA_FOLDER")));
    this._txtUserFolder.setText(String(this.tr("STR_USER_FOLDER")));
    this._txtSaveFolder.setText(String(this.tr("STR_SAVE_FOLDER")));
    this._txtConfigFolder.setText(String(this.tr("STR_CONFIG_FOLDER")));
    this.setupPath(this._txtDataFolderPath1, Options.assetBase, "STR_DATA_FOLDER_DESC_1");
    this.setupPath(this._txtDataFolderPath2, "bin/standard/", "STR_DATA_FOLDER_DESC_2");
    this.setupPath(this._txtUserFolderPath, Options.getUserFolder(), "STR_USER_FOLDER_DESC");
    this.setupPath(this._txtSaveFolderPath, Options.getMasterUserFolder(), "STR_SAVE_FOLDER_DESC");
    this.setupPath(this._txtConfigFolderPath, Options.getConfigFolder(), "STR_CONFIG_FOLDER_DESC");
  }

  txtClick(action: Action): void {
    const sender = action.getSender() as Text;
    const path = sender.getText();
    try {
      window.open(path, "_blank");
    } catch {
      console.log(`CrossPlatform::openExplorer browser boundary: ${path}`);
    }
  }

  private setupPath(text: Text, path: string, tooltip: string): void {
    text.setText(path);
    text.setWordWrap(true);
    text.setTooltip(tooltip);
    text.onMouseIn(this.txtTooltipIn.bind(this));
    text.onMouseOut(this.txtTooltipOut.bind(this));
    text.onMouseClick(this.txtClick.bind(this));
  }
}
