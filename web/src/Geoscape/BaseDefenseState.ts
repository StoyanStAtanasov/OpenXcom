import { Options } from "../Engine/Options.ts";
import { RNG } from "../Engine/RNG.ts";
import { State } from "../Engine/State.ts";
import { Timer } from "../Engine/Timer.ts";
import type { Action } from "../Engine/Action.ts";
import { Text } from "../Interface/Text.ts";
import { TextButton } from "../Interface/TextButton.ts";
import { TextList } from "../Interface/TextList.ts";
import { Window } from "../Interface/Window.ts";
import { Mod } from "../Mod/Mod.ts";
import type { Base } from "../Savegame/Base.ts";
import type { BaseFacility } from "../Savegame/BaseFacility.ts";
import { Ufo, UfoStatus } from "../Savegame/Ufo.ts";
import type { GeoscapeState } from "./GeoscapeState.ts";

export enum BaseDefenseActionType {
  BDA_NONE,
  BDA_FIRE,
  BDA_RESOLVE,
  BDA_DESTROY,
  BDA_END
}

type BaseWithDefenseBoundaries = Base & {
  getDefenses?: () => BaseFacility[];
  cleanupDefenses?: (destroyed: boolean) => void;
};

type GeoscapeBaseDefenseBoundary = GeoscapeState & {
  handleBaseDefense?: (base: Base, ufo: Ufo) => void;
};

function getDefenses(base: Base): BaseFacility[] {
  const boundary = base as BaseWithDefenseBoundaries;
  return boundary.getDefenses?.() || base.getFacilities().filter(facility =>
    facility.getBuildTime() === 0 && facility.getRules().getDefenseValue() > 0
  );
}

function playGeoscapeSound(mod: Mod | null, cat: string, id: number): void {
  mod?.getSound(cat, id, false)?.play();
}

/**
 * Base Defense Screen for when ufos try to attack.
 */
export class BaseDefenseState extends State {
  private _btnOk: TextButton;
  private _window: Window;
  private _txtTitle: Text;
  private _txtInit: Text;
  private _lstDefenses: TextList;
  private _thinkcycles = 0;
  private _row = -1;
  private _passes = 0;
  private _gravShields = 0;
  private _defenses = 0;
  private _attacks = 0;
  private _explosionCount = 0;
  private _action = BaseDefenseActionType.BDA_NONE;
  private _timer: Timer;

  constructor(private _base: Base, private _ufo: Ufo, private _state: GeoscapeState) {
    super();

    this._window = new Window(this, 320, 200, 0, 0);
    this._txtTitle = new Text(300, 17, 16, 6);
    this._txtInit = new Text(300, 10, 16, 24);
    this._lstDefenses = new TextList(300, 128, 16, 40);
    this._btnOk = new TextButton(120, 18, 100, 170);

    this.setInterface("baseDefense");

    this.add(this._window, "window", "baseDefense");
    this.add(this._btnOk, "button", "baseDefense");
    this.add(this._txtTitle, "text", "baseDefense");
    this.add(this._txtInit, "text", "baseDefense");
    this.add(this._lstDefenses, "text", "baseDefense");

    this.centerAllSurfaces();

    const back04 = this.game().getMod()?.getSurface("BACK04.SCR");
    if (back04) {
      this._window.setBackground(back04);
    }

    this._btnOk.setText(String(this.tr("STR_OK")));
    this._btnOk.onMouseClick(this.btnOkClick.bind(this));
    this._btnOk.onKeyboardPress(this.btnOkClick.bind(this), Options.keyOk);
    this._btnOk.onKeyboardPress(this.btnOkClick.bind(this), Options.keyCancel);
    this._btnOk.setVisible(false);

    this._txtTitle.setBig();
    this._txtTitle.setText(String(this.tr("STR_BASE_UNDER_ATTACK").arg(this._base.getName())));
    this._txtInit.setVisible(false);
    this._txtInit.setText(String(this.tr("STR_BASE_DEFENSES_INITIATED")));

    this._lstDefenses.setColumns(3, 134, 70, 50);
    this._gravShields = this._base.getGravShields();
    this._defenses = getDefenses(this._base).length;
    this._timer = new Timer(250);
    this._timer.onTimer(this.nextStep.bind(this));
    this._timer.start();
  }

  override think(): void {
    this._timer.think(this, null);
  }

  nextStep(): void {
    if (this._thinkcycles === -1) {
      return;
    }

    ++this._thinkcycles;

    if (this._thinkcycles === 1) {
      this._txtInit.setVisible(true);
      return;
    }

    if (this._thinkcycles <= 1) {
      return;
    }

    switch (this._action) {
      case BaseDefenseActionType.BDA_DESTROY:
        if (!this._explosionCount) {
          this._lstDefenses.addRow(2, String(this.tr("STR_UFO_DESTROYED")), " ", " ");
          ++this._row;
          if (this._row > 14) {
            this._lstDefenses.scrollDown(true);
          }
        }
        playGeoscapeSound(this.game().getMod(), "GEO.CAT", Mod.UFO_EXPLODE);
        if (++this._explosionCount === 3) {
          this._action = BaseDefenseActionType.BDA_END;
        }
        return;
      case BaseDefenseActionType.BDA_END:
        this._btnOk.setVisible(true);
        this._thinkcycles = -1;
        return;
      default:
        break;
    }

    if (this._attacks === this._defenses && this._passes === this._gravShields) {
      this._action = BaseDefenseActionType.BDA_END;
      return;
    } else if (this._attacks === this._defenses && this._passes < this._gravShields) {
      this._lstDefenses.addRow(3, String(this.tr("STR_GRAV_SHIELD_REPELS_UFO")), " ", " ");
      if (this._row > 14) {
        this._lstDefenses.scrollDown(true);
      }
      ++this._row;
      ++this._passes;
      this._attacks = 0;
      return;
    }

    const def = getDefenses(this._base)[this._attacks];
    if (!def) {
      this._action = BaseDefenseActionType.BDA_END;
      return;
    }

    switch (this._action) {
      case BaseDefenseActionType.BDA_NONE:
        this._lstDefenses.addRow(3, String(this.tr(def.getRules().getType())), " ", " ");
        ++this._row;
        this._action = BaseDefenseActionType.BDA_FIRE;
        if (this._row > 14) {
          this._lstDefenses.scrollDown(true);
        }
        return;
      case BaseDefenseActionType.BDA_FIRE:
        this._lstDefenses.setCellText(this._row, 1, String(this.tr("STR_FIRING")));
        playGeoscapeSound(this.game().getMod(), "GEO.CAT", def.getRules().getFireSound());
        this._timer.setInterval(333);
        this._action = BaseDefenseActionType.BDA_RESOLVE;
        return;
      case BaseDefenseActionType.BDA_RESOLVE:
        if (!RNG.percent(def.getRules().getHitRatio())) {
          this._lstDefenses.setCellText(this._row, 2, String(this.tr("STR_MISSED")));
        } else {
          this._lstDefenses.setCellText(this._row, 2, String(this.tr("STR_HIT")));
          playGeoscapeSound(this.game().getMod(), "GEO.CAT", def.getRules().getHitSound());
          const dmg = def.getRules().getDefenseValue();
          this._ufo.setDamage(this._ufo.getDamage() + (Math.trunc(dmg / 2) + RNG.generate(0, dmg)));
        }
        if (this._ufo.getStatus() === UfoStatus.DESTROYED) {
          this._action = BaseDefenseActionType.BDA_DESTROY;
        } else {
          this._action = BaseDefenseActionType.BDA_NONE;
        }
        ++this._attacks;
        this._timer.setInterval(250);
        return;
      default:
        break;
    }
  }

  /**
   * Returns to the previous screen.
   */
  btnOkClick(_action?: Action): void {
    this._timer.stop();
    this.game().popState();
    if (this._ufo.getStatus() !== UfoStatus.DESTROYED) {
      (this._state as GeoscapeBaseDefenseBoundary).handleBaseDefense?.(this._base, this._ufo);
    } else {
      (this._base as BaseWithDefenseBoundaries).cleanupDefenses?.(true);
    }
  }
}
