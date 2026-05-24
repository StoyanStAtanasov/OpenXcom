import { Options } from "../Engine/Options.ts";
import { State } from "../Engine/State.ts";
import { Timer } from "../Engine/Timer.ts";
import { TOK_COLOR_FLIP, formatFunding } from "../Engine/Unicode.ts";
import { InteractiveSurface } from "../Engine/InteractiveSurface.ts";
import type { Action } from "../Engine/Action.ts";
import { Text, ALIGN_BOTTOM, ALIGN_CENTER } from "../Interface/Text.ts";
import { TextButton } from "../Interface/TextButton.ts";
import { ToggleTextButton } from "../Interface/ToggleTextButton.ts";
import { Window, POPUP_BOTH } from "../Interface/Window.ts";
import { INT_MAX } from "../Mod/RuleInterface.ts";
import type { RuleManufacture } from "../Mod/RuleManufacture.ts";
import type { Base } from "../Savegame/Base.ts";
import { Production } from "../Savegame/Production.ts";
import { ErrorMessageState } from "../Menu/ErrorMessageState.ts";
import { SDL_BUTTON_LEFT, SDL_BUTTON_RIGHT, SDL_BUTTON_WHEELDOWN, SDL_BUTTON_WHEELUP } from "../types.ts";

const ARROW_BIG_UP = "ARROW_BIG_UP";
const ARROW_BIG_DOWN = "ARROW_BIG_DOWN";
const INFINITY = "\u221e";
const COLOR_FLIP = String.fromCharCode(TOK_COLOR_FLIP);

class ArrowButton extends InteractiveSurface {
  private _color = 0;

  constructor(private _shape: typeof ARROW_BIG_UP | typeof ARROW_BIG_DOWN, width: number, height: number, x = 0, y = 0) {
    super(width, height, x, y);
  }

  override setColor(color: number): void {
    this._color = color;
    this.invalidate();
  }

  override setSecondaryColor(color: number): void {
    this.setColor(color);
  }

  override draw(): void {
    super.draw();
    let color = (this._color || 1) + 2;
    let square = { x: 0, y: 0, w: this.getWidth() - 1, h: this.getHeight() - 1 };
    this.drawRect(square, color);
    square = { x: 1, y: 1, w: square.w, h: square.h };
    color = (this._color || 1) + 5;
    this.drawRect(square, color);
    square = { x: 1, y: 1, w: square.w - 1, h: square.h - 1 };
    color = (this._color || 1) + 4;
    this.drawRect(square, color);
    this.setPixel(0, 0, (this._color || 1) + 1);
    this.setPixel(0, this.getHeight() - 1, (this._color || 1) + 4);
    this.setPixel(this.getWidth() - 1, 0, (this._color || 1) + 4);
    color = (this._color || 1) + 1;
    if (this._shape === ARROW_BIG_UP) {
      this.drawRect(5, 8, 3, 3, color);
      let x = 2;
      let y = 7;
      for (let w = 9; w > 1; w -= 2) {
        this.drawRect(x, y, w, 1, color);
        x++;
        y--;
      }
      this.drawRect(x, y, 1, 1, color);
    } else {
      this.drawRect(5, 3, 3, 3, color);
      let x = 2;
      let y = 6;
      for (let w = 9; w > 1; w -= 2) {
        this.drawRect(x, y, w, 1, color);
        x++;
        y++;
      }
      this.drawRect(x, y, 1, 1, color);
    }
    if (this.isButtonPressed()) {
      this.invert(color + 3);
    }
  }
}

export class ManufactureInfoState extends State {
  private _item: RuleManufacture | null = null;
  private _production: Production | null = null;
  private _window!: Window;
  private _btnUnitUp!: ArrowButton;
  private _btnUnitDown!: ArrowButton;
  private _btnEngineerUp!: ArrowButton;
  private _btnEngineerDown!: ArrowButton;
  private _btnStop!: TextButton;
  private _btnOk!: TextButton;
  private _txtTitle!: Text;
  private _txtAvailableEngineer!: Text;
  private _txtAvailableSpace!: Text;
  private _txtMonthlyProfit!: Text;
  private _txtAllocatedEngineer!: Text;
  private _txtUnitToProduce!: Text;
  private _txtUnitUp!: Text;
  private _txtUnitDown!: Text;
  private _txtEngineerUp!: Text;
  private _txtEngineerDown!: Text;
  private _txtAllocated!: Text;
  private _txtTodo!: Text;
  private _btnSell!: ToggleTextButton;
  private _timerMoreEngineer!: Timer;
  private _timerMoreUnit!: Timer;
  private _timerLessEngineer!: Timer;
  private _timerLessUnit!: Timer;
  private _surfaceEngineers!: InteractiveSurface;
  private _surfaceUnits!: InteractiveSurface;
  private _producedItemsValue = 0;

  constructor(private _base: Base, itemOrProduction: RuleManufacture | Production) {
    super();
    if (itemOrProduction instanceof Production) {
      this._production = itemOrProduction;
    } else {
      this._item = itemOrProduction;
    }
    this.buildUi();
  }

  override think(): void {
    super.think();
    this._timerMoreEngineer.think(this, null);
    this._timerLessEngineer.think(this, null);
    this._timerMoreUnit.think(this, null);
    this._timerLessUnit.think(this, null);
  }

  initProfitInfo(): void {
    const mod = this.game().getMod();
    const item = this.production().getRules();

    this._producedItemsValue = 0;
    for (const [id, quantity] of item.getProducedItems()) {
      let sellValue = 0;
      if (item.getCategory() === "STR_CRAFT") {
        sellValue = mod?.getCraft(id)?.getSellCost() || 0;
      } else {
        sellValue = mod?.getItem(id, true)?.getSellCost() || 0;
      }
      this._producedItemsValue += sellValue * quantity;
    }
  }

  getMonthlyNetFunds(): number {
    const AVG_HOURS_PER_MONTH = Math.trunc((365 * 24) / 12);
    const item = this.production().getRules();
    const saleValue = this._btnSell.getPressed() ? this._producedItemsValue : 0;

    const numEngineers = this.production().getAssignedEngineers();
    let manHoursPerMonth = AVG_HOURS_PER_MONTH * numEngineers;
    if (!this.production().getInfiniteAmount()) {
      const manHoursRemaining = item.getManufactureTime() * (this.production().getAmountTotal() - this.production().getAmountProduced());
      manHoursPerMonth = Math.min(manHoursPerMonth, manHoursRemaining);
    }
    const manufactureTime = item.getManufactureTime();
    const itemsPerMonth = manufactureTime > 0 ? manHoursPerMonth / manufactureTime : 0;

    return Math.trunc((saleValue - item.getManufactureCost()) * itemsPerMonth);
  }

  btnSellClick(_action?: Action): void {
    this.setAssignedEngineer();
  }

  btnStopClick(_action?: Action): void {
    this.removeProduction(this.production());
    this.exitState();
  }

  btnOkClick(_action?: Action): void {
    const save = this.game().getSavedGame();
    const mod = this.game().getMod();
    if (this._item && save && mod) {
      this.production().startItem(this._base, save, mod);
    }
    this.production().setSellItems(this._btnSell.getPressed());
    this.exitState();
  }

  exitState(): void {
    this.game().popState();
    if (this._item) {
      this.game().popState();
    }
  }

  setAssignedEngineer(): void {
    this._txtAvailableEngineer.setText(String(this.tr("STR_ENGINEERS_AVAILABLE_UC").arg(this._base.getAvailableEngineers())));
    this._txtAvailableSpace.setText(String(this.tr("STR_WORKSHOP_SPACE_AVAILABLE_UC").arg(this._base.getFreeWorkshops())));
    this._txtAllocated.setText(`>${COLOR_FLIP}${this.production().getAssignedEngineers()}`);
    let todo = `>${COLOR_FLIP}`;
    if (this.production().getInfiniteAmount()) todo += INFINITY;
    else todo += `${this.production().getAmountTotal()}`;
    this._txtTodo.setText(todo);
    this._txtMonthlyProfit.setText(String(this.tr("STR_MONTHLY_PROFIT").arg(formatFunding(this.getMonthlyNetFunds()))));
  }

  moreEngineer(change: number): void {
    if (change <= 0) return;
    const availableEngineer = this._base.getAvailableEngineers();
    const availableWorkSpace = this._base.getFreeWorkshops();
    if (availableEngineer > 0 && availableWorkSpace > 0) {
      change = Math.min(Math.min(availableEngineer, availableWorkSpace), change);
      this.production().setAssignedEngineers(this.production().getAssignedEngineers() + change);
      this._base.setEngineers(this._base.getEngineers() - change);
      this.setAssignedEngineer();
    }
  }

  moreEngineerPress(action: Action): void {
    if (action.getDetails().button?.button === SDL_BUTTON_LEFT) this._timerMoreEngineer.start();
  }

  moreEngineerRelease(action: Action): void {
    if (action.getDetails().button?.button === SDL_BUTTON_LEFT) {
      this._timerMoreEngineer.setInterval(250);
      this._timerMoreEngineer.stop();
    }
  }

  moreEngineerClick(action: Action): void {
    if (action.getDetails().button?.button === SDL_BUTTON_RIGHT) this.moreEngineer(INT_MAX);
    if (action.getDetails().button?.button === SDL_BUTTON_LEFT) this.moreEngineer(1);
  }

  lessEngineer(change: number): void {
    if (change <= 0) return;
    const assigned = this.production().getAssignedEngineers();
    if (assigned > 0) {
      change = Math.min(assigned, change);
      this.production().setAssignedEngineers(assigned - change);
      this._base.setEngineers(this._base.getEngineers() + change);
      this.setAssignedEngineer();
    }
  }

  lessEngineerPress(action: Action): void {
    if (action.getDetails().button?.button === SDL_BUTTON_LEFT) this._timerLessEngineer.start();
  }

  lessEngineerRelease(action: Action): void {
    if (action.getDetails().button?.button === SDL_BUTTON_LEFT) {
      this._timerLessEngineer.setInterval(250);
      this._timerLessEngineer.stop();
    }
  }

  lessEngineerClick(action: Action): void {
    if (action.getDetails().button?.button === SDL_BUTTON_RIGHT) this.lessEngineer(INT_MAX);
    if (action.getDetails().button?.button === SDL_BUTTON_LEFT) this.lessEngineer(1);
  }

  moreUnit(change: number): void {
    if (change <= 0) return;
    if (this.production().getRules().getCategory() === "STR_CRAFT" && this._base.getAvailableHangars() - this._base.getUsedHangars() <= 0) {
      this._timerMoreUnit.stop();
      this.pushBasescapeError("STR_NO_FREE_HANGARS_FOR_CRAFT_PRODUCTION");
    } else {
      const units = this.production().getAmountTotal();
      change = Math.min(INT_MAX - units, change);
      if (this.production().getRules().getCategory() === "STR_CRAFT") {
        change = Math.min(this._base.getAvailableHangars() - this._base.getUsedHangars(), change);
      }
      this.production().setAmountTotal(units + change);
      this.setAssignedEngineer();
    }
  }

  moreUnitPress(action: Action): void {
    if (action.getDetails().button?.button === SDL_BUTTON_LEFT && this.production().getAmountTotal() < INT_MAX) {
      this._timerMoreUnit.start();
    }
  }

  moreUnitRelease(action: Action): void {
    if (action.getDetails().button?.button === SDL_BUTTON_LEFT) {
      this._timerMoreUnit.setInterval(250);
      this._timerMoreUnit.stop();
    }
  }

  moreUnitClick(action: Action): void {
    if (this.production().getInfiniteAmount()) return;
    if (action.getDetails().button?.button === SDL_BUTTON_RIGHT) {
      if (this.production().getRules().getCategory() === "STR_CRAFT") {
        this.moreUnit(INT_MAX);
      } else {
        this.production().setInfiniteAmount(true);
        this.setAssignedEngineer();
      }
    } else if (action.getDetails().button?.button === SDL_BUTTON_LEFT) {
      this.moreUnit(1);
    }
  }

  lessUnit(change: number): void {
    if (change <= 0) return;
    const units = this.production().getAmountTotal();
    change = Math.min(units - (this.production().getAmountProduced() + 1), change);
    this.production().setAmountTotal(units - change);
    this.setAssignedEngineer();
  }

  lessUnitPress(action: Action): void {
    if (action.getDetails().button?.button === SDL_BUTTON_LEFT) this._timerLessUnit.start();
  }

  lessUnitRelease(action: Action): void {
    if (action.getDetails().button?.button === SDL_BUTTON_LEFT) {
      this._timerLessUnit.setInterval(250);
      this._timerLessUnit.stop();
    }
  }

  lessUnitClick(action: Action): void {
    if (action.getDetails().button?.button === SDL_BUTTON_RIGHT || action.getDetails().button?.button === SDL_BUTTON_LEFT) {
      this.production().setInfiniteAmount(false);
      if (
        action.getDetails().button?.button === SDL_BUTTON_RIGHT ||
        this.production().getAmountTotal() <= this.production().getAmountProduced()
      ) {
        this.production().setAmountTotal(this.production().getAmountProduced() + 1);
        this.setAssignedEngineer();
      }
      if (action.getDetails().button?.button === SDL_BUTTON_LEFT) this.lessUnit(1);
    }
  }

  onMoreEngineer(): void {
    this._timerMoreEngineer.setInterval(50);
    this.moreEngineer(1);
  }

  onLessEngineer(): void {
    this._timerLessEngineer.setInterval(50);
    this.lessEngineer(1);
  }

  handleWheelEngineer(action: Action): void {
    if (action.getDetails().button?.button === SDL_BUTTON_WHEELUP) this.moreEngineer(Options.changeValueByMouseWheel);
    else if (action.getDetails().button?.button === SDL_BUTTON_WHEELDOWN) this.lessEngineer(Options.changeValueByMouseWheel);
  }

  onMoreUnit(): void {
    this._timerMoreUnit.setInterval(50);
    this.moreUnit(1);
  }

  onLessUnit(): void {
    this._timerLessUnit.setInterval(50);
    this.lessUnit(1);
  }

  handleWheelUnit(action: Action): void {
    if (action.getDetails().button?.button === SDL_BUTTON_WHEELUP) this.moreUnit(Options.changeValueByMouseWheel);
    else if (action.getDetails().button?.button === SDL_BUTTON_WHEELDOWN) this.lessUnit(Options.changeValueByMouseWheel);
  }

  buildUi(): void {
    this._screen = false;

    this._window = new Window(this, 320, 160, 0, 20, POPUP_BOTH);
    this._txtTitle = new Text(320, 17, 0, 30);
    this._btnOk = new TextButton(136, 16, 168, 155);
    this._btnStop = new TextButton(136, 16, 16, 155);
    this._btnSell = new ToggleTextButton(60, 16, 244, 61);
    this._txtAvailableEngineer = new Text(160, 9, 16, 50);
    this._txtAvailableSpace = new Text(160, 9, 16, 60);
    this._txtMonthlyProfit = new Text(160, 9, 168, 50);
    this._txtAllocatedEngineer = new Text(112, 32, 16, 80);
    this._txtUnitToProduce = new Text(112, 48, 168, 64);
    this._txtEngineerUp = new Text(90, 9, 40, 118);
    this._txtEngineerDown = new Text(90, 9, 40, 138);
    this._txtUnitUp = new Text(90, 9, 192, 118);
    this._txtUnitDown = new Text(90, 9, 192, 138);
    this._btnEngineerUp = new ArrowButton(ARROW_BIG_UP, 13, 14, 132, 114);
    this._btnEngineerDown = new ArrowButton(ARROW_BIG_DOWN, 13, 14, 132, 136);
    this._btnUnitUp = new ArrowButton(ARROW_BIG_UP, 13, 14, 284, 114);
    this._btnUnitDown = new ArrowButton(ARROW_BIG_DOWN, 13, 14, 284, 136);
    this._txtAllocated = new Text(40, 16, 128, 88);
    this._txtTodo = new Text(40, 16, 280, 88);

    this._surfaceEngineers = new InteractiveSurface(160, 150, 0, 25);
    this._surfaceEngineers.onMouseClick(this.handleWheelEngineer.bind(this), 0);

    this._surfaceUnits = new InteractiveSurface(160, 150, 160, 25);
    this._surfaceUnits.onMouseClick(this.handleWheelUnit.bind(this), 0);

    this.setInterface("manufactureInfo");

    this.add(this._surfaceEngineers);
    this.add(this._surfaceUnits);
    this.add(this._window, "window", "manufactureInfo");
    this.add(this._txtTitle, "text", "manufactureInfo");
    this.add(this._txtAvailableEngineer, "text", "manufactureInfo");
    this.add(this._txtAvailableSpace, "text", "manufactureInfo");
    this.add(this._txtMonthlyProfit, "text", "manufactureInfo");
    this.add(this._txtAllocatedEngineer, "text", "manufactureInfo");
    this.add(this._txtAllocated, "text", "manufactureInfo");
    this.add(this._txtUnitToProduce, "text", "manufactureInfo");
    this.add(this._txtTodo, "text", "manufactureInfo");
    this.add(this._txtEngineerUp, "text", "manufactureInfo");
    this.add(this._txtEngineerDown, "text", "manufactureInfo");
    this.add(this._btnEngineerUp, "button1", "manufactureInfo");
    this.add(this._btnEngineerDown, "button1", "manufactureInfo");
    this.add(this._txtUnitUp, "text", "manufactureInfo");
    this.add(this._txtUnitDown, "text", "manufactureInfo");
    this.add(this._btnUnitUp, "button1", "manufactureInfo");
    this.add(this._btnUnitDown, "button1", "manufactureInfo");
    this.add(this._btnOk, "button2", "manufactureInfo");
    this.add(this._btnStop, "button2", "manufactureInfo");
    this.add(this._btnSell, "button1", "manufactureInfo");

    this.centerAllSurfaces();

    const background = this.game().getMod()?.getSurface("BACK17.SCR");
    if (background) {
      this._window.setBackground(background);
    }

    this._txtTitle.setText(String(this.tr(this._item ? this._item.getName() : this.production().getRules().getName())));
    this._txtTitle.setBig();
    this._txtTitle.setAlign(ALIGN_CENTER);

    this._txtAllocatedEngineer.setText(String(this.tr("STR_ENGINEERS__ALLOCATED")));
    this._txtAllocatedEngineer.setBig();
    this._txtAllocatedEngineer.setWordWrap(true);
    this._txtAllocatedEngineer.setVerticalAlign(ALIGN_BOTTOM);

    this._txtAllocated.setBig();
    this._txtTodo.setBig();

    this._txtUnitToProduce.setText(String(this.tr("STR_UNITS_TO_PRODUCE")));
    this._txtUnitToProduce.setBig();
    this._txtUnitToProduce.setWordWrap(true);
    this._txtUnitToProduce.setVerticalAlign(ALIGN_BOTTOM);

    this._txtEngineerUp.setText(String(this.tr("STR_INCREASE_UC")));
    this._txtEngineerDown.setText(String(this.tr("STR_DECREASE_UC")));

    this._btnEngineerUp.onMousePress(this.moreEngineerPress.bind(this));
    this._btnEngineerUp.onMouseRelease(this.moreEngineerRelease.bind(this));
    this._btnEngineerUp.onMouseClick(this.moreEngineerClick.bind(this), 0);

    this._btnEngineerDown.onMousePress(this.lessEngineerPress.bind(this));
    this._btnEngineerDown.onMouseRelease(this.lessEngineerRelease.bind(this));
    this._btnEngineerDown.onMouseClick(this.lessEngineerClick.bind(this), 0);

    this._btnUnitUp.onMousePress(this.moreUnitPress.bind(this));
    this._btnUnitUp.onMouseRelease(this.moreUnitRelease.bind(this));
    this._btnUnitUp.onMouseClick(this.moreUnitClick.bind(this), 0);

    this._btnUnitDown.onMousePress(this.lessUnitPress.bind(this));
    this._btnUnitDown.onMouseRelease(this.lessUnitRelease.bind(this));
    this._btnUnitDown.onMouseClick(this.lessUnitClick.bind(this), 0);

    this._txtUnitUp.setText(String(this.tr("STR_INCREASE_UC")));
    this._txtUnitDown.setText(String(this.tr("STR_DECREASE_UC")));

    this._btnSell.setText(String(this.tr("STR_SELL_PRODUCTION")));
    this._btnSell.onMouseClick(this.btnSellClick.bind(this), 0);

    this._btnOk.setText(String(this.tr("STR_OK")));
    this._btnOk.onMouseClick(this.btnOkClick.bind(this));
    this._btnOk.onKeyboardPress(this.btnOkClick.bind(this), Options.keyOk);
    this._btnOk.onKeyboardPress(this.btnOkClick.bind(this), Options.keyCancel);

    this._btnStop.setText(String(this.tr("STR_STOP_PRODUCTION")));
    this._btnStop.onMouseClick(this.btnStopClick.bind(this));
    if (!this._production && this._item) {
      this._production = new Production(this._item, 1);
      this._base.getProductions().push(this._production);
    }
    this._btnSell.setPressed(this.production().getSellItems());
    this.initProfitInfo();
    this.setAssignedEngineer();

    this._timerMoreEngineer = new Timer(250);
    this._timerLessEngineer = new Timer(250);
    this._timerMoreUnit = new Timer(250);
    this._timerLessUnit = new Timer(250);
    this._timerMoreEngineer.onTimer(this.onMoreEngineer.bind(this));
    this._timerLessEngineer.onTimer(this.onLessEngineer.bind(this));
    this._timerMoreUnit.onTimer(this.onMoreUnit.bind(this));
    this._timerLessUnit.onTimer(this.onLessUnit.bind(this));
  }

  private production(): Production {
    if (!this._production) {
      throw new Error("ManufactureInfoState production is not initialized.");
    }
    return this._production;
  }

  private removeProduction(production: Production): void {
    const productions = this._base.getProductions();
    const index = productions.indexOf(production);
    if (index !== -1) {
      productions.splice(index, 1);
    }
  }

  private pushBasescapeError(message: string): void {
    const menuInterface = this.game().getMod()?.getInterface("basescape");
    this.game().pushState(new ErrorMessageState(
      String(this.tr(message)),
      this._palette,
      menuInterface?.getElement("errorMessage")?.color || 1,
      "BACK17.SCR",
      menuInterface?.getElement("errorPalette")?.color ?? -1
    ));
  }
}
