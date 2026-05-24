import { Options } from "../Engine/Options.ts";
import type { Action } from "../Engine/Action.ts";
import type { State } from "../Engine/State.ts";
import type { Globe } from "../Geoscape/Globe.ts";
import type { RuleBaseFacility } from "../Mod/RuleBaseFacility.ts";
import type { Base } from "../Savegame/Base.ts";
import { BuildFacilitiesState } from "./BuildFacilitiesState.ts";
import { PlaceLiftState } from "./PlaceLiftState.ts";
import { PlaceStartFacilityState } from "./PlaceStartFacilityState.ts";

export class SelectStartFacilityState extends BuildFacilitiesState {
  constructor(base: Base, state: State, private _globe: Globe) {
    super(base, state);

    this._facilities = this.game().getMod()?.getCustomBaseFacilities() || [];

    this._btnOk.setText(String(this.tr("STR_RESET")));
    this._btnOk.onMouseClick(this.btnOkClick.bind(this));
    this._btnOk.onKeyboardPress(null, Options.keyCancel);

    this._lstFacilities.onMouseClick(this.lstFacilitiesClick.bind(this));

    this.populateBuildList();
  }

  override PopulateBuildList(): void {
    this.populateBuildList();
  }

  populateBuildList(): void {
    this._lstFacilities.clearList();
    for (const rule of this._facilities) {
      this._lstFacilities.addRow(1, String(this.tr(rule.getType())));
    }
  }

  override btnOkClick(_action?: Action): void {
    this._base.getFacilities().length = 0;
    this.game().popState();
    this.game().popState();
    this.game().pushState(new PlaceLiftState(this._base, this._globe, true));
  }

  override lstFacilitiesClick(_action?: Action): void {
    const selected = this._lstFacilities.getSelectedRow();
    if (selected >= 0 && selected < this._facilities.length) {
      this.game().pushState(new PlaceStartFacilityState(this._base, this, this._facilities[selected]));
    }
  }

  facilityBuilt(): void {
    const selected = this._lstFacilities.getSelectedRow();
    if (selected >= 0 && selected < this._facilities.length) {
      this._facilities.splice(selected, 1);
    }
    if (this._facilities.length === 0) {
      this.game().popState();
      this.game().popState();
    } else {
      this.populateBuildList();
    }
  }

}
