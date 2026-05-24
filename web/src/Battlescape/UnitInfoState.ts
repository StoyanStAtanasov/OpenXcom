import type { Action } from "../Engine/Action.ts";
import { InteractiveSurface } from "../Engine/InteractiveSurface.ts";
import { Options } from "../Engine/Options.ts";
import { Screen } from "../Engine/Screen.ts";
import { State } from "../Engine/State.ts";
import { Surface } from "../Engine/Surface.ts";
import { Bar } from "../Interface/Bar.ts";
import { ALIGN_CENTER, Text } from "../Interface/Text.ts";
import { TextButton } from "../Interface/TextButton.ts";
import type { SavedBattleGame } from "../Savegame/SavedBattleGame.ts";
import { type BattleUnit, UnitSide } from "../Savegame/BattleUnit.ts";
import { SDL_BUTTON_RIGHT, SDL_BUTTON_X1, SDL_BUTTON_X2, SDL_MOUSEBUTTONDOWN } from "../types.ts";
import type { BattlescapeState } from "./BattlescapeState.ts";
import { BattlescapeGame } from "./BattlescapeGame.ts";

type UnitInfoRow = {
  label: Text;
  number: Text;
  bar: Bar;
};

/**
 * Unit Info screen that shows all the info of a specific unit.
 */
export class UnitInfoState extends State {
  private _battleGame: SavedBattleGame;

  private _bg: Surface;
  private _exit: InteractiveSurface;
  private _txtName: Text;

  private _txtTimeUnits: Text;
  private _txtEnergy: Text;
  private _txtHealth: Text;
  private _txtFatalWounds: Text;
  private _txtBravery: Text;
  private _txtMorale: Text;
  private _txtReactions: Text;
  private _txtFiring: Text;
  private _txtThrowing: Text;
  private _txtMelee: Text;
  private _txtStrength: Text;
  private _txtPsiStrength: Text;
  private _txtPsiSkill: Text;
  private _numTimeUnits: Text;
  private _numEnergy: Text;
  private _numHealth: Text;
  private _numFatalWounds: Text;
  private _numBravery: Text;
  private _numMorale: Text;
  private _numReactions: Text;
  private _numFiring: Text;
  private _numThrowing: Text;
  private _numMelee: Text;
  private _numStrength: Text;
  private _numPsiStrength: Text;
  private _numPsiSkill: Text;
  private _barTimeUnits: Bar;
  private _barEnergy: Bar;
  private _barHealth: Bar;
  private _barFatalWounds: Bar;
  private _barBravery: Bar;
  private _barMorale: Bar;
  private _barReactions: Bar;
  private _barFiring: Bar;
  private _barThrowing: Bar;
  private _barMelee: Bar;
  private _barStrength: Bar;
  private _barPsiStrength: Bar;
  private _barPsiSkill: Bar;

  private _txtFrontArmor: Text;
  private _txtLeftArmor: Text;
  private _txtRightArmor: Text;
  private _txtRearArmor: Text;
  private _txtUnderArmor: Text;
  private _numFrontArmor: Text;
  private _numLeftArmor: Text;
  private _numRightArmor: Text;
  private _numRearArmor: Text;
  private _numUnderArmor: Text;
  private _barFrontArmor: Bar;
  private _barLeftArmor: Bar;
  private _barRightArmor: Bar;
  private _barRearArmor: Bar;
  private _barUnderArmor: Bar;
  private _btnPrev: TextButton | null = null;
  private _btnNext: TextButton | null = null;

  constructor(
    private _unit: BattleUnit,
    private _parent: BattlescapeState | null,
    private _fromInventory: boolean,
    private _mindProbe: boolean
  ) {
    super();

    if (Options.maximizeInfoScreens) {
      Options.baseXResolution = Screen.ORIGINAL_WIDTH;
      Options.baseYResolution = Screen.ORIGINAL_HEIGHT;
      this.game().getScreen().resetDisplay();
    }

    const battleGame = this.game().getSavedGame()?.getSavedBattle();
    if (!battleGame) {
      throw new Error("UnitInfoState requires a saved battle.");
    }
    this._battleGame = battleGame;

    this._bg = new Surface(320, 200, 0, 0);
    this._exit = new InteractiveSurface(320, 180, 0, 20);
    this._txtName = new Text(288, 17, 16, 4);

    let yPos = 38;
    const step = 9;
    const makeRow = (): UnitInfoRow => {
      const row = {
        label: new Text(140, 9, 8, yPos),
        number: new Text(18, 9, 150, yPos),
        bar: new Bar(150, 5, 170, yPos + 1)
      };
      yPos += step;
      return row;
    };

    const timeUnits = makeRow();
    this._txtTimeUnits = timeUnits.label;
    this._numTimeUnits = timeUnits.number;
    this._barTimeUnits = timeUnits.bar;

    const energy = makeRow();
    this._txtEnergy = energy.label;
    this._numEnergy = energy.number;
    this._barEnergy = energy.bar;

    const health = makeRow();
    this._txtHealth = health.label;
    this._numHealth = health.number;
    this._barHealth = health.bar;

    const fatalWounds = makeRow();
    this._txtFatalWounds = fatalWounds.label;
    this._numFatalWounds = fatalWounds.number;
    this._barFatalWounds = fatalWounds.bar;

    const bravery = makeRow();
    this._txtBravery = bravery.label;
    this._numBravery = bravery.number;
    this._barBravery = bravery.bar;

    const morale = makeRow();
    this._txtMorale = morale.label;
    this._numMorale = morale.number;
    this._barMorale = morale.bar;

    const reactions = makeRow();
    this._txtReactions = reactions.label;
    this._numReactions = reactions.number;
    this._barReactions = reactions.bar;

    const firing = makeRow();
    this._txtFiring = firing.label;
    this._numFiring = firing.number;
    this._barFiring = firing.bar;

    const throwing = makeRow();
    this._txtThrowing = throwing.label;
    this._numThrowing = throwing.number;
    this._barThrowing = throwing.bar;

    const melee = makeRow();
    this._txtMelee = melee.label;
    this._numMelee = melee.number;
    this._barMelee = melee.bar;

    const strength = makeRow();
    this._txtStrength = strength.label;
    this._numStrength = strength.number;
    this._barStrength = strength.bar;

    const psiStrength = makeRow();
    this._txtPsiStrength = psiStrength.label;
    this._numPsiStrength = psiStrength.number;
    this._barPsiStrength = psiStrength.bar;

    const psiSkill = makeRow();
    this._txtPsiSkill = psiSkill.label;
    this._numPsiSkill = psiSkill.number;
    this._barPsiSkill = psiSkill.bar;

    const frontArmor = makeRow();
    this._txtFrontArmor = frontArmor.label;
    this._numFrontArmor = frontArmor.number;
    this._barFrontArmor = frontArmor.bar;

    const leftArmor = makeRow();
    this._txtLeftArmor = leftArmor.label;
    this._numLeftArmor = leftArmor.number;
    this._barLeftArmor = leftArmor.bar;

    const rightArmor = makeRow();
    this._txtRightArmor = rightArmor.label;
    this._numRightArmor = rightArmor.number;
    this._barRightArmor = rightArmor.bar;

    const rearArmor = makeRow();
    this._txtRearArmor = rearArmor.label;
    this._numRearArmor = rearArmor.number;
    this._barRearArmor = rearArmor.bar;

    const underArmor = makeRow();
    this._txtUnderArmor = underArmor.label;
    this._numUnderArmor = underArmor.number;
    this._barUnderArmor = underArmor.bar;

    if (!this._mindProbe) {
      this._btnPrev = new TextButton(14, 18, 2, 2);
      this._btnNext = new TextButton(14, 18, 304, 2);
    }

    this._battleGame.setPaletteByDepth(this);

    this.add(this._bg);
    this.add(this._exit);
    this.add(this._txtName, "textName", "stats");
    this.addRow(this._txtTimeUnits, this._numTimeUnits, this._barTimeUnits, "barTUs");
    this.addRow(this._txtEnergy, this._numEnergy, this._barEnergy, "barEnergy");
    this.addRow(this._txtHealth, this._numHealth, this._barHealth, "barHealth");
    this.addRow(this._txtFatalWounds, this._numFatalWounds, this._barFatalWounds, "barWounds");
    this.addRow(this._txtBravery, this._numBravery, this._barBravery, "barBravery");
    this.addRow(this._txtMorale, this._numMorale, this._barMorale, "barMorale");
    this.addRow(this._txtReactions, this._numReactions, this._barReactions, "barReactions");
    this.addRow(this._txtFiring, this._numFiring, this._barFiring, "barFiring");
    this.addRow(this._txtThrowing, this._numThrowing, this._barThrowing, "barThrowing");
    this.addRow(this._txtMelee, this._numMelee, this._barMelee, "barMelee");
    this.addRow(this._txtStrength, this._numStrength, this._barStrength, "barStrength");
    this.addRow(this._txtPsiStrength, this._numPsiStrength, this._barPsiStrength, "barPsiStrength");
    this.addRow(this._txtPsiSkill, this._numPsiSkill, this._barPsiSkill, "barPsiSkill");
    this.addRow(this._txtFrontArmor, this._numFrontArmor, this._barFrontArmor, "barFrontArmor");
    this.addRow(this._txtLeftArmor, this._numLeftArmor, this._barLeftArmor, "barLeftArmor");
    this.addRow(this._txtRightArmor, this._numRightArmor, this._barRightArmor, "barRightArmor");
    this.addRow(this._txtRearArmor, this._numRearArmor, this._barRearArmor, "barRearArmor");
    this.addRow(this._txtUnderArmor, this._numUnderArmor, this._barUnderArmor, "barUnderArmor");

    if (this._btnPrev && this._btnNext) {
      this.add(this._btnPrev, "button", "stats");
      this.add(this._btnNext, "button", "stats");
    }

    this.centerAllSurfaces();

    this.game().getMod()?.getSurface("UNIBORD.PCK")?.blit(this._bg);
    this._exit.onMouseClick(this.exitClick.bind(this));
    this._exit.onKeyboardPress(this.exitClick.bind(this), Options.keyCancel);
    this._exit.onKeyboardPress(this.exitClick.bind(this), Options.keyBattleStats);

    const textElement = this.game().getMod()?.getInterface("stats")?.getElement("text");
    const color = textElement?.color ?? 48;
    const color2 = textElement?.color2 ?? 144;

    this._txtName.setAlign(ALIGN_CENTER);
    this._txtName.setBig();
    this._txtName.setHighContrast(true);

    this.setupRow(this._txtTimeUnits, this._numTimeUnits, this._barTimeUnits, color, color2, "STR_TIME_UNITS");
    this.setupRow(this._txtEnergy, this._numEnergy, this._barEnergy, color, color2, "STR_ENERGY");
    this.setupRow(this._txtHealth, this._numHealth, this._barHealth, color, color2, "STR_HEALTH");
    this.setupRow(this._txtFatalWounds, this._numFatalWounds, this._barFatalWounds, color, color2, "STR_FATAL_WOUNDS");
    this.setupRow(this._txtBravery, this._numBravery, this._barBravery, color, color2, "STR_BRAVERY");
    this.setupRow(this._txtMorale, this._numMorale, this._barMorale, color, color2, "STR_MORALE");
    this.setupRow(this._txtReactions, this._numReactions, this._barReactions, color, color2, "STR_REACTIONS");
    this.setupRow(this._txtFiring, this._numFiring, this._barFiring, color, color2, "STR_FIRING_ACCURACY");
    this.setupRow(this._txtThrowing, this._numThrowing, this._barThrowing, color, color2, "STR_THROWING_ACCURACY");
    this.setupRow(this._txtMelee, this._numMelee, this._barMelee, color, color2, "STR_MELEE_ACCURACY");
    this.setupRow(this._txtStrength, this._numStrength, this._barStrength, color, color2, "STR_STRENGTH");
    this.setupRow(this._txtPsiStrength, this._numPsiStrength, this._barPsiStrength, color, color2, "STR_PSIONIC_STRENGTH");
    this.setupRow(this._txtPsiSkill, this._numPsiSkill, this._barPsiSkill, color, color2, "STR_PSIONIC_SKILL");
    this.setupRow(this._txtFrontArmor, this._numFrontArmor, this._barFrontArmor, color, color2, "STR_FRONT_ARMOR_UC");
    this.setupRow(this._txtLeftArmor, this._numLeftArmor, this._barLeftArmor, color, color2, "STR_LEFT_ARMOR_UC");
    this.setupRow(this._txtRightArmor, this._numRightArmor, this._barRightArmor, color, color2, "STR_RIGHT_ARMOR_UC");
    this.setupRow(this._txtRearArmor, this._numRearArmor, this._barRearArmor, color, color2, "STR_REAR_ARMOR_UC");
    this.setupRow(this._txtUnderArmor, this._numUnderArmor, this._barUnderArmor, color, color2, "STR_UNDER_ARMOR_UC");

    if (this._btnPrev && this._btnNext) {
      this._btnPrev.setText("<<");
      this._btnPrev.onMouseClick(this.btnPrevClick.bind(this));
      this._btnPrev.onKeyboardPress(this.btnPrevClick.bind(this), Options.keyBattlePrevUnit);
      this._btnNext.setText(">>");
      this._btnNext.onMouseClick(this.btnNextClick.bind(this));
      this._btnNext.onKeyboardPress(this.btnNextClick.bind(this), Options.keyBattleNextUnit);
    }
  }

  override init(): void {
    super.init();
    const stats = this._unit.getBaseStats();
    this._numTimeUnits.setText(String(this._unit.getTimeUnits()));
    this._barTimeUnits.setMax(stats.tu);
    this._barTimeUnits.setValue(this._unit.getTimeUnits());

    let name = "";
    if (this._unit.getType() === "SOLDIER") {
      name += `${String(this.tr(this._unit.getRankString()))} `;
    }
    name += this._unit.getName(this.game().getLanguage(), BattlescapeGame._debugPlay);
    this._txtName.setBig();
    this._txtName.setText(name);

    this._numEnergy.setText(String(this._unit.getEnergy()));
    this._barEnergy.setMax(stats.stamina);
    this._barEnergy.setValue(this._unit.getEnergy());

    this._numHealth.setText(String(this._unit.getHealth()));
    this._barHealth.setMax(stats.health);
    this._barHealth.setValue(this._unit.getHealth());
    this._barHealth.setValue2(this._unit.getStunlevel());

    this._numFatalWounds.setText(String(this._unit.getFatalWounds()));
    this._barFatalWounds.setMax(this._unit.getFatalWounds());
    this._barFatalWounds.setValue(this._unit.getFatalWounds());

    this._numBravery.setText(String(stats.bravery));
    this._barBravery.setMax(stats.bravery);
    this._barBravery.setValue(stats.bravery);

    this._numMorale.setText(String(this._unit.getMorale()));
    this._barMorale.setMax(100);
    this._barMorale.setValue(this._unit.getMorale());

    this._numReactions.setText(String(stats.reactions));
    this._barReactions.setMax(stats.reactions);
    this._barReactions.setValue(stats.reactions);

    const firing = this.scaledByHealth(stats.firing, stats.health);
    this._numFiring.setText(String(firing));
    this._barFiring.setMax(stats.firing);
    this._barFiring.setValue(firing);

    const throwing = this.scaledByHealth(stats.throwing, stats.health);
    this._numThrowing.setText(String(throwing));
    this._barThrowing.setMax(stats.throwing);
    this._barThrowing.setValue(throwing);

    const melee = this.scaledByHealth(stats.melee, stats.health);
    this._numMelee.setText(String(melee));
    this._barMelee.setMax(stats.melee);
    this._barMelee.setValue(melee);

    this._numStrength.setText(String(stats.strength));
    this._barStrength.setMax(stats.strength);
    this._barStrength.setValue(stats.strength);

    if (stats.psiSkill > 0 || (Options.psiStrengthEval && Boolean(this.game().getSavedGame()?.isResearched(this.game().getMod()?.getPsiRequirements() || [])))) {
      this._numPsiStrength.setText(String(stats.psiStrength));
      this._barPsiStrength.setMax(stats.psiStrength);
      this._barPsiStrength.setValue(stats.psiStrength);
      this.setPsiStrengthVisible(true);
    } else {
      this.setPsiStrengthVisible(false);
    }

    if (stats.psiSkill > 0) {
      this._numPsiSkill.setText(String(stats.psiSkill));
      this._barPsiSkill.setMax(stats.psiSkill);
      this._barPsiSkill.setValue(stats.psiSkill);
      this.setPsiSkillVisible(true);
    } else {
      this.setPsiSkillVisible(false);
    }

    this.setArmorRow(this._numFrontArmor, this._barFrontArmor, UnitSide.SIDE_FRONT);
    this.setArmorRow(this._numLeftArmor, this._barLeftArmor, UnitSide.SIDE_LEFT);
    this.setArmorRow(this._numRightArmor, this._barRightArmor, UnitSide.SIDE_RIGHT);
    this.setArmorRow(this._numRearArmor, this._barRearArmor, UnitSide.SIDE_REAR);
    this.setArmorRow(this._numUnderArmor, this._barUnderArmor, UnitSide.SIDE_UNDER);
  }

  override handle(action: Action): void {
    super.handle(action);
    const details = action.getDetails();
    if (details.type === SDL_MOUSEBUTTONDOWN) {
      if (details.button?.button === SDL_BUTTON_RIGHT) {
        this.exitClick(action);
      } else if (details.button?.button === SDL_BUTTON_X1) {
        if (!this._mindProbe) this.btnNextClick(action);
      } else if (details.button?.button === SDL_BUTTON_X2) {
        if (!this._mindProbe) this.btnPrevClick(action);
      }
    }
  }

  btnPrevClick(action: Action): void {
    if (this._parent) {
      this._parent.selectPreviousPlayerUnit(false, false, this._fromInventory);
    } else {
      this._battleGame.selectPreviousPlayerUnit(false, false, true);
    }
    const unit = this._battleGame.getSelectedUnit();
    if (unit) {
      this._unit = unit;
      this.init();
    } else {
      this.exitClick(action);
    }
  }

  btnNextClick(action: Action): void {
    if (this._parent) {
      this._parent.selectNextPlayerUnit(false, false, this._fromInventory);
    } else {
      this._battleGame.selectNextPlayerUnit(false, false, true);
    }
    const unit = this._battleGame.getSelectedUnit();
    if (unit) {
      this._unit = unit;
      this.init();
    } else {
      this.exitClick(action);
    }
  }

  exitClick(_action: Action): void {
    if (!this._fromInventory && Options.maximizeInfoScreens) {
      const width = { value: Options.baseXBattlescape };
      const height = { value: Options.baseYBattlescape };
      Screen.updateScale(Options.battlescapeScale, width, height, true);
      Options.baseXBattlescape = width.value;
      Options.baseYBattlescape = height.value;
      this.game().getScreen().resetDisplay();
    }
    this.game().popState();
  }

  private addRow(label: Text, number: Text, bar: Bar, barId: string): void {
    this.add(label);
    this.add(number);
    this.add(bar, barId, "stats");
  }

  private setupRow(label: Text, number: Text, bar: Bar, color: number, color2: number, text: string): void {
    label.setColor(color);
    label.setHighContrast(true);
    label.setText(String(this.tr(text)));
    number.setColor(color2);
    number.setHighContrast(true);
    bar.setScale(1.0);
  }

  private scaledByHealth(value: number, maxHealth: number): number {
    if (maxHealth <= 0) {
      return 0;
    }
    return Math.trunc(value * this._unit.getHealth() / maxHealth);
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

  private setArmorRow(num: Text, bar: Bar, side: UnitSide): void {
    num.setText(String(this._unit.getArmor(side)));
    bar.setMax(this._unit.getMaxArmor(side));
    bar.setValue(this._unit.getArmor(side));
  }
}
