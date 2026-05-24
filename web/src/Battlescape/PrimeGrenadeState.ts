import { State } from "../Engine/State.ts";
import { Surface } from "../Engine/Surface.ts";
import { InteractiveSurface } from "../Engine/InteractiveSurface.ts";
import type { Action } from "../Engine/Action.ts";
import { Frame } from "../Interface/Frame.ts";
import { ALIGN_CENTER, ALIGN_MIDDLE, Text } from "../Interface/Text.ts";
import type { BattleItem } from "../Savegame/BattleItem.ts";
import { SDL_BUTTON_LEFT, SDL_BUTTON_RIGHT, SDL_MOUSEBUTTONDOWN } from "../types.ts";
import type { BattleAction } from "./BattlescapeGame.ts";

/**
 * Window that allows the player to set the timer of an explosive.
 */
export class PrimeGrenadeState extends State {
  private _number: Text[] = [];
  private _button: InteractiveSurface[] = [];
  private _title: Text;
  private _frame: Frame;
  private _bg: Surface;

  constructor(
    private _action: BattleAction | null,
    private _inInventoryView: boolean,
    private _grenadeInInventory: BattleItem | null
  ) {
    super();
    this._screen = false;

    this._title = new Text(192, 24, 65, 44);
    this._frame = new Frame(192, 27, 65, 37);
    this._bg = new Surface(192, 93, 65, 45);

    let x = 67;
    const y = 68;
    for (let i = 0; i < 24; ++i) {
      this._button[i] = new InteractiveSurface(22, 22, x - 1 + ((i % 8) * 24), y - 4 + (Math.trunc(i / 8) * 25));
      this._number[i] = new Text(20, 20, x + ((i % 8) * 24), y - 1 + (Math.trunc(i / 8) * 25));
    }
    x = 67;

    if (this._inInventoryView) {
      this.setPaletteByName("PAL_BATTLESCAPE");
    } else {
      this.game().getSavedGame()?.getSavedBattle()?.setPaletteByDepth(this);
    }

    const grenadeBackground = this.game().getMod()?.getInterface("battlescape")?.getElement("grenadeBackground");
    const backgroundColor = grenadeBackground?.color ?? 0;
    const borderColor = grenadeBackground?.border ?? 1;
    const buttonColor = grenadeBackground?.color2 ?? 2;

    this.add(this._bg);
    this._bg.drawRect(0, 0, this._bg.getWidth(), this._bg.getHeight(), backgroundColor);

    this.add(this._frame, "grenadeMenu", "battlescape");
    this._frame.setThickness(3);
    this._frame.setHighContrast(true);

    this.add(this._title, "grenadeMenu", "battlescape");
    this._title.setAlign(ALIGN_CENTER);
    this._title.setBig();
    this._title.setText(String(this.tr("STR_SET_TIMER")));
    this._title.setHighContrast(true);

    for (let i = 0; i < 24; ++i) {
      const button = this._button[i];
      this.add(button);
      button.onMouseClick(this.btnClick.bind(this), SDL_BUTTON_LEFT);
      button.onMouseClick(this.btnClick.bind(this), SDL_BUTTON_RIGHT);
      button.drawRect(0, 0, button.getWidth(), button.getHeight(), borderColor);
      button.drawRect(1, 1, button.getWidth() - 2, button.getHeight() - 2, buttonColor);

      const number = this._number[i];
      this.add(number, "grenadeMenu", "battlescape");
      number.setBig();
      number.setText(String(i));
      number.setHighContrast(true);
      number.setAlign(ALIGN_CENTER);
      number.setVerticalAlign(ALIGN_MIDDLE);
    }

    this.centerAllSurfaces();
    this.lowerAllSurfaces();
  }

  override handle(action: Action): void {
    super.handle(action);
    const details = action.getDetails();
    if (details.type === SDL_MOUSEBUTTONDOWN && details.button?.button === SDL_BUTTON_RIGHT) {
      if (!this._inInventoryView && this._action) {
        this._action.value = -1;
      }
      this.game().popState();
    }
  }

  btnClick(action: Action): void {
    let btnID = -1;

    if (action.getDetails().button?.button === SDL_BUTTON_RIGHT) {
      if (!this._inInventoryView && this._action) {
        this._action.value = btnID;
      }
      this.game().popState();
      return;
    }

    for (let i = 0; i < 24 && btnID === -1; ++i) {
      if (action.getSender() === this._button[i]) {
        btnID = i;
      }
    }

    if (btnID !== -1) {
      if (this._inInventoryView) {
        this._grenadeInInventory?.setFuseTimer(btnID);
      } else if (this._action) {
        this._action.value = btnID;
      }
      this.game().popState();
      if (!this._inInventoryView) {
        this.game().popState();
      }
    }
  }
}
