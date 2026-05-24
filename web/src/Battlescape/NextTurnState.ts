import { Options } from "../Engine/Options.ts";
import { Palette } from "../Engine/Palette.ts";
import { State } from "../Engine/State.ts";
import { Surface } from "../Engine/Surface.ts";
import { Timer } from "../Engine/Timer.ts";
import type { Action } from "../Engine/Action.ts";
import { ALIGN_CENTER, Text } from "../Interface/Text.ts";
import { Window } from "../Interface/Window.ts";
import { SpecialTileType } from "../Mod/MapData.ts";
import type { SavedBattleGame } from "../Savegame/SavedBattleGame.ts";
import { UnitFaction } from "../Savegame/BattleUnit.ts";
import { SDL_KEYDOWN, SDL_MOUSEBUTTONDOWN } from "../types.ts";
import type { BattlescapeState } from "./BattlescapeState.ts";

/**
 * Screen which announces the next turn.
 */
export class NextTurnState extends State {
  private static readonly NEXT_TURN_DELAY = 500;

  private _window: Window;
  private _txtTitle: Text;
  private _txtTurn: Text;
  private _txtSide: Text;
  private _txtMessage: Text;
  private _timer: Timer | null = null;
  private _bg: Surface;

  constructor(private _battleGame: SavedBattleGame, private _state: BattlescapeState) {
    super();
    const y = this._state.getMap().getMessageY();

    this._window = new Window(this, 320, 200, 0, 0);
    this._txtTitle = new Text(320, 17, 0, 68);
    this._txtTurn = new Text(320, 17, 0, 92);
    this._txtSide = new Text(320, 17, 0, 108);
    this._txtMessage = new Text(320, 17, 0, 132);
    this._bg = new Surface(this.game().getScreen().getWidth(), this.game().getScreen().getWidth(), 0, 0);

    this._battleGame.setPaletteByDepth(this);

    this.add(this._bg);
    this.add(this._window);
    this.add(this._txtTitle, "messageWindows", "battlescape");
    this.add(this._txtTurn, "messageWindows", "battlescape");
    this.add(this._txtSide, "messageWindows", "battlescape");
    this.add(this._txtMessage, "messageWindows", "battlescape");

    this.centerAllSurfaces();

    this._bg.setX(0);
    this._bg.setY(0);
    this._bg.drawRect({ x: 0, y: 0, w: this._bg.getWidth(), h: this._bg.getHeight() }, Palette.blockOffset(0) + 15);

    this._window.setY(y);
    this._txtTitle.setY(y + 68);
    this._txtTurn.setY(y + 92);
    this._txtSide.setY(y + 108);
    this._txtMessage.setY(y + 132);

    this._window.setColor(Palette.blockOffset(0) - 1);
    this._window.setHighContrast(true);
    const tac = this.game().getMod()?.getSurface("TAC00.SCR");
    if (tac) {
      this._window.setBackground(tac);
    }

    this._txtTitle.setBig();
    this._txtTitle.setAlign(ALIGN_CENTER);
    this._txtTitle.setHighContrast(true);
    this._txtTitle.setText(String(this.tr("STR_OPENXCOM")));

    this._txtTurn.setBig();
    this._txtTurn.setAlign(ALIGN_CENTER);
    this._txtTurn.setHighContrast(true);
    let turn = String(this.tr("STR_TURN").arg(this._battleGame.getTurn()));
    if (this._battleGame.getTurnLimit() > 0) {
      turn += `/${this._battleGame.getTurnLimit()}`;
      if (this._battleGame.getTurnLimit() - this._battleGame.getTurn() <= 3) {
        const weight = this.game().getMod()?.getInterface("inventory")?.getElement("weight");
        if (weight) {
          this._txtTurn.setColor(weight.color2);
        }
      }
    }
    this._txtTurn.setText(turn);

    this._txtSide.setBig();
    this._txtSide.setAlign(ALIGN_CENTER);
    this._txtSide.setHighContrast(true);
    const side = this._battleGame.getSide() === UnitFaction.FACTION_PLAYER ? "STR_XCOM" : "STR_ALIENS";
    this._txtSide.setText(String(this.tr("STR_SIDE").arg(this.tr(side))));

    this._txtMessage.setBig();
    this._txtMessage.setAlign(ALIGN_CENTER);
    this._txtMessage.setHighContrast(true);
    this._txtMessage.setText(String(this.tr("STR_PRESS_BUTTON_TO_CONTINUE")));

    this._state.clearMouseScrollingState();

    if (Options.skipNextTurnScreen) {
      this._timer = new Timer(NextTurnState.NEXT_TURN_DELAY);
      this._timer.onTimer(this.close.bind(this));
      this._timer.start();
    }
  }

  override handle(action: Action): void {
    super.handle(action);
    const type = action.getDetails().type;
    if (type === SDL_KEYDOWN || type === SDL_MOUSEBUTTONDOWN) {
      this.close();
    }
  }

  override think(): void {
    this._timer?.think(this, null);
  }

  close(): void {
    this._battleGame.getBattleGame()?.cleanupDeleted();
    this.game().popState();

    const liveAliens = { value: 0 };
    const liveSoldiers = { value: 0 };
    this._state.getBattleGame().tallyUnits(liveAliens, liveSoldiers);

    if ((this._battleGame.getObjectiveType() !== SpecialTileType.MUST_DESTROY && liveAliens.value === 0) || liveSoldiers.value === 0) {
      this._state.finishBattle(false, liveSoldiers.value);
    } else {
      this._state.btnCenterClick();
      if ((this._battleGame.getTurn() === 1 || this._battleGame.getTurn() % Options.autosaveFrequency === 0) &&
        this._battleGame.getSide() === UnitFaction.FACTION_PLAYER) {
        this._state.autosave();
      }
    }
  }

  override resize(dX: { value: number }, dY: { value: number }): void {
    super.resize(dX, dY);
    this._bg.setX(0);
    this._bg.setY(0);
  }
}
