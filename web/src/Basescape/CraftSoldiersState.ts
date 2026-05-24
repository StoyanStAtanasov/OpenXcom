import type { Action } from "../Engine/Action.ts";
import { Options } from "../Engine/Options.ts";
import { State } from "../Engine/State.ts";
import { ComboBox } from "../Interface/ComboBox.ts";
import { Text } from "../Interface/Text.ts";
import { TextButton } from "../Interface/TextButton.ts";
import { ARROW_VERTICAL, TextList } from "../Interface/TextList.ts";
import { Window } from "../Interface/Window.ts";
import { INT_MAX } from "../Mod/RuleInterface.ts";
import type { Base } from "../Savegame/Base.ts";
import type { Craft } from "../Savegame/Craft.ts";
import type { Soldier } from "../Savegame/Soldier.ts";
import { SDL_BUTTON_LEFT, SDL_BUTTON_RIGHT, SDL_BUTTON_WHEELDOWN, SDL_BUTTON_WHEELUP } from "../types.ts";
import { SoldierInfoState } from "./SoldierInfoState.ts";

type SortFunctor = ((a: Soldier, b: Soldier) => number) | null;

type CraftVehicleLike = {
  size: number;
};

const CRAFT_VEHICLES_KEY = "__openxcomCraftEquipmentVehicles" as const;

type CraftVehicleHost = {
  [CRAFT_VEHICLES_KEY]?: CraftVehicleLike[];
};

function getCraftVehicles(craft: Craft): CraftVehicleLike[] {
  return (craft as Craft & CraftVehicleHost)[CRAFT_VEHICLES_KEY] || [];
}

function getCraftSpaceUsed(craft: Craft): number {
  let vehicleSpaceUsed = 0;
  for (const vehicle of getCraftVehicles(craft)) {
    vehicleSpaceUsed += vehicle.size;
  }
  return craft.getNumSoldiers() + vehicleSpaceUsed;
}

function getCraftSpaceAvailable(craft: Craft): number {
  return craft.getRules().getSoldiers() - getCraftSpaceUsed(craft);
}

function psiSkillStat(_state: CraftSoldiersState, soldier: Soldier): number {
  return soldier.getCurrentStats().psiSkill > 0 ? soldier.getCurrentStats().psiSkill : 0;
}

/**
 * Select Squad screen that lets the player pick the soldiers to assign to a craft.
 */
export class CraftSoldiersState extends State {
  private _btnOk: TextButton;
  private _window: Window;
  private _txtTitle: Text;
  private _txtName: Text;
  private _txtRank: Text;
  private _txtCraft: Text;
  private _txtAvailable: Text;
  private _txtUsed: Text;
  private _cbxSortBy: ComboBox;
  private _lstSoldiers: TextList;
  private _otherCraftColor = 0;
  private _origSoldierOrder: Soldier[];
  private _sortFunctors: SortFunctor[] = [];

  constructor(private _base: Base, private _craft: number) {
    super();
    this._origSoldierOrder = [...this._base.getSoldiers()];

    this._window = new Window(this, 320, 200, 0, 0);
    this._btnOk = new TextButton(148, 16, 164, 176);
    this._txtTitle = new Text(300, 17, 16, 7);
    this._txtName = new Text(114, 9, 16, 32);
    this._txtRank = new Text(102, 9, 122, 32);
    this._txtCraft = new Text(84, 9, 224, 32);
    this._txtAvailable = new Text(110, 9, 16, 24);
    this._txtUsed = new Text(110, 9, 122, 24);
    this._cbxSortBy = new ComboBox(this, 148, 16, 8, 176, true);
    this._lstSoldiers = new TextList(288, 128, 8, 40);

    this.setInterface("craftSoldiers");

    this.add(this._window, "window", "craftSoldiers");
    this.add(this._btnOk, "button", "craftSoldiers");
    this.add(this._txtTitle, "text", "craftSoldiers");
    this.add(this._txtName, "text", "craftSoldiers");
    this.add(this._txtRank, "text", "craftSoldiers");
    this.add(this._txtCraft, "text", "craftSoldiers");
    this.add(this._txtAvailable, "text", "craftSoldiers");
    this.add(this._txtUsed, "text", "craftSoldiers");
    this.add(this._lstSoldiers, "list", "craftSoldiers");
    this.add(this._cbxSortBy, "button", "craftSoldiers");

    this._otherCraftColor = this.elementColor("otherCraft", this._lstSoldiers.getColor());

    this.centerAllSurfaces();

    const back02 = this.game().getMod()?.getSurface("BACK02.SCR");
    if (back02) {
      this._window.setBackground(back02);
    }

    this._btnOk.setText(String(this.tr("STR_OK")));
    this._btnOk.onMouseClick(this.btnOkClick.bind(this));
    this._btnOk.onKeyboardPress(this.btnOkClick.bind(this), Options.keyCancel);

    this._txtTitle.setBig();
    const craft = this._base.getCrafts()[this._craft];
    this._txtTitle.setText(String(this.tr("STR_SELECT_SQUAD_FOR_CRAFT").arg(craft?.getName(this.game().getLanguage()) || "")));

    this._txtName.setText(String(this.tr("STR_NAME_UC")));
    this._txtRank.setText(String(this.tr("STR_RANK")));
    this._txtCraft.setText(String(this.tr("STR_CRAFT")));

    const sortOptions: string[] = [];
    sortOptions.push(String(this.tr("STR_ORIGINAL_ORDER")));
    this._sortFunctors.push(null);

    this.pushSortOption(sortOptions, "STR_RANK", soldier => soldier.getRank());
    this.pushSortOption(sortOptions, "STR_MISSIONS2", soldier => soldier.getMissions());
    this.pushSortOption(sortOptions, "STR_KILLS2", soldier => soldier.getKills());
    this.pushSortOption(sortOptions, "STR_WOUND_RECOVERY2", soldier => soldier.getWoundRecovery());
    this.pushSortOption(sortOptions, "STR_TIME_UNITS", soldier => soldier.getCurrentStats().tu);
    this.pushSortOption(sortOptions, "STR_STAMINA", soldier => soldier.getCurrentStats().stamina);
    this.pushSortOption(sortOptions, "STR_HEALTH", soldier => soldier.getCurrentStats().health);
    this.pushSortOption(sortOptions, "STR_BRAVERY", soldier => soldier.getCurrentStats().bravery);
    this.pushSortOption(sortOptions, "STR_REACTIONS", soldier => soldier.getCurrentStats().reactions);
    this.pushSortOption(sortOptions, "STR_FIRING_ACCURACY", soldier => soldier.getCurrentStats().firing);
    this.pushSortOption(sortOptions, "STR_THROWING_ACCURACY", soldier => soldier.getCurrentStats().throwing);
    this.pushSortOption(sortOptions, "STR_STRENGTH", soldier => soldier.getCurrentStats().strength);

    const save = this.game().getSavedGame();
    const mod = this.game().getMod();
    let showPsiStrength = Options.psiStrengthEval && Boolean(save?.isResearched(mod?.getPsiRequirements() || []));
    let showPsiSkill = false;
    for (const soldier of this._base.getSoldiers()) {
      if (soldier.getCurrentStats().psiSkill > 0) {
        showPsiStrength = true;
        showPsiSkill = true;
        break;
      }
    }
    if (showPsiStrength) {
      this.pushSortOption(sortOptions, "STR_PSIONIC_STRENGTH", soldier => this.psiStrengthStat(soldier));
    }
    if (showPsiSkill) {
      this.pushSortOption(sortOptions, "STR_PSIONIC_SKILL", soldier => psiSkillStat(this, soldier));
    }

    this.pushSortOption(sortOptions, "STR_MELEE_ACCURACY", soldier => soldier.getCurrentStats().melee);

    this._cbxSortBy.setOptions(sortOptions);
    this._cbxSortBy.setSelected(0);
    this._cbxSortBy.onChange(this.cbxSortByChange.bind(this));
    this._cbxSortBy.setText(String(this.tr("STR_SORT_BY")));

    this._lstSoldiers.setArrowColumn(192, ARROW_VERTICAL);
    this._lstSoldiers.setColumns(3, 106, 102, 72);
    this._lstSoldiers.setSelectable(true);
    this._lstSoldiers.setBackground(this._window);
    this._lstSoldiers.setMargin(8);
    this._lstSoldiers.onLeftArrowClick(this.lstItemsLeftArrowClick.bind(this));
    this._lstSoldiers.onRightArrowClick(this.lstItemsRightArrowClick.bind(this));
    this._lstSoldiers.onMouseClick(this.lstSoldiersClick.bind(this), 0);
    this._lstSoldiers.onMousePress(this.lstSoldiersMousePress.bind(this));
  }

  /**
   * Sorts the soldiers list by the selected criterion.
   */
  cbxSortByChange(_action?: Action): void {
    const selIdx = this._cbxSortBy.getSelected();
    if (selIdx === -1) {
      return;
    }

    const compFunc = this._sortFunctors[selIdx];
    const soldiers = this._base.getSoldiers();
    if (compFunc) {
      soldiers.sort(compFunc);
    } else {
      for (const originalSoldier of this._origSoldierOrder) {
        const soldierIt = soldiers.indexOf(originalSoldier);
        if (soldierIt !== -1) {
          const soldier = soldiers[soldierIt];
          soldiers.splice(soldierIt, 1);
          soldiers.push(soldier);
        }
      }
    }

    this.initList();
  }

  /**
   * Returns to the previous screen.
   */
  btnOkClick(_action?: Action): void {
    this.game().popState();
  }

  /**
   * Shows the soldiers in a list.
   */
  override init(): void {
    super.init();
    this.initList();
  }

  /**
   * Reorders a soldier up.
   */
  lstItemsLeftArrowClick(action: Action): void {
    const row = this._lstSoldiers.getSelectedRow();
    if (row > 0) {
      if (action.getDetails().button?.button === SDL_BUTTON_LEFT) {
        this.moveSoldierUp(action, row);
      } else if (action.getDetails().button?.button === SDL_BUTTON_RIGHT) {
        this.moveSoldierUp(action, row, true);
      }
    }
    this.clearSortSelection();
  }

  /**
   * Moves a soldier up on the list.
   */
  moveSoldierUp(_action: Action, row: number, max = false): void {
    const soldiers = this._base.getSoldiers();
    const soldier = soldiers[row];
    if (!soldier) {
      return;
    }
    if (max) {
      soldiers.splice(row, 1);
      soldiers.unshift(soldier);
    } else {
      soldiers[row] = soldiers[row - 1];
      soldiers[row - 1] = soldier;
      if (row === this._lstSoldiers.getScroll()) {
        this._lstSoldiers.scrollUp(false);
      }
    }
    this.initList();
  }

  /**
   * Reorders a soldier down.
   */
  lstItemsRightArrowClick(action: Action): void {
    const row = this._lstSoldiers.getSelectedRow();
    const numSoldiers = this._base.getSoldiers().length;
    if (0 < numSoldiers && INT_MAX >= numSoldiers && row < numSoldiers - 1) {
      if (action.getDetails().button?.button === SDL_BUTTON_LEFT) {
        this.moveSoldierDown(action, row);
      } else if (action.getDetails().button?.button === SDL_BUTTON_RIGHT) {
        this.moveSoldierDown(action, row, true);
      }
    }
    this.clearSortSelection();
  }

  /**
   * Moves a soldier down on the list.
   */
  moveSoldierDown(_action: Action, row: number, max = false): void {
    const soldiers = this._base.getSoldiers();
    const soldier = soldiers[row];
    if (!soldier) {
      return;
    }
    if (max) {
      soldiers.splice(row, 1);
      soldiers.push(soldier);
    } else {
      soldiers[row] = soldiers[row + 1];
      soldiers[row + 1] = soldier;
      if (row === this._lstSoldiers.getVisibleRows() - 1 + this._lstSoldiers.getScroll()) {
        this._lstSoldiers.scrollDown(false);
      }
    }
    this.initList();
  }

  /**
   * Shows the selected soldier's info or toggles craft assignment.
   */
  lstSoldiersClick(action: Action): void {
    const mx = action.getAbsoluteXMouse();
    if (mx >= this._lstSoldiers.getArrowsLeftEdge() && mx < this._lstSoldiers.getArrowsRightEdge()) {
      return;
    }

    const row = this._lstSoldiers.getSelectedRow();
    const soldier = this._base.getSoldiers()[row];
    if (row < 0 || !soldier) {
      return;
    }

    if (action.getDetails().button?.button === SDL_BUTTON_LEFT) {
      const craft = this._base.getCrafts()[this._craft];
      if (!craft) {
        return;
      }

      let color = this._lstSoldiers.getColor();
      if (soldier.getCraft() === craft) {
        soldier.setCraft(null);
        this._lstSoldiers.setCellText(row, 2, String(this.tr("STR_NONE_UC")));
      } else if (soldier.getCraft() && soldier.getCraft()?.getStatus() === "STR_OUT") {
        color = this._otherCraftColor;
      } else if (getCraftSpaceAvailable(craft) > 0 && soldier.getWoundRecovery() === 0) {
        soldier.setCraft(craft);
        this._lstSoldiers.setCellText(row, 2, craft.getName(this.game().getLanguage()));
        color = this._lstSoldiers.getSecondaryColor();
      }
      this._lstSoldiers.setRowColor(row, color);

      this._txtAvailable.setText(String(this.tr("STR_SPACE_AVAILABLE").arg(getCraftSpaceAvailable(craft))));
      this._txtUsed.setText(String(this.tr("STR_SPACE_USED").arg(getCraftSpaceUsed(craft))));
    } else if (action.getDetails().button?.button === SDL_BUTTON_RIGHT) {
      this.game().pushState(new SoldierInfoState(this._base, row));
    }
  }

  /**
   * Handles the mouse-wheels on the arrow-buttons.
   */
  lstSoldiersMousePress(action: Action): void {
    if (Options.changeValueByMouseWheel === 0) {
      return;
    }
    const row = this._lstSoldiers.getSelectedRow();
    const numSoldiers = this._base.getSoldiers().length;
    if (action.getDetails().button?.button === SDL_BUTTON_WHEELUP && row > 0) {
      if (action.getAbsoluteXMouse() >= this._lstSoldiers.getArrowsLeftEdge() &&
        action.getAbsoluteXMouse() <= this._lstSoldiers.getArrowsRightEdge()) {
        this.moveSoldierUp(action, row);
      }
    } else if (action.getDetails().button?.button === SDL_BUTTON_WHEELDOWN &&
      0 < numSoldiers && INT_MAX >= numSoldiers && row < numSoldiers - 1) {
      if (action.getAbsoluteXMouse() >= this._lstSoldiers.getArrowsLeftEdge() &&
        action.getAbsoluteXMouse() <= this._lstSoldiers.getArrowsRightEdge()) {
        this.moveSoldierDown(action, row);
      }
    }
  }

  private pushSortOption(sortOptions: string[], strId: string, getter: (soldier: Soldier) => number): void {
    sortOptions.push(String(this.tr(strId)));
    this._sortFunctors.push((a, b) => getter(a) - getter(b));
  }

  private psiStrengthStat(soldier: Soldier): number {
    const stats = soldier.getCurrentStats();
    const mod = this.game().getMod();
    const save = this.game().getSavedGame();
    if (stats.psiSkill > 0 || (Options.psiStrengthEval && Boolean(save?.isResearched(mod?.getPsiRequirements() || [])))) {
      return stats.psiStrength;
    }
    return 0;
  }

  private elementColor(id: string, fallback: number): number {
    const color = this.game().getMod()?.getInterface("craftSoldiers")?.getElement(id)?.color;
    return color != null && color !== INT_MAX ? color : fallback;
  }

  /**
   * Initializes the display list based on the craft soldier's list.
   */
  private initList(): void {
    const originalScrollPos = this._lstSoldiers.getScroll();
    this._lstSoldiers.clearList();
    const craft = this._base.getCrafts()[this._craft];
    if (!craft) {
      return;
    }

    let row = 0;
    for (const soldier of this._base.getSoldiers()) {
      this._lstSoldiers.addRow(
        3,
        soldier.getName(true, 19),
        String(this.tr(soldier.getRankString())),
        soldier.getCraftString(this.game().getLanguage())
      );

      let color: number;
      if (soldier.getCraft() === craft) {
        color = this._lstSoldiers.getSecondaryColor();
      } else if (soldier.getCraft() !== null) {
        color = this._otherCraftColor;
      } else {
        color = this._lstSoldiers.getColor();
      }
      this._lstSoldiers.setRowColor(row, color);
      row++;
    }

    this._lstSoldiers.draw();
    this._lstSoldiers.scrollTo(originalScrollPos);
    this._txtAvailable.setText(String(this.tr("STR_SPACE_AVAILABLE").arg(getCraftSpaceAvailable(craft))));
    this._txtUsed.setText(String(this.tr("STR_SPACE_USED").arg(getCraftSpaceUsed(craft))));
  }

  private clearSortSelection(): void {
    (this._cbxSortBy as unknown as { _sel: number })._sel = -1;
    this._cbxSortBy.setText(String(this.tr("STR_SORT_BY")));
  }
}
