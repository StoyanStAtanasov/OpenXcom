import { Options } from "../Engine/Options.ts";
import { State } from "../Engine/State.ts";
import { InteractiveSurface } from "../Engine/InteractiveSurface.ts";
import type { Action } from "../Engine/Action.ts";
import { Timer } from "../Engine/Timer.ts";
import { Text, ALIGN_MIDDLE } from "../Interface/Text.ts";
import { TextButton } from "../Interface/TextButton.ts";
import { Window } from "../Interface/Window.ts";
import type { Base } from "../Savegame/Base.ts";
import { SDL_BUTTON_LEFT } from "../types.ts";
import { BaseNameState } from "./BaseNameState.ts";
import { ConfirmNewBaseState } from "./ConfirmNewBaseState.ts";
import { Globe } from "./Globe.ts";

export class BuildNewBaseState extends State {
  private _btnRotateLeft: InteractiveSurface;
  private _btnRotateRight: InteractiveSurface;
  private _btnRotateUp: InteractiveSurface;
  private _btnRotateDown: InteractiveSurface;
  private _btnZoomIn: InteractiveSurface;
  private _btnZoomOut: InteractiveSurface;
  private _window: Window;
  private _txtTitle: Text;
  private _btnCancel: TextButton;
  private _hoverTimer: Timer;
  private _oldshowradar: boolean;
  private _oldlat = 0;
  private _oldlon = 0;
  private _mousex = 0;
  private _mousey = 0;

  constructor(private _base: Base, private _globe: Globe, private _first: boolean) {
    super();
    const dx = this.game().getScreen().getDX();
    const dy = this.game().getScreen().getDY();
    this._screen = false;
    this._oldshowradar = Options.globeRadarLines;
    if (!this._oldshowradar) {
      Options.globeRadarLines = true;
    }

    this._btnRotateLeft = new InteractiveSurface(12, 10, 259 + dx * 2, 176 + dy);
    this._btnRotateRight = new InteractiveSurface(12, 10, 283 + dx * 2, 176 + dy);
    this._btnRotateUp = new InteractiveSurface(13, 12, 271 + dx * 2, 162 + dy);
    this._btnRotateDown = new InteractiveSurface(13, 12, 271 + dx * 2, 187 + dy);
    this._btnZoomIn = new InteractiveSurface(23, 23, 295 + dx * 2, 156 + dy);
    this._btnZoomOut = new InteractiveSurface(13, 17, 300 + dx * 2, 182 + dy);
    this._window = new Window(this, 256, 28, 0, 0);
    this._window.setX(dx);
    this._window.setDY(0);
    this._btnCancel = new TextButton(54, 12, 186 + dx, 8);
    this._txtTitle = new Text(180, 16, 8 + dx, 6);
    this._hoverTimer = new Timer(50);
    this._hoverTimer.onTimer(this.hoverRedraw.bind(this));
    this._hoverTimer.start();

    this.setInterface("geoscape");
    this.add(this._btnRotateLeft);
    this.add(this._btnRotateRight);
    this.add(this._btnRotateUp);
    this.add(this._btnRotateDown);
    this.add(this._btnZoomIn);
    this.add(this._btnZoomOut);
    this.add(this._window, "genericWindow", "geoscape");
    this.add(this._btnCancel, "genericButton2", "geoscape");
    this.add(this._txtTitle, "genericText", "geoscape");

    this._globe.onMouseClick(this.globeClick.bind(this));
    this._globe.onMouseOver(this.globeHover.bind(this));
    this._btnRotateLeft.onMousePress(this.btnRotateLeftPress.bind(this));
    this._btnRotateLeft.onMouseRelease(this.btnRotateLeftRelease.bind(this));
    this._btnRotateRight.onMousePress(this.btnRotateRightPress.bind(this));
    this._btnRotateRight.onMouseRelease(this.btnRotateRightRelease.bind(this));
    this._btnRotateUp.onMousePress(this.btnRotateUpPress.bind(this));
    this._btnRotateUp.onMouseRelease(this.btnRotateUpRelease.bind(this));
    this._btnRotateDown.onMousePress(this.btnRotateDownPress.bind(this));
    this._btnRotateDown.onMouseRelease(this.btnRotateDownRelease.bind(this));
    this._btnZoomIn.onMouseClick(this.btnZoomInLeftClick.bind(this));
    this._btnZoomOut.onMouseClick(this.btnZoomOutLeftClick.bind(this));
    this._btnRotateLeft.setListButton();
    this._btnRotateRight.setListButton();
    this._btnRotateUp.setListButton();
    this._btnRotateDown.setListButton();

    const back01 = this.game().getMod()?.getSurface("BACK01.SCR");
    if (back01) {
      this._window.setBackground(back01);
    }
    this._btnCancel.setText(String(this.tr("STR_CANCEL_UC")));
    this._btnCancel.onMouseClick(this.btnCancelClick.bind(this));
    this._btnCancel.onKeyboardPress(this.btnCancelClick.bind(this), Options.keyCancel);
    this._txtTitle.setText(String(this.tr("STR_SELECT_SITE_FOR_NEW_BASE")));
    this._txtTitle.setVerticalAlign(ALIGN_MIDDLE);
    this._txtTitle.setWordWrap(true);
    if (this._first) {
      this._btnCancel.setVisible(false);
    }
  }

  override init(): void {
    super.init();
    this._globe.rotateStop();
    this._globe.setNewBaseHover(true);
  }

  override think(): void {
    super.think();
    this._globe.think();
    this._hoverTimer.think(this, null);
  }

  override handle(action: Action): void {
    super.handle(action);
    this._globe.handle(action, this);
  }

  globeHover(action: Action): void {
    this._mousex = Math.floor(action.getAbsoluteXMouse());
    this._mousey = Math.floor(action.getAbsoluteYMouse());
    if (!this._hoverTimer.isRunning()) {
      this._hoverTimer.start();
    }
  }

  hoverRedraw(): void {
    const { lon, lat } = this._globe.cartToPolar(this._mousex, this._mousey);
    if (Number.isFinite(lon) && Number.isFinite(lat)) {
      this._globe.setNewBaseHoverPos(lon, lat);
      this._globe.setNewBaseHover(true);
    }
    if (Options.globeRadarLines && (this._oldlat !== lat || this._oldlon !== lon)) {
      this._oldlat = lat;
      this._oldlon = lon;
      this._globe.invalidate();
    }
  }

  globeClick(action: Action): void {
    const { lon, lat } = this._globe.cartToPolar(Math.floor(action.getAbsoluteXMouse()), Math.floor(action.getAbsoluteYMouse()));
    if (action.getAbsoluteYMouse() < 28) {
      return;
    }
    if (action.getDetails().button?.button === SDL_BUTTON_LEFT && this._globe.insideLand(lon, lat)) {
      this._base.setLongitude(lon);
      this._base.setLatitude(lat);
      for (const craft of this._base.getCrafts()) {
        craft.setLongitude(lon);
        craft.setLatitude(lat);
      }
      if (this._first) {
        this.game().pushState(new BaseNameState(this._base, this._globe, this._first));
      } else {
        this.game().pushState(new ConfirmNewBaseState(this._base, this._globe));
      }
    }
  }

  btnRotateLeftPress(): void {
    this._globe.rotateLeft();
  }

  btnRotateLeftRelease(): void {}

  btnRotateRightPress(): void {
    this._globe.rotateRight();
  }

  btnRotateRightRelease(): void {}

  btnRotateUpPress(): void {
    this._globe.rotateUp();
  }

  btnRotateUpRelease(): void {}

  btnRotateDownPress(): void {
    this._globe.rotateDown();
  }

  btnRotateDownRelease(): void {}

  btnZoomInLeftClick(): void {
    this._globe.zoomIn();
  }

  btnZoomOutLeftClick(): void {
    this._globe.zoomOut();
  }

  btnCancelClick(): void {
    Options.globeRadarLines = this._oldshowradar;
    this.game().popState();
  }
}
