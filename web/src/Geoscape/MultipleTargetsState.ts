import type { Action } from "../Engine/Action.ts";
import { Options } from "../Engine/Options.ts";
import { State } from "../Engine/State.ts";
import { TextButton } from "../Interface/TextButton.ts";
import { POPUP_VERTICAL, Window } from "../Interface/Window.ts";
import { Base } from "../Savegame/Base.ts";
import { Craft } from "../Savegame/Craft.ts";
import type { TargetLike } from "../Savegame/Target.ts";
import { Ufo } from "../Savegame/Ufo.ts";
import { ConfirmDestinationState } from "./ConfirmDestinationState.ts";
import type { Globe } from "./Globe.ts";
import { GeoscapeCraftState } from "./GeoscapeCraftState.ts";
import { InterceptState } from "./InterceptState.ts";
import { TargetInfoState } from "./TargetInfoState.ts";
import { UfoDetectedState } from "./UfoDetectedState.ts";

type GeoscapeStateLike = {
  getGlobe(): Globe;
  timerReset?: () => void;
};

/**
 * Displays a list of possible targets.
 */
export class MultipleTargetsState extends State {
  private static readonly MARGIN = 10;
  private static readonly SPACING = 4;
  private static readonly BUTTON_HEIGHT = 16;

  private _window: Window | null = null;
  private _btnTargets: TextButton[] = [];

  constructor(private _targets: TargetLike[], private _craft: Craft | null, private _state: GeoscapeStateLike | null) {
    super();
    this._screen = false;

    if (this._targets.length > 1) {
      const winHeight = MultipleTargetsState.BUTTON_HEIGHT * this._targets.length + MultipleTargetsState.SPACING * (this._targets.length - 1) + MultipleTargetsState.MARGIN * 2;
      const winY = Math.trunc((200 - winHeight) / 2);
      const btnY = winY + MultipleTargetsState.MARGIN;

      this._window = new Window(this, 136, winHeight, 60, winY, POPUP_VERTICAL);

      this.setInterface("multipleTargets");

      this.add(this._window, "window", "multipleTargets");

      const back15 = this.game().getMod()?.getSurface("BACK15.SCR");
      if (back15) {
        this._window.setBackground(back15);
      }

      let y = btnY;
      for (const target of this._targets) {
        const button = new TextButton(116, MultipleTargetsState.BUTTON_HEIGHT, 70, y);
        button.setText(target.getName(this.game().getLanguage()));
        button.onMouseClick(this.btnTargetClick.bind(this));
        this.add(button, "button", "multipleTargets");

        this._btnTargets.push(button);
        y += button.getHeight() + MultipleTargetsState.SPACING;
      }
      this._btnTargets[0]?.onKeyboardPress(this.btnCancelClick.bind(this), Options.keyCancel);

      this.centerAllSurfaces();
    }
  }

  override init(): void {
    if (this._targets.length === 1) {
      this.popupTarget(this._targets[0]);
    } else {
      super.init();
    }
  }

  popupTarget(target: TargetLike): void {
    this.game().popState();
    if (this._craft === null) {
      if (!this._state) {
        return;
      }
      if (target instanceof Base) {
        this.game().pushState(new InterceptState(this._state.getGlobe(), target));
      } else if (target instanceof Craft) {
        this.game().pushState(new GeoscapeCraftState(target, this._state.getGlobe(), null));
      } else if (target instanceof Ufo) {
        this.game().pushState(new UfoDetectedState(target, this._state, false, target.getHyperDetected()));
      } else {
        this.game().pushState(new TargetInfoState(target, this._state.getGlobe()));
      }
    } else {
      this.game().pushState(new ConfirmDestinationState(this._craft, target));
    }
  }

  btnCancelClick(_action?: Action): void {
    this.game().popState();
  }

  btnTargetClick(action: Action): void {
    for (let i = 0; i < this._btnTargets.length; ++i) {
      if (action.getSender() === this._btnTargets[i]) {
        this.popupTarget(this._targets[i]);
        break;
      }
    }
  }
}
