import type { Action } from "../Engine/Action.ts";
import { Options } from "../Engine/Options.ts";
import { State } from "../Engine/State.ts";
import { ALIGN_CENTER, ALIGN_MIDDLE, Text } from "../Interface/Text.ts";
import { TextButton } from "../Interface/TextButton.ts";
import { TextEdit } from "../Interface/TextEdit.ts";
import { POPUP_BOTH, Window } from "../Interface/Window.ts";
import type { Globe } from "./Globe.ts";
import { InterceptState } from "./InterceptState.ts";

type TargetLike = {
  getName: (...args: any[]) => string;
  getDefaultName?: (...args: any[]) => string;
  setName?: (name: string) => void;
  getFollowers?: () => Array<{ getName: (...args: any[]) => string }>;
};

/**
 * Generic window used to display all the crafts targeting a certain point on the map.
 */
export class TargetInfoState extends State {
  private _btnIntercept: TextButton;
  private _btnOk: TextButton;
  private _window: Window;
  private _edtTitle: TextEdit;
  private _txtTargetted: Text;
  private _txtFollowers: Text;

  constructor(private _target: TargetLike, private _globe: Globe) {
    super();
    this._screen = false;

    this._window = new Window(this, 192, 120, 32, 40, POPUP_BOTH);
    this._btnIntercept = new TextButton(160, 12, 48, 124);
    this._btnOk = new TextButton(160, 12, 48, 140);
    this._edtTitle = new TextEdit(this, 182, 32, 37, 46);
    this._txtTargetted = new Text(182, 9, 37, 78);
    this._txtFollowers = new Text(182, 40, 37, 88);

    this.setInterface("targetInfo");

    this.add(this._window, "window", "targetInfo");
    this.add(this._btnIntercept, "button", "targetInfo");
    this.add(this._btnOk, "button", "targetInfo");
    this.add(this._edtTitle, "text2", "targetInfo");
    this.add(this._txtTargetted, "text1", "targetInfo");
    this.add(this._txtFollowers, "text1", "targetInfo");

    this.centerAllSurfaces();

    const back01 = this.game().getMod()?.getSurface("BACK01.SCR");
    if (back01) {
      this._window.setBackground(back01);
    }

    this._btnIntercept.setText(String(this.tr("STR_INTERCEPT")));
    this._btnIntercept.onMouseClick(this.btnInterceptClick.bind(this));

    this._btnOk.setText(String(this.tr("STR_OK")));
    this._btnOk.onMouseClick(this.btnOkClick.bind(this));
    this._btnOk.onKeyboardPress(this.btnOkClick.bind(this), Options.keyCancel);

    this._edtTitle.setBig();
    this._edtTitle.setAlign(ALIGN_CENTER);
    this._edtTitle.setVerticalAlign(ALIGN_MIDDLE);
    this._edtTitle.setWordWrap(true);
    this._edtTitle.setText(this._target.getName(this.game().getLanguage()));
    this._edtTitle.onChange(this.edtTitleChange.bind(this));

    this._txtTargetted.setAlign(ALIGN_CENTER);
    this._txtTargetted.setText(String(this.tr("STR_TARGETTED_BY")));
    this._txtFollowers.setAlign(ALIGN_CENTER);
    let followers = "";
    for (const follower of this._target.getFollowers?.() || []) {
      followers += `${follower.getName(this.game().getLanguage())}\n`;
    }
    this._txtFollowers.setText(followers);
  }

  btnInterceptClick(_action?: Action): void {
    this.game().pushState(new InterceptState(this._globe, null, this._target));
  }

  btnOkClick(_action?: Action): void {
    this.game().popState();
  }

  edtTitleChange(action: Action): void {
    const defaultName = this._target.getDefaultName?.(this.game().getLanguage()) ?? this._target.getName(this.game().getLanguage());
    if (this._edtTitle.getText() === defaultName) {
      this._target.setName?.("");
    } else {
      this._target.setName?.(this._edtTitle.getText());
    }
    const sym = action.getDetails().key?.keysym.sym;
    if (sym === "Enter" || sym === "NumpadEnter") {
      this._edtTitle.setText(this._target.getName(this.game().getLanguage()));
    }
  }
}
