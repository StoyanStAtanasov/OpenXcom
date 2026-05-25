import { Options } from "../Engine/Options.ts";
import { State } from "../Engine/State.ts";
import type { Action } from "../Engine/Action.ts";
import { ALIGN_CENTER, Text } from "../Interface/Text.ts";
import { TextButton } from "../Interface/TextButton.ts";
import { Window } from "../Interface/Window.ts";
import type { Base } from "../Savegame/Base.ts";
import type { Craft } from "../Savegame/Craft.ts";
import { Ufo } from "../Savegame/Ufo.ts";
import { BattlescapeState } from "./BattlescapeState.ts";
import { NextTurnState } from "./NextTurnState.ts";
import { AliensCrashState } from "./AliensCrashState.ts";
import { InventoryState } from "./InventoryState.ts";
import { CutsceneState } from "../Menu/CutsceneState.ts";

/**
 * Briefing screen which displays info about a tactical mission.
 */
export class BriefingState extends State {
  private _btnOk: TextButton;
  private _window: Window;
  private _txtTitle: Text;
  private _txtTarget: Text;
  private _txtCraft: Text;
  private _txtBriefing: Text;
  private _cutsceneId = "";
  private _musicId = "";

  constructor(private _craft: Craft | null = null, private _base: Base | null = null) {
    super();
    Options.baseXResolution = Options.baseXGeoscape;
    Options.baseYResolution = Options.baseYGeoscape;
    this.game().getScreen().resetDisplay();

    this._screen = true;
    this._window = new Window(this, 320, 200, 0, 0);
    this._btnOk = new TextButton(120, 18, 100, 164);
    this._txtTitle = new Text(300, 32, 16, 24);
    this._txtTarget = new Text(300, 17, 16, 40);
    this._txtCraft = new Text(300, 17, 16, 56);
    this._txtBriefing = new Text(274, 94, 16, 72);

    const save = this.game().getSavedGame();
    const mod = this.game().getMod();
    const battle = save?.getSavedBattle();
    const mission = battle?.getMissionType() || "";
    let deployment = mod?.getDeployment(mission) || null;
    const destination = this._craft?.getDestination();
    const ufo = destination instanceof Ufo ? destination : null;
    if (!deployment && ufo) {
      deployment = mod?.getDeployment(ufo.getRules().getType()) || null;
    }

    let title = mission;
    let desc = `${title}_BRIEFING`;
    if (!deployment) {
      this.setPaletteByName("PAL_GEOSCAPE");
      this._musicId = "GMDEFEND";
      const back16 = mod?.getSurface("BACK16.SCR");
      if (back16) {
        this._window.setBackground(back16);
      }
    } else {
      const data = deployment.getBriefingData();
      this.setPaletteByName("PAL_GEOSCAPE");
      const background = mod?.getSurface(data.background);
      if (background) {
        this._window.setBackground(background);
      }
      this._txtCraft.setY(56 + data.textOffset);
      this._txtBriefing.setY(72 + data.textOffset);
      this._txtTarget.setVisible(data.showTarget);
      this._txtCraft.setVisible(data.showCraft);
      this._cutsceneId = data.cutscene;
      this._musicId = data.music;
      if (data.title.length > 0) {
        title = data.title;
      }
      if (data.desc.length > 0) {
        desc = data.desc;
      }
    }

    this.add(this._window, "window", "briefing");
    this.add(this._btnOk, "button", "briefing");
    this.add(this._txtTitle, "text", "briefing");
    this.add(this._txtTarget, "text", "briefing");
    this.add(this._txtCraft, "text", "briefing");
    this.add(this._txtBriefing, "text", "briefing");

    this.centerAllSurfaces();

    this._btnOk.setText(String(this.tr("STR_OK")));
    this._btnOk.onMouseClick(this.btnOkClick.bind(this));
    this._btnOk.onKeyboardPress(this.btnOkClick.bind(this), Options.keyOk);
    this._btnOk.onKeyboardPress(this.btnOkClick.bind(this), Options.keyCancel);

    this._txtTitle.setBig();
    this._txtTarget.setBig();
    this._txtCraft.setBig();

    let craftText = "";
    if (this._craft) {
      if (destination) {
        this._txtTarget.setText(destination.getName(this.game().getLanguage()));
      }
      craftText = String(this.tr("STR_CRAFT_").arg(this._craft.getName(this.game().getLanguage())));
    } else if (this._base) {
      craftText = String(this.tr("STR_BASE_UC_").arg(this._base.getName()));
    }
    this._txtCraft.setText(craftText);
    this._txtTitle.setText(String(this.tr(title)));
    this._txtBriefing.setWordWrap(true);
    this._txtBriefing.setText(String(this.tr(desc)));

    if (mission === "STR_BASE_DEFENSE") {
      this._base?.setRetaliationTarget(false);
    }
  }

  override init(): void {
    super.init();
    if (this._cutsceneId.length > 0) {
      this.game().pushState(new CutsceneState(this._cutsceneId));
      this._cutsceneId = "";
    } else {
      this.game().getMod()?.playMusic(this._musicId);
    }
  }

  btnOkClick(_action?: Action): void {
    this.game().popState();
    Options.baseXResolution = Options.baseXBattlescape;
    Options.baseYResolution = Options.baseYBattlescape;
    this.game().getScreen().resetDisplay();

    const battle = this.game().getSavedGame()?.getSavedBattle();
    const bs = new BattlescapeState(battle || undefined);
    const liveAliens = { value: 0 };
    const liveSoldiers = { value: 0 };
    bs.getBattleGame().tallyUnits(liveAliens, liveSoldiers);
    if (liveAliens.value > 0) {
      this.game().pushState(bs);
      battle?.setBattleState(bs);
      this.game().pushState(new NextTurnState(battle || bs.getBattleGame().getSave(), bs));
      this.game().pushState(new InventoryState(false, bs));
    } else {
      Options.baseXResolution = Options.baseXGeoscape;
      Options.baseYResolution = Options.baseYGeoscape;
      this.game().getScreen().resetDisplay();
      this.game().pushState(new AliensCrashState());
    }
  }
}
