import type { Action } from "../Engine/Action.ts";
import { Options } from "../Engine/Options.ts";
import { ALIGN_CENTER, Text } from "../Interface/Text.ts";
import { TextButton } from "../Interface/TextButton.ts";
import { TextList } from "../Interface/TextList.ts";
import { Window } from "../Interface/Window.ts";
import { State } from "../Engine/State.ts";
import { SoldierInfoState } from "./SoldierInfoState.ts";
import { StatisticsState } from "../Menu/StatisticsState.ts";

export class SoldierMemorialState extends State {
  private _btnOk: TextButton;
  private _btnStatistics: TextButton;
  private _window: Window;
  private _txtTitle: Text;
  private _txtName: Text;
  private _txtRank: Text;
  private _txtDate: Text;
  private _txtRecruited: Text;
  private _txtLost: Text;
  private _lstSoldiers: TextList;

  constructor() {
    super();

    this._window = new Window(this, 320, 200, 0, 0);
    this._btnOk = new TextButton(148, 16, 164, 176);
    this._btnStatistics = new TextButton(148, 16, 8, 176);
    this._txtTitle = new Text(310, 17, 5, 8);
    this._txtName = new Text(114, 9, 16, 36);
    this._txtRank = new Text(102, 9, 130, 36);
    this._txtDate = new Text(90, 9, 218, 36);
    this._txtRecruited = new Text(150, 9, 16, 24);
    this._txtLost = new Text(150, 9, 160, 24);
    this._lstSoldiers = new TextList(288, 120, 8, 44);

    this.setInterface("soldierMemorial");

    this.add(this._window, "window", "soldierMemorial");
    this.add(this._btnOk, "button", "soldierMemorial");
    this.add(this._btnStatistics, "button", "soldierMemorial");
    this.add(this._txtTitle, "text", "soldierMemorial");
    this.add(this._txtName, "text", "soldierMemorial");
    this.add(this._txtRank, "text", "soldierMemorial");
    this.add(this._txtDate, "text", "soldierMemorial");
    this.add(this._txtRecruited, "text", "soldierMemorial");
    this.add(this._txtLost, "text", "soldierMemorial");
    this.add(this._lstSoldiers, "list", "soldierMemorial");

    this.centerAllSurfaces();

    const back02 = this.game().getMod()?.getSurface("BACK02.SCR");
    if (back02) {
      this._window.setBackground(back02);
    }

    this._btnOk.setText(String(this.tr("STR_OK")));
    this._btnOk.onMouseClick(this.btnOkClick.bind(this));
    this._btnOk.onKeyboardPress(this.btnOkClick.bind(this), Options.keyCancel);

    this._btnStatistics.setText(String(this.tr("STR_STATISTICS")));
    this._btnStatistics.onMouseClick(this.btnStatisticsClick.bind(this));

    this._txtTitle.setBig();
    this._txtTitle.setAlign(ALIGN_CENTER);
    this._txtTitle.setText(String(this.tr("STR_MEMORIAL")));
    this._txtName.setText(String(this.tr("STR_NAME_UC")));
    this._txtRank.setText(String(this.tr("STR_RANK")));
    this._txtDate.setText(String(this.tr("STR_DATE_UC")));

    const save = this.game().getSavedGame();
    const lost = save?.getDeadSoldiers().length || 0;
    let recruited = lost;
    for (const base of save?.getBases() || []) {
      recruited += base.getTotalSoldiers();
    }
    this._txtRecruited.setText(String(this.tr("STR_SOLDIERS_RECRUITED_UC").arg(recruited)));
    this._txtLost.setText(String(this.tr("STR_SOLDIERS_LOST_UC").arg(lost)));

    this._lstSoldiers.setColumns(5, 114, 88, 30, 25, 35);
    this._lstSoldiers.setSelectable(true);
    this._lstSoldiers.setBackground(this._window);
    this._lstSoldiers.setMargin(8);
    this._lstSoldiers.onMouseClick(this.lstSoldiersClick.bind(this));

    const language = this.game().getLanguage();
    const deadSoldiers = save?.getDeadSoldiers() || [];
    for (let i = deadSoldiers.length - 1; i >= 0; --i) {
      const soldier = deadSoldiers[i];
      const death = soldier.getDeath();
      const time = death?.getTime();
      const day = time?.getDayString(language) || "";
      const month = time ? String(this.tr(time.getMonthString())) : "";
      const year = time ? String(time.getYear()) : "";
      this._lstSoldiers.addRow(5, soldier.getName(), String(this.tr(soldier.getRankString())), day, month, year);
    }
  }

  btnOkClick(_action?: Action): void {
    this.game().popState();
    this.game().getMod()?.playMusic("GMGEO");
  }

  btnStatisticsClick(_action?: Action): void {
    this.game().pushState(new StatisticsState());
  }

  lstSoldiersClick(_action?: Action): void {
    const row = this._lstSoldiers.getSelectedRow();
    if (row !== -1) {
      this.game().pushState(new SoldierInfoState(null, row));
    }
  }
}
