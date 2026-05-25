import { Options } from "../Engine/Options.ts";
import type { Action } from "../Engine/Action.ts";
import { OptionInfo, OptionType } from "../Engine/OptionInfo.ts";
import { TextList } from "../Interface/TextList.ts";
import { OptionsBaseState, type OptionsOrigin } from "./OptionsBaseState.ts";

export class OptionsControlsState extends OptionsBaseState {
  private _lstControls: TextList;
  private _controlsGeneral: OptionInfo[] = [];
  private _controlsGeo: OptionInfo[] = [];
  private _controlsBattle: OptionInfo[] = [];
  private _selected = -1;
  private _selKey: OptionInfo | null = null;
  private _colorGroup = 0;
  private _colorSel = 0;
  private _colorNormal = 0;

  constructor(origin: OptionsOrigin) {
    super(origin);
    this.setCategory(this._btnControls);
    this._lstControls = new TextList(200, 136, 94, 8);
    this.add(this._lstControls, "optionLists", "controlsMenu");
    this.centerAllSurfaces();
    this._lstControls.setColumns(2, 140, 60);
    this._lstControls.setSelectable(true);
    this._lstControls.setBackground(this._window);
    this._lstControls.onMouseClick(this.lstControlsClick.bind(this));
    this._lstControls.onKeyboardPress(this.lstControlsKeyPress.bind(this));
    this._colorGroup = this._lstControls.getSecondaryColor();
    this._colorSel = this._lstControls.getColor() + 3;
    this._colorNormal = this._lstControls.getColor();
  }

  override init(): void {
    super.init();
    this._controlsGeneral = [];
    this._controlsGeo = [];
    this._controlsBattle = [];
    for (const info of Options.getOptionInfo()) {
      if (info.type() !== OptionType.OPTION_KEY) {
        continue;
      }
      if (info.category() === "STR_GEOSCAPE") {
        this._controlsGeo.push(info);
      } else if (info.category() === "STR_BATTLESCAPE") {
        this._controlsBattle.push(info);
      } else {
        this._controlsGeneral.push(info);
      }
    }
    this._lstControls.clearList();
    this._lstControls.addRow(2, String(this.tr("STR_GENERAL")), "");
    this._lstControls.setCellColor(0, 0, this._colorGroup);
    this.addControls(this._controlsGeneral);
    this._lstControls.addRow(2, String(this.tr("STR_GEOSCAPE")), "");
    this._lstControls.setCellColor(this._controlsGeneral.length + 1, 0, this._colorGroup);
    this.addControls(this._controlsGeo);
    this._lstControls.addRow(2, String(this.tr("STR_BATTLESCAPE")), "");
    this._lstControls.setCellColor(this._controlsGeneral.length + this._controlsGeo.length + 2, 0, this._colorGroup);
    this.addControls(this._controlsBattle);
  }

  addControls(keys: OptionInfo[]): void {
    for (const key of keys) {
      this._lstControls.addRow(2, String(this.tr(key.description() || key.id())), String(key.get()));
    }
  }

  getControl(sel: number): OptionInfo | null {
    let index = sel - 1;
    if (index < this._controlsGeneral.length) return this._controlsGeneral[index] || null;
    index -= this._controlsGeneral.length + 1;
    if (index < this._controlsGeo.length) return this._controlsGeo[index] || null;
    index -= this._controlsGeo.length + 1;
    return this._controlsBattle[index] || null;
  }

  ucWords(str: string): string {
    return str.replace(/(^|[ _-])(\w)/g, (_m, sep: string, ch: string) => `${sep === "_" || sep === "-" ? " " : sep}${ch.toUpperCase()}`);
  }

  lstControlsClick(_action?: Action): void {
    const sel = this._lstControls.getSelectedRow();
    const control = this.getControl(sel);
    if (!control) {
      return;
    }
    if (this._selected >= 0) {
      this._lstControls.setRowColor(this._selected, this._colorNormal);
    }
    this._selected = sel;
    this._selKey = control;
    this._lstControls.setRowColor(sel, this._colorSel);
    this._lstControls.setCellText(sel, 1, "?");
  }

  lstControlsKeyPress(action: Action): void {
    if (!this._selKey || this._selected < 0) {
      return;
    }
    const sym = action.getDetails().key?.keysym.sym || "";
    if (!sym) {
      return;
    }
    this._selKey.set(sym);
    this._lstControls.setCellText(this._selected, 1, sym);
    this._lstControls.setRowColor(this._selected, this._colorNormal);
    this._selected = -1;
    this._selKey = null;
  }
}
