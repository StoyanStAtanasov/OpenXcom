import { Options } from "../Engine/Options.ts";
import { State } from "../Engine/State.ts";
import type { Action } from "../Engine/Action.ts";
import { Frame } from "../Interface/Frame.ts";
import { ALIGN_CENTER, ALIGN_MIDDLE, Text } from "../Interface/Text.ts";
import { TextButton } from "../Interface/TextButton.ts";

/**
 * Notifies the player about soldiers going unconscious, dying from wounds, or objectives.
 */
export class InfoboxOKState extends State {
  private _btnOk: TextButton;
  private _frame: Frame;
  private _txtTitle: Text;

  constructor(msg: string) {
    super();
    this._screen = false;

    this._frame = new Frame(261, 89, 30, 48);
    this._btnOk = new TextButton(120, 18, 100, 112);
    this._txtTitle = new Text(255, 61, 33, 51);

    this.game().getSavedGame()?.getSavedBattle()?.setPaletteByDepth(this);

    this.add(this._frame, "infoBoxOK", "battlescape");
    this.add(this._btnOk, "infoBoxOKButton", "battlescape");
    this.add(this._txtTitle, "infoBoxOK", "battlescape");

    this.centerAllSurfaces();

    this._frame.setThickness(3);
    this._frame.setHighContrast(true);

    this._btnOk.setText(String(this.tr("STR_OK")));
    this._btnOk.onMouseClick(this.btnOkClick.bind(this));
    this._btnOk.onKeyboardPress(this.btnOkClick.bind(this), Options.keyOk);
    this._btnOk.onKeyboardPress(this.btnOkClick.bind(this), Options.keyCancel);
    this._btnOk.setHighContrast(true);

    this._txtTitle.setBig();
    this._txtTitle.setAlign(ALIGN_CENTER);
    this._txtTitle.setVerticalAlign(ALIGN_MIDDLE);
    this._txtTitle.setHighContrast(true);
    this._txtTitle.setWordWrap(true);
    this._txtTitle.setText(msg);

    this.game().getCursor().setVisible(true);
  }

  btnOkClick(_action?: Action): void {
    this.game().popState();
  }
}
