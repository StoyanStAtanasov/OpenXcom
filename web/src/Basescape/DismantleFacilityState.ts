import { Options } from "../Engine/Options.ts";
import { State } from "../Engine/State.ts";
import { Text, ALIGN_CENTER } from "../Interface/Text.ts";
import { TextButton } from "../Interface/TextButton.ts";
import { Window } from "../Interface/Window.ts";
import type { Base } from "../Savegame/Base.ts";
import type { BaseFacility } from "../Savegame/BaseFacility.ts";
import type { BaseView } from "./BaseView.ts";

export class DismantleFacilityState extends State {
  private _btnOk: TextButton;
  private _btnCancel: TextButton;
  private _window: Window;
  private _txtTitle: Text;
  private _txtFacility: Text;

  constructor(private _base: Base, private _view: BaseView, private _fac: BaseFacility) {
    super();
    this._screen = false;

    this._window = new Window(this, 152, 80, 20, 60);
    this._btnOk = new TextButton(44, 16, 36, 115);
    this._btnCancel = new TextButton(44, 16, 112, 115);
    this._txtTitle = new Text(142, 9, 25, 75);
    this._txtFacility = new Text(142, 9, 25, 85);

    this.setInterface("dismantleFacility");

    this.add(this._window, "window", "dismantleFacility");
    this.add(this._btnOk, "button", "dismantleFacility");
    this.add(this._btnCancel, "button", "dismantleFacility");
    this.add(this._txtTitle, "text", "dismantleFacility");
    this.add(this._txtFacility, "text", "dismantleFacility");

    this.centerAllSurfaces();

    const back13 = this.game().getMod()?.getSurface("BACK13.SCR");
    if (back13) {
      this._window.setBackground(back13);
    }

    this._btnOk.setText(String(this.tr("STR_OK")));
    this._btnOk.onMouseClick(this.btnOkClick.bind(this));
    this._btnOk.onKeyboardPress(this.btnOkClick.bind(this), Options.keyOk);

    this._btnCancel.setText(String(this.tr("STR_CANCEL_UC")));
    this._btnCancel.onMouseClick(this.btnCancelClick.bind(this));
    this._btnCancel.onKeyboardPress(this.btnCancelClick.bind(this), Options.keyCancel);

    this._txtTitle.setAlign(ALIGN_CENTER);
    this._txtTitle.setText(String(this.tr("STR_DISMANTLE")));

    this._txtFacility.setAlign(ALIGN_CENTER);
    this._txtFacility.setText(String(this.tr(this._fac.getRules().getType())));
  }

  btnOkClick(): void {
    if (!this._fac.getRules().isLift()) {
      if (this._fac.getBuildTime() > this._fac.getRules().getBuildTime()) {
        const save = this.game().getSavedGame();
        save?.setFunds(save.getFunds() + this._fac.getRules().getBuildCost());
      }

      const facilities = this._base.getFacilities();
      const index = facilities.indexOf(this._fac);
      if (index !== -1) {
        facilities.splice(index, 1);
        this._view.resetSelectedFacility();
        if (Options.allowBuildingQueue) {
          this._view.reCalcQueuedBuildings();
        }
      }
    } else {
      const bases = this.game().getSavedGame()?.getBases() || [];
      const index = bases.indexOf(this._base);
      if (index !== -1) {
        bases.splice(index, 1);
      }
    }
    this.game().popState();
  }

  btnCancelClick(): void {
    this.game().popState();
  }
}
