import { Options } from "../Engine/Options.ts";
import { State } from "../Engine/State.ts";
import type { Action } from "../Engine/Action.ts";
import { ALIGN_CENTER, Text } from "../Interface/Text.ts";
import { TextButton } from "../Interface/TextButton.ts";
import { Window } from "../Interface/Window.ts";
import { EscapeType } from "../Mod/AlienDeployment.ts";
import { SpecialTileType, TilePart } from "../Mod/MapData.ts";
import { MapScriptCommand } from "../Mod/MapScript.ts";
import type { SavedBattleGame } from "../Savegame/SavedBattleGame.ts";
import { UnitFaction, UnitStatus } from "../Savegame/BattleUnit.ts";
import type { BattlescapeState } from "./BattlescapeState.ts";

/**
 * Screen which asks for confirmation to abort mission.
 */
export class AbortMissionState extends State {
  private _window: Window;
  private _txtInEntrance: Text;
  private _txtInExit: Text;
  private _txtOutside: Text;
  private _txtAbort: Text;
  private _btnOk: TextButton;
  private _btnCancel: TextButton;
  private _inEntrance = 0;
  private _inExit = 0;
  private _outside = 0;

  constructor(private _battleGame: SavedBattleGame, private _state: BattlescapeState) {
    super();
    this._screen = false;

    this._window = new Window(this, 320, 144, 0, 0);
    this._txtInEntrance = new Text(304, 17, 16, 20);
    this._txtInExit = new Text(304, 17, 16, 40);
    this._txtOutside = new Text(304, 17, 16, 60);
    this._txtAbort = new Text(320, 17, 0, 80);
    this._btnOk = new TextButton(120, 16, 16, 110);
    this._btnCancel = new TextButton(120, 16, 184, 110);

    this._battleGame.setPaletteByDepth(this);

    this.add(this._window, "messageWindowBorder", "battlescape");
    this.add(this._txtInEntrance, "messageWindows", "battlescape");
    this.add(this._txtInExit, "messageWindows", "battlescape");
    this.add(this._txtOutside, "messageWindows", "battlescape");
    this.add(this._txtAbort, "messageWindows", "battlescape");
    this.add(this._btnOk, "messageWindowButtons", "battlescape");
    this.add(this._btnCancel, "messageWindowButtons", "battlescape");

    let exit = false;
    let craft = true;
    const deployment = this.game().getMod()?.getDeployment(this._battleGame.getMissionType()) || null;
    if (deployment) {
      exit = deployment.getNextStage() !== "" ||
        deployment.getEscapeType() === EscapeType.ESCAPE_EXIT ||
        deployment.getEscapeType() === EscapeType.ESCAPE_EITHER;
      const scripts = this.game().getMod()?.getMapScript(deployment.getScript()) || null;
      if (scripts) {
        craft = false;
        for (const script of scripts) {
          if (script.getType() === MapScriptCommand.MSC_ADDCRAFT) {
            craft = true;
            break;
          }
        }
      }
    }
    if (exit) {
      exit = false;
      for (const tile of this._battleGame.getTiles()) {
        if (tile?.getMapData(TilePart.O_FLOOR)?.getSpecialType() === SpecialTileType.END_POINT) {
          exit = true;
          break;
        }
      }
    }

    for (const unit of this._battleGame.getUnits()) {
      if (unit.getOriginalFaction() !== UnitFaction.FACTION_PLAYER) {
        continue;
      }
      if (unit.getStatus() === UnitStatus.STATUS_DEAD || unit.getStatus() === UnitStatus.STATUS_IGNORE_ME) {
        continue;
      }
      const floor = this._battleGame.getTile(unit.getPosition())?.getMapData(TilePart.O_FLOOR) || null;
      if (floor?.getSpecialType() === SpecialTileType.START_POINT) {
        this._inEntrance++;
      } else if (floor?.getSpecialType() === SpecialTileType.END_POINT) {
        this._inExit++;
      } else {
        this._outside++;
      }
    }

    this._window.setHighContrast(true);
    const tac = this.game().getMod()?.getSurface("TAC00.SCR");
    if (tac) {
      this._window.setBackground(tac);
    }

    this._txtInEntrance.setBig();
    this._txtInEntrance.setHighContrast(true);
    this._txtInEntrance.setText(String(this.tr(craft ? "STR_UNITS_IN_CRAFT" : "STR_UNITS_IN_ENTRANCE", this._inEntrance)));

    this._txtInExit.setBig();
    this._txtInExit.setHighContrast(true);
    this._txtInExit.setText(String(this.tr("STR_UNITS_IN_EXIT", this._inExit)));

    this._txtOutside.setBig();
    this._txtOutside.setHighContrast(true);
    this._txtOutside.setText(String(this.tr("STR_UNITS_OUTSIDE", this._outside)));

    if (this._battleGame.getMissionType() === "STR_BASE_DEFENSE") {
      this._txtInEntrance.setVisible(false);
      this._txtInExit.setVisible(false);
      this._txtOutside.setVisible(false);
    } else if (!exit) {
      this._txtInEntrance.setY(26);
      this._txtOutside.setY(54);
      this._txtInExit.setVisible(false);
    }

    this._txtAbort.setBig();
    this._txtAbort.setAlign(ALIGN_CENTER);
    this._txtAbort.setHighContrast(true);
    this._txtAbort.setText(String(this.tr("STR_ABORT_MISSION_QUESTION")));

    this._btnOk.setText(String(this.tr("STR_OK")));
    this._btnOk.setHighContrast(true);
    this._btnOk.onMouseClick(this.btnOkClick.bind(this));
    this._btnOk.onKeyboardPress(this.btnOkClick.bind(this), Options.keyOk);

    this._btnCancel.setText(String(this.tr("STR_CANCEL_UC")));
    this._btnCancel.setHighContrast(true);
    this._btnCancel.onMouseClick(this.btnCancelClick.bind(this));
    this._btnCancel.onKeyboardPress(this.btnCancelClick.bind(this), Options.keyCancel);
    this._btnCancel.onKeyboardPress(this.btnCancelClick.bind(this), Options.keyBattleAbort);

    this.centerAllSurfaces();
  }

  btnOkClick(_action?: Action): void {
    this.game().popState();
    this._battleGame.setAborted(true);
    this._state.finishBattle(true, this._inExit);
  }

  btnCancelClick(_action?: Action): void {
    this.game().popState();
  }
}
