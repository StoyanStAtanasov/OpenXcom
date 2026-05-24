import type { Action } from "../Engine/Action.ts";
import { Options } from "../Engine/Options.ts";
import { State } from "../Engine/State.ts";
import { ALIGN_CENTER, Text } from "../Interface/Text.ts";
import { TextButton } from "../Interface/TextButton.ts";
import { POPUP_BOTH, Window } from "../Interface/Window.ts";
import { Craft } from "../Savegame/Craft.ts";

type TargetLike = {
  getName?: (...args: any[]) => string;
};

type CraftRuntime = Craft & {
  returnToBase?: () => void;
  setDestination?: (target: TargetLike | null) => void;
};

/**
 * Window used to notify the player when an error occurs with a dogfight procedure.
 */
export class DogfightErrorState extends State {
  private _btnIntercept: TextButton;
  private _btnBase: TextButton;
  private _window: Window;
  private _txtCraft: Text;
  private _txtMessage: Text;

  constructor(private _craft: Craft, msg: string) {
    super();
    this._screen = false;

    this._window = new Window(this, 208, 120, 24, 48, POPUP_BOTH);
    this._btnIntercept = new TextButton(180, 12, 38, 128);
    this._btnBase = new TextButton(180, 12, 38, 144);
    this._txtCraft = new Text(198, 16, 29, 63);
    this._txtMessage = new Text(198, 20, 29, 94);

    this.setInterface("dogfightInfo");

    this.add(this._window, "window", "dogfightInfo");
    this.add(this._btnIntercept, "button", "dogfightInfo");
    this.add(this._btnBase, "button", "dogfightInfo");
    this.add(this._txtCraft, "text", "dogfightInfo");
    this.add(this._txtMessage, "text", "dogfightInfo");

    this.centerAllSurfaces();

    const back15 = this.game().getMod()?.getSurface("BACK15.SCR");
    if (back15) {
      this._window.setBackground(back15);
    }

    this._btnIntercept.setText(String(this.tr("STR_CONTINUE_INTERCEPTION_PURSUIT")));
    this._btnIntercept.onMouseClick(this.btnInterceptClick.bind(this));
    this._btnIntercept.onKeyboardPress(this.btnInterceptClick.bind(this), Options.keyCancel);

    this._btnBase.setText(String(this.tr("STR_RETURN_TO_BASE")));
    this._btnBase.onMouseClick(this.btnBaseClick.bind(this));
    this._btnBase.onKeyboardPress(this.btnBaseClick.bind(this), Options.keyOk);

    this._txtCraft.setAlign(ALIGN_CENTER);
    this._txtCraft.setBig();
    this._txtCraft.setText(this._craft.getName(this.game().getLanguage()));

    this._txtMessage.setAlign(ALIGN_CENTER);
    this._txtMessage.setWordWrap(true);
    this._txtMessage.setText(msg);
  }

  btnInterceptClick(_action?: Action): void {
    this.game().popState();
  }

  btnBaseClick(_action?: Action): void {
    const runtime = this._craft as CraftRuntime;
    if (runtime.returnToBase) {
      runtime.returnToBase();
    } else {
      runtime.setDestination?.(this._craft.getBase() as unknown as TargetLike);
    }
    this.game().popState();
  }
}
