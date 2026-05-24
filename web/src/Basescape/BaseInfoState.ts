import { Options } from "../Engine/Options.ts";
import { State } from "../Engine/State.ts";
import { Surface } from "../Engine/Surface.ts";
import type { Action } from "../Engine/Action.ts";
import { Bar } from "../Interface/Bar.ts";
import { Text } from "../Interface/Text.ts";
import { TextButton } from "../Interface/TextButton.ts";
import { TextEdit } from "../Interface/TextEdit.ts";
import type { Base } from "../Savegame/Base.ts";
import { SDL_KEYDOWN } from "../types.ts";
import type { BasescapeState } from "./BasescapeState.ts";
import { MiniBaseView } from "./MiniBaseView.ts";
import { MonthlyCostsState } from "./MonthlyCostsState.ts";
import { StoresState } from "./StoresState.ts";
import { TransfersState } from "./TransfersState.ts";

export class BaseInfoState extends State {
  private _bg: Surface;
  private _mini: MiniBaseView;
  private _btnOk: TextButton;
  private _btnTransfers: TextButton;
  private _btnStores: TextButton;
  private _btnMonthlyCosts: TextButton;
  private _edtBase: TextEdit;

  private _txtPersonnel: Text;
  private _txtSoldiers: Text;
  private _txtEngineers: Text;
  private _txtScientists: Text;
  private _numSoldiers: Text;
  private _numEngineers: Text;
  private _numScientists: Text;
  private _barSoldiers: Bar;
  private _barEngineers: Bar;
  private _barScientists: Bar;

  private _txtSpace: Text;
  private _txtQuarters: Text;
  private _txtStores: Text;
  private _txtLaboratories: Text;
  private _txtWorkshops: Text;
  private _txtContainment: Text | null = null;
  private _txtHangars: Text;
  private _numQuarters: Text;
  private _numStores: Text;
  private _numLaboratories: Text;
  private _numWorkshops: Text;
  private _numContainment: Text | null = null;
  private _numHangars: Text;
  private _barQuarters: Bar;
  private _barStores: Bar;
  private _barLaboratories: Bar;
  private _barWorkshops: Bar;
  private _barContainment: Bar | null = null;
  private _barHangars: Bar;

  private _txtDefense: Text;
  private _txtShortRange: Text;
  private _txtLongRange: Text;
  private _numDefense: Text;
  private _numShortRange: Text;
  private _numLongRange: Text;
  private _barDefense: Bar;
  private _barShortRange: Bar;
  private _barLongRange: Bar;

  constructor(private _base: Base, private _state: BasescapeState) {
    super();

    this._bg = new Surface(320, 200, 0, 0);
    this._mini = new MiniBaseView(128, 16, 182, 8);
    this._btnOk = new TextButton(30, 14, 10, 180);
    this._btnTransfers = new TextButton(80, 14, 46, 180);
    this._btnStores = new TextButton(80, 14, 132, 180);
    this._btnMonthlyCosts = new TextButton(92, 14, 218, 180);
    this._edtBase = new TextEdit(this, 127, 16, 8, 8);

    this._txtPersonnel = new Text(300, 9, 8, 30);
    this._txtSoldiers = new Text(114, 9, 8, 41);
    this._numSoldiers = new Text(40, 9, 126, 41);
    this._barSoldiers = new Bar(150, 5, 166, 43);
    this._txtEngineers = new Text(114, 9, 8, 51);
    this._numEngineers = new Text(40, 9, 126, 51);
    this._barEngineers = new Bar(150, 5, 166, 53);
    this._txtScientists = new Text(114, 9, 8, 61);
    this._numScientists = new Text(40, 9, 126, 61);
    this._barScientists = new Bar(150, 5, 166, 63);

    this._txtSpace = new Text(300, 9, 8, 72);
    this._txtQuarters = new Text(114, 9, 8, 83);
    this._numQuarters = new Text(40, 9, 126, 83);
    this._barQuarters = new Bar(150, 5, 166, 85);
    this._txtStores = new Text(114, 9, 8, 93);
    this._numStores = new Text(40, 9, 126, 93);
    this._barStores = new Bar(150, 5, 166, 95);
    this._txtLaboratories = new Text(114, 9, 8, 103);
    this._numLaboratories = new Text(40, 9, 126, 103);
    this._barLaboratories = new Bar(150, 5, 166, 105);
    this._txtWorkshops = new Text(114, 9, 8, 113);
    this._numWorkshops = new Text(40, 9, 126, 113);
    this._barWorkshops = new Bar(150, 5, 166, 115);
    if (Options.storageLimitsEnforced) {
      this._txtContainment = new Text(114, 9, 8, 123);
      this._numContainment = new Text(40, 9, 126, 123);
      this._barContainment = new Bar(150, 5, 166, 125);
    }
    this._txtHangars = new Text(114, 9, 8, Options.storageLimitsEnforced ? 133 : 123);
    this._numHangars = new Text(40, 9, 126, Options.storageLimitsEnforced ? 133 : 123);
    this._barHangars = new Bar(150, 5, 166, Options.storageLimitsEnforced ? 135 : 125);

    this._txtDefense = new Text(114, 9, 8, Options.storageLimitsEnforced ? 147 : 138);
    this._numDefense = new Text(40, 9, 126, Options.storageLimitsEnforced ? 147 : 138);
    this._barDefense = new Bar(150, 5, 166, Options.storageLimitsEnforced ? 149 : 140);
    this._txtShortRange = new Text(114, 9, 8, Options.storageLimitsEnforced ? 157 : 153);
    this._numShortRange = new Text(40, 9, 126, Options.storageLimitsEnforced ? 157 : 153);
    this._barShortRange = new Bar(150, 5, 166, Options.storageLimitsEnforced ? 159 : 155);
    this._txtLongRange = new Text(114, 9, 8, Options.storageLimitsEnforced ? 167 : 163);
    this._numLongRange = new Text(40, 9, 126, Options.storageLimitsEnforced ? 167 : 163);
    this._barLongRange = new Bar(150, 5, 166, Options.storageLimitsEnforced ? 169 : 165);

    this.setInterface("baseInfo");

    this.add(this._bg);
    this.add(this._mini, "miniBase", "basescape");
    this.add(this._btnOk, "button", "baseInfo");
    this.add(this._btnTransfers, "button", "baseInfo");
    this.add(this._btnStores, "button", "baseInfo");
    this.add(this._btnMonthlyCosts, "button", "baseInfo");
    this.add(this._edtBase, "text1", "baseInfo");

    this.add(this._txtPersonnel, "text1", "baseInfo");
    this.add(this._txtSoldiers, "text2", "baseInfo");
    this.add(this._numSoldiers, "numbers", "baseInfo");
    this.add(this._barSoldiers, "personnelBars", "baseInfo");
    this.add(this._txtEngineers, "text2", "baseInfo");
    this.add(this._numEngineers, "numbers", "baseInfo");
    this.add(this._barEngineers, "personnelBars", "baseInfo");
    this.add(this._txtScientists, "text2", "baseInfo");
    this.add(this._numScientists, "numbers", "baseInfo");
    this.add(this._barScientists, "personnelBars", "baseInfo");

    this.add(this._txtSpace, "text1", "baseInfo");
    this.add(this._txtQuarters, "text2", "baseInfo");
    this.add(this._numQuarters, "numbers", "baseInfo");
    this.add(this._barQuarters, "facilityBars", "baseInfo");
    this.add(this._txtStores, "text2", "baseInfo");
    this.add(this._numStores, "numbers", "baseInfo");
    this.add(this._barStores, "facilityBars", "baseInfo");
    this.add(this._txtLaboratories, "text2", "baseInfo");
    this.add(this._numLaboratories, "numbers", "baseInfo");
    this.add(this._barLaboratories, "facilityBars", "baseInfo");
    this.add(this._txtWorkshops, "text2", "baseInfo");
    this.add(this._numWorkshops, "numbers", "baseInfo");
    this.add(this._barWorkshops, "facilityBars", "baseInfo");
    if (this._txtContainment && this._numContainment && this._barContainment) {
      this.add(this._txtContainment, "text2", "baseInfo");
      this.add(this._numContainment, "numbers", "baseInfo");
      this.add(this._barContainment, "facilityBars", "baseInfo");
    }
    this.add(this._txtHangars, "text2", "baseInfo");
    this.add(this._numHangars, "numbers", "baseInfo");
    this.add(this._barHangars, "facilityBars", "baseInfo");

    this.add(this._txtDefense, "text2", "baseInfo");
    this.add(this._numDefense, "numbers", "baseInfo");
    this.add(this._barDefense, "defenceBar", "baseInfo");
    this.add(this._txtShortRange, "text2", "baseInfo");
    this.add(this._numShortRange, "numbers", "baseInfo");
    this.add(this._barShortRange, "detectionBars", "baseInfo");
    this.add(this._txtLongRange, "text2", "baseInfo");
    this.add(this._numLongRange, "numbers", "baseInfo");
    this.add(this._barLongRange, "detectionBars", "baseInfo");

    this.centerAllSurfaces();

    const background = this.game().getMod()?.getSurface(`${Options.storageLimitsEnforced ? "ALT" : ""}BACK07.SCR`);
    if (background) {
      background.blit(this._bg);
    }

    this._mini.setTexture(this.game().getMod()?.getSurfaceSet("BASEBITS.PCK") || null);
    this._mini.setBases(this.game().getSavedGame()?.getBases() || []);
    this._mini.setSelectedBase(this._base);
    this._mini.onMouseClick(this.miniClick.bind(this));
    this._mini.onKeyboardPress(this.handleKeyPress.bind(this));

    this._btnOk.setText(String(this.tr("STR_OK")));
    this._btnOk.onMouseClick(this.btnOkClick.bind(this));
    this._btnOk.onKeyboardPress(this.btnOkClick.bind(this), Options.keyCancel);

    this._btnTransfers.setText(String(this.tr("STR_TRANSFERS_UC")));
    this._btnTransfers.onMouseClick(this.btnTransfersClick.bind(this));

    this._btnStores.setText(String(this.tr("STR_STORES_UC")));
    this._btnStores.onMouseClick(this.btnStoresClick.bind(this));

    this._btnMonthlyCosts.setText(String(this.tr("STR_MONTHLY_COSTS")));
    this._btnMonthlyCosts.onMouseClick(this.btnMonthlyCostsClick.bind(this));

    this._edtBase.setBig();
    this._edtBase.onChange(this.edtBaseChange.bind(this));

    this._txtPersonnel.setText(String(this.tr("STR_PERSONNEL_AVAILABLE_PERSONNEL_TOTAL")));
    this._txtSoldiers.setText(String(this.tr("STR_SOLDIERS")));
    this._barSoldiers.setScale(1.0);
    this._txtEngineers.setText(String(this.tr("STR_ENGINEERS")));
    this._barEngineers.setScale(1.0);
    this._txtScientists.setText(String(this.tr("STR_SCIENTISTS")));
    this._barScientists.setScale(1.0);

    this._txtSpace.setText(String(this.tr("STR_SPACE_USED_SPACE_AVAILABLE")));
    this._txtQuarters.setText(String(this.tr("STR_LIVING_QUARTERS_PLURAL")));
    this._barQuarters.setScale(0.5);
    this._txtStores.setText(String(this.tr("STR_STORES")));
    this._barStores.setScale(0.5);
    this._txtLaboratories.setText(String(this.tr("STR_LABORATORIES")));
    this._barLaboratories.setScale(0.5);
    this._txtWorkshops.setText(String(this.tr("STR_WORK_SHOPS")));
    this._barWorkshops.setScale(0.5);
    if (this._txtContainment && this._barContainment) {
      this._txtContainment.setText(String(this.tr("STR_ALIEN_CONTAINMENT")));
      this._barContainment.setScale(0.5);
    }
    this._txtHangars.setText(String(this.tr("STR_HANGARS")));
    this._barHangars.setScale(18.0);

    this._txtDefense.setText(String(this.tr("STR_DEFENSE_STRENGTH")));
    this._barDefense.setScale(0.125);
    this._txtShortRange.setText(String(this.tr("STR_SHORT_RANGE_DETECTION")));
    this._barShortRange.setScale(25.0);
    this._txtLongRange.setText(String(this.tr("STR_LONG_RANGE_DETECTION")));
    this._barLongRange.setScale(25.0);
  }

  override init(): void {
    super.init();
    this._edtBase.setText(this._base.getName());

    this._numSoldiers.setText(`${this._base.getAvailableSoldiers()}:${this._base.getTotalSoldiers()}`);
    this._barSoldiers.setMax(this._base.getTotalSoldiers());
    this._barSoldiers.setValue(this._base.getAvailableSoldiers());

    this._numEngineers.setText(`${this._base.getAvailableEngineers()}:${this._base.getTotalEngineers()}`);
    this._barEngineers.setMax(this._base.getTotalEngineers());
    this._barEngineers.setValue(this._base.getAvailableEngineers());

    this._numScientists.setText(`${this._base.getAvailableScientists()}:${this._base.getTotalScientists()}`);
    this._barScientists.setMax(this._base.getTotalScientists());
    this._barScientists.setValue(this._base.getAvailableScientists());

    this._numQuarters.setText(`${this._base.getUsedQuarters()}:${this._base.getAvailableQuarters()}`);
    this._barQuarters.setMax(this._base.getAvailableQuarters());
    this._barQuarters.setValue(this._base.getUsedQuarters());

    const usedStores = Math.floor(this._base.getUsedStores() + 0.05);
    this._numStores.setText(`${usedStores}:${this._base.getAvailableStores()}`);
    this._barStores.setMax(this._base.getAvailableStores());
    this._barStores.setValue(usedStores);

    this._numLaboratories.setText(`${this._base.getUsedLaboratories()}:${this._base.getAvailableLaboratories()}`);
    this._barLaboratories.setMax(this._base.getAvailableLaboratories());
    this._barLaboratories.setValue(this._base.getUsedLaboratories());

    this._numWorkshops.setText(`${this._base.getUsedWorkshops()}:${this._base.getAvailableWorkshops()}`);
    this._barWorkshops.setMax(this._base.getAvailableWorkshops());
    this._barWorkshops.setValue(this._base.getUsedWorkshops());

    if (this._numContainment && this._barContainment) {
      this._numContainment.setText(`${this._base.getUsedContainment()}:${this._base.getAvailableContainment()}`);
      this._barContainment.setMax(this._base.getAvailableContainment());
      this._barContainment.setValue(this._base.getUsedContainment());
    }

    this._numHangars.setText(`${this._base.getUsedHangars()}:${this._base.getAvailableHangars()}`);
    this._barHangars.setMax(this._base.getAvailableHangars());
    this._barHangars.setValue(this._base.getUsedHangars());

    this._numDefense.setText(`${this._base.getDefenseValue()}`);
    this._barDefense.setMax(this._base.getDefenseValue());
    this._barDefense.setValue(this._base.getDefenseValue());

    const shortRangeDetection = this._base.getShortRangeDetection();
    this._numShortRange.setText(`${shortRangeDetection}`);
    this._barShortRange.setMax(shortRangeDetection);
    this._barShortRange.setValue(shortRangeDetection);

    const longRangeDetection = this._base.getLongRangeDetection();
    this._numLongRange.setText(`${longRangeDetection}`);
    this._barLongRange.setMax(longRangeDetection);
    this._barLongRange.setValue(longRangeDetection);
  }

  edtBaseChange(_action?: Action): void {
    this._base.setName(this._edtBase.getText());
  }

  miniClick(action: Action): void {
    const base = this._mini.getBaseAt(action.getAbsoluteXMouse());
    if (base) {
      this._mini.setSelectedBase(base);
      this._base = base;
      this._state.setBase(this._base);
      this.init();
    }
  }

  handleKeyPress(action: Action): void {
    if (action.getDetails().type !== SDL_KEYDOWN) {
      return;
    }
    const baseKeys = [
      Options.keyBaseSelect1,
      Options.keyBaseSelect2,
      Options.keyBaseSelect3,
      Options.keyBaseSelect4,
      Options.keyBaseSelect5,
      Options.keyBaseSelect6,
      Options.keyBaseSelect7,
      Options.keyBaseSelect8
    ];
    const key = action.getDetails().key?.keysym.sym;
    const bases = this.game().getSavedGame()?.getBases() || [];
    for (let i = 0; i < bases.length && i < baseKeys.length; ++i) {
      if (key === baseKeys[i]) {
        this._mini.setSelectedBase(bases[i]);
        this._base = bases[i];
        this._state.setBase(this._base);
        this.init();
        break;
      }
    }
  }

  btnOkClick(_action?: Action): void {
    this.game().popState();
  }

  btnTransfersClick(_action?: Action): void {
    this.game().pushState(new TransfersState(this._base));
  }

  btnStoresClick(_action?: Action): void {
    this.game().pushState(new StoresState(this._base));
  }

  btnMonthlyCostsClick(_action?: Action): void {
    this.game().pushState(new MonthlyCostsState(this._base));
  }
}
