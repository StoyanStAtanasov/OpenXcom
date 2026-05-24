import type { Action } from "../Engine/Action.ts";
import { Options } from "../Engine/Options.ts";
import { State } from "../Engine/State.ts";
import { ALIGN_CENTER, Text } from "../Interface/Text.ts";
import { TextButton } from "../Interface/TextButton.ts";
import { POPUP_BOTH, Window } from "../Interface/Window.ts";
import { Craft } from "../Savegame/Craft.ts";
import type { Globe } from "./Globe.ts";
import { GeoscapeCraftState } from "./GeoscapeCraftState.ts";

/**
 * Window displayed when a craft starts patrolling a waypoint.
 */
export class CraftPatrolState extends State {
  private _btnOk: TextButton;
  private _btnRedirect: TextButton;
  private _window: Window;
  private _txtDestination: Text;
  private _txtPatrolling: Text;

  constructor(private _craft: Craft, private _globe: Globe) {
    super();
    this._screen = false;

    this._window = new Window(this, 224, 168, 16, 16, POPUP_BOTH);
    this._btnOk = new TextButton(140, 12, 58, 144);
    this._btnRedirect = new TextButton(140, 12, 58, 160);
    this._txtDestination = new Text(224, 64, 16, 48);
    this._txtPatrolling = new Text(224, 17, 16, 120);

    this.setInterface("craftPatrol");

    this.add(this._window, "window", "craftPatrol");
    this.add(this._btnOk, "button", "craftPatrol");
    this.add(this._btnRedirect, "button", "craftPatrol");
    this.add(this._txtDestination, "text1", "craftPatrol");
    this.add(this._txtPatrolling, "text1", "craftPatrol");

    this.centerAllSurfaces();

    const back12 = this.game().getMod()?.getSurface("BACK12.SCR");
    if (back12) {
      this._window.setBackground(back12);
    }

    this._btnOk.setText(String(this.tr("STR_OK")));
    this._btnOk.onMouseClick(this.btnOkClick.bind(this));
    this._btnOk.onKeyboardPress(this.btnOkClick.bind(this), Options.keyCancel);

    this._btnRedirect.setText(String(this.tr("STR_REDIRECT_CRAFT")));
    this._btnRedirect.onMouseClick(this.btnRedirectClick.bind(this));
    this._btnRedirect.onKeyboardPress(this.btnRedirectClick.bind(this), Options.keyOk);

    const destination = this._craft.getDestination();
    this._txtDestination.setBig();
    this._txtDestination.setAlign(ALIGN_CENTER);
    this._txtDestination.setWordWrap(true);
    this._txtDestination.setText(String(this.tr("STR_CRAFT_HAS_REACHED_DESTINATION")
      .arg(this._craft.getName(this.game().getLanguage()))
      .arg(destination?.getName(this.game().getLanguage()) || "")));

    this._txtPatrolling.setBig();
    this._txtPatrolling.setAlign(ALIGN_CENTER);
    this._txtPatrolling.setText(String(this.tr("STR_NOW_PATROLLING")));
  }

  btnOkClick(_action?: Action): void {
    this.game().popState();
  }

  btnRedirectClick(_action?: Action): void {
    this.game().popState();
    this.game().pushState(new GeoscapeCraftState(this._craft, this._globe, null));
  }
}
