import { Options } from "../Engine/Options.ts";
import { State } from "../Engine/State.ts";
import type { Action } from "../Engine/Action.ts";
import { ALIGN_CENTER, Text } from "../Interface/Text.ts";
import { TextButton } from "../Interface/TextButton.ts";
import { Window } from "../Interface/Window.ts";
import type { Globe } from "./Globe.ts";

type AlienBaseLike = {
  getLongitude(): number;
  getLatitude(): number;
};

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
 * Displays info on an alien base.
 */
export class AlienBaseState extends State {
  private _btnOk: TextButton;
  private _window: Window;
  private _txtTitle: Text;

  constructor(private _base: AlienBaseLike, private _state: GeoscapeStateLike) {
    super();

    this._window = new Window(this, 320, 200, 0, 0);
    this._btnOk = new TextButton(50, 12, 135, 180);
    this._txtTitle = new Text(308, 60, 6, 60);

    this.setInterface("alienBase");

    this.add(this._window, "window", "alienBase");
    this.add(this._btnOk, "text", "alienBase");
    this.add(this._txtTitle, "button", "alienBase");

    this.centerAllSurfaces();

    const back13 = this.game().getMod()?.getSurface("BACK13.SCR");
    if (back13) {
      this._window.setBackground(back13);
    }

    this._btnOk.setText(String(this.tr("STR_OK")));
    this._btnOk.onMouseClick(this.btnOkClick.bind(this));
    this._btnOk.onKeyboardPress(this.btnOkClick.bind(this), Options.keyOk);
    this._btnOk.onKeyboardPress(this.btnOkClick.bind(this), Options.keyCancel);

    this._txtTitle.setAlign(ALIGN_CENTER);
    this._txtTitle.setBig();
    this._txtTitle.setWordWrap(true);

    let region = "";
    let country = "";
    const save = this.game().getSavedGame();
    if (save) {
      for (const savedCountry of save.getCountries()) {
        if (savedCountry.getRules().insideCountry(this._base.getLongitude(), this._base.getLatitude())) {
          country = String(this.tr(savedCountry.getRules().getType()));
          break;
        }
      }
      for (const savedRegion of save.getRegions()) {
        if (savedRegion.getRules().insideRegion(this._base.getLongitude(), this._base.getLatitude())) {
          region = String(this.tr(savedRegion.getRules().getType()));
          break;
        }
      }
    }

    let location = "";
    if (country) {
      location = String(this.tr("STR_COUNTRIES_COMMA").arg(country).arg(region));
    } else if (region) {
      location = region;
    } else {
      location = String(this.tr("STR_UNKNOWN"));
    }
    this._txtTitle.setText(String(this.tr("STR_XCOM_AGENTS_HAVE_LOCATED_AN_ALIEN_BASE_IN_REGION").arg(location)));
  }

  btnOkClick(_action?: Action): void {
    this._state.timerReset?.();
    centerGlobe(this._state.getGlobe(), this._base.getLongitude(), this._base.getLatitude());
    this.game().popState();
  }
}
