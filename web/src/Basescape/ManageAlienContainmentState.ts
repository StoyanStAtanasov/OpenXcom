import { Options } from "../Engine/Options.ts";
import { State } from "../Engine/State.ts";
import { Timer } from "../Engine/Timer.ts";
import type { Action } from "../Engine/Action.ts";
import { Text, ALIGN_BOTTOM, ALIGN_CENTER } from "../Interface/Text.ts";
import { TextButton } from "../Interface/TextButton.ts";
import { ARROW_HORIZONTAL, TextList } from "../Interface/TextList.ts";
import { Window } from "../Interface/Window.ts";
import { ErrorMessageState } from "../Menu/ErrorMessageState.ts";
import { OPT_BATTLESCAPE, type OptionsOrigin } from "../Menu/OptionsBaseState.ts";
import { INT_MAX } from "../Mod/RuleInterface.ts";
import type { RuleResearch } from "../Mod/RuleResearch.ts";
import type { Base } from "../Savegame/Base.ts";
import { SDL_BUTTON_LEFT, SDL_BUTTON_RIGHT, SDL_BUTTON_WHEELDOWN, SDL_BUTTON_WHEELUP } from "../types.ts";
import { SellState } from "./SellState.ts";

/**
 * ManageAlienContainment screen that lets the player manage
 * alien numbers in a particular base.
 */
export class ManageAlienContainmentState extends State {
  private _btnOk: TextButton;
  private _btnCancel: TextButton;
  private _window: Window;
  private _txtTitle: Text;
  private _txtUsed: Text;
  private _txtAvailable: Text;
  private _txtItem: Text;
  private _txtLiveAliens: Text;
  private _txtDeadAliens: Text;
  private _txtInterrogatedAliens: Text;
  private _lstAliens: TextList;
  private _timerInc: Timer;
  private _timerDec: Timer;
  private _qtys: number[] = [];
  private _aliens: string[] = [];
  private _sel = 0;
  private _aliensSold = 0;

  /**
   * Creates the ManageAlienContainment state.
   */
  constructor(private _base: Base, private _origin: OptionsOrigin) {
    super();

    const overCrowded = Options.storageLimitsEnforced && this._base.getFreeContainment() < 0;
    const researchList: string[] = [];
    const mod = this.game().getMod();
    for (const project of this._base.getResearch()) {
      const research = project.getRules() as RuleResearch;
      const item = mod?.getItem(research.getName());
      if (item && item.isAlien()) {
        researchList.push(research.getName());
      }
    }

    this._window = new Window(this, 320, 200, 0, 0);
    this._btnOk = new TextButton(overCrowded ? 288 : 148, 16, overCrowded ? 16 : 8, 176);
    this._btnCancel = new TextButton(148, 16, 164, 176);
    this._txtTitle = new Text(310, 17, 5, 8);
    this._txtAvailable = new Text(190, 9, 10, 24);
    this._txtUsed = new Text(110, 9, 136, 24);
    this._txtItem = new Text(120, 9, 10, 41);
    this._txtLiveAliens = new Text(54, 18, 153, 32);
    this._txtDeadAliens = new Text(54, 18, 207, 32);
    this._txtInterrogatedAliens = new Text(54, 18, 261, 32);
    this._lstAliens = new TextList(286, 112, 8, 53);

    this.setInterface("manageContainment");

    this.add(this._window, "window", "manageContainment");
    this.add(this._btnOk, "button", "manageContainment");
    this.add(this._btnCancel, "button", "manageContainment");
    this.add(this._txtTitle, "text", "manageContainment");
    this.add(this._txtAvailable, "text", "manageContainment");
    this.add(this._txtUsed, "text", "manageContainment");
    this.add(this._txtItem, "text", "manageContainment");
    this.add(this._txtLiveAliens, "text", "manageContainment");
    this.add(this._txtDeadAliens, "text", "manageContainment");
    this.add(this._txtInterrogatedAliens, "text", "manageContainment");
    this.add(this._lstAliens, "list", "manageContainment");

    this.centerAllSurfaces();

    const background = mod?.getSurface(this._origin === OPT_BATTLESCAPE ? "BACK01.SCR" : "BACK05.SCR");
    if (background) {
      this._window.setBackground(background);
    }

    this._btnOk.setText(String(this.tr("STR_REMOVE_SELECTED")));
    this._btnOk.onMouseClick(this.btnOkClick.bind(this));
    this._btnOk.onKeyboardPress(this.btnOkClick.bind(this), Options.keyOk);

    this._btnCancel.setText(String(this.tr("STR_CANCEL")));
    this._btnCancel.onMouseClick(this.btnCancelClick.bind(this));
    this._btnCancel.onKeyboardPress(this.btnCancelClick.bind(this), Options.keyCancel);

    if (overCrowded) {
      this._btnCancel.setVisible(false);
      this._btnOk.setVisible(false);
    }

    this._txtTitle.setBig();
    this._txtTitle.setAlign(ALIGN_CENTER);
    this._txtTitle.setText(String(this.tr("STR_MANAGE_CONTAINMENT")));

    this._txtItem.setText(String(this.tr("STR_ALIEN")));

    this._txtLiveAliens.setText(String(this.tr("STR_LIVE_ALIENS")));
    this._txtLiveAliens.setWordWrap(true);
    this._txtLiveAliens.setVerticalAlign(ALIGN_BOTTOM);

    this._txtDeadAliens.setText(String(this.tr("STR_DEAD_ALIENS")));
    this._txtDeadAliens.setWordWrap(true);
    this._txtDeadAliens.setVerticalAlign(ALIGN_BOTTOM);

    this._txtInterrogatedAliens.setText(String(this.tr("STR_UNDER_INTERROGATION")));
    this._txtInterrogatedAliens.setWordWrap(true);
    this._txtInterrogatedAliens.setVerticalAlign(ALIGN_BOTTOM);

    this._txtAvailable.setText(String(this.tr("STR_SPACE_AVAILABLE").arg(this._base.getFreeContainment())));

    this._txtUsed.setText(String(this.tr("STR_SPACE_USED").arg(this._base.getUsedContainment())));

    this._lstAliens.setArrowColumn(184, ARROW_HORIZONTAL);
    this._lstAliens.setColumns(4, 160, 64, 46, 46);
    this._lstAliens.setSelectable(true);
    this._lstAliens.setBackground(this._window);
    this._lstAliens.setMargin(2);
    this._lstAliens.onLeftArrowPress(this.lstItemsLeftArrowPress.bind(this));
    this._lstAliens.onLeftArrowRelease(this.lstItemsLeftArrowRelease.bind(this));
    this._lstAliens.onLeftArrowClick(this.lstItemsLeftArrowClick.bind(this));
    this._lstAliens.onRightArrowPress(this.lstItemsRightArrowPress.bind(this));
    this._lstAliens.onRightArrowRelease(this.lstItemsRightArrowRelease.bind(this));
    this._lstAliens.onRightArrowClick(this.lstItemsRightArrowClick.bind(this));
    this._lstAliens.onMousePress(this.lstItemsMousePress.bind(this));

    for (const type of mod?.getItemsList() || []) {
      const qty = this._base.getStorageItems().getItem(type);
      if (qty > 0 && mod?.getItem(type, true)?.isAlien()) {
        this._qtys.push(0);
        this._aliens.push(type);
        const research = researchList.indexOf(type);
        let rqty: string;
        if (research !== -1) {
          rqty = "1";
          researchList.splice(research, 1);
        } else {
          rqty = "0";
        }
        this._lstAliens.addRow(4, String(this.tr(type)), `${qty}`, "0", rqty);
      }
    }

    for (const type of researchList) {
      this._aliens.push(type);
      this._qtys.push(0);
      this._lstAliens.addRow(4, String(this.tr(type)), "0", "0", "1");
      this._lstAliens.setRowColor(this._qtys.length - 1, this._lstAliens.getSecondaryColor());
    }

    this._timerInc = new Timer(250);
    this._timerInc.onTimer(this.increase.bind(this));
    this._timerDec = new Timer(250);
    this._timerDec.onTimer(this.decrease.bind(this));
  }

  /**
   * Runs the arrow timers.
   */
  override think(): void {
    super.think();

    this._timerInc.think(this, null);
    this._timerDec.think(this, null);
  }

  /**
   * Deals with the selected aliens.
   */
  btnOkClick(_action?: Action): void {
    const mod = this.game().getMod();
    const save = this.game().getSavedGame();
    if (!mod) {
      this.game().popState();
      return;
    }

    for (let i = 0; i < this._qtys.length; ++i) {
      if (this._qtys[i] > 0) {
        this._base.getStorageItems().removeItem(this._aliens[i], this._qtys[i]);

        if (Options.canSellLiveAliens) {
          save?.setFunds((save.getFunds()) + (mod.getItem(this._aliens[i], true)?.getSellCost() || 0) * this._qtys[i]);
        } else {
          const unit = mod.getUnit(this._aliens[i], true);
          const armor = unit ? mod.getArmor(unit.getArmor()) : null;
          if (!armor) {
            throw new Error(`Armor rule ${unit?.getArmor() || ""} not found.`);
          }
          this._base.getStorageItems().addItem(armor.getCorpseGeoscape(), this._qtys[i]);
        }
      }
    }
    this.game().popState();

    if (Options.storageLimitsEnforced && this._base.storesOverfull()) {
      this.game().pushState(new SellState(this._base, this._origin));
      const menuInterface = mod.getInterface("manageContainment");
      this.game().pushState(new ErrorMessageState(
        String(this.tr("STR_STORAGE_EXCEEDED").arg(this._base.getName())),
        this._palette,
        menuInterface?.getElement("errorMessage")?.color || 1,
        this._origin === OPT_BATTLESCAPE ? "BACK01.SCR" : "BACK13.SCR",
        menuInterface?.getElement("errorPalette")?.color ?? -1
      ));
    }
  }

  /**
   * Returns to the previous screen.
   */
  btnCancelClick(_action?: Action): void {
    this.game().popState();
  }

  /**
   * Starts increasing the alien count.
   */
  lstItemsRightArrowPress(action: Action): void {
    this._sel = this._lstAliens.getSelectedRow();
    if (action.getDetails().button?.button === SDL_BUTTON_LEFT && !this._timerInc.isRunning()) {
      this._timerInc.start();
    }
  }

  /**
   * Stops increasing the alien count.
   */
  lstItemsRightArrowRelease(action: Action): void {
    if (action.getDetails().button?.button === SDL_BUTTON_LEFT) {
      this._timerInc.stop();
    }
  }

  /**
   * Increases the selected alien count;
   * by one on left-click, to max on right-click.
   */
  lstItemsRightArrowClick(action: Action): void {
    if (action.getDetails().button?.button === SDL_BUTTON_RIGHT) {
      this.increaseByValue(INT_MAX);
    }
    if (action.getDetails().button?.button === SDL_BUTTON_LEFT) {
      this.increaseByValue(1);
      this._timerInc.setInterval(250);
      this._timerDec.setInterval(250);
    }
  }

  /**
   * Starts decreasing the alien count.
   */
  lstItemsLeftArrowPress(action: Action): void {
    this._sel = this._lstAliens.getSelectedRow();
    if (action.getDetails().button?.button === SDL_BUTTON_LEFT && !this._timerDec.isRunning()) {
      this._timerDec.start();
    }
  }

  /**
   * Stops decreasing the alien count.
   */
  lstItemsLeftArrowRelease(action: Action): void {
    if (action.getDetails().button?.button === SDL_BUTTON_LEFT) {
      this._timerDec.stop();
    }
  }

  /**
   * Decreases the selected alien count;
   * by one on left-click, to 0 on right-click.
   */
  lstItemsLeftArrowClick(action: Action): void {
    if (action.getDetails().button?.button === SDL_BUTTON_RIGHT) {
      this.decreaseByValue(INT_MAX);
    }
    if (action.getDetails().button?.button === SDL_BUTTON_LEFT) {
      this.decreaseByValue(1);
      this._timerInc.setInterval(250);
      this._timerDec.setInterval(250);
    }
  }

  /**
   * Handles the mouse-wheels on the arrow-buttons.
   */
  lstItemsMousePress(action: Action): void {
    this._sel = this._lstAliens.getSelectedRow();
    if (action.getDetails().button?.button === SDL_BUTTON_WHEELUP) {
      this._timerInc.stop();
      this._timerDec.stop();
      if (action.getAbsoluteXMouse() >= this._lstAliens.getArrowsLeftEdge() &&
        action.getAbsoluteXMouse() <= this._lstAliens.getArrowsRightEdge()) {
        this.increaseByValue(Options.changeValueByMouseWheel);
      }
    } else if (action.getDetails().button?.button === SDL_BUTTON_WHEELDOWN) {
      this._timerInc.stop();
      this._timerDec.stop();
      if (action.getAbsoluteXMouse() >= this._lstAliens.getArrowsLeftEdge() &&
        action.getAbsoluteXMouse() <= this._lstAliens.getArrowsRightEdge()) {
        this.decreaseByValue(Options.changeValueByMouseWheel);
      }
    }
  }

  /**
   * Increases the quantity of an alien by one.
   */
  increase(): void {
    this._timerDec.setInterval(50);
    this._timerInc.setInterval(50);
    this.increaseByValue(1);
  }

  /**
   * Increases the quantity of an alien by the given value.
   */
  increaseByValue(change: number): void {
    let qty = this.getQuantity() - this._qtys[this._sel];
    if (change <= 0 || qty <= 0) {
      return;
    }

    change = Math.min(qty, change);
    this._qtys[this._sel] += change;
    this._aliensSold += change;
    this.updateStrings();
  }

  /**
   * Decreases the quantity of an alien by one.
   */
  decrease(): void {
    this._timerInc.setInterval(50);
    this._timerDec.setInterval(50);
    this.decreaseByValue(1);
  }

  /**
   * Decreases the quantity of an alien by the given value.
   */
  decreaseByValue(change: number): void {
    if (change <= 0 || this._qtys[this._sel] <= 0) {
      return;
    }
    change = Math.min(this._qtys[this._sel], change);
    this._qtys[this._sel] -= change;
    this._aliensSold -= change;
    this.updateStrings();
  }

  /**
   * Updates the quantity-strings of the selected alien.
   */
  updateStrings(): void {
    const qty = this.getQuantity() - this._qtys[this._sel];

    this._lstAliens.setRowColor(this._sel, qty === 0 ? this._lstAliens.getSecondaryColor() : this._lstAliens.getColor());
    this._lstAliens.setCellText(this._sel, 1, `${qty}`);
    this._lstAliens.setCellText(this._sel, 2, `${this._qtys[this._sel]}`);

    const aliens = this._base.getUsedContainment() - this._aliensSold;
    const spaces = this._base.getAvailableContainment() - aliens;
    if (Options.storageLimitsEnforced) {
      this._btnOk.setVisible(spaces >= 0);
    }
    this._txtAvailable.setText(String(this.tr("STR_SPACE_AVAILABLE").arg(spaces)));
    this._txtUsed.setText(String(this.tr("STR_SPACE_USED").arg(aliens)));
  }

  /**
   * Gets selected quantity.
   */
  private getQuantity(): number {
    return this._base.getStorageItems().getItem(this._aliens[this._sel]);
  }
}
