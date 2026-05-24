import { Options } from "../Engine/Options.ts";
import { State } from "../Engine/State.ts";
import { formatFunding } from "../Engine/Unicode.ts";
import type { Action } from "../Engine/Action.ts";
import { Text, ALIGN_CENTER } from "../Interface/Text.ts";
import { TextButton } from "../Interface/TextButton.ts";
import { TextEdit } from "../Interface/TextEdit.ts";
import { ErrorMessageState } from "../Menu/ErrorMessageState.ts";
import { OPT_GEOSCAPE } from "../Menu/OptionsBaseState.ts";
import { BuildNewBaseState } from "../Geoscape/BuildNewBaseState.ts";
import { AllocatePsiTrainingState } from "../Geoscape/AllocatePsiTrainingState.ts";
import { Base } from "../Savegame/Base.ts";
import type { Globe } from "../Geoscape/Globe.ts";
import { SDL_BUTTON_RIGHT } from "../types.ts";
import { BaseInfoState } from "./BaseInfoState.ts";
import { BaseView } from "./BaseView.ts";
import { BuildFacilitiesState } from "./BuildFacilitiesState.ts";
import { CraftInfoState } from "./CraftInfoState.ts";
import { CraftsState } from "./CraftsState.ts";
import { DismantleFacilityState } from "./DismantleFacilityState.ts";
import { ManageAlienContainmentState } from "./ManageAlienContainmentState.ts";
import { ManufactureState } from "./ManufactureState.ts";
import { MiniBaseView } from "./MiniBaseView.ts";
import { PurchaseState } from "./PurchaseState.ts";
import { ResearchState } from "./ResearchState.ts";
import { SellState } from "./SellState.ts";
import { SoldiersState } from "./SoldiersState.ts";
import { TransferBaseState } from "./TransferBaseState.ts";

export class BasescapeState extends State {
  private _txtFacility: Text;
  private _view: BaseView;
  private _mini: MiniBaseView;
  private _edtBase: TextEdit;
  private _txtLocation: Text;
  private _txtFunds: Text;
  private _btnNewBase: TextButton;
  private _btnBaseInfo: TextButton;
  private _btnSoldiers: TextButton;
  private _btnCrafts: TextButton;
  private _btnFacilities: TextButton;
  private _btnResearch: TextButton;
  private _btnManufacture: TextButton;
  private _btnTransfer: TextButton;
  private _btnPurchase: TextButton;
  private _btnSell: TextButton;
  private _btnGeoscape: TextButton;

  constructor(private _base: Base | null, private _globe: Globe | null) {
    super();
    this._txtFacility = new Text(192, 9, 0, 0);
    this._view = new BaseView(192, 192, 0, 8);
    this._mini = new MiniBaseView(128, 16, 192, 41);
    this._edtBase = new TextEdit(this, 127, 17, 193, 0);
    this._txtLocation = new Text(126, 9, 194, 16);
    this._txtFunds = new Text(126, 9, 194, 24);
    this._btnNewBase = new TextButton(128, 12, 192, 58);
    this._btnBaseInfo = new TextButton(128, 12, 192, 71);
    this._btnSoldiers = new TextButton(128, 12, 192, 84);
    this._btnCrafts = new TextButton(128, 12, 192, 97);
    this._btnFacilities = new TextButton(128, 12, 192, 110);
    this._btnResearch = new TextButton(128, 12, 192, 123);
    this._btnManufacture = new TextButton(128, 12, 192, 136);
    this._btnTransfer = new TextButton(128, 12, 192, 149);
    this._btnPurchase = new TextButton(128, 12, 192, 162);
    this._btnSell = new TextButton(128, 12, 192, 175);
    this._btnGeoscape = new TextButton(128, 12, 192, 188);

    this.setInterface("basescape");
    this.add(this._view, "baseView", "basescape");
    this.add(this._mini, "miniBase", "basescape");
    this.add(this._txtFacility, "textTooltip", "basescape");
    this.add(this._edtBase, "text1", "basescape");
    this.add(this._txtLocation, "text2", "basescape");
    this.add(this._txtFunds, "text3", "basescape");
    for (const button of [
      this._btnNewBase,
      this._btnBaseInfo,
      this._btnSoldiers,
      this._btnCrafts,
      this._btnFacilities,
      this._btnResearch,
      this._btnManufacture,
      this._btnTransfer,
      this._btnPurchase,
      this._btnSell,
      this._btnGeoscape
    ]) {
      this.add(button, "button", "basescape");
    }
    this.centerAllSurfaces();

    const basebits = this.game().getMod()?.getSurfaceSet("BASEBITS.PCK") || null;
    this._view.setTexture(basebits);
    this._mini.setTexture(basebits);

    this._view.onMouseOver(this.viewMouseOver.bind(this));
    this._view.onMouseOut(this.viewMouseOut.bind(this));
    this._view.onMouseClick(this.viewLeftClick.bind(this));
    this._view.onMouseClick(this.viewRightClick.bind(this), SDL_BUTTON_RIGHT);
    this._mini.onMouseClick(this.miniClick.bind(this));

    this._edtBase.setBig();
    this._edtBase.onChange(this.edtBaseChange.bind(this));
    this._txtFacility.setAlign(ALIGN_CENTER);

    this._btnNewBase.setText(String(this.tr("STR_BUILD_NEW_BASE_UC")));
    this._btnBaseInfo.setText(String(this.tr("STR_BASE_INFORMATION")));
    this._btnSoldiers.setText(String(this.tr("STR_SOLDIERS_UC")));
    this._btnCrafts.setText(String(this.tr("STR_EQUIP_CRAFT")));
    this._btnFacilities.setText(String(this.tr("STR_BUILD_FACILITIES")));
    this._btnResearch.setText(String(this.tr("STR_RESEARCH")));
    this._btnManufacture.setText(String(this.tr("STR_MANUFACTURE")));
    this._btnTransfer.setText(String(this.tr("STR_TRANSFER_UC")));
    this._btnPurchase.setText(String(this.tr("STR_PURCHASE_RECRUIT")));
    this._btnSell.setText(String(this.tr("STR_SELL_SACK_UC")));
    this._btnGeoscape.setText(String(this.tr("STR_GEOSCAPE_UC")));

    this._btnNewBase.onMouseClick(this.btnNewBaseClick.bind(this));
    this._btnBaseInfo.onMouseClick(this.btnBaseInfoClick.bind(this));
    this._btnSoldiers.onMouseClick(this.btnSoldiersClick.bind(this));
    this._btnCrafts.onMouseClick(this.btnCraftsClick.bind(this));
    this._btnFacilities.onMouseClick(this.btnFacilitiesClick.bind(this));
    this._btnResearch.onMouseClick(this.btnResearchClick.bind(this));
    this._btnManufacture.onMouseClick(this.btnManufactureClick.bind(this));
    this._btnTransfer.onMouseClick(this.btnTransferClick.bind(this));
    this._btnPurchase.onMouseClick(this.btnPurchaseClick.bind(this));
    this._btnSell.onMouseClick(this.btnSellClick.bind(this));
    this._btnGeoscape.onMouseClick(this.btnGeoscapeClick.bind(this));
    this._btnGeoscape.onKeyboardPress(this.btnGeoscapeClick.bind(this), Options.keyCancel);
  }

  override init(): void {
    super.init();
    const save = this.game().getSavedGame();
    if (!this._base) {
      this._base = save?.getBases()[0] || null;
    }
    this._mini.setBases(save?.getBases() || []);
    this.setBase(this._base);
  }

  setBase(base: Base | null): void {
    this._base = base;
    this._view.setBase(base);
    this._mini.setSelectedBase(base);
    this._edtBase.setText(base?.getName() || "");
    this._txtFacility.setText("");
    this._txtLocation.setText("");

    const save = this.game().getSavedGame();
    if (base && save) {
      const region = save.locateRegion(base.getLongitude(), base.getLatitude());
      if (region) {
        this._txtLocation.setText(String(this.tr(region.getRules().getType())));
      }
      this._txtFunds.setText(String(this.tr("STR_FUNDS").arg(formatFunding(save.getFunds()))));
    }
  }

  viewLeftClick(_action: Action): void {
    const fac = this._view.getSelectedFacility();
    if (fac && this._base) {
      if (fac.inUse()) {
        const element = this.game().getMod()?.getInterface("basescape")?.getElement("errorMessage");
        const backElement = this.game().getMod()?.getInterface("basescape")?.getElement("errorPalette");
        this.game().pushState(new ErrorMessageState(String(this.tr("STR_FACILITY_IN_USE")), this._palette, element?.color ?? 0, "BACK13.SCR", backElement?.color ?? -1));
      } else if (this._base.getDisconnectedFacilities(fac).length > 0) {
        const element = this.game().getMod()?.getInterface("basescape")?.getElement("errorMessage");
        const backElement = this.game().getMod()?.getInterface("basescape")?.getElement("errorPalette");
        this.game().pushState(new ErrorMessageState(String(this.tr("STR_CANNOT_DISMANTLE_FACILITY")), this._palette, element?.color ?? 0, "BACK13.SCR", backElement?.color ?? -1));
      } else {
        this.game().pushState(new DismantleFacilityState(this._base, this._view, fac));
      }
    }
  }

  viewMouseOver(_action: Action): void {
    const facility = this._view.getSelectedFacility();
    this._txtFacility.setText(facility ? String(this.tr(facility.getRules().getType())) : "");
  }

  viewMouseOut(_action: Action): void {
    this._txtFacility.setText("");
  }

  viewRightClick(_action: Action): void {
    const fac = this._view.getSelectedFacility();
    if (!this._base) {
      return;
    }
    if (fac === null) {
      this.game().pushState(new BaseInfoState(this._base, this));
    } else if (fac.getRules().getCrafts() > 0) {
      const facilityCraft = fac.getCraft();
      if (!facilityCraft) {
        this.game().pushState(new CraftsState(this._base));
      } else {
        const craftId = this._base.getCrafts().indexOf(facilityCraft);
        if (craftId !== -1) {
          this.game().pushState(new CraftInfoState(this._base, craftId));
        }
      }
    } else if (fac.getRules().getStorage() > 0) {
      this.btnSellClick();
    } else if (fac.getRules().getPersonnel() > 0) {
      this.btnSoldiersClick();
    } else if (fac.getRules().getPsiLaboratories() > 0 && Options.anytimePsiTraining && this._base.getAvailablePsiLabs() > 0) {
      this.game().pushState(new AllocatePsiTrainingState(this._base));
    } else if (fac.getRules().getLaboratories() > 0) {
      this.btnResearchClick();
    } else if (fac.getRules().getWorkshops() > 0) {
      this.btnManufactureClick();
    } else if (fac.getRules().getAliens() > 0) {
      this.game().pushState(new ManageAlienContainmentState(this._base, OPT_GEOSCAPE));
    } else if (fac.getRules().isLift() || fac.getRules().getRadarRange() > 0) {
      this.game().popState();
    }
  }

  miniClick(action: Action): void {
    const base = this._mini.getBaseAt(action.getAbsoluteXMouse());
    if (base) {
      this.setBase(base);
    }
  }

  edtBaseChange(_action: Action): void {
    this._base?.setName(this._edtBase.getText());
  }

  btnNewBaseClick(): void {
    if (!this._globe) {
      console.log("No geoscape globe available.");
      return;
    }
    const base = new Base(this.game().getMod());
    this.game().popState();
    this.game().pushState(new BuildNewBaseState(base, this._globe, false));
  }

  btnBaseInfoClick(): void {
    if (this._base) {
      this.game().pushState(new BaseInfoState(this._base, this));
    }
  }

  btnSoldiersClick(): void {
    if (this._base) {
      this.game().pushState(new SoldiersState(this._base));
    }
  }

  btnCraftsClick(): void {
    if (this._base) {
      this.game().pushState(new CraftsState(this._base));
    }
  }

  btnFacilitiesClick(): void {
    if (this._base) {
      this.game().pushState(new BuildFacilitiesState(this._base, this));
    }
  }

  btnResearchClick(): void {
    if (this._base) {
      this.game().pushState(new ResearchState(this._base));
    }
  }

  btnManufactureClick(): void {
    if (this._base) {
      this.game().pushState(new ManufactureState(this._base));
    }
  }

  btnTransferClick(): void {
    if (this._base) {
      this.game().pushState(new TransferBaseState(this._base));
    }
  }

  btnPurchaseClick(): void {
    if (this._base) {
      this.game().pushState(new PurchaseState(this._base));
    }
  }

  btnSellClick(): void {
    if (this._base) {
      this.game().pushState(new SellState(this._base));
    }
  }

  btnGeoscapeClick(): void {
    this.game().popState();
  }
}
