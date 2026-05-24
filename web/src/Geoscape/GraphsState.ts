import type { Action } from "../Engine/Action.ts";
import { InteractiveSurface } from "../Engine/InteractiveSurface.ts";
import { Options } from "../Engine/Options.ts";
import { Palette } from "../Engine/Palette.ts";
import { State } from "../Engine/State.ts";
import { Surface } from "../Engine/Surface.ts";
import { formatNumber } from "../Engine/Unicode.ts";
import { Text, ALIGN_CENTER, ALIGN_RIGHT } from "../Interface/Text.ts";
import { TextList } from "../Interface/TextList.ts";
import { ToggleTextButton } from "../Interface/ToggleTextButton.ts";
import type { SavedGame } from "../Savegame/SavedGame.ts";
import { SDL_BUTTON_WHEELDOWN, SDL_BUTTON_WHEELUP } from "../types.ts";

type GraphSavedGame = SavedGame & {
  getFundsList?: () => number[];
  getMaintenances?: () => number[];
  getIncomes?: () => number[];
  getExpenditures?: () => number[];
  getGraphRegionToggles?: () => string;
  getGraphCountryToggles?: () => string;
  getGraphFinanceToggles?: () => string;
  setGraphRegionToggles?: (toggles: string) => void;
  setGraphCountryToggles?: (toggles: string) => void;
  setGraphFinanceToggles?: (toggles: string) => void;
};

class GraphButInfo {
  _pushed = false;

  constructor(public _name: string, public _color: number) {}
}

/**
 * Graphs screen for displaying graphs of various
 * monthly game data like activity and funding.
 */
export class GraphsState extends State {
  private _bg: InteractiveSurface;
  private _btnGeoscape: InteractiveSurface;
  private _btnXcomCountry: InteractiveSurface;
  private _btnUfoCountry: InteractiveSurface;
  private _btnXcomRegion: InteractiveSurface;
  private _btnUfoRegion: InteractiveSurface;
  private _btnIncome: InteractiveSurface;
  private _btnFinance: InteractiveSurface;
  private _txtTitle: Text;
  private _txtFactor: Text;
  private _txtMonths: TextList;
  private _txtYears: TextList;
  private _txtScale: Text[] = [];
  private _btnRegions: ToggleTextButton[] = [];
  private _btnCountries: ToggleTextButton[] = [];
  private _btnFinances: ToggleTextButton[] = [];
  private _regionToggles: GraphButInfo[] = [];
  private _countryToggles: GraphButInfo[] = [];
  private _financeToggles: boolean[] = [];
  private _btnRegionTotal!: ToggleTextButton;
  private _btnCountryTotal!: ToggleTextButton;
  private _alienRegionLines: Surface[] = [];
  private _alienCountryLines: Surface[] = [];
  private _xcomRegionLines: Surface[] = [];
  private _xcomCountryLines: Surface[] = [];
  private _financeLines: Surface[] = [];
  private _incomeLines: Surface[] = [];
  private _alien = false;
  private _income = false;
  private _country = false;
  private _finance = false;
  private static readonly GRAPH_MAX_BUTTONS = 16;
  private _butRegionsOffset = 0;
  private _butCountriesOffset = 0;

  constructor() {
    super();

    this._bg = new InteractiveSurface(320, 200, 0, 0);
    this._bg.onMousePress(this.shiftButtons.bind(this), SDL_BUTTON_WHEELUP);
    this._bg.onMousePress(this.shiftButtons.bind(this), SDL_BUTTON_WHEELDOWN);
    this._btnUfoRegion = new InteractiveSurface(32, 24, 96, 0);
    this._btnUfoCountry = new InteractiveSurface(32, 24, 128, 0);
    this._btnXcomRegion = new InteractiveSurface(32, 24, 160, 0);
    this._btnXcomCountry = new InteractiveSurface(32, 24, 192, 0);
    this._btnIncome = new InteractiveSurface(32, 24, 224, 0);
    this._btnFinance = new InteractiveSurface(32, 24, 256, 0);
    this._btnGeoscape = new InteractiveSurface(32, 24, 288, 0);
    this._txtTitle = new Text(230, 16, 90, 28);
    this._txtFactor = new Text(38, 11, 96, 28);
    this._txtMonths = new TextList(205, 8, 115, 183);
    this._txtYears = new TextList(200, 8, 121, 191);

    this.setInterface("graphs");

    this.add(this._bg);
    this.add(this._btnUfoRegion);
    this.add(this._btnUfoCountry);
    this.add(this._btnXcomRegion);
    this.add(this._btnXcomCountry);
    this.add(this._btnIncome);
    this.add(this._btnFinance);
    this.add(this._btnGeoscape);
    this.add(this._txtMonths, "scale", "graphs");
    this.add(this._txtYears, "scale", "graphs");
    this.add(this._txtTitle, "text", "graphs");
    this.add(this._txtFactor, "text", "graphs");
    for (let scaleText = 0; scaleText !== 10; ++scaleText) {
      const text = new Text(42, 16, 80, 171 - scaleText * 14);
      this._txtScale.push(text);
      this.add(text, "scale", "graphs");
    }

    const save = this.game().getSavedGame() as GraphSavedGame | null;
    const regionTotalColor = this.interfaceColor("regionTotal", "color", 13);
    const countryTotalColor = this.interfaceColor("countryTotal", "color", 13);

    let offset = 0;
    for (const region of save?.getRegions() || []) {
      const color = 13 + 8 * (offset % GraphsState.GRAPH_MAX_BUTTONS);
      this._regionToggles.push(new GraphButInfo(String(this.tr(region.getRules().getType())), color));
      if (offset < GraphsState.GRAPH_MAX_BUTTONS) {
        const button = new ToggleTextButton(88, 11, 0, offset * 11);
        button.setText(String(this.tr(region.getRules().getType())));
        button.setInvertColor(color);
        button.onMousePress(this.btnRegionListClick.bind(this));
        this._btnRegions.push(button);
        this.add(button, "button", "graphs");
      }
      this._alienRegionLines.push(new Surface(320, 200, 0, 0));
      this.add(this._alienRegionLines[offset]);
      this._xcomRegionLines.push(new Surface(320, 200, 0, 0));
      this.add(this._xcomRegionLines[offset]);
      ++offset;
    }

    this._btnRegionTotal = new ToggleTextButton(88, 11, 0, this._regionToggles.length < GraphsState.GRAPH_MAX_BUTTONS ? this._regionToggles.length * 11 : GraphsState.GRAPH_MAX_BUTTONS * 11);
    this._regionToggles.push(new GraphButInfo(String(this.tr("STR_TOTAL_UC")), regionTotalColor));
    this._btnRegionTotal.onMousePress(this.btnRegionListClick.bind(this));
    this._btnRegionTotal.setInvertColor(regionTotalColor);
    this._btnRegionTotal.setText(String(this.tr("STR_TOTAL_UC")));
    this._alienRegionLines.push(new Surface(320, 200, 0, 0));
    this.add(this._alienRegionLines[offset]);
    this._xcomRegionLines.push(new Surface(320, 200, 0, 0));
    this.add(this._xcomRegionLines[offset]);
    this.add(this._btnRegionTotal, "button", "graphs");

    offset = 0;
    for (const country of save?.getCountries() || []) {
      const color = 13 + 8 * (offset % GraphsState.GRAPH_MAX_BUTTONS);
      this._countryToggles.push(new GraphButInfo(String(this.tr(country.getRules().getType())), color));
      if (offset < GraphsState.GRAPH_MAX_BUTTONS) {
        const button = new ToggleTextButton(88, 11, 0, offset * 11);
        button.setInvertColor(color);
        button.setText(String(this.tr(country.getRules().getType())));
        button.onMousePress(this.btnCountryListClick.bind(this));
        this._btnCountries.push(button);
        this.add(button, "button", "graphs");
      }
      this._alienCountryLines.push(new Surface(320, 200, 0, 0));
      this.add(this._alienCountryLines[offset]);
      this._xcomCountryLines.push(new Surface(320, 200, 0, 0));
      this.add(this._xcomCountryLines[offset]);
      this._incomeLines.push(new Surface(320, 200, 0, 0));
      this.add(this._incomeLines[offset]);
      ++offset;
    }

    this._btnCountryTotal = new ToggleTextButton(88, 11, 0, this._countryToggles.length < GraphsState.GRAPH_MAX_BUTTONS ? this._countryToggles.length * 11 : GraphsState.GRAPH_MAX_BUTTONS * 11);
    this._countryToggles.push(new GraphButInfo(String(this.tr("STR_TOTAL_UC")), countryTotalColor));
    this._btnCountryTotal.onMousePress(this.btnCountryListClick.bind(this));
    this._btnCountryTotal.setInvertColor(countryTotalColor);
    this._btnCountryTotal.setText(String(this.tr("STR_TOTAL_UC")));
    this._alienCountryLines.push(new Surface(320, 200, 0, 0));
    this.add(this._alienCountryLines[offset]);
    this._xcomCountryLines.push(new Surface(320, 200, 0, 0));
    this.add(this._xcomCountryLines[offset]);
    this._incomeLines.push(new Surface(320, 200, 0, 0));
    this.add(this._incomeLines[offset]);
    this.add(this._btnCountryTotal, "button", "graphs");

    for (let iter = 0; iter !== 5; ++iter) {
      offset = iter;
      const button = new ToggleTextButton(88, 11, 0, offset * 11);
      this._btnFinances.push(button);
      this._financeToggles.push(false);
      button.setInvertColor(13 + 8 * offset);
      button.onMousePress(this.btnFinanceListClick.bind(this));
      this.add(button, "button", "graphs");
      this._financeLines.push(new Surface(320, 200, 0, 0));
      this.add(this._financeLines[offset]);
    }

    this._btnFinances[0].setText(String(this.tr("STR_INCOME")));
    this._btnFinances[1].setText(String(this.tr("STR_EXPENDITURE")));
    this._btnFinances[2].setText(String(this.tr("STR_MAINTENANCE")));
    this._btnFinances[3].setText(String(this.tr("STR_BALANCE")));
    this._btnFinances[4].setText(String(this.tr("STR_SCORE")));

    this.loadButtonStates(save);

    const gridColor = this.interfaceColor("graph", "color", 1);
    this._bg.drawRect(125, 49, 188, 127, gridColor);
    for (let grid = 0; grid !== 5; ++grid) {
      for (let y = 50 + grid; y <= 163 + grid; y += 14) {
        for (let x = 126 + grid; x <= 297 + grid; x += 17) {
          let color = gridColor + grid + 1;
          if (grid === 4) {
            color = 0;
          }
          this._bg.drawRect(x, y, 16 - grid * 2, 13 - grid * 2, color);
        }
      }
    }

    const months = ["STR_JAN", "STR_FEB", "STR_MAR", "STR_APR", "STR_MAY", "STR_JUN", "STR_JUL", "STR_AUG", "STR_SEP", "STR_OCT", "STR_NOV", "STR_DEC"];
    let month = save?.getTime().getMonth() || 1;
    this._txtMonths.setColumns(12, 17, 17, 17, 17, 17, 17, 17, 17, 17, 17, 17, 17);
    this._txtMonths.addRow(12, " ", " ", " ", " ", " ", " ", " ", " ", " ", " ", " ", " ");
    this._txtYears.setColumns(6, 34, 34, 34, 34, 34, 34);
    this._txtYears.addRow(6, " ", " ", " ", " ", " ", " ");
    for (let iter = 0; iter !== 12; ++iter) {
      if (month > 11) {
        month = 0;
        const year = save?.getTime().getYear() || 0;
        this._txtYears.setCellText(0, Math.trunc(iter / 2), `${year}`);
        if (iter > 2) {
          this._txtYears.setCellText(0, 0, `${year - 1}`);
        }
      }
      this._txtMonths.setCellText(0, iter, String(this.tr(months[month])));
      ++month;
    }

    for (const text of this._txtScale) {
      text.setAlign(ALIGN_RIGHT);
    }
    this.btnUfoRegionClick();

    const graphBdy = this.game().getMod()?.getSurface("GRAPH.BDY");
    const graphsSpk = this.game().getMod()?.getSurface("GRAPHS.SPK");
    if (graphBdy) {
      graphBdy.blit(this._bg);
    } else if (graphsSpk) {
      graphsSpk.blit(this._bg);
    }

    this._txtTitle.setAlign(ALIGN_CENTER);
    this._txtFactor.setText(String(this.tr("STR_FINANCE_THOUSANDS")));

    this._btnUfoRegion.onMousePress(this.btnUfoRegionClick.bind(this));
    this._btnUfoCountry.onMousePress(this.btnUfoCountryClick.bind(this));
    this._btnXcomRegion.onMousePress(this.btnXcomRegionClick.bind(this));
    this._btnXcomCountry.onMousePress(this.btnXcomCountryClick.bind(this));
    this._btnIncome.onMousePress(this.btnIncomeClick.bind(this));
    this._btnFinance.onMousePress(this.btnFinanceClick.bind(this));
    this._btnGeoscape.onMousePress(this.btnGeoscapeClick.bind(this));
    this._btnGeoscape.onKeyboardPress(this.btnGeoscapeClick.bind(this), Options.keyCancel);
    this._btnGeoscape.onKeyboardPress(this.btnGeoscapeClick.bind(this), Options.keyGeoGraphs);

    this.centerAllSurfaces();
  }

  btnGeoscapeClick(_action?: Action): void {
    this.saveButtonStates();
    this.game().popState();
  }

  btnUfoRegionClick(_action?: Action): void {
    this._alien = true;
    this._income = false;
    this._country = false;
    this._finance = false;
    this.resetScreen();
    this.drawLines();
    for (const button of this._btnRegions) {
      button.setVisible(true);
    }
    this._btnRegionTotal.setVisible(true);
    this._txtTitle.setBig();
    this._txtTitle.setText(String(this.tr("STR_UFO_ACTIVITY_IN_AREAS")));
  }

  btnUfoCountryClick(_action?: Action): void {
    this._alien = true;
    this._income = false;
    this._country = true;
    this._finance = false;
    this.resetScreen();
    this.drawLines();
    for (const button of this._btnCountries) {
      button.setVisible(true);
    }
    this._btnCountryTotal.setVisible(true);
    this._txtTitle.setBig();
    this._txtTitle.setText(String(this.tr("STR_UFO_ACTIVITY_IN_COUNTRIES")));
  }

  btnXcomRegionClick(_action?: Action): void {
    this._alien = false;
    this._income = false;
    this._country = false;
    this._finance = false;
    this.resetScreen();
    this.drawLines();
    for (const button of this._btnRegions) {
      button.setVisible(true);
    }
    this._btnRegionTotal.setVisible(true);
    this._txtTitle.setBig();
    this._txtTitle.setText(String(this.tr("STR_XCOM_ACTIVITY_IN_AREAS")));
  }

  btnXcomCountryClick(_action?: Action): void {
    this._alien = false;
    this._income = false;
    this._country = true;
    this._finance = false;
    this.resetScreen();
    this.drawLines();
    for (const button of this._btnCountries) {
      button.setVisible(true);
    }
    this._btnCountryTotal.setVisible(true);
    this._txtTitle.setBig();
    this._txtTitle.setText(String(this.tr("STR_XCOM_ACTIVITY_IN_COUNTRIES")));
  }

  btnIncomeClick(_action?: Action): void {
    this._alien = false;
    this._income = true;
    this._country = true;
    this._finance = false;
    this.resetScreen();
    this.drawLines();
    this._txtFactor.setVisible(true);
    for (const button of this._btnCountries) {
      button.setVisible(true);
    }
    this._btnCountryTotal.setVisible(true);
    this._txtTitle.setBig();
    this._txtTitle.setText(String(this.tr("STR_INCOME")));
  }

  btnFinanceClick(_action?: Action): void {
    this._alien = false;
    this._income = false;
    this._country = false;
    this._finance = true;
    this.resetScreen();
    this.drawLines();
    for (const button of this._btnFinances) {
      button.setVisible(true);
    }
    this._txtTitle.setBig();
    this._txtTitle.setText(String(this.tr("STR_FINANCE")));
  }

  btnRegionListClick(action?: Action): void {
    let number = 0;
    const button = action?.getSender() as ToggleTextButton | null;
    if (!button) {
      return;
    }

    if (button === this._btnRegionTotal) {
      number = this._regionToggles.length - 1;
    } else {
      for (let i = 0; i < this._btnRegions.length; ++i) {
        if (button === this._btnRegions[i]) {
          number = i + this._butRegionsOffset;
          break;
        }
      }
    }
    this._regionToggles[number]._pushed = button.getPressed();
    this.drawLines();
  }

  btnCountryListClick(action?: Action): void {
    let number = 0;
    const button = action?.getSender() as ToggleTextButton | null;
    if (!button) {
      return;
    }

    if (button === this._btnCountryTotal) {
      number = this._countryToggles.length - 1;
    } else {
      for (let i = 0; i < this._btnCountries.length; ++i) {
        if (button === this._btnCountries[i]) {
          number = i + this._butCountriesOffset;
          break;
        }
      }
    }
    this._countryToggles[number]._pushed = button.getPressed();
    this.drawLines();
  }

  btnFinanceListClick(action?: Action): void {
    let number = 0;
    const button = action?.getSender() as ToggleTextButton | null;
    if (!button) {
      return;
    }
    for (let i = 0; i < this._btnFinances.length; ++i) {
      if (button === this._btnFinances[i]) {
        number = i;
        break;
      }
    }
    this._financeLines[number].setVisible(!this._financeToggles[number]);
    this._financeToggles[number] = button.getPressed();
    this.drawLines();
  }

  resetScreen(): void {
    for (const surface of this._alienRegionLines) surface.setVisible(false);
    for (const surface of this._alienCountryLines) surface.setVisible(false);
    for (const surface of this._xcomRegionLines) surface.setVisible(false);
    for (const surface of this._xcomCountryLines) surface.setVisible(false);
    for (const surface of this._incomeLines) surface.setVisible(false);
    for (const surface of this._financeLines) surface.setVisible(false);
    for (const button of this._btnRegions) button.setVisible(false);
    for (const button of this._btnCountries) button.setVisible(false);
    for (const button of this._btnFinances) button.setVisible(false);
    this._btnRegionTotal.setVisible(false);
    this._btnCountryTotal.setVisible(false);
    this._txtFactor.setVisible(false);
  }

  updateScale(lowerLimit: number, upperLimit: number): void {
    let increment = (upperLimit - lowerLimit) / 9;
    if (increment < 10) {
      increment = 10;
    }
    let text = lowerLimit;
    for (let i = 0; i < 10; ++i) {
      this._txtScale[i].setText(formatNumber(Math.trunc(text)));
      text += increment;
    }
  }

  drawLines(): void {
    if (!this._country && !this._finance) {
      this.drawRegionLines();
    } else if (!this._finance) {
      this.drawCountryLines();
    } else {
      this.drawFinanceLines();
    }
  }

  drawCountryLines(): void {
    const save = this.game().getSavedGame() as GraphSavedGame | null;
    if (!save) {
      return;
    }
    let upperLimit = 0;
    let lowerLimit = 0;
    const totals = this.zero12();
    for (let entry = 0; entry !== this.graphLength(save); ++entry) {
      let total = 0;
      if (this._alien) {
        for (let iter = 0; iter !== save.getCountries().length; ++iter) {
          const activity = this.atNumber(save.getCountries()[iter].getActivityAlien(), entry);
          total += activity;
          if (activity > upperLimit && this._countryToggles[iter]._pushed) upperLimit = activity;
        }
      } else if (this._income) {
        for (let iter = 0; iter !== save.getCountries().length; ++iter) {
          const funding = this.idiv(this.atNumber(save.getCountries()[iter].getFunding(), entry), 1000);
          total += funding;
          if (funding > upperLimit && this._countryToggles[iter]._pushed) upperLimit = funding;
        }
      } else {
        for (let iter = 0; iter !== save.getCountries().length; ++iter) {
          const activity = this.atNumber(save.getCountries()[iter].getActivityXcom(), entry);
          total += activity;
          if (activity > upperLimit && this._countryToggles[iter]._pushed) upperLimit = activity;
          if (activity < lowerLimit && this._countryToggles[iter]._pushed) lowerLimit = activity;
        }
      }
      if (this._countryToggles.at(-1)?._pushed && total > upperLimit) upperLimit = total;
      if (this._countryToggles.at(-1)?._pushed && total < lowerLimit) lowerLimit = total;
    }

    let range = upperLimit - lowerLimit;
    const low = lowerLimit;
    let check = this._income ? 50 : 10;
    const grids = 9;
    while (range > check * grids) {
      check *= 2;
    }
    lowerLimit = 0;
    upperLimit = check * grids;
    if (low < 0) {
      while (low < lowerLimit) {
        lowerLimit -= check;
        upperLimit -= check;
      }
    }
    range = upperLimit - lowerLimit;
    const units = range / 126;

    for (let entry = 0; entry !== save.getCountries().length; ++entry) {
      const country = save.getCountries()[entry];
      this._alienCountryLines[entry].clear();
      this._xcomCountryLines[entry].clear();
      this._incomeLines[entry].clear();
      const newLineVector: number[] = [];
      for (let iter = 0; iter !== 12; ++iter) {
        const x = 312 - iter * 17;
        let y = Math.trunc(175 - (-lowerLimit / units));
        let value = 0;
        if (this._alien) {
          if (iter < country.getActivityAlien().length) {
            value = this.atNumber(country.getActivityAlien(), country.getActivityAlien().length - (1 + iter));
            y -= Math.trunc(value / units);
            totals[iter] += value;
          }
        } else if (this._income) {
          if (iter < country.getFunding().length) {
            value = this.idiv(this.atNumber(country.getFunding(), country.getFunding().length - (1 + iter)), 1000);
            y -= Math.trunc(value / units);
            totals[iter] += value;
          }
        } else if (iter < country.getActivityXcom().length) {
          value = this.atNumber(country.getActivityXcom(), country.getActivityXcom().length - (1 + iter));
          y -= Math.trunc(value / units);
          totals[iter] += value;
        }
        if (y >= 175) y = 175;
        newLineVector.push(y);
        if (newLineVector.length > 1 && this._alien) {
          this._alienCountryLines[entry].drawLine(x, y, x + 17, newLineVector[newLineVector.length - 2], this._countryToggles[entry]._color + 4);
        } else if (newLineVector.length > 1 && this._income) {
          this._incomeLines[entry].drawLine(x, y, x + 17, newLineVector[newLineVector.length - 2], this._countryToggles[entry]._color + 4);
        } else if (newLineVector.length > 1) {
          this._xcomCountryLines[entry].drawLine(x, y, x + 17, newLineVector[newLineVector.length - 2], this._countryToggles[entry]._color + 4);
        }
      }
      if (this._alien) this._alienCountryLines[entry].setVisible(this._countryToggles[entry]._pushed);
      else if (this._income) this._incomeLines[entry].setVisible(this._countryToggles[entry]._pushed);
      else this._xcomCountryLines[entry].setVisible(this._countryToggles[entry]._pushed);
    }

    if (this._alien) this._alienCountryLines.at(-1)?.clear();
    else if (this._income) this._incomeLines.at(-1)?.clear();
    else this._xcomCountryLines.at(-1)?.clear();

    const color = this.interfaceColor("countryTotal", "color2", 15);
    const newLineVector: number[] = [];
    for (let iter = 0; iter !== 12; ++iter) {
      const x = 312 - iter * 17;
      let y = Math.trunc(175 - (-lowerLimit / units));
      y -= Math.trunc(totals[iter] / units);
      newLineVector.push(y);
      if (newLineVector.length > 1) {
        if (this._alien) this._alienCountryLines.at(-1)?.drawLine(x, y, x + 17, newLineVector[newLineVector.length - 2], color);
        else if (this._income) this._incomeLines.at(-1)?.drawLine(x, y, x + 17, newLineVector[newLineVector.length - 2], color);
        else this._xcomCountryLines.at(-1)?.drawLine(x, y, x + 17, newLineVector[newLineVector.length - 2], color);
      }
    }
    if (this._alien) this._alienCountryLines.at(-1)?.setVisible(this._countryToggles.at(-1)?._pushed || false);
    else if (this._income) this._incomeLines.at(-1)?.setVisible(this._countryToggles.at(-1)?._pushed || false);
    else this._xcomCountryLines.at(-1)?.setVisible(this._countryToggles.at(-1)?._pushed || false);
    this.updateScale(lowerLimit, upperLimit);
    this._txtFactor.setVisible(this._income);
  }

  drawRegionLines(): void {
    const save = this.game().getSavedGame() as GraphSavedGame | null;
    if (!save) {
      return;
    }
    let upperLimit = 0;
    let lowerLimit = 0;
    const totals = this.zero12();
    for (let entry = 0; entry !== this.graphLength(save); ++entry) {
      let total = 0;
      if (this._alien) {
        for (let iter = 0; iter !== save.getRegions().length; ++iter) {
          const activity = this.atNumber(save.getRegions()[iter].getActivityAlien(), entry);
          total += activity;
          if (activity > upperLimit && this._regionToggles[iter]._pushed) upperLimit = activity;
          if (activity < lowerLimit && this._regionToggles[iter]._pushed) lowerLimit = activity;
        }
      } else {
        for (let iter = 0; iter !== save.getRegions().length; ++iter) {
          const activity = this.atNumber(save.getRegions()[iter].getActivityXcom(), entry);
          total += activity;
          if (activity > upperLimit && this._regionToggles[iter]._pushed) upperLimit = activity;
          if (activity < lowerLimit && this._regionToggles[iter]._pushed) lowerLimit = activity;
        }
      }
      if (this._regionToggles.at(-1)?._pushed && total > upperLimit) upperLimit = total;
      if (this._regionToggles.at(-1)?._pushed && total < lowerLimit) lowerLimit = total;
    }

    let range = upperLimit - lowerLimit;
    const low = lowerLimit;
    let check = 10;
    const grids = 9;
    while (range > check * grids) {
      check *= 2;
    }
    lowerLimit = 0;
    upperLimit = check * grids;
    if (low < 0) {
      while (low < lowerLimit) {
        lowerLimit -= check;
        upperLimit -= check;
      }
    }
    range = upperLimit - lowerLimit;
    const units = range / 126;

    for (let entry = 0; entry !== save.getRegions().length; ++entry) {
      const region = save.getRegions()[entry];
      this._alienRegionLines[entry].clear();
      this._xcomRegionLines[entry].clear();
      const newLineVector: number[] = [];
      for (let iter = 0; iter !== 12; ++iter) {
        const x = 312 - iter * 17;
        let y = Math.trunc(175 - (-lowerLimit / units));
        let value = 0;
        if (this._alien) {
          if (iter < region.getActivityAlien().length) {
            value = this.atNumber(region.getActivityAlien(), region.getActivityAlien().length - (1 + iter));
            y -= Math.trunc(value / units);
            totals[iter] += value;
          }
        } else if (iter < region.getActivityXcom().length) {
          value = this.atNumber(region.getActivityXcom(), region.getActivityXcom().length - (1 + iter));
          y -= Math.trunc(value / units);
          totals[iter] += value;
        }
        if (y >= 175) y = 175;
        newLineVector.push(y);
        if (newLineVector.length > 1 && this._alien) {
          this._alienRegionLines[entry].drawLine(x, y, x + 17, newLineVector[newLineVector.length - 2], this._regionToggles[entry]._color + 4);
        } else if (newLineVector.length > 1) {
          this._xcomRegionLines[entry].drawLine(x, y, x + 17, newLineVector[newLineVector.length - 2], this._regionToggles[entry]._color + 4);
        }
      }
      if (this._alien) this._alienRegionLines[entry].setVisible(this._regionToggles[entry]._pushed);
      else this._xcomRegionLines[entry].setVisible(this._regionToggles[entry]._pushed);
    }

    if (this._alien) this._alienRegionLines.at(-1)?.clear();
    else this._xcomRegionLines.at(-1)?.clear();

    const color = this.interfaceColor("regionTotal", "color2", 15);
    const newLineVector: number[] = [];
    for (let iter = 0; iter !== 12; ++iter) {
      const x = 312 - iter * 17;
      let y = Math.trunc(175 - (-lowerLimit / units));
      y -= Math.trunc(totals[iter] / units);
      newLineVector.push(y);
      if (newLineVector.length > 1) {
        if (this._alien) this._alienRegionLines.at(-1)?.drawLine(x, y, x + 17, newLineVector[newLineVector.length - 2], color);
        else this._xcomRegionLines.at(-1)?.drawLine(x, y, x + 17, newLineVector[newLineVector.length - 2], color);
      }
    }
    if (this._alien) this._alienRegionLines.at(-1)?.setVisible(this._regionToggles.at(-1)?._pushed || false);
    else this._xcomRegionLines.at(-1)?.setVisible(this._regionToggles.at(-1)?._pushed || false);
    this.updateScale(lowerLimit, upperLimit);
    this._txtFactor.setVisible(false);
  }

  drawFinanceLines(): void {
    const save = this.game().getSavedGame() as GraphSavedGame | null;
    if (!save) {
      return;
    }
    let upperLimit = 0;
    let lowerLimit = 0;
    const incomeTotals = this.zero12();
    const balanceTotals = this.zero12();
    const expendTotals = this.zero12();
    const maintTotals = this.zero12();
    const scoreTotals = this.zero12();
    maintTotals[0] = this.idiv(save.getBaseMaintenance(), 1000);
    const fundsList = this.getFundsList(save);
    const maintenances = this.getNumberList(save, "getMaintenances");
    const expenditures = this.getNumberList(save, "getExpenditures");
    const incomes = this.getNumberList(save, "getIncomes");

    for (let entry = 0; entry !== fundsList.length; ++entry) {
      const invertedEntry = fundsList.length - (1 + entry);
      maintTotals[entry] += this.idiv(this.atNumber(maintenances, invertedEntry), 1000);
      balanceTotals[entry] = this.idiv(this.atNumber(fundsList, invertedEntry), 1000);
      scoreTotals[entry] = this.atNumber(save.getResearchScores(), invertedEntry);
      for (const region of save.getRegions()) {
        scoreTotals[entry] += this.atNumber(region.getActivityXcom(), invertedEntry) - this.atNumber(region.getActivityAlien(), invertedEntry);
      }
      if (this._financeToggles[2]) {
        if (maintTotals[entry] > upperLimit) upperLimit = maintTotals[entry];
        if (maintTotals[entry] < lowerLimit) lowerLimit = maintTotals[entry];
      }
      if (this._financeToggles[3]) {
        if (balanceTotals[entry] > upperLimit) upperLimit = balanceTotals[entry];
        if (balanceTotals[entry] < lowerLimit) lowerLimit = balanceTotals[entry];
      }
      if (this._financeToggles[4]) {
        if (scoreTotals[entry] > upperLimit) upperLimit = scoreTotals[entry];
        if (scoreTotals[entry] < lowerLimit) lowerLimit = scoreTotals[entry];
      }
    }

    for (let entry = 0; entry !== expenditures.length; ++entry) {
      expendTotals[entry] = this.idiv(this.atNumber(expenditures, expenditures.length - (entry + 1)), 1000);
      incomeTotals[entry] = this.idiv(this.atNumber(incomes, incomes.length - (entry + 1)), 1000);
      if (this._financeToggles[0] && incomeTotals[entry] > upperLimit) upperLimit = incomeTotals[entry];
      if (this._financeToggles[1] && expendTotals[entry] > upperLimit) upperLimit = expendTotals[entry];
    }

    let range = upperLimit - lowerLimit;
    const low = lowerLimit;
    let check = 250;
    const grids = 9;
    while (range > check * grids) {
      check *= 2;
    }
    lowerLimit = 0;
    upperLimit = check * grids;
    if (low < 0) {
      while (low < lowerLimit) {
        lowerLimit -= check;
        upperLimit -= check;
      }
    }
    for (let button = 0; button !== 5; ++button) {
      this._financeLines[button].setVisible(this._financeToggles[button]);
      this._financeLines[button].clear();
    }
    range = upperLimit - lowerLimit;
    const units = range / 126;
    for (let button = 0; button !== 5; ++button) {
      const newLineVector: number[] = [];
      for (let iter = 0; iter !== 12; ++iter) {
        const x = 312 - iter * 17;
        let y = Math.trunc(175 - (-lowerLimit / units));
        let reduction = 0;
        switch (button) {
          case 0: reduction = Math.trunc(incomeTotals[iter] / units); break;
          case 1: reduction = Math.trunc(expendTotals[iter] / units); break;
          case 2: reduction = Math.trunc(maintTotals[iter] / units); break;
          case 3: reduction = Math.trunc(balanceTotals[iter] / units); break;
          case 4: reduction = Math.trunc(scoreTotals[iter] / units); break;
          default: break;
        }
        y -= reduction;
        newLineVector.push(y);
        const offset = button % 2 ? 8 : 0;
        if (newLineVector.length > 1) {
          this._financeLines[button].drawLine(x, y, x + 17, newLineVector[newLineVector.length - 2], Palette.blockOffset(Math.trunc(button / 2) + 1) + offset);
        }
      }
    }
    this.updateScale(lowerLimit, upperLimit);
    this._txtFactor.setVisible(true);
  }

  shiftButtons(action?: Action): void {
    if (this._finance || !action) {
      return;
    }
    const button = action.getDetails().button?.button;
    if (this._country) {
      if (this._countryToggles.length <= GraphsState.GRAPH_MAX_BUTTONS) return;
      if (button === SDL_BUTTON_WHEELUP) this.scrollButtons(this._countryToggles, this._btnCountries, "country", -1);
      else if (button === SDL_BUTTON_WHEELDOWN) this.scrollButtons(this._countryToggles, this._btnCountries, "country", 1);
    } else {
      if (this._regionToggles.length <= GraphsState.GRAPH_MAX_BUTTONS) return;
      if (button === SDL_BUTTON_WHEELUP) this.scrollButtons(this._regionToggles, this._btnRegions, "region", -1);
      else if (button === SDL_BUTTON_WHEELDOWN) this.scrollButtons(this._regionToggles, this._btnRegions, "region", 1);
    }
  }

  private scrollButtons(toggles: GraphButInfo[], buttons: ToggleTextButton[], target: "region" | "country", step: number): void {
    let offset = target === "region" ? this._butRegionsOffset : this._butCountriesOffset;
    if (step + offset < 0 || offset + step + GraphsState.GRAPH_MAX_BUTTONS >= toggles.length) {
      return;
    }
    offset += step;
    if (target === "region") {
      this._butRegionsOffset = offset;
    } else {
      this._butCountriesOffset = offset;
    }
    let i = 0;
    for (let toggleIndex = offset; toggleIndex < toggles.length && i < GraphsState.GRAPH_MAX_BUTTONS; ++toggleIndex, ++i) {
      this.updateButton(toggles[toggleIndex], buttons[i]);
    }
  }

  private updateButton(from: GraphButInfo, to: ToggleTextButton): void {
    to.setText(from._name);
    to.setInvertColor(from._color);
    to.setPressed(from._pushed);
  }

  private loadButtonStates(save: GraphSavedGame | null): void {
    let graphRegionToggles = save?.getGraphRegionToggles?.() || "";
    let graphCountryToggles = save?.getGraphCountryToggles?.() || "";
    let graphFinanceToggles = save?.getGraphFinanceToggles?.() || "";
    while (graphRegionToggles.length < this._regionToggles.length) graphRegionToggles += "0";
    while (graphCountryToggles.length < this._countryToggles.length) graphCountryToggles += "0";
    while (graphFinanceToggles.length < this._financeToggles.length) graphFinanceToggles += "0";
    for (let i = 0; i < this._regionToggles.length; ++i) {
      this._regionToggles[i]._pushed = graphRegionToggles[i] !== "0";
      if (this._regionToggles.length - 1 === i) this._btnRegionTotal.setPressed(this._regionToggles[i]._pushed);
      else if (i < GraphsState.GRAPH_MAX_BUTTONS) this._btnRegions[i].setPressed(this._regionToggles[i]._pushed);
    }
    for (let i = 0; i < this._countryToggles.length; ++i) {
      this._countryToggles[i]._pushed = graphCountryToggles[i] !== "0";
      if (this._countryToggles.length - 1 === i) this._btnCountryTotal.setPressed(this._countryToggles[i]._pushed);
      else if (i < GraphsState.GRAPH_MAX_BUTTONS) this._btnCountries[i].setPressed(this._countryToggles[i]._pushed);
    }
    for (let i = 0; i < this._financeToggles.length; ++i) {
      this._financeToggles[i] = graphFinanceToggles[i] !== "0";
      this._btnFinances[i].setPressed(this._financeToggles[i]);
    }
  }

  private saveButtonStates(): void {
    const save = this.game().getSavedGame() as GraphSavedGame | null;
    if (!save) {
      return;
    }
    save.setGraphRegionToggles?.(this._regionToggles.map(toggle => toggle._pushed ? "1" : "0").join(""));
    save.setGraphCountryToggles?.(this._countryToggles.map(toggle => toggle._pushed ? "1" : "0").join(""));
    save.setGraphFinanceToggles?.(this._financeToggles.map(toggle => toggle ? "1" : "0").join(""));
  }

  private interfaceColor(id: string, key: "color" | "color2", fallback: number): number {
    const value = this.game().getMod()?.getInterface("graphs")?.getElement(id)?.[key];
    return typeof value === "number" && value !== 2147483647 ? value : fallback;
  }

  private graphLength(save: GraphSavedGame): number {
    return Math.max(1, this.getFundsList(save).length);
  }

  private getFundsList(save: GraphSavedGame): number[] {
    const funds = save.getFundsList?.();
    if (funds && funds.length > 0) {
      return funds;
    }
    return [save.getFunds()];
  }

  private getNumberList(save: GraphSavedGame, method: "getMaintenances" | "getIncomes" | "getExpenditures"): number[] {
    const list = save[method]?.();
    return list && list.length > 0 ? list : [0];
  }

  private atNumber(values: ArrayLike<number>, index: number): number {
    if (values.length === 0) {
      return 0;
    }
    const normalized = index < 0 ? Math.max(0, values.length + index) : Math.min(index, values.length - 1);
    return Math.trunc(values[normalized] || 0);
  }

  private idiv(value: number, divisor: number): number {
    return Math.trunc(value / divisor);
  }

  private zero12(): number[] {
    return [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  }
}
