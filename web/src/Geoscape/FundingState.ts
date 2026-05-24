import type { Action } from "../Engine/Action.ts";
import { Options } from "../Engine/Options.ts";
import { State } from "../Engine/State.ts";
import { formatFunding, TOK_COLOR_FLIP } from "../Engine/Unicode.ts";
import { ALIGN_CENTER, Text } from "../Interface/Text.ts";
import { TextButton } from "../Interface/TextButton.ts";
import { TextList } from "../Interface/TextList.ts";
import { POPUP_BOTH, Window } from "../Interface/Window.ts";

const COLOR_FLIP = String.fromCharCode(TOK_COLOR_FLIP);

/**
 * Funding screen accessible from the Geoscape
 * that shows all the countries' funding.
 */
export class FundingState extends State {
  private _btnOk: TextButton;
  private _window: Window;
  private _txtTitle: Text;
  private _txtCountry: Text;
  private _txtFunding: Text;
  private _txtChange: Text;
  private _lstCountries: TextList;

  constructor() {
    super();
    this._screen = false;

    this._window = new Window(this, 320, 200, 0, 0, POPUP_BOTH);
    this._btnOk = new TextButton(50, 12, 135, 180);
    this._txtTitle = new Text(320, 17, 0, 8);
    this._txtCountry = new Text(100, 9, 32, 30);
    this._txtFunding = new Text(100, 9, 140, 30);
    this._txtChange = new Text(72, 9, 240, 30);
    this._lstCountries = new TextList(260, 136, 32, 40);

    this.setInterface("fundingWindow");

    this.add(this._window, "window", "fundingWindow");
    this.add(this._btnOk, "button", "fundingWindow");
    this.add(this._txtTitle, "text1", "fundingWindow");
    this.add(this._txtCountry, "text2", "fundingWindow");
    this.add(this._txtFunding, "text2", "fundingWindow");
    this.add(this._txtChange, "text2", "fundingWindow");
    this.add(this._lstCountries, "list", "fundingWindow");

    this.centerAllSurfaces();

    const back13 = this.game().getMod()?.getSurface("BACK13.SCR");
    if (back13) {
      this._window.setBackground(back13);
    }

    this._btnOk.setText(String(this.tr("STR_OK")));
    this._btnOk.onMouseClick(this.btnOkClick.bind(this));
    this._btnOk.onKeyboardPress(this.btnOkClick.bind(this), Options.keyOk);
    this._btnOk.onKeyboardPress(this.btnOkClick.bind(this), Options.keyCancel);
    this._btnOk.onKeyboardPress(this.btnOkClick.bind(this), Options.keyGeoFunding);

    this._txtTitle.setAlign(ALIGN_CENTER);
    this._txtTitle.setBig();
    this._txtTitle.setText(String(this.tr("STR_INTERNATIONAL_RELATIONS")));

    this._txtCountry.setText(String(this.tr("STR_COUNTRY")));
    this._txtFunding.setText(String(this.tr("STR_FUNDING")));
    this._txtChange.setText(String(this.tr("STR_CHANGE")));

    this._lstCountries.setColumns(3, 108, 100, 52);
    this._lstCountries.setDot(true);

    const save = this.game().getSavedGame();
    if (!save) {
      return;
    }

    for (const country of save.getCountries()) {
      const funding = country.getFunding();
      const last = funding.at(-1) || 0;
      let changeText = formatFunding(0);
      if (funding.length > 1) {
        const change = last - (funding.at(-2) || 0);
        changeText = `${COLOR_FLIP}${change > 0 ? "+" : ""}${formatFunding(change)}${COLOR_FLIP}`;
      }
      this._lstCountries.addRow(
        3,
        String(this.tr(country.getRules().getType())),
        `${COLOR_FLIP}${formatFunding(last)}${COLOR_FLIP}`,
        changeText
      );
    }

    this._lstCountries.addRow(2, String(this.tr("STR_TOTAL_UC")), formatFunding(save.getCountryFunding()));
    this._lstCountries.setRowColor(save.getCountries().length, this._txtCountry.getColor());
  }

  btnOkClick(_action?: Action): void {
    this.game().popState();
  }
}
