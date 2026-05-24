import type { Action } from "../Engine/Action.ts";
import { InteractiveSurface } from "../Engine/InteractiveSurface.ts";
import { Options } from "../Engine/Options.ts";
import { State } from "../Engine/State.ts";
import { ALIGN_MIDDLE, Text } from "../Interface/Text.ts";
import { TextButton } from "../Interface/TextButton.ts";
import { Window } from "../Interface/Window.ts";
import { Craft } from "../Savegame/Craft.ts";
import type { TargetLike } from "../Savegame/Target.ts";
import { Waypoint } from "../Savegame/Waypoint.ts";
import { SDL_BUTTON_LEFT, SDL_BUTTON_RIGHT } from "../types.ts";
import type { Globe } from "./Globe.ts";
import { MultipleTargetsState } from "./MultipleTargetsState.ts";

type GlobeRuntime = Globe & {
  rotateStopLon?: () => void;
  rotateStopLat?: () => void;
  zoomMax?: () => void;
  zoomMin?: () => void;
  setCraftRange?: (lon: number, lat: number, range: number) => void;
  getTargets?: (x: number, y: number, craft: boolean) => TargetLike[];
};

function pushConfirmCydoniaBoundary(): void {
  console.log("ConfirmCydoniaState is not translated yet.");
}

/**
 * Screen that allows the player to pick a target for a craft on the globe.
 */
export class SelectDestinationState extends State {
  private _btnRotateLeft: InteractiveSurface;
  private _btnRotateRight: InteractiveSurface;
  private _btnRotateUp: InteractiveSurface;
  private _btnRotateDown: InteractiveSurface;
  private _btnZoomIn: InteractiveSurface;
  private _btnZoomOut: InteractiveSurface;
  private _window: Window;
  private _txtTitle: Text;
  private _btnCancel: TextButton;
  private _btnCydonia: TextButton;

  constructor(private _craft: Craft, private _globe: Globe) {
    super();
    const dx = this.game().getScreen().getDX();
    const dy = this.game().getScreen().getDY();
    this._screen = false;

    this._btnRotateLeft = new InteractiveSurface(12, 10, 259 + dx * 2, 176 + dy);
    this._btnRotateRight = new InteractiveSurface(12, 10, 283 + dx * 2, 176 + dy);
    this._btnRotateUp = new InteractiveSurface(13, 12, 271 + dx * 2, 162 + dy);
    this._btnRotateDown = new InteractiveSurface(13, 12, 271 + dx * 2, 187 + dy);
    this._btnZoomIn = new InteractiveSurface(23, 23, 295 + dx * 2, 156 + dy);
    this._btnZoomOut = new InteractiveSurface(13, 17, 300 + dx * 2, 182 + dy);

    this._window = new Window(this, 256, 28, 0, 0);
    this._window.setX(dx);
    this._window.setDY(0);
    this._btnCancel = new TextButton(60, 12, 110 + dx, 8);
    this._btnCydonia = new TextButton(60, 12, 180 + dx, 8);
    this._txtTitle = new Text(100, 16, 10 + dx, 6);

    this.setInterface("geoscape");

    this.add(this._btnRotateLeft);
    this.add(this._btnRotateRight);
    this.add(this._btnRotateUp);
    this.add(this._btnRotateDown);
    this.add(this._btnZoomIn);
    this.add(this._btnZoomOut);

    this.add(this._window, "genericWindow", "geoscape");
    this.add(this._btnCancel, "genericButton1", "geoscape");
    this.add(this._btnCydonia, "genericButton1", "geoscape");
    this.add(this._txtTitle, "genericText", "geoscape");

    this._globe.onMouseClick(this.globeClick.bind(this));

    this._btnRotateLeft.onMousePress(this.btnRotateLeftPress.bind(this));
    this._btnRotateLeft.onMouseRelease(this.btnRotateLeftRelease.bind(this));
    this._btnRotateLeft.onKeyboardPress(this.btnRotateLeftPress.bind(this), Options.keyGeoLeft);
    this._btnRotateLeft.onKeyboardRelease(this.btnRotateLeftRelease.bind(this), Options.keyGeoLeft);

    this._btnRotateRight.onMousePress(this.btnRotateRightPress.bind(this));
    this._btnRotateRight.onMouseRelease(this.btnRotateRightRelease.bind(this));
    this._btnRotateRight.onKeyboardPress(this.btnRotateRightPress.bind(this), Options.keyGeoRight);
    this._btnRotateRight.onKeyboardRelease(this.btnRotateRightRelease.bind(this), Options.keyGeoRight);

    this._btnRotateUp.onMousePress(this.btnRotateUpPress.bind(this));
    this._btnRotateUp.onMouseRelease(this.btnRotateUpRelease.bind(this));
    this._btnRotateUp.onKeyboardPress(this.btnRotateUpPress.bind(this), Options.keyGeoUp);
    this._btnRotateUp.onKeyboardRelease(this.btnRotateUpRelease.bind(this), Options.keyGeoUp);

    this._btnRotateDown.onMousePress(this.btnRotateDownPress.bind(this));
    this._btnRotateDown.onMouseRelease(this.btnRotateDownRelease.bind(this));
    this._btnRotateDown.onKeyboardPress(this.btnRotateDownPress.bind(this), Options.keyGeoDown);
    this._btnRotateDown.onKeyboardRelease(this.btnRotateDownRelease.bind(this), Options.keyGeoDown);

    this._btnZoomIn.onMouseClick(this.btnZoomInLeftClick.bind(this), SDL_BUTTON_LEFT);
    this._btnZoomIn.onMouseClick(this.btnZoomInRightClick.bind(this), SDL_BUTTON_RIGHT);
    this._btnZoomIn.onKeyboardPress(this.btnZoomInLeftClick.bind(this), Options.keyGeoZoomIn);

    this._btnZoomOut.onMouseClick(this.btnZoomOutLeftClick.bind(this), SDL_BUTTON_LEFT);
    this._btnZoomOut.onMouseClick(this.btnZoomOutRightClick.bind(this), SDL_BUTTON_RIGHT);
    this._btnZoomOut.onKeyboardPress(this.btnZoomOutLeftClick.bind(this), Options.keyGeoZoomOut);

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

    this._txtTitle.setText(String(this.tr("STR_SELECT_DESTINATION")));
    this._txtTitle.setVerticalAlign(ALIGN_MIDDLE);
    this._txtTitle.setWordWrap(true);

    const finalResearch = this.game().getMod()?.getFinalResearch() || "";
    if (!this._craft.getRules().getSpacecraft() || !this.game().getSavedGame()?.isResearched(finalResearch)) {
      this._btnCydonia.setVisible(false);
    } else {
      this._btnCydonia.setText(String(this.tr("STR_CYDONIA")));
      this._btnCydonia.onMouseClick(this.btnCydoniaClick.bind(this));
    }

    if (this._craft.getStatus() !== "STR_OUT") {
      (this._globe as GlobeRuntime).setCraftRange?.(this._craft.getLongitude(), this._craft.getLatitude(), this._craft.getBaseRange());
      this._globe.invalidate();
    }
  }

  override init(): void {
    super.init();
    this._globe.rotateStop();
  }

  override think(): void {
    super.think();
    this._globe.think();
  }

  override handle(action: Action): void {
    super.handle(action);
    this._globe.handle(action, this);
  }

  globeClick(action: Action): void {
    const mouseX = Math.floor(action.getAbsoluteXMouse());
    const mouseY = Math.floor(action.getAbsoluteYMouse());
    const { lon, lat } = this._globe.cartToPolar(mouseX, mouseY);

    if (mouseY < 28) {
      return;
    }

    if (action.getDetails().button?.button === SDL_BUTTON_LEFT) {
      const targets = (this._globe as GlobeRuntime).getTargets?.(mouseX, mouseY, true) || [];
      if (targets.length === 0) {
        const waypoint = new Waypoint();
        waypoint.setLongitude(lon);
        waypoint.setLatitude(lat);
        targets.push(waypoint);
      }
      this.game().pushState(new MultipleTargetsState(targets, this._craft, null));
    }
  }

  btnRotateLeftPress(_action?: Action): void {
    this._globe.rotateLeft();
  }

  btnRotateLeftRelease(_action?: Action): void {
    (this._globe as GlobeRuntime).rotateStopLon?.();
  }

  btnRotateRightPress(_action?: Action): void {
    this._globe.rotateRight();
  }

  btnRotateRightRelease(_action?: Action): void {
    (this._globe as GlobeRuntime).rotateStopLon?.();
  }

  btnRotateUpPress(_action?: Action): void {
    this._globe.rotateUp();
  }

  btnRotateUpRelease(_action?: Action): void {
    (this._globe as GlobeRuntime).rotateStopLat?.();
  }

  btnRotateDownPress(_action?: Action): void {
    this._globe.rotateDown();
  }

  btnRotateDownRelease(_action?: Action): void {
    (this._globe as GlobeRuntime).rotateStopLat?.();
  }

  btnZoomInLeftClick(_action?: Action): void {
    this._globe.zoomIn();
  }

  btnZoomInRightClick(_action?: Action): void {
    const runtime = this._globe as GlobeRuntime;
    if (runtime.zoomMax) {
      runtime.zoomMax();
    } else {
      this._globe.zoomIn();
    }
  }

  btnZoomOutLeftClick(_action?: Action): void {
    this._globe.zoomOut();
  }

  btnZoomOutRightClick(_action?: Action): void {
    const runtime = this._globe as GlobeRuntime;
    if (runtime.zoomMin) {
      runtime.zoomMin();
    } else {
      this._globe.zoomOut();
    }
  }

  btnCancelClick(_action?: Action): void {
    this.game().popState();
  }

  btnCydoniaClick(_action?: Action): void {
    if (this._craft.getNumSoldiers() > 0 || this._craft.getNumVehicles() > 0) {
      pushConfirmCydoniaBoundary();
    }
  }

  override resize(dX: { value: number }, dY: { value: number }): void {
    for (const surface of this._surfaces) {
      surface.setX(surface.getX() + Math.trunc(dX.value / 2));
      if (surface !== this._window && surface !== this._btnCancel && surface !== this._txtTitle && surface !== this._btnCydonia) {
        surface.setY(surface.getY() + Math.trunc(dY.value / 2));
      }
    }
  }
}
