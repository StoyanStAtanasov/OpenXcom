import type { Action } from "../Engine/Action.ts";
import { State } from "../Engine/State.ts";
import { Text } from "../Interface/Text.ts";
import type { Globe } from "../Geoscape/Globe.ts";
import type { RuleBaseFacility } from "../Mod/RuleBaseFacility.ts";
import type { Base } from "../Savegame/Base.ts";
import { BaseFacility } from "../Savegame/BaseFacility.ts";
import { BasescapeState } from "./BasescapeState.ts";
import { BaseView } from "./BaseView.ts";
import { SelectStartFacilityState } from "./SelectStartFacilityState.ts";

export class PlaceLiftState extends State {
  private _view: BaseView;
  private _txtTitle: Text;
  private _lift: RuleBaseFacility | null = null;

  constructor(private _base: Base, private _globe: Globe, private _first: boolean) {
    super();

    this._view = new BaseView(192, 192, 0, 8);
    this._txtTitle = new Text(320, 9, 0, 0);

    this.setInterface("placeFacility");

    this.add(this._view, "baseView", "basescape");
    this.add(this._txtTitle, "text", "placeFacility");

    this.centerAllSurfaces();

    const mod = this.game().getMod();
    this._view.setTexture(mod?.getSurfaceSet("BASEBITS.PCK") || null);
    this._view.setBase(this._base);
    for (const type of mod?.getBaseFacilitiesList() || []) {
      const facility = mod?.getBaseFacility(type);
      if (facility?.isLift()) {
        this._lift = facility;
        break;
      }
    }
    if (this._lift) {
      this._view.setSelectable(this._lift.getSize());
    }
    this._view.onMouseClick(this.viewClick.bind(this));

    this._txtTitle.setText(String(this.tr("STR_SELECT_POSITION_FOR_ACCESS_LIFT")));
  }

  viewClick(_action?: Action): void {
    if (!this._lift) {
      return;
    }

    const fac = new BaseFacility(this._lift, this._base);
    fac.setX(this._view.getGridX());
    fac.setY(this._view.getGridY());
    this._base.getFacilities().push(fac);
    this.game().popState();

    const bState = new BasescapeState(this._base, this._globe);
    const save = this.game().getSavedGame();
    save?.setSelectedBase(Math.max(0, save.getBases().length - 1));
    this.game().pushState(bState);
    if (this._first) {
      this.game().pushState(new SelectStartFacilityState(this._base, bState, this._globe));
    }
  }
}
