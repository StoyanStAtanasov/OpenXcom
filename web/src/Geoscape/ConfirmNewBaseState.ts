import { Options } from "../Engine/Options.ts";
import { State } from "../Engine/State.ts";
import { formatFunding } from "../Engine/Unicode.ts";
import type { Action } from "../Engine/Action.ts";
import { Text } from "../Interface/Text.ts";
import { TextButton } from "../Interface/TextButton.ts";
import { Window } from "../Interface/Window.ts";
import { ErrorMessageState } from "../Menu/ErrorMessageState.ts";
import type { Base } from "../Savegame/Base.ts";
import { BaseNameState } from "./BaseNameState.ts";
import type { Globe } from "./Globe.ts";

export class ConfirmNewBaseState extends State {
  private _window: Window;
  private _txtCost: Text;
  private _txtArea: Text;
  private _btnOk: TextButton;
  private _btnCancel: TextButton;
  private _cost = 0;

  constructor(private _base: Base, private _globe: Globe) {
    super();
    this._screen = false;

    this._window = new Window(this, 224, 72, 16, 64);
    this._btnOk = new TextButton(54, 12, 68, 104);
    this._btnCancel = new TextButton(54, 12, 138, 104);
    this._txtCost = new Text(120, 9, 68, 80);
    this._txtArea = new Text(120, 9, 68, 90);

    this.setInterface("geoscape");

    this.add(this._window, "genericWindow", "geoscape");
    this.add(this._btnOk, "genericButton2", "geoscape");
    this.add(this._btnCancel, "genericButton2", "geoscape");
    this.add(this._txtCost, "genericText", "geoscape");
    this.add(this._txtArea, "genericText", "geoscape");

    this.centerAllSurfaces();

    const back01 = this.game().getMod()?.getSurface("BACK01.SCR");
    if (back01) {
      this._window.setBackground(back01);
    }

    this._btnOk.setText(String(this.tr("STR_OK")));
    this._btnOk.onMouseClick(this.btnOkClick.bind(this));
    this._btnOk.onKeyboardPress(this.btnOkClick.bind(this), Options.keyOk);

    this._btnCancel.setText(String(this.tr("STR_CANCEL_UC")));
    this._btnCancel.onMouseClick(this.btnCancelClick.bind(this));
    this._btnCancel.onKeyboardPress(this.btnCancelClick.bind(this), Options.keyCancel);

    let area = "";
    const region = this.game().getSavedGame()?.locateRegion(this._base.getLongitude(), this._base.getLatitude());
    if (region) {
      const rules = region.getRules();
      this._cost = rules.getBaseCost();
      area = String(this.tr(rules.getType()));
    }

    this._txtCost.setText(String(this.tr("STR_COST_").arg(formatFunding(this._cost))));
    this._txtArea.setText(String(this.tr("STR_AREA_").arg(area)));
  }

  btnOkClick(_action: Action): void {
    const save = this.game().getSavedGame();
    if (!save || save.getFunds() < this._cost) {
      const element = this.game().getMod()?.getInterface("geoscape")?.getElement("genericWindow");
      const palette = this.game().getMod()?.getInterface("geoscape")?.getElement("palette");
      this.game().pushState(new ErrorMessageState(String(this.tr("STR_NOT_ENOUGH_MONEY")), this._palette, element?.color ?? 0, "BACK01.SCR", palette?.color ?? -1));
      return;
    }
    save.setFunds(save.getFunds() - this._cost);
    if (!save.getBases().includes(this._base)) {
      save.getBases().push(this._base);
    }
    this.game().pushState(new BaseNameState(this._base, this._globe, false));
  }

  btnCancelClick(_action: Action): void {
    this._globe.onMouseOver(null);
    this.game().popState();
  }
}
