import type { Action } from "../Engine/Action.ts";
import { Options } from "../Engine/Options.ts";
import { State } from "../Engine/State.ts";
import { Surface } from "../Engine/Surface.ts";
import { Bar } from "../Interface/Bar.ts";
import { Text, ALIGN_CENTER } from "../Interface/Text.ts";
import { TextButton } from "../Interface/TextButton.ts";
import { TextEdit } from "../Interface/TextEdit.ts";
import { ErrorMessageState } from "../Menu/ErrorMessageState.ts";
import type { UnitStats } from "../Mod/Unit.ts";
import type { Base } from "../Savegame/Base.ts";
import type { Soldier } from "../Savegame/Soldier.ts";
import { SellState } from "./SellState.ts";
import { SackSoldierState } from "./SackSoldierState.ts";
import { SoldierArmorState } from "./SoldierArmorState.ts";
import { SoldierDiaryOverviewState } from "./SoldierDiaryOverviewState.ts";

type StatRow = {
  label: Text;
  number: Text;
  bar: Bar;
  barId: string;
};

export class SoldierInfoState extends State {
  private _soldier: Soldier | null = null;
  private _list: Soldier[];
  private _bg: Surface;
  private _rank: Surface;
  private _btnOk: TextButton;
  private _btnPrev: TextButton;
  private _btnNext: TextButton;
  private _btnArmor: TextButton;
  private _btnSack: TextButton;
  private _btnDiary: TextButton;
  private _edtSoldier: TextEdit;
  private _txtRank: Text;
  private _txtMissions: Text;
  private _txtKills: Text;
  private _txtCraft: Text;
  private _txtRecovery: Text;
  private _txtPsionic: Text;
  private _txtDead: Text;
  private _txtTimeUnits: Text;
  private _numTimeUnits: Text;
  private _barTimeUnits: Bar;
  private _txtStamina: Text;
  private _numStamina: Text;
  private _barStamina: Bar;
  private _txtHealth: Text;
  private _numHealth: Text;
  private _barHealth: Bar;
  private _txtBravery: Text;
  private _numBravery: Text;
  private _barBravery: Bar;
  private _txtReactions: Text;
  private _numReactions: Text;
  private _barReactions: Bar;
  private _txtFiring: Text;
  private _numFiring: Text;
  private _barFiring: Bar;
  private _txtThrowing: Text;
  private _numThrowing: Text;
  private _barThrowing: Bar;
  private _txtMelee: Text;
  private _numMelee: Text;
  private _barMelee: Bar;
  private _txtStrength: Text;
  private _numStrength: Text;
  private _barStrength: Bar;
  private _txtPsiStrength: Text;
  private _numPsiStrength: Text;
  private _barPsiStrength: Bar;
  private _txtPsiSkill: Text;
  private _numPsiSkill: Text;
  private _barPsiSkill: Bar;

  constructor(private _base: Base | null, private _soldierId: number) {
    super();
    if (this._base === null) {
      this._list = this.game().getSavedGame()?.getDeadSoldiers() || [];
      if (this._soldierId >= this._list.length) {
        this._soldierId = 0;
      } else {
        this._soldierId = this._list.length - (1 + this._soldierId);
      }
    } else {
      this._list = this._base.getSoldiers();
    }

    this._bg = new Surface(320, 200, 0, 0);
    this._rank = new Surface(26, 23, 4, 4);
    this._btnPrev = new TextButton(28, 14, 0, 33);
    this._btnOk = new TextButton(48, 14, 30, 33);
    this._btnNext = new TextButton(28, 14, 80, 33);
    this._btnArmor = new TextButton(110, 14, 130, 33);
    this._edtSoldier = new TextEdit(this, 210, 16, 40, 9);
    this._btnSack = new TextButton(60, 14, 260, 33);
    this._btnDiary = new TextButton(60, 14, 260, 48);
    this._txtRank = new Text(130, 9, 0, 48);
    this._txtMissions = new Text(100, 9, 130, 48);
    this._txtKills = new Text(100, 9, 200, 48);
    this._txtCraft = new Text(130, 9, 0, 56);
    this._txtRecovery = new Text(180, 9, 130, 56);
    this._txtPsionic = new Text(150, 9, 0, 66);
    this._txtDead = new Text(150, 9, 130, 33);

    let yPos = 80;
    const step = 11;
    const makeRow = (barId: string): StatRow => {
      const row = {
        label: new Text(120, 9, 6, yPos),
        number: new Text(18, 9, 131, yPos),
        bar: new Bar(170, 7, 150, yPos),
        barId
      };
      yPos += step;
      return row;
    };

    const tu = makeRow("barTUs");
    this._txtTimeUnits = tu.label;
    this._numTimeUnits = tu.number;
    this._barTimeUnits = tu.bar;
    const stamina = makeRow("barEnergy");
    this._txtStamina = stamina.label;
    this._numStamina = stamina.number;
    this._barStamina = stamina.bar;
    const health = makeRow("barHealth");
    this._txtHealth = health.label;
    this._numHealth = health.number;
    this._barHealth = health.bar;
    const bravery = makeRow("barBravery");
    this._txtBravery = bravery.label;
    this._numBravery = bravery.number;
    this._barBravery = bravery.bar;
    const reactions = makeRow("barReactions");
    this._txtReactions = reactions.label;
    this._numReactions = reactions.number;
    this._barReactions = reactions.bar;
    const firing = makeRow("barFiring");
    this._txtFiring = firing.label;
    this._numFiring = firing.number;
    this._barFiring = firing.bar;
    const throwing = makeRow("barThrowing");
    this._txtThrowing = throwing.label;
    this._numThrowing = throwing.number;
    this._barThrowing = throwing.bar;
    const melee = makeRow("barMelee");
    this._txtMelee = melee.label;
    this._numMelee = melee.number;
    this._barMelee = melee.bar;
    const strength = makeRow("barStrength");
    this._txtStrength = strength.label;
    this._numStrength = strength.number;
    this._barStrength = strength.bar;
    const psiStrength = makeRow("barPsiStrength");
    this._txtPsiStrength = psiStrength.label;
    this._numPsiStrength = psiStrength.number;
    this._barPsiStrength = psiStrength.bar;
    const psiSkill = makeRow("barPsiSkill");
    this._txtPsiSkill = psiSkill.label;
    this._numPsiSkill = psiSkill.number;
    this._barPsiSkill = psiSkill.bar;

    this.setInterface("soldierInfo");

    this.add(this._bg);
    this.add(this._rank);
    this.add(this._btnOk, "button", "soldierInfo");
    this.add(this._btnPrev, "button", "soldierInfo");
    this.add(this._btnNext, "button", "soldierInfo");
    this.add(this._btnArmor, "button", "soldierInfo");
    this.add(this._edtSoldier, "text1", "soldierInfo");
    this.add(this._btnSack, "button", "soldierInfo");
    this.add(this._btnDiary, "button", "soldierInfo");
    this.add(this._txtRank, "text1", "soldierInfo");
    this.add(this._txtMissions, "text1", "soldierInfo");
    this.add(this._txtKills, "text1", "soldierInfo");
    this.add(this._txtCraft, "text1", "soldierInfo");
    this.add(this._txtRecovery, "text1", "soldierInfo");
    this.add(this._txtPsionic, "text2", "soldierInfo");
    this.add(this._txtDead, "text2", "soldierInfo");

    for (const row of [tu, stamina, health, bravery, reactions, firing, throwing, melee, strength, psiStrength, psiSkill]) {
      this.add(row.label, "text2", "soldierInfo");
      this.add(row.number, "numbers", "soldierInfo");
      this.add(row.bar, row.barId, "soldierInfo");
    }

    this.centerAllSurfaces();

    this.game().getMod()?.getSurface("BACK06.SCR")?.blit(this._bg);

    this._btnOk.setText(String(this.tr("STR_OK")));
    this._btnOk.onMouseClick(this.btnOkClick.bind(this));
    this._btnOk.onKeyboardPress(this.btnOkClick.bind(this), Options.keyCancel);

    this._btnPrev.setText("<<");
    this._btnPrev.onMouseClick((this._base === null ? this.btnNextClick : this.btnPrevClick).bind(this));
    this._btnPrev.onKeyboardPress((this._base === null ? this.btnNextClick : this.btnPrevClick).bind(this), Options.keyBattlePrevUnit);
    this._btnNext.setText(">>");
    this._btnNext.onMouseClick((this._base === null ? this.btnPrevClick : this.btnNextClick).bind(this));
    this._btnNext.onKeyboardPress((this._base === null ? this.btnPrevClick : this.btnNextClick).bind(this), Options.keyBattleNextUnit);

    this._btnArmor.setText(String(this.tr("STR_ARMOR")));
    this._btnArmor.onMouseClick(this.btnArmorClick.bind(this));

    this._edtSoldier.setBig();
    this._edtSoldier.onChange(this.edtSoldierChange.bind(this));
    this._edtSoldier.onMousePress(this.edtSoldierPress.bind(this));

    this._btnSack.setText(String(this.tr("STR_SACK")));
    this._btnSack.onMouseClick(this.btnSackClick.bind(this));

    this._btnDiary.setText(String(this.tr("STR_DIARY")));
    this._btnDiary.onMouseClick(this.btnDiaryClick.bind(this));

    this._txtPsionic.setText(String(this.tr("STR_IN_PSIONIC_TRAINING")));
    this.setupRow(this._txtTimeUnits, this._barTimeUnits, "STR_TIME_UNITS");
    this.setupRow(this._txtStamina, this._barStamina, "STR_STAMINA");
    this.setupRow(this._txtHealth, this._barHealth, "STR_HEALTH");
    this.setupRow(this._txtBravery, this._barBravery, "STR_BRAVERY");
    this.setupRow(this._txtReactions, this._barReactions, "STR_REACTIONS");
    this.setupRow(this._txtFiring, this._barFiring, "STR_FIRING_ACCURACY");
    this.setupRow(this._txtThrowing, this._barThrowing, "STR_THROWING_ACCURACY");
    this.setupRow(this._txtMelee, this._barMelee, "STR_MELEE_ACCURACY");
    this.setupRow(this._txtStrength, this._barStrength, "STR_STRENGTH");
    this.setupRow(this._txtPsiStrength, this._barPsiStrength, "STR_PSIONIC_STRENGTH");
    this.setupRow(this._txtPsiSkill, this._barPsiSkill, "STR_PSIONIC_SKILL");
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
    this._edtSoldier.setBig();
    this._edtSoldier.setText(this._soldier.getName());

    const initial = this._soldier.getInitStats();
    const current = this._soldier.getCurrentStats();
    const withArmor = this.withArmorStats(current, this._soldier);

    const rankFrame = this.game().getMod()?.getSurfaceSet("BASEBITS.PCK")?.getFrame(this._soldier.getRankSprite());
    if (rankFrame) {
      rankFrame.setX(0);
      rankFrame.setY(0);
      rankFrame.blit(this._rank);
    }

    this.setStatRow(this._numTimeUnits, this._barTimeUnits, withArmor.tu, current.tu, initial.tu);
    this.setStatRow(this._numStamina, this._barStamina, withArmor.stamina, current.stamina, initial.stamina);
    this.setStatRow(this._numHealth, this._barHealth, withArmor.health, current.health, initial.health);
    this.setStatRow(this._numBravery, this._barBravery, withArmor.bravery, current.bravery, initial.bravery);
    this.setStatRow(this._numReactions, this._barReactions, withArmor.reactions, current.reactions, initial.reactions);
    this.setStatRow(this._numFiring, this._barFiring, withArmor.firing, current.firing, initial.firing);
    this.setStatRow(this._numThrowing, this._barThrowing, withArmor.throwing, current.throwing, initial.throwing);
    this.setStatRow(this._numMelee, this._barMelee, withArmor.melee, current.melee, initial.melee);
    this.setStatRow(this._numStrength, this._barStrength, withArmor.strength, current.strength, initial.strength);

    const armorType = this._soldier.getArmor()?.getType() || "";
    if (armorType && armorType === this._soldier.getRules().getArmor()) {
      this._btnArmor.setText(String(this.tr("STR_ARMOR_").arg(this.tr(armorType))));
    } else {
      this._btnArmor.setText(armorType ? String(this.tr(armorType)) : String(this.tr("STR_ARMOR")));
    }

    const save = this.game().getSavedGame();
    this._btnSack.setVisible((save?.getMonthsPassed() ?? -1) > -1 && !(this._soldier.getCraft() && this._soldier.getCraft()?.getStatus() === "STR_OUT"));
    this._txtRank.setText(String(this.tr("STR_RANK_").arg(this.tr(this._soldier.getRankString()))));
    this._txtMissions.setText(String(this.tr("STR_MISSIONS").arg(this._soldier.getMissions())));
    this._txtKills.setText(String(this.tr("STR_KILLS").arg(this._soldier.getKills())));

    const craft = this._soldier.getCraft() === null ? String(this.tr("STR_NONE_UC")) : this._soldier.getCraft()!.getName(this.game().getLanguage());
    this._txtCraft.setText(String(this.tr("STR_CRAFT_").arg(craft)));
    if (this._soldier.getWoundRecovery() > 0) {
      this._txtRecovery.setText(String(this.tr("STR_WOUND_RECOVERY").arg(this.tr("STR_DAY", this._soldier.getWoundRecovery()))));
    } else {
      this._txtRecovery.setText("");
    }
    this._txtPsionic.setVisible(this._soldier.isInPsiTraining());

    if (current.psiSkill > 0 || (Options.psiStrengthEval && Boolean(save?.isResearched(this.game().getMod()?.getPsiRequirements() || [])))) {
      this.setStatRow(this._numPsiStrength, this._barPsiStrength, withArmor.psiStrength, current.psiStrength, initial.psiStrength);
      this.setPsiStrengthVisible(true);
    } else {
      this.setPsiStrengthVisible(false);
    }

    if (current.psiSkill > 0) {
      this.setStatRow(this._numPsiSkill, this._barPsiSkill, withArmor.psiSkill, current.psiSkill, initial.psiSkill);
      this.setPsiSkillVisible(true);
    } else {
      this.setPsiSkillVisible(false);
    }

    if (this._base === null) {
      this._btnArmor.setVisible(false);
      this._btnSack.setVisible(false);
      this._txtCraft.setVisible(false);
      this._txtDead.setVisible(true);
      const status = this._soldier.getDeath()?.getCause?.() ? "STR_KILLED_IN_ACTION" : "STR_MISSING_IN_ACTION";
      this._txtDead.setText(String(this.tr(status, this._soldier.getGender())));
    } else {
      this._txtDead.setVisible(false);
    }
  }

  edtSoldierPress(_action?: Action): void {
    if (this._base === null) {
      this._edtSoldier.setFocus(false);
    }
  }

  setSoldierId(soldier: number): void {
    this._soldierId = soldier;
  }

  edtSoldierChange(_action?: Action): void {
    this._soldier?.setName(this._edtSoldier.getText());
  }

  btnOkClick(_action?: Action): void {
    this.game().popState();
    if ((this.game().getSavedGame()?.getMonthsPassed() ?? -1) > -1 && Options.storageLimitsEnforced && this._base !== null && this._base.storesOverfull()) {
      const menuInterface = this.game().getMod()?.getInterface("soldierInfo");
      this.game().pushState(new SellState(this._base));
      this.game().pushState(new ErrorMessageState(
        String(this.tr("STR_STORAGE_EXCEEDED").arg(this._base.getName())),
        this._palette,
        menuInterface?.getElement("errorMessage")?.color || 1,
        "BACK01.SCR",
        menuInterface?.getElement("errorPalette")?.color ?? -1
      ));
    }
  }

  btnPrevClick(_action?: Action): void {
    this._soldierId = this._soldierId === 0 ? this._list.length - 1 : this._soldierId - 1;
    this.init();
  }

  btnNextClick(_action?: Action): void {
    ++this._soldierId;
    if (this._soldierId >= this._list.length) {
      this._soldierId = 0;
    }
    this.init();
  }

  btnArmorClick(_action?: Action): void {
    if (!this._soldier?.getCraft() || this._soldier.getCraft()?.getStatus() !== "STR_OUT") {
      if (this._base !== null) {
        this.game().pushState(new SoldierArmorState(this._base, this._soldierId));
      }
    }
  }

  btnSackClick(_action?: Action): void {
    if (this._base !== null) {
      this.game().pushState(new SackSoldierState(this._base, this._soldierId));
    }
  }

  btnDiaryClick(_action?: Action): void {
    this.game().pushState(new SoldierDiaryOverviewState(this._base, this._soldierId, this));
  }

  private setupRow(label: Text, bar: Bar, text: string): void {
    label.setText(String(this.tr(text)));
    bar.setScale(1.0);
  }

  private setStatRow(number: Text, bar: Bar, value: number, max: number, initial: number): void {
    number.setText(`${value}`);
    bar.setMax(max);
    bar.setValue(value);
    bar.setValue2(Math.min(value, initial));
  }

  private setPsiStrengthVisible(visible: boolean): void {
    this._txtPsiStrength.setVisible(visible);
    this._numPsiStrength.setVisible(visible);
    this._barPsiStrength.setVisible(visible);
  }

  private setPsiSkillVisible(visible: boolean): void {
    this._txtPsiSkill.setVisible(visible);
    this._numPsiSkill.setVisible(visible);
    this._barPsiSkill.setVisible(visible);
  }

  private withArmorStats(current: UnitStats, soldier: Soldier): UnitStats {
    const stats = { ...current };
    const armorStats = soldier.getArmor()?.getStats();
    if (armorStats) {
      for (const key of Object.keys(stats) as Array<keyof UnitStats>) {
        stats[key] += armorStats[key] || 0;
      }
    }
    return stats;
  }
}
