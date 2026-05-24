import type { Game } from "../Engine/Game.ts";
import { InteractiveSurface } from "../Engine/InteractiveSurface.ts";
import type { PaletteColor } from "../types.ts";
import { Frame } from "../Interface/Frame.ts";
import { Text } from "../Interface/Text.ts";
import type { Action } from "../Engine/Action.ts";
import type { State } from "../Engine/State.ts";
import type { BattleActionType } from "./BattlescapeGame.ts";

/**
 * Battlescape action popup menu row.
 */
export class ActionMenuItem extends InteractiveSurface {
  private _frame: Frame;
  private _txtDescription: Text;
  private _txtAcc: Text;
  private _txtTU: Text;
  private _highlighted = false;
  private _action: BattleActionType;
  private _tu = 0;
  private _highlightModifier: number;

  constructor(id: number, game: Game, x: number, y: number) {
    super(272, 40, x + 24, y - (id * 40));

    const big = game.getMod()?.getFont("FONT_BIG");
    const small = game.getMod()?.getFont("FONT_SMALL");
    const lang = game.getLanguage();
    const actionMenu = game.getMod()?.getInterface("battlescape")?.getElement("actionMenu");
    const border = actionMenu?.border ?? 1;
    const color = actionMenu?.color ?? 1;
    const color2 = actionMenu?.color2 ?? 0;

    this._action = 0 as BattleActionType;
    this._highlightModifier = actionMenu?.TFTDMode ? 12 : 3;

    this._frame = new Frame(this.getWidth(), this.getHeight(), 0, 0);
    this._frame.setHighContrast(true);
    this._frame.setColor(border);
    this._frame.setSecondaryColor(color2);
    this._frame.setThickness(8);

    this._txtDescription = new Text(200, 20, 10, 13);
    this._txtDescription.initText(big, small, lang);
    this._txtDescription.setBig();
    this._txtDescription.setHighContrast(true);
    this._txtDescription.setColor(color);
    this._txtDescription.setVisible(true);

    this._txtAcc = new Text(100, 20, 140, 13);
    this._txtAcc.initText(big, small, lang);
    this._txtAcc.setBig();
    this._txtAcc.setHighContrast(true);
    this._txtAcc.setColor(color);

    this._txtTU = new Text(80, 20, 210, 13);
    this._txtTU.initText(big, small, lang);
    this._txtTU.setBig();
    this._txtTU.setHighContrast(true);
    this._txtTU.setColor(color);
  }

  setAction(action: BattleActionType, description: string, accuracy: string, timeunits: string, tu: number): void {
    this._action = action;
    this._txtDescription.setText(description);
    this._txtAcc.setText(accuracy);
    this._txtTU.setText(timeunits);
    this._tu = tu;
    this.invalidate();
  }

  getAction(): BattleActionType {
    return this._action;
  }

  getTUs(): number {
    return this._tu;
  }

  override setPalette(colors: PaletteColor[], firstcolor = 0, ncolors = colors.length): void {
    super.setPalette(colors, firstcolor, ncolors);
    this._frame.setPalette(colors, firstcolor, ncolors);
    this._txtDescription.setPalette(colors, firstcolor, ncolors);
    this._txtAcc.setPalette(colors, firstcolor, ncolors);
    this._txtTU.setPalette(colors, firstcolor, ncolors);
  }

  override draw(): void {
    super.draw();
    this._frame.blit(this);
    this._txtDescription.blit(this);
    this._txtAcc.blit(this);
    this._txtTU.blit(this);
  }

  override mouseIn(action: Action, state: State): void {
    this._highlighted = true;
    this._frame.setSecondaryColor(this._frame.getSecondaryColor() - this._highlightModifier);
    this.draw();
    super.mouseIn(action, state);
  }

  override mouseOut(action: Action, state: State): void {
    this._highlighted = false;
    this._frame.setSecondaryColor(this._frame.getSecondaryColor() + this._highlightModifier);
    this.draw();
    super.mouseOut(action, state);
  }
}
