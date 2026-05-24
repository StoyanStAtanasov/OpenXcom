import type { Action } from "../Engine/Action.ts";
import { Options } from "../Engine/Options.ts";
import { State } from "../Engine/State.ts";
import { ALIGN_CENTER, ALIGN_RIGHT, Text } from "../Interface/Text.ts";
import { TextButton } from "../Interface/TextButton.ts";
import { TextList } from "../Interface/TextList.ts";
import { Window } from "../Interface/Window.ts";
import type { Base } from "../Savegame/Base.ts";
import type { Soldier } from "../Savegame/Soldier.ts";
import { SDL_BUTTON_LEFT } from "../types.ts";

export class AllocatePsiTrainingState extends State {
  private _btnOk: TextButton;
  private _window: Window;
  private _txtTitle: Text;
  private _txtTraining: Text;
  private _txtName: Text;
  private _txtRemaining: Text;
  private _txtPsiStrength: Text;
  private _txtPsiSkill: Text;
  private _lstSoldiers: TextList;
  private _soldiers: Soldier[] = [];
  private _sel = 0;
  private _labSpace = 0;

  constructor(private _base: Base) {
    super();

    this._window = new Window(this, 320, 200, 0, 0);
    this._txtTitle = new Text(300, 17, 10, 8);
    this._txtRemaining = new Text(300, 10, 10, 24);
    this._txtName = new Text(64, 10, 10, 40);
    this._txtPsiStrength = new Text(80, 20, 124, 32);
    this._txtPsiSkill = new Text(80, 20, 188, 32);
    this._txtTraining = new Text(48, 20, 270, 32);
    this._btnOk = new TextButton(160, 14, 80, 174);
    this._lstSoldiers = new TextList(290, 112, 8, 52);

    this.setInterface("allocatePsi");

    this.add(this._window, "window", "allocatePsi");
    this.add(this._btnOk, "button", "allocatePsi");
    this.add(this._txtName, "text", "allocatePsi");
    this.add(this._txtTitle, "text", "allocatePsi");
    this.add(this._txtRemaining, "text", "allocatePsi");
    this.add(this._txtPsiStrength, "text", "allocatePsi");
    this.add(this._txtPsiSkill, "text", "allocatePsi");
    this.add(this._txtTraining, "text", "allocatePsi");
    this.add(this._lstSoldiers, "list", "allocatePsi");

    this.centerAllSurfaces();

    const back01 = this.game().getMod()?.getSurface("BACK01.SCR");
    if (back01) {
      this._window.setBackground(back01);
    }

    this._btnOk.setText(String(this.tr("STR_OK")));
    this._btnOk.onMouseClick(this.btnOkClick.bind(this));
    this._btnOk.onKeyboardPress(this.btnOkClick.bind(this), Options.keyCancel);

    this._txtTitle.setBig();
    this._txtTitle.setAlign(ALIGN_CENTER);
    this._txtTitle.setText(String(this.tr("STR_PSIONIC_TRAINING")));

    this._labSpace = this._base.getAvailablePsiLabs() - this._base.getUsedPsiLabs();
    this._txtRemaining.setText(String(this.tr("STR_REMAINING_PSI_LAB_CAPACITY").arg(this._labSpace)));

    this._txtName.setText(String(this.tr("STR_NAME")));
    this._txtPsiStrength.setText(String(this.tr("STR_PSIONIC__STRENGTH")));
    this._txtPsiSkill.setText(String(this.tr("STR_PSIONIC_SKILL_IMPROVEMENT")));
    this._txtTraining.setText(String(this.tr("STR_IN_TRAINING")));

    this._lstSoldiers.setAlign(ALIGN_RIGHT, 3);
    this._lstSoldiers.setColumns(4, 114, 80, 62, 30);
    this._lstSoldiers.setSelectable(true);
    this._lstSoldiers.setBackground(this._window);
    this._lstSoldiers.setMargin(2);
    this._lstSoldiers.onMouseClick(this.lstSoldiersClick.bind(this));

    const save = this.game().getSavedGame();
    const mod = this.game().getMod();
    const psiStrengthKnown = Options.psiStrengthEval && Boolean(save?.isResearched(mod?.getPsiRequirements() || []));
    let row = 0;
    for (const soldier of this._base.getSoldiers()) {
      const currentStats = soldier.getCurrentStats();
      let ssStr = "";
      let ssSkl = "";
      this._soldiers.push(soldier);
      if (currentStats.psiSkill > 0 || psiStrengthKnown) {
        ssStr = `   ${currentStats.psiStrength}`;
        if (Options.allowPsiStrengthImprovement) {
          ssStr += `/+${soldier.getPsiStrImprovement()}`;
        }
      } else {
        ssStr = String(this.tr("STR_UNKNOWN"));
      }
      if (currentStats.psiSkill > 0) {
        ssSkl = `${currentStats.psiSkill}/+${soldier.getImprovement()}`;
      } else {
        ssSkl = "0/+0";
      }
      if (soldier.isInPsiTraining()) {
        this._lstSoldiers.addRow(4, soldier.getName(true), ssStr, ssSkl, String(this.tr("STR_YES")));
        this._lstSoldiers.setRowColor(row, this._lstSoldiers.getSecondaryColor());
      } else {
        this._lstSoldiers.addRow(4, soldier.getName(true), ssStr, ssSkl, String(this.tr("STR_NO")));
        this._lstSoldiers.setRowColor(row, this._lstSoldiers.getColor());
      }
      ++row;
    }
  }

  btnOkClick(_action?: Action): void {
    const save = this.game().getSavedGame();
    const mod = this.game().getMod();
    const psiStrengthEval = Options.psiStrengthEval && Boolean(save?.isResearched(mod?.getPsiRequirements() || []));
    const statStrings = mod?.getStatStrings() || [];
    for (const soldier of this._base.getSoldiers()) {
      soldier.calcStatString(statStrings, psiStrengthEval);
    }
    this.game().popState();
  }

  lstSoldiersClick(action?: Action): void {
    this._sel = this._lstSoldiers.getSelectedRow();
    if (this._sel === -1 || action?.getDetails().button?.button !== SDL_BUTTON_LEFT) {
      return;
    }

    const soldier = this._base.getSoldiers()[this._sel];
    if (!soldier) {
      return;
    }

    if (!soldier.isInPsiTraining()) {
      if (this._base.getUsedPsiLabs() < this._base.getAvailablePsiLabs()) {
        this._lstSoldiers.setCellText(this._sel, 3, String(this.tr("STR_YES")));
        this._lstSoldiers.setRowColor(this._sel, this._lstSoldiers.getSecondaryColor());
        --this._labSpace;
        this._txtRemaining.setText(String(this.tr("STR_REMAINING_PSI_LAB_CAPACITY").arg(this._labSpace)));
        soldier.setPsiTraining(true);
      }
    } else {
      this._lstSoldiers.setCellText(this._sel, 3, String(this.tr("STR_NO")));
      this._lstSoldiers.setRowColor(this._sel, this._lstSoldiers.getColor());
      ++this._labSpace;
      this._txtRemaining.setText(String(this.tr("STR_REMAINING_PSI_LAB_CAPACITY").arg(this._labSpace)));
      soldier.setPsiTraining(false);
    }
  }
}
