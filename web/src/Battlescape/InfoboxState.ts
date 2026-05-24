import { State } from "../Engine/State.ts";
import { Timer } from "../Engine/Timer.ts";
import type { Action } from "../Engine/Action.ts";
import { Frame } from "../Interface/Frame.ts";
import { ALIGN_CENTER, ALIGN_MIDDLE, Text } from "../Interface/Text.ts";
import { SDL_KEYDOWN, SDL_MOUSEBUTTONDOWN } from "../types.ts";

/**
 * Frame that briefly shows battle information, then disappears after 2 seconds.
 */
export class InfoboxState extends State {
  static readonly INFOBOX_DELAY = 2000;

  private _text: Text;
  private _frame: Frame;
  private _timer: Timer;

  constructor(msg: string) {
    super();
    this._screen = false;

    this._frame = new Frame(261, 122, 34, 10);
    this._text = new Text(251, 112, 39, 15);

    this.game().getSavedGame()?.getSavedBattle()?.setPaletteByDepth(this);

    this.add(this._frame, "infoBox", "battlescape");
    this.add(this._text, "infoBox", "battlescape");

    this.centerAllSurfaces();

    this._frame.setHighContrast(true);
    this._frame.setThickness(9);

    this._text.setAlign(ALIGN_CENTER);
    this._text.setVerticalAlign(ALIGN_MIDDLE);
    this._text.setBig();
    this._text.setWordWrap(true);
    this._text.setText(msg);
    this._text.setHighContrast(true);

    this._timer = new Timer(InfoboxState.INFOBOX_DELAY);
    this._timer.onTimer(this.close.bind(this));
    this._timer.start();
  }

  override handle(action: Action): void {
    super.handle(action);
    const type = action.getDetails().type;
    if (type === SDL_KEYDOWN || type === SDL_MOUSEBUTTONDOWN) {
      this.close();
    }
  }

  override think(): void {
    this._timer.think(this, null);
  }

  close(): void {
    this.game().popState();
  }
}
