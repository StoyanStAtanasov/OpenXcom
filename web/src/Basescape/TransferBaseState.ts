import { Options } from "../Engine/Options.ts";
import { State } from "../Engine/State.ts";
import { formatFunding, TOK_COLOR_FLIP } from "../Engine/Unicode.ts";
import type { Action } from "../Engine/Action.ts";
import { Text, ALIGN_CENTER } from "../Interface/Text.ts";
import { TextButton } from "../Interface/TextButton.ts";
import { TextList } from "../Interface/TextList.ts";
import { Window } from "../Interface/Window.ts";
import type { Base } from "../Savegame/Base.ts";
import { TransferItemsState } from "./TransferItemsState.ts";

export class TransferBaseState extends State {
  private _btnCancel: TextButton;
  private _window: Window;
  private _txtTitle: Text;
  private _txtFunds: Text;
  private _txtName: Text;
  private _txtArea: Text;
  private _lstBases: TextList;
  private _bases: Base[] = [];

  constructor(private _base: Base) {
    super();

    this._window = new Window(this, 280, 140, 20, 30);
    this._btnCancel = new TextButton(264, 16, 28, 146);
    this._txtTitle = new Text(270, 17, 25, 38);
    this._txtFunds = new Text(250, 9, 30, 54);
    this._txtName = new Text(130, 17, 28, 64);
    this._txtArea = new Text(130, 17, 160, 64);
    this._lstBases = new TextList(248, 64, 28, 80);

    this.setInterface("transferBaseSelect");

    this.add(this._window, "window", "transferBaseSelect");
    this.add(this._btnCancel, "button", "transferBaseSelect");
    this.add(this._txtTitle, "text", "transferBaseSelect");
    this.add(this._txtFunds, "text", "transferBaseSelect");
    this.add(this._txtName, "text", "transferBaseSelect");
    this.add(this._txtArea, "text", "transferBaseSelect");
    this.add(this._lstBases, "list", "transferBaseSelect");

    this.centerAllSurfaces();

    const back13 = this.game().getMod()?.getSurface("BACK13.SCR");
    if (back13) {
      this._window.setBackground(back13);
    }

    this._btnCancel.setText(String(this.tr("STR_CANCEL")));
    this._btnCancel.onMouseClick(this.btnCancelClick.bind(this));
    this._btnCancel.onKeyboardPress(this.btnCancelClick.bind(this), Options.keyCancel);

    this._txtTitle.setBig();
    this._txtTitle.setAlign(ALIGN_CENTER);
    this._txtTitle.setText(String(this.tr("STR_SELECT_DESTINATION_BASE")));

    this._txtFunds.setText(String(this.tr("STR_CURRENT_FUNDS").arg(formatFunding(this.game().getSavedGame()?.getFunds() || 0))));

    this._txtName.setText(String(this.tr("STR_NAME")));
    this._txtName.setBig();

    this._txtArea.setText(String(this.tr("STR_AREA")));
    this._txtArea.setBig();

    this._lstBases.setColumns(2, 130, 116);
    this._lstBases.setSelectable(true);
    this._lstBases.setBackground(this._window);
    this._lstBases.setMargin(2);
    this._lstBases.onMouseClick(this.lstBasesClick.bind(this));

    const save = this.game().getSavedGame();
    for (const base of save?.getBases() || []) {
      if (base === this._base) {
        continue;
      }
      let area = "";
      for (const region of save?.getRegions() || []) {
        if (region.getRules().insideRegion(base.getLongitude(), base.getLatitude())) {
          area = String(this.tr(region.getRules().getType()));
          break;
        }
      }
      this._lstBases.addRow(2, base.getName(), `${String.fromCharCode(TOK_COLOR_FLIP)}${area}`);
      this._bases.push(base);
    }
  }

  btnCancelClick(_action?: Action): void {
    this.game().popState();
  }

  lstBasesClick(_action?: Action): void {
    const base = this._bases[this._lstBases.getSelectedRow()];
    if (base) {
      this.game().pushState(new TransferItemsState(this._base, base));
    }
  }
}
