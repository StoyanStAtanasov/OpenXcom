import type { Action } from "../Engine/Action.ts";
import { Options } from "../Engine/Options.ts";
import { formatFunding, formatNumber, formatPercentage, TOK_NL_SMALL } from "../Engine/Unicode.ts";
import { ALIGN_CENTER, Text } from "../Interface/Text.ts";
import { TextButton } from "../Interface/TextButton.ts";
import { TextList } from "../Interface/TextList.ts";
import { POPUP_BOTH, Window } from "../Interface/Window.ts";
import { State } from "../Engine/State.ts";
import { GameEnding, type SavedGame } from "../Savegame/SavedGame.ts";
import { GoToMainMenuState } from "./MainMenuState.ts";

type StatisticsSavedGame = SavedGame;

type SoldierDiaryLike = {
  getKillTotal?: () => number;
  getStunTotal?: () => number;
  getDaysWoundedTotal?: () => number;
  getMonthsService?: () => number;
  getWeaponTotal?: () => unknown;
  getShotsFiredTotal?: () => number;
  getShotsLandedTotal?: () => number;
};

type SoldierLike = {
  getDiary?: () => SoldierDiaryLike | null;
  getDeath?: () => { getCause?: () => { faction?: number; race?: string } | null } | null;
};

const FACTION_PLAYER = 0;

export class StatisticsState extends State {
  private _btnOk: TextButton;
  private _window: Window;
  private _txtTitle: Text;
  private _lstStats: TextList;

  constructor() {
    super();

    this._window = new Window(this, 320, 200, 0, 0, POPUP_BOTH);
    this._btnOk = new TextButton(50, 12, 135, 180);
    this._txtTitle = new Text(310, 25, 5, 8);
    this._lstStats = new TextList(280, 136, 12, 36);

    this.setInterface("endGameStatistics");

    this.add(this._window, "window", "endGameStatistics");
    this.add(this._btnOk, "button", "endGameStatistics");
    this.add(this._txtTitle, "text", "endGameStatistics");
    this.add(this._lstStats, "list", "endGameStatistics");

    this.centerAllSurfaces();

    const back01 = this.game().getMod()?.getSurface("BACK01.SCR");
    if (back01) {
      this._window.setBackground(back01);
    }

    this._btnOk.setText(String(this.tr("STR_OK")));
    this._btnOk.onMouseClick(this.btnOkClick.bind(this));
    this._btnOk.onKeyboardPress(this.btnOkClick.bind(this), Options.keyOk);

    this._txtTitle.setBig();
    this._txtTitle.setAlign(ALIGN_CENTER);

    this._lstStats.setColumns(2, 200, 80);
    this._lstStats.setDot(true);

    this.listStats();
  }

  sumVector(vec: ArrayLike<number> | Iterable<number> | null | undefined): number {
    let total = 0;
    if (!vec) {
      return total;
    }
    if (Symbol.iterator in Object(vec)) {
      for (const value of vec as Iterable<number>) {
        total += this.intValue(value);
      }
      return total;
    }
    if (this.isArrayLike(vec)) {
      for (let i = 0; i < vec.length; ++i) {
        total += this.intValue(vec[i]);
      }
    }
    return total;
  }

  listStats(): void {
    const save = this.game().getSavedGame() as StatisticsSavedGame | null;
    if (!save) {
      this._txtTitle.setText(String(this.tr("STR_STATISTICS")));
      return;
    }

    const time = save.getTime();
    let title = "";
    const ending = this.getEnding(save);
    if (ending === GameEnding.END_WIN) {
      title += String(this.tr("STR_VICTORY"));
    } else if (ending === GameEnding.END_LOSE) {
      title += String(this.tr("STR_DEFEAT"));
    } else {
      title += String(this.tr("STR_STATISTICS"));
    }
    title += `${String.fromCharCode(TOK_NL_SMALL)}${time.getDayString(this.game().getLanguage())} ${String(this.tr(time.getMonthString()))} ${time.getYear()}`;
    this._txtTitle.setText(title);

    let totalScore = this.sumVector(save.getResearchScores());
    for (const region of save.getRegions()) {
      totalScore += this.sumVector(region.getActivityXcom()) - this.sumVector(region.getActivityAlien());
    }

    const researchScores = save.getResearchScores();
    const monthlyScore = researchScores.length > 0 ? Math.trunc(totalScore / researchScores.length) : 0;
    const totalIncome = this.sumVector(this.callArray<number>(save, "getIncomes"));
    const totalExpenses = this.sumVector(this.callArray<number>(save, "getExpenditures"));

    let alienBasesDestroyed = 0;
    let xcomBasesLost = 0;
    let missionsWin = 0;
    let missionsLoss = 0;
    let nightMissions = 0;
    let bestScore = -9999;
    let worstScore = 9999;
    for (const mission of save.getMissionStatistics()) {
      if (mission.success) {
        ++missionsWin;
      } else {
        ++missionsLoss;
      }
      const score = this.intValue(mission.score);
      bestScore = Math.max(bestScore, score);
      worstScore = Math.min(worstScore, score);
      if (this.callBoolean(mission, "isDarkness")) {
        ++nightMissions;
      }
      if (this.callBoolean(mission, "isAlienBase") && mission.success) {
        ++alienBasesDestroyed;
      }
      if (this.callBoolean(mission, "isBaseDefense") && !mission.success) {
        ++xcomBasesLost;
      }
    }
    bestScore = bestScore === -9999 ? 0 : bestScore;
    worstScore = worstScore === 9999 ? 0 : worstScore;

    const allSoldiers: SoldierLike[] = [];
    for (const base of save.getBases()) {
      allSoldiers.push(...this.callArray<SoldierLike>(base, "getSoldiers"));
    }
    allSoldiers.push(...(save.getDeadSoldiers() as SoldierLike[]));
    const soldiersRecruited = allSoldiers.length;
    const soldiersLost = save.getDeadSoldiers().length;

    let aliensKilled = 0;
    let aliensCaptured = 0;
    let friendlyKills = 0;
    let daysWounded = 0;
    let longestMonths = 0;
    let shotsFired = 0;
    let shotsLanded = 0;
    const weaponKills = new Map<string, number>();
    const alienKills = new Map<string, number>();
    for (const soldier of allSoldiers) {
      const diary = soldier.getDiary?.() || null;
      aliensKilled += this.callNumber(diary, "getKillTotal");
      aliensCaptured += this.callNumber(diary, "getStunTotal");
      daysWounded += this.callNumber(diary, "getDaysWoundedTotal");
      longestMonths = Math.max(longestMonths, this.callNumber(diary, "getMonthsService"));
      this.addMapTotals(weaponKills, this.call(diary, "getWeaponTotal"));
      shotsFired += this.callNumber(diary, "getShotsFiredTotal");
      shotsLanded += this.callNumber(diary, "getShotsLandedTotal");

      const kills = soldier.getDeath?.()?.getCause?.() || null;
      if (kills) {
        if (kills.faction === FACTION_PLAYER) {
          ++friendlyKills;
        }
        if (kills.race) {
          alienKills.set(kills.race, (alienKills.get(kills.race) || 0) + 1);
        }
      }
    }

    let accuracy = 0;
    if (shotsFired > 0) {
      accuracy = Math.trunc(100 * shotsLanded / shotsFired);
    }

    const highestWeapon = this.highestKeyByValue(weaponKills);
    const highestAlien = this.highestKeyByValue(alienKills);

    const ids = save.getAllIds();
    let alienBases = alienBasesDestroyed;
    for (const alienBase of save.getAlienBases()) {
      if (this.callBoolean(alienBase, "isDiscovered")) {
        ++alienBases;
      }
    }
    const ufosDetected = Math.max(0, this.getIdCount(ids, "STR_UFO") - 1);
    const terrorSites = Math.max(0, this.getIdCount(ids, "STR_TERROR_SITE") - 1);
    let totalCrafts = 0;
    for (const craft of this.game().getMod()?.getCraftsList() || []) {
      totalCrafts += Math.max(0, this.getIdCount(ids, craft) - 1);
    }

    const xcomBases = save.getBases().length + xcomBasesLost;
    let currentScientists = 0;
    let currentEngineers = 0;
    for (const base of save.getBases()) {
      currentScientists += this.callNumber(base, "getTotalScientists");
      currentEngineers += this.callNumber(base, "getTotalEngineers");
    }

    let countriesLost = 0;
    for (const country of save.getCountries()) {
      if (country.getPact()) {
        ++countriesLost;
      }
    }

    const researchDone = save.getDiscoveredResearch().length;
    const difficulty = ["STR_1_BEGINNER", "STR_2_EXPERIENCED", "STR_3_VETERAN", "STR_4_GENIUS", "STR_5_SUPERHUMAN"];
    const difficultyName = difficulty[save.getDifficulty()] || difficulty[0];

    this._lstStats.addRow(2, String(this.tr("STR_DIFFICULTY")), String(this.tr(difficultyName)));
    this._lstStats.addRow(2, String(this.tr("STR_AVERAGE_MONTHLY_RATING")), formatNumber(monthlyScore));
    this._lstStats.addRow(2, String(this.tr("STR_TOTAL_INCOME")), formatFunding(totalIncome));
    this._lstStats.addRow(2, String(this.tr("STR_TOTAL_EXPENDITURE")), formatFunding(totalExpenses));
    this._lstStats.addRow(2, String(this.tr("STR_MISSIONS_WON")), formatNumber(missionsWin));
    this._lstStats.addRow(2, String(this.tr("STR_MISSIONS_LOST")), formatNumber(missionsLoss));
    this._lstStats.addRow(2, String(this.tr("STR_NIGHT_MISSIONS")), formatNumber(nightMissions));
    this._lstStats.addRow(2, String(this.tr("STR_BEST_RATING")), formatNumber(bestScore));
    this._lstStats.addRow(2, String(this.tr("STR_WORST_RATING")), formatNumber(worstScore));
    this._lstStats.addRow(2, String(this.tr("STR_SOLDIERS_RECRUITED")), formatNumber(soldiersRecruited));
    this._lstStats.addRow(2, String(this.tr("STR_SOLDIERS_LOST")), formatNumber(soldiersLost));
    this._lstStats.addRow(2, String(this.tr("STR_ALIEN_KILLS")), formatNumber(aliensKilled));
    this._lstStats.addRow(2, String(this.tr("STR_ALIEN_CAPTURES")), formatNumber(aliensCaptured));
    this._lstStats.addRow(2, String(this.tr("STR_FRIENDLY_KILLS")), formatNumber(friendlyKills));
    this._lstStats.addRow(2, String(this.tr("STR_AVERAGE_ACCURACY")), formatPercentage(accuracy));
    this._lstStats.addRow(2, String(this.tr("STR_WEAPON_MOST_KILLS")), String(this.tr(highestWeapon)));
    this._lstStats.addRow(2, String(this.tr("STR_ALIEN_MOST_KILLS")), String(this.tr(highestAlien)));
    this._lstStats.addRow(2, String(this.tr("STR_LONGEST_SERVICE")), formatNumber(longestMonths));
    this._lstStats.addRow(2, String(this.tr("STR_TOTAL_DAYS_WOUNDED")), formatNumber(daysWounded));
    this._lstStats.addRow(2, String(this.tr("STR_TOTAL_UFOS")), formatNumber(ufosDetected));
    this._lstStats.addRow(2, String(this.tr("STR_TOTAL_ALIEN_BASES")), formatNumber(alienBases));
    this._lstStats.addRow(2, String(this.tr("STR_COUNTRIES_LOST")), formatNumber(countriesLost));
    this._lstStats.addRow(2, String(this.tr("STR_TOTAL_TERROR_SITES")), formatNumber(terrorSites));
    this._lstStats.addRow(2, String(this.tr("STR_TOTAL_BASES")), formatNumber(xcomBases));
    this._lstStats.addRow(2, String(this.tr("STR_TOTAL_CRAFT")), formatNumber(totalCrafts));
    this._lstStats.addRow(2, String(this.tr("STR_TOTAL_SCIENTISTS")), formatNumber(currentScientists));
    this._lstStats.addRow(2, String(this.tr("STR_TOTAL_ENGINEERS")), formatNumber(currentEngineers));
    this._lstStats.addRow(2, String(this.tr("STR_TOTAL_RESEARCH")), formatNumber(researchDone));
  }

  btnOkClick(_action?: Action): void {
    const save = this.game().getSavedGame() as StatisticsSavedGame | null;
    if (this.getEnding(save) === GameEnding.END_NONE) {
      this.game().popState();
    } else {
      this.game().setSavedGame(null);
      this.game().setState(new GoToMainMenuState());
    }
  }

  private getEnding(save: StatisticsSavedGame | null): GameEnding {
    return save?.getEnding() ?? GameEnding.END_NONE;
  }

  private call(owner: unknown, method: string): unknown {
    if (!owner || typeof owner !== "object") {
      return undefined;
    }
    const candidate = (owner as Record<string, unknown>)[method];
    return typeof candidate === "function" ? candidate.call(owner) : undefined;
  }

  private callArray<T>(owner: unknown, method: string): T[] {
    const result = this.call(owner, method);
    if (Array.isArray(result)) {
      return result as T[];
    }
    if (result && typeof result === "object" && Symbol.iterator in Object(result)) {
      return Array.from(result as Iterable<T>);
    }
    if (this.isArrayLike(result)) {
      return Array.from({ length: result.length }, (_value, index) => result[index] as T);
    }
    return [];
  }

  private callNumber(owner: unknown, method: string): number {
    return this.intValue(this.call(owner, method));
  }

  private callBoolean(owner: unknown, method: string): boolean {
    return this.call(owner, method) === true;
  }

  private intValue(value: unknown, fallback = 0): number {
    if (typeof value === "number" && Number.isFinite(value)) {
      return Math.trunc(value);
    }
    if (typeof value === "bigint") {
      return Number(value);
    }
    return fallback;
  }

  private addMapTotals(target: Map<string, number>, source: unknown): void {
    for (const [key, value] of this.sortedEntries(source)) {
      target.set(key, (target.get(key) || 0) + value);
    }
  }

  private highestKeyByValue(source: Map<string, number>): string {
    let maxValue = 0;
    let highestKey = "STR_NONE";
    for (const [key, value] of this.sortedEntries(source)) {
      if (value > maxValue) {
        maxValue = value;
        highestKey = key;
      }
    }
    return highestKey;
  }

  private sortedEntries(source: unknown): Array<[string, number]> {
    let entries: Array<[string, number]> = [];
    if (source instanceof Map) {
      entries = [...source.entries()].map(([key, value]) => [String(key), this.intValue(value)]);
    } else if (Array.isArray(source)) {
      entries = source.map((entry): [string, number] => Array.isArray(entry) ? [String(entry[0]), this.intValue(entry[1])] : ["", 0]);
    } else if (source && typeof source === "object") {
      entries = Object.entries(source as Record<string, unknown>).map(([key, value]) => [key, this.intValue(value)]);
    }
    return entries
      .filter(([key]) => key.length > 0)
      .sort(([a], [b]) => a < b ? -1 : (a > b ? 1 : 0));
  }

  private getIdCount(ids: unknown, key: string): number {
    if (ids instanceof Map) {
      return this.intValue(ids.get(key));
    }
    if (ids && typeof ids === "object") {
      return this.intValue((ids as Record<string, unknown>)[key]);
    }
    return 0;
  }

  private isArrayLike(value: unknown): value is ArrayLike<unknown> {
    return Boolean(value && typeof value === "object" && Number.isInteger((value as { length?: unknown }).length));
  }
}
