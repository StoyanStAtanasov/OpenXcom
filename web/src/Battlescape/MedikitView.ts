import type { Action } from "../Engine/Action.ts";
import type { Game } from "../Engine/Game.ts";
import { InteractiveSurface } from "../Engine/InteractiveSurface.ts";
import type { State } from "../Engine/State.ts";
import type { Text } from "../Interface/Text.ts";
import type { BattleUnit } from "../Savegame/BattleUnit.ts";

const PARTS_STRING = [
  "STR_HEAD",
  "STR_TORSO",
  "STR_RIGHT_ARM",
  "STR_LEFT_ARM",
  "STR_RIGHT_LEG",
  "STR_LEFT_LEG"
];

/**
 * Displays a view of unit wounds.
 */
export class MedikitView extends InteractiveSurface {
  private _selectedPart = 0;

  constructor(
    w: number,
    h: number,
    x: number,
    y: number,
    private _game: Game,
    private _unit: BattleUnit,
    private _partTxt: Text,
    private _woundTxt: Text
  ) {
    super(w, h, x, y);
    this.updateSelectedPart();
    this.invalidate();
  }

  override draw(): void {
    const set = this._game.getMod()?.getSurfaceSet("MEDIBITS.DAT") || null;
    const fatalWound = this._unit.getFatalWound(this._selectedPart);
    let green = 0;
    let red = 3;
    const body = this._game.getMod()?.getInterface("medikit")?.getElement("body");
    if (body) {
      green = body.color;
      red = body.color2;
    }

    super.draw();
    this.lock();
    if (set) {
      for (let i = 0; i < set.getTotalFrames(); i++) {
        const wound = this._unit.getFatalWound(i);
        const surface = set.getFrame(i);
        const baseColor = wound ? red : green;
        surface?.blitNShade(this, this.getX(), this.getY(), 0, false, baseColor);
      }
    }
    this.unlock();

    if (this._selectedPart === -1) {
      return;
    }
    this._partTxt.setText(String(this._game.getLanguage().getString(PARTS_STRING[this._selectedPart])));
    this._woundTxt.setText(String(fatalWound));
  }

  override mouseClick(action: Action, _state: State): void {
    const set = this._game.getMod()?.getSurfaceSet("MEDIBITS.DAT") || null;
    if (!set) {
      return;
    }

    const x = Math.trunc(action.getRelativeXMouse() / action.getXScale());
    const y = Math.trunc(action.getRelativeYMouse() / action.getYScale());
    for (let i = 0; i < set.getTotalFrames(); i++) {
      const surface = set.getFrame(i);
      if (surface?.getPixel(x, y)) {
        this._selectedPart = i;
        this.invalidate();
        break;
      }
    }
  }

  getSelectedPart(): number {
    return this._selectedPart;
  }

  updateSelectedPart(): void {
    for (let i = 0; i < 6; ++i) {
      if (this._unit.getFatalWound(i)) {
        this._selectedPart = i;
        break;
      }
    }
  }
}
