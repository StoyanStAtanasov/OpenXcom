import { Options } from "../Engine/Options.ts";
import { State } from "../Engine/State.ts";
import type { Action } from "../Engine/Action.ts";
import { Text, ALIGN_CENTER } from "../Interface/Text.ts";
import { TextButton } from "../Interface/TextButton.ts";
import { TextEdit } from "../Interface/TextEdit.ts";
import { Window, POPUP_BOTH } from "../Interface/Window.ts";
import { PlaceLiftState } from "../Basescape/PlaceLiftState.ts";
import type { Base } from "../Savegame/Base.ts";
import type { Globe } from "./Globe.ts";

export class BaseNameState extends State {
  private _window: Window;
  private _txtTitle: Text;
  private _edtName: TextEdit;
  private _btnOk: TextButton;

  constructor(private _base: Base, private _globe: Globe, private _first: boolean) {
    super();
    this._globe.onMouseOver(null);
    this._screen = false;

    this._window = new Window(this, 192, 80, 32, 60, POPUP_BOTH);
    this._btnOk = new TextButton(162, 12, 47, 118);
    this._txtTitle = new Text(182, 17, 37, 70);
    this._edtName = new TextEdit(this, 127, 16, 59, 94);

    this.setInterface("baseNaming");

    this.add(this._window, "window", "baseNaming");
    this.add(this._btnOk, "button", "baseNaming");
    this.add(this._txtTitle, "text", "baseNaming");
    this.add(this._edtName, "text", "baseNaming");

    this.centerAllSurfaces();

    const back01 = this.game().getMod()?.getSurface("BACK01.SCR");
    if (back01) {
      this._window.setBackground(back01);
    }

    this._btnOk.setText(String(this.tr("STR_OK")));
    this._btnOk.onMouseClick(this.btnOkClick.bind(this));
    this._btnOk.onKeyboardPress(this.btnOkClick.bind(this), Options.keyCancel);
    this._btnOk.setVisible(false);

    this._txtTitle.setAlign(ALIGN_CENTER);
    this._txtTitle.setBig();
    this._txtTitle.setText(String(this.tr("STR_BASE_NAME")));

    this._edtName.setBig();
    this._edtName.setText(this._base.getName());
    this._edtName.setFocus(true, false);
    this._edtName.onChange(this.edtNameChange.bind(this));
  }

  edtNameChange(action: Action): void {
    this._base.setName(this._edtName.getText());
    const sym = action.getDetails().key?.keysym.sym;
    if (sym === "Enter" || sym === "NumpadEnter") {
      if (this._edtName.getText()) {
        this.btnOkClick(action);
      }
    } else {
      this._btnOk.setVisible(this._edtName.getText().length > 0);
    }
  }

  btnOkClick(_action: Action): void {
    if (!this._edtName.getText()) {
      return;
    }
    this.game().popState();
    this.game().popState();
    if (!this._first || Options.customInitialBase) {
      if (!this._first) {
        this.game().popState();
      }
      this.game().pushState(new PlaceLiftState(this._base, this._globe, this._first));
    }
  }
}
