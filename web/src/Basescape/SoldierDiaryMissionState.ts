import type { Action } from "../Engine/Action.ts";
import { Options } from "../Engine/Options.ts";
import { State } from "../Engine/State.ts";
import { ALIGN_CENTER, Text } from "../Interface/Text.ts";
import { TextButton } from "../Interface/TextButton.ts";
import { TextList } from "../Interface/TextList.ts";
import { POPUP_HORIZONTAL, Window } from "../Interface/Window.ts";
import { UnitStatus } from "../Savegame/BattleUnit.ts";
import type { Soldier } from "../Savegame/Soldier.ts";
import { MissionStatistics, type MissionStatisticsSave } from "../Savegame/MissionStatistics.ts";
import { SoldierDiary } from "../Savegame/SoldierDiary.ts";

type SoldierWithDiary = Soldier & {
  getDiary?: () => SoldierDiary;
};

type SavedGameWithMissionStatistics = {
  getMissionStatistics?: () => Array<MissionStatistics | MissionStatisticsSave>;
};

function getDiary(soldier: Soldier | null): SoldierDiary | null {
  return (soldier as SoldierWithDiary | null)?.getDiary?.() || null;
}

function getMissionStatistics(save: unknown): MissionStatistics[] {
  const raw = (save as SavedGameWithMissionStatistics | null)?.getMissionStatistics?.() || [];
  return raw.map(entry => entry instanceof MissionStatistics ? entry : new MissionStatistics(entry));
}

/**
 * Diary window that shows mission details for a soldier.
 */
export class SoldierDiaryMissionState extends State {
  private _btnOk: TextButton;
  private _btnPrev: TextButton;
  private _btnNext: TextButton;
  private _window: Window;
  private _txtTitle: Text;
  private _txtUFO: Text;
  private _txtScore: Text;
  private _txtKills: Text;
  private _txtLocation: Text;
  private _txtRace: Text;
  private _txtDaylight: Text;
  private _txtDaysWounded: Text;
  private _txtNoRecord: Text;
  private _lstKills: TextList;

  constructor(private _soldier: Soldier, private _rowEntry: number) {
    super();
    this._screen = false;

    this._window = new Window(this, 300, 128, 10, 36, POPUP_HORIZONTAL);
    this._btnOk = new TextButton(240, 16, 40, 140);
    this._btnPrev = new TextButton(28, 14, 18, 44);
    this._btnNext = new TextButton(28, 14, 274, 44);
    this._txtTitle = new Text(262, 9, 29, 44);
    this._txtUFO = new Text(262, 9, 29, 52);
    this._txtScore = new Text(180, 9, 29, 68);
    this._txtKills = new Text(120, 9, 169, 68);
    this._txtLocation = new Text(180, 9, 29, 76);
    this._txtRace = new Text(120, 9, 169, 76);
    this._txtDaylight = new Text(120, 9, 169, 84);
    this._txtDaysWounded = new Text(180, 9, 29, 84);
    this._txtNoRecord = new Text(240, 9, 29, 100);
    this._lstKills = new TextList(270, 32, 20, 100);

    this.setInterface("soldierDiaryMission");

    this.add(this._window, "window", "soldierDiaryMission");
    this.add(this._btnOk, "button", "soldierDiaryMission");
    this.add(this._btnPrev, "button", "soldierDiaryMission");
    this.add(this._btnNext, "button", "soldierDiaryMission");
    this.add(this._txtTitle, "text", "soldierDiaryMission");
    this.add(this._txtUFO, "text", "soldierDiaryMission");
    this.add(this._txtScore, "text", "soldierDiaryMission");
    this.add(this._txtKills, "text", "soldierDiaryMission");
    this.add(this._txtLocation, "text", "soldierDiaryMission");
    this.add(this._txtRace, "text", "soldierDiaryMission");
    this.add(this._txtDaylight, "text", "soldierDiaryMission");
    this.add(this._txtDaysWounded, "text", "soldierDiaryMission");
    this.add(this._txtNoRecord, "text", "soldierDiaryMission");
    this.add(this._lstKills, "list", "soldierDiaryMission");

    this.centerAllSurfaces();

    const back16 = this.game().getMod()?.getSurface("BACK16.SCR");
    if (back16) {
      this._window.setBackground(back16);
    }

    this._btnOk.setText(String(this.tr("STR_OK")));
    this._btnOk.onMouseClick(this.btnOkClick.bind(this));
    this._btnOk.onKeyboardPress(this.btnOkClick.bind(this), Options.keyCancel);

    this._btnPrev.setText("<<");
    this._btnPrev.onMouseClick(this.btnPrevClick.bind(this));
    this._btnPrev.onKeyboardPress(this.btnPrevClick.bind(this), Options.keyBattleNextUnit);

    this._btnNext.setText(">>");
    this._btnNext.onMouseClick(this.btnNextClick.bind(this));
    this._btnNext.onKeyboardPress(this.btnNextClick.bind(this), Options.keyBattlePrevUnit);

    this._txtTitle.setAlign(ALIGN_CENTER);
    this._txtUFO.setAlign(ALIGN_CENTER);
    this._lstKills.setColumns(3, 60, 110, 100);

    this.init();
  }

  btnOkClick(_action?: Action): void {
    this.game().popState();
  }

  override init(): void {
    super.init();
    const diary = getDiary(this._soldier);
    if (!diary || diary.getMissionIdList().length === 0) {
      this.game().popState();
      return;
    }
    const missionStatistics = getMissionStatistics(this.game().getSavedGame());
    if (missionStatistics.length === 0) {
      this.game().popState();
      return;
    }

    let missionId = diary.getMissionIdList()[this._rowEntry];
    if (missionId > missionStatistics.length) {
      missionId = 0;
    }
    const mission = missionStatistics[missionId] || missionStatistics[0];
    const daysWounded = mission.injuryList.get(this._soldier.getId()) || 0;

    this._lstKills.clearList();
    this._txtTitle.setText(String(this.tr(mission.type)));
    if (mission.isUfoMission()) {
      this._txtUFO.setText(String(this.tr(mission.ufo)));
    }
    this._txtUFO.setVisible(mission.isUfoMission());
    this._txtScore.setText(String(this.tr("STR_SCORE_VALUE").arg(mission.score)));
    this._txtLocation.setText(String(this.tr("STR_LOCATION").arg(this.tr(mission.getLocationString()))));
    this._txtRace.setText(String(this.tr("STR_RACE_TYPE").arg(this.tr(mission.alienRace))));
    this._txtRace.setVisible(mission.alienRace !== "STR_UNKNOWN");
    this._txtDaylight.setText(String(this.tr("STR_DAYLIGHT_TYPE").arg(this.tr(mission.getDaylightString()))));
    this._txtDaysWounded.setText(String(this.tr("STR_DAYS_WOUNDED").arg(daysWounded)));
    this._txtDaysWounded.setVisible(daysWounded !== 0);

    let kills = 0;
    let stunOrKill = false;
    for (const kill of diary.getKills()) {
      if (kill.mission !== missionId) {
        continue;
      }
      switch (kill.status) {
        case UnitStatus.STATUS_DEAD:
          kills++;
          stunOrKill = true;
          break;
        case UnitStatus.STATUS_UNCONSCIOUS:
        case UnitStatus.STATUS_PANICKING:
        case UnitStatus.STATUS_TURNING:
          stunOrKill = true;
          break;
        default:
          break;
      }

      this._lstKills.addRow(
        3,
        String(this.tr(kill.getKillStatusString())),
        kill.getUnitName(this.game().getLanguage()),
        String(this.tr(kill.weapon))
      );
    }

    this._txtNoRecord.setAlign(ALIGN_CENTER);
    this._txtNoRecord.setText(String(this.tr("STR_NO_RECORD")));
    this._txtNoRecord.setVisible(!stunOrKill);
    this._txtKills.setText(String(this.tr("STR_KILLS").arg(kills)));
  }

  btnPrevClick(_action?: Action): void {
    const diary = getDiary(this._soldier);
    if (!diary) {
      return;
    }
    this._rowEntry = this._rowEntry === 0 ? diary.getMissionTotal() - 1 : this._rowEntry - 1;
    this.init();
  }

  btnNextClick(_action?: Action): void {
    const diary = getDiary(this._soldier);
    if (!diary) {
      return;
    }
    this._rowEntry++;
    if (this._rowEntry >= diary.getMissionTotal()) {
      this._rowEntry = 0;
    }
    this.init();
  }
}
