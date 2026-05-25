import type { Action } from "../Engine/Action.ts";
import { Options } from "../Engine/Options.ts";
import { State } from "../Engine/State.ts";
import { Surface } from "../Engine/Surface.ts";
import { ALIGN_CENTER, Text } from "../Interface/Text.ts";
import { BattlescapeButton } from "../Interface/BattlescapeButton.ts";
import { Mod } from "../Mod/Mod.ts";
import { RuleInventory } from "../Mod/RuleInventory.ts";
import { BattleItem } from "../Savegame/BattleItem.ts";
import { BattleUnit } from "../Savegame/BattleUnit.ts";
import type { Tile } from "../Savegame/Tile.ts";
import { BattlescapeGenerator } from "./BattlescapeGenerator.ts";
import { Inventory } from "./Inventory.ts";
import { UnitInfoState } from "./UnitInfoState.ts";
import { SDL_BUTTON_X1, SDL_BUTTON_X2, SDL_MOUSEBUTTONDOWN } from "../types.ts";

const templateBtnX = 288;
const createTemplateBtnY = 90;
const applyTemplateBtnY = 113;

type InventoryTemplateItem = {
  itemType: string;
  slot: string;
  slotX: number;
  slotY: number;
  ammoItem: string;
  fuseTimer: number;
};

/**
 * Screen which displays soldier's inventory.
 */
export class InventoryState extends State {
  private _bg: Surface;
  private _soldier: Surface;
  private _txtName: Text;
  private _txtItem: Text;
  private _txtAmmo: Text;
  private _txtWeight: Text;
  private _txtTus: Text;
  private _txtFAcc: Text;
  private _txtReact: Text;
  private _txtPSkill: Text;
  private _txtPStr: Text;
  private _btnOk: BattlescapeButton;
  private _btnPrev: BattlescapeButton;
  private _btnNext: BattlescapeButton;
  private _btnUnload: BattlescapeButton;
  private _btnGround: BattlescapeButton;
  private _btnRank: BattlescapeButton;
  private _btnCreateTemplate: BattlescapeButton;
  private _btnApplyTemplate: BattlescapeButton;
  private _selAmmo: Surface;
  private _inv: Inventory;
  private _curInventoryTemplate: InventoryTemplateItem[] = [];
  private _battleGame: any;
  private _currentTooltip = "";

  constructor(private _tu: boolean, private _parent: any) {
    super();
    this._battleGame = this.game().getSavedGame()?.getSavedBattle();

    this._bg = new Surface(320, 200, 0, 0);
    this._soldier = new Surface(320, 200, 0, 0);
    this._txtName = new Text(210, 17, 28, 6);
    this._txtTus = new Text(40, 9, 245, 24);
    this._txtWeight = new Text(70, 9, 245, 24);
    this._txtFAcc = new Text(50, 9, 245, 32);
    this._txtReact = new Text(50, 9, 245, 40);
    this._txtPSkill = new Text(50, 9, 245, 48);
    this._txtPStr = new Text(50, 9, 245, 56);
    this._txtItem = new Text(160, 9, 128, 140);
    this._txtAmmo = new Text(66, 24, 254, 64);
    this._btnOk = new BattlescapeButton(35, 22, 237, 1);
    this._btnPrev = new BattlescapeButton(23, 22, 273, 1);
    this._btnNext = new BattlescapeButton(23, 22, 297, 1);
    this._btnUnload = new BattlescapeButton(32, 25, 288, 32);
    this._btnGround = new BattlescapeButton(32, 15, 289, 137);
    this._btnRank = new BattlescapeButton(26, 23, 0, 0);
    this._btnCreateTemplate = new BattlescapeButton(32, 22, templateBtnX, createTemplateBtnY);
    this._btnApplyTemplate = new BattlescapeButton(32, 22, templateBtnX, applyTemplateBtnY);
    this._selAmmo = new Surface(RuleInventory.HAND_W * RuleInventory.SLOT_W, RuleInventory.HAND_H * RuleInventory.SLOT_H, 272, 88);
    this._inv = new Inventory(this.game(), 320, 200, 0, 0, this._parent == null);

    this.setPaletteByName("PAL_BATTLESCAPE");
    this.add(this._bg);
    this.game().getMod()?.getSurface("TAC01.SCR")?.blit(this._bg);
    this.add(this._soldier);
    this.add(this._txtName, "textName", "inventory", this._bg);
    this.add(this._txtTus, "textTUs", "inventory", this._bg);
    this.add(this._txtWeight, "textWeight", "inventory", this._bg);
    this.add(this._txtFAcc, "textFiring", "inventory", this._bg);
    this.add(this._txtReact, "textReaction", "inventory", this._bg);
    this.add(this._txtPSkill, "textPsiSkill", "inventory", this._bg);
    this.add(this._txtPStr, "textPsiStrength", "inventory", this._bg);
    this.add(this._txtItem, "textItem", "inventory", this._bg);
    this.add(this._txtAmmo, "textAmmo", "inventory", this._bg);
    this.add(this._btnOk, "buttonOK", "inventory", this._bg);
    this.add(this._btnPrev, "buttonPrev", "inventory", this._bg);
    this.add(this._btnNext, "buttonNext", "inventory", this._bg);
    this.add(this._btnUnload, "buttonUnload", "inventory", this._bg);
    this.add(this._btnGround, "buttonGround", "inventory", this._bg);
    this.add(this._btnRank, "rank", "inventory", this._bg);
    this.add(this._btnCreateTemplate, "buttonCreate", "inventory", this._bg);
    this.add(this._btnApplyTemplate, "buttonApply", "inventory", this._bg);
    this.add(this._selAmmo);
    this.add(this._inv);

    if ((Options as any).showMoreStatsInInventoryView) {
      this._txtTus.setY(this._txtTus.getY() + 8);
    }
    this.centerAllSurfaces();

    this._txtName.setBig();
    this._txtName.setHighContrast(true);
    this._txtTus.setHighContrast(true);
    this._txtWeight.setHighContrast(true);
    this._txtFAcc.setHighContrast(true);
    this._txtReact.setHighContrast(true);
    this._txtPSkill.setHighContrast(true);
    this._txtPStr.setHighContrast(true);
    this._txtItem.setHighContrast(true);
    this._txtAmmo.setAlign(ALIGN_CENTER);
    this._txtAmmo.setHighContrast(true);

    this.bindButton(this._btnOk, this.btnOkClick.bind(this), "STR_OK", (Options as any).keyBattleInventory);
    this.bindButton(this._btnPrev, this.btnPrevClick.bind(this), "STR_PREVIOUS_UNIT", (Options as any).keyBattlePrevUnit);
    this.bindButton(this._btnNext, this.btnNextClick.bind(this), "STR_NEXT_UNIT", (Options as any).keyBattleNextUnit);
    this.bindButton(this._btnUnload, this.btnUnloadClick.bind(this), "STR_UNLOAD_WEAPON");
    this.bindButton(this._btnGround, this.btnGroundClick.bind(this), "STR_SCROLL_RIGHT");
    this.bindButton(this._btnRank, this.btnRankClick.bind(this), "STR_UNIT_STATS");
    this.bindButton(this._btnCreateTemplate, this.btnCreateTemplateClick.bind(this), "STR_CREATE_INVENTORY_TEMPLATE", (Options as any).keyInvCreateTemplate);
    this.bindButton(this._btnApplyTemplate, this.btnApplyTemplateClick.bind(this), "STR_APPLY_INVENTORY_TEMPLATE", (Options as any).keyInvApplyTemplate);

    if (this._tu) {
      this._btnCreateTemplate.setVisible(false);
      this._btnApplyTemplate.setVisible(false);
    } else {
      this._updateTemplateButtons(true);
    }

    this._inv.draw();
    this._inv.setTuMode(this._tu);
    this._inv.setSelectedUnit(this._battleGame?.getSelectedUnit?.() || null);
    this._inv.onMouseClick(this.invClick.bind(this), 0);
    this._inv.onMouseOver(this.invMouseOver.bind(this));
    this._inv.onMouseOut(this.invMouseOut.bind(this));

    this._txtTus.setVisible(this._tu);
    this._txtWeight.setVisible(!!(Options as any).showMoreStatsInInventoryView);
    this._txtFAcc.setVisible(!!(Options as any).showMoreStatsInInventoryView && !this._tu);
    this._txtReact.setVisible(!!(Options as any).showMoreStatsInInventoryView && !this._tu);
    this._txtPSkill.setVisible(!!(Options as any).showMoreStatsInInventoryView && !this._tu);
    this._txtPStr.setVisible(!!(Options as any).showMoreStatsInInventoryView && !this._tu);
  }

  private bindButton(button: BattlescapeButton, handler: (action?: Action) => void, tooltip: string, key?: string): void {
    button.onMouseClick(handler);
    button.onKeyboardPress(handler, Options.keyCancel);
    if (key) {
      button.onKeyboardPress(handler, key);
    }
    button.setTooltip(tooltip);
    button.onMouseIn(this.txtTooltipIn.bind(this));
    button.onMouseOut(this.txtTooltipOut.bind(this));
  }

  override init(): void {
    super.init();
    let unit = this._battleGame?.getSelectedUnit?.();
    if (!unit) {
      this.btnOkClick();
      return;
    }
    if (!unit.hasInventory?.()) {
      if (this._parent) {
        this._parent.selectNextPlayerUnit?.(false, false, true, this._tu);
      } else {
        this._battleGame?.selectNextPlayerUnit?.(false, false, true);
      }
      unit = this._battleGame?.getSelectedUnit?.();
      if (!unit?.hasInventory?.()) {
        this.btnOkClick();
        return;
      }
    }

    unit.setCache?.(0);
    this._soldier.clear();
    this._btnRank.clear();
    this._txtName.setBig();
    this._txtName.setText(unit.getName?.(this.game().getLanguage()) || "");
    this._inv.setSelectedUnit(unit);
    const mod = this.game().getMod();
    const soldier = unit.getGeoscapeSoldier?.();
    if (soldier) {
      mod?.getSurfaceSet("SMOKE.PCK")?.getFrame(20 + soldier.getRank?.())?.blit(this._btnRank);
      const look = this.getSoldierInventorySprite(soldier);
      mod?.getSurface(look)?.blit(this._soldier);
    } else {
      const armor = unit.getArmor?.();
      if (armor) {
        mod?.getSurface(armor.getSpriteInventory())?.blit(this._soldier);
      }
    }
    this.updateStats();
    this._refreshMouse();
  }

  updateStats(): void {
    const unit = this._battleGame?.getSelectedUnit?.();
    if (!unit) {
      return;
    }
    this._txtTus.setText(String(this.tr("STR_TIME_UNITS_SHORT").arg(unit.getTimeUnits?.() || 0)));
    const stats = unit.getBaseStats?.() || {};
    const weight = unit.getCarriedWeight?.(this._inv.getSelectedItem()) || 0;
    this._txtWeight.setText(String(this.tr("STR_WEIGHT").arg(weight).arg(stats.strength || 0)));
    this._txtFAcc.setText(String(this.tr("STR_ACCURACY_SHORT").arg(Math.trunc(((stats.firing || 0) * (unit.getHealth?.() || 0)) / Math.max(1, stats.health || 1)))));
    this._txtReact.setText(String(this.tr("STR_REACTIONS_SHORT").arg(stats.reactions || 0)));
    this._txtPSkill.setText(stats.psiSkill > 0 ? String(this.tr("STR_PSIONIC_SKILL_SHORT").arg(stats.psiSkill)) : "");
    this._txtPStr.setText(stats.psiSkill > 0 || ((Options as any).psiStrengthEval && this.game().getSavedGame()?.isResearched?.(this.game().getMod()?.getPsiRequirements?.() || []))
      ? String(this.tr("STR_PSIONIC_STRENGTH_SHORT").arg(stats.psiStrength || 0))
      : "");
  }

  saveEquipmentLayout(): void {
    for (const unit of this._battleGame?.getUnits?.() || []) {
      const soldier = unit.getGeoscapeSoldier?.();
      if (!soldier) {
        continue;
      }
      const layout = soldier.getEquipmentLayout?.();
      if (!layout) {
        continue;
      }
      layout.length = 0;
      for (const item of unit.getInventory?.() || []) {
        if (item.getRules?.().isFixed?.()) {
          continue;
        }
        layout.push({
          itemType: item.getRules().getType(),
          slot: item.getSlot()?.getId?.() || "",
          slotX: item.getSlotX(),
          slotY: item.getSlotY(),
          ammoItem: item.needsAmmo?.() && item.getAmmoItem?.() ? item.getAmmoItem().getRules().getType() : "NONE",
          fuseTimer: item.getFuseTimer?.() ?? -1
        });
      }
    }
  }

  btnOkClick(_action?: Action): void {
    if (this._inv.getSelectedItem()) {
      return;
    }
    this.game().popState();
    if (!this._tu) {
      this.saveEquipmentLayout();
      this._battleGame?.resetUnitTiles?.();
      if (this._battleGame?.getTurn?.() === 1) {
        this._battleGame?.randomizeItemLocations?.(this._battleGame?.getSelectedUnit?.()?.getTile?.());
      }
      for (const unit of this._battleGame?.getUnits?.() || []) {
        unit.prepareNewTurn?.(false);
      }
    }
  }

  btnPrevClick(_action?: Action): void {
    if (this._inv.getSelectedItem()) {
      return;
    }
    (this._parent || this._battleGame)?.selectPreviousPlayerUnit?.(false, false, true);
    this.init();
  }

  btnNextClick(_action?: Action): void {
    if (this._inv.getSelectedItem()) {
      return;
    }
    (this._parent || this._battleGame)?.selectNextPlayerUnit?.(false, false, true);
    this.init();
  }

  btnUnloadClick(_action?: Action): void {
    if (this._inv.unload()) {
      this._txtItem.setText("");
      this._txtAmmo.setText("");
      this._selAmmo.clear();
      this.updateStats();
      this.playItemDropSound();
    }
  }

  btnGroundClick(_action?: Action): void {
    this._inv.arrangeGround();
  }

  btnRankClick(_action?: Action): void {
    const unit = this._battleGame?.getSelectedUnit?.();
    if (unit) {
      this.game().pushState(new UnitInfoState(unit, this._parent, true, false));
    }
  }

  btnCreateTemplateClick(_action?: Action): void {
    if (this._inv.getSelectedItem()) {
      return;
    }
    this._curInventoryTemplate = [];
    for (const item of this._battleGame?.getSelectedUnit?.()?.getInventory?.() || []) {
      if (!item.getRules?.().isFixed?.()) {
        this._curInventoryTemplate.push({
          itemType: item.getRules().getType(),
          slot: item.getSlot()?.getId?.() || "",
          slotX: item.getSlotX(),
          slotY: item.getSlotY(),
          ammoItem: item.needsAmmo?.() && item.getAmmoItem?.() ? item.getAmmoItem().getRules().getType() : "NONE",
          fuseTimer: item.getFuseTimer?.() ?? -1
        });
      }
    }
    this.playItemDropSound();
    this._refreshMouse();
  }

  btnApplyTemplateClick(_action?: Action): void {
    if (this._inv.getSelectedItem()) {
      return;
    }
    const unit = this._battleGame?.getSelectedUnit?.() as BattleUnit | null;
    const groundTile = unit?.getTile?.() as Tile | null;
    const groundInv = groundTile?.getInventory?.() || [];
    const groundRuleInv = this.game().getMod()?.getInventory("STR_GROUND", true);
    if (!unit || !groundTile || !groundRuleInv) {
      return;
    }

    this.clearInventory(unit, groundTile, groundRuleInv);
    let itemMissing = false;
    for (const templateItem of this._curInventoryTemplate) {
      const rule = this.game().getMod()?.getItem(templateItem.itemType, true);
      const needsAmmo = (rule?.getCompatibleAmmo?.() || []).length > 0;
      let found = false;
      let rescan = true;
      while (rescan) {
        rescan = false;
        let matchedWeapon: BattleItem | null = null;
        let matchedAmmo: BattleItem | null = null;
        for (let i = 0; i < groundInv.length; ++i) {
          const groundItem = groundInv[i];
          const groundItemName = groundItem.getRules().getType();
          if (needsAmmo && templateItem.ammoItem === groundItemName) {
            matchedAmmo = groundItem;
          }
          if (templateItem.itemType !== groundItemName) {
            continue;
          }
          const slot = templateItem.slot ? this.game().getMod()?.getInventory(templateItem.slot, true) : null;
          if (!slot) {
            found = true;
            break;
          }
          if (Inventory.overlapItems(unit, groundItem, slot, templateItem.slotX, templateItem.slotY)) {
            found = true;
            break;
          }
          const loadedAmmo = groundItem.getAmmoItem();
          if ((needsAmmo && loadedAmmo && templateItem.ammoItem !== loadedAmmo.getRules().getType()) || (needsAmmo && !loadedAmmo)) {
            if (!matchedWeapon || matchedWeapon.getAmmoItem()) {
              matchedWeapon = groundItem;
            }
            continue;
          }
          groundTile.removeItem(groundItem);
          groundItem.moveToOwner(unit);
          groundItem.setSlot(slot);
          groundItem.setSlotX(templateItem.slotX);
          groundItem.setSlotY(templateItem.slotY);
          groundItem.setFuseTimer(templateItem.fuseTimer);
          found = true;
          break;
        }

        if (!found && matchedWeapon && (!needsAmmo || matchedAmmo)) {
          const loadedAmmo = matchedWeapon.getAmmoItem();
          if (loadedAmmo) {
            groundTile.addItem(loadedAmmo, groundRuleInv);
            matchedWeapon.setAmmoItem(null);
          }
          if (matchedAmmo) {
            matchedWeapon.setAmmoItem(matchedAmmo);
            groundTile.removeItem(matchedAmmo);
          }
          rescan = true;
        }
      }
      if (!found) {
        itemMissing = true;
      }
    }
    if (itemMissing) {
      this._inv.showWarning(String(this.tr("STR_NOT_ENOUGH_ITEMS_FOR_TEMPLATE")));
    }
    this._inv.arrangeGround(false);
    this.updateStats();
    this._refreshMouse();
    this.playItemDropSound();
  }

  onClearInventory(_action?: Action): void {
    if (!this._inv.getSelectedItem()) {
      const unit = this._battleGame?.getSelectedUnit?.() as BattleUnit | null;
      const groundTile = unit?.getTile?.() as Tile | null;
      const groundRuleInv = this.game().getMod()?.getInventory("STR_GROUND", true);
      if (unit && groundTile && groundRuleInv) {
        this.clearInventory(unit, groundTile, groundRuleInv);
      }
      this._inv.arrangeGround(false);
      this.updateStats();
      this._refreshMouse();
      this.playItemDropSound();
    }
  }

  onAutoequip(_action?: Action): void {
    if (!this._inv.getSelectedItem()) {
      const unit = this._battleGame?.getSelectedUnit?.() as BattleUnit | null;
      const groundTile = unit?.getTile?.() as Tile | null;
      const groundInv = groundTile?.getInventory?.() || [];
      const groundRuleInv = this.game().getMod()?.getInventory("STR_GROUND", true);
      if (unit && groundRuleInv) {
        const bgen = new BattlescapeGenerator(this._battleGame, this.game().getMod());
        bgen.autoEquip([unit], groundInv, groundRuleInv, true, true, null);
      }
      this._inv.arrangeGround(false);
      this.updateStats();
      this._refreshMouse();
      this.playItemDropSound();
    }
  }

  invClick(_action?: Action): void {
    this.updateStats();
  }

  invMouseOver(_action?: Action): void {
    if (this._inv.getSelectedItem()) {
      return;
    }
    const item = this._inv.getMouseOverItem();
    if (item) {
      this._txtItem.setText(String(this.tr(item.getRules().getName())));
      if (item.getAmmoItem() && item.needsAmmo()) {
        this._txtAmmo.setText(String(this.tr("STR_AMMO_ROUNDS_LEFT").arg(item.getAmmoItem()!.getAmmoQuantity())));
      } else if (item.getAmmoQuantity() !== 0 && item.needsAmmo()) {
        this._txtAmmo.setText(String(this.tr("STR_AMMO_ROUNDS_LEFT").arg(item.getAmmoQuantity())));
      } else {
        this._txtAmmo.setText("");
      }
    } else {
      if (!this._currentTooltip) {
        this._txtItem.setText("");
      }
      this._txtAmmo.setText("");
      this._selAmmo.clear();
      this._updateTemplateButtons(!this._tu);
    }
  }

  invMouseOut(_action?: Action): void {
    this._txtItem.setText("");
    this._txtAmmo.setText("");
    this._selAmmo.clear();
    this._updateTemplateButtons(!this._tu);
  }

  override handle(action: Action): void {
    super.handle(action);
    const details = action.getDetails();
    if (details.type === SDL_MOUSEBUTTONDOWN) {
      if (details.button?.button === SDL_BUTTON_X1) {
        this.btnNextClick(action);
      } else if (details.button?.button === SDL_BUTTON_X2) {
        this.btnPrevClick(action);
      }
    }
  }

  txtTooltipIn(action?: Action): void {
    if (!this._inv.getSelectedItem() && (Options as any).battleTooltips) {
      const sender = action?.getSender() as { getTooltip?: () => string } | undefined;
      this._currentTooltip = sender?.getTooltip?.() || "";
      this._txtItem.setText(String(this.tr(this._currentTooltip)));
    }
  }

  txtTooltipOut(action?: Action): void {
    if (!this._inv.getSelectedItem() && (Options as any).battleTooltips) {
      const sender = action?.getSender() as { getTooltip?: () => string } | undefined;
      if (this._currentTooltip === (sender?.getTooltip?.() || "")) {
        this._currentTooltip = "";
        this._txtItem.setText("");
      }
    }
  }

  private _updateTemplateButtons(isVisible: boolean): void {
    if (isVisible) {
      this.game().getMod()?.getSurface(this._curInventoryTemplate.length === 0 ? "InvCopy" : "InvCopyActive")?.blit(this._btnCreateTemplate);
      this.game().getMod()?.getSurface(this._curInventoryTemplate.length === 0 ? "InvPasteEmpty" : "InvPaste")?.blit(this._btnApplyTemplate);
      this._btnApplyTemplate.setTooltip(this._curInventoryTemplate.length === 0 ? "STR_CLEAR_INVENTORY" : "STR_APPLY_INVENTORY_TEMPLATE");
      this._btnCreateTemplate.initSurfaces();
      this._btnApplyTemplate.initSurfaces();
    } else {
      this._btnCreateTemplate.clear();
      this._btnApplyTemplate.clear();
    }
  }

  private _refreshMouse(): void {}

  private clearInventory(unit: BattleUnit, groundTile: Tile, groundRuleInv: RuleInventory): void {
    for (const item of [...unit.getInventory()]) {
      if (item.getRules().isFixed()) {
        continue;
      }
      item.moveToOwner(null);
      groundTile.addItem(item, groundRuleInv);
    }
  }

  private playItemDropSound(): void {
    this.game().getMod()?.getSoundByDepth(Mod.ITEM_DROP, this._battleGame?.getDepth?.() || 0, false)?.play();
  }

  private getSoldierInventorySprite(soldier: any): string {
    let look = soldier.getArmor?.().getSpriteInventory?.() || "";
    look += soldier.getGender?.() === "GENDER_MALE" || soldier.getGender?.() === 0 ? "M" : "F";
    look += String(soldier.getLook?.() || 0);
    return `${look}.SPK`;
  }
}
