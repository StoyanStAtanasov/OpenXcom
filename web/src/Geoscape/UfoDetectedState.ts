import { Options } from "../Engine/Options.ts";
import { State } from "../Engine/State.ts";
import { formatNumber, TOK_COLOR_FLIP } from "../Engine/Unicode.ts";
import type { Action } from "../Engine/Action.ts";
import { ALIGN_CENTER, Text } from "../Interface/Text.ts";
import { TextButton } from "../Interface/TextButton.ts";
import { TextList } from "../Interface/TextList.ts";
import { POPUP_BOTH, Window } from "../Interface/Window.ts";
import { Ufo, UfoStatus } from "../Savegame/Ufo.ts";
import type { Globe } from "./Globe.ts";
import { InterceptState } from "./InterceptState.ts";

type GeoscapeStateLike = {
  getGlobe(): Globe;
  timerReset?: () => void;
};

type CenterableGlobe = Globe & {
  center?: (lon: number, lat: number) => void;
};

type WaterCraftRule = {
  isWaterOnly?: () => boolean;
  getMaxAltitude?: () => number;
};

type UfoMissionWithRegion = {
  getRegion?: () => string;
};

const COLOR_FLIP = String.fromCharCode(TOK_COLOR_FLIP);

function centerGlobe(globe: Globe, lon: number, lat: number): void {
  (globe as CenterableGlobe).center?.(lon, lat);
}

function isWaterOnlyCraft(craft: WaterCraftRule | null): boolean {
  if (!craft) {
    return false;
  }
  if (craft.isWaterOnly) {
    return craft.isWaterOnly();
  }
  return (craft.getMaxAltitude?.() ?? -1) > -1;
}

/**
 * Displays info on a detected UFO.
 */
export class UfoDetectedState extends State {
  private _btnIntercept: TextButton;
  private _btnCentre: TextButton;
  private _btnCancel: TextButton;
  private _window: Window;
  private _txtUfo: Text;
  private _txtDetected: Text;
  private _txtHyperwave: Text;
  private _lstInfo: TextList;
  private _lstInfo2: TextList;

  constructor(private _ufo: Ufo, private _state: GeoscapeStateLike, detected: boolean, hyperwave: boolean) {
    super();
    const save = this.game().getSavedGame();
    if (this._ufo.getId() === 0) {
      this._ufo.setId(save?.getId("STR_UFO") ?? 0);
    }
    if (this._ufo.getAltitude() === "STR_GROUND" && this._ufo.getLandId() === 0) {
      this._ufo.setLandId(save?.getId("STR_LANDING_SITE") ?? 0);
    }

    this._screen = false;

    if (hyperwave) {
      this._window = new Window(this, 224, 180, 16, 10, POPUP_BOTH);
    } else {
      this._window = new Window(this, 224, 128, 16, 44, POPUP_BOTH);
    }
    this._btnIntercept = new TextButton(200, 12, 28, 118);
    this._btnCentre = new TextButton(200, 12, 28, 134);
    this._btnCancel = new TextButton(200, 12, 28, 150);
    this._txtUfo = new Text(207, 17, 28, 53);
    this._txtDetected = new Text(100, 9, 28, 69);
    this._txtHyperwave = new Text(214, 17, 21, 44);
    this._lstInfo = new TextList(217, 32, 28, 80);
    this._lstInfo2 = new TextList(217, 32, 28, 96);

    if (hyperwave) {
      this._btnIntercept.setY(136);
      this._btnCentre.setY(152);
      this._btnCancel.setY(168);
      this._txtUfo.setY(20);
      this._txtDetected.setY(36);
      this._lstInfo.setY(60);
    } else {
      this._txtHyperwave.setVisible(false);
      this._lstInfo2.setVisible(false);
    }

    this.setInterface("UFOInfo", hyperwave);

    this.add(this._window, "window", "UFOInfo");
    this.add(this._btnIntercept, "button", "UFOInfo");
    this.add(this._btnCentre, "button", "UFOInfo");
    this.add(this._btnCancel, "button", "UFOInfo");
    this.add(this._txtUfo, "text", "UFOInfo");
    this.add(this._txtDetected, "text", "UFOInfo");
    this.add(this._txtHyperwave, "text", "UFOInfo");
    this.add(this._lstInfo, "text", "UFOInfo");
    this.add(this._lstInfo2, "text", "UFOInfo");

    const back15 = this.game().getMod()?.getSurface("BACK15.SCR");
    if (back15) {
      this._window.setBackground(back15);
    }

    this.centerAllSurfaces();

    this._btnIntercept.setText(String(this.tr("STR_INTERCEPT")));
    this._btnIntercept.onMouseClick(this.btnInterceptClick.bind(this));

    this._btnCentre.setText(String(this.tr("STR_CENTER_ON_UFO_TIME_5_SECONDS")));
    this._btnCentre.onMouseClick(this.btnCentreClick.bind(this));

    this._btnCancel.setText(String(this.tr("STR_CANCEL_UC")));
    this._btnCancel.onMouseClick(this.btnCancelClick.bind(this));
    this._btnCancel.onKeyboardPress(this.btnCancelClick.bind(this), Options.keyCancel);

    this._txtDetected.setText(detected ? String(this.tr("STR_DETECTED")) : "");

    this._txtHyperwave.setAlign(ALIGN_CENTER);
    this._txtHyperwave.setWordWrap(true);
    this._txtHyperwave.setText(String(this.tr("STR_HYPER_WAVE_TRANSMISSIONS_ARE_DECODED")));

    this._txtUfo.setBig();
    this._txtUfo.setText(this._ufo.getName(this.game().getLanguage()));

    this._lstInfo.setColumns(2, 77, 140);
    this._lstInfo.setDot(true);

    this._lstInfo.addRow(2, String(this.tr("STR_SIZE_UC")), `${COLOR_FLIP}${String(this.tr(this._ufo.getRules().getSize()))}`);

    let altitude = this._ufo.getAltitude() === "STR_GROUND" ? "STR_GROUNDED" : this._ufo.getAltitude();
    let underwater = false;
    const mod = this.game().getMod();
    if (mod) {
      for (const craftType of mod.getCraftsList()) {
        underwater = isWaterOnlyCraft(mod.getCraft(craftType) as WaterCraftRule | null);
        if (underwater) {
          break;
        }
      }
    }
    if (underwater && !this._state.getGlobe().insideLand(this._ufo.getLongitude(), this._ufo.getLatitude())) {
      altitude = "STR_AIRBORNE";
    }
    this._lstInfo.addRow(2, String(this.tr("STR_ALTITUDE")), `${COLOR_FLIP}${String(this.tr(altitude))}`);

    let heading = this._ufo.getDirection();
    if (this._ufo.getStatus() !== UfoStatus.FLYING) {
      heading = "STR_NONE_UC";
    }
    this._lstInfo.addRow(2, String(this.tr("STR_HEADING")), `${COLOR_FLIP}${String(this.tr(heading))}`);
    this._lstInfo.addRow(2, String(this.tr("STR_SPEED")), `${COLOR_FLIP}${formatNumber(this._ufo.getSpeed())}`);

    this._lstInfo2.setColumns(2, 77, 140);
    this._lstInfo2.setDot(true);

    this._lstInfo2.addRow(2, String(this.tr("STR_CRAFT_TYPE")), `${COLOR_FLIP}${String(this.tr(this._ufo.getRules().getType()))}`);
    this._lstInfo2.addRow(2, String(this.tr("STR_RACE")), `${COLOR_FLIP}${String(this.tr(this._ufo.getAlienRace()))}`);
    this._lstInfo2.addRow(2, String(this.tr("STR_MISSION")), `${COLOR_FLIP}${String(this.tr(this._ufo.getMissionType()))}`);
    const mission = this._ufo.getMission() as UfoMissionWithRegion | null;
    this._lstInfo2.addRow(2, String(this.tr("STR_ZONE")), `${COLOR_FLIP}${String(this.tr(mission?.getRegion?.() || ""))}`);
  }

  btnInterceptClick(_action?: Action): void {
    this._state.timerReset?.();
    centerGlobe(this._state.getGlobe(), this._ufo.getLongitude(), this._ufo.getLatitude());
    this.game().pushState(new InterceptState(this._state.getGlobe(), null, this._ufo));
  }

  btnCentreClick(_action?: Action): void {
    this._state.timerReset?.();
    centerGlobe(this._state.getGlobe(), this._ufo.getLongitude(), this._ufo.getLatitude());
    this.game().popState();
  }

  btnCancelClick(_action?: Action): void {
    this.game().popState();
  }
}
