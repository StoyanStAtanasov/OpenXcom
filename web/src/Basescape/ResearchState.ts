import { Options } from "../Engine/Options.ts";
import { State } from "../Engine/State.ts";
import type { Action } from "../Engine/Action.ts";
import { Text, ALIGN_CENTER } from "../Interface/Text.ts";
import { TextButton } from "../Interface/TextButton.ts";
import { TextList } from "../Interface/TextList.ts";
import { Window } from "../Interface/Window.ts";
import type { Base } from "../Savegame/Base.ts";
import type { ResearchProject } from "../Savegame/ResearchProject.ts";
import { NewResearchListState } from "./NewResearchListState.ts";
import { ResearchInfoState } from "./ResearchInfoState.ts";

export class ResearchState extends State {
  private _btnNew: TextButton;
  private _btnOk: TextButton;
  private _window: Window;
  private _txtTitle: Text;
  private _txtAvailable: Text;
  private _txtAllocated: Text;
  private _txtSpace: Text;
  private _txtProject: Text;
  private _txtScientists: Text;
  private _txtProgress: Text;
  private _lstResearch: TextList;

  constructor(private _base: Base) {
    super();

    this._window = new Window(this, 320, 200, 0, 0);
    this._btnNew = new TextButton(148, 16, 8, 176);
    this._btnOk = new TextButton(148, 16, 164, 176);
    this._txtTitle = new Text(310, 17, 5, 8);
    this._txtAvailable = new Text(150, 9, 10, 24);
    this._txtAllocated = new Text(150, 9, 160, 24);
    this._txtSpace = new Text(300, 9, 10, 34);
    this._txtProject = new Text(110, 17, 10, 44);
    this._txtScientists = new Text(106, 17, 120, 44);
    this._txtProgress = new Text(84, 9, 226, 44);
    this._lstResearch = new TextList(288, 112, 8, 62);

    this.setInterface("researchMenu");

    this.add(this._window, "window", "researchMenu");
    this.add(this._btnNew, "button", "researchMenu");
    this.add(this._btnOk, "button", "researchMenu");
    this.add(this._txtTitle, "text", "researchMenu");
    this.add(this._txtAvailable, "text", "researchMenu");
    this.add(this._txtAllocated, "text", "researchMenu");
    this.add(this._txtSpace, "text", "researchMenu");
    this.add(this._txtProject, "text", "researchMenu");
    this.add(this._txtScientists, "text", "researchMenu");
    this.add(this._txtProgress, "text", "researchMenu");
    this.add(this._lstResearch, "list", "researchMenu");

    this.centerAllSurfaces();

    const back05 = this.game().getMod()?.getSurface("BACK05.SCR");
    if (back05) {
      this._window.setBackground(back05);
    }

    this._btnNew.setText(String(this.tr("STR_NEW_PROJECT")));
    this._btnNew.onMouseClick(this.btnNewClick.bind(this));

    this._btnOk.setText(String(this.tr("STR_OK")));
    this._btnOk.onMouseClick(this.btnOkClick.bind(this));
    this._btnOk.onKeyboardPress(this.btnOkClick.bind(this), Options.keyCancel);

    this._txtTitle.setBig();
    this._txtTitle.setAlign(ALIGN_CENTER);
    this._txtTitle.setText(String(this.tr("STR_CURRENT_RESEARCH")));

    this._txtProject.setWordWrap(true);
    this._txtProject.setText(String(this.tr("STR_RESEARCH_PROJECT")));

    this._txtScientists.setWordWrap(true);
    this._txtScientists.setText(String(this.tr("STR_SCIENTISTS_ALLOCATED_UC")));

    this._txtProgress.setText(String(this.tr("STR_PROGRESS")));

    this._lstResearch.setColumns(3, 158, 58, 70);
    this._lstResearch.setSelectable(true);
    this._lstResearch.setBackground(this._window);
    this._lstResearch.setMargin(2);
    this._lstResearch.setWordWrap(true);
    this._lstResearch.onMouseClick(this.onSelectProject.bind(this));
  }

  btnOkClick(_action?: Action): void {
    this.game().popState();
  }

  btnNewClick(_action?: Action): void {
    this.game().pushState(new NewResearchListState(this._base));
  }

  onSelectProject(_action?: Action): void {
    const baseProjects = this._base.getResearch() as ResearchProject[];
    const row = this._lstResearch.getSelectedRow();
    if (row !== -1 && baseProjects[row]) {
      this.game().pushState(new ResearchInfoState(this._base, baseProjects[row]));
    }
  }

  override init(): void {
    super.init();
    this.fillProjectList();
  }

  fillProjectList(): void {
    const baseProjects = this._base.getResearch() as ResearchProject[];
    this._lstResearch.clearList();
    for (const project of baseProjects) {
      const rule = project.getRules();
      this._lstResearch.addRow(
        3,
        String(this.tr(rule.getName())),
        `${project.getAssigned()}`,
        String(this.tr(project.getResearchProgress()))
      );
    }
    this._txtAvailable.setText(String(this.tr("STR_SCIENTISTS_AVAILABLE").arg(this._base.getAvailableScientists())));
    this._txtAllocated.setText(String(this.tr("STR_SCIENTISTS_ALLOCATED").arg(this._base.getAllocatedScientists())));
    this._txtSpace.setText(String(this.tr("STR_LABORATORY_SPACE_AVAILABLE").arg(this._base.getFreeLaboratories())));
  }
}
