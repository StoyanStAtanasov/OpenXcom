import type { Action } from "../Engine/Action.ts";
import { Options } from "../Engine/Options.ts";
import { State } from "../Engine/State.ts";
import { Text, ALIGN_CENTER } from "../Interface/Text.ts";
import { TextButton } from "../Interface/TextButton.ts";
import { TextList } from "../Interface/TextList.ts";
import { POPUP_NONE, Window } from "../Interface/Window.ts";
import { Ufopaedia, type ArticleDefinitionList } from "./Ufopaedia.ts";

/**
 * Ufopaedia article list for a given category.
 */
export class UfopaediaSelectState extends State {
  private _section: string;
  private _window: Window;
  private _txtTitle: Text;
  private _btnOk: TextButton;
  private _lstSelection: TextList;
  private _article_list: ArticleDefinitionList = [];

  constructor(section: string) {
    super();
    this._section = section;
    this._screen = false;

    this._window = new Window(this, 256, 180, 32, 10, POPUP_NONE);
    this._txtTitle = new Text(224, 17, 48, 26);
    this._btnOk = new TextButton(224, 16, 48, 166);
    this._lstSelection = new TextList(224, 104, 40, 50);

    this.setInterface("ufopaedia");
    this.add(this._window, "window", "ufopaedia");
    this.add(this._txtTitle, "text", "ufopaedia");
    this.add(this._btnOk, "button2", "ufopaedia");
    this.add(this._lstSelection, "list", "ufopaedia");

    this.centerAllSurfaces();
    const back01 = this.game().getMod()?.getSurface("BACK01.SCR");
    if (back01) {
      this._window.setBackground(back01);
    }

    this._txtTitle.setBig();
    this._txtTitle.setAlign(ALIGN_CENTER);
    this._txtTitle.setText(String(this.tr("STR_SELECT_ITEM")));

    this._btnOk.setText(String(this.tr("STR_OK")));
    this._btnOk.onMouseClick(this.btnOkClick.bind(this));
    this._btnOk.onKeyboardPress(this.btnOkClick.bind(this), Options.keyCancel);

    this._lstSelection.setColumns(1, 206);
    this._lstSelection.setSelectable(true);
    this._lstSelection.setBackground(this._window);
    this._lstSelection.setMargin(18);
    this._lstSelection.setAlign(ALIGN_CENTER);
    this._lstSelection.onMouseClick(this.lstSelectionClick.bind(this));

    this.loadSelectionList();
  }

  init(): void {
    super.init();
  }

  btnOkClick(_action?: Action): void {
    this.game().popState();
  }

  lstSelectionClick(_action?: Action): void {
    const selected = this._article_list[this._lstSelection.getSelectedRow()];
    if (selected) {
      Ufopaedia.openArticle(this.game(), selected);
    }
  }

  loadSelectionList(): void {
    this._article_list = [];
    Ufopaedia.list(this.game().getSavedGame(), this.game().getMod(), this._section, this._article_list);
    this._lstSelection.clearList();
    for (const article of this._article_list) {
      this._lstSelection.addRow(1, String(this.tr(article.title)));
    }
  }
}
