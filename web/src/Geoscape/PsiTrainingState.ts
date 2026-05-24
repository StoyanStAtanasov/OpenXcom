import type { Action } from "../Engine/Action.ts";
import { Options } from "../Engine/Options.ts";
import { State } from "../Engine/State.ts";
import { ALIGN_CENTER, Text } from "../Interface/Text.ts";
import { TextButton } from "../Interface/TextButton.ts";
import { Window } from "../Interface/Window.ts";
import type { Base } from "../Savegame/Base.ts";
import { AllocatePsiTrainingState } from "./AllocatePsiTrainingState.ts";

export class PsiTrainingState extends State {
  private _btnOk: TextButton;
  private _window: Window;
  private _txtTitle: Text;
  private _btnBases: TextButton[] = [];
  private _bases: Base[] = [];

  constructor() {
    super();

    this._window = new Window(this, 320, 200, 0, 0);
    this._txtTitle = new Text(300, 17, 10, 16);
    this._btnOk = new TextButton(160, 14, 80, 174);

    this.setInterface("psiTraining");

    this.add(this._window, "window", "psiTraining");
    this.add(this._btnOk, "button2", "psiTraining");
    this.add(this._txtTitle, "text", "psiTraining");

    const back01 = this.game().getMod()?.getSurface("BACK01.SCR");
    if (back01) {
      this._window.setBackground(back01);
    }

    this._btnOk.setText(String(this.tr("STR_OK")));
    this._btnOk.onMouseClick(this.btnOkClick.bind(this));
    this._btnOk.onKeyboardPress(this.btnOkClick.bind(this), Options.keyCancel);

    this._txtTitle.setBig();
    this._txtTitle.setAlign(ALIGN_CENTER);
    this._txtTitle.setText(String(this.tr("STR_PSIONIC_TRAINING")));

    let buttons = 0;
    for (const base of this.game().getSavedGame()?.getBases() || []) {
      if (base.getAvailablePsiLabs()) {
        const btnBase = new TextButton(160, 14, 80, 40 + 16 * buttons);
        btnBase.onMouseClick(this.btnBaseXClick.bind(this));
        btnBase.setText(base.getName());
        this.add(btnBase, "button1", "psiTraining");
        this._bases.push(base);
        this._btnBases.push(btnBase);
        ++buttons;
        if (buttons >= 8) {
          break;
        }
      }
    }

    this.centerAllSurfaces();
  }

  btnOkClick(_action?: Action): void {
    this.game().popState();
  }

  btnBaseXClick(action?: Action): void {
    for (let i = 0; i < this._btnBases.length; ++i) {
      if (action?.getSender() === this._btnBases[i]) {
        this.game().pushState(new AllocatePsiTrainingState(this._bases[i]));
        break;
      }
    }
  }
}
