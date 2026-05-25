import { InteractiveSurface } from "../Engine/InteractiveSurface.ts";
import type { Action } from "../Engine/Action.ts";
import type { Game } from "../Engine/Game.ts";
import { Options } from "../Engine/Options.ts";
import type { PaletteColor } from "../types.ts";
import { KMOD_CTRL, SDL_BUTTON_LEFT, SDL_BUTTON_RIGHT } from "../types.ts";
import { Surface } from "../Engine/Surface.ts";
import { Timer } from "../Engine/Timer.ts";
import { Mod } from "../Mod/Mod.ts";
import { InventoryType, RuleInventory } from "../Mod/RuleInventory.ts";
import { BattleType } from "../Mod/RuleItem.ts";
import type { BattleItem } from "../Savegame/BattleItem.ts";
import type { BattleUnit } from "../Savegame/BattleUnit.ts";
import type { State } from "../Engine/State.ts";
import { PrimeGrenadeState } from "./PrimeGrenadeState.ts";
import { WarningMessage } from "./WarningMessage.ts";

type InventoryTileLike = {
  addItem?: (item: BattleItem, ground: RuleInventory | null) => void;
  removeItem?: (item: BattleItem) => void;
  getInventory?: () => BattleItem[];
};

/**
 * Interactive view of an inventory.
 */
export class Inventory extends InteractiveSurface {
  private _grid: Surface;
  private _items: Surface;
  private _selection: Surface;
  private _warning: WarningMessage;
  private _selUnit: BattleUnit | null = null;
  private _selItem: BattleItem | null = null;
  private _tu = true;
  private _mouseOverItem: BattleItem | null = null;
  private _groundOffset = 0;
  private _animFrame = 0;
  private _stackLevel = new Map<number, Map<number, number>>();
  private _grenadeIndicators: Array<[number, number]> = [];
  private _animTimer: Timer;
  private _depth = 0;

  constructor(private _game: Game, width: number, height: number, x = 0, y = 0, private _base = false) {
    super(width, height, x, y);
    this._depth = this._game.getSavedGame()?.getSavedBattle()?.getDepth?.() || 0;
    this._grid = new Surface(width, height, 0, 0);
    this._items = new Surface(width, height, 0, 0);
    this._selection = new Surface(RuleInventory.HAND_W * RuleInventory.SLOT_W, RuleInventory.HAND_H * RuleInventory.SLOT_H, x, y);
    this._warning = new WarningMessage(224, 24, 48, 176);
    this._warning.initText(this._game.getMod()?.getFont("FONT_BIG"), this._game.getMod()?.getFont("FONT_SMALL"), this._game.getLanguage());
    const warningRule = this._game.getMod()?.getInterface("battlescape")?.getElement("warning");
    this._warning.setColor(warningRule?.color2 ?? 0);
    this._warning.setTextColor(warningRule?.color ?? 0);
    this._animTimer = new Timer(125);
    this._animTimer.onSurfaceTimer(this.drawPrimers.bind(this));
    this._animTimer.start();
  }

  override setPalette(colors: PaletteColor[], firstcolor = 0, ncolors = 256): void {
    super.setPalette(colors, firstcolor, ncolors);
    this._grid.setPalette(colors, firstcolor, ncolors);
    this._items.setPalette(colors, firstcolor, ncolors);
    this._selection.setPalette(colors, firstcolor, ncolors);
    this._warning.setPalette(colors, firstcolor, ncolors);
  }

  setTuMode(tu: boolean): void {
    this._tu = tu;
  }

  setSelectedUnit(unit: BattleUnit | null): void {
    this._selUnit = unit;
    this._groundOffset = 999;
    this.arrangeGround();
  }

  override draw(): void {
    this.drawGrid();
    this.drawItems();
  }

  drawGrid(): void {
    this._grid.clear();
    const rule = this._game.getMod()?.getInterface("inventory");
    const color = rule?.getElement("grid")?.color ?? 1;
    for (const inventory of this._game.getMod()?.getInventories().values() || []) {
      if (inventory.getType() === InventoryType.INV_SLOT) {
        for (const slot of inventory.getSlots()) {
          this._grid.drawRect(inventory.getX() + RuleInventory.SLOT_W * slot.x, inventory.getY() + RuleInventory.SLOT_H * slot.y, RuleInventory.SLOT_W + 1, RuleInventory.SLOT_H + 1, color);
          this._grid.drawRect(inventory.getX() + RuleInventory.SLOT_W * slot.x + 1, inventory.getY() + RuleInventory.SLOT_H * slot.y + 1, RuleInventory.SLOT_W - 1, RuleInventory.SLOT_H - 1, 0);
        }
      } else if (inventory.getType() === InventoryType.INV_HAND) {
        this._grid.drawRect(inventory.getX(), inventory.getY(), RuleInventory.HAND_W * RuleInventory.SLOT_W, RuleInventory.HAND_H * RuleInventory.SLOT_H, color);
        this._grid.drawRect(inventory.getX() + 1, inventory.getY() + 1, RuleInventory.HAND_W * RuleInventory.SLOT_W - 2, RuleInventory.HAND_H * RuleInventory.SLOT_H - 2, 0);
      } else if (inventory.getType() === InventoryType.INV_GROUND) {
        for (let x = inventory.getX(); x <= 320; x += RuleInventory.SLOT_W) {
          for (let y = inventory.getY(); y <= 200; y += RuleInventory.SLOT_H) {
            this._grid.drawRect(x, y, RuleInventory.SLOT_W + 1, RuleInventory.SLOT_H + 1, color);
            this._grid.drawRect(x + 1, y + 1, RuleInventory.SLOT_W - 1, RuleInventory.SLOT_H - 1, 0);
          }
        }
      }
    }
  }

  drawItems(): void {
    this._items.clear();
    this._grenadeIndicators = [];
    if (!this._selUnit) {
      return;
    }
    const texture = this._game.getMod()?.getSurfaceSet("BIGOBS.PCK");
    for (const item of this._selUnit.getInventory()) {
      if (item === this._selItem) {
        continue;
      }
      this.drawItem(texture, item);
    }
    for (const item of this._selUnit.getTile()?.getInventory?.() || []) {
      if (item === this._selItem || item.getSlotX() < this._groundOffset || item.getRules().getInventoryHeight() === 0 || item.getRules().getInventoryWidth() === 0) {
        continue;
      }
      this.drawItem(texture, item, this._groundOffset);
    }
  }

  private drawItem(texture: { getFrame: (frame: number) => Surface | null } | null | undefined, item: BattleItem, groundOffset = 0): void {
    const slot = item.getSlot();
    const frame = texture?.getFrame(item.getRules().getBigSprite()) || null;
    if (!slot || !frame) {
      return;
    }
    if (slot.getType() === InventoryType.INV_SLOT || slot.getType() === InventoryType.INV_GROUND) {
      frame.setX(slot.getX() + (item.getSlotX() - groundOffset) * RuleInventory.SLOT_W);
      frame.setY(slot.getY() + item.getSlotY() * RuleInventory.SLOT_H);
    } else if (slot.getType() === InventoryType.INV_HAND) {
      frame.setX(slot.getX() + (RuleInventory.HAND_W - item.getRules().getInventoryWidth()) * RuleInventory.SLOT_W / 2);
      frame.setY(slot.getY() + (RuleInventory.HAND_H - item.getRules().getInventoryHeight()) * RuleInventory.SLOT_H / 2);
    }
    frame.blit(this._items);
    if (item.getFuseTimer() >= 0) {
      this._grenadeIndicators.push([frame.getX(), frame.getY()]);
    }
  }

  private moveItem(item: BattleItem, slot: RuleInventory | null, x: number, y: number): void {
    const tile = this._selUnit?.getTile() as InventoryTileLike | null;
    if (!slot) {
      if (item.getSlot()?.getType() === InventoryType.INV_GROUND) {
        tile?.removeItem?.(item);
      } else {
        item.moveToOwner(null);
      }
      return;
    }
    if (slot !== item.getSlot()) {
      if (slot.getType() === InventoryType.INV_GROUND) {
        item.moveToOwner(null);
        this.removeFromSelectedUnitInventory(item);
        tile?.addItem?.(item, slot);
      } else if (!item.getSlot() || item.getSlot()?.getType() === InventoryType.INV_GROUND) {
        item.moveToOwner(this._selUnit);
        tile?.removeItem?.(item);
        item.setTurnFlag(false);
      }
    }
    item.setSlot(slot);
    item.setSlotX(x);
    item.setSlotY(y);
  }

  static overlapItems(unit: BattleUnit, item: BattleItem, slot: RuleInventory, x = 0, y = 0): boolean {
    if (slot.getType() !== InventoryType.INV_GROUND) {
      for (const invItem of unit.getInventory()) {
        if (invItem.getSlot() === slot && invItem.occupiesSlot(x, y, item)) {
          return true;
        }
      }
    } else if (unit.getTile()) {
      for (const invItem of unit.getTile()?.getInventory?.() || []) {
        if (invItem.occupiesSlot(x, y, item)) {
          return true;
        }
      }
    }
    return false;
  }

  private getSlotInPosition(xRef: { value: number }, yRef: { value: number }): RuleInventory | null {
    for (const inventory of this._game.getMod()?.getInventories().values() || []) {
      if (inventory.checkSlotInPosition(xRef, yRef)) {
        return inventory;
      }
    }
    return null;
  }

  getSelectedItem(): BattleItem | null {
    return this._selItem;
  }

  setSelectedItem(item: BattleItem | null): void {
    this._selItem = item && !item.getRules().isFixed() ? item : null;
    this._selection.clear();
    if (this._selItem) {
      if (this._selItem.getSlot()?.getType() === InventoryType.INV_GROUND) {
        this.adjustStackLevel(this._selItem.getSlotX(), this._selItem.getSlotY(), -1);
      }
      this._selItem.getRules().drawHandSprite(this._game.getMod()!.getSurfaceSet("BIGOBS.PCK")!, this._selection);
    }
    this.drawItems();
  }

  getMouseOverItem(): BattleItem | null {
    return this._mouseOverItem;
  }

  setMouseOverItem(item: BattleItem | null): void {
    this._mouseOverItem = item && !item.getRules().isFixed() ? item : null;
  }

  override think(): void {
    this._warning.think();
    this._animTimer.think(null, this);
  }

  override blit(surface: Surface): void {
    this.clear();
    this._grid.blit(this);
    this._items.blit(this);
    this._selection.blit(this);
    this._warning.blit(this);
    super.blit(surface);
  }

  override mouseOver(action: Action, state: State): void {
    this._selection.setX(Math.floor(action.getAbsoluteXMouse()) - this._selection.getWidth() / 2 - this.getX());
    this._selection.setY(Math.floor(action.getAbsoluteYMouse()) - this._selection.getHeight() / 2 - this.getY());
    if (this._selUnit) {
      const xRef = { value: Math.floor(action.getAbsoluteXMouse()) - this.getX() };
      const yRef = { value: Math.floor(action.getAbsoluteYMouse()) - this.getY() };
      const slot = this.getSlotInPosition(xRef, yRef);
      if (slot?.getType() === InventoryType.INV_GROUND) {
        xRef.value += this._groundOffset;
      }
      this.setMouseOverItem(slot ? this._selUnit.getItem(slot, xRef.value, yRef.value) : null);
    }
    super.mouseOver(action, state);
  }

  override mouseClick(action: Action, state: State): void {
    const button = action.getDetails().button?.button;
    if (button === SDL_BUTTON_LEFT) {
      this.handleLeftClick(action);
    } else if (button === SDL_BUTTON_RIGHT) {
      this.handleRightClick(action);
    }
    super.mouseClick(action, state);
  }

  private handleLeftClick(action: Action): void {
    if (!this._selUnit) {
      return;
    }
    if (!this._selItem) {
      this.pickUpOrQuickMove(action);
    } else {
      this.dropSelectedItem(action);
    }
  }

  private pickUpOrQuickMove(action: Action): void {
    if (!this._selUnit) {
      return;
    }
    const position = this.getActionSlot(action);
    if (!position.slot) {
      return;
    }
    const item = this._selUnit.getItem(position.slot, position.x, position.y);
    if (!item || item.getRules().isFixed()) {
      return;
    }
    if ((Options.getKeyModifiers() & KMOD_CTRL) !== 0) {
      this.quickMoveItem(item, position.slot);
      return;
    }
    this.setSelectedItem(item);
    if (item.getFuseTimer() >= 0) {
      this.showTranslatedWarning("STR_GRENADE_IS_ACTIVATED");
    }
  }

  private quickMoveItem(item: BattleItem, slot: RuleInventory): void {
    let newSlot = this._game.getMod()?.getInventory("STR_GROUND", true) || null;
    let warning = "STR_NOT_ENOUGH_SPACE";
    let placed = false;
    if (!newSlot) {
      return;
    }

    if (slot.getType() === InventoryType.INV_GROUND) {
      switch (item.getRules().getBattleType()) {
        case BattleType.BT_FIREARM:
          newSlot = this._game.getMod()?.getInventory("STR_RIGHT_HAND", true) || newSlot;
          break;
        case BattleType.BT_MINDPROBE:
        case BattleType.BT_PSIAMP:
        case BattleType.BT_MELEE:
        case BattleType.BT_CORPSE:
          newSlot = this._game.getMod()?.getInventory("STR_LEFT_HAND", true) || newSlot;
          break;
        default:
          newSlot = this._game.getMod()?.getInventory(item.getRules().getInventoryHeight() > 2 ? "STR_BACK_PACK" : "STR_BELT", true) || newSlot;
          break;
      }
    }

    if (newSlot.getType() !== InventoryType.INV_GROUND) {
      if (slot.getType() === InventoryType.INV_GROUND) {
        this.adjustStackLevel(item.getSlotX(), item.getSlotY(), -1);
      }
      const warningRef = { value: warning };
      placed = this.fitItem(newSlot, item, warningRef);
      warning = warningRef.value;
      for (const wildCard of this._game.getMod()?.getInventories().values() || []) {
        if (placed || wildCard.getType() === InventoryType.INV_GROUND) {
          continue;
        }
        warningRef.value = warning;
        placed = this.fitItem(wildCard, item, warningRef);
        warning = warningRef.value;
      }
      if (!placed && slot.getType() === InventoryType.INV_GROUND) {
        this.adjustStackLevel(item.getSlotX(), item.getSlotY(), 1);
      }
    } else if (this.spendMoveTime(item, newSlot)) {
      placed = true;
      this.moveItem(item, newSlot, 0, 0);
      this.playItemSound(Mod.ITEM_DROP);
      this.arrangeGround(false);
    } else {
      warning = "STR_NOT_ENOUGH_TIME_UNITS";
    }

    if (!placed) {
      this.showTranslatedWarning(warning);
    }
  }

  private dropSelectedItem(action: Action): void {
    if (!this._selUnit || !this._selItem) {
      return;
    }
    const target = this.getSelectionSlot();
    if (target.slot) {
      this.tryDropSelectedAt(target.slot, target.x, target.y);
      return;
    }
    const mouseTarget = this.getActionSlot(action);
    if (!mouseTarget.slot || mouseTarget.slot.getType() !== InventoryType.INV_GROUND) {
      return;
    }
    const item = this._selUnit.getItem(mouseTarget.slot, mouseTarget.x, mouseTarget.y);
    if (this.canBeStacked(item, this._selItem)) {
      this.stackSelectedOn(item!);
    }
  }

  private tryDropSelectedAt(slot: RuleInventory, x: number, y: number): void {
    if (!this._selUnit || !this._selItem) {
      return;
    }
    const item = this._selUnit.getItem(slot, x, y);
    const canStack = slot.getType() === InventoryType.INV_GROUND && this.canBeStacked(item, this._selItem);
    if (item === null || item === this._selItem || canStack) {
      if (!Inventory.overlapItems(this._selUnit, this._selItem, slot, x, y) && slot.fitItemInSlot(this._selItem.getRules(), x, y)) {
        if (this.spendMoveTime(this._selItem, slot)) {
          this.moveItem(this._selItem, slot, x, y);
          if (slot.getType() === InventoryType.INV_GROUND) {
            this.adjustStackLevel(x, y, 1);
          }
          this.setSelectedItem(null);
          this.playItemSound(Mod.ITEM_DROP);
        } else {
          this.showTranslatedWarning("STR_NOT_ENOUGH_TIME_UNITS");
        }
      } else if (canStack) {
        this.stackSelectedOn(item!);
      }
      return;
    }

    if (item.getRules().getCompatibleAmmo().length > 0) {
      this.loadSelectedAmmoInto(item);
    }
  }

  private stackSelectedOn(item: BattleItem): void {
    if (!this._selItem) {
      return;
    }
    const slot = item.getSlot();
    if (!slot) {
      return;
    }
    if (this.spendMoveTime(this._selItem, slot)) {
      this.moveItem(this._selItem, slot, item.getSlotX(), item.getSlotY());
      this.adjustStackLevel(item.getSlotX(), item.getSlotY(), 1);
      this.setSelectedItem(null);
      this.playItemSound(Mod.ITEM_DROP);
    } else {
      this.showTranslatedWarning("STR_NOT_ENOUGH_TIME_UNITS");
    }
  }

  private loadSelectedAmmoInto(item: BattleItem): void {
    if (!this._selItem) {
      return;
    }
    if (!item.getRules().getCompatibleAmmo().includes(this._selItem.getRules().getType())) {
      this.showTranslatedWarning("STR_WRONG_AMMUNITION_FOR_THIS_WEAPON");
      return;
    }
    if (item.getAmmoItem()) {
      this.showTranslatedWarning("STR_WEAPON_IS_ALREADY_LOADED");
      return;
    }
    if (this._tu && !this._selUnit?.spendTimeUnits(15)) {
      this.showTranslatedWarning("STR_NOT_ENOUGH_TIME_UNITS");
      return;
    }
    const ammo = this._selItem;
    this.moveItem(ammo, null, 0, 0);
    item.setAmmoItem(ammo);
    ammo.moveToOwner(null);
    this.setSelectedItem(null);
    this.playItemSound(Mod.ITEM_RELOAD);
    if (item.getSlot()?.getType() === InventoryType.INV_GROUND) {
      this.arrangeGround(false);
    }
  }

  private handleRightClick(action: Action): void {
    if (!this._selItem) {
      if (!this._base || (Options as any).includePrimeStateInSavedLayout) {
        if (!this._tu) {
          this.toggleGrenadePrimeAt(action);
        } else {
          this._game.popState();
        }
      }
      return;
    }
    if (this._selItem.getSlot()?.getType() === InventoryType.INV_GROUND) {
      this.adjustStackLevel(this._selItem.getSlotX(), this._selItem.getSlotY(), 1);
    }
    this.setSelectedItem(null);
  }

  private toggleGrenadePrimeAt(action: Action): void {
    if (!this._selUnit) {
      return;
    }
    const position = this.getActionSlot(action);
    if (!position.slot) {
      return;
    }
    const item = this._selUnit.getItem(position.slot, position.x, position.y);
    if (!item) {
      return;
    }
    const itemType = item.getRules().getBattleType();
    if (itemType !== BattleType.BT_GRENADE && itemType !== BattleType.BT_PROXIMITYGRENADE) {
      return;
    }
    if (item.getFuseTimer() === -1) {
      if (itemType === BattleType.BT_PROXIMITYGRENADE) {
        this.showTranslatedWarning("STR_GRENADE_IS_ACTIVATED");
        item.setFuseTimer(0);
        this.arrangeGround(false);
      } else {
        this._game.pushState(new PrimeGrenadeState(null, true, item));
      }
    } else {
      this.showTranslatedWarning("STR_GRENADE_IS_DEACTIVATED");
      item.setFuseTimer(-1);
      this.arrangeGround(false);
    }
  }

  private getActionSlot(action: Action): { slot: RuleInventory | null; x: number; y: number } {
    const xRef = { value: Math.floor(action.getAbsoluteXMouse()) - this.getX() };
    const yRef = { value: Math.floor(action.getAbsoluteYMouse()) - this.getY() };
    const slot = this.getSlotInPosition(xRef, yRef);
    if (slot?.getType() === InventoryType.INV_GROUND) {
      xRef.value += this._groundOffset;
    }
    return { slot, x: xRef.value, y: yRef.value };
  }

  private getSelectionSlot(): { slot: RuleInventory | null; x: number; y: number } {
    if (!this._selItem) {
      return { slot: null, x: 0, y: 0 };
    }
    const xRef = {
      value: this._selection.getX() +
        (RuleInventory.HAND_W - this._selItem.getRules().getInventoryWidth()) * RuleInventory.SLOT_W / 2 +
        RuleInventory.SLOT_W / 2
    };
    const yRef = {
      value: this._selection.getY() +
        (RuleInventory.HAND_H - this._selItem.getRules().getInventoryHeight()) * RuleInventory.SLOT_H / 2 +
        RuleInventory.SLOT_H / 2
    };
    const slot = this.getSlotInPosition(xRef, yRef);
    if (slot?.getType() === InventoryType.INV_GROUND) {
      xRef.value += this._groundOffset;
    }
    return { slot, x: xRef.value, y: yRef.value };
  }

  private spendMoveTime(item: BattleItem, slot: RuleInventory): boolean {
    if (!this._tu) {
      return true;
    }
    return !!this._selUnit?.spendTimeUnits(item.getSlot()?.getCost(slot) || 0);
  }

  private playItemSound(sound: number): void {
    this._game.getMod()?.getSoundByDepth(sound, this._depth, false)?.play();
  }

  private removeFromSelectedUnitInventory(item: BattleItem): void {
    const inventory = this._selUnit?.getInventory() || [];
    for (let index = inventory.indexOf(item); index !== -1; index = inventory.indexOf(item)) {
      inventory.splice(index, 1);
    }
  }

  private showTranslatedWarning(id: string): void {
    this.showWarning(String(this._game.getLanguage().getString(id)));
  }

  unload(): boolean {
    if (!this._selItem || !this._selItem.getAmmoItem() || !this._selItem.needsAmmo()) {
      if (this._selItem && !this._selItem.getAmmoItem() && this._selItem.getRules().getCompatibleAmmo().length > 0) {
        this.showWarning(String(this._game.getLanguage().getString("STR_NO_AMMUNITION_LOADED")));
      }
      return false;
    }
    for (const item of this._selUnit?.getInventory() || []) {
      if (item !== this._selItem && item.getSlot()?.getType() === InventoryType.INV_HAND) {
        this.showWarning(String(this._game.getLanguage().getString("STR_BOTH_HANDS_MUST_BE_EMPTY")));
        return false;
      }
    }
    const leftHand = this._game.getMod()?.getInventory("STR_LEFT_HAND", true);
    const rightHand = this._game.getMod()?.getInventory("STR_RIGHT_HAND", true);
    if (!leftHand || !rightHand) {
      return false;
    }
    if (this._tu && !this._selUnit?.spendTimeUnits(8)) {
      this.showWarning(String(this._game.getLanguage().getString("STR_NOT_ENOUGH_TIME_UNITS")));
      return false;
    }
    this.moveItem(this._selItem.getAmmoItem()!, leftHand, 0, 0);
    this._selItem.getAmmoItem()!.moveToOwner(this._selUnit);
    this.moveItem(this._selItem, rightHand, 0, 0);
    this._selItem.moveToOwner(this._selUnit);
    this._selItem.setAmmoItem(null);
    this.setSelectedItem(null);
    return true;
  }

  arrangeGround(alterOffset = true): void {
    const ground = this._game.getMod()?.getInventory("STR_GROUND", true);
    const tile = this._selUnit?.getTile();
    if (!ground || !tile) {
      this.drawItems();
      return;
    }
    const slotsX = Math.trunc((320 - ground.getX()) / RuleInventory.SLOT_W);
    const slotsY = Math.trunc((200 - ground.getY()) / RuleInventory.SLOT_H);
    let xMax = 0;
    this._stackLevel.clear();
    for (const item of tile.getInventory?.() || []) {
      item.setSlot(ground);
      let x = 0;
      let y = 0;
      while (this.groundOccupied(item, ground, x, y, slotsX, slotsY)) {
        y++;
        if (y > slotsY - item.getRules().getInventoryHeight()) {
          y = 0;
          x++;
        }
      }
      item.setSlotX(x);
      item.setSlotY(y);
      this.incrementStack(x, y);
      xMax = Math.max(xMax, x + item.getRules().getInventoryWidth());
    }
    if (alterOffset) {
      this._groundOffset = xMax >= this._groundOffset + slotsX ? this._groundOffset + slotsX : 0;
    }
    this.drawItems();
  }

  fitItem(newSlot: RuleInventory, item: BattleItem, warning: { value: string }): boolean {
    let placed = false;
    let maxSlotX = 0;
    let maxSlotY = 0;
    for (const slot of newSlot.getSlots()) {
      maxSlotX = Math.max(maxSlotX, slot.x);
      maxSlotY = Math.max(maxSlotY, slot.y);
    }
    for (let y = 0; y <= maxSlotY && !placed; ++y) {
      for (let x = 0; x <= maxSlotX && !placed; ++x) {
        if (this._selUnit && !Inventory.overlapItems(this._selUnit, item, newSlot, x, y) && newSlot.fitItemInSlot(item.getRules(), x, y)) {
          const cost = item.getSlot()?.getCost(newSlot) || 0;
          if (!this._tu || this._selUnit.spendTimeUnits(cost)) {
            placed = true;
            this.moveItem(item, newSlot, x, y);
            this._game.getMod()?.getSoundByDepth(Mod.ITEM_DROP, this._depth, false)?.play();
            this.drawItems();
          } else {
            warning.value = "STR_NOT_ENOUGH_TIME_UNITS";
          }
        }
      }
    }
    return placed;
  }

  canBeStacked(itemA: BattleItem | null, itemB: BattleItem | null): boolean {
    return !!(itemA && itemB &&
      itemA.getRules() === itemB.getRules() &&
      ((!itemA.getAmmoItem() && !itemB.getAmmoItem()) ||
        (itemA.getAmmoItem() && itemB.getAmmoItem() &&
          itemA.getAmmoItem()!.getRules() === itemB.getAmmoItem()!.getRules() &&
          itemA.getAmmoItem()!.getAmmoQuantity() === itemB.getAmmoItem()!.getAmmoQuantity())) &&
      itemA.getFuseTimer() === -1 && itemB.getFuseTimer() === -1 &&
      !itemA.getUnit() && !itemB.getUnit() &&
      itemA.getPainKillerQuantity() === itemB.getPainKillerQuantity() &&
      itemA.getHealQuantity() === itemB.getHealQuantity() &&
      itemA.getStimulantQuantity() === itemB.getStimulantQuantity());
  }

  showWarning(msg: string): void {
    this._warning.showMessage(msg);
  }

  drawPrimers(): void {
    const pulsate = [0, 1, 2, 3, 4, 3, 2, 1];
    if (this._animFrame === 8) {
      this._animFrame = 0;
    }
    const tempSurface = this._game.getMod()?.getSurfaceSet("SCANG.DAT")?.getFrame(6);
    for (const [x, y] of this._grenadeIndicators) {
      tempSurface?.blitNShade(this._items, x, y, pulsate[this._animFrame]);
    }
    this._animFrame++;
  }

  private groundOccupied(item: BattleItem, ground: RuleInventory, x: number, y: number, slotsX: number, slotsY: number): boolean {
    for (let xd = 0; xd < item.getRules().getInventoryWidth(); ++xd) {
      if ((x + xd) % slotsX < x % slotsX) {
        return true;
      }
      for (let yd = 0; yd < item.getRules().getInventoryHeight(); ++yd) {
        if (y + yd >= slotsY || (this._selUnit?.getItem(ground, x + xd, y + yd) && !this.canBeStacked(this._selUnit.getItem(ground, x + xd, y + yd), item))) {
          return true;
        }
      }
    }
    return false;
  }

  private incrementStack(x: number, y: number): void {
    this.adjustStackLevel(x, y, 1);
  }

  private adjustStackLevel(x: number, y: number, delta: number): void {
    if (!this._stackLevel.has(x)) {
      this._stackLevel.set(x, new Map());
    }
    const row = this._stackLevel.get(x)!;
    row.set(y, (row.get(y) || 0) + delta);
  }
}
