import { Options } from "../Engine/Options.ts";
import { State } from "../Engine/State.ts";
import type { Action } from "../Engine/Action.ts";
import { ALIGN_CENTER, Text } from "../Interface/Text.ts";
import { TextButton } from "../Interface/TextButton.ts";
import { Window } from "../Interface/Window.ts";
import { MissionObjective } from "../Mod/RuleAlienMission.ts";
import type { AlienMission } from "../Savegame/AlienMission.ts";
import type { Base } from "../Savegame/Base.ts";

/**
 * Screen that allows the player to acknowledge an undefended base's destruction.
 */
export class BaseDestroyedState extends State {
  private _window: Window;
  private _txtMessage: Text;
  private _btnOk: TextButton;

  constructor(private _base: Base) {
    super();
    this._screen = false;

    this._window = new Window(this, 256, 160, 32, 20);
    this._btnOk = new TextButton(100, 20, 110, 142);
    this._txtMessage = new Text(224, 48, 48, 76);

    this.setInterface("baseDestroyed");

    this.add(this._window, "window", "baseDestroyed");
    this.add(this._btnOk, "button", "baseDestroyed");
    this.add(this._txtMessage, "text", "baseDestroyed");

    this.centerAllSurfaces();

    const back15 = this.game().getMod()?.getSurface("BACK15.SCR");
    if (back15) {
      this._window.setBackground(back15);
    }

    this._btnOk.setText(String(this.tr("STR_OK")));
    this._btnOk.onMouseClick(this.btnOkClick.bind(this));
    this._btnOk.onKeyboardPress(this.btnOkClick.bind(this), Options.keyOk);
    this._btnOk.onKeyboardPress(this.btnOkClick.bind(this), Options.keyCancel);

    this._txtMessage.setAlign(ALIGN_CENTER);
    this._txtMessage.setBig();
    this._txtMessage.setWordWrap(true);
    this._txtMessage.setText(String(this.tr("STR_THE_ALIENS_HAVE_DESTROYED_THE_UNDEFENDED_BASE").arg(this._base.getName())));

    this.removeRetaliationMission();
  }

  btnOkClick(_action?: Action): void {
    this.game().popState();
    const bases = this.game().getSavedGame()?.getBases();
    if (!bases) {
      return;
    }
    const index = bases.indexOf(this._base);
    if (index !== -1) {
      bases.splice(index, 1);
    }
  }

  private removeRetaliationMission(): void {
    const save = this.game().getSavedGame();
    if (!save) {
      return;
    }

    let regionType = "";
    for (const region of save.getRegions()) {
      if (region.getRules().insideRegion(this._base.getLongitude(), this._base.getLatitude())) {
        regionType = region.getRules().getType();
        break;
      }
    }
    if (!regionType) {
      return;
    }

    const alienMission = save.getAlienMissions().find(mission =>
      mission.getRegion() === regionType &&
      mission.getRules().getObjective() === MissionObjective.OBJECTIVE_RETALIATION
    ) || null;
    if (!alienMission) {
      return;
    }

    const ufos = save.getUfos();
    for (let i = 0; i < ufos.length;) {
      if (ufos[i].getMission() === alienMission) {
        ufos.splice(i, 1);
      } else {
        ++i;
      }
    }

    this.eraseAlienMission(alienMission);
  }

  private eraseAlienMission(alienMission: AlienMission): void {
    const missions = this.game().getSavedGame()?.getAlienMissions();
    if (!missions) {
      return;
    }
    const index = missions.indexOf(alienMission);
    if (index !== -1) {
      missions.splice(index, 1);
    }
  }
}
