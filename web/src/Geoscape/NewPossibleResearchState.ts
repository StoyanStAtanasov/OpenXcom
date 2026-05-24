import { Options } from "../Engine/Options.ts";
import { State } from "../Engine/State.ts";
import type { Action } from "../Engine/Action.ts";
import { ALIGN_CENTER, Text } from "../Interface/Text.ts";
import { TextButton } from "../Interface/TextButton.ts";
import { TextList } from "../Interface/TextList.ts";
import { Window } from "../Interface/Window.ts";
import type { RuleResearch } from "../Mod/RuleResearch.ts";
import type { Base } from "../Savegame/Base.ts";
import { ResearchState } from "../Basescape/ResearchState.ts";

export class NewPossibleResearchState extends State {
  private _window: Window;
  private _txtTitle: Text;
  private _lstPossibilities: TextList;
  private _btnResearch: TextButton;
  private _btnOk: TextButton;

  constructor(private _base: Base, possibilities: RuleResearch[]) {
    super();
    this._screen = false;

    this._window = new Window(this, 288, 180, 16, 10);
    this._btnOk = new TextButton(160, 14, 80, 149);
    this._btnResearch = new TextButton(160, 14, 80, 165);
    this._txtTitle = new Text(288, 40, 16, 20);
    this._lstPossibilities = new TextList(250, 96, 35, 50);

    this.setInterface("geoResearch");

    this.add(this._window, "window", "geoResearch");
    this.add(this._btnOk, "button", "geoResearch");
    this.add(this._btnResearch, "button", "geoResearch");
    this.add(this._txtTitle, "text1", "geoResearch");
    this.add(this._lstPossibilities, "text2", "geoResearch");

    this.centerAllSurfaces();

    const back05 = this.game().getMod()?.getSurface("BACK05.SCR");
    if (back05) {
      this._window.setBackground(back05);
    }

    this._btnOk.setText(String(this.tr("STR_OK")));
    this._btnOk.onMouseClick(this.btnOkClick.bind(this));
    this._btnOk.onKeyboardPress(this.btnOkClick.bind(this), Options.keyCancel);

    this._btnResearch.setText(String(this.tr("STR_ALLOCATE_RESEARCH")));
    this._btnResearch.onMouseClick(this.btnResearchClick.bind(this));
    this._btnResearch.onKeyboardPress(this.btnResearchClick.bind(this), Options.keyOk);

    this._txtTitle.setBig();
    this._txtTitle.setAlign(ALIGN_CENTER);

    this._lstPossibilities.setColumns(1, 250);
    this._lstPossibilities.setBig();
    this._lstPossibilities.setAlign(ALIGN_CENTER);
    this._lstPossibilities.setScrolling(true, 0);

    let foundNew = false;
    const save = this.game().getSavedGame();
    if (save) {
      for (const possibility of possibilities) {
        if (possibility.getRequirements().length === 0) {
          if (!save.wasResearchPopped(possibility) && !save.isResearched(possibility.getName(), false)) {
            save.addPoppedResearch(possibility);
            this._lstPossibilities.addRow(1, String(this.tr(possibility.getName())));
            foundNew = true;
          }
        }
      }
    }

    if (foundNew) {
      this._txtTitle.setText(String(this.tr("STR_WE_CAN_NOW_RESEARCH")));
    }
  }

  btnOkClick(_action?: Action): void {
    this.game().popState();
  }

  btnResearchClick(_action?: Action): void {
    this.game().popState();
    this.game().pushState(new ResearchState(this._base));
  }
}
