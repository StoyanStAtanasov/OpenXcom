import { Options } from "../Engine/Options.ts";
import { RNG } from "../Engine/RNG.ts";
import { State } from "../Engine/State.ts";
import { Timer } from "../Engine/Timer.ts";
import type { Action } from "../Engine/Action.ts";
import { InteractiveSurface } from "../Engine/InteractiveSurface.ts";
import { Text } from "../Interface/Text.ts";
import { TextButton } from "../Interface/TextButton.ts";
import { Window } from "../Interface/Window.ts";
import type { RuleResearch } from "../Mod/RuleResearch.ts";
import { INT_MAX } from "../Mod/RuleInterface.ts";
import type { Base } from "../Savegame/Base.ts";
import { ResearchProject } from "../Savegame/ResearchProject.ts";
import { SDL_BUTTON_LEFT, SDL_BUTTON_RIGHT, SDL_BUTTON_WHEELDOWN, SDL_BUTTON_WHEELUP } from "../types.ts";

const ARROW_BIG_UP = "ARROW_BIG_UP";
const ARROW_BIG_DOWN = "ARROW_BIG_DOWN";
type ArrowShape = typeof ARROW_BIG_UP | typeof ARROW_BIG_DOWN;

class ArrowButton extends InteractiveSurface {
  private _color = 0;

  constructor(private _shape: ArrowShape, width: number, height: number, x = 0, y = 0) {
    super(width, height, x, y);
  }

  override setColor(color: number): void {
    this._color = color;
    this.invalidate();
  }

  override setSecondaryColor(color: number): void {
    this._color = color;
    this.invalidate();
  }

  override draw(): void {
    super.draw();
    const color = this._color || 1;
    const cx = Math.trunc(this.getWidth() / 2);
    if (this._shape === ARROW_BIG_UP) {
      this.drawLine(cx, 1, 1, this.getHeight() - 2, color);
      this.drawLine(cx, 1, this.getWidth() - 2, this.getHeight() - 2, color);
      this.drawLine(1, this.getHeight() - 2, this.getWidth() - 2, this.getHeight() - 2, color);
    } else {
      this.drawLine(1, 1, this.getWidth() - 2, 1, color);
      this.drawLine(1, 1, cx, this.getHeight() - 2, color);
      this.drawLine(this.getWidth() - 2, 1, cx, this.getHeight() - 2, color);
    }
    if (this.isButtonPressed()) {
      this.invert(color + 3);
    }
  }
}

export class ResearchInfoState extends State {
  private _btnOk!: TextButton;
  private _btnCancel!: TextButton;
  private _btnMore!: ArrowButton;
  private _btnLess!: ArrowButton;
  private _window!: Window;
  private _txtTitle!: Text;
  private _txtAvailableScientist!: Text;
  private _txtAvailableSpace!: Text;
  private _txtAllocatedScientist!: Text;
  private _txtMore!: Text;
  private _txtLess!: Text;
  private _project: ResearchProject;
  private _rule: RuleResearch | null;
  private _timerMore!: Timer;
  private _timerLess!: Timer;
  private _surfaceScientists!: InteractiveSurface;

  constructor(base: Base, rule: RuleResearch);
  constructor(base: Base, project: ResearchProject);
  constructor(private _base: Base, ruleOrProject: RuleResearch | ResearchProject) {
    super();
    if (ruleOrProject instanceof ResearchProject) {
      this._project = ruleOrProject;
      this._rule = null;
    } else {
      const rule = ruleOrProject;
      this._rule = rule;
      this._project = new ResearchProject(rule, Math.trunc(rule.getCost() * RNG.generate(50, 150) / 100));
    }
    this.buildUi();
  }

  private buildUi(): void {
    this._screen = false;

    this._window = new Window(this, 230, 140, 45, 30);
    this._txtTitle = new Text(210, 17, 61, 40);

    this._txtAvailableScientist = new Text(210, 9, 61, 60);
    this._txtAvailableSpace = new Text(210, 9, 61, 70);
    this._txtAllocatedScientist = new Text(210, 17, 61, 80);
    this._txtMore = new Text(110, 17, 85, 100);
    this._txtLess = new Text(110, 17, 85, 120);
    this._btnCancel = new TextButton(90, 16, 61, 145);
    this._btnOk = new TextButton(90, 16, 169, 145);

    this._btnMore = new ArrowButton(ARROW_BIG_UP, 13, 14, 195, 100);
    this._btnLess = new ArrowButton(ARROW_BIG_DOWN, 13, 14, 195, 120);

    this._surfaceScientists = new InteractiveSurface(230, 140, 45, 30);
    this._surfaceScientists.onMouseClick(this.handleWheel.bind(this), 0);

    this.setInterface("allocateResearch");

    this.add(this._surfaceScientists);
    this.add(this._window, "window", "allocateResearch");
    this.add(this._btnOk, "button2", "allocateResearch");
    this.add(this._btnCancel, "button2", "allocateResearch");
    this.add(this._txtTitle, "text", "allocateResearch");
    this.add(this._txtAvailableScientist, "text", "allocateResearch");
    this.add(this._txtAvailableSpace, "text", "allocateResearch");
    this.add(this._txtAllocatedScientist, "text", "allocateResearch");
    this.add(this._txtMore, "text", "allocateResearch");
    this.add(this._txtLess, "text", "allocateResearch");
    this.add(this._btnMore, "button1", "allocateResearch");
    this.add(this._btnLess, "button1", "allocateResearch");

    this.centerAllSurfaces();

    const back05 = this.game().getMod()?.getSurface("BACK05.SCR");
    if (back05) {
      this._window.setBackground(back05);
    }

    this._txtTitle.setBig();
    this._txtTitle.setText(String(this.tr(this._rule ? this._rule.getName() : this._project.getRules().getName())));

    this._txtAllocatedScientist.setBig();

    this._txtMore.setText(String(this.tr("STR_INCREASE")));
    this._txtLess.setText(String(this.tr("STR_DECREASE")));

    this._txtMore.setBig();
    this._txtLess.setBig();

    if (this._rule) {
      (this._base.getResearch() as ResearchProject[]).push(this._project);
      if (this._rule.needItem() && this._rule.destroyItem()) {
        this._base.getStorageItems().removeItem(this._rule.getName(), 1);
      }
    }
    this.setAssignedScientist();
    this._btnMore.onMousePress(this.morePress.bind(this));
    this._btnMore.onMouseRelease(this.moreRelease.bind(this));
    this._btnMore.onMouseClick(this.moreClick.bind(this), 0);
    this._btnLess.onMousePress(this.lessPress.bind(this));
    this._btnLess.onMouseRelease(this.lessRelease.bind(this));
    this._btnLess.onMouseClick(this.lessClick.bind(this), 0);

    this._timerMore = new Timer(250);
    this._timerMore.onTimer(this.more.bind(this));
    this._timerLess = new Timer(250);
    this._timerLess.onTimer(this.less.bind(this));

    this._btnOk.onMouseClick(this.btnOkClick.bind(this));
    this._btnOk.onKeyboardPress(this.btnOkClick.bind(this), Options.keyOk);
    if (this._rule) {
      this._btnOk.setText(String(this.tr("STR_START_PROJECT")));
      this._btnCancel.setText(String(this.tr("STR_CANCEL_UC")));
      this._btnCancel.onKeyboardPress(this.btnCancelClick.bind(this), Options.keyCancel);
    } else {
      this._btnOk.setText(String(this.tr("STR_OK")));
      this._btnCancel.setText(String(this.tr("STR_CANCEL_PROJECT")));
      this._btnOk.onKeyboardPress(this.btnOkClick.bind(this), Options.keyCancel);
    }
    this._btnCancel.onMouseClick(this.btnCancelClick.bind(this));
  }

  btnOkClick(_action?: Action): void {
    this.game().popState();
  }

  btnCancelClick(_action?: Action): void {
    const projects = this._base.getResearch() as ResearchProject[];
    const index = projects.indexOf(this._project);
    if (index !== -1) {
      projects.splice(index, 1);
    }
    this.game().popState();
  }

  private setAssignedScientist(): void {
    this._txtAvailableScientist.setText(String(this.tr("STR_SCIENTISTS_AVAILABLE_UC").arg(this._base.getAvailableScientists())));
    this._txtAvailableSpace.setText(String(this.tr("STR_LABORATORY_SPACE_AVAILABLE_UC").arg(this._base.getFreeLaboratories())));
    this._txtAllocatedScientist.setText(String(this.tr("STR_SCIENTISTS_ALLOCATED").arg(this._project.getAssigned())));
  }

  handleWheel(action: Action): void {
    if (action.getDetails().button?.button === SDL_BUTTON_WHEELUP) {
      this.moreByValue(Options.changeValueByMouseWheel);
    } else if (action.getDetails().button?.button === SDL_BUTTON_WHEELDOWN) {
      this.lessByValue(Options.changeValueByMouseWheel);
    }
  }

  morePress(action: Action): void {
    if (action.getDetails().button?.button === SDL_BUTTON_LEFT) {
      this._timerMore.start();
    }
  }

  moreRelease(action: Action): void {
    if (action.getDetails().button?.button === SDL_BUTTON_LEFT) {
      this._timerMore.setInterval(250);
      this._timerMore.stop();
    }
  }

  moreClick(action: Action): void {
    if (action.getDetails().button?.button === SDL_BUTTON_RIGHT) {
      this.moreByValue(INT_MAX);
    }
    if (action.getDetails().button?.button === SDL_BUTTON_LEFT) {
      this.moreByValue(1);
    }
  }

  lessPress(action: Action): void {
    if (action.getDetails().button?.button === SDL_BUTTON_LEFT) {
      this._timerLess.start();
    }
  }

  lessRelease(action: Action): void {
    if (action.getDetails().button?.button === SDL_BUTTON_LEFT) {
      this._timerLess.setInterval(250);
      this._timerLess.stop();
    }
  }

  lessClick(action: Action): void {
    if (action.getDetails().button?.button === SDL_BUTTON_RIGHT) {
      this.lessByValue(INT_MAX);
    }
    if (action.getDetails().button?.button === SDL_BUTTON_LEFT) {
      this.lessByValue(1);
    }
  }

  more(): void {
    this._timerMore.setInterval(50);
    this.moreByValue(1);
  }

  moreByValue(change: number): void {
    if (change <= 0) {
      return;
    }
    const freeScientist = this._base.getAvailableScientists();
    const freeSpaceLab = this._base.getFreeLaboratories();
    if (freeScientist > 0 && freeSpaceLab > 0) {
      change = Math.min(freeScientist, freeSpaceLab, change);
      this._project.setAssigned(this._project.getAssigned() + change);
      this._base.setScientists(this._base.getScientists() - change);
      this.setAssignedScientist();
    }
  }

  less(): void {
    this._timerLess.setInterval(50);
    this.lessByValue(1);
  }

  lessByValue(change: number): void {
    if (change <= 0) {
      return;
    }
    const assigned = this._project.getAssigned();
    if (assigned > 0) {
      change = Math.min(assigned, change);
      this._project.setAssigned(assigned - change);
      this._base.setScientists(this._base.getScientists() + change);
      this.setAssignedScientist();
    }
  }

  override think(): void {
    super.think();

    this._timerLess.think(this, null);
    this._timerMore.think(this, null);
  }
}
