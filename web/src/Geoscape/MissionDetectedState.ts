import { Options } from "../Engine/Options.ts";
import { State } from "../Engine/State.ts";
import type { Action } from "../Engine/Action.ts";
import { ALIGN_CENTER, Text } from "../Interface/Text.ts";
import { TextButton } from "../Interface/TextButton.ts";
import { POPUP_BOTH, Window } from "../Interface/Window.ts";
import type { MissionSite } from "../Savegame/MissionSite.ts";
import type { Globe } from "./Globe.ts";

type GeoscapeStateLike = {
  getGlobe(): Globe;
  timerReset?: () => void;
};

type CenterableGlobe = Globe & {
  center?: (lon: number, lat: number) => void;
};

function centerGlobe(globe: Globe, lon: number, lat: number): void {
  (globe as CenterableGlobe).center?.(lon, lat);
}

/**
 * Displays info on a detected mission site.
 */
export class MissionDetectedState extends State {
  private _btnIntercept: TextButton;
  private _btnCenter: TextButton;
  private _btnCancel: TextButton;
  private _window: Window;
  private _txtTitle: Text;
  private _txtCity: Text;

  constructor(private _mission: MissionSite, private _state: GeoscapeStateLike) {
    super();
    this._screen = false;

    this._window = new Window(this, 256, 200, 0, 0, POPUP_BOTH);
    this._btnIntercept = new TextButton(200, 16, 28, 130);
    this._btnCenter = new TextButton(200, 16, 28, 150);
    this._btnCancel = new TextButton(200, 16, 28, 170);
    this._txtTitle = new Text(246, 32, 5, 48);
    this._txtCity = new Text(246, 17, 5, 80);

    this.setInterface("terrorSite");

    this.add(this._window, "window", "terrorSite");
    this.add(this._btnIntercept, "button", "terrorSite");
    this.add(this._btnCenter, "button", "terrorSite");
    this.add(this._btnCancel, "button", "terrorSite");
    this.add(this._txtTitle, "text", "terrorSite");
    this.add(this._txtCity, "text", "terrorSite");

    this.centerAllSurfaces();

    const background = this.game().getMod()?.getSurface(this._mission.getDeployment().getAlertBackground());
    if (background) {
      this._window.setBackground(background);
    }

    this._btnIntercept.setText(String(this.tr("STR_INTERCEPT")));
    this._btnIntercept.onMouseClick(this.btnInterceptClick.bind(this));

    this._btnCenter.setText(String(this.tr("STR_CENTER_ON_SITE_TIME_5_SECONDS")));
    this._btnCenter.onMouseClick(this.btnCenterClick.bind(this));

    this._btnCancel.setText(String(this.tr("STR_CANCEL_UC")));
    this._btnCancel.onMouseClick(this.btnCancelClick.bind(this));
    this._btnCancel.onKeyboardPress(this.btnCancelClick.bind(this), Options.keyCancel);

    this._txtTitle.setBig();
    this._txtTitle.setAlign(ALIGN_CENTER);
    this._txtTitle.setWordWrap(true);
    this._txtTitle.setText(String(this.tr(this._mission.getDeployment().getAlertMessage())));

    this._txtCity.setBig();
    this._txtCity.setAlign(ALIGN_CENTER);
    this._txtCity.setText(String(this.tr(this._mission.getCity())));
  }

  btnInterceptClick(_action?: Action): void {
    this._state.timerReset?.();
    centerGlobe(this._state.getGlobe(), this._mission.getLongitude(), this._mission.getLatitude());
    console.log("InterceptState is not translated yet.");
  }

  btnCenterClick(_action?: Action): void {
    this._state.timerReset?.();
    centerGlobe(this._state.getGlobe(), this._mission.getLongitude(), this._mission.getLatitude());
    this.game().popState();
  }

  btnCancelClick(_action?: Action): void {
    this.game().popState();
  }
}
