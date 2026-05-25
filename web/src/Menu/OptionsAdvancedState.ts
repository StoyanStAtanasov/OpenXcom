import { Options } from "../Engine/Options.ts";
import type { Action } from "../Engine/Action.ts";
import { OptionInfo, OptionType } from "../Engine/OptionInfo.ts";
import { TextList } from "../Interface/TextList.ts";
import { OptionsBaseState, type OptionsOrigin } from "./OptionsBaseState.ts";

export class OptionsAdvancedState extends OptionsBaseState {
  private _lstOptions: TextList;
  private _colorGroup = 0;
  private _settingsGeneral: OptionInfo[] = [];
  private _settingsGeo: OptionInfo[] = [];
  private _settingsBattle: OptionInfo[] = [];

  constructor(origin: OptionsOrigin) {
    super(origin);
    this.setCategory(this._btnAdvanced);
    this._lstOptions = new TextList(200, 136, 94, 8);
    this.add(this._lstOptions, "optionLists", "advancedMenu");
    this.centerAllSurfaces();
    const rightcol = 50;
    this._lstOptions.setAlign("ALIGN_RIGHT", 1);
    this._lstOptions.setColumns(2, this._lstOptions.getWidth() - rightcol, rightcol);
    this._lstOptions.setWordWrap(true);
    this._lstOptions.setSelectable(true);
    this._lstOptions.setBackground(this._window);
    this._lstOptions.onMouseClick(this.lstOptionsClick.bind(this));
    this._lstOptions.onMouseOver(this.lstOptionsMouseOver.bind(this));
    this._lstOptions.onMouseOut(this.lstOptionsMouseOut.bind(this));
    this._colorGroup = this._lstOptions.getSecondaryColor();
  }

  override init(): void {
    super.init();
    this._settingsGeneral = [];
    this._settingsGeo = [];
    this._settingsBattle = [];
    for (const info of Options.getOptionInfo()) {
      if (!info.description() || info.type() === OptionType.OPTION_KEY) {
        continue;
      }
      if (info.category() === "STR_GEOSCAPE") {
        this._settingsGeo.push(info);
      } else if (info.category() === "STR_BATTLESCAPE") {
        this._settingsBattle.push(info);
      } else {
        this._settingsGeneral.push(info);
      }
    }
    this._lstOptions.clearList();
    this._lstOptions.addRow(2, String(this.tr("STR_GENERAL")), "");
    this._lstOptions.setCellColor(0, 0, this._colorGroup);
    this.addSettings(this._settingsGeneral);
    this._lstOptions.addRow(2, String(this.tr("STR_GEOSCAPE")), "");
    this._lstOptions.setCellColor(this._settingsGeneral.length + 1, 0, this._colorGroup);
    this.addSettings(this._settingsGeo);
    this._lstOptions.addRow(2, String(this.tr("STR_BATTLESCAPE")), "");
    this._lstOptions.setCellColor(this._settingsGeneral.length + this._settingsGeo.length + 2, 0, this._colorGroup);
    this.addSettings(this._settingsBattle);
  }

  addSettings(settings: OptionInfo[]): void {
    for (const setting of settings) {
      this._lstOptions.addRow(2, String(this.tr(setting.description() || setting.id())), this.settingText(setting));
    }
  }

  getSetting(sel: number): OptionInfo | null {
    let index = sel - 1;
    if (index < this._settingsGeneral.length) return this._settingsGeneral[index] || null;
    index -= this._settingsGeneral.length + 1;
    if (index < this._settingsGeo.length) return this._settingsGeo[index] || null;
    index -= this._settingsGeo.length + 1;
    return this._settingsBattle[index] || null;
  }

  lstOptionsClick(_action?: Action): void {
    const sel = this._lstOptions.getSelectedRow();
    const setting = this.getSetting(sel);
    if (!setting) {
      return;
    }
    if (setting.type() === OptionType.OPTION_BOOL) {
      setting.set(!Boolean(setting.get()));
    } else if (setting.type() === OptionType.OPTION_INT) {
      setting.set((Number(setting.get()) || 0) + 1);
    }
    this._lstOptions.setCellText(sel, 1, this.settingText(setting));
  }

  lstOptionsMouseOver(_action?: Action): void {
    const setting = this.getSetting(this._lstOptions.getSelectedRow());
    this._txtTooltip.setText(setting ? String(this.tr(`${setting.description()}_DESC`)) : "");
  }

  lstOptionsMouseOut(_action?: Action): void {
    this._txtTooltip.setText("");
  }

  private settingText(setting: OptionInfo): string {
    if (setting.type() === OptionType.OPTION_BOOL) {
      return String(this.tr(Boolean(setting.get()) ? "STR_YES" : "STR_NO"));
    }
    return String(setting.get());
  }
}
