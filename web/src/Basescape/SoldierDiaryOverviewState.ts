import type { Action } from "../Engine/Action.ts";
import { Options } from "../Engine/Options.ts";
import { State } from "../Engine/State.ts";
import { ALIGN_CENTER, Text } from "../Interface/Text.ts";
import { TextButton } from "../Interface/TextButton.ts";
import { TextList } from "../Interface/TextList.ts";
import { Window } from "../Interface/Window.ts";
import type { Base } from "../Savegame/Base.ts";
import type { Soldier } from "../Savegame/Soldier.ts";
import { MissionStatistics, type MissionStatisticsSave } from "../Savegame/MissionStatistics.ts";
import { SoldierDiary, type SoldierDiaryModLike } from "../Savegame/SoldierDiary.ts";
import { DIARY_COMMENDATIONS, DIARY_KILLS, DIARY_MISSIONS, SoldierDiaryPerformanceState } from "./SoldierDiaryPerformanceState.ts";
import { SoldierDiaryMissionState } from "./SoldierDiaryMissionState.ts";

type SoldierInfoStateLike = {
  setSoldierId: (soldier: number) => void;
};

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

function hasCommendations(mod: unknown): boolean {
  const list = (mod as SoldierDiaryModLike | null)?.getCommendationsList?.();
  if (!list) {
    return false;
  }
  return list instanceof Map ? list.size > 0 : Object.keys(list).length > 0;
}

/**
 * Diary screen that shows all the missions a soldier has.
 */
export class SoldierDiaryOverviewState extends State {
  private _soldier: Soldier | null = null;
  private _list: Soldier[];

  private _btnOk: TextButton;
  private _btnPrev: TextButton;
  private _btnNext: TextButton;
  private _btnKills: TextButton;
  private _btnMissions: TextButton;
  private _btnCommendations: TextButton;
  private _window: Window;
  private _txtTitle: Text;
  private _txtMission: Text;
  private _txtRating: Text;
  private _txtDate: Text;
  private _lstDiary: TextList;

  constructor(private _base: Base | null, private _soldierId: number, private _soldierInfoState: SoldierInfoStateLike) {
    super();
    if (this._base === null) {
      this._list = this.game().getSavedGame()?.getDeadSoldiers() || [];
    } else {
      this._list = this._base.getSoldiers();
    }

    this._window = new Window(this, 320, 200, 0, 0);
    this._btnKills = new TextButton(70, 16, 8, 176);
    this._btnMissions = new TextButton(70, 16, 86, 176);
    this._btnCommendations = new TextButton(70, 16, 164, 176);
    this._btnOk = new TextButton(70, 16, 242, 176);
    this._btnPrev = new TextButton(28, 14, 8, 8);
    this._btnNext = new TextButton(28, 14, 284, 8);
    this._txtTitle = new Text(310, 16, 5, 8);
    this._txtMission = new Text(114, 9, 16, 36);
    this._txtRating = new Text(102, 9, 120, 36);
    this._txtDate = new Text(90, 9, 218, 36);
    this._lstDiary = new TextList(288, 120, 8, 44);

    this.setInterface("soldierDiary");

    this.add(this._window, "window", "soldierDiary");
    this.add(this._btnOk, "button", "soldierDiary");
    this.add(this._btnKills, "button", "soldierDiary");
    this.add(this._btnMissions, "button", "soldierDiary");
    this.add(this._btnCommendations, "button", "soldierDiary");
    this.add(this._btnPrev, "button", "soldierDiary");
    this.add(this._btnNext, "button", "soldierDiary");
    this.add(this._txtTitle, "text1", "soldierDiary");
    this.add(this._txtMission, "text2", "soldierDiary");
    this.add(this._txtRating, "text2", "soldierDiary");
    this.add(this._txtDate, "text2", "soldierDiary");
    this.add(this._lstDiary, "list", "soldierDiary");

    this.centerAllSurfaces();

    const back02 = this.game().getMod()?.getSurface("BACK02.SCR");
    if (back02) {
      this._window.setBackground(back02);
    }

    this._btnOk.setText(String(this.tr("STR_OK")));
    this._btnOk.onMouseClick(this.btnOkClick.bind(this));
    this._btnOk.onKeyboardPress(this.btnOkClick.bind(this), Options.keyCancel);

    this._btnKills.setText(String(this.tr("STR_COMBAT")));
    this._btnKills.onMouseClick(this.btnKillsClick.bind(this));

    this._btnMissions.setText(String(this.tr("STR_PERFORMANCE")));
    this._btnMissions.onMouseClick(this.btnMissionsClick.bind(this));

    this._btnCommendations.setText(String(this.tr("STR_AWARDS")));
    this._btnCommendations.onMouseClick(this.btnCommendationsClick.bind(this));
    this._btnCommendations.setVisible(hasCommendations(this.game().getMod()));

    this._btnPrev.setText("<<");
    this._btnPrev.onMouseClick((this._base === null ? this.btnNextClick : this.btnPrevClick).bind(this));
    this._btnPrev.onKeyboardPress((this._base === null ? this.btnNextClick : this.btnPrevClick).bind(this), Options.keyBattlePrevUnit);

    this._btnNext.setText(">>");
    this._btnNext.onMouseClick((this._base === null ? this.btnPrevClick : this.btnNextClick).bind(this));
    this._btnNext.onKeyboardPress((this._base === null ? this.btnPrevClick : this.btnNextClick).bind(this), Options.keyBattleNextUnit);

    this._txtTitle.setBig();
    this._txtTitle.setAlign(ALIGN_CENTER);
    this._txtMission.setText(String(this.tr("STR_MISSION")));
    this._txtRating.setText(String(this.tr("STR_RATING_UC")));
    this._txtDate.setText(String(this.tr("STR_DATE_UC")));

    this._lstDiary.setColumns(5, 104, 98, 30, 25, 35);
    this._lstDiary.setSelectable(true);
    this._lstDiary.setBackground(this._window);
    this._lstDiary.setMargin(8);
    this._lstDiary.onMouseClick(this.lstDiaryInfoClick.bind(this));

    this.init();
  }

  override init(): void {
    super.init();
    if (this._list.length === 0) {
      this.game().popState();
      return;
    }
    if (this._soldierId >= this._list.length) {
      this._soldierId = 0;
    }
    this._soldier = this._list[this._soldierId];
    this._txtTitle.setText(this._soldier.getName());
    this._lstDiary.clearList();

    const diary = getDiary(this._soldier);
    const missionStatistics = getMissionStatistics(this.game().getSavedGame());
    let row = 0;
    for (const mission of missionStatistics) {
      let wasOnMission = false;
      for (const missionId of diary?.getMissionIdList() || []) {
        if (mission.id === missionId) {
          wasOnMission = true;
          break;
        }
      }
      if (!wasOnMission) {
        continue;
      }

      this._lstDiary.addRow(
        5,
        mission.getMissionName(this.game().getLanguage()),
        mission.getRatingString(this.game().getLanguage()),
        mission.time.getDayString(this.game().getLanguage()),
        String(this.tr(mission.time.getMonthString())),
        String(mission.time.getYear())
      );
      row++;
    }
    if (row > 0 && this._lstDiary.getScroll() >= row) {
      this._lstDiary.scrollTo(0);
    }
  }

  setSoldierId(soldier: number): void {
    this._soldierId = soldier;
  }

  btnOkClick(_action?: Action): void {
    this._soldierInfoState.setSoldierId(this._soldierId);
    this.game().popState();
  }

  btnKillsClick(_action?: Action): void {
    this.game().pushState(new SoldierDiaryPerformanceState(this._base, this._soldierId, this, DIARY_KILLS));
  }

  btnMissionsClick(_action?: Action): void {
    this.game().pushState(new SoldierDiaryPerformanceState(this._base, this._soldierId, this, DIARY_MISSIONS));
  }

  btnCommendationsClick(_action?: Action): void {
    this.game().pushState(new SoldierDiaryPerformanceState(this._base, this._soldierId, this, DIARY_COMMENDATIONS));
  }

  btnPrevClick(_action?: Action): void {
    this._soldierId = this._soldierId === 0 ? this._list.length - 1 : this._soldierId - 1;
    this.init();
  }

  btnNextClick(_action?: Action): void {
    this._soldierId++;
    if (this._soldierId >= this._list.length) {
      this._soldierId = 0;
    }
    this.init();
  }

  lstDiaryInfoClick(_action?: Action): void {
    const absoluteRowEntry = this._lstDiary.getSelectedRow();
    if (this._soldier && absoluteRowEntry !== -1) {
      this.game().pushState(new SoldierDiaryMissionState(this._soldier, absoluteRowEntry));
    }
  }
}
