import type { Action } from "../Engine/Action.ts";
import { Options } from "../Engine/Options.ts";
import { Palette } from "../Engine/Palette.ts";
import { Screen } from "../Engine/Screen.ts";
import { State } from "../Engine/State.ts";
import { Surface } from "../Engine/Surface.ts";
import { Timer } from "../Engine/Timer.ts";
import { BattlescapeButton } from "../Interface/BattlescapeButton.ts";
import { Text } from "../Interface/Text.ts";
import type { SavedBattleGame } from "../Savegame/SavedBattleGame.ts";
import { SDL_BUTTON_RIGHT, SDL_BUTTON_WHEELDOWN, SDL_BUTTON_WHEELUP, SDL_MOUSEBUTTONDOWN } from "../types.ts";
import type { Camera } from "./Camera.ts";
import { MiniMapView } from "./MiniMapView.ts";

/**
 * The MiniMap is a representation of a Battlescape map that allows you to see more of the map.
 */
export class MiniMapState extends State {
  private _bg: Surface;
  private _miniMapView: MiniMapView;
  private _btnLvlUp: BattlescapeButton;
  private _btnLvlDwn: BattlescapeButton;
  private _btnOk: BattlescapeButton;
  private _txtLevel: Text;
  private _timerAnimate: Timer;

  constructor(camera: Camera, battleGame: SavedBattleGame) {
    super();

    if (Options.maximizeInfoScreens) {
      Options.baseXResolution = Screen.ORIGINAL_WIDTH;
      Options.baseYResolution = Screen.ORIGINAL_HEIGHT;
      this.game().getScreen().resetDisplay();
    }

    this._bg = new Surface(320, 200);
    this._miniMapView = new MiniMapView(221, 148, 48, 16, this.game(), camera, battleGame);
    this._btnLvlUp = new BattlescapeButton(18, 20, 24, 62);
    this._btnLvlDwn = new BattlescapeButton(18, 20, 24, 88);
    this._btnOk = new BattlescapeButton(32, 32, 275, 145);
    this._txtLevel = new Text(28, 16, 281, 75);

    battleGame.setPaletteByDepth(this);

    this.add(this._bg);
    this.game().getMod()?.getSurface("SCANBORD.PCK")?.blit(this._bg);
    this.add(this._miniMapView);
    this.add(this._btnLvlUp, "buttonUp", "minimap", this._bg);
    this.add(this._btnLvlDwn, "buttonDown", "minimap", this._bg);
    this.add(this._btnOk, "buttonOK", "minimap", this._bg);
    this.add(this._txtLevel, "textLevel", "minimap", this._bg);

    this.centerAllSurfaces();

    if (this.game().getScreen().getDY() > 50) {
      this._screen = false;
      this._bg.drawRect(46, 14, 223, 151, Palette.blockOffset(15) + 15);
    }

    this._btnLvlUp.onMouseClick(this.btnLevelUpClick.bind(this));
    this._btnLvlDwn.onMouseClick(this.btnLevelDownClick.bind(this));
    this._btnOk.onMouseClick(this.btnOkClick.bind(this));
    this._btnOk.onKeyboardPress(this.btnOkClick.bind(this), Options.keyCancel);
    this._btnOk.onKeyboardPress(this.btnOkClick.bind(this), Options.keyBattleMap);
    this._txtLevel.setBig();
    this._txtLevel.setHighContrast(true);
    this._txtLevel.setText(String(this.tr("STR_LEVEL_SHORT").arg(camera.getViewLevel())));

    this._timerAnimate = new Timer(125);
    this._timerAnimate.onTimer(this.animate.bind(this));
    this._timerAnimate.start();
    this._miniMapView.draw();
  }

  override handle(action: Action): void {
    super.handle(action);
    const details = action.getDetails();
    if (details.type === SDL_MOUSEBUTTONDOWN) {
      if (details.button?.button === SDL_BUTTON_WHEELUP) {
        this.btnLevelUpClick(action);
      } else if (details.button?.button === SDL_BUTTON_WHEELDOWN) {
        this.btnLevelDownClick(action);
      } else if (details.button?.button === SDL_BUTTON_RIGHT) {
        this.btnOkClick(action);
      }
    }
  }

  btnOkClick(_action: Action): void {
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

  btnLevelUpClick(_action: Action): void {
    this._txtLevel.setText(String(this.tr("STR_LEVEL_SHORT").arg(this._miniMapView.up())));
  }

  btnLevelDownClick(_action: Action): void {
    this._txtLevel.setText(String(this.tr("STR_LEVEL_SHORT").arg(this._miniMapView.down())));
  }

  private animate(): void {
    this._miniMapView.animate();
  }

  override think(): void {
    super.think();
    this._timerAnimate.think(this, null);
  }
}
