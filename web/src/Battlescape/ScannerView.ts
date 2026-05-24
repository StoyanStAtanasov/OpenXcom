import { InteractiveSurface } from "../Engine/InteractiveSurface.ts";
import type { Game } from "../Engine/Game.ts";
import type { Action } from "../Engine/Action.ts";
import type { State } from "../Engine/State.ts";
import type { BattleUnit } from "../Savegame/BattleUnit.ts";
import { Position } from "./Position.ts";

/**
 * Displays a view of unit movement.
 */
export class ScannerView extends InteractiveSurface {
  private _frame = 0;

  constructor(w: number, h: number, x: number, y: number, private _game: Game, private _unit: BattleUnit | null) {
    super(w, h, x, y);
    this.invalidate();
  }

  override draw(): void {
    const set = this._game.getMod()?.getSurfaceSet("DETBLOB.DAT") || null;
    super.draw();
    if (!this._unit || !set) {
      return;
    }

    const save = this._game.getSavedGame()?.getSavedBattle();
    if (!save) {
      return;
    }

    this.lock();
    for (let x = -9; x < 10; x++) {
      for (let y = -9; y < 10; y++) {
        for (let z = 0; z < save.getMapSizeZ(); z++) {
          const t = save.getTile(new Position(x, y, z).add(new Position(this._unit.getPosition().x, this._unit.getPosition().y, 0)));
          const unit = t?.getUnit();
          if (unit && unit.getMotionPoints()) {
            let frame = Math.trunc(unit.getMotionPoints() / 5);
            if (frame >= 0) {
              if (frame > 5) {
                frame = 5;
              }
              const surface = set.getFrame(frame + this._frame);
              surface?.blitNShade(this, this.getX() + ((9 + x) * 8) - 4, this.getY() + ((9 + y) * 8) - 4, 0);
            }
          }
        }
      }
    }

    const direction = this._unit.getDirection();
    const surface = set.getFrame(7 + direction);
    surface?.blitNShade(this, this.getX() + (9 * 8) - 4, this.getY() + (9 * 8) - 4, 0);
    this.unlock();
  }

  override mouseClick(_action: Action, _state: State): void {}

  animate(): void {
    this._frame++;
    if (this._frame > 1) {
      this._frame = 0;
    }
    this.invalidate();
  }
}
