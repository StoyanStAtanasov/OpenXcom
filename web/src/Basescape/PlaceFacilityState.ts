import { Options } from "../Engine/Options.ts";
import { formatFunding } from "../Engine/Unicode.ts";
import { State } from "../Engine/State.ts";
import type { Action } from "../Engine/Action.ts";
import { Text } from "../Interface/Text.ts";
import { TextButton } from "../Interface/TextButton.ts";
import { Window } from "../Interface/Window.ts";
import { ErrorMessageState } from "../Menu/ErrorMessageState.ts";
import { INT_MAX } from "../Mod/RuleInterface.ts";
import type { RuleBaseFacility } from "../Mod/RuleBaseFacility.ts";
import type { Base } from "../Savegame/Base.ts";
import { BaseFacility } from "../Savegame/BaseFacility.ts";
import { BaseView } from "./BaseView.ts";

export class PlaceFacilityState extends State {
  protected _view: BaseView;
  protected _btnCancel: TextButton;
  protected _window: Window;
  protected _txtFacility: Text;
  protected _txtCost: Text;
  protected _numCost: Text;
  protected _txtTime: Text;
  protected _numTime: Text;
  protected _txtMaintenance: Text;
  protected _numMaintenance: Text;

  constructor(protected _base: Base, protected _rule: RuleBaseFacility) {
    super();
    this._screen = false;

    this._window = new Window(this, 128, 160, 192, 40);
    this._view = new BaseView(192, 192, 0, 8);
    this._btnCancel = new TextButton(112, 16, 200, 176);
    this._txtFacility = new Text(110, 9, 202, 50);
    this._txtCost = new Text(110, 9, 202, 62);
    this._numCost = new Text(110, 17, 202, 70);
    this._txtTime = new Text(110, 9, 202, 90);
    this._numTime = new Text(110, 17, 202, 98);
    this._txtMaintenance = new Text(110, 9, 202, 118);
    this._numMaintenance = new Text(110, 17, 202, 126);

    this.setInterface("placeFacility");

    this.add(this._window, "window", "placeFacility");
    this.add(this._view, "baseView", "basescape");
    this.add(this._btnCancel, "button", "placeFacility");
    this.add(this._txtFacility, "text", "placeFacility");
    this.add(this._txtCost, "text", "placeFacility");
    this.add(this._numCost, "numbers", "placeFacility");
    this.add(this._txtTime, "text", "placeFacility");
    this.add(this._numTime, "numbers", "placeFacility");
    this.add(this._txtMaintenance, "text", "placeFacility");
    this.add(this._numMaintenance, "numbers", "placeFacility");

    this.centerAllSurfaces();

    const back01 = this.game().getMod()?.getSurface("BACK01.SCR");
    if (back01) {
      this._window.setBackground(back01);
    }

    this._view.setTexture(this.game().getMod()?.getSurfaceSet("BASEBITS.PCK") || null);
    this._view.setBase(this._base);
    this._view.setSelectable(this._rule.getSize());
    this._view.onMouseClick(this.viewClick.bind(this));

    this._btnCancel.setText(String(this.tr("STR_CANCEL")));
    this._btnCancel.onMouseClick(this.btnCancelClick.bind(this));
    this._btnCancel.onKeyboardPress(this.btnCancelClick.bind(this), Options.keyCancel);

    this._txtFacility.setText(String(this.tr(this._rule.getType())));
    this._txtCost.setText(String(this.tr("STR_COST_UC")));
    this._numCost.setBig();
    this._numCost.setText(formatFunding(this._rule.getBuildCost()));
    this._txtTime.setText(String(this.tr("STR_CONSTRUCTION_TIME_UC")));
    this._numTime.setBig();
    this._numTime.setText(String(this.tr("STR_DAY", this._rule.getBuildTime())));
    this._txtMaintenance.setText(String(this.tr("STR_MAINTENANCE_UC")));
    this._numMaintenance.setBig();
    this._numMaintenance.setText(formatFunding(this._rule.getMonthlyCost()));
  }

  btnCancelClick(_action?: Action): void {
    this.game().popState();
  }

  viewClick(_action?: Action): void {
    const error = this.game().getMod()?.getInterface("placeFacility")?.getElement("errorMessage");
    const errorPalette = this.game().getMod()?.getInterface("placeFacility")?.getElement("errorPalette");
    const save = this.game().getSavedGame();
    if (!this._view.isPlaceable(this._rule)) {
      this.game().pushState(new ErrorMessageState(String(this.tr("STR_CANNOT_BUILD_HERE")), this._palette, error?.color ?? 0, "BACK01.SCR", errorPalette?.color ?? -1));
    } else if (!save || save.getFunds() < this._rule.getBuildCost()) {
      this.game().popState();
      this.game().pushState(new ErrorMessageState(String(this.tr("STR_NOT_ENOUGH_MONEY")), this._palette, error?.color ?? 0, "BACK01.SCR", errorPalette?.color ?? -1));
    } else {
      const fac = new BaseFacility(this._rule, this._base);
      fac.setX(this._view.getGridX());
      fac.setY(this._view.getGridY());
      fac.setBuildTime(this._rule.getBuildTime());
      this._base.getFacilities().push(fac);
      if (Options.allowBuildingQueue) {
        if (this._view.isQueuedBuilding(this._rule)) {
          fac.setBuildTime(INT_MAX);
        }
        this._view.reCalcQueuedBuildings();
      }
      save.setFunds(save.getFunds() - this._rule.getBuildCost());
      this.game().popState();
    }
  }
}
