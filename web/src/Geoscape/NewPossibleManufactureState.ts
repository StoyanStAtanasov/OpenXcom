import { Options } from "../Engine/Options.ts";
import { State } from "../Engine/State.ts";
import type { Action } from "../Engine/Action.ts";
import { ALIGN_CENTER, Text } from "../Interface/Text.ts";
import { TextButton } from "../Interface/TextButton.ts";
import { TextList } from "../Interface/TextList.ts";
import { Window } from "../Interface/Window.ts";
import { ManufactureState } from "../Basescape/ManufactureState.ts";
import type { RuleManufacture } from "../Mod/RuleManufacture.ts";
import type { Base } from "../Savegame/Base.ts";

export class NewPossibleManufactureState extends State {
  private _window: Window;
  private _txtTitle: Text;
  private _lstPossibilities: TextList;
  private _btnManufacture: TextButton;
  private _btnOk: TextButton;

  constructor(private _base: Base, possibilities: RuleManufacture[]) {
    super();
    this._screen = false;

    this._window = new Window(this, 288, 180, 16, 10);
    this._btnOk = new TextButton(160, 14, 80, 149);
    this._btnManufacture = new TextButton(160, 14, 80, 165);
    this._txtTitle = new Text(288, 40, 16, 20);
    this._lstPossibilities = new TextList(250, 80, 35, 50);

    this.setInterface("geoManufacture");

    this.add(this._window, "window", "geoManufacture");
    this.add(this._btnOk, "button", "geoManufacture");
    this.add(this._btnManufacture, "button", "geoManufacture");
    this.add(this._txtTitle, "text1", "geoManufacture");
    this.add(this._lstPossibilities, "text2", "geoManufacture");

    this.centerAllSurfaces();

    const back17 = this.game().getMod()?.getSurface("BACK17.SCR");
    if (back17) {
      this._window.setBackground(back17);
    }

    this._btnOk.setText(String(this.tr("STR_OK")));
    this._btnOk.onMouseClick(this.btnOkClick.bind(this));
    this._btnOk.onKeyboardPress(this.btnOkClick.bind(this), Options.keyCancel);

    this._btnManufacture.setText(String(this.tr("STR_ALLOCATE_MANUFACTURE")));
    this._btnManufacture.onMouseClick(this.btnManufactureClick.bind(this));
    this._btnManufacture.onKeyboardPress(this.btnManufactureClick.bind(this), Options.keyOk);

    this._txtTitle.setBig();
    this._txtTitle.setAlign(ALIGN_CENTER);
    this._txtTitle.setText(String(this.tr("STR_WE_CAN_NOW_PRODUCE")));

    this._lstPossibilities.setColumns(1, 250);
    this._lstPossibilities.setBig();
    this._lstPossibilities.setAlign(ALIGN_CENTER);
    this._lstPossibilities.setScrolling(true, 0);
    for (const possibility of possibilities) {
      this._lstPossibilities.addRow(1, String(this.tr(possibility.getName())));
    }
  }

  btnOkClick(_action?: Action): void {
    this.game().popState();
  }

  btnManufactureClick(_action?: Action): void {
    this.game().popState();
    this.game().pushState(new ManufactureState(this._base));
  }
}
