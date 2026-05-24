import { Options } from "../Engine/Options.ts";
import { State } from "../Engine/State.ts";
import { formatFunding } from "../Engine/Unicode.ts";
import type { Action } from "../Engine/Action.ts";
import { Text, ALIGN_CENTER } from "../Interface/Text.ts";
import { TextButton } from "../Interface/TextButton.ts";
import { TextList } from "../Interface/TextList.ts";
import { Window } from "../Interface/Window.ts";
import type { RuleManufacture } from "../Mod/RuleManufacture.ts";
import type { Base } from "../Savegame/Base.ts";
import { ErrorMessageState } from "../Menu/ErrorMessageState.ts";
import { ManufactureInfoState } from "./ManufactureInfoState.ts";

export class ManufactureStartState extends State {
  private _window: Window;
  private _btnCancel: TextButton;
  private _btnStart: TextButton;
  private _txtTitle: Text;
  private _txtManHour: Text;
  private _txtCost: Text;
  private _txtWorkSpace: Text;
  private _txtRequiredItemsTitle: Text;
  private _txtItemNameColumn: Text;
  private _txtUnitRequiredColumn: Text;
  private _txtUnitAvailableColumn: Text;
  private _lstRequiredItems: TextList;

  constructor(private _base: Base, private _item: RuleManufacture) {
    super();
    this._screen = false;

    this._window = new Window(this, 320, 160, 0, 20);
    this._btnCancel = new TextButton(136, 16, 16, 155);
    this._txtTitle = new Text(320, 17, 0, 30);
    this._txtManHour = new Text(290, 9, 16, 50);
    this._txtCost = new Text(290, 9, 16, 60);
    this._txtWorkSpace = new Text(290, 9, 16, 70);
    this._txtRequiredItemsTitle = new Text(290, 9, 16, 84);
    this._txtItemNameColumn = new Text(60, 16, 30, 92);
    this._txtUnitRequiredColumn = new Text(60, 16, 155, 92);
    this._txtUnitAvailableColumn = new Text(60, 16, 230, 92);
    this._lstRequiredItems = new TextList(270, 40, 30, 108);
    this._btnStart = new TextButton(136, 16, 168, 155);

    this.setInterface("allocateManufacture");

    this.add(this._window, "window", "allocateManufacture");
    this.add(this._txtTitle, "text", "allocateManufacture");
    this.add(this._txtManHour, "text", "allocateManufacture");
    this.add(this._txtCost, "text", "allocateManufacture");
    this.add(this._txtWorkSpace, "text", "allocateManufacture");
    this.add(this._btnCancel, "button", "allocateManufacture");
    this.add(this._txtRequiredItemsTitle, "text", "allocateManufacture");
    this.add(this._txtItemNameColumn, "text", "allocateManufacture");
    this.add(this._txtUnitRequiredColumn, "text", "allocateManufacture");
    this.add(this._txtUnitAvailableColumn, "text", "allocateManufacture");
    this.add(this._lstRequiredItems, "list", "allocateManufacture");
    this.add(this._btnStart, "button", "allocateManufacture");

    this.centerAllSurfaces();

    const background = this.game().getMod()?.getSurface("BACK17.SCR");
    if (background) {
      this._window.setBackground(background);
    }

    this._txtTitle.setText(String(this.tr(this._item.getName())));
    this._txtTitle.setBig();
    this._txtTitle.setAlign(ALIGN_CENTER);

    this._txtManHour.setText(String(this.tr("STR_ENGINEER_HOURS_TO_PRODUCE_ONE_UNIT").arg(this._item.getManufactureTime())));
    this._txtCost.setText(String(this.tr("STR_COST_PER_UNIT_").arg(formatFunding(this._item.getManufactureCost()))));
    this._txtWorkSpace.setText(String(this.tr("STR_WORK_SPACE_REQUIRED").arg(this._item.getRequiredSpace())));

    this._btnCancel.setText(String(this.tr("STR_CANCEL_UC")));
    this._btnCancel.onMouseClick(this.btnCancelClick.bind(this));
    this._btnCancel.onKeyboardPress(this.btnCancelClick.bind(this), Options.keyCancel);

    const requiredItems = this._item.getRequiredItems();
    const availableWorkSpace = this._base.getFreeWorkshops();
    let productionPossible = this._item.haveEnoughMoneyForOneMoreUnit(this.game().getSavedGame()?.getFunds() || 0);
    productionPossible = productionPossible && availableWorkSpace > 0;

    this._txtRequiredItemsTitle.setText(String(this.tr("STR_SPECIAL_MATERIALS_REQUIRED")));
    this._txtRequiredItemsTitle.setAlign(ALIGN_CENTER);

    this._txtItemNameColumn.setText(String(this.tr("STR_ITEM_REQUIRED")));
    this._txtItemNameColumn.setWordWrap(true);

    this._txtUnitRequiredColumn.setText(String(this.tr("STR_UNITS_REQUIRED")));
    this._txtUnitRequiredColumn.setWordWrap(true);

    this._txtUnitAvailableColumn.setText(String(this.tr("STR_UNITS_AVAILABLE")));
    this._txtUnitAvailableColumn.setWordWrap(true);

    this._lstRequiredItems.setColumns(3, 140, 75, 55);
    this._lstRequiredItems.setBackground(this._window);

    let row = 0;
    const mod = this.game().getMod();
    for (const [id, quantity] of requiredItems) {
      let available = 0;
      if (mod?.getItem(id) != null) {
        available = this._base.getStorageItems().getItem(id);
        productionPossible = productionPossible && available >= quantity;
      } else if (mod?.getCraft(id) != null) {
        available = this._base.getCraftCount(id);
        productionPossible = productionPossible && available >= quantity;
      }
      this._lstRequiredItems.addRow(3, String(this.tr(id)), `${quantity}`, `${available}`);
      this._lstRequiredItems.setCellColor(row, 1, this._lstRequiredItems.getSecondaryColor());
      this._lstRequiredItems.setCellColor(row, 2, this._lstRequiredItems.getSecondaryColor());
      row++;
    }

    const hasRequiredItems = requiredItems.size > 0;
    this._txtRequiredItemsTitle.setVisible(hasRequiredItems);
    this._txtItemNameColumn.setVisible(hasRequiredItems);
    this._txtUnitRequiredColumn.setVisible(hasRequiredItems);
    this._txtUnitAvailableColumn.setVisible(hasRequiredItems);
    this._lstRequiredItems.setVisible(hasRequiredItems);

    this._btnStart.setText(String(this.tr("STR_START_PRODUCTION")));
    this._btnStart.onMouseClick(this.btnStartClick.bind(this));
    this._btnStart.onKeyboardPress(this.btnStartClick.bind(this), Options.keyOk);
    this._btnStart.setVisible(productionPossible);
  }

  btnCancelClick(_action?: Action): void {
    this.game().popState();
  }

  btnStartClick(_action?: Action): void {
    if (this._item.getCategory() === "STR_CRAFT" && this._base.getAvailableHangars() - this._base.getUsedHangars() <= 0) {
      this.pushBasescapeError("STR_NO_FREE_HANGARS_FOR_CRAFT_PRODUCTION");
    } else if (this._item.getRequiredSpace() > this._base.getFreeWorkshops()) {
      this.pushBasescapeError("STR_NOT_ENOUGH_WORK_SPACE");
    } else {
      this.game().pushState(new ManufactureInfoState(this._base, this._item));
    }
  }

  private pushBasescapeError(message: string): void {
    const menuInterface = this.game().getMod()?.getInterface("basescape");
    this.game().pushState(new ErrorMessageState(
      String(this.tr(message)),
      this._palette,
      menuInterface?.getElement("errorMessage")?.color || 1,
      "BACK17.SCR",
      menuInterface?.getElement("errorPalette")?.color ?? -1
    ));
  }
}
