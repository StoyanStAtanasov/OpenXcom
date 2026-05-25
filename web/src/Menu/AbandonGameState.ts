import { Options } from "../Engine/Options.ts";
import { Screen } from "../Engine/Screen.ts";
import { State } from "../Engine/State.ts";
import type { Action } from "../Engine/Action.ts";
import { Text, ALIGN_CENTER } from "../Interface/Text.ts";
import { TextButton } from "../Interface/TextButton.ts";
import { Window, POPUP_BOTH } from "../Interface/Window.ts";
import { MainMenuState } from "./MainMenuState.ts";
import { OPT_BATTLESCAPE, OPT_GEOSCAPE, type OptionsOrigin } from "./OptionsBaseState.ts";
import { SaveGameState, SaveType } from "./SaveGameState.ts";

type SoundDepthModLike = {
  getSoundByDepth?: (depth: number, sound: number, error?: boolean) => { stopLoop?: () => void } | null;
};

export class AbandonGameState extends State {
  private _btnYes: TextButton;
  private _btnNo: TextButton;
  private _window: Window;
  private _txtTitle: Text;

  constructor(private _origin: OptionsOrigin) {
    super();
    this._screen = false;
    const x = this._origin === OPT_GEOSCAPE ? 20 : 52;
    this._window = new Window(this, 216, 160, x, 20, POPUP_BOTH);
    this._btnYes = new TextButton(50, 20, x + 18, 140);
    this._btnNo = new TextButton(50, 20, x + 148, 140);
    this._txtTitle = new Text(206, 17, x + 5, 70);

    this.setInterface("geoscape");
    this.add(this._window, "genericWindow", "geoscape");
    this.add(this._btnYes, "genericButton2", "geoscape");
    this.add(this._btnNo, "genericButton2", "geoscape");
    this.add(this._txtTitle, "genericText", "geoscape");
    this.centerAllSurfaces();

    const back01 = this.game().getMod()?.getSurface("BACK01.SCR");
    if (back01) {
      this._window.setBackground(back01);
    }

    this._btnYes.setText(String(this.tr("STR_YES")));
    this._btnYes.onMouseClick(this.btnYesClick.bind(this));
    this._btnYes.onKeyboardPress(this.btnYesClick.bind(this), Options.keyOk);
    this._btnNo.setText(String(this.tr("STR_NO")));
    this._btnNo.onMouseClick(this.btnNoClick.bind(this));
    this._btnNo.onKeyboardPress(this.btnNoClick.bind(this), Options.keyCancel);
    this._txtTitle.setAlign(ALIGN_CENTER);
    this._txtTitle.setBig();
    this._txtTitle.setText(String(this.tr("STR_ABANDON_GAME_QUESTION")));

    if (this._origin === OPT_BATTLESCAPE) {
      this.applyBattlescapeTheme();
    }
  }

  btnYesClick(_action?: Action): void {
    const battle = this.game().getSavedGame()?.getSavedBattle?.();
    const ambientSound = battle?.getAmbientSound?.() ?? -1;
    if (this._origin === OPT_BATTLESCAPE && ambientSound !== -1) {
      (this.game().getMod() as SoundDepthModLike | null)?.getSoundByDepth?.(0, ambientSound)?.stopLoop?.();
    }
    if (!this.game().getSavedGame()?.isIronman?.()) {
      const width = { value: Options.baseXGeoscape };
      const height = { value: Options.baseYGeoscape };
      Screen.updateScale(Options.geoscapeScale, width, height, true);
      Options.baseXGeoscape = width.value;
      Options.baseYGeoscape = height.value;
      this.game().getScreen().resetDisplay();
      this.game().setState(new MainMenuState());
      this.game().setSavedGame(null);
    } else {
      this.game().pushState(new SaveGameState(OPT_GEOSCAPE, SaveType.SAVE_IRONMAN_END, this._palette));
    }
  }

  btnNoClick(_action?: Action): void {
    this.game().popState();
  }
}
