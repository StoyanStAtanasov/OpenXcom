import { Options } from "../Engine/Options.ts";
import { State } from "../Engine/State.ts";
import type { Action } from "../Engine/Action.ts";
import { ALIGN_CENTER, ALIGN_MIDDLE, Text } from "../Interface/Text.ts";
import { TextButton } from "../Interface/TextButton.ts";
import { Window } from "../Interface/Window.ts";
import type { RuleItem } from "../Mod/RuleItem.ts";

export class ResearchRequiredState extends State {
  private _window: Window;
  private _txtTitle: Text;
  private _btnOk: TextButton;

  constructor(item: RuleItem) {
    super();
    this._screen = false;

    this._window = new Window(this, 288, 180, 16, 10);
    this._btnOk = new TextButton(160, 18, 80, 150);
    this._txtTitle = new Text(288, 80, 16, 50);

    this.setInterface("geoResearchRequired");

    this.add(this._window, "window", "geoResearchRequired");
    this.add(this._btnOk, "button", "geoResearchRequired");
    this.add(this._txtTitle, "text1", "geoResearchRequired");

    this.centerAllSurfaces();

    const weapon = item.getType();
    const clip = item.getCompatibleAmmo()[0] || "";

    const back05 = this.game().getMod()?.getSurface("BACK05.SCR");
    if (back05) {
      this._window.setBackground(back05);
    }

    this._btnOk.setText(String(this.tr("STR_OK")));
    this._btnOk.onMouseClick(this.btnOkClick.bind(this));
    this._btnOk.onKeyboardPress(this.btnOkClick.bind(this), Options.keyCancel);
    this._btnOk.onKeyboardPress(this.btnOkClick.bind(this), Options.keyOk);

    this._txtTitle.setBig();
    this._txtTitle.setAlign(ALIGN_CENTER);
    this._txtTitle.setVerticalAlign(ALIGN_MIDDLE);
    this._txtTitle.setText(String(this.tr("STR_YOU_NEED_TO_RESEARCH_ITEM_TO_PRODUCE_ITEM").arg(this.tr(clip)).arg(this.tr(weapon))));
  }

  btnOkClick(_action?: Action): void {
    this.game().popState();
  }
}
