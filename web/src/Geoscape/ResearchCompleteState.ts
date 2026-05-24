import { Options } from "../Engine/Options.ts";
import { State } from "../Engine/State.ts";
import type { Action } from "../Engine/Action.ts";
import { ALIGN_CENTER, Text } from "../Interface/Text.ts";
import { TextButton } from "../Interface/TextButton.ts";
import { POPUP_BOTH, Window } from "../Interface/Window.ts";
import type { RuleResearch } from "../Mod/RuleResearch.ts";

function openUfopaediaArticle(article: string): void {
  console.log(`Ufopaedia::openArticle(${article}) is not translated yet.`);
}

export class ResearchCompleteState extends State {
  private _window: Window;
  private _txtTitle: Text;
  private _txtResearch: Text;
  private _btnReport: TextButton;
  private _btnOk: TextButton;

  constructor(private _research: RuleResearch | null, private _bonus: RuleResearch | null, research: RuleResearch | null) {
    super();
    this._screen = false;

    this._window = new Window(this, 230, 140, 45, 30, POPUP_BOTH);
    this._btnOk = new TextButton(80, 16, 64, 146);
    this._btnReport = new TextButton(80, 16, 176, 146);
    this._txtTitle = new Text(230, 17, 45, 70);
    this._txtResearch = new Text(230, 32, 45, 96);

    this.setInterface("geoResearchComplete");

    this.add(this._window, "window", "geoResearchComplete");
    this.add(this._btnOk, "button", "geoResearchComplete");
    this.add(this._btnReport, "button", "geoResearchComplete");
    this.add(this._txtTitle, "text1", "geoResearchComplete");
    this.add(this._txtResearch, "text2", "geoResearchComplete");

    this.centerAllSurfaces();

    const back05 = this.game().getMod()?.getSurface("BACK05.SCR");
    if (back05) {
      this._window.setBackground(back05);
    }

    this._btnOk.setText(String(this.tr("STR_OK")));
    this._btnOk.onMouseClick(this.btnOkClick.bind(this));
    this._btnOk.onKeyboardPress(this.btnOkClick.bind(this), Options.keyCancel);

    this._btnReport.setText(String(this.tr("STR_VIEW_REPORTS")));
    this._btnReport.onMouseClick(this.btnReportClick.bind(this));
    this._btnReport.onKeyboardPress(this.btnReportClick.bind(this), Options.keyOk);

    this._txtTitle.setBig();
    this._txtTitle.setAlign(ALIGN_CENTER);
    this._txtTitle.setText(String(this.tr("STR_RESEARCH_COMPLETED")));

    this._txtResearch.setAlign(ALIGN_CENTER);
    this._txtResearch.setBig();
    this._txtResearch.setWordWrap(true);
    if (research) {
      this._txtResearch.setText(String(this.tr(research.getName())));
    }
  }

  btnOkClick(_action?: Action): void {
    this.game().popState();
  }

  btnReportClick(_action?: Action): void {
    this.game().popState();
    if (this._bonus) {
      const bonusName = this._bonus.getLookup().length === 0 ? this._bonus.getName() : this._bonus.getLookup();
      openUfopaediaArticle(bonusName);
    }
    if (this._research) {
      const name = this._research.getLookup().length === 0 ? this._research.getName() : this._research.getLookup();
      openUfopaediaArticle(name);
    }
  }
}
