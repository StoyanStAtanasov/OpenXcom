import type { Action } from "../Engine/Action.ts";
import { InteractiveSurface } from "../Engine/InteractiveSurface.ts";
import { Options } from "../Engine/Options.ts";
import { Palette } from "../Engine/Palette.ts";
import { Screen } from "../Engine/Screen.ts";
import { State } from "../Engine/State.ts";
import { Surface } from "../Engine/Surface.ts";
import { ALIGN_CENTER, Text } from "../Interface/Text.ts";
import type { BattleItem } from "../Savegame/BattleItem.ts";
import { type BattleUnit, UnitFaction, UnitStatus } from "../Savegame/BattleUnit.ts";
import { SDL_BUTTON_RIGHT, SDL_MOUSEBUTTONDOWN } from "../types.ts";
import type { BattleAction } from "./BattlescapeGame.ts";
import { MedikitView } from "./MedikitView.ts";

class MedikitTitle extends Text {
  constructor(y: number, title: string) {
    super(73, 9, 186, y);
    this.setText(title);
    this.setHighContrast(true);
    this.setAlign(ALIGN_CENTER);
  }
}

class MedikitTxt extends Text {
  constructor(y: number) {
    super(33, 17, 220, y);
    this.setColor(Palette.blockOffset(1));
    this.setHighContrast(true);
    this.setAlign(ALIGN_CENTER);
  }
}

class MedikitButton extends InteractiveSurface {
  constructor(y: number) {
    super(30, 20, 190, y);
  }
}

/**
 * The Medikit User Interface.
 */
export class MedikitState extends State {
  private _bg: Surface;
  private _medikitView: MedikitView;
  private _pkText: Text;
  private _stimulantTxt: Text;
  private _healTxt: Text;
  private _partTxt: Text;
  private _woundTxt: Text;
  private _endButton: InteractiveSurface;
  private _stimulantButton: InteractiveSurface;
  private _pkButton: InteractiveSurface;
  private _healButton: InteractiveSurface;
  private _unit: BattleUnit;
  private _item: BattleItem;
  private _tu: number;
  private _revivedTarget = false;

  constructor(private _targetUnit: BattleUnit, private _action: BattleAction) {
    super();

    if (!this._action.actor || !this._action.weapon) {
      throw new Error("MedikitState requires an actor and weapon.");
    }

    if (Options.maximizeInfoScreens) {
      Options.baseXResolution = Screen.ORIGINAL_WIDTH;
      Options.baseYResolution = Screen.ORIGINAL_HEIGHT;
      this.game().getScreen().resetDisplay();
    }

    this._tu = this._action.TU;
    this._unit = this._action.actor;
    this._item = this._action.weapon;
    this._bg = new Surface(320, 200);

    this.game().getSavedGame()?.getSavedBattle()?.setPaletteByDepth(this);

    if (this.game().getScreen().getDY() > 50) {
      this._screen = false;
      this._bg.drawRect(67, 44, 190, 100, Palette.blockOffset(15) + 15);
    }

    this._partTxt = new Text(62, 9, 82, 120);
    this._woundTxt = new Text(14, 9, 145, 120);
    this._medikitView = new MedikitView(52, 58, 95, 60, this.game(), this._targetUnit, this._partTxt, this._woundTxt);
    this._endButton = new InteractiveSurface(20, 20, 220, 140);
    this._stimulantButton = new MedikitButton(84);
    this._pkButton = new MedikitButton(48);
    this._healButton = new MedikitButton(120);
    this._pkText = new MedikitTxt(52);
    this._stimulantTxt = new MedikitTxt(88);
    this._healTxt = new MedikitTxt(124);

    this.add(this._bg);
    this.add(this._medikitView, "body", "medikit", this._bg);
    this.add(this._endButton, "buttonEnd", "medikit", this._bg);
    this.add(new MedikitTitle(37, String(this.tr("STR_PAIN_KILLER"))), "textPK", "medikit", this._bg);
    this.add(new MedikitTitle(73, String(this.tr("STR_STIMULANT"))), "textStim", "medikit", this._bg);
    this.add(new MedikitTitle(109, String(this.tr("STR_HEAL"))), "textHeal", "medikit", this._bg);
    this.add(this._healButton, "buttonHeal", "medikit", this._bg);
    this.add(this._stimulantButton, "buttonStim", "medikit", this._bg);
    this.add(this._pkButton, "buttonPK", "medikit", this._bg);
    this.add(this._pkText, "numPK", "medikit", this._bg);
    this.add(this._stimulantTxt, "numStim", "medikit", this._bg);
    this.add(this._healTxt, "numHeal", "medikit", this._bg);
    this.add(this._partTxt, "textPart", "medikit", this._bg);
    this.add(this._woundTxt, "numWounds", "medikit", this._bg);

    this.centerAllSurfaces();

    this.game().getMod()?.getSurface("MEDIBORD.PCK")?.blit(this._bg);
    this._pkText.setBig();
    this._stimulantTxt.setBig();
    this._healTxt.setBig();
    this._partTxt.setHighContrast(true);
    this._woundTxt.setHighContrast(true);

    this._endButton.onMouseClick(this.onEndClick.bind(this));
    this._endButton.onKeyboardPress(this.onEndClick.bind(this), Options.keyCancel);
    this._healButton.onMouseClick(this.onHealClick.bind(this));
    this._stimulantButton.onMouseClick(this.onStimulantClick.bind(this));
    this._pkButton.onMouseClick(this.onPainKillerClick.bind(this));
    this.update();
  }

  override handle(action: Action): void {
    super.handle(action);
    const details = action.getDetails();
    if (details.type === SDL_MOUSEBUTTONDOWN && details.button?.button === SDL_BUTTON_RIGHT) {
      this.onEndClick(action);
    }
  }

  private onEndClick(_action: Action | null): void {
    if (Options.maximizeInfoScreens) {
      const width = { value: Options.baseXBattlescape };
      const height = { value: Options.baseYBattlescape };
      Screen.updateScale(Options.battlescapeScale, width, height, true);
      Options.baseXBattlescape = width.value;
      Options.baseYBattlescape = height.value;
      this.game().getScreen().resetDisplay();
    }
    this.game().popState();
  }

  private onHealClick(_action: Action): void {
    let heal = this._item.getHealQuantity();
    const rule = this._item.getRules();
    if (heal === 0) {
      return;
    }
    if (this._unit.spendTimeUnits(this._tu)) {
      this._targetUnit.heal(this._medikitView.getSelectedPart(), rule.getWoundRecovery(), rule.getHealthRecovery());
      this._item.setHealQuantity(--heal);
      this._medikitView.updateSelectedPart();
      this._medikitView.invalidate();
      this.update();

      if (this._targetUnit.getStatus() === UnitStatus.STATUS_UNCONSCIOUS &&
        this._targetUnit.getStunlevel() < this._targetUnit.getHealth() &&
        this._targetUnit.getHealth() > 0) {
        if (!this._revivedTarget) {
          this._targetUnit.setTimeUnits(0);
          const actor = this._action.actor;
          if (this._targetUnit.getOriginalFaction() === UnitFaction.FACTION_PLAYER) {
            if (actor) actor.getStatistics().revivedSoldier++;
          } else if (this._targetUnit.getOriginalFaction() === UnitFaction.FACTION_HOSTILE) {
            if (actor) actor.getStatistics().revivedHostile++;
          } else {
            if (actor) actor.getStatistics().revivedNeutral++;
          }
          this._revivedTarget = true;
        }
        if (this._targetUnit.getFatalWounds() === 0) {
          this.onEndClick(null);
        }
      }
      this._unit.getStatistics().woundsHealed++;
    } else {
      this._action.result = "STR_NOT_ENOUGH_TIME_UNITS";
      this.onEndClick(null);
    }
  }

  private onStimulantClick(_action: Action): void {
    let stimulant = this._item.getStimulantQuantity();
    const rule = this._item.getRules();
    if (stimulant === 0) {
      return;
    }
    if (this._unit.spendTimeUnits(this._tu)) {
      this._targetUnit.stimulant(rule.getEnergyRecovery(), rule.getStunRecovery());
      this._item.setStimulantQuantity(--stimulant);
      const actor = this._action.actor;
      if (actor) actor.getStatistics().appliedStimulant++;
      this.update();

      if (this._targetUnit.getStatus() === UnitStatus.STATUS_UNCONSCIOUS &&
        this._targetUnit.getStunlevel() < this._targetUnit.getHealth() &&
        this._targetUnit.getHealth() > 0) {
        this._targetUnit.setTimeUnits(0);
        if (this._targetUnit.getOriginalFaction() === UnitFaction.FACTION_PLAYER) {
          if (actor) actor.getStatistics().revivedSoldier++;
        } else if (this._targetUnit.getOriginalFaction() === UnitFaction.FACTION_HOSTILE) {
          if (actor) actor.getStatistics().revivedHostile++;
        } else {
          if (actor) actor.getStatistics().revivedNeutral++;
        }
        this.onEndClick(null);
      }
    } else {
      this._action.result = "STR_NOT_ENOUGH_TIME_UNITS";
      this.onEndClick(null);
    }
  }

  private onPainKillerClick(_action: Action): void {
    let pk = this._item.getPainKillerQuantity();
    if (pk === 0) {
      return;
    }
    if (this._unit.spendTimeUnits(this._tu)) {
      this._targetUnit.painKillers();
      this._item.setPainKillerQuantity(--pk);
      const actor = this._action.actor;
      if (actor) actor.getStatistics().appliedPainKill++;
      this.update();
    } else {
      this._action.result = "STR_NOT_ENOUGH_TIME_UNITS";
      this.onEndClick(null);
    }
  }

  private update(): void {
    this._pkText.setText(String(this._item.getPainKillerQuantity()));
    this._stimulantTxt.setText(String(this._item.getStimulantQuantity()));
    this._healTxt.setText(String(this._item.getHealQuantity()));
    this._medikitView.invalidate();
  }
}
