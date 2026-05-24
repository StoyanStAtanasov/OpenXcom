import { Options } from "../Engine/Options.ts";
import { State } from "../Engine/State.ts";
import type { Action } from "../Engine/Action.ts";
import { GameDifficulty } from "../Savegame/SavedGame.ts";
import { Text, ALIGN_CENTER, ALIGN_MIDDLE } from "../Interface/Text.ts";
import { TextButton } from "../Interface/TextButton.ts";
import { ToggleTextButton } from "../Interface/ToggleTextButton.ts";
import { Window, POPUP_VERTICAL } from "../Interface/Window.ts";
import { BuildNewBaseState } from "../Geoscape/BuildNewBaseState.ts";
import { GeoscapeState } from "../Geoscape/GeoscapeState.ts";

export class NewGameState extends State {
  private _btnBeginner: TextButton;
  private _btnExperienced: TextButton;
  private _btnVeteran: TextButton;
  private _btnGenius: TextButton;
  private _btnSuperhuman: TextButton;
  private _difficulty: { value: TextButton | null };
  private _btnIronman: ToggleTextButton;
  private _btnOk: TextButton;
  private _btnCancel: TextButton;
  private _window: Window;
  private _txtTitle: Text;
  private _txtIronman: Text;

  constructor() {
    super();
    this._window = new Window(this, 192, 180, 64, 10, POPUP_VERTICAL);
    this._btnBeginner = new TextButton(160, 18, 80, 32);
    this._btnExperienced = new TextButton(160, 18, 80, 52);
    this._btnVeteran = new TextButton(160, 18, 80, 72);
    this._btnGenius = new TextButton(160, 18, 80, 92);
    this._btnSuperhuman = new TextButton(160, 18, 80, 112);
    this._btnIronman = new ToggleTextButton(78, 18, 80, 138);
    this._btnOk = new TextButton(78, 16, 80, 164);
    this._btnCancel = new TextButton(78, 16, 162, 164);
    this._txtTitle = new Text(192, 9, 64, 20);
    this._txtIronman = new Text(90, 24, 162, 135);
    this._difficulty = { value: this._btnBeginner };

    this.setInterface("newGameMenu");

    this.add(this._window, "window", "newGameMenu");
    this.add(this._btnBeginner, "button", "newGameMenu");
    this.add(this._btnExperienced, "button", "newGameMenu");
    this.add(this._btnVeteran, "button", "newGameMenu");
    this.add(this._btnGenius, "button", "newGameMenu");
    this.add(this._btnSuperhuman, "button", "newGameMenu");
    this.add(this._btnIronman, "ironman", "newGameMenu");
    this.add(this._btnOk, "button", "newGameMenu");
    this.add(this._btnCancel, "button", "newGameMenu");
    this.add(this._txtTitle, "text", "newGameMenu");
    this.add(this._txtIronman, "ironman", "newGameMenu");

    this.centerAllSurfaces();

    const back01 = this.game().getMod()?.getSurface("BACK01.SCR");
    if (back01) {
      this._window.setBackground(back01);
    }

    this._btnBeginner.setText(String(this.tr("STR_1_BEGINNER")));
    this._btnBeginner.setGroup(this._difficulty);
    this._btnExperienced.setText(String(this.tr("STR_2_EXPERIENCED")));
    this._btnExperienced.setGroup(this._difficulty);
    this._btnVeteran.setText(String(this.tr("STR_3_VETERAN")));
    this._btnVeteran.setGroup(this._difficulty);
    this._btnGenius.setText(String(this.tr("STR_4_GENIUS")));
    this._btnGenius.setGroup(this._difficulty);
    this._btnSuperhuman.setText(String(this.tr("STR_5_SUPERHUMAN")));
    this._btnSuperhuman.setGroup(this._difficulty);

    this._btnIronman.setText(String(this.tr("STR_IRONMAN")));

    this._btnOk.setText(String(this.tr("STR_OK")));
    this._btnOk.onMouseClick(this.btnOkClick.bind(this));
    this._btnOk.onKeyboardPress(this.btnOkClick.bind(this), Options.keyOk);

    this._btnCancel.setText(String(this.tr("STR_CANCEL")));
    this._btnCancel.onMouseClick(this.btnCancelClick.bind(this));
    this._btnCancel.onKeyboardPress(this.btnCancelClick.bind(this), Options.keyCancel);

    this._txtTitle.setAlign(ALIGN_CENTER);
    this._txtTitle.setText(String(this.tr("STR_SELECT_DIFFICULTY_LEVEL")));

    this._txtIronman.setWordWrap(true);
    this._txtIronman.setVerticalAlign(ALIGN_MIDDLE);
    this._txtIronman.setText(String(this.tr("STR_IRONMAN_DESC")));
  }

  btnOkClick(_action: Action): void {
    let diff = GameDifficulty.DIFF_BEGINNER;
    if (this._difficulty.value === this._btnExperienced) {
      diff = GameDifficulty.DIFF_EXPERIENCED;
    } else if (this._difficulty.value === this._btnVeteran) {
      diff = GameDifficulty.DIFF_VETERAN;
    } else if (this._difficulty.value === this._btnGenius) {
      diff = GameDifficulty.DIFF_GENIUS;
    } else if (this._difficulty.value === this._btnSuperhuman) {
      diff = GameDifficulty.DIFF_SUPERHUMAN;
    }
    const save = this.game().getMod()?.newSave();
    if (save) {
      save.setDifficulty(diff);
      save.setIronman(this._btnIronman.getPressed());
      this.game().setSavedGame(save);
      const gs = new GeoscapeState();
      this.game().setState(gs);
      gs.init();
      this.game().pushState(new BuildNewBaseState(save.getBases()[save.getBases().length - 1], gs.getGlobe(), true));
    }
  }

  btnCancelClick(_action: Action): void {
    this.game().setSavedGame(null);
    this.game().popState();
  }
}
