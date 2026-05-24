import type { Action } from "../Engine/Action.ts";
import { Options } from "../Engine/Options.ts";
import { State } from "../Engine/State.ts";
import { formatNumber, formatPercentage, TOK_COLOR_FLIP } from "../Engine/Unicode.ts";
import { ALIGN_CENTER, Text } from "../Interface/Text.ts";
import { TextButton } from "../Interface/TextButton.ts";
import { POPUP_BOTH, Window } from "../Interface/Window.ts";
import { Craft } from "../Savegame/Craft.ts";
import type { TargetLike } from "../Savegame/Target.ts";
import { Ufo, UfoStatus } from "../Savegame/Ufo.ts";
import type { Waypoint } from "../Savegame/Waypoint.ts";
import type { Globe } from "./Globe.ts";
import { SelectDestinationState } from "./SelectDestinationState.ts";

type RuleCraftRuntime = ReturnType<Craft["getRules"]> & {
  isWaterOnly?: () => boolean;
};

type SavedGameRuntime = {
  getId: (name: string) => number;
  getWaypoints?: () => Waypoint[];
} | null;

const COLOR_FLIP = String.fromCharCode(TOK_COLOR_FLIP);

function isWaterOnlyCraft(rules: RuleCraftRuntime): boolean {
  return rules.isWaterOnly?.() ?? (rules.getMaxAltitude() > -1);
}

/**
 * Craft window that displays info about a specific craft out on the Geoscape.
 */
export class GeoscapeCraftState extends State {
  private _btnBase: TextButton;
  private _btnTarget: TextButton;
  private _btnPatrol: TextButton;
  private _btnCancel: TextButton;
  private _window: Window;
  private _txtTitle: Text;
  private _txtStatus: Text;
  private _txtBase: Text;
  private _txtSpeed: Text;
  private _txtMaxSpeed: Text;
  private _txtAltitude: Text;
  private _txtFuel: Text;
  private _txtDamage: Text;
  private _txtW1Name: Text;
  private _txtW1Ammo: Text;
  private _txtW2Name: Text;
  private _txtW2Ammo: Text;
  private _txtRedirect: Text;
  private _txtSoldier: Text;
  private _txtHWP: Text;

  constructor(private _craft: Craft, private _globe: Globe, private _waypoint: Waypoint | null) {
    super();
    this._screen = false;

    this._window = new Window(this, 240, 184, 8, 8, POPUP_BOTH);
    this._btnBase = new TextButton(212, 12, 22, 124);
    this._btnTarget = new TextButton(212, 12, 22, 140);
    this._btnPatrol = new TextButton(212, 12, 22, 156);
    this._btnCancel = new TextButton(212, 12, 22, 172);
    this._txtTitle = new Text(210, 17, 32, 20);
    this._txtStatus = new Text(210, 17, 32, 36);
    this._txtBase = new Text(210, 9, 32, 52);
    this._txtSpeed = new Text(210, 9, 32, 60);
    this._txtMaxSpeed = new Text(210, 9, 32, 68);
    this._txtAltitude = new Text(210, 9, 32, 76);
    this._txtFuel = new Text(130, 9, 32, 84);
    this._txtDamage = new Text(80, 9, 164, 84);
    this._txtW1Name = new Text(130, 9, 32, 92);
    this._txtW1Ammo = new Text(80, 9, 164, 92);
    this._txtW2Name = new Text(130, 9, 32, 100);
    this._txtW2Ammo = new Text(80, 9, 164, 100);
    this._txtRedirect = new Text(230, 17, 13, 108);
    this._txtSoldier = new Text(80, 9, 164, 68);
    this._txtHWP = new Text(80, 9, 164, 76);

    this.setInterface("geoCraft");

    this.add(this._window, "window", "geoCraft");
    this.add(this._btnBase, "button", "geoCraft");
    this.add(this._btnTarget, "button", "geoCraft");
    this.add(this._btnPatrol, "button", "geoCraft");
    this.add(this._btnCancel, "button", "geoCraft");
    this.add(this._txtTitle, "text1", "geoCraft");
    this.add(this._txtStatus, "text1", "geoCraft");
    this.add(this._txtBase, "text3", "geoCraft");
    this.add(this._txtSpeed, "text3", "geoCraft");
    this.add(this._txtMaxSpeed, "text3", "geoCraft");
    this.add(this._txtAltitude, "text3", "geoCraft");
    this.add(this._txtFuel, "text3", "geoCraft");
    this.add(this._txtDamage, "text3", "geoCraft");
    this.add(this._txtW1Name, "text3", "geoCraft");
    this.add(this._txtW1Ammo, "text3", "geoCraft");
    this.add(this._txtW2Name, "text3", "geoCraft");
    this.add(this._txtW2Ammo, "text3", "geoCraft");
    this.add(this._txtRedirect, "text3", "geoCraft");
    this.add(this._txtSoldier, "text3", "geoCraft");
    this.add(this._txtHWP, "text3", "geoCraft");

    this.centerAllSurfaces();

    const back12 = this.game().getMod()?.getSurface("BACK12.SCR");
    if (back12) {
      this._window.setBackground(back12);
    }

    this._btnBase.setText(String(this.tr("STR_RETURN_TO_BASE")));
    this._btnBase.onMouseClick(this.btnBaseClick.bind(this));

    this._btnTarget.setText(String(this.tr("STR_SELECT_NEW_TARGET")));
    this._btnTarget.onMouseClick(this.btnTargetClick.bind(this));

    this._btnPatrol.setText(String(this.tr("STR_PATROL")));
    this._btnPatrol.onMouseClick(this.btnPatrolClick.bind(this));

    this._btnCancel.setText(String(this.tr("STR_CANCEL_UC")));
    this._btnCancel.onMouseClick(this.btnCancelClick.bind(this));
    this._btnCancel.onKeyboardPress(this.btnCancelClick.bind(this), Options.keyCancel);

    this._txtTitle.setBig();
    this._txtTitle.setText(this._craft.getName(this.game().getLanguage()));

    this._txtStatus.setWordWrap(true);
    const destination = this._craft.getDestination();
    let status: string;
    if (this._waypoint !== null) {
      status = String(this.tr("STR_INTERCEPTING_UFO").arg(this._waypoint.getId()));
    } else if (this._craft.getLowFuel()) {
      status = String(this.tr("STR_LOW_FUEL_RETURNING_TO_BASE"));
    } else if (this._craft.getMissionComplete()) {
      status = String(this.tr("STR_MISSION_COMPLETE_RETURNING_TO_BASE"));
    } else if (destination === null) {
      status = String(this.tr("STR_PATROLLING"));
    } else if (destination === this._craft.getBase()) {
      status = String(this.tr("STR_RETURNING_TO_BASE"));
    } else if (destination instanceof Ufo) {
      if (this._craft.isInDogfight()) {
        status = String(this.tr("STR_TAILING_UFO"));
      } else if (destination.getStatus() === UfoStatus.FLYING) {
        status = String(this.tr("STR_INTERCEPTING_UFO").arg(destination.getId()));
      } else {
        status = String(this.tr("STR_DESTINATION_UC_").arg(destination.getName(this.game().getLanguage())));
      }
    } else {
      status = String(this.tr("STR_DESTINATION_UC_").arg(destination.getName(this.game().getLanguage())));
    }
    this._txtStatus.setText(String(this.tr("STR_STATUS_").arg(status)));

    this._txtBase.setText(String(this.tr("STR_BASE_UC").arg(this._craft.getBase()?.getName() || "")));

    let speed = this._craft.getSpeed();
    if (this._craft.isInDogfight() && destination instanceof Ufo) {
      speed = destination.getSpeed();
    }
    this._txtSpeed.setText(String(this.tr("STR_SPEED_").arg(formatNumber(speed))));

    this._txtMaxSpeed.setText(String(this.tr("STR_MAXIMUM_SPEED_UC").arg(formatNumber(this._craft.getRules().getMaxSpeed()))));

    let altitude = this._craft.getAltitude() === "STR_GROUND" ? "STR_GROUNDED" : this._craft.getAltitude();
    if (isWaterOnlyCraft(this._craft.getRules() as RuleCraftRuntime) && !this._globe.insideLand(this._craft.getLongitude(), this._craft.getLatitude())) {
      altitude = "STR_AIRBORNE";
    }
    this._txtAltitude.setText(String(this.tr("STR_ALTITUDE_").arg(this.tr(altitude))));

    this._txtFuel.setText(String(this.tr("STR_FUEL").arg(formatPercentage(this._craft.getFuelPercentage()))));
    this._txtDamage.setText(String(this.tr("STR_DAMAGE_UC_").arg(formatPercentage(this._craft.getDamagePercentage()))));

    const weapons = this._craft.getWeapons();
    if (this._craft.getRules().getWeapons() > 0 && weapons[0] !== null) {
      const w1 = weapons[0];
      this._txtW1Name.setText(String(this.tr("STR_WEAPON_ONE").arg(this.tr(w1.getRules().getType()))));
      this._txtW1Ammo.setText(String(this.tr("STR_ROUNDS_").arg(w1.getAmmo())));
    } else {
      this._txtW1Name.setText(String(this.tr("STR_WEAPON_ONE").arg(this.tr("STR_NONE_UC"))));
      this._txtW1Ammo.setVisible(false);
    }

    if (this._craft.getRules().getWeapons() > 1 && weapons[1] !== null) {
      const w2 = weapons[1];
      this._txtW2Name.setText(String(this.tr("STR_WEAPON_TWO").arg(this.tr(w2.getRules().getType()))));
      this._txtW2Ammo.setText(String(this.tr("STR_ROUNDS_").arg(w2.getAmmo())));
    } else {
      this._txtW2Name.setText(String(this.tr("STR_WEAPON_TWO").arg(this.tr("STR_NONE_UC"))));
      this._txtW2Ammo.setVisible(false);
    }

    this._txtRedirect.setBig();
    this._txtRedirect.setAlign(ALIGN_CENTER);
    this._txtRedirect.setText(String(this.tr("STR_REDIRECT_CRAFT")));

    this._txtSoldier.setText(`${String(this.tr("STR_SOLDIERS_UC"))}>${COLOR_FLIP}${this._craft.getNumSoldiers()}`);
    this._txtHWP.setText(`${String(this.tr("STR_HWPS"))}>${COLOR_FLIP}${this._craft.getNumVehicles()}`);

    if (this._waypoint === null) {
      this._txtRedirect.setVisible(false);
    } else {
      this._btnCancel.setText(String(this.tr("STR_GO_TO_LAST_KNOWN_UFO_POSITION")));
    }

    if (this._craft.getLowFuel() || this._craft.getMissionComplete()) {
      this._btnBase.setVisible(false);
      this._btnTarget.setVisible(false);
      this._btnPatrol.setVisible(false);
    }

    if (this._craft.getRules().getSoldiers() === 0) {
      this._txtSoldier.setVisible(false);
    }
    if (this._craft.getRules().getVehicles() === 0) {
      this._txtHWP.setVisible(false);
    }
  }

  btnBaseClick(_action?: Action): void {
    this.game().popState();
    this._craft.returnToBase();
    this._waypoint = null;
  }

  btnTargetClick(_action?: Action): void {
    this.game().popState();
    this.game().pushState(new SelectDestinationState(this._craft, this._globe));
    this._waypoint = null;
  }

  btnPatrolClick(_action?: Action): void {
    this.game().popState();
    this._craft.setDestination(null);
    this._waypoint = null;
  }

  btnCancelClick(_action?: Action): void {
    if (this._waypoint !== null) {
      const save = this.game().getSavedGame() as SavedGameRuntime;
      this._waypoint.setId(save?.getId("STR_WAY_POINT") ?? 0);
      save?.getWaypoints?.().push(this._waypoint);
      this._craft.setDestination(this._waypoint);
    }
    this.game().popState();
  }
}
