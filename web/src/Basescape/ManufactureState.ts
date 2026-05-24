import { Options } from "../Engine/Options.ts";
import { State } from "../Engine/State.ts";
import { formatFunding } from "../Engine/Unicode.ts";
import type { Action } from "../Engine/Action.ts";
import { Text, ALIGN_CENTER, ALIGN_LEFT, ALIGN_RIGHT } from "../Interface/Text.ts";
import { TextButton } from "../Interface/TextButton.ts";
import { TextList } from "../Interface/TextList.ts";
import { Window } from "../Interface/Window.ts";
import type { Base } from "../Savegame/Base.ts";
import type { Production } from "../Savegame/Production.ts";
import { ManufactureInfoState } from "./ManufactureInfoState.ts";
import { NewManufactureListState } from "./NewManufactureListState.ts";

const INFINITY = "\u221e";

export class ManufactureState extends State {
  private _btnNew: TextButton;
  private _btnOk: TextButton;
  private _window: Window;
  private _txtTitle: Text;
  private _txtAvailable: Text;
  private _txtAllocated: Text;
  private _txtSpace: Text;
  private _txtFunds: Text;
  private _txtItem: Text;
  private _txtEngineers: Text;
  private _txtProduced: Text;
  private _txtCost: Text;
  private _txtTimeLeft: Text;
  private _lstManufacture: TextList;

  constructor(private _base: Base) {
    super();

    this._window = new Window(this, 320, 200, 0, 0);
    this._btnNew = new TextButton(148, 16, 8, 176);
    this._btnOk = new TextButton(148, 16, 164, 176);
    this._txtTitle = new Text(310, 17, 5, 8);
    this._txtAvailable = new Text(150, 9, 8, 24);
    this._txtAllocated = new Text(150, 9, 160, 24);
    this._txtSpace = new Text(150, 9, 8, 34);
    this._txtFunds = new Text(150, 9, 160, 34);
    this._txtItem = new Text(80, 9, 10, 52);
    this._txtEngineers = new Text(56, 18, 112, 44);
    this._txtProduced = new Text(56, 18, 168, 44);
    this._txtCost = new Text(44, 27, 222, 44);
    this._txtTimeLeft = new Text(60, 27, 260, 44);
    this._lstManufacture = new TextList(288, 88, 8, 80);

    this.setInterface("manufactureMenu");

    this.add(this._window, "window", "manufactureMenu");
    this.add(this._btnNew, "button", "manufactureMenu");
    this.add(this._btnOk, "button", "manufactureMenu");
    this.add(this._txtTitle, "text1", "manufactureMenu");
    this.add(this._txtAvailable, "text1", "manufactureMenu");
    this.add(this._txtAllocated, "text1", "manufactureMenu");
    this.add(this._txtSpace, "text1", "manufactureMenu");
    this.add(this._txtFunds, "text1", "manufactureMenu");
    this.add(this._txtItem, "text2", "manufactureMenu");
    this.add(this._txtEngineers, "text2", "manufactureMenu");
    this.add(this._txtProduced, "text2", "manufactureMenu");
    this.add(this._txtCost, "text2", "manufactureMenu");
    this.add(this._txtTimeLeft, "text2", "manufactureMenu");
    this.add(this._lstManufacture, "list", "manufactureMenu");

    this.centerAllSurfaces();

    const background = this.game().getMod()?.getSurface("BACK17.SCR");
    if (background) {
      this._window.setBackground(background);
    }

    this._btnNew.setText(String(this.tr("STR_NEW_PRODUCTION")));
    this._btnNew.onMouseClick(this.btnNewProductionClick.bind(this));

    this._btnOk.setText(String(this.tr("STR_OK")));
    this._btnOk.onMouseClick(this.btnOkClick.bind(this));
    this._btnOk.onKeyboardPress(this.btnOkClick.bind(this), Options.keyCancel);

    this._txtTitle.setBig();
    this._txtTitle.setAlign(ALIGN_CENTER);
    this._txtTitle.setText(String(this.tr("STR_CURRENT_PRODUCTION")));

    this._txtItem.setText(String(this.tr("STR_ITEM")));

    this._txtEngineers.setText(String(this.tr("STR_ENGINEERS__ALLOCATED")));
    this._txtEngineers.setWordWrap(true);

    this._txtProduced.setText(String(this.tr("STR_UNITS_PRODUCED")));
    this._txtProduced.setWordWrap(true);

    this._txtCost.setText(String(this.tr("STR_COST__PER__UNIT")));
    this._txtCost.setWordWrap(true);

    this._txtTimeLeft.setText(String(this.tr("STR_DAYS_HOURS_LEFT")));
    this._txtTimeLeft.setWordWrap(true);

    this._lstManufacture.setColumns(5, 115, 15, 52, 56, 48);
    this._lstManufacture.setAlign(ALIGN_RIGHT);
    this._lstManufacture.setAlign(ALIGN_LEFT, 0);
    this._lstManufacture.setSelectable(true);
    this._lstManufacture.setBackground(this._window);
    this._lstManufacture.setMargin(2);
    this._lstManufacture.setWordWrap(true);
    this._lstManufacture.onMouseClick(this.lstManufactureClick.bind(this));
    this.fillProductionList();
  }

  override init(): void {
    super.init();
    this.fillProductionList();
  }

  btnOkClick(_action?: Action): void {
    this.game().popState();
  }

  btnNewProductionClick(_action?: Action): void {
    this.game().pushState(new NewManufactureListState(this._base));
  }

  fillProductionList(): void {
    const productions = [...this._base.getProductions()] as Production[];
    this._lstManufacture.clearList();
    for (const production of productions) {
      const s1 = `${production.getAssignedEngineers()}`;
      let s2 = `${production.getAmountProduced()}/`;
      if (production.getInfiniteAmount()) s2 += INFINITY;
      else s2 += `${production.getAmountTotal()}`;
      if (production.getSellItems()) s2 += " $";
      const s3 = formatFunding(production.getRules().getManufactureCost());
      let s4 = "";
      if (production.getInfiniteAmount()) {
        s4 = INFINITY;
      } else if (production.getAssignedEngineers() > 0) {
        const timeLeft = production.getAmountTotal() * production.getRules().getManufactureTime() - production.getTimeSpent();
        const numEffectiveEngineers = production.getAssignedEngineers();
        const hoursLeft = Math.trunc((timeLeft + numEffectiveEngineers - 1) / numEffectiveEngineers);
        const daysLeft = Math.trunc(hoursLeft / 24);
        const hours = hoursLeft % 24;
        s4 = `${daysLeft}/${hours}`;
      } else {
        s4 = "-";
      }
      this._lstManufacture.addRow(5, String(this.tr(production.getRules().getName())), s1, s2, s3, s4);
    }
    this._txtAvailable.setText(String(this.tr("STR_ENGINEERS_AVAILABLE").arg(this._base.getAvailableEngineers())));
    this._txtAllocated.setText(String(this.tr("STR_ENGINEERS_ALLOCATED").arg(this._base.getAllocatedEngineers())));
    this._txtSpace.setText(String(this.tr("STR_WORKSHOP_SPACE_AVAILABLE").arg(this._base.getFreeWorkshops())));
    this._txtFunds.setText(String(this.tr("STR_CURRENT_FUNDS").arg(formatFunding(this.game().getSavedGame()?.getFunds() || 0))));
  }

  private lstManufactureClick(_action?: Action): void {
    const selected = this._lstManufacture.getSelectedRow();
    const productions = this._base.getProductions() as Production[];
    const production = selected >= 0 ? productions[selected] : null;
    if (production) {
      this.game().pushState(new ManufactureInfoState(this._base, production));
    }
  }
}
