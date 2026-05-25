import type { Action } from "../Engine/Action.ts";
import { Options } from "../Engine/Options.ts";
import { State } from "../Engine/State.ts";
import { Text, ALIGN_CENTER } from "../Interface/Text.ts";
import { TextButton } from "../Interface/TextButton.ts";
import { ArrowButton, ARROW_BIG_DOWN, ARROW_BIG_UP } from "../Interface/ArrowButton.ts";
import { POPUP_BOTH, Window } from "../Interface/Window.ts";
import { Timer } from "../Engine/Timer.ts";
import { SDL_BUTTON_WHEELDOWN, SDL_BUTTON_WHEELUP } from "../types.ts";
import { UfopaediaSelectState } from "./UfopaediaSelectState.ts";

const CAT_MIN_BUTTONS = 9;
const CAT_MAX_BUTTONS = 10;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Ufopaedia category selection screen.
 */
export class UfopaediaStartState extends State {
  private _window: Window;
  private _txtTitle: Text;
  private _btnOk: TextButton;
  private _btnSections: TextButton[] = [];
  private _btnScrollUp: ArrowButton;
  private _btnScrollDown: ArrowButton;
  private _timerScroll: Timer;
  private _offset = 0;
  private _scroll = 0;
  private readonly _cats: string[];

  constructor() {
    super();
    this._screen = false;
    const mod = this.game().getMod();
    if (!mod) {
      throw new Error("Mod not loaded.");
    }
    this._cats = mod.getUfopaediaCategoryList();

    this._window = new Window(this, 256, 180, 32, 10, POPUP_BOTH);
    this._txtTitle = new Text(220, 17, 50, 33);

    this.setInterface("ufopaedia");
    this.add(this._window, "window", "ufopaedia");
    this.add(this._txtTitle, "text", "ufopaedia");

    this._btnOk = new TextButton(220, 12, 50, 167);
    this.add(this._btnOk, "button1", "ufopaedia");

    let y = 50;
    const numButtons = Math.min(this._cats.length, CAT_MAX_BUTTONS);
    if (numButtons > CAT_MIN_BUTTONS) {
      y -= 13 * (numButtons - CAT_MIN_BUTTONS);
    }

    this._btnScrollUp = new ArrowButton(ARROW_BIG_UP, 13, 14, 270, y);
    this.add(this._btnScrollUp, "button1", "ufopaedia");
    this._btnScrollDown = new ArrowButton(ARROW_BIG_DOWN, 13, 14, 270, 152);
    this.add(this._btnScrollDown, "button1", "ufopaedia");

    for (let i = 0; i < numButtons; ++i) {
      const button = new TextButton(220, 12, 50, y);
      y += 13;
      this.add(button, "button1", "ufopaedia");
      button.onMouseClick(this.btnSectionClick.bind(this));
      button.onMousePress(this.btnScrollUpClick.bind(this), SDL_BUTTON_WHEELUP);
      button.onMousePress(this.btnScrollDownClick.bind(this), SDL_BUTTON_WHEELDOWN);
      this._btnSections.push(button);
    }

    this.updateButtons();
    if (this._btnSections.length > 0) {
      this._txtTitle.setY(this._btnSections[0].getY() - this._txtTitle.getHeight());
    }

    this.centerAllSurfaces();
    const back01 = this.game().getMod()?.getSurface("BACK01.SCR");
    if (back01) {
      this._window.setBackground(back01);
    }

    this._txtTitle.setBig();
    this._txtTitle.setAlign(ALIGN_CENTER);
    this._txtTitle.setText(String(this.tr("STR_UFOPAEDIA")));

    this._btnOk.setText(String(this.tr("STR_OK")));
    this._btnOk.onMouseClick(this.btnOkClick.bind(this));
    this._btnOk.onKeyboardPress(this.btnOkClick.bind(this), Options.keyCancel);
    this._btnOk.onKeyboardPress(this.btnOkClick.bind(this), Options.keyGeoUfopedia);

    this._btnScrollUp.setVisible(this._cats.length > CAT_MAX_BUTTONS);
    this._btnScrollUp.onMousePress(this.btnScrollUpPress.bind(this));
    this._btnScrollUp.onMouseRelease(this.btnScrollRelease.bind(this));
    this._btnScrollDown.setVisible(this._cats.length > CAT_MAX_BUTTONS);
    this._btnScrollDown.onMousePress(this.btnScrollDownPress.bind(this));
    this._btnScrollDown.onMouseRelease(this.btnScrollRelease.bind(this));

    this._timerScroll = new Timer(50);
    this._timerScroll.onTimer(this.scroll.bind(this));
  }

  override think(): void {
    super.think();
    this._timerScroll.think(this, null);
  }

  btnOkClick(_action?: Action): void {
    this.game().popState();
  }

  btnSectionClick(action: Action): void {
    for (let i = 0; i < this._btnSections.length; ++i) {
      if (action.getSender() === this._btnSections[i]) {
        this.game().pushState(new UfopaediaSelectState(this._cats[this._offset + i]));
        break;
      }
    }
  }

  btnScrollUpPress(_action?: Action): void {
    this._scroll = -1;
    this._timerScroll.start();
  }

  btnScrollUpClick(_action?: Action): void {
    this._scroll = -1;
    this.scroll();
  }

  btnScrollDownPress(_action?: Action): void {
    this._scroll = 1;
    this._timerScroll.start();
  }

  btnScrollDownClick(_action?: Action): void {
    this._scroll = 1;
    this.scroll();
  }

  btnScrollRelease(_action?: Action): void {
    this._timerScroll.stop();
  }

  scroll(): void {
    if (this._cats.length > CAT_MAX_BUTTONS) {
      this._offset = clamp(this._offset + this._scroll, 0, this._cats.length - CAT_MAX_BUTTONS);
      this.updateButtons();
    }
  }

  updateButtons(): void {
    for (let i = 0; i < this._btnSections.length; ++i) {
      this._btnSections[i].setText(String(this.tr(this._cats[this._offset + i])));
    }
  }
}
