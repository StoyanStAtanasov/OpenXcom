import { Options } from "../Engine/Options.ts";
import { State } from "../Engine/State.ts";
import type { Action } from "../Engine/Action.ts";
import { Text, ALIGN_CENTER } from "../Interface/Text.ts";
import { TextButton } from "../Interface/TextButton.ts";
import { TextList } from "../Interface/TextList.ts";
import { POPUP_BOTH, Window } from "../Interface/Window.ts";
import type { RuleResearch } from "../Mod/RuleResearch.ts";
import type { Base } from "../Savegame/Base.ts";
import { ResearchInfoState } from "./ResearchInfoState.ts";

export class NewResearchListState extends State {
  private _btnOK: TextButton;
  private _window: Window;
  private _txtTitle: Text;
  private _lstResearch: TextList;
  private _projects: RuleResearch[] = [];

  constructor(private _base: Base) {
    super();
    this._screen = false;

    this._window = new Window(this, 230, 140, 45, 30, POPUP_BOTH);
    this._btnOK = new TextButton(214, 16, 53, 146);
    this._txtTitle = new Text(214, 16, 53, 38);
    this._lstResearch = new TextList(198, 88, 53, 54);

    this.setInterface("selectNewResearch");

    this.add(this._window, "window", "selectNewResearch");
    this.add(this._btnOK, "button", "selectNewResearch");
    this.add(this._txtTitle, "text", "selectNewResearch");
    this.add(this._lstResearch, "list", "selectNewResearch");

    this.centerAllSurfaces();

    const back05 = this.game().getMod()?.getSurface("BACK05.SCR");
    if (back05) {
      this._window.setBackground(back05);
    }

    this._btnOK.setText(String(this.tr("STR_OK")));
    this._btnOK.onMouseClick(this.btnOKClick.bind(this));
    this._btnOK.onKeyboardPress(this.btnOKClick.bind(this), Options.keyCancel);

    this._txtTitle.setAlign(ALIGN_CENTER);
    this._txtTitle.setText(String(this.tr("STR_NEW_RESEARCH_PROJECTS")));

    this._lstResearch.setColumns(1, 190);
    this._lstResearch.setSelectable(true);
    this._lstResearch.setBackground(this._window);
    this._lstResearch.setMargin(8);
    this._lstResearch.setAlign(ALIGN_CENTER);
    this._lstResearch.onMouseClick(this.onSelectProject.bind(this));
  }

  override init(): void {
    super.init();
    this.fillProjectList();
  }

  onSelectProject(_action?: Action): void {
    const row = this._lstResearch.getSelectedRow();
    if (row !== -1 && this._projects[row]) {
      this.game().pushState(new ResearchInfoState(this._base, this._projects[row]));
    }
  }

  btnOKClick(_action?: Action): void {
    this.game().popState();
  }

  fillProjectList(): void {
    this._projects = [];
    this._lstResearch.clearList();

    const save = this.game().getSavedGame();
    const mod = this.game().getMod();
    if (!save || !mod) {
      return;
    }

    const availableProjects = save.getAvailableResearchProjects(mod, this._base, true);
    for (const project of availableProjects) {
      // Projects with "requires" can only be discovered/researched indirectly.
      if (project.getRequirements().length === 0) {
        this._projects.push(project);
        this._lstResearch.addRow(1, String(this.tr(project.getName())));
      }
    }
  }
}
