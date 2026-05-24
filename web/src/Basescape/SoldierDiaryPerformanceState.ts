import type { Action } from "../Engine/Action.ts";
import { Options } from "../Engine/Options.ts";
import { State } from "../Engine/State.ts";
import { Surface } from "../Engine/Surface.ts";
import type { SurfaceSet } from "../Engine/SurfaceSet.ts";
import { ALIGN_CENTER, Text } from "../Interface/Text.ts";
import { TextButton } from "../Interface/TextButton.ts";
import { TextList } from "../Interface/TextList.ts";
import { Window } from "../Interface/Window.ts";
import type { Base } from "../Savegame/Base.ts";
import type { Soldier } from "../Savegame/Soldier.ts";
import { MissionStatistics, type MissionStatisticsSave } from "../Savegame/MissionStatistics.ts";
import { SoldierDiary, type RuleCommendationsLike, type SoldierDiaryModLike } from "../Savegame/SoldierDiary.ts";

export const DIARY_KILLS = "DIARY_KILLS";
export const DIARY_MISSIONS = "DIARY_MISSIONS";
export const DIARY_COMMENDATIONS = "DIARY_COMMENDATIONS";
export type SoldierDiaryDisplay = typeof DIARY_KILLS | typeof DIARY_MISSIONS | typeof DIARY_COMMENDATIONS;

type SoldierDiaryOverviewStateLike = {
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
 * Diary screen that lists soldier totals.
 */
export class SoldierDiaryPerformanceState extends State {
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
  private _txtMedalName: Text;
  private _txtMedalLevel: Text;
  private _txtMedalInfo: Text;
  private _lstPerformance: TextList;
  private _lstKillTotals: TextList;
  private _lstMissionTotals: TextList;
  private _lstCommendations: TextList;
  private _commendationsListEntry: string[] = [];
  private _commendations: Surface[] = [];
  private _commendationDecorations: Surface[] = [];
  private _commendationSprite: SurfaceSet | null = null;
  private _commendationDecoration: SurfaceSet | null = null;
  private _lastScrollPos = 0;
  private _group: { value: TextButton | null } = { value: null };

  constructor(
    private _base: Base | null,
    private _soldierId: number,
    private _soldierDiaryOverviewState: SoldierDiaryOverviewStateLike,
    private _display: SoldierDiaryDisplay
  ) {
    super();
    if (this._base === null) {
      this._list = this.game().getSavedGame()?.getDeadSoldiers() || [];
    } else {
      this._list = this._base.getSoldiers();
    }

    this._window = new Window(this, 320, 200, 0, 0);
    this._btnPrev = new TextButton(28, 14, 8, 8);
    this._btnNext = new TextButton(28, 14, 284, 8);
    this._btnKills = new TextButton(70, 16, 8, 176);
    this._btnMissions = new TextButton(70, 16, 86, 176);
    this._btnCommendations = new TextButton(70, 16, 164, 176);
    this._btnOk = new TextButton(70, 16, 242, 176);
    this._txtTitle = new Text(310, 16, 5, 8);
    this._lstPerformance = new TextList(288, 128, 8, 28);
    this._lstKillTotals = new TextList(302, 9, 8, 164);
    this._lstMissionTotals = new TextList(302, 9, 8, 164);
    this._txtMedalName = new Text(120, 18, 16, 36);
    this._txtMedalLevel = new Text(120, 18, 186, 36);
    this._txtMedalInfo = new Text(280, 32, 20, 135);
    this._lstCommendations = new TextList(240, 80, 48, 52);
    for (let i = 0; i !== 10; ++i) {
      this._commendations.push(new Surface(31, 8, 16, 52 + 8 * i));
      this._commendationDecorations.push(new Surface(31, 8, 16, 52 + 8 * i));
    }

    this.setInterface("soldierDiaryPerformance");

    this.add(this._window, "window", "soldierDiaryPerformance");
    this.add(this._btnOk, "button", "soldierDiaryPerformance");
    this.add(this._btnKills, "button", "soldierDiaryPerformance");
    this.add(this._btnMissions, "button", "soldierDiaryPerformance");
    this.add(this._btnCommendations, "button", "soldierDiaryPerformance");
    this.add(this._btnPrev, "button", "soldierDiaryPerformance");
    this.add(this._btnNext, "button", "soldierDiaryPerformance");
    this.add(this._txtTitle, "text1", "soldierDiaryPerformance");
    this.add(this._lstPerformance, "list", "soldierDiaryPerformance");
    this.add(this._lstKillTotals, "text2", "soldierDiaryPerformance");
    this.add(this._lstMissionTotals, "text2", "soldierDiaryPerformance");
    this.add(this._txtMedalName, "text2", "soldierDiaryPerformance");
    this.add(this._txtMedalLevel, "text2", "soldierDiaryPerformance");
    this.add(this._txtMedalInfo, "text2", "soldierDiaryPerformance");
    this.add(this._lstCommendations, "list", "soldierDiaryPerformance");
    for (let i = 0; i !== 10; ++i) {
      this.add(this._commendations[i]);
      this.add(this._commendationDecorations[i]);
    }

    this.centerAllSurfaces();

    const back02 = this.game().getMod()?.getSurface("BACK02.SCR");
    if (back02) {
      this._window.setBackground(back02);
    }

    this._btnOk.setText(String(this.tr("STR_OK")));
    this._btnOk.onMouseClick(this.btnOkClick.bind(this));
    this._btnOk.onKeyboardPress(this.btnOkClick.bind(this), Options.keyCancel);

    this._btnKills.setText(String(this.tr("STR_COMBAT")));
    this._btnKills.onMouseClick(this.btnKillsToggle.bind(this));

    this._btnMissions.setText(String(this.tr("STR_PERFORMANCE")));
    this._btnMissions.onMouseClick(this.btnMissionsToggle.bind(this));

    this._btnCommendations.setText(String(this.tr("STR_AWARDS")));
    this._btnCommendations.onMouseClick(this.btnCommendationsToggle.bind(this));

    this._btnPrev.setText("<<");
    this._btnPrev.onMouseClick((this._base === null ? this.btnNextClick : this.btnPrevClick).bind(this));
    this._btnPrev.onKeyboardPress((this._base === null ? this.btnNextClick : this.btnPrevClick).bind(this), Options.keyBattlePrevUnit);

    this._btnNext.setText(">>");
    this._btnNext.onMouseClick((this._base === null ? this.btnPrevClick : this.btnNextClick).bind(this));
    this._btnNext.onKeyboardPress((this._base === null ? this.btnPrevClick : this.btnNextClick).bind(this), Options.keyBattleNextUnit);

    this._txtTitle.setBig();
    this._txtTitle.setAlign(ALIGN_CENTER);

    this._lstPerformance.setColumns(2, 273, 15);
    this._lstPerformance.setDot(true);

    this._lstKillTotals.setColumns(4, 72, 72, 72, 86);
    this._lstMissionTotals.setColumns(4, 72, 72, 72, 86);

    this._txtMedalName.setText(String(this.tr("STR_MEDAL_NAME")));
    this._txtMedalLevel.setText(String(this.tr("STR_MEDAL_DECOR_LEVEL")));
    this._txtMedalInfo.setWordWrap(true);

    this._lstCommendations.setColumns(2, 138, 100);
    this._lstCommendations.setSelectable(true);
    this._lstCommendations.setBackground(this._window);
    this._lstCommendations.onMouseOver(this.lstInfoMouseOver.bind(this));
    this._lstCommendations.onMouseOut(this.lstInfoMouseOut.bind(this));
    this._lstCommendations.onMousePress(this.handle.bind(this));

    if (this._display === DIARY_KILLS) {
      this._group.value = this._btnKills;
    } else if (this._display === DIARY_MISSIONS) {
      this._group.value = this._btnMissions;
    } else if (this._display === DIARY_COMMENDATIONS) {
      this._group.value = this._btnCommendations;
    }
    this._btnKills.setGroup(this._group);
    this._btnMissions.setGroup(this._group);
    this._btnCommendations.setGroup(this._group);

    this.init();
  }

  override init(): void {
    super.init();
    for (let i = 0; i !== 10; ++i) {
      this._commendations[i].clear();
      this._commendationDecorations[i].clear();
    }
    this._lstPerformance.scrollTo(0);
    this._lstKillTotals.scrollTo(0);
    this._lstMissionTotals.scrollTo(0);
    this._lstCommendations.scrollTo(0);
    this._lastScrollPos = 0;
    this._lstPerformance.setVisible(this._display !== DIARY_COMMENDATIONS);
    this._lstKillTotals.setVisible(this._display === DIARY_KILLS);
    this._lstMissionTotals.setVisible(this._display === DIARY_MISSIONS);
    this._txtMedalName.setVisible(this._display === DIARY_COMMENDATIONS);
    this._txtMedalLevel.setVisible(this._display === DIARY_COMMENDATIONS);
    this._txtMedalInfo.setVisible(this._display === DIARY_COMMENDATIONS);
    this._lstCommendations.setVisible(this._display === DIARY_COMMENDATIONS);
    this._btnCommendations.setVisible(hasCommendations(this.game().getMod()));

    if (this._list.length === 0) {
      this.game().popState();
      return;
    }
    if (this._soldierId >= this._list.length) {
      this._soldierId = 0;
    }
    this._soldier = this._list[this._soldierId];
    const diary = getDiary(this._soldier);
    const missionStatistics = getMissionStatistics(this.game().getSavedGame());
    this._lstKillTotals.clearList();
    this._lstMissionTotals.clearList();
    this._commendationsListEntry = [];
    this._txtTitle.setText(this._soldier.getName());
    this._lstPerformance.clearList();
    this._lstCommendations.clearList();
    if (!diary) {
      return;
    }

    if (this._display === DIARY_KILLS) {
      const mapArray = [diary.getAlienRaceTotal(), diary.getAlienRankTotal(), diary.getWeaponTotal()];
      const titleArray = ["STR_NEUTRALIZATIONS_BY_RACE", "STR_NEUTRALIZATIONS_BY_RANK", "STR_NEUTRALIZATIONS_BY_WEAPON"];

      for (let i = 0; i !== 3; ++i) {
        this._lstPerformance.addRow(1, String(this.tr(titleArray[i])));
        this._lstPerformance.setRowColor(this._lstPerformance.getRows() - 1, this._lstPerformance.getSecondaryColor());
        for (const [key, value] of mapArray[i]) {
          this._lstPerformance.addRow(2, String(this.tr(key)), String(value));
        }
        if (i !== 2) {
          this._lstPerformance.addRow(1, "");
        }
      }

      const save = this.game().getSavedGame();
      const mod = this.game().getMod();
      if (this._soldier.getCurrentStats().psiSkill > 0 || (Options.psiStrengthEval && Boolean(save?.isResearched(mod?.getPsiRequirements() || [])))) {
        this._lstKillTotals.addRow(
          4,
          String(this.tr("STR_KILLS").arg(diary.getKillTotal())),
          String(this.tr("STR_STUNS").arg(diary.getStunTotal())),
          String(this.tr("STR_DIARY_ACCURACY").arg(diary.getAccuracy())),
          String(this.tr("STR_MINDCONTROLS").arg(diary.getControlTotal()))
        );
      } else {
        this._lstKillTotals.addRow(
          3,
          String(this.tr("STR_KILLS").arg(diary.getKillTotal())),
          String(this.tr("STR_STUNS").arg(diary.getStunTotal())),
          String(this.tr("STR_DIARY_ACCURACY").arg(diary.getAccuracy()))
        );
      }
    } else if (this._display === DIARY_MISSIONS) {
      const mapArray = [diary.getRegionTotal(missionStatistics), diary.getTypeTotal(missionStatistics), diary.getUFOTotal(missionStatistics)];
      const titleArray = ["STR_MISSIONS_BY_LOCATION", "STR_MISSIONS_BY_TYPE", "STR_MISSIONS_BY_UFO"];

      for (let i = 0; i !== 3; ++i) {
        this._lstPerformance.addRow(1, String(this.tr(titleArray[i])));
        this._lstPerformance.setRowColor(this._lstPerformance.getRows() - 1, this._lstPerformance.getSecondaryColor());
        for (const [key, value] of mapArray[i]) {
          if (key === "NO_UFO") {
            continue;
          }
          this._lstPerformance.addRow(2, String(this.tr(key)), String(value));
        }
        if (i !== 2) {
          this._lstPerformance.addRow(1, "");
        }
      }

      this._lstMissionTotals.addRow(
        4,
        String(this.tr("STR_MISSIONS").arg(diary.getMissionTotal())),
        String(this.tr("STR_WINS").arg(diary.getWinTotal(missionStatistics))),
        String(this.tr("STR_SCORE_VALUE").arg(diary.getScoreTotal(missionStatistics))),
        String(this.tr("STR_DAYS_WOUNDED").arg(diary.getDaysWoundedTotal()))
      );
    } else if (this._display === DIARY_COMMENDATIONS && hasCommendations(this.game().getMod())) {
      const mod = this.game().getMod() as unknown as SoldierDiaryModLike;
      for (const entry of diary.getSoldierCommendations()) {
        const commendation = mod.getCommendation?.(entry.getType()) as RuleCommendationsLike | null | undefined;
        if (!commendation) {
          continue;
        }
        const description = commendation.getDescription?.() || "";
        if (entry.getNoun() !== "noNoun") {
          this._lstCommendations.addRow(
            2,
            String(this.tr(entry.getType()).arg(this.tr(entry.getNoun()))),
            String(this.tr(entry.getDecorationDescription()))
          );
          this._commendationsListEntry.push(String(this.tr(description).arg(this.tr(entry.getNoun()))));
        } else {
          this._lstCommendations.addRow(2, String(this.tr(entry.getType())), String(this.tr(entry.getDecorationDescription())));
          this._commendationsListEntry.push(String(this.tr(description)));
        }
      }
      this.drawSprites();
    }
  }

  drawSprites(): void {
    if (this._display !== DIARY_COMMENDATIONS) {
      return;
    }
    const mod = this.game().getMod() as unknown as SoldierDiaryModLike;
    this._commendationSprite = this.game().getMod()?.getSurfaceSet("Commendations") || null;
    this._commendationDecoration = this.game().getMod()?.getSurfaceSet("CommendationDecorations") || null;

    for (let i = 0; i !== 10; ++i) {
      this._commendations[i].clear();
      this._commendationDecorations[i].clear();
    }

    const diary = getDiary(this._list[this._soldierId] || null);
    if (!diary) {
      return;
    }
    let vectorIterator = 0;
    const scrollDepth = this._lstCommendations.getScroll();

    for (const entry of diary.getSoldierCommendations()) {
      const commendation = mod.getCommendation?.(entry.getType());
      if (!commendation) {
        vectorIterator++;
        continue;
      }
      if (vectorIterator < scrollDepth || vectorIterator - scrollDepth >= this._commendations.length) {
        vectorIterator++;
        continue;
      }

      const sprite = commendation.getSprite?.() || 0;
      const decorationSprite = entry.getDecorationLevelInt();
      const target = this._commendations[vectorIterator - scrollDepth];
      const decorationTarget = this._commendationDecorations[vectorIterator - scrollDepth];
      const commendationFrame = this._commendationSprite?.getFrame(sprite);
      if (commendationFrame) {
        commendationFrame.setX(0);
        commendationFrame.setY(0);
        commendationFrame.blit(target);
      }
      if (decorationSprite !== 0) {
        const decorationFrame = this._commendationDecoration?.getFrame(decorationSprite);
        if (decorationFrame) {
          decorationFrame.setX(0);
          decorationFrame.setY(0);
          decorationFrame.blit(decorationTarget);
        }
      }

      vectorIterator++;
    }
  }

  btnOkClick(_action?: Action): void {
    this._soldierDiaryOverviewState.setSoldierId(this._soldierId);
    this.game().popState();
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

  btnKillsToggle(_action?: Action): void {
    this._display = DIARY_KILLS;
    this.init();
  }

  btnMissionsToggle(_action?: Action): void {
    this._display = DIARY_MISSIONS;
    this.init();
  }

  btnCommendationsToggle(_action?: Action): void {
    this._display = DIARY_COMMENDATIONS;
    this.init();
  }

  lstInfoMouseOver(_action?: Action): void {
    const selected = this._lstCommendations.getSelectedRow();
    if (this._commendationsListEntry.length === 0 || selected < 0 || selected > this._commendationsListEntry.length - 1) {
      this._txtMedalInfo.setText("");
    } else {
      this._txtMedalInfo.setText(this._commendationsListEntry[selected]);
    }
  }

  lstInfoMouseOut(_action?: Action): void {
    this._txtMedalInfo.setText("");
  }

  override think(): void {
    super.think();
    if (this._lastScrollPos !== this._lstCommendations.getScroll()) {
      this.drawSprites();
      this._lastScrollPos = this._lstCommendations.getScroll();
    }
  }
}
