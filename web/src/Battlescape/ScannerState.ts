import type { Action } from "../Engine/Action.ts";
import { InteractiveSurface } from "../Engine/InteractiveSurface.ts";
import { Options } from "../Engine/Options.ts";
import { Screen } from "../Engine/Screen.ts";
import { State } from "../Engine/State.ts";
import { Surface } from "../Engine/Surface.ts";
import { Timer } from "../Engine/Timer.ts";
import { SDL_BUTTON_RIGHT, SDL_MOUSEBUTTONDOWN } from "../types.ts";
import type { BattleAction } from "./BattlescapeGame.ts";
import { ScannerView } from "./ScannerView.ts";

/**
 * The Scanner User Interface.
 */
export class ScannerState extends State {
  private _bg: InteractiveSurface;
  private _scan: Surface;
  private _scannerView: ScannerView;
  private _timerAnimate: Timer;

  constructor(private _action: BattleAction) {
    super();

    if (Options.maximizeInfoScreens) {
      Options.baseXResolution = Screen.ORIGINAL_WIDTH;
      Options.baseYResolution = Screen.ORIGINAL_HEIGHT;
      this.game().getScreen().resetDisplay();
    }

    this._bg = new InteractiveSurface(320, 200);
    this._scan = new Surface(320, 200);
    this._scannerView = new ScannerView(152, 152, 56, 24, this.game(), this._action.actor);

    if (this.game().getScreen().getDY() > 50) {
      this._screen = false;
    }

    this.game().getSavedGame()?.getSavedBattle()?.setPaletteByDepth(this);

    this.add(this._scan);
    this.add(this._scannerView);
    this.add(this._bg);

    this.centerAllSurfaces();

    this.game().getMod()?.getSurface("DETBORD.PCK")?.blit(this._bg);
    this.game().getMod()?.getSurface("DETBORD2.PCK")?.blit(this._scan);
    this._bg.onMouseClick(this.exitClick.bind(this));
    this._bg.onKeyboardPress(this.exitClick.bind(this), Options.keyCancel);

    this._timerAnimate = new Timer(125);
    this._timerAnimate.onTimer(this.animate.bind(this));
    this._timerAnimate.start();

    this.update();
  }

  override handle(action: Action): void {
    super.handle(action);
    const details = action.getDetails();
    if (details.type === SDL_MOUSEBUTTONDOWN && details.button?.button === SDL_BUTTON_RIGHT) {
      this.exitClick(action);
    }
  }

  private update(): void {}

  private animate(): void {
    this._scannerView.animate();
  }

  override think(): void {
    super.think();
    this._timerAnimate.think(this, null);
  }

  exitClick(_action: Action): void {
    if (Options.maximizeInfoScreens) {
      const width = { value: Options.baseXBattlescape };
      const height = { value: Options.baseYBattlescape };
      Screen.updateScale(Options.battlescapeScale, width, height, true);
      Options.baseXBattlescape = width.value;
      Options.baseYBattlescape = height.value;
      this.game().getScreen().resetDisplay();
    }
    this.game().popState();
  }
}
