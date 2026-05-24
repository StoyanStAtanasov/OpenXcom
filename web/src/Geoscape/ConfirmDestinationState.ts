import { Options } from "../Engine/Options.ts";
import { State } from "../Engine/State.ts";
import type { Action } from "../Engine/Action.ts";
import { ALIGN_CENTER, ALIGN_MIDDLE, Text } from "../Interface/Text.ts";
import { TextButton } from "../Interface/TextButton.ts";
import { Window } from "../Interface/Window.ts";
import type { Craft } from "../Savegame/Craft.ts";
import type { TargetLike } from "../Savegame/Target.ts";
import { Waypoint } from "../Savegame/Waypoint.ts";

type SavedGameWithWaypoints = {
  getId: (name: string) => number;
  getWaypoints?: () => TargetLike[];
};

function isNewWaypoint(target: TargetLike | null): target is Waypoint {
  return target instanceof Waypoint && target.getId() === 0;
}

/**
 * Window that allows the player to confirm a craft's new destination.
 */
export class ConfirmDestinationState extends State {
  private _window: Window;
  private _txtTarget: Text;
  private _btnOk: TextButton;
  private _btnCancel: TextButton;

  constructor(private _craft: Craft, private _target: TargetLike) {
    super();
    const w = isNewWaypoint(this._target) ? this._target : null;
    this._screen = false;

    this._window = new Window(this, 244, 72, 6, 64);
    this._btnOk = new TextButton(50, 12, 68, 104);
    this._btnCancel = new TextButton(50, 12, 138, 104);
    this._txtTarget = new Text(232, 32, 12, 72);

    this.setInterface("confirmDestination", w !== null);

    this.add(this._window, "window", "confirmDestination");
    this.add(this._btnOk, "button", "confirmDestination");
    this.add(this._btnCancel, "button", "confirmDestination");
    this.add(this._txtTarget, "text", "confirmDestination");

    this.centerAllSurfaces();

    const back12 = this.game().getMod()?.getSurface("BACK12.SCR");
    if (back12) {
      this._window.setBackground(back12);
    }

    this._btnOk.setText(String(this.tr("STR_OK")));
    this._btnOk.onMouseClick(this.btnOkClick.bind(this));
    this._btnOk.onKeyboardPress(this.btnOkClick.bind(this), Options.keyOk);

    this._btnCancel.setText(String(this.tr("STR_CANCEL_UC")));
    this._btnCancel.onMouseClick(this.btnCancelClick.bind(this));
    this._btnCancel.onKeyboardPress(this.btnCancelClick.bind(this), Options.keyCancel);

    this._txtTarget.setBig();
    this._txtTarget.setAlign(ALIGN_CENTER);
    this._txtTarget.setVerticalAlign(ALIGN_MIDDLE);
    this._txtTarget.setWordWrap(true);
    if (w) {
      this._txtTarget.setText(String(this.tr("STR_TARGET").arg(this.tr("STR_WAY_POINT"))));
    } else {
      this._txtTarget.setText(String(this.tr("STR_TARGET").arg(this._target.getName(this.game().getLanguage()))));
    }
  }

  /**
   * Confirms the selected target for the craft.
   */
  btnOkClick(_action?: Action): void {
    const w = isNewWaypoint(this._target) ? this._target : null;
    const save = this.game().getSavedGame() as (SavedGameWithWaypoints | null);
    if (w && save) {
      w.setId(save.getId("STR_WAY_POINT"));
      save.getWaypoints?.().push(w);
    }
    this._craft.setDestination(this._target);
    this._craft.setStatus("STR_OUT");
    this.game().popState();
    this.game().popState();
  }

  /**
   * Returns to the previous screen.
   */
  btnCancelClick(_action?: Action): void {
    this.game().popState();
  }
}
