import type { Action } from "../Engine/Action.ts";
import { Options } from "../Engine/Options.ts";
import { State } from "../Engine/State.ts";
import { formatFunding, TOK_COLOR_FLIP } from "../Engine/Unicode.ts";
import { MissionObjective } from "../Mod/RuleAlienMission.ts";
import { ALIGN_CENTER, ALIGN_MIDDLE, Text } from "../Interface/Text.ts";
import { TextButton } from "../Interface/TextButton.ts";
import { Window } from "../Interface/Window.ts";
import type { Base } from "../Savegame/Base.ts";
import type { SavedGame } from "../Savegame/SavedGame.ts";
import type { Soldier } from "../Savegame/Soldier.ts";
import type { SoldierDiaryModLike } from "../Savegame/SoldierDiary.ts";
import type { MissionStatistics } from "../Savegame/MissionStatistics.ts";
import type { Globe } from "./Globe.ts";
import { PsiTrainingState } from "./PsiTrainingState.ts";
import { CommendationState } from "../Battlescape/CommendationState.ts";
import { CutsceneState } from "../Menu/CutsceneState.ts";
import { OPT_GEOSCAPE } from "../Menu/OptionsBaseState.ts";
import { SaveGameState, SaveType } from "../Menu/SaveGameState.ts";

const COLOR_FLIP = String.fromCharCode(TOK_COLOR_FLIP);
const END_LOSE = 2;
const INT_MAX = 2147483647;

type MonthlyMod = SoldierDiaryModLike & {
  getDefeatScore?: () => number;
  getDefeatFunds?: () => number;
  getRandomMission?: (objective: MissionObjective, monthsPassed: number) => { getPoints: () => number } | null;
  playMusic?: (name: string) => void;
};

type MonthlySavedGame = SavedGame & {
  getDifficultyCoefficient?: () => number;
  getFundsList?: () => number[];
  getWarned?: () => boolean;
  setWarned?: (warned: boolean) => void;
  setEnding?: (ending: number) => void;
  getSoldier?: (id: number) => Soldier | null;
  getMissionStatistics?: () => MissionStatistics[];
};

type SoldierWithDiary = Soldier & {
  getDiary?: () => {
    addMonthlyService?: () => void;
    manageCommendations?: (mod: SoldierDiaryModLike, missionStatistics: MissionStatistics[]) => boolean;
  } | null;
};

type OptionsWithAutosave = typeof Options & {
  autosave?: boolean;
};

/**
 * Report screen shown monthly to display
 * changes in the player's performance and funding.
 */
export class MonthlyReportState extends State {
  private _btnOk: TextButton;
  private _btnBigOk: TextButton;
  private _window: Window;
  private _txtTitle: Text;
  private _txtMonth: Text;
  private _txtRating: Text;
  private _txtIncome: Text;
  private _txtMaintenance: Text;
  private _txtBalance: Text;
  private _txtDesc: Text;
  private _txtFailure: Text;
  private _gameOver = false;
  private _ratingTotal = 0;
  private _fundingDiff = 0;
  private _lastMonthsRating = 0;
  private _happyList: string[] = [];
  private _sadList: string[] = [];
  private _pactList: string[] = [];
  private _soldiersMedalled: Soldier[] = [];

  constructor(private _psi: boolean, private _globe: Globe | null) {
    super();
    void this._globe;

    this._window = new Window(this, 320, 200, 0, 0);
    this._btnOk = new TextButton(50, 12, 135, 180);
    this._btnBigOk = new TextButton(120, 18, 100, 174);
    this._txtTitle = new Text(300, 17, 16, 8);
    this._txtMonth = new Text(130, 9, 16, 24);
    this._txtRating = new Text(160, 9, 146, 24);
    this._txtIncome = new Text(300, 9, 16, 32);
    this._txtMaintenance = new Text(130, 9, 16, 40);
    this._txtBalance = new Text(160, 9, 146, 40);
    this._txtDesc = new Text(280, 132, 16, 48);
    this._txtFailure = new Text(290, 160, 15, 10);

    this.setInterface("monthlyReport");

    this.add(this._window, "window", "monthlyReport");
    this.add(this._btnOk, "button", "monthlyReport");
    this.add(this._btnBigOk, "button", "monthlyReport");
    this.add(this._txtTitle, "text1", "monthlyReport");
    this.add(this._txtMonth, "text1", "monthlyReport");
    this.add(this._txtRating, "text1", "monthlyReport");
    this.add(this._txtIncome, "text1", "monthlyReport");
    this.add(this._txtMaintenance, "text1", "monthlyReport");
    this.add(this._txtBalance, "text1", "monthlyReport");
    this.add(this._txtDesc, "text2", "monthlyReport");
    this.add(this._txtFailure, "text2", "monthlyReport");

    this.centerAllSurfaces();

    const back13 = this.game().getMod()?.getSurface("BACK13.SCR");
    if (back13) {
      this._window.setBackground(back13);
    }

    this._btnOk.setText(String(this.tr("STR_OK")));
    this._btnOk.onMouseClick(this.btnOkClick.bind(this));
    this._btnOk.onKeyboardPress(this.btnOkClick.bind(this), Options.keyOk);
    this._btnOk.onKeyboardPress(this.btnOkClick.bind(this), Options.keyCancel);

    this._btnBigOk.setText(String(this.tr("STR_OK")));
    this._btnBigOk.onMouseClick(this.btnOkClick.bind(this));
    this._btnBigOk.onKeyboardPress(this.btnOkClick.bind(this), Options.keyOk);
    this._btnBigOk.onKeyboardPress(this.btnOkClick.bind(this), Options.keyCancel);
    this._btnBigOk.setVisible(false);

    this._txtTitle.setBig();
    this._txtTitle.setText(String(this.tr("STR_XCOM_PROJECT_MONTHLY_REPORT")));

    this._txtFailure.setBig();
    this._txtFailure.setAlign(ALIGN_CENTER);
    this._txtFailure.setVerticalAlign(ALIGN_MIDDLE);
    this._txtFailure.setWordWrap(true);
    this._txtFailure.setText(String(this.tr("STR_YOU_HAVE_FAILED")));
    this._txtFailure.setVisible(false);

    this.calculateChanges();

    const save = this.game().getSavedGame() as MonthlySavedGame | null;
    if (!save) {
      return;
    }

    let month = save.getTime().getMonth() - 1;
    let year = save.getTime().getYear();
    if (month === 0) {
      month = 12;
      year--;
    }
    const months = ["", "STR_JAN", "STR_FEB", "STR_MAR", "STR_APR", "STR_MAY", "STR_JUN", "STR_JUL", "STR_AUG", "STR_SEP", "STR_OCT", "STR_NOV", "STR_DEC"];
    const m = months[month] || "";
    this._txtMonth.setText(String(this.tr("STR_MONTH").arg(this.tr(m)).arg(year)));

    const difficultyThreshold = this.defeatScore() + 100 * this.getDifficultyCoefficient(save);
    let rating = String(this.tr("STR_RATING_TERRIBLE"));
    if (this._ratingTotal > difficultyThreshold - 300) {
      rating = String(this.tr("STR_RATING_POOR"));
    }
    if (this._ratingTotal > difficultyThreshold) {
      rating = String(this.tr("STR_RATING_OK"));
    }
    if (this._ratingTotal > 0) {
      rating = String(this.tr("STR_RATING_GOOD"));
    }
    if (this._ratingTotal > 500) {
      rating = String(this.tr("STR_RATING_EXCELLENT"));
    }

    this._txtRating.setText(String(this.tr("STR_MONTHLY_RATING").arg(this._ratingTotal).arg(rating)));

    let incomeText = `${this.tr("STR_INCOME")}> ${COLOR_FLIP}${formatFunding(save.getCountryFunding())}`;
    incomeText += ` (${this._fundingDiff > 0 ? "+" : ""}${formatFunding(this._fundingDiff)})`;
    this._txtIncome.setText(incomeText);

    this._txtMaintenance.setText(`${this.tr("STR_MAINTENANCE")}> ${COLOR_FLIP}${formatFunding(save.getBaseMaintenance())}`);
    this._txtBalance.setText(`${this.tr("STR_BALANCE")}> ${COLOR_FLIP}${formatFunding(save.getFunds())}`);

    this._txtDesc.setWordWrap(true);

    let description = "";
    let satisFactionString = String(this.tr("STR_COUNCIL_IS_DISSATISFIED"));
    let resetWarning = true;
    if (this._ratingTotal > difficultyThreshold) {
      satisFactionString = String(this.tr("STR_COUNCIL_IS_GENERALLY_SATISFIED"));
    }
    if (this._ratingTotal > 500) {
      satisFactionString = String(this.tr("STR_COUNCIL_IS_VERY_PLEASED"));
    }
    if (this._lastMonthsRating <= difficultyThreshold && this._ratingTotal <= difficultyThreshold) {
      satisFactionString = String(this.tr("STR_YOU_HAVE_NOT_SUCCEEDED"));
      this._pactList.length = 0;
      this._happyList.length = 0;
      this._sadList.length = 0;
      this._gameOver = true;
    }

    description += satisFactionString;

    if (!this._gameOver && save.getFunds() <= this.defeatFunds()) {
      if (save.getWarned?.()) {
        description = String(this.tr("STR_YOU_HAVE_NOT_SUCCEEDED"));
        this._pactList.length = 0;
        this._happyList.length = 0;
        this._sadList.length = 0;
        this._gameOver = true;
      } else {
        description += `\n\n${this.tr("STR_COUNCIL_REDUCE_DEBTS")}`;
        save.setWarned?.(true);
        resetWarning = false;
      }
    }
    if (resetWarning && save.getWarned?.()) {
      save.setWarned?.(false);
    }

    description += this.countryList(this._happyList, "STR_COUNTRY_IS_PARTICULARLY_PLEASED", "STR_COUNTRIES_ARE_PARTICULARLY_HAPPY");
    description += this.countryList(this._sadList, "STR_COUNTRY_IS_UNHAPPY_WITH_YOUR_ABILITY", "STR_COUNTRIES_ARE_UNHAPPY_WITH_YOUR_ABILITY");
    description += this.countryList(this._pactList, "STR_COUNTRY_HAS_SIGNED_A_SECRET_PACT", "STR_COUNTRIES_HAVE_SIGNED_A_SECRET_PACT");

    this._txtDesc.setText(description);
  }

  override init(): void {
    super.init();
    if (this._gameOver) {
      (this.game().getSavedGame() as MonthlySavedGame | null)?.setEnding?.(END_LOSE);
    }
  }

  btnOkClick(_action?: Action): void {
    const save = this.game().getSavedGame() as MonthlySavedGame | null;
    if (!save) {
      this.game().popState();
      return;
    }

    if (!this._gameOver) {
      this.game().popState();
      for (const base of save.getBases()) {
        for (const baseSoldier of base.getSoldiers()) {
          const soldier = (save.getSoldier?.(baseSoldier.getId()) || baseSoldier) as SoldierWithDiary;
          const diary = soldier.getDiary?.() || null;
          diary?.addMonthlyService?.();
          if (diary?.manageCommendations?.(this.modForDiary(), save.getMissionStatistics?.() || [])) {
            this._soldiersMedalled.push(soldier);
          }
        }
      }
      if (this._soldiersMedalled.length > 0) {
        this.game().pushState(new CommendationState(this._soldiersMedalled));
      }
      if (this._psi) {
        this.game().pushState(new PsiTrainingState());
      }
      if (save.isIronman()) {
        this.game().pushState(new SaveGameState(OPT_GEOSCAPE, SaveType.SAVE_IRONMAN, this._palette));
      } else if ((Options as OptionsWithAutosave).autosave) {
        this.game().pushState(new SaveGameState(OPT_GEOSCAPE, SaveType.SAVE_AUTO_GEOSCAPE, this._palette));
      }
    } else if (this._txtFailure.getVisible()) {
      this.game().pushState(new CutsceneState(CutsceneState.LOSE_GAME));
      if (save.isIronman()) {
        this.game().pushState(new SaveGameState(OPT_GEOSCAPE, SaveType.SAVE_IRONMAN, this._palette));
      }
    } else {
      const color2 = this.game().getMod()?.getInterface("monthlyReport")?.getElement("window")?.color2;
      if (color2 != null && color2 !== INT_MAX) {
        this._window.setColor(color2);
      }
      this._txtTitle.setVisible(false);
      this._txtMonth.setVisible(false);
      this._txtRating.setVisible(false);
      this._txtIncome.setVisible(false);
      this._txtMaintenance.setVisible(false);
      this._txtBalance.setVisible(false);
      this._txtDesc.setVisible(false);
      this._btnOk.setVisible(false);
      this._btnBigOk.setVisible(true);
      this._txtFailure.setVisible(true);
      (this.game().getMod() as MonthlyMod | null)?.playMusic?.("GMLOSE");
    }
  }

  calculateChanges(): void {
    const save = this.game().getSavedGame() as MonthlySavedGame | null;
    if (!save) {
      return;
    }

    this._lastMonthsRating = 0;
    let xcomSubTotal = 0;
    let xcomTotal = 0;
    let alienTotal = 0;
    const fundsList = this.getFundsList(save);
    const monthOffset = fundsList.length - 2;
    let lastMonthOffset = fundsList.length - 3;
    if (lastMonthOffset < 0) {
      lastMonthOffset += 2;
    }

    for (const region of save.getRegions()) {
      region.newMonth();
      if (region.getActivityXcom().length > 2) {
        this._lastMonthsRating += this.atNumber(region.getActivityXcom(), lastMonthOffset) - this.atNumber(region.getActivityAlien(), lastMonthOffset);
      }
      xcomSubTotal += this.atNumber(region.getActivityXcom(), monthOffset);
      alienTotal += this.atNumber(region.getActivityAlien(), monthOffset);
    }

    const researchScores = save.getResearchScores();
    if (save.getMonthsPassed() > 1 && this.hasIndex(researchScores, monthOffset)) {
      researchScores[this.normalizeIndex(researchScores, monthOffset)] += 400;
    }

    xcomTotal = this.atNumber(researchScores, monthOffset) + xcomSubTotal;

    if (researchScores.length > 2) {
      this._lastMonthsRating += this.atNumber(researchScores, lastMonthOffset);
    }

    const infiltration = (this.game().getMod() as MonthlyMod | null)?.getRandomMission?.(MissionObjective.OBJECTIVE_INFILTRATION, save.getMonthsPassed());
    const pactScore = infiltration?.getPoints() || 0;
    for (const country of save.getCountries()) {
      if (country.getNewPact()) {
        this._pactList.push(country.getRules().getType());
      }
      country.newMonth(xcomTotal, alienTotal, pactScore);
      const funding = country.getFunding();
      this._fundingDiff += (funding.at(-1) || 0) - (funding.at(-2) || 0);
      switch (country.getSatisfaction()) {
        case 1:
          this._sadList.push(country.getRules().getType());
          break;
        case 3:
          this._happyList.push(country.getRules().getType());
          break;
        default:
          break;
      }
    }
    this._ratingTotal = xcomTotal - alienTotal;
  }

  private countryList(countries: string[], singular: string, plural: string): string {
    let result = "";
    if (countries.length > 0) {
      result += "\n\n";
      if (countries.length === 1) {
        result += String(this.tr(singular).arg(this.tr(countries[0])));
      } else {
        let list = this.tr(countries[0]);
        let i = 1;
        for (; i < countries.length - 1; ++i) {
          list = this.tr("STR_COUNTRIES_COMMA").arg(list).arg(this.tr(countries[i]));
        }
        list = this.tr("STR_COUNTRIES_AND").arg(list).arg(this.tr(countries[i]));
        result += String(this.tr(plural).arg(list));
      }
    }
    return result;
  }

  private getFundsList(save: MonthlySavedGame): number[] {
    const funds = save.getFundsList?.();
    if (funds && funds.length > 0) {
      return funds;
    }
    return [save.getFunds(), save.getFunds()];
  }

  private defeatScore(): number {
    return (this.game().getMod() as MonthlyMod | null)?.getDefeatScore?.() || 0;
  }

  private defeatFunds(): number {
    return (this.game().getMod() as MonthlyMod | null)?.getDefeatFunds?.() || 0;
  }

  private getDifficultyCoefficient(save: MonthlySavedGame): number {
    const coefficient = save.getDifficultyCoefficient?.();
    if (coefficient != null) {
      return coefficient;
    }
    return Math.max(0, Math.min(4, save.getDifficulty()));
  }

  private atNumber(values: ArrayLike<number>, index: number): number {
    if (values.length === 0) {
      return 0;
    }
    const normalized = this.normalizeIndex(values, index);
    return Math.trunc(values[normalized] || 0);
  }

  private hasIndex(values: ArrayLike<number>, index: number): boolean {
    if (values.length === 0) {
      return false;
    }
    const normalized = this.normalizeIndex(values, index);
    return normalized >= 0 && normalized < values.length;
  }

  private normalizeIndex(values: ArrayLike<number>, index: number): number {
    if (index < 0) {
      return Math.max(0, values.length + index);
    }
    return Math.min(index, values.length - 1);
  }

  private modForDiary(): SoldierDiaryModLike {
    return (this.game().getMod() || {}) as SoldierDiaryModLike;
  }
}
