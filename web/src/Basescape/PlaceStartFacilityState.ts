import type { Action } from "../Engine/Action.ts";
import { ErrorMessageState } from "../Menu/ErrorMessageState.ts";
import type { RuleBaseFacility } from "../Mod/RuleBaseFacility.ts";
import type { Base } from "../Savegame/Base.ts";
import { BaseFacility } from "../Savegame/BaseFacility.ts";
import { PlaceFacilityState } from "./PlaceFacilityState.ts";
import type { SelectStartFacilityState } from "./SelectStartFacilityState.ts";

export class PlaceStartFacilityState extends PlaceFacilityState {
  constructor(base: Base, private _select: SelectStartFacilityState, rule: RuleBaseFacility) {
    super(base, rule);

    this._view.onMouseClick(this.viewClick.bind(this));
    this._numCost.setText(String(this.tr("STR_NONE")));
    this._numTime.setText(String(this.tr("STR_NONE")));
  }

  override viewClick(_action?: Action): void {
    if (!this._view.isPlaceable(this._rule)) {
      const error = this.game().getMod()?.getInterface("basescape")?.getElement("errorMessage");
      const errorPalette = this.game().getMod()?.getInterface("basescape")?.getElement("errorPalette");
      this.game().popState();
      this.game().pushState(new ErrorMessageState(String(this.tr("STR_CANNOT_BUILD_HERE")), this._palette, error?.color ?? 0, "BACK01.SCR", errorPalette?.color ?? -1));
    } else {
      const fac = new BaseFacility(this._rule, this._base);
      fac.setX(this._view.getGridX());
      fac.setY(this._view.getGridY());
      this._base.getFacilities().push(fac);
      this.game().popState();
      this._select.facilityBuilt();
    }
  }
}
