import { Options } from "../Engine/Options.ts";
import { State } from "../Engine/State.ts";
import { formatFunding, TOK_COLOR_FLIP } from "../Engine/Unicode.ts";
import type { Action } from "../Engine/Action.ts";
import { Text, ALIGN_CENTER } from "../Interface/Text.ts";
import { TextButton } from "../Interface/TextButton.ts";
import { TextList } from "../Interface/TextList.ts";
import { Window } from "../Interface/Window.ts";
import type { Base } from "../Savegame/Base.ts";

export class MonthlyCostsState extends State {
  private _btnOk: TextButton;
  private _window: Window;
  private _txtTitle: Text;
  private _txtCost: Text;
  private _txtQuantity: Text;
  private _txtTotal: Text;
  private _txtRental: Text;
  private _txtSalaries: Text;
  private _txtIncome: Text;
  private _txtMaintenance: Text;
  private _lstCrafts: TextList;
  private _lstSalaries: TextList;
  private _lstMaintenance: TextList;
  private _lstTotal: TextList;

  constructor(private _base: Base) {
    super();

    this._window = new Window(this, 320, 200, 0, 0);
    this._btnOk = new TextButton(300, 20, 10, 170);
    this._txtTitle = new Text(310, 17, 5, 12);
    this._txtCost = new Text(80, 9, 115, 32);
    this._txtQuantity = new Text(55, 9, 195, 32);
    this._txtTotal = new Text(60, 9, 249, 32);
    this._txtRental = new Text(150, 9, 10, 40);
    this._txtSalaries = new Text(150, 9, 10, 80);
    this._txtIncome = new Text(150, 9, 10, 146);
    this._txtMaintenance = new Text(150, 9, 10, 154);
    this._lstCrafts = new TextList(288, 32, 10, 48);
    this._lstSalaries = new TextList(288, 40, 10, 88);
    this._lstMaintenance = new TextList(300, 9, 10, 128);
    this._lstTotal = new TextList(100, 9, 205, 150);

    this.setInterface("costsInfo");

    this.add(this._window, "window", "costsInfo");
    this.add(this._btnOk, "button", "costsInfo");
    this.add(this._txtTitle, "text1", "costsInfo");
    this.add(this._txtCost, "text1", "costsInfo");
    this.add(this._txtQuantity, "text1", "costsInfo");
    this.add(this._txtTotal, "text1", "costsInfo");
    this.add(this._txtRental, "text1", "costsInfo");
    this.add(this._lstCrafts, "list", "costsInfo");
    this.add(this._txtSalaries, "text1", "costsInfo");
    this.add(this._lstSalaries, "list", "costsInfo");
    this.add(this._lstMaintenance, "text1", "costsInfo");
    this.add(this._txtIncome, "list", "costsInfo");
    this.add(this._txtMaintenance, "list", "costsInfo");
    this.add(this._lstTotal, "text2", "costsInfo");

    this.centerAllSurfaces();

    const back13 = this.game().getMod()?.getSurface("BACK13.SCR");
    if (back13) {
      this._window.setBackground(back13);
    }

    this._btnOk.setText(String(this.tr("STR_OK")));
    this._btnOk.onMouseClick(this.btnOkClick.bind(this));
    this._btnOk.onKeyboardPress(this.btnOkClick.bind(this), Options.keyOk);
    this._btnOk.onKeyboardPress(this.btnOkClick.bind(this), Options.keyCancel);

    this._txtTitle.setBig();
    this._txtTitle.setAlign(ALIGN_CENTER);
    this._txtTitle.setText(String(this.tr("STR_MONTHLY_COSTS")));
    this._txtCost.setText(String(this.tr("STR_COST_PER_UNIT")));
    this._txtQuantity.setText(String(this.tr("STR_QUANTITY")));
    this._txtTotal.setText(String(this.tr("STR_TOTAL")));
    this._txtRental.setText(String(this.tr("STR_CRAFT_RENTAL")));
    this._txtSalaries.setText(String(this.tr("STR_SALARIES")));

    const save = this.game().getSavedGame();
    this._txtIncome.setText(`${this.tr("STR_INCOME")}=${formatFunding(save?.getCountryFunding() || 0)}`);
    this._txtMaintenance.setText(`${this.tr("STR_MAINTENANCE")}=${formatFunding(save?.getBaseMaintenance() || 0)}`);

    const mod = this.game().getMod();
    this._lstCrafts.setColumns(4, 125, 70, 44, 50);
    this._lstCrafts.setDot(true);
    if (mod) {
      for (const type of mod.getCraftsList()) {
        const craft = mod.getCraft(type);
        if (craft && craft.getRentCost() !== 0 && save?.isResearched(craft.getRequirements())) {
          const count = this._base.getCraftCount(type);
          this._lstCrafts.addRow(4, String(this.tr(type)), formatFunding(craft.getRentCost()), `${count}`, formatFunding(count * craft.getRentCost()));
        }
      }
    }

    this._lstSalaries.setColumns(4, 125, 70, 44, 50);
    this._lstSalaries.setDot(true);
    if (mod) {
      const soldiers = mod.getSoldiersList();
      for (const type of soldiers) {
        const soldier = mod.getSoldier(type);
        if (soldier && soldier.getSalaryCost() !== 0 && save?.isResearched(soldier.getRequirements())) {
          const count = this._base.getSoldierCount(type);
          const name = soldiers.length === 1 ? "STR_SOLDIERS" : type;
          this._lstSalaries.addRow(4, String(this.tr(name)), formatFunding(soldier.getSalaryCost()), `${count}`, formatFunding(count * soldier.getSalaryCost()));
        }
      }
      this._lstSalaries.addRow(4, String(this.tr("STR_ENGINEERS")), formatFunding(mod.getEngineerCost()), `${this._base.getTotalEngineers()}`, formatFunding(this._base.getTotalEngineers() * mod.getEngineerCost()));
      this._lstSalaries.addRow(4, String(this.tr("STR_SCIENTISTS")), formatFunding(mod.getScientistCost()), `${this._base.getTotalScientists()}`, formatFunding(this._base.getTotalScientists() * mod.getScientistCost()));
    }

    this._lstMaintenance.setColumns(2, 239, 60);
    this._lstMaintenance.setDot(true);
    this._lstMaintenance.addRow(2, String(this.tr("STR_BASE_MAINTENANCE")), `${String.fromCharCode(TOK_COLOR_FLIP)}${formatFunding(this._base.getFacilityMaintenance())}`);

    this._lstTotal.setColumns(2, 44, 55);
    this._lstTotal.setDot(true);
    this._lstTotal.addRow(2, String(this.tr("STR_TOTAL")), formatFunding(this._base.getMonthlyMaintenace()));
  }

  btnOkClick(_action?: Action): void {
    this.game().popState();
  }
}
