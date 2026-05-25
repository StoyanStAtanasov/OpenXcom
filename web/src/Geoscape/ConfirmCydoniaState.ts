import { Options } from "../Engine/Options.ts";
import { State } from "../Engine/State.ts";
import type { Action } from "../Engine/Action.ts";
import { ALIGN_CENTER, Text } from "../Interface/Text.ts";
import { TextButton } from "../Interface/TextButton.ts";
import { Window } from "../Interface/Window.ts";
import { BriefingState } from "../Battlescape/BriefingState.ts";
import { BattlescapeGenerator } from "../Battlescape/BattlescapeGenerator.ts";
import { SavedBattleGame } from "../Savegame/SavedBattleGame.ts";
import type { Craft } from "../Savegame/Craft.ts";

type SavedGameWithBattle = {
  setSavedBattle?: (battle: SavedBattleGame | null) => void;
  setBattleGame?: (battle: SavedBattleGame | null) => void;
  getDifficulty?: () => number;
};

function setSavedBattleGame(save: SavedGameWithBattle | null, battle: SavedBattleGame): void {
  if (!save) {
    return;
  }
  if (save.setSavedBattle) {
    save.setSavedBattle(battle);
  } else {
    save.setBattleGame?.(battle);
  }
}

/**
 * Screen that allows the player to confirm the Cydonia mission.
 */
export class ConfirmCydoniaState extends State {
  private _window: Window;
  private _txtMessage: Text;
  private _btnNo: TextButton;
  private _btnYes: TextButton;

  constructor(private _craft: Craft) {
    super();
    this._screen = false;

    this._window = new Window(this, 256, 160, 32, 20);
    this._btnYes = new TextButton(80, 20, 70, 142);
    this._btnNo = new TextButton(80, 20, 170, 142);
    this._txtMessage = new Text(224, 48, 48, 76);

    this.setInterface("confirmCydonia");

    this.add(this._window, "window", "confirmCydonia");
    this.add(this._btnYes, "button", "confirmCydonia");
    this.add(this._btnNo, "button", "confirmCydonia");
    this.add(this._txtMessage, "text", "confirmCydonia");

    this.centerAllSurfaces();

    const back12 = this.game().getMod()?.getSurface("BACK12.SCR");
    if (back12) {
      this._window.setBackground(back12);
    }

    this._btnYes.setText(String(this.tr("STR_YES")));
    this._btnYes.onMouseClick(this.btnYesClick.bind(this));
    this._btnYes.onKeyboardPress(this.btnYesClick.bind(this), Options.keyOk);

    this._btnNo.setText(String(this.tr("STR_NO")));
    this._btnNo.onMouseClick(this.btnNoClick.bind(this));
    this._btnNo.onKeyboardPress(this.btnNoClick.bind(this), Options.keyCancel);

    this._txtMessage.setAlign(ALIGN_CENTER);
    this._txtMessage.setBig();
    this._txtMessage.setWordWrap(true);
    this._txtMessage.setText(String(this.tr("STR_ARE_YOU_SURE_CYDONIA")));
  }

  /**
   * Starts the Cydonia mission setup and leaves a source-named BriefingState boundary.
   */
  async btnYesClick(_action?: Action): Promise<void> {
    this.game().popState();
    this.game().popState();

    const bgame = new SavedBattleGame();
    const save = this.game().getSavedGame() as (SavedGameWithBattle | null);
    setSavedBattleGame(save, bgame);

    const mod = this.game().getMod();
    const bgen = new BattlescapeGenerator(bgame, mod);
    for (const deploymentId of mod?.getDeploymentsList() || []) {
      const deployment = mod?.getDeployment(deploymentId);
      if (deployment?.isFinalDestination()) {
        bgame.setMissionType(deploymentId);
        bgen.setAlienRace(deployment.getRace());
        break;
      }
    }
    bgen.setCraft(this._craft);
    if (save?.getDifficulty) {
      bgen.setDifficulty(save.getDifficulty());
    }

    await bgen.run();
    this.game().pushState(new BriefingState(this._craft));
  }

  /**
   * Returns to the previous screen.
   */
  btnNoClick(_action?: Action): void {
    this.game().popState();
  }
}
