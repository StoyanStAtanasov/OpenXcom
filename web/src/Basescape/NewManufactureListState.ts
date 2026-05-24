import { Options } from "../Engine/Options.ts";
import { State } from "../Engine/State.ts";
import type { Action } from "../Engine/Action.ts";
import { Text, ALIGN_CENTER } from "../Interface/Text.ts";
import { TextButton } from "../Interface/TextButton.ts";
import { TextList } from "../Interface/TextList.ts";
import { ComboBox } from "../Interface/ComboBox.ts";
import { Window, POPUP_BOTH } from "../Interface/Window.ts";
import type { RuleManufacture } from "../Mod/RuleManufacture.ts";
import type { Base } from "../Savegame/Base.ts";
import { ManufactureStartState } from "./ManufactureStartState.ts";

export class NewManufactureListState extends State {
  private _btnOk: TextButton;
  private _window: Window;
  private _txtTitle: Text;
  private _txtItem: Text;
  private _txtCategory: Text;
  private _lstManufacture: TextList;
  private _cbxCategory: ComboBox;
  private _possibleProductions: RuleManufacture[] = [];
  private _catStrings: string[] = [];
  private _displayedStrings: string[] = [];

  constructor(private _base: Base) {
    super();
    this._screen = false;

    this._window = new Window(this, 320, 156, 0, 22, POPUP_BOTH);
    this._btnOk = new TextButton(304, 16, 8, 154);
    this._txtTitle = new Text(320, 17, 0, 30);
    this._txtItem = new Text(156, 9, 10, 62);
    this._txtCategory = new Text(130, 9, 166, 62);
    this._lstManufacture = new TextList(288, 80, 8, 70);
    this._cbxCategory = new ComboBox(this, 146, 16, 166, 46);

    this.setInterface("selectNewManufacture");

    this.add(this._window, "window", "selectNewManufacture");
    this.add(this._btnOk, "button", "selectNewManufacture");
    this.add(this._txtTitle, "text", "selectNewManufacture");
    this.add(this._txtItem, "text", "selectNewManufacture");
    this.add(this._txtCategory, "text", "selectNewManufacture");
    this.add(this._lstManufacture, "list", "selectNewManufacture");
    this.add(this._cbxCategory, "catBox", "selectNewManufacture");

    this.centerAllSurfaces();

    const background = this.game().getMod()?.getSurface("BACK17.SCR");
    if (background) {
      this._window.setBackground(background);
    }

    this._txtTitle.setText(String(this.tr("STR_PRODUCTION_ITEMS")));
    this._txtTitle.setBig();
    this._txtTitle.setAlign(ALIGN_CENTER);

    this._txtItem.setText(String(this.tr("STR_ITEM")));
    this._txtCategory.setText(String(this.tr("STR_CATEGORY")));

    this._lstManufacture.setColumns(2, 156, 130);
    this._lstManufacture.setSelectable(true);
    this._lstManufacture.setBackground(this._window);
    this._lstManufacture.setMargin(2);
    this._lstManufacture.onMouseClick(this.lstProdClick.bind(this));

    this._btnOk.setText(String(this.tr("STR_OK")));
    this._btnOk.onMouseClick(this.btnOkClick.bind(this));
    this._btnOk.onKeyboardPress(this.btnOkClick.bind(this), Options.keyCancel);

    this._possibleProductions = this.getAvailableProductions();
    this._catStrings.push("STR_ALL_ITEMS");

    for (const production of this._possibleProductions) {
      if (!this._catStrings.includes(production.getCategory())) {
        this._catStrings.push(production.getCategory());
      }
    }

    this._cbxCategory.setOptions(this._catStrings, true);
    this._cbxCategory.onChange(this.cbxCategoryChange.bind(this));
  }

  override init(): void {
    super.init();
    this.fillProductionList();
  }

  btnOkClick(_action?: Action): void {
    this.game().popState();
  }

  lstProdClick(_action?: Action): void {
    const selected = this._lstManufacture.getSelectedRow();
    const selectedName = selected >= 0 ? this._displayedStrings[selected] : "";
    const rule = this._possibleProductions.find(production => production.getName() === selectedName) || null;
    if (rule) {
      this.game().pushState(new ManufactureStartState(this._base, rule));
    }
  }

  cbxCategoryChange(_action?: Action): void {
    this.fillProductionList();
  }

  fillProductionList(): void {
    this._lstManufacture.clearList();
    this._possibleProductions = this.getAvailableProductions();
    this._displayedStrings = [];

    const category = this._catStrings[this._cbxCategory.getSelected()] || "STR_ALL_ITEMS";
    for (const production of this._possibleProductions) {
      if (production.getCategory() === category || category === "STR_ALL_ITEMS") {
        this._lstManufacture.addRow(2, String(this.tr(production.getName())), String(this.tr(production.getCategory())));
        this._displayedStrings.push(production.getName());
      }
    }
  }

  private getAvailableProductions(): RuleManufacture[] {
    const save = this.game().getSavedGame();
    const mod = this.game().getMod();
    if (!save || !mod) {
      return [];
    }
    return save.getAvailableProductions(mod, this._base);
  }
}
