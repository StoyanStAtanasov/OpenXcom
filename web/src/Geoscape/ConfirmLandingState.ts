import { Options } from "../Engine/Options.ts";
import { State } from "../Engine/State.ts";
import { TOK_COLOR_FLIP } from "../Engine/Unicode.ts";
import type { Action } from "../Engine/Action.ts";
import type { Surface } from "../Engine/Surface.ts";
import { ALIGN_CENTER, Text } from "../Interface/Text.ts";
import { TextButton } from "../Interface/TextButton.ts";
import { POPUP_BOTH, Window } from "../Interface/Window.ts";
import { BattlescapeGenerator } from "../Battlescape/BattlescapeGenerator.ts";
import { SavedBattleGame } from "../Savegame/SavedBattleGame.ts";
import { AlienBase } from "../Savegame/AlienBase.ts";
import { Base } from "../Savegame/Base.ts";
import type { Craft } from "../Savegame/Craft.ts";
import { MissionSite } from "../Savegame/MissionSite.ts";
import { Ufo, UfoStatus } from "../Savegame/Ufo.ts";

const CRAFT_DESTINATION_BOUNDARY = "__openxcomCraftDestinationBoundary";
const COLOR_FLIP = String.fromCharCode(TOK_COLOR_FLIP);

type TargetLike = {
  getName?: (language: unknown) => string;
  getDeployment?: () => { getType: () => string };
  getAlienRace?: () => string;
};

type CraftWithDestination = Craft & {
  getDestination?: () => TargetLike | null;
  returnToBase?: () => void;
  setDestination?: (target: TargetLike | Base | null) => void;
  [CRAFT_DESTINATION_BOUNDARY]?: TargetLike | Base | null;
};

type SavedGameWithBattle = {
  setSavedBattle?: (battle: SavedBattleGame | null) => void;
  setBattleGame?: (battle: SavedBattleGame | null) => void;
  getDifficulty?: () => number;
};

function getCraftDestination(craft: Craft): TargetLike | Base | null {
  const boundary = craft as CraftWithDestination;
  const destination = boundary.getDestination?.();
  return (destination as TargetLike | Base | null) || boundary[CRAFT_DESTINATION_BOUNDARY] || null;
}

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

function returnCraftToBase(craft: Craft): void {
  const boundary = craft as CraftWithDestination;
  if (boundary.returnToBase) {
    boundary.returnToBase();
    return;
  }
  const base = craft.getBase();
  boundary[CRAFT_DESTINATION_BOUNDARY] = base;
  boundary.setDestination?.(base);
}

/**
 * Window that allows the player to confirm a craft landing at its destination.
 */
export class ConfirmLandingState extends State {
  private _window: Window;
  private _txtMessage: Text;
  private _txtBegin: Text;
  private _btnYes: TextButton;
  private _btnNo: TextButton;

  constructor(private _craft: Craft, private _texture: Surface | null, private _shade: number) {
    super();
    this._screen = false;

    this._window = new Window(this, 216, 160, 20, 20, POPUP_BOTH);
    this._btnYes = new TextButton(80, 20, 40, 150);
    this._btnNo = new TextButton(80, 20, 136, 150);
    this._txtMessage = new Text(206, 80, 25, 40);
    this._txtBegin = new Text(206, 17, 25, 130);

    this.setInterface("confirmLanding");

    this.add(this._window, "window", "confirmLanding");
    this.add(this._btnYes, "button", "confirmLanding");
    this.add(this._btnNo, "button", "confirmLanding");
    this.add(this._txtMessage, "text", "confirmLanding");
    this.add(this._txtBegin, "text", "confirmLanding");

    this.centerAllSurfaces();

    const back15 = this.game().getMod()?.getSurface("BACK15.SCR");
    if (back15) {
      this._window.setBackground(back15);
    }

    this._btnYes.setText(String(this.tr("STR_YES")));
    this._btnYes.onMouseClick(this.btnYesClick.bind(this));
    this._btnYes.onKeyboardPress(this.btnYesClick.bind(this), Options.keyOk);

    this._btnNo.setText(String(this.tr("STR_NO")));
    this._btnNo.onMouseClick(this.btnNoClick.bind(this));
    this._btnNo.onKeyboardPress(this.btnNoClick.bind(this), Options.keyCancel);

    const destination = getCraftDestination(this._craft) as TargetLike | null;
    this._txtMessage.setBig();
    this._txtMessage.setAlign(ALIGN_CENTER);
    this._txtMessage.setWordWrap(true);
    this._txtMessage.setText(String(this.tr("STR_CRAFT_READY_TO_LAND_NEAR_DESTINATION")
      .arg(this._craft.getName(this.game().getLanguage()))
      .arg(destination?.getName?.(this.game().getLanguage()) || "")));

    this._txtBegin.setBig();
    this._txtBegin.setAlign(ALIGN_CENTER);
    this._txtBegin.setText(`${COLOR_FLIP}${String(this.tr("STR_BEGIN_MISSION"))}`);
  }

  /**
   * Make sure we aren't returning to base.
   */
  override init(): void {
    super.init();
    const b = getCraftDestination(this._craft);
    if (b instanceof Base && b === this._craft.getBase()) {
      this.game().popState();
    }
  }

  /**
   * Enters the mission.
   */
  btnYesClick(_action?: Action): void {
    this.game().popState();
    const target = getCraftDestination(this._craft) as TargetLike | Base | Ufo | null;
    const u = target instanceof Ufo ? target : null;
    const m = target instanceof MissionSite ? target : null;
    const b = target instanceof AlienBase ? target : null;
    const deployment = !(target instanceof Base) && !(target instanceof Ufo) ? target?.getDeployment?.() || null : null;

    const bgame = new SavedBattleGame();
    const save = this.game().getSavedGame() as (SavedGameWithBattle | null);
    setSavedBattleGame(save, bgame);

    const mod = this.game().getMod();
    const bgen = new BattlescapeGenerator(bgame, mod);
    bgen.setCraft(this._craft);
    if (save?.getDifficulty) {
      bgen.setDifficulty(save.getDifficulty());
    }

    if (u) {
      bgame.setMissionType(u.getStatus() === UfoStatus.CRASHED ? "STR_UFO_CRASH_RECOVERY" : "STR_UFO_GROUND_ASSAULT");
      bgen.setUfo(u);
      bgen.setAlienRace(u.getAlienRace());
    } else if (m) {
      bgame.setMissionType(m.getDeployment().getType());
      bgen.setAlienRace(m.getAlienRace());
    } else if (b) {
      bgame.setMissionType(b.getDeployment().getType());
      bgen.setAlienRace(b.getAlienRace());
    } else if (deployment && target) {
      bgame.setMissionType(deployment.getType());
      bgen.setAlienRace((target as TargetLike).getAlienRace?.() || "");
    } else {
      throw new Error("No mission available!");
    }

    // The browser generator does not yet expose C++ run(), setWorldTexture(),
    // setMissionSite(), setAlienBase(), or BriefingState; keep this as an explicit boundary.
    void this._texture;
    void this._shade;
    console.log("BriefingState boundary: ConfirmLandingState prepared the mission battle game.");
  }

  /**
   * Returns the craft to base and closes the window.
   */
  btnNoClick(_action?: Action): void {
    returnCraftToBase(this._craft);
    this.game().popState();
  }
}
