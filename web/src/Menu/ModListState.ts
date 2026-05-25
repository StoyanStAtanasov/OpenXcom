import { Options } from "../Engine/Options.ts";
import { State } from "../Engine/State.ts";
import type { Action } from "../Engine/Action.ts";
import type { ModInfo } from "../Engine/ModInfo.ts";
import { ComboBox } from "../Interface/ComboBox.ts";
import { Text, ALIGN_RIGHT } from "../Interface/Text.ts";
import { TextButton } from "../Interface/TextButton.ts";
import { TextList, ARROW_VERTICAL } from "../Interface/TextList.ts";
import { Window } from "../Interface/Window.ts";
import { StartState } from "./StartState.ts";
import { ModConfirmExtendedState } from "./ModConfirmExtendedState.ts";

type ModPair = [string, boolean];

export class ModListState extends State {
  private _window: Window;
  private _txtMaster: Text;
  private _cbxMasters: ComboBox;
  private _lstMods: TextList;
  private _btnOk: TextButton;
  private _btnCancel: TextButton;
  private _txtTooltip: Text;
  private _currentTooltip = "";
  private _masters: ModInfo[] = [];
  private _curMasterId = "";
  private _mods: ModPair[] = [];
  private _curMasterIdx = 0;

  constructor() {
    super();
    this._window = new Window(this, 320, 200, 0, 0);
    this._txtMaster = new Text(305, 9, 8, 8);
    this._cbxMasters = new ComboBox(this, 305, 16, 8, 18);
    this._lstMods = new TextList(288, 104, 8, 40);
    this._btnOk = new TextButton(100, 16, 8, 176);
    this._btnCancel = new TextButton(100, 16, 212, 176);
    this._txtTooltip = new Text(305, 25, 8, 148);
    this.setInterface("modsMenu");
    this.add(this._window, "window", "modsMenu");
    this.add(this._txtMaster, "text", "modsMenu");
    this.add(this._lstMods, "optionLists", "modsMenu");
    this.add(this._btnOk, "button2", "modsMenu");
    this.add(this._btnCancel, "button2", "modsMenu");
    this.add(this._txtTooltip, "tooltip", "modsMenu");
    this.add(this._cbxMasters, "button1", "modsMenu");
    this.centerAllSurfaces();

    const back01 = this.game().getMod()?.getSurface("BACK01.SCR");
    if (back01) {
      this._window.setBackground(back01);
    }
    this._txtMaster.setText(String(this.tr("STR_BASE_GAME")));
    Options.refreshMods();
    const modInfos = Options.getModInfos();
    const masterNames: string[] = [];
    for (const [modId, enabled] of Options.mods) {
      const modInfo = modInfos.get(modId) || Options.getModInfo(modId);
      if (!modInfo.isMaster()) {
        continue;
      }
      if (enabled) {
        this._curMasterId = modId;
      } else if (!this._curMasterId) {
        this._curMasterIdx++;
      }
      this._masters.push(modInfo);
      masterNames.push(modInfo.getName());
    }
    if (this._masters.length === 0) {
      const master = Options.getModInfo("xcom1");
      this._masters.push(master);
      masterNames.push(master.getName());
      this._curMasterId = master.getId();
    }
    this._cbxMasters.setOptions(masterNames);
    this._cbxMasters.setSelected(this._curMasterIdx);
    this._cbxMasters.onChange(this.cbxMasterChange.bind(this));
    this._cbxMasters.onMouseIn(this.txtTooltipIn.bind(this));
    this._cbxMasters.onMouseOut(this.txtTooltipOut.bind(this));
    this._cbxMasters.onMouseOver(this.cbxMasterHover.bind(this));
    this._cbxMasters.onListMouseIn(this.txtTooltipIn.bind(this));
    this._cbxMasters.onListMouseOut(this.txtTooltipOut.bind(this));
    this._cbxMasters.onListMouseOver(this.cbxMasterHover.bind(this));

    this._lstMods.setArrowColumn(214, ARROW_VERTICAL);
    this._lstMods.setColumns(3, 213, 25, 50);
    this._lstMods.setAlign(ALIGN_RIGHT, 1);
    this._lstMods.setSelectable(true);
    this._lstMods.setBackground(this._window);
    this._lstMods.setWordWrap(true);
    this._lstMods.onMouseClick(this.lstModsClick.bind(this));
    this._lstMods.onLeftArrowClick(this.lstModsLeftArrowClick.bind(this));
    this._lstMods.onRightArrowClick(this.lstModsRightArrowClick.bind(this));
    this._lstMods.onMousePress(this.lstModsMousePress.bind(this));
    this._lstMods.onMouseIn(this.txtTooltipIn.bind(this));
    this._lstMods.onMouseOut(this.txtTooltipOut.bind(this));
    this._lstMods.onMouseOver(this.lstModsHover.bind(this));
    this.lstModsRefresh(0);

    this._btnOk.setText(String(this.tr("STR_OK")));
    this._btnOk.onMouseClick(this.btnOkClick.bind(this));
    this._btnOk.onKeyboardPress(this.btnOkClick.bind(this), Options.keyOk);
    this._btnCancel.setText(String(this.tr("STR_CANCEL")));
    this._btnCancel.onMouseClick(this.btnCancelClick.bind(this));
    this._btnCancel.onKeyboardPress(this.btnCancelClick.bind(this), Options.keyCancel);
    this._txtTooltip.setWordWrap(true);
  }

  makeTooltip(modInfo: ModInfo): string {
    return String(this.tr("STR_MODS_TOOLTIP").arg(modInfo.getVersion()).arg(modInfo.getAuthor()).arg(modInfo.getDescription()));
  }

  cbxMasterHover(_action?: Action): void {
    const master = this._masters[this._cbxMasters.getHoveredListIdx()];
    this._txtTooltip.setText(master ? this.makeTooltip(master) : "");
  }

  cbxMasterChange(_action?: Action): void {
    const masterModInfo = this._masters[this._cbxMasters.getSelected()];
    if (masterModInfo && !masterModInfo.isEngineOk()) {
      this.game().pushState(new ModConfirmExtendedState(this, masterModInfo));
      return;
    }
    this.changeMasterMod();
  }

  changeMasterMod(): void {
    const master = this._masters[this._cbxMasters.getSelected()];
    if (!master) return;
    const masterId = master.getId();
    for (const mod of Options.mods) {
      if (masterId === mod[0]) mod[1] = true;
      else if (this._curMasterId === mod[0]) mod[1] = false;
    }
    Options.reload = true;
    this._curMasterIdx = this._cbxMasters.getSelected();
    this._curMasterId = masterId;
    this.lstModsRefresh(0);
  }

  revertMasterMod(): void {
    this._cbxMasters.setSelected(this._curMasterIdx);
  }

  lstModsRefresh(scrollLoc: number): void {
    this._lstMods.clearList();
    this._mods = [];
    for (const mod of Options.mods) {
      const modInfo = Options.getModInfo(mod[0]);
      if (modInfo.isMaster() || !modInfo.canActivate(this._curMasterId)) {
        continue;
      }
      this._lstMods.addRow(3, modInfo.getName(), "", String(this.tr(mod[1] ? "STR_YES" : "STR_NO")));
      this._mods.push(mod);
    }
    this._lstMods.scrollTo(scrollLoc);
  }

  lstModsHover(_action?: Action): void {
    const selectedRow = this._lstMods.getSelectedRow();
    const mod = this._mods[selectedRow];
    this._txtTooltip.setText(mod ? this.makeTooltip(Options.getModInfo(mod[0])) : "");
  }

  lstModsClick(action: Action): void {
    if (action.getAbsoluteXMouse() >= this._lstMods.getArrowsLeftEdge() && action.getAbsoluteXMouse() <= this._lstMods.getArrowsRightEdge()) {
      return;
    }
    const mod = this._mods[this._lstMods.getSelectedRow()];
    if (!mod) return;
    const modInfo = Options.getModInfo(mod[0]);
    if (!mod[1] && !modInfo.isEngineOk()) {
      this.game().pushState(new ModConfirmExtendedState(this, modInfo));
      return;
    }
    this.toggleMod();
  }

  toggleMod(): void {
    const row = this._lstMods.getSelectedRow();
    const mod = this._mods[row];
    if (!mod) return;
    mod[1] = !mod[1];
    this._lstMods.setCellText(row, 2, String(this.tr(mod[1] ? "STR_YES" : "STR_NO")));
    Options.reload = true;
  }

  lstModsLeftArrowClick(action: Action): void {
    const row = this._lstMods.getSelectedRow();
    if (row > 0) this.moveModUp(action, row, action.getDetails().button?.button !== 1);
  }

  moveModUp(_action: Action, row: number, max = false): void {
    const mod = this._mods[row];
    if (!mod) return;
    const target = max ? 0 : row - 1;
    this._mods.splice(row, 1);
    this._mods.splice(target, 0, mod);
    Options.mods = [...this._mods, ...Options.mods.filter(modPair => !this._mods.includes(modPair))];
    this.lstModsRefresh(this._lstMods.getScroll());
    Options.reload = true;
  }

  lstModsRightArrowClick(action: Action): void {
    const row = this._lstMods.getSelectedRow();
    if (row >= 0 && row < this._mods.length - 1) this.moveModDown(action, row, action.getDetails().button?.button !== 1);
  }

  moveModDown(_action: Action, row: number, max = false): void {
    const mod = this._mods[row];
    if (!mod) return;
    const target = max ? this._mods.length - 1 : row + 1;
    this._mods.splice(row, 1);
    this._mods.splice(target, 0, mod);
    Options.mods = [...this._mods, ...Options.mods.filter(modPair => !this._mods.includes(modPair))];
    this.lstModsRefresh(this._lstMods.getScroll());
    Options.reload = true;
  }

  lstModsMousePress(_action?: Action): void {}

  txtTooltipIn(action: Action): void {
    const sender = action.getSender() as { getTooltip?: () => string } | null;
    this._currentTooltip = sender?.getTooltip?.() || "";
    this._txtTooltip.setText(String(this.tr(this._currentTooltip)));
  }

  txtTooltipOut(action: Action): void {
    const sender = action.getSender() as { getTooltip?: () => string } | null;
    if (this._currentTooltip === (sender?.getTooltip?.() || "")) {
      this._txtTooltip.setText("");
    }
  }

  btnOkClick(_action?: Action): void {
    Options.save();
    if (Options.reload) {
      this.game().setState(new StartState());
    } else {
      this.game().popState();
    }
  }

  btnCancelClick(_action?: Action): void {
    Options.reload = false;
    Options.load();
    this.game().popState();
  }
}
