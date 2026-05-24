import { Options } from "../Engine/Options.ts";
import { State } from "../Engine/State.ts";
import type { Action } from "../Engine/Action.ts";
import { Text, ALIGN_CENTER } from "../Interface/Text.ts";
import { TextButton } from "../Interface/TextButton.ts";
import { TextList } from "../Interface/TextList.ts";
import { Window, POPUP_VERTICAL } from "../Interface/Window.ts";
import type { RuleBaseFacility } from "../Mod/RuleBaseFacility.ts";
import type { Base } from "../Savegame/Base.ts";
import { PlaceFacilityState } from "./PlaceFacilityState.ts";

export class BuildFacilitiesState extends State {
  protected _facilities: RuleBaseFacility[] = [];
  protected _btnOk: TextButton;
  protected _window: Window;
  protected _txtTitle: Text;
  protected _lstFacilities: TextList;

  constructor(protected _base: Base, protected _state: State) {
    super();
    this._screen = false;

    this._window = new Window(this, 128, 160, 192, 40, POPUP_VERTICAL);
    this._btnOk = new TextButton(112, 16, 200, 176);
    this._lstFacilities = new TextList(104, 104, 200, 64);
    this._txtTitle = new Text(118, 17, 197, 48);

    this.setInterface("selectFacility");

    this.add(this._window, "window", "selectFacility");
    this.add(this._btnOk, "button", "selectFacility");
    this.add(this._txtTitle, "text", "selectFacility");
    this.add(this._lstFacilities, "list", "selectFacility");

    this.centerAllSurfaces();

    const back05 = this.game().getMod()?.getSurface("BACK05.SCR");
    if (back05) {
      this._window.setBackground(back05);
    }

    this._btnOk.setText(String(this.tr("STR_OK")));
    this._btnOk.onMouseClick(this.btnOkClick.bind(this));
    this._btnOk.onKeyboardPress(this.btnOkClick.bind(this), Options.keyCancel);

    this._txtTitle.setBig();
    this._txtTitle.setAlign(ALIGN_CENTER);
    this._txtTitle.setText(String(this.tr("STR_INSTALLATION")));

    this._lstFacilities.setColumns(1, 104);
    this._lstFacilities.setSelectable(true);
    this._lstFacilities.setBackground(this._window);
    this._lstFacilities.setMargin(2);
    this._lstFacilities.setWordWrap(true);
    this._lstFacilities.setScrolling(true, 0);
    this._lstFacilities.onMouseClick(this.lstFacilitiesClick.bind(this));

    this.PopulateBuildList();
  }

  PopulateBuildList(): void {
    const mod = this.game().getMod();
    const save = this.game().getSavedGame();
    if (!mod || !save) {
      return;
    }
    for (const type of mod.getBaseFacilitiesList()) {
      const rule = mod.getBaseFacility(type);
      if (rule && save.isResearched(rule.getRequirements()) && !rule.isLift()) {
        this._facilities.push(rule);
      }
    }

    for (const rule of this._facilities) {
      this._lstFacilities.addRow(1, String(this.tr(rule.getType())));
    }
  }

  override init(): void {
    this._state.init();
    super.init();
  }

  btnOkClick(_action?: Action): void {
    this.game().popState();
  }

  lstFacilitiesClick(_action?: Action): void {
    const selected = this._lstFacilities.getSelectedRow();
    if (selected >= 0 && selected < this._facilities.length) {
      this.game().pushState(new PlaceFacilityState(this._base, this._facilities[selected]));
    }
  }
}
