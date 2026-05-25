import type { Action } from "../Engine/Action.ts";
import { Options } from "../Engine/Options.ts";
import { State } from "../Engine/State.ts";
import { TOK_COLOR_FLIP } from "../Engine/Unicode.ts";
import { ALIGN_CENTER, ALIGN_LEFT, ALIGN_RIGHT, Text } from "../Interface/Text.ts";
import { TextButton } from "../Interface/TextButton.ts";
import { TextList } from "../Interface/TextList.ts";
import { Window } from "../Interface/Window.ts";
import { ManageAlienContainmentState } from "../Basescape/ManageAlienContainmentState.ts";
import { SellState } from "../Basescape/SellState.ts";
import { ErrorMessageState } from "../Menu/ErrorMessageState.ts";
import { MainMenuState } from "../Menu/MainMenuState.ts";
import { OPT_BATTLESCAPE, OPT_GEOSCAPE } from "../Menu/OptionsBaseState.ts";
import { SaveGameState, SaveType } from "../Menu/SaveGameState.ts";
import { EscapeType } from "../Mod/AlienDeployment.ts";
import { SpecialTileType, TilePart } from "../Mod/MapData.ts";
import { MissionObjective } from "../Mod/RuleAlienMission.ts";
import { BattleType, type RuleItem } from "../Mod/RuleItem.ts";
import { createUnitStats } from "../Mod/Unit.ts";
import { AlienBase } from "../Savegame/AlienBase.ts";
import type { Base } from "../Savegame/Base.ts";
import { UnitFaction, UnitStatus, type BattleUnit } from "../Savegame/BattleUnit.ts";
import type { Craft } from "../Savegame/Craft.ts";
import { ItemContainer } from "../Savegame/ItemContainer.ts";
import { MissionStatistics } from "../Savegame/MissionStatistics.ts";
import { MissionSite } from "../Savegame/MissionSite.ts";
import type { Region } from "../Savegame/Region.ts";
import type { Country } from "../Savegame/Country.ts";
import { SoldierRank, type Soldier } from "../Savegame/Soldier.ts";
import { UfoStatus } from "../Savegame/Ufo.ts";
import { Vehicle } from "../Savegame/Vehicle.ts";
import { Position } from "./Position.ts";
import { CannotReequipState } from "./CannotReequipState.ts";
import { CommendationLateState } from "./CommendationLateState.ts";
import { CommendationState } from "./CommendationState.ts";
import { PromotionsState } from "./PromotionsState.ts";

export class DebriefingStat {
  qty = 0;
  score = 0;

  constructor(public item: string, public recovery: boolean) {}
}

export interface ReequipStat {
  item: string;
  qty: number;
  craft: string;
}

export interface RecoveryItem {
  name: string;
  value: number;
}

type UnitStatsLike = Record<string, number | undefined>;
type SoldierStatsEntry = { name: string; stats: UnitStatsLike };
type RecoverableBattleUnit = {
  getStatus: () => UnitStatus;
  getHealth: () => number;
  getStunlevel: () => number;
  getOriginalFaction: () => UnitFaction;
  getArmor: () => { getCorpseGeoscape: () => string; getCorpseBattlescape: () => string[] };
  getSpawnUnit: () => string;
  getType: () => string;
  getValue: () => number;
};
type RecoverableBattleItem = {
  getRules: () => RuleItem;
  getXCOMProperty: () => boolean;
  getUnit: () => RecoverableBattleUnit | null;
  getAmmoQuantity: () => number;
  getAmmoItem: () => RecoverableBattleItem | null;
};

function areSame(left: number, right: number): boolean {
  return Math.abs(left - right) <= 0.00001;
}

/**
 * Debriefing screen shown after a Battlescape mission that displays the results.
 */
export class DebriefingState extends State {
  private _region: Region | null = null;
  private _country: Country | null = null;
  private _base: Base | null = null;
  private _stats: DebriefingStat[] = [];
  private _soldierStats: SoldierStatsEntry[] = [];
  private _btnOk: TextButton;
  private _btnStats: TextButton;
  private _window: Window;
  private _txtTitle: Text;
  private _txtItem: Text;
  private _txtQuantity: Text;
  private _txtScore: Text;
  private _txtRecovery: Text;
  private _txtRating: Text;
  private _txtSoldier: Text;
  private _txtTU: Text;
  private _txtStamina: Text;
  private _txtHealth: Text;
  private _txtBravery: Text;
  private _txtReactions: Text;
  private _txtFiring: Text;
  private _txtThrowing: Text;
  private _txtMelee: Text;
  private _txtStrength: Text;
  private _txtPsiStrength: Text;
  private _txtPsiSkill: Text;
  private _lstStats: TextList;
  private _lstRecovery: TextList;
  private _lstTotal: TextList;
  private _lstSoldierStats: TextList;
  private _currentTooltip = "";
  private _txtTooltip: Text;
  private _missingItems: ReequipStat[] = [];
  private _rounds = new Map<RuleItem, number>();
  private _recoveryStats = new Map<number, RecoveryItem>();
  private _positiveScore = true;
  private _noContainment = false;
  private _manageContainment = false;
  private _destroyBase = false;
  private _promotions = false;
  private _initDone = false;
  private _limitsEnforced: number;
  private _missionStatistics: MissionStatistics;
  private _soldiersCommended: Soldier[] = [];
  private _deadSoldiersCommended: Soldier[] = [];
  private _showSoldierStats = false;

  constructor() {
    super();
    this._missionStatistics = new MissionStatistics();
    this.game().getCursor().setVisible(true);
    this._limitsEnforced = Options.storageLimitsEnforced ? 1 : 0;

    this._window = new Window(this, 320, 200, 0, 0);
    this._btnOk = new TextButton(40, 12, 16, 180);
    this._btnStats = new TextButton(40, 12, 264, 180);
    this._txtTitle = new Text(300, 17, 16, 8);
    this._txtItem = new Text(180, 9, 16, 24);
    this._txtQuantity = new Text(60, 9, 200, 24);
    this._txtScore = new Text(55, 9, 270, 24);
    this._txtRecovery = new Text(180, 9, 16, 60);
    this._txtRating = new Text(200, 9, 64, 180);
    this._lstStats = new TextList(290, 80, 16, 32);
    this._lstRecovery = new TextList(290, 80, 16, 32);
    this._lstTotal = new TextList(290, 9, 16, 12);

    this._txtSoldier = new Text(90, 9, 16, 24);
    this._txtTU = new Text(18, 9, 106, 24);
    this._txtStamina = new Text(18, 9, 124, 24);
    this._txtHealth = new Text(18, 9, 142, 24);
    this._txtBravery = new Text(18, 9, 160, 24);
    this._txtReactions = new Text(18, 9, 178, 24);
    this._txtFiring = new Text(18, 9, 196, 24);
    this._txtThrowing = new Text(18, 9, 214, 24);
    this._txtMelee = new Text(18, 9, 232, 24);
    this._txtStrength = new Text(18, 9, 250, 24);
    this._txtPsiStrength = new Text(18, 9, 268, 24);
    this._txtPsiSkill = new Text(18, 9, 286, 24);
    this._lstSoldierStats = new TextList(288, 128, 16, 32);
    this._txtTooltip = new Text(200, 9, 64, 180);

    this.applyVisibility();
    this.setInterface("debriefing");

    this.add(this._window, "window", "debriefing");
    this.add(this._btnOk, "button", "debriefing");
    this.add(this._btnStats, "button", "debriefing");
    this.add(this._txtTitle, "heading", "debriefing");
    this.add(this._txtItem, "text", "debriefing");
    this.add(this._txtQuantity, "text", "debriefing");
    this.add(this._txtScore, "text", "debriefing");
    this.add(this._txtRecovery, "text", "debriefing");
    this.add(this._txtRating, "text", "debriefing");
    this.add(this._lstStats, "list", "debriefing");
    this.add(this._lstRecovery, "list", "debriefing");
    this.add(this._lstTotal, "totals", "debriefing");
    this.add(this._txtSoldier, "text", "debriefing");
    this.add(this._txtTU, "text", "debriefing");
    this.add(this._txtStamina, "text", "debriefing");
    this.add(this._txtHealth, "text", "debriefing");
    this.add(this._txtBravery, "text", "debriefing");
    this.add(this._txtReactions, "text", "debriefing");
    this.add(this._txtFiring, "text", "debriefing");
    this.add(this._txtThrowing, "text", "debriefing");
    this.add(this._txtMelee, "text", "debriefing");
    this.add(this._txtStrength, "text", "debriefing");
    this.add(this._txtPsiStrength, "text", "debriefing");
    this.add(this._txtPsiSkill, "text", "debriefing");
    this.add(this._lstSoldierStats, "list", "debriefing");
    this.add(this._txtTooltip, "text", "debriefing");

    this.centerAllSurfaces();

    const back01 = this.game().getMod()?.getSurface("BACK01.SCR");
    if (back01) {
      this._window.setBackground(back01);
    }

    this._btnOk.setText(String(this.tr("STR_OK")));
    this._btnOk.onMouseClick(this.btnOkClick.bind(this));
    this._btnOk.onKeyboardPress(this.btnOkClick.bind(this), Options.keyOk);
    this._btnOk.onKeyboardPress(this.btnOkClick.bind(this), Options.keyCancel);
    this._btnStats.onMouseClick(this.btnStatsClick.bind(this));
    this._txtTitle.setBig();
    this._txtItem.setText(String(this.tr("STR_LIST_ITEM")));
    this._txtQuantity.setText(String(this.tr("STR_QUANTITY_UC")));
    this._txtQuantity.setAlign(ALIGN_RIGHT);
    this._txtScore.setText(String(this.tr("STR_SCORE")));

    this._lstStats.setColumns(3, 224, 30, 64);
    this._lstStats.setDot(true);
    this._lstRecovery.setColumns(3, 224, 30, 64);
    this._lstRecovery.setDot(true);
    this._lstTotal.setColumns(2, 254, 64);
    this._lstTotal.setDot(true);

    this._txtSoldier.setText(String(this.tr("STR_NAME_UC")));
    this.configureSoldierHeader(this._txtTU, "STR_TIME_UNITS_ABBREVIATION", "STR_TIME_UNITS");
    this.configureSoldierHeader(this._txtStamina, "STR_STAMINA_ABBREVIATION", "STR_STAMINA");
    this.configureSoldierHeader(this._txtHealth, "STR_HEALTH_ABBREVIATION", "STR_HEALTH");
    this.configureSoldierHeader(this._txtBravery, "STR_BRAVERY_ABBREVIATION", "STR_BRAVERY");
    this.configureSoldierHeader(this._txtReactions, "STR_REACTIONS_ABBREVIATION", "STR_REACTIONS");
    this.configureSoldierHeader(this._txtFiring, "STR_FIRING_ACCURACY_ABBREVIATION", "STR_FIRING_ACCURACY");
    this.configureSoldierHeader(this._txtThrowing, "STR_THROWING_ACCURACY_ABBREVIATION", "STR_THROWING_ACCURACY");
    this.configureSoldierHeader(this._txtMelee, "STR_MELEE_ACCURACY_ABBREVIATION", "STR_MELEE_ACCURACY");
    this.configureSoldierHeader(this._txtStrength, "STR_STRENGTH_ABBREVIATION", "STR_STRENGTH");
    this.configureSoldierHeader(this._txtPsiStrength, "STR_PSIONIC_STRENGTH_ABBREVIATION", "STR_PSIONIC_STRENGTH");
    this.configureSoldierHeader(this._txtPsiSkill, "STR_PSIONIC_SKILL_ABBREVIATION", "STR_PSIONIC_SKILL");

    this._lstSoldierStats.setColumns(13, 90, 18, 18, 18, 18, 18, 18, 18, 18, 18, 18, 18, 0);
    this._lstSoldierStats.setAlign(ALIGN_CENTER);
    this._lstSoldierStats.setAlign(ALIGN_LEFT, 0);
    this._lstSoldierStats.setDot(true);
  }

  private configureSoldierHeader(text: Text, abbreviation: string, tooltip: string): void {
    text.setAlign(ALIGN_CENTER);
    text.setText(String(this.tr(abbreviation)));
    text.setTooltip(tooltip);
    text.onMouseIn(this.txtTooltipIn.bind(this));
    text.onMouseOut(this.txtTooltipOut.bind(this));
  }

  private makeSoldierString(stat = 0): string {
    if (stat === 0) {
      return "";
    }
    return `${String.fromCharCode(TOK_COLOR_FLIP)}+${stat}${String.fromCharCode(TOK_COLOR_FLIP)}`;
  }

  private applyVisibility(): void {
    this._txtItem.setVisible(!this._showSoldierStats);
    this._txtQuantity.setVisible(!this._showSoldierStats);
    this._txtScore.setVisible(!this._showSoldierStats);
    this._txtRecovery.setVisible(!this._showSoldierStats);
    this._txtRating.setVisible(!this._showSoldierStats);
    this._lstStats.setVisible(!this._showSoldierStats);
    this._lstRecovery.setVisible(!this._showSoldierStats);
    this._lstTotal.setVisible(!this._showSoldierStats);

    this._txtSoldier.setVisible(this._showSoldierStats);
    this._txtTU.setVisible(this._showSoldierStats);
    this._txtStamina.setVisible(this._showSoldierStats);
    this._txtHealth.setVisible(this._showSoldierStats);
    this._txtBravery.setVisible(this._showSoldierStats);
    this._txtReactions.setVisible(this._showSoldierStats);
    this._txtFiring.setVisible(this._showSoldierStats);
    this._txtThrowing.setVisible(this._showSoldierStats);
    this._txtMelee.setVisible(this._showSoldierStats);
    this._txtStrength.setVisible(this._showSoldierStats);
    this._txtPsiStrength.setVisible(this._showSoldierStats);
    this._txtPsiSkill.setVisible(this._showSoldierStats);
    this._lstSoldierStats.setVisible(this._showSoldierStats);
    this._txtTooltip.setVisible(this._showSoldierStats);

    this._btnStats?.setText(String(this.tr(this._showSoldierStats ? "STR_SCORE" : "STR_STATS")));
  }

  override init(): void {
    super.init();
    if (this._initDone) {
      return;
    }
    this._initDone = true;
    this.prepareDebriefing();

    for (const soldier of this._soldierStats) {
      this._lstSoldierStats.addRow(
        13,
        soldier.name,
        this.makeSoldierString(soldier.stats.tu),
        this.makeSoldierString(soldier.stats.stamina),
        this.makeSoldierString(soldier.stats.health),
        this.makeSoldierString(soldier.stats.bravery),
        this.makeSoldierString(soldier.stats.reactions),
        this.makeSoldierString(soldier.stats.firing),
        this.makeSoldierString(soldier.stats.throwing),
        this.makeSoldierString(soldier.stats.melee),
        this.makeSoldierString(soldier.stats.strength),
        this.makeSoldierString(soldier.stats.psiStrength),
        this.makeSoldierString(soldier.stats.psiSkill),
        ""
      );
    }

    let total = 0;
    let statsY = 0;
    let recoveryY = 0;
    let civiliansSaved = 0;
    let civiliansDead = 0;
    let aliensKilled = 0;
    let aliensStunned = 0;
    for (const stat of this._stats) {
      if (stat.qty === 0) {
        continue;
      }
      const qty = `${String.fromCharCode(TOK_COLOR_FLIP)}${stat.qty}${String.fromCharCode(TOK_COLOR_FLIP)}`;
      const score = `${String.fromCharCode(TOK_COLOR_FLIP)}${stat.score}`;
      total += stat.score;
      if (stat.recovery) {
        this._lstRecovery.addRow(3, String(this.tr(stat.item)), qty, score);
        recoveryY += 8;
      } else {
        this._lstStats.addRow(3, String(this.tr(stat.item)), qty, score);
        statsY += 8;
      }
      if (stat.item === "STR_CIVILIANS_SAVED") {
        civiliansSaved = stat.qty;
      }
      if (stat.item === "STR_CIVILIANS_KILLED_BY_XCOM_OPERATIVES" || stat.item === "STR_CIVILIANS_KILLED_BY_ALIENS") {
        civiliansDead += stat.qty;
      }
      if (stat.item === "STR_ALIENS_KILLED") {
        aliensKilled += stat.qty;
      }
      if (stat.item === "STR_LIVE_ALIENS_RECOVERED") {
        aliensStunned += stat.qty;
      }
    }
    if (civiliansSaved && !civiliansDead && this._missionStatistics.success === true) {
      this._missionStatistics.valiantCrux = true;
    }

    this._lstTotal.addRow(2, String(this.tr("STR_TOTAL_UC")), String(total));
    if (this._region) {
      this._region.addActivityXcom(total);
    }
    if (this._country) {
      this._country.addActivityXcom(total);
    }
    if (recoveryY > 0) {
      this._txtRecovery.setY(this._lstStats.getY() + statsY + 5);
      this._lstRecovery.setY(this._txtRecovery.getY() + 8);
      this._lstTotal.setY(this._lstRecovery.getY() + recoveryY + 5);
    } else {
      this._txtRecovery.setText("");
      this._lstTotal.setY(this._lstStats.getY() + statsY + 5);
    }

    const rating = total <= -200
      ? "STR_RATING_TERRIBLE"
      : total <= 0
        ? "STR_RATING_POOR"
        : total <= 200
          ? "STR_RATING_OK"
          : total <= 500
            ? "STR_RATING_GOOD"
            : "STR_RATING_EXCELLENT";
    this._missionStatistics.rating = rating;
    this._missionStatistics.score = total;
    this._txtRating.setText(String(this.tr("STR_RATING").arg(this.tr(rating))));
    const save = this.game().getSavedGame();
    const battle = save?.getSavedBattle?.() || null;
    if (save && battle) {
      this._missionStatistics.daylight = battle.getGlobalShade();
      this._missionStatistics.id = save.getMissionStatistics().length;
      save.getMissionStatistics().push(this._missionStatistics);

      const bestScoreID = new Array<number>(7).fill(0);
      const bestScore = new Array<number>(7).fill(0);
      let bestOverallScorersID = 0;
      let bestOverallScore = 0;

      for (const deadUnit of battle.getUnits()) {
        const deadSoldier = deadUnit.getGeoscapeSoldier();
        if (!deadSoldier || deadUnit.getStatus() !== UnitStatus.STATUS_DEAD) {
          continue;
        }

        let killTurn = -1;
        for (const killerUnit of battle.getUnits()) {
          for (const kill of killerUnit.getStatistics().kills) {
            if (kill.id === deadUnit.getId()) {
              killTurn = kill.turn;
              break;
            }
          }
          if (killTurn !== -1) {
            break;
          }
        }

        let postMortemKills = 0;
        if (killTurn !== -1) {
          for (const deadUnitKill of deadUnit.getStatistics().kills) {
            if (deadUnitKill.turn > killTurn && deadUnitKill.faction === UnitFaction.FACTION_HOSTILE) {
              ++postMortemKills;
            }
          }
        }
        deadSoldier.getDiary().awardPostMortemKill(postMortemKills);

        const rank = deadSoldier.getRank();
        if (rank === SoldierRank.RANK_ROOKIE) {
          continue;
        }

        for (const soldier of save.getDeadSoldiers()) {
          let score = soldier.getDiary().getScoreTotal(save.getMissionStatistics());
          if (soldier.getId() === deadUnit.getId()) {
            score += this._missionStatistics.score;
          }
          if (score > bestScore[rank]) {
            bestScoreID[rank] = deadUnit.getId();
            bestScore[rank] = score;
            if (score > bestOverallScore) {
              bestOverallScorersID = deadUnit.getId();
              bestOverallScore = score;
            }
          }
        }
      }

      for (const deadUnit of battle.getUnits()) {
        const deadSoldier = deadUnit.getGeoscapeSoldier();
        if (!deadSoldier || deadUnit.getStatus() !== UnitStatus.STATUS_DEAD) {
          continue;
        }
        const rank = deadSoldier.getRank();
        if (deadUnit.getId() === bestScoreID[rank]) {
          deadSoldier.getDiary().awardBestOfRank(bestScore[rank]);
        }
        if (deadUnit.getId() === bestOverallScorersID) {
          deadSoldier.getDiary().awardBestOverall(bestOverallScore);
        }
      }

      const mod = this.game().getMod();
      for (const unit of battle.getUnits()) {
        const soldier = unit.getGeoscapeSoldier();
        if (soldier) {
          let soldierAlienKills = 0;
          let soldierAlienStuns = 0;
          for (const kill of unit.getStatistics().kills) {
            if (kill.faction === UnitFaction.FACTION_HOSTILE && kill.status === UnitStatus.STATUS_DEAD) {
              ++soldierAlienKills;
            }
            if (kill.faction === UnitFaction.FACTION_HOSTILE && kill.status === UnitStatus.STATUS_UNCONSCIOUS) {
              ++soldierAlienStuns;
            }
          }
          if (aliensKilled !== 0 && aliensKilled === soldierAlienKills && this._missionStatistics.success === true && aliensStunned === soldierAlienStuns) {
            unit.getStatistics().nikeCross = true;
          }
          if (aliensStunned !== 0 && aliensStunned === soldierAlienStuns && this._missionStatistics.success === true && aliensKilled === 0) {
            unit.getStatistics().mercyCross = true;
          }
          unit.getStatistics().daysWounded = soldier.getWoundRecovery();
          this._missionStatistics.injuryList.set(soldier.getId(), soldier.getWoundRecovery());

          if (unit.getMurdererId() === unit.getId() && unit.getStatistics().kills.length !== 0) {
            let martyrKills = 0;
            let martyrTurn = -1;
            for (const kill of unit.getStatistics().kills) {
              if (kill.id === unit.getId()) {
                martyrTurn = kill.turn;
                break;
              }
            }
            for (const kill of unit.getStatistics().kills) {
              if (kill.turn === martyrTurn && kill.faction === UnitFaction.FACTION_HOSTILE) {
                ++martyrKills;
              }
            }
            if (martyrKills > 0) {
              unit.getStatistics().martyr = Math.min(martyrKills, 10);
            }
          }

          const currentStats = soldier.getCurrentStats();
          const initialStats = soldier.getInitStats();
          unit.getStatistics().delta = createUnitStats({
            tu: currentStats.tu - initialStats.tu,
            stamina: currentStats.stamina - initialStats.stamina,
            health: currentStats.health - initialStats.health,
            bravery: currentStats.bravery - initialStats.bravery,
            reactions: currentStats.reactions - initialStats.reactions,
            firing: currentStats.firing - initialStats.firing,
            throwing: currentStats.throwing - initialStats.throwing,
            strength: currentStats.strength - initialStats.strength,
            psiStrength: currentStats.psiStrength - initialStats.psiStrength,
            psiSkill: currentStats.psiSkill - initialStats.psiSkill,
            melee: currentStats.melee - initialStats.melee
          });

          if (mod) {
            soldier.getDiary().updateDiary(unit.getStatistics(), save.getMissionStatistics(), mod);
            if (!unit.getStatistics().MIA && !unit.getStatistics().KIA && soldier.getDiary().manageCommendations(mod, save.getMissionStatistics())) {
              this._soldiersCommended.push(soldier);
            } else if (unit.getStatistics().MIA || unit.getStatistics().KIA) {
              soldier.getDiary().manageCommendations(mod, save.getMissionStatistics());
              this._deadSoldiersCommended.push(soldier);
            }
          }
        }
      }
      const participants: Soldier[] = [];
      for (const unit of battle.getUnits()) {
        const soldier = unit.getGeoscapeSoldier();
        if (soldier) {
          participants.push(soldier);
        }
      }
      this._promotions = save.handlePromotions(participants);
      save.setSavedBattle(null);
    }
    this._positiveScore = total > 0;
    const mod = this.game().getMod();
    mod?.playMusic(this._positiveScore ? mod.getDebriefMusicGood() : mod.getDebriefMusicBad());
    if (this._noContainment) {
      this.pushDebriefingError("STR_ALIEN_DIES_NO_ALIEN_CONTAINMENT_FACILITY");
      this._noContainment = false;
    }
  }

  btnStatsClick(_action?: Action): void {
    this._showSoldierStats = !this._showSoldierStats;
    this.applyVisibility();
  }

  txtTooltipIn(action?: Action): void {
    const sender = action?.getSender() as { getTooltip?: () => string } | undefined;
    this._currentTooltip = sender?.getTooltip?.() || "";
    this._txtTooltip.setText(String(this.tr(this._currentTooltip)));
  }

  txtTooltipOut(action?: Action): void {
    const sender = action?.getSender() as { getTooltip?: () => string } | undefined;
    if (this._currentTooltip === (sender?.getTooltip?.() || "")) {
      this._txtTooltip.setText("");
    }
  }

  btnOkClick(_action?: Action): void {
    this.game().popState();
    const save = this.game().getSavedGame();
    if (save?.getMonthsPassed?.() === -1) {
      this.game().setState(new MainMenuState());
      return;
    }
    if (this._deadSoldiersCommended.length > 0) {
      this.game().pushState(new CommendationLateState(this._deadSoldiersCommended));
    }
    if (this._soldiersCommended.length > 0) {
      this.game().pushState(new CommendationState(this._soldiersCommended));
    }
    if (!this._destroyBase) {
      if (this._promotions) {
        this.game().pushState(new PromotionsState());
      }
      if (this._missingItems.length > 0) {
        this.game().pushState(new CannotReequipState(this._missingItems));
      }
      if (this._manageContainment && this._base) {
        this.game().pushState(new ManageAlienContainmentState(this._base, OPT_BATTLESCAPE));
        this.pushDebriefingError("STR_CONTAINMENT_EXCEEDED", this._base.getName());
      }
      if (!this._manageContainment && Options.storageLimitsEnforced && this._base?.storesOverfull()) {
        this.game().pushState(new SellState(this._base, OPT_BATTLESCAPE));
        this.pushDebriefingError("STR_STORAGE_EXCEEDED", this._base.getName());
      }
    }
    if (save?.isIronman?.()) {
      this.game().pushState(new SaveGameState(OPT_GEOSCAPE, SaveType.SAVE_IRONMAN, this._palette));
    } else if (Options.autosave) {
      this.game().pushState(new SaveGameState(OPT_GEOSCAPE, SaveType.SAVE_AUTO_GEOSCAPE, this._palette));
    }
  }

  private pushDebriefingError(message: string, arg?: string): void {
    const iface = this.game().getMod()?.getInterface("debriefing");
    const color = iface?.getElement("errorMessage")?.color ?? 1;
    const palette = iface?.getElement("errorPalette")?.color ?? -1;
    const text = arg == null ? String(this.tr(message)) : String(this.tr(message).arg(arg));
    this.game().pushState(new ErrorMessageState(text, this._palette, color, "BACK01.SCR", palette));
  }

  private addStat(name: string, quantity: number, score: number): void {
    const stat = this._stats.find(item => item.item === name);
    if (stat) {
      stat.qty += quantity;
      stat.score += score;
    }
  }

  private prepareDebriefing(): void {
    const mod = this.game().getMod();
    if (mod) {
      for (const itemType of mod.getItemsList()) {
        const rule = mod.getItem(itemType);
        if (rule && rule.getSpecialType() > 1) {
          const item = { name: itemType, value: rule.getRecoveryPoints() };
          this._recoveryStats.set(rule.getSpecialType(), item);
          this._missionStatistics.lootValue = item.value;
        }
      }
    }

    const save = this.game().getSavedGame();
    const battle = save?.getSavedBattle?.() || null;
    const ruleDeploy = battle && mod ? mod.getDeployment(battle.getMissionType()) : null;
    const objectiveComplete = ruleDeploy?.getObjectiveCompleteInfo() || { text: "", score: 0, hasInfo: false };
    const objectiveFailed = ruleDeploy?.getObjectiveFailedInfo() || { text: "", score: 0, hasInfo: false };

    this._stats.push(new DebriefingStat("STR_ALIENS_KILLED", false));
    this._stats.push(new DebriefingStat("STR_ALIEN_CORPSES_RECOVERED", false));
    this._stats.push(new DebriefingStat("STR_LIVE_ALIENS_RECOVERED", false));
    this._stats.push(new DebriefingStat("STR_ALIEN_ARTIFACTS_RECOVERED", false));
    if (objectiveComplete.hasInfo) {
      this._stats.push(new DebriefingStat(objectiveComplete.text, false));
    }
    if (objectiveFailed.hasInfo) {
      this._stats.push(new DebriefingStat(objectiveFailed.text, false));
    }
    this._stats.push(new DebriefingStat("STR_CIVILIANS_KILLED_BY_ALIENS", false));
    this._stats.push(new DebriefingStat("STR_CIVILIANS_KILLED_BY_XCOM_OPERATIVES", false));
    this._stats.push(new DebriefingStat("STR_CIVILIANS_SAVED", false));
    this._stats.push(new DebriefingStat("STR_XCOM_OPERATIVES_KILLED", false));
    this._stats.push(new DebriefingStat("STR_XCOM_OPERATIVES_MISSING_IN_ACTION", false));
    this._stats.push(new DebriefingStat("STR_TANKS_DESTROYED", false));
    this._stats.push(new DebriefingStat("STR_XCOM_CRAFT_LOST", false));
    for (const item of this._recoveryStats.values()) {
      this._stats.push(new DebriefingStat(item.name, true));
    }
    const alienFuelName = (mod as { getAlienFuelName?: () => string } | null)?.getAlienFuelName?.() || "STR_ELERIUM_115";
    this._stats.push(new DebriefingStat(alienFuelName, true));

    if (!save || !battle || !mod) {
      this._txtTitle.setText(String(this.tr("STR_ALIENS_DEFEATED")));
      return;
    }

    this._missionStatistics.time = save.getTime().clone();
    this._missionStatistics.type = battle.getMissionType();

    let aborted = battle.isAborted();
    let success = !aborted || battle.allObjectivesDestroyed();
    let craft: Craft | null = null;
    let base: Base | null = null;
    let target = "";
    let playersInExitArea = 0;
    let playersSurvived = 0;
    let playersUnconscious = 0;
    let playersInEntryArea = 0;
    let playersMIA = 0;

    const captureRegionCountry = (lon: number, lat: number) => {
      for (const region of save.getRegions()) {
        if (region.getRules().insideRegion(lon, lat)) {
          this._region = region;
          this._missionStatistics.region = region.getRules().getType();
          break;
        }
      }
      for (const country of save.getCountries()) {
        if (country.getRules().insideCountry(lon, lat)) {
          this._country = country;
          this._missionStatistics.country = country.getRules().getType();
          break;
        }
      }
    };

    for (const candidateBase of save.getBases()) {
      for (const candidateCraft of candidateBase.getCrafts()) {
        if (candidateCraft.isInBattlescape()) {
          captureRegionCountry(candidateCraft.getLongitude(), candidateCraft.getLatitude());
          craft = candidateCraft;
          base = candidateBase;
          const destination = craft.getDestination();
          if (destination) {
            this._missionStatistics.markerName = destination.getMarkerName?.() || "";
            this._missionStatistics.markerId = destination.getMarkerId?.() || 0;
            target = (destination as { getType?: () => string }).getType?.() || "";
            if (destination instanceof AlienBase) {
              target = "STR_ALIEN_BASE";
            } else if (destination instanceof MissionSite) {
              target = "STR_MISSION_SITE";
            }
          }
          craft.returnToBase();
          craft.setMissionComplete(true);
          craft.setInBattlescape(false);
        } else {
          const destination = candidateCraft.getDestination() as { isInBattlescape?: () => boolean } | null;
          if (destination?.isInBattlescape?.()) {
            candidateCraft.returnToBase();
          }
        }
      }

      if (candidateBase.isInBattlescape()) {
        base = candidateBase;
        target = "STR_BASE";
        base.setInBattlescape(false);
        base.cleanupDefenses(false);
        captureRegionCountry(base.getLongitude(), base.getLatitude());

        for (const ufo of save.getUfos()) {
          if (areSame(ufo.getLongitude(), base.getLongitude()) && areSame(ufo.getLatitude(), base.getLatitude())) {
            this._missionStatistics.ufo = ufo.getRules().getType();
            this._missionStatistics.alienRace = ufo.getAlienRace();
            break;
          }
        }
        if (aborted) {
          this._destroyBase = true;
        }
        const moduleMap = battle.getModuleMap();
        for (const facility of [...base.getFacilities()]) {
          const x = facility.getX();
          const y = facility.getY();
          if (moduleMap[x]?.[y]?.[1] === 0) {
            base.destroyFacility(facility);
          }
        }
        base.destroyDisconnectedFacilities();
      }
    }

    for (const missionSite of [...save.getMissionSites()]) {
      if (missionSite.isInBattlescape()) {
        this._missionStatistics.alienRace = missionSite.getAlienRace();
        const index = save.getMissionSites().indexOf(missionSite);
        if (index !== -1) {
          save.getMissionSites().splice(index, 1);
        }
        break;
      }
    }

    let deadSoldiers = 0;
    for (const unit of battle.getUnits()) {
      if (unit.getOriginalFaction() === UnitFaction.FACTION_PLAYER && unit.getStatus() !== UnitStatus.STATUS_DEAD) {
        if (unit.getStatus() === UnitStatus.STATUS_UNCONSCIOUS || unit.getFaction() === UnitFaction.FACTION_HOSTILE) {
          ++playersUnconscious;
        } else if (unit.getStatus() === UnitStatus.STATUS_IGNORE_ME && unit.getStunlevel() >= unit.getHealth()) {
          ++playersUnconscious;
        } else if (unit.isInExitArea(SpecialTileType.END_POINT)) {
          ++playersInExitArea;
        } else if (unit.isInExitArea(SpecialTileType.START_POINT)) {
          ++playersInEntryArea;
        } else if (aborted) {
          ++playersMIA;
        }
        ++playersSurvived;
      } else if (unit.getOriginalFaction() === UnitFaction.FACTION_PLAYER && unit.getStatus() === UnitStatus.STATUS_DEAD) {
        ++deadSoldiers;
      }
    }

    if (playersUnconscious + playersMIA === playersSurvived) {
      playersSurvived = playersMIA;
      for (const unit of battle.getUnits()) {
        if (unit.getOriginalFaction() === UnitFaction.FACTION_PLAYER && unit.getStatus() !== UnitStatus.STATUS_DEAD) {
          if (
            unit.getStatus() === UnitStatus.STATUS_UNCONSCIOUS ||
            unit.getFaction() === UnitFaction.FACTION_HOSTILE ||
            (unit.getStatus() === UnitStatus.STATUS_IGNORE_ME && unit.getStunlevel() >= unit.getHealth())
          ) {
            unit.instaKill();
          }
        }
      }
    }

    for (const ufo of [...save.getUfos()]) {
      if (ufo.isInBattlescape()) {
        this._missionStatistics.ufo = ufo.getRules().getType();
        if (save.getMonthsPassed() !== -1) {
          this._missionStatistics.alienRace = ufo.getAlienRace();
        }
        this._txtRecovery.setText(String(this.tr("STR_UFO_RECOVERY")));
        ufo.setInBattlescape(false);
        if (ufo.getStatus() === UfoStatus.LANDED && (aborted || playersSurvived === 0)) {
          ufo.setSecondsRemaining(5);
        } else {
          const index = save.getUfos().indexOf(ufo);
          if (index !== -1) {
            save.getUfos().splice(index, 1);
          }
        }
        break;
      }
    }

    if (ruleDeploy && ruleDeploy.getEscapeType() !== EscapeType.ESCAPE_NONE) {
      if (ruleDeploy.getEscapeType() !== EscapeType.ESCAPE_EXIT) {
        success = playersInEntryArea > 0;
      }
      if (ruleDeploy.getEscapeType() !== EscapeType.ESCAPE_ENTRY) {
        success = success || playersInExitArea > 0;
      }
    }

    playersInExitArea = 0;

    if (playersSurvived === 1) {
      for (const unit of battle.getUnits()) {
        if (unit.getStatus() !== UnitStatus.STATUS_DEAD && unit.getOriginalFaction() === UnitFaction.FACTION_PLAYER && !unit.getStatistics().kills.some(kill => kill.faction === UnitFaction.FACTION_PLAYER) && deadSoldiers !== 0) {
          unit.getStatistics().loneSurvivor = true;
          break;
        }
        if (unit.getStatus() !== UnitStatus.STATUS_DEAD && unit.getOriginalFaction() === UnitFaction.FACTION_PLAYER && deadSoldiers === 0) {
          unit.getStatistics().ironMan = true;
        }
      }
    }

    for (const alienBase of [...save.getAlienBases()]) {
      if (alienBase.isInBattlescape()) {
        this._txtRecovery.setText(String(this.tr("STR_ALIEN_BASE_RECOVERY")));
        let destroyAlienBase = true;
        if (aborted || playersSurvived === 0) {
          if (!battle.allObjectivesDestroyed()) {
            destroyAlienBase = false;
          }
        }
        if (ruleDeploy && ruleDeploy.getNextStage().length > 0) {
          this._missionStatistics.alienRace = alienBase.getAlienRace();
          destroyAlienBase = false;
        }
        success = destroyAlienBase;
        if (destroyAlienBase) {
          if (objectiveComplete.text.length > 0) {
            this.addStat(objectiveComplete.text, 1, objectiveComplete.score);
          }
          for (const mission of save.getAlienMissions()) {
            if (mission.getAlienBase() === alienBase) {
              mission.setAlienBase(null);
            }
          }
          const index = save.getAlienBases().indexOf(alienBase);
          if (index !== -1) {
            save.getAlienBases().splice(index, 1);
          }
        } else {
          alienBase.setInBattlescape(false);
        }
        break;
      }
    }

    for (const unit of battle.getUnits()) {
      const status = unit.getStatus();
      const faction = unit.getFaction();
      const oldFaction = unit.getOriginalFaction();
      const value = unit.getValue();
      const soldier = save.getSoldier(unit.getId());

      if (!unit.getTile()) {
        let pos = unit.getPosition();
        if (pos.equals(new Position(-1, -1, -1))) {
          for (const item of battle.getItems()) {
            if (item.getUnit() && item.getUnit() === unit) {
              if (item.getOwner()) {
                pos = item.getOwner()!.getPosition();
              } else if (item.getTile()?.getPosition) {
                pos = item.getTile()!.getPosition!();
              }
            }
          }
        }
        unit.setTile(battle.getTile(pos));
      }

      if (status === UnitStatus.STATUS_DEAD) {
        if (oldFaction === UnitFaction.FACTION_HOSTILE && unit.killedBy() === UnitFaction.FACTION_PLAYER) {
          this.addStat("STR_ALIENS_KILLED", 1, value);
        } else if (oldFaction === UnitFaction.FACTION_PLAYER) {
          if (soldier) {
            this.addStat("STR_XCOM_OPERATIVES_KILLED", 1, -value);
            unit.updateGeoscapeStats(soldier);
            unit.getStatistics().KIA = true;
            save.killSoldier(soldier);
          } else {
            this.addStat("STR_TANKS_DESTROYED", 1, -value);
          }
        } else if (oldFaction === UnitFaction.FACTION_NEUTRAL) {
          if (unit.killedBy() === UnitFaction.FACTION_PLAYER) {
            this.addStat("STR_CIVILIANS_KILLED_BY_XCOM_OPERATIVES", 1, -unit.getValue() - (2 * Math.trunc(unit.getValue() / 3)));
          } else {
            this.addStat("STR_CIVILIANS_KILLED_BY_ALIENS", 1, -unit.getValue());
          }
        }
      } else if (oldFaction === UnitFaction.FACTION_PLAYER) {
        const recoverPlayer =
          (((unit.isInExitArea(SpecialTileType.START_POINT) || unit.getStatus() === UnitStatus.STATUS_IGNORE_ME) && (battle.getMissionType() !== "STR_BASE_DEFENSE" || success)) ||
            !aborted ||
            (aborted && unit.isInExitArea(SpecialTileType.END_POINT)));
        if (recoverPlayer) {
          const statIncrease = createUnitStats();
          unit.postMissionProcedures(save, statIncrease);
          const geoscapeSoldier = unit.getGeoscapeSoldier();
          if (geoscapeSoldier) {
            this._soldierStats.push({ name: geoscapeSoldier.getName(), stats: statIncrease });
          }
          ++playersInExitArea;

          if (base) {
            this.recoverItems(unit.getInventory() as unknown as RecoverableBattleItem[], base);
          }

          if (soldier) {
            soldier.calcStatString(mod.getStatStrings(), Options.psiStrengthEval && save.isResearched(mod.getPsiRequirements()));
          } else if (base) {
            base.getStorageItems().addItem(unit.getType());
            const tankRule = mod.getItem(unit.getType(), true);
            if (tankRule) {
              this.recoverVehicleWeaponAmmo(unit, tankRule, "STR_RIGHT_HAND", base);
              const leftHand = unit.getItem("STR_LEFT_HAND");
              if (leftHand) {
                this.recoverVehicleWeaponAmmo(unit, leftHand.getRules(), "STR_LEFT_HAND", base);
              }
            }
          }
        } else {
          this.addStat("STR_XCOM_OPERATIVES_MISSING_IN_ACTION", 1, -value);
          --playersSurvived;
          if (soldier) {
            unit.updateGeoscapeStats(soldier);
            unit.getStatistics().MIA = true;
            save.killSoldier(soldier);
          }
        }
      } else if (
        oldFaction === UnitFaction.FACTION_HOSTILE &&
        (!aborted || unit.isInExitArea(SpecialTileType.START_POINT)) &&
        !this._destroyBase &&
        faction === UnitFaction.FACTION_PLAYER &&
        (!unit.isOut() || unit.getStatus() === UnitStatus.STATUS_IGNORE_ME)
      ) {
        const tile = unit.getTile() as { addItem?: (item: unknown, inventory: unknown) => void } | null;
        const ground = mod.getInventory("STR_GROUND", true);
        if (tile && ground) {
          for (const item of unit.getInventory()) {
            if (!item.getRules().isFixed()) {
              tile.addItem?.(item, ground);
            }
          }
        }
        if (base) {
          this.recoverAlien(unit as unknown as RecoverableBattleUnit, base);
        }
      } else if (oldFaction === UnitFaction.FACTION_NEUTRAL) {
        if (aborted || playersSurvived === 0) {
          this.addStat("STR_CIVILIANS_KILLED_BY_ALIENS", 1, -unit.getValue());
        } else {
          this.addStat("STR_CIVILIANS_SAVED", 1, unit.getValue());
        }
      }
    }

    let lostCraft = false;
    if (craft && base && ((playersInExitArea === 0 && aborted) || playersSurvived === 0)) {
      this.addStat("STR_XCOM_CRAFT_LOST", 1, -craft.getRules().getScore());
      base.removeCraft(craft, false);
      craft = null;
      lostCraft = true;
      playersSurvived = 0;
      success = false;
    }

    if ((aborted || playersSurvived === 0) && target === "STR_BASE" && base) {
      for (const baseCraft of base.getCrafts()) {
        this.addStat("STR_XCOM_CRAFT_LOST", 1, -baseCraft.getRules().getScore());
      }
      playersSurvived = 0;
      success = false;
    }

    if ((!aborted || success) && playersSurvived > 0) {
      if (target === "STR_BASE") {
        this._txtTitle.setText(String(this.tr("STR_BASE_IS_SAVED")));
      } else if (target === "STR_UFO") {
        this._txtTitle.setText(String(this.tr("STR_UFO_IS_RECOVERED")));
      } else if (target === "STR_ALIEN_BASE") {
        this._txtTitle.setText(String(this.tr("STR_ALIEN_BASE_DESTROYED")));
      } else {
        this._txtTitle.setText(String(this.tr("STR_ALIENS_DEFEATED")));
        if (objectiveComplete.text.length > 0 && ruleDeploy) {
          let victoryStat = 0;
          if (ruleDeploy.getEscapeType() !== EscapeType.ESCAPE_NONE) {
            if (ruleDeploy.getEscapeType() !== EscapeType.ESCAPE_EXIT) {
              victoryStat += playersInEntryArea;
            }
            if (ruleDeploy.getEscapeType() !== EscapeType.ESCAPE_ENTRY) {
              victoryStat += playersInExitArea;
            }
          } else {
            victoryStat = 1;
          }
          this.addStat(objectiveComplete.text, victoryStat, objectiveComplete.score);
        }
      }

      if (base) {
        if (!aborted) {
          this.recoverItems(battle.getConditionalRecoveredItems() as unknown as RecoverableBattleItem[], base);
          const nonRecoverType = ruleDeploy?.getObjectiveType() || 0;
          for (const tile of battle.getTiles()) {
            for (let part = TilePart.O_FLOOR; part <= TilePart.O_OBJECT; ++part) {
              const mapData = tile.getMapData(part);
              if (mapData) {
                const specialType = mapData.getSpecialType();
                const recovery = this._recoveryStats.get(specialType);
                if (specialType !== nonRecoverType && recovery) {
                  this.addStat(recovery.name, 1, recovery.value);
                }
              }
            }
            this.recoverItems(tile.getInventory() as unknown as RecoverableBattleItem[], base);
          }
        } else {
          for (const tile of battle.getTiles()) {
            if (tile.getMapData(TilePart.O_FLOOR)?.getSpecialType() === SpecialTileType.START_POINT) {
              this.recoverItems(tile.getInventory() as unknown as RecoverableBattleItem[], base);
            }
          }
        }
      }
    } else {
      if (lostCraft) {
        this._txtTitle.setText(String(this.tr("STR_CRAFT_IS_LOST")));
      } else if (target === "STR_BASE") {
        this._txtTitle.setText(String(this.tr("STR_BASE_IS_LOST")));
        this._destroyBase = true;
      } else if (target === "STR_UFO") {
        this._txtTitle.setText(String(this.tr("STR_UFO_IS_NOT_RECOVERED")));
      } else if (target === "STR_ALIEN_BASE") {
        this._txtTitle.setText(String(this.tr("STR_ALIEN_BASE_STILL_INTACT")));
      } else {
        this._txtTitle.setText(String(this.tr("STR_TERROR_CONTINUES")));
        if (objectiveFailed.text.length > 0) {
          this.addStat(objectiveFailed.text, 1, objectiveFailed.score);
        }
      }

      if (playersSurvived > 0 && !this._destroyBase && base) {
        for (const tile of battle.getTiles()) {
          if (tile.getMapData(TilePart.O_FLOOR)?.getSpecialType() === SpecialTileType.START_POINT) {
            this.recoverItems(tile.getInventory() as unknown as RecoverableBattleItem[], base);
          }
        }
      }
    }

    if (playersSurvived > 0 && base) {
      const aaDivider = target === "STR_UFO" ? 10 : 150;
      const alienAlloys = this._recoveryStats.get(SpecialTileType.ALIEN_ALLOYS)?.name;
      for (const stat of this._stats) {
        if (alienAlloys && stat.item === alienAlloys) {
          stat.qty = Math.trunc(stat.qty / aaDivider);
          stat.score = Math.trunc(stat.score / aaDivider);
        }
        if (stat.recovery && stat.qty > 0) {
          base.getStorageItems().addItem(stat.item, stat.qty);
        }
      }
      this.recoverItems(battle.getGuaranteedRecoveredItems() as unknown as RecoverableBattleItem[], base);
    }

    if (base) {
      for (const [rule, rounds] of this._rounds) {
        const clipSize = rule.getClipSize();
        if (clipSize > 0) {
          const totalClips = Math.trunc(rounds / clipSize);
          if (totalClips > 0) {
            base.getStorageItems().addItem(rule.getType(), totalClips);
          }
        }
      }
    }

    if (craft && base) {
      this.reequipCraft(base, craft, true);
    }

    if (target === "STR_BASE" && base) {
      if (!this._destroyBase) {
        for (const baseCraft of base.getCrafts()) {
          if (baseCraft.getStatus() !== "STR_OUT") {
            this.reequipCraft(base, baseCraft, false);
          }
        }
        base.getVehicles().length = 0;
      } else if (save.getMonthsPassed() !== -1) {
        const index = save.getBases().indexOf(base);
        if (index !== -1) {
          save.getBases().splice(index, 1);
          base = null;
        }
      }

      if (this._region) {
        const alienMission = save.findAlienMission(this._region.getRules().getType(), MissionObjective.OBJECTIVE_RETALIATION);
        for (const ufo of [...save.getUfos()]) {
          if (ufo.getMission() === alienMission) {
            const index = save.getUfos().indexOf(ufo);
            if (index !== -1) {
              save.getUfos().splice(index, 1);
            }
          }
        }
        if (alienMission) {
          const index = save.getAlienMissions().indexOf(alienMission);
          if (index !== -1) {
            save.getAlienMissions().splice(index, 1);
          }
        }
      }
    }

    this._missionStatistics.success = success;
    this._base = base;
  }

  private recoverItems(from: RecoverableBattleItem[], base: Base): void {
    const mod = this.game().getMod() as { getAlienFuelName?: () => string; getAlienFuelQuantity?: () => number } | null;
    const alienFuelName = mod?.getAlienFuelName?.() || "STR_ELERIUM_115";
    const alienFuelQuantity = mod?.getAlienFuelQuantity?.() || 50;
    const save = this.game().getSavedGame() as { isResearched?: (requirements: string[] | string) => boolean } | null;

    for (const item of from) {
      const rules = item.getRules();
      if (rules.getName() === alienFuelName) {
        this.addStat(alienFuelName, alienFuelQuantity, rules.getRecoveryPoints());
      } else {
        if (rules.isRecoverable() && !item.getXCOMProperty()) {
          if (rules.getBattleType() === BattleType.BT_CORPSE) {
            const corpseUnit = item.getUnit();
            if (corpseUnit?.getStatus() === UnitStatus.STATUS_DEAD) {
              base.getStorageItems().addItem(corpseUnit.getArmor().getCorpseGeoscape(), 1);
              this.addStat("STR_ALIEN_CORPSES_RECOVERED", 1, rules.getRecoveryPoints());
            } else if (
              corpseUnit &&
              (corpseUnit.getStatus() === UnitStatus.STATUS_UNCONSCIOUS ||
                (corpseUnit.getStatus() === UnitStatus.STATUS_IGNORE_ME &&
                  corpseUnit.getHealth() > 0 &&
                  corpseUnit.getHealth() < corpseUnit.getStunlevel()))
            ) {
              if (corpseUnit.getOriginalFaction() === UnitFaction.FACTION_HOSTILE) {
                this.recoverAlien(corpseUnit, base);
              }
            }
          } else if (!save?.isResearched?.(rules.getRequirements())) {
            this.addStat("STR_ALIEN_ARTIFACTS_RECOVERED", 1, rules.getRecoveryPoints());
          }
        }

        if (!rules.isFixed() && rules.isRecoverable()) {
          switch (rules.getBattleType()) {
            case BattleType.BT_CORPSE:
              break;
            case BattleType.BT_AMMO:
              this.addRounds(rules, item.getAmmoQuantity());
              break;
            case BattleType.BT_FIREARM:
            case BattleType.BT_MELEE: {
              const clip = item.getAmmoItem();
              if (clip && clip.getRules().getClipSize() > 0 && clip !== item) {
                this.addRounds(clip.getRules(), clip.getAmmoQuantity());
              }
              base.getStorageItems().addItem(rules.getType(), 1);
              break;
            }
            default:
              base.getStorageItems().addItem(rules.getType(), 1);
              break;
          }
          if (rules.getBattleType() === BattleType.BT_NONE) {
            for (const craft of base.getCrafts()) {
              craft.reuseItem(rules.getType());
            }
          }
        }
      }
    }
  }

  private recoverVehicleWeaponAmmo(unit: BattleUnit, rule: RuleItem, hand: string, base: Base): void {
    const ammoItem = unit.getItem(hand)?.getAmmoItem();
    if (rule.getCompatibleAmmo().length > 0 && ammoItem && ammoItem.getAmmoQuantity() > 0) {
      let total = ammoItem.getAmmoQuantity();
      if (rule.getClipSize()) {
        total = Math.trunc(total / ammoItem.getRules().getClipSize());
      }
      base.getStorageItems().addItem(rule.getCompatibleAmmo()[0], total);
    }
  }

  private recoverAlien(from: RecoverableBattleUnit, base: Base): void {
    if (from.getSpawnUnit().length > 0) {
      const save = this.game().getSavedGame();
      const battle = save?.getSavedBattle();
      const mod = this.game().getMod();
      if (save && battle && mod) {
        const newUnit = battle.convertUnit(from as unknown as BattleUnit, save, mod);
        newUnit.convertToFaction(UnitFaction.FACTION_PLAYER);
      }
      return;
    }

    const type = from.getType();
    const save = this.game().getSavedGame();
    const mod = this.game().getMod();
    if (base.getAvailableContainment() === 0 && (save?.getMonthsPassed() ?? 0) > -1) {
      this._noContainment = true;
      const corpseBattlescape = from.getArmor().getCorpseBattlescape();
      if (corpseBattlescape.length > 0) {
        const corpseRule = mod?.getItem(corpseBattlescape[0]);
        if (corpseRule?.isRecoverable()) {
          this.addStat("STR_ALIEN_CORPSES_RECOVERED", 1, corpseRule.getRecoveryPoints());
          const corpseItem = from.getArmor().getCorpseGeoscape();
          base.getStorageItems().addItem(corpseItem, 1);
        }
      }
    } else {
      const research = mod?.getResearch(type);
      if (research && !save?.isResearched(type)) {
        this.addStat("STR_LIVE_ALIENS_RECOVERED", 1, from.getValue() * 2);
      } else {
        this.addStat("STR_LIVE_ALIENS_RECOVERED", 1, 10);
      }

      base.getStorageItems().addItem(type, 1);
      this._manageContainment = base.getAvailableContainment() - (base.getUsedContainment() * this._limitsEnforced) < 0;
    }
  }

  private reequipCraft(base: Base, craft: Craft, vehicleItemsCanBeDestroyed: boolean): void {
    const craftItems = new Map(craft.getItems().getContents());
    for (const [item, required] of craftItems) {
      const qty = base.getStorageItems().getItem(item);
      if (qty >= required) {
        base.getStorageItems().removeItem(item, required);
      } else {
        const missing = required - qty;
        base.getStorageItems().removeItem(item, qty);
        craft.getItems().removeItem(item, missing);
        this._missingItems.push({ item, qty: missing, craft: craft.getName(this.game().getLanguage()) });
      }
    }

    const craftVehicles = new ItemContainer();
    for (const vehicle of craft.getVehicles()) {
      craftVehicles.addItem(vehicle.getRules().getType());
    }
    if (vehicleItemsCanBeDestroyed) {
      for (const vehicle of craft.getVehicles()) {
        void vehicle;
      }
    }
    craft.getVehicles().length = 0;

    const mod = this.game().getMod();
    for (const [item, required] of craftVehicles.getContents()) {
      const qty = base.getStorageItems().getItem(item);
      const tankRule = mod?.getItem(item, true);
      if (!tankRule) {
        continue;
      }
      const unit = mod?.getUnit(tankRule.getType());
      const armor = unit ? mod?.getArmor(unit.getArmor()) : null;
      let size = 4;
      if (armor) {
        size = armor.getSize() * armor.getSize();
      }

      let canBeAdded = Math.min(qty, required);
      if (qty < required) {
        this._missingItems.push({ item, qty: required - qty, craft: craft.getName(this.game().getLanguage()) });
      }

      const compatibleAmmo = tankRule.getCompatibleAmmo();
      if (compatibleAmmo.length === 0) {
        for (let j = 0; j < canBeAdded; ++j) {
          craft.getVehicles().push(new Vehicle(tankRule, tankRule.getClipSize(), size));
        }
        base.getStorageItems().removeItem(item, canBeAdded);
      } else {
        const ammo = mod?.getItem(compatibleAmmo[0], true);
        if (!ammo) {
          continue;
        }
        const { ammoPerVehicle, clipSize } = this.vehicleAmmoUsage(tankRule, ammo);
        const baseAmmoQty = base.getStorageItems().getItem(ammo.getType());
        if (baseAmmoQty < required * ammoPerVehicle) {
          this._missingItems.push({ item: ammo.getType(), qty: required * ammoPerVehicle - baseAmmoQty, craft: craft.getName(this.game().getLanguage()) });
        }
        canBeAdded = ammoPerVehicle > 0 ? Math.min(canBeAdded, Math.trunc(baseAmmoQty / ammoPerVehicle)) : 0;
        if (canBeAdded > 0) {
          for (let j = 0; j < canBeAdded; ++j) {
            craft.getVehicles().push(new Vehicle(tankRule, clipSize, size));
            base.getStorageItems().removeItem(ammo.getType(), ammoPerVehicle);
          }
          base.getStorageItems().removeItem(item, canBeAdded);
        }
      }
    }
  }

  private vehicleAmmoUsage(rule: RuleItem, ammo: RuleItem): { ammoPerVehicle: number; clipSize: number } {
    if (ammo.getClipSize() > 0 && rule.getClipSize() > 0) {
      return {
        clipSize: rule.getClipSize(),
        ammoPerVehicle: Math.trunc(rule.getClipSize() / ammo.getClipSize())
      };
    }
    return {
      clipSize: ammo.getClipSize(),
      ammoPerVehicle: ammo.getClipSize()
    };
  }

  private addRounds(rule: RuleItem, qty: number): void {
    this._rounds.set(rule, (this._rounds.get(rule) || 0) + qty);
  }
}
