import { Options } from "../Engine/Options.ts";
import { State } from "../Engine/State.ts";
import type { Action } from "../Engine/Action.ts";
import { Text, ALIGN_CENTER } from "../Interface/Text.ts";
import { TextButton } from "../Interface/TextButton.ts";
import { TextList } from "../Interface/TextList.ts";
import { Window } from "../Interface/Window.ts";
import type { Base } from "../Savegame/Base.ts";
import { AllocatePsiTrainingState } from "../Geoscape/AllocatePsiTrainingState.ts";
import { SoldierInfoState } from "./SoldierInfoState.ts";
import { SoldierMemorialState } from "./SoldierMemorialState.ts";

export class SoldiersState extends State {
  private _btnOk: TextButton;
  private _btnPsiTraining: TextButton;
  private _btnMemorial: TextButton;
  private _window: Window;
  private _txtTitle: Text;
  private _txtName: Text;
  private _txtRank: Text;
  private _txtCraft: Text;
  private _lstSoldiers: TextList;

  constructor(private _base: Base) {
    super();
    const isPsiBtnVisible = Options.anytimePsiTraining && this._base.getAvailablePsiLabs() > 0;

    this._window = new Window(this, 320, 200, 0, 0);
    if (isPsiBtnVisible) {
      this._btnOk = new TextButton(96, 16, 216, 176);
      this._btnPsiTraining = new TextButton(96, 16, 112, 176);
      this._btnMemorial = new TextButton(96, 16, 8, 176);
    } else {
      this._btnOk = new TextButton(148, 16, 164, 176);
      this._btnPsiTraining = new TextButton(148, 16, 164, 176);
      this._btnMemorial = new TextButton(148, 16, 8, 176);
    }
    this._txtTitle = new Text(310, 17, 5, 8);
    this._txtName = new Text(114, 9, 16, 32);
    this._txtRank = new Text(102, 9, 130, 32);
    this._txtCraft = new Text(82, 9, 222, 32);
    this._lstSoldiers = new TextList(288, 128, 8, 40);

    this.setInterface("soldierList");

    this.add(this._window, "window", "soldierList");
    this.add(this._btnOk, "button", "soldierList");
    this.add(this._btnPsiTraining, "button", "soldierList");
    this.add(this._btnMemorial, "button", "soldierList");
    this.add(this._txtTitle, "text1", "soldierList");
    this.add(this._txtName, "text2", "soldierList");
    this.add(this._txtRank, "text2", "soldierList");
    this.add(this._txtCraft, "text2", "soldierList");
    this.add(this._lstSoldiers, "list", "soldierList");

    this.centerAllSurfaces();

    const back02 = this.game().getMod()?.getSurface("BACK02.SCR");
    if (back02) {
      this._window.setBackground(back02);
    }

    this._btnOk.setText(String(this.tr("STR_OK")));
    this._btnOk.onMouseClick(this.btnOkClick.bind(this));
    this._btnOk.onKeyboardPress(this.btnOkClick.bind(this), Options.keyCancel);

    this._btnPsiTraining.setText(String(this.tr("STR_PSI_TRAINING")));
    this._btnPsiTraining.onMouseClick(this.btnPsiTrainingClick.bind(this));
    this._btnPsiTraining.setVisible(isPsiBtnVisible);

    this._btnMemorial.setText(String(this.tr("STR_MEMORIAL")));
    this._btnMemorial.onMouseClick(this.btnMemorialClick.bind(this));

    this._txtTitle.setBig();
    this._txtTitle.setAlign(ALIGN_CENTER);
    this._txtTitle.setText(String(this.tr("STR_SOLDIER_LIST")));
    this._txtName.setText(String(this.tr("STR_NAME_UC")));
    this._txtRank.setText(String(this.tr("STR_RANK")));
    this._txtCraft.setText(String(this.tr("STR_CRAFT")));

    this._lstSoldiers.setColumns(3, 114, 92, 74);
    this._lstSoldiers.setSelectable(true);
    this._lstSoldiers.setBackground(this._window);
    this._lstSoldiers.setMargin(8);
    this._lstSoldiers.onMouseClick(this.lstSoldiersClick.bind(this));
  }

  override init(): void {
    super.init();
    let row = 0;
    this._lstSoldiers.clearList();
    for (const soldier of this._base.getSoldiers()) {
      this._lstSoldiers.addRow(3, soldier.getName(true), String(this.tr(soldier.getRankString())), soldier.getCraftString(this.game().getLanguage()));
      if (soldier.getCraft() === null) {
        this._lstSoldiers.setRowColor(row, this._lstSoldiers.getSecondaryColor());
      }
      ++row;
    }
    if (row > 0 && this._lstSoldiers.getScroll() >= row) {
      this._lstSoldiers.scrollTo(0);
    }
  }

  btnOkClick(_action?: Action): void {
    this.game().popState();
  }

  btnPsiTrainingClick(_action?: Action): void {
    this.game().pushState(new AllocatePsiTrainingState(this._base));
  }

  btnMemorialClick(_action?: Action): void {
    this.game().pushState(new SoldierMemorialState());
  }

  lstSoldiersClick(_action?: Action): void {
    const row = this._lstSoldiers.getSelectedRow();
    if (row !== -1) {
      this.game().pushState(new SoldierInfoState(this._base, row));
    }
  }
}
