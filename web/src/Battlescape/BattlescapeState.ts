import { Options } from "../Engine/Options.ts";
import { State } from "../Engine/State.ts";
import { Surface } from "../Engine/Surface.ts";
import type { Action } from "../Engine/Action.ts";
import { Text } from "../Interface/Text.ts";
import { BattleType } from "../Mod/RuleItem.ts";
import type { BattleItem } from "../Savegame/BattleItem.ts";
import { UnitFaction, type BattleUnit } from "../Savegame/BattleUnit.ts";
import { SavedBattleGame } from "../Savegame/SavedBattleGame.ts";
import { SDL_BUTTON_RIGHT } from "../types.ts";
import { OPT_BATTLESCAPE } from "../Menu/OptionsOrigin.ts";
import { PauseState } from "../Menu/PauseState.ts";
import { AbortMissionState } from "./AbortMissionState.ts";
import { ActionMenuState } from "./ActionMenuState.ts";
import { BattlescapeGame } from "./BattlescapeGame.ts";
import { InventoryState } from "./InventoryState.ts";
import { Map } from "./Map.ts";
import { MiniMapState } from "./MiniMapState.ts";
import { Pathfinding } from "./Pathfinding.ts";
import { Position } from "./Position.ts";
import { UnitInfoState } from "./UnitInfoState.ts";

/**
 * Battlescape screen which shows the tactical battle.
 */
export class BattlescapeState extends State {
  static readonly DEFAULT_ANIM_SPEED = 100;
  private static readonly VISIBLE_MAX = 10;

  private _icons: Surface;
  private _map: Map;
  private _save: SavedBattleGame;
  private _txtDebug: Text;
  private _txtTooltip: Text;
  private _popups: State[] = [];
  private _popped = false;
  private _battleGame: BattlescapeGame;
  private _firstInit = true;
  private _mouseOverIcons = false;
  private _currentTooltip = "";
  private _cursorPosition = new Position();
  private _autosave = false;
  private _btnVisibleUnit: unknown[] = Array.from({ length: BattlescapeState.VISIBLE_MAX }, () => ({}));
  private _visibleUnit: Array<BattleUnit | null> = Array.from({ length: BattlescapeState.VISIBLE_MAX }, () => null);

  constructor(save?: SavedBattleGame) {
    super();
    this._save = save || this.game().getSavedGame()?.getSavedBattle() || new SavedBattleGame();
    if (this._save.getMapSizeXYZ() === 0) {
      this._save.initMap(10, 10, 1);
      this._save.initUtilities(this.game().getMod() || undefined);
    } else if (!this._save.getPathfinding()) {
      this._save.initUtilities(this.game().getMod() || undefined);
    }

    const screenWidth = Options.baseXResolution;
    const screenHeight = Options.baseYResolution;
    const iconsHeight = 40;
    const iconsWidth = 320;
    const x = Math.trunc(screenWidth / 2 - iconsWidth / 2);
    const y = screenHeight - iconsHeight;
    const visibleMapHeight = screenHeight - iconsHeight;

    this._icons = new Surface(iconsWidth, iconsHeight, x, y);
    this._map = new Map({
      getSavedGame: () => ({ getSavedBattle: () => this._save }),
      getMod: () => this.game().getMod(),
      getLanguage: () => this.game().getLanguage()
    }, screenWidth, screenHeight, 0, 0, visibleMapHeight);
    this._txtDebug = new Text(300, 10, 20, 0);
    this._txtTooltip = new Text(300, 10, x + 2, y - 10);
    this._battleGame = new BattlescapeGame(this._save, this);
    this._save.setBattleState(this);

    this.setInterface("battlescape");
    const pathing = this.game().getMod()?.getInterface("battlescape")?.getElement("pathfinding");
    if (pathing) {
      Pathfinding.green = pathing.color;
      Pathfinding.yellow = pathing.color2;
      Pathfinding.red = pathing.border;
    }
    this._icons.drawRect(0, 0, this._icons.getWidth(), this._icons.getHeight(), 15);
    this._txtDebug.setText("");
    this._txtTooltip.setText("");

    this.add(this._map);
    this.add(this._icons);
    this.add(this._txtDebug);
    this.add(this._txtTooltip);

    this._map.onMouseOver(this.mapOver.bind(this));
    this._map.onMousePress(this.mapPress.bind(this));
    this._map.onMouseClick(this.mapClick.bind(this), 0);
    this._map.onMouseIn(this.mapIn.bind(this));
  }

  override init(): void {
    super.init();
    this._battleGame.init();
    this._map.init();
    if (this._firstInit) {
      const selected = this._save.getSelectedUnit() || this._save.getUnits().find(unit => !unit.isOut()) || null;
      if (selected) {
        this._save.setSelectedUnit(selected);
        this._map.getCamera().centerOnPosition(selected.getPosition(), false);
      }
      this._firstInit = false;
    }
    this._map.invalidate();
  }

  override think(): void {
    if (this._popups.length === 0) {
      super.think();
      this._battleGame.think();
      if (this._popped) {
        this._battleGame.handleNonTargetAction();
        this._popped = false;
      }
    } else {
      this.game().pushState(this._popups.shift()!);
      this._popped = true;
    }
  }

  mapOver(_action: Action): void {}

  mapPress(_action: Action): void {}

  mapClick(action: Action): void {
    if (this._mouseOverIcons) {
      return;
    }
    const pos = this._map.getSelectorPosition();
    if (action.getDetails().button?.button === SDL_BUTTON_RIGHT) {
      this._battleGame.secondaryAction(pos);
    } else {
      this._battleGame.primaryAction(pos);
    }
  }

  mapIn(_action: Action): void {}

  btnUnitUpClick(_action?: Action): void {
    const unit = this._save.getSelectedUnit();
    if (unit && this.playableUnitSelected() && this._save.getPathfinding()?.validateUpDown(unit, unit.getPosition(), Pathfinding.DIR_UP)) {
      this._battleGame.cancelAllActions();
      this._battleGame.moveUpDown(unit, Pathfinding.DIR_UP);
    }
  }

  btnUnitDownClick(_action?: Action): void {
    const unit = this._save.getSelectedUnit();
    if (unit && this.playableUnitSelected() && this._save.getPathfinding()?.validateUpDown(unit, unit.getPosition(), Pathfinding.DIR_DOWN)) {
      this._battleGame.cancelAllActions();
      this._battleGame.moveUpDown(unit, Pathfinding.DIR_DOWN);
    }
  }

  btnMapUpClick(_action?: Action): void {
    if (this._save.getSide() === UnitFaction.FACTION_PLAYER || this._save.getDebugMode()) {
      this._map.getCamera().up();
    }
  }

  btnMapDownClick(_action?: Action): void {
    if (this._save.getSide() === UnitFaction.FACTION_PLAYER || this._save.getDebugMode()) {
      this._map.getCamera().down();
    }
  }

  btnShowMapClick(_action?: Action): void {
    if (this.allowButtons()) {
      this.game().pushState(new MiniMapState(this._map.getCamera(), this._save));
    }
  }

  btnKneelClick(_action?: Action): void {
    const unit = this._save.getSelectedUnit();
    if (unit) {
      this._battleGame.kneel(unit);
    }
  }

  btnInventoryClick(_action?: Action): void {
    if (this._save.getDebugMode()) {
      for (const unit of this._save.getUnits()) {
        if (unit.getFaction() === this._save.getSide()) {
          unit.prepareNewTurn();
        }
      }
      this.updateSoldierInfo();
    }
    const unit = this._save.getSelectedUnit();
    if (this.playableUnitSelected() && (unit?.hasInventory() || this._save.getDebugMode())) {
      this._battleGame.cancelAllActions();
      this.game().pushState(new InventoryState(!this._save.getDebugMode(), this));
    }
  }

  btnCenterClick(_action?: Action): void {
    const unit = this._save.getSelectedUnit();
    if (unit && this.playableUnitSelected()) {
      this._map.getCamera().centerOnPosition(unit.getPosition());
      this._map.refreshSelectorPosition();
    }
  }

  btnNextSoldierClick(_action?: Action): void {
    if (this.allowButtons()) {
      this.selectNextPlayerUnit(true, false);
      this._map.refreshSelectorPosition();
    }
  }

  btnNextStopClick(_action?: Action): void {
    if (this.allowButtons()) {
      this.selectNextPlayerUnit(true, true);
      this._map.refreshSelectorPosition();
    }
  }

  btnPrevSoldierClick(_action?: Action): void {
    if (this.allowButtons()) {
      this.selectPreviousPlayerUnit(true);
      this._map.refreshSelectorPosition();
    }
  }

  btnShowLayersClick(_action?: Action): void {
    this._map.getCamera().toggleShowAllLayers();
    this._map.invalidate();
  }

  btnHelpClick(_action?: Action): void {
    if (this.allowButtons(true)) {
      this.game().pushState(new PauseState(OPT_BATTLESCAPE));
    }
  }

  btnEndTurnClick(_action?: Action): void {
    if (this.allowButtons()) {
      this._txtTooltip.setText("");
      this._battleGame.requestEndTurn();
    }
  }

  btnAbortClick(_action?: Action): void {
    if (this.allowButtons()) {
      this.game().pushState(new AbortMissionState(this._save, this));
    }
  }

  btnStatsClick(_action?: Action): void {
    if (this.playableUnitSelected()) {
      this._battleGame.cancelAllActions();
      const unit = this._save.getSelectedUnit();
      if (unit) {
        this.popup(new UnitInfoState(unit, this, false, false));
      }
    }
  }

  btnLeftHandItemClick(_action?: Action): void {
    if (this.playableUnitSelected()) {
      if (this._battleGame.getCurrentAction().targeting) {
        this._battleGame.cancelCurrentAction();
        return;
      }

      this._battleGame.cancelCurrentAction();
      const unit = this._save.getSelectedUnit();
      if (!unit) {
        return;
      }
      const leftHandItem = this.getLeftHandItem(unit);

      if (leftHandItem !== this.getSpecialMeleeWeapon(unit)) {
        unit.setActiveHand("STR_LEFT_HAND");
      }

      this._map.cacheUnits();
      this._map.draw();
      this.handleItemClick(leftHandItem);
    }
  }

  btnRightHandItemClick(_action?: Action): void {
    if (this.playableUnitSelected()) {
      if (this._battleGame.getCurrentAction().targeting) {
        this._battleGame.cancelCurrentAction();
        return;
      }

      this._battleGame.cancelCurrentAction();
      const unit = this._save.getSelectedUnit();
      if (!unit) {
        return;
      }
      const rightHandItem = this.getRightHandItem(unit);

      if (rightHandItem !== this.getSpecialMeleeWeapon(unit)) {
        unit.setActiveHand("STR_RIGHT_HAND");
      }

      this._map.cacheUnits();
      this._map.draw();
      this.handleItemClick(rightHandItem);
    }
  }

  btnVisibleUnitClick(action?: Action): void {
    let btnID = -1;
    const sender = action?.getSender();
    for (let i = 0; i < BattlescapeState.VISIBLE_MAX && btnID === -1; ++i) {
      if (sender === this._btnVisibleUnit[i]) {
        btnID = i;
      }
    }
    const unit = btnID === -1 ? null : this._visibleUnit[btnID];
    if (unit) {
      this._map.getCamera().centerOnPosition(unit.getPosition());
    }
  }
  btnLaunchClick(_action?: Action): void { this._battleGame.launchAction(); }
  btnPsiClick(_action?: Action): void { this._battleGame.psiButtonAction(); }

  btnReserveClick(_action?: Action): void {
    this._battleGame.setTUReserved(this._save.getTUReserved() === 0 ? 6 : 0);
  }

  btnReloadClick(_action?: Action): void {
    const unit = this._save.getSelectedUnit();
    if (this.playableUnitSelected() && unit?.checkAmmo()) {
      this.updateSoldierInfo();
    }
  }

  btnPersonalLightingClick(_action?: Action): void {
    if (this.allowButtons()) {
      this._save.getTileEngine()?.togglePersonalLighting();
    }
  }

  playableUnitSelected(): boolean {
    return this._save.getSelectedUnit() !== null && this.allowButtons();
  }

  updateSoldierInfo(checkFOV = true): void {
    for (let i = 0; i < BattlescapeState.VISIBLE_MAX; ++i) {
      this._visibleUnit[i] = null;
    }
    const unit = this._save.getSelectedUnit();
    if (!unit || !this._battleGame.playableUnitSelected()) {
      this._txtTooltip.setText("");
      this._txtTooltip.draw();
      return;
    }
    if (checkFOV) {
      this._save.getTileEngine()?.calculateFOV(unit);
    }
    let j = 0;
    for (const visibleUnit of unit.getVisibleUnits()) {
      if (j >= BattlescapeState.VISIBLE_MAX) {
        break;
      }
      this._visibleUnit[j] = visibleUnit;
      ++j;
    }
    this._txtTooltip.setText(unit ? unit.getName(this.game().getLanguage()) : "");
    this._txtTooltip.draw();
  }

  animate(): void {
    this._map.animate(true);
  }

  handleState(): void {
    this._battleGame.handleState();
  }

  setStateInterval(_interval: number): void {}

  getGame() {
    return this.game();
  }

  getMap(): Map {
    return this._map;
  }

  debug(message: string): void {
    this._txtDebug.setText(message);
    this._txtDebug.draw();
  }

  warning(message: string): void {
    this._currentTooltip = message;
    this._txtTooltip.setText(message.startsWith("STR_") ? String(this.tr(message)) : message);
    this._txtTooltip.draw();
  }

  override handle(action: Action): void {
    super.handle(action);
  }

  popup(state: State): void {
    this._popups.push(state);
  }

  finishBattle(abort: boolean, _inExitArea: number): void {
    this._save.setAborted(abort);
    this.game().popState();
  }

  showLaunchButton(_show: boolean): void {}
  showPsiButton(_show: boolean): void {}
  clearMouseScrollingState(): void {}

  getBattleGame(): BattlescapeGame {
    return this._battleGame;
  }

  saveAIMap(): void {}
  saveVoxelMap(): void {}
  saveVoxelView(): void {}

  mouseInIcons(_action?: Action): void {
    this._mouseOverIcons = true;
  }

  mouseOutIcons(_action?: Action): void {
    this._mouseOverIcons = false;
  }

  getMouseOverIcons(): boolean {
    return this._mouseOverIcons;
  }

  allowButtons(_allowSaving = false): boolean {
    return !this._battleGame.isBusy();
  }

  btnReserveKneelClick(_action?: Action): void {
    this._battleGame.setKneelReserved(!this._battleGame.getKneelReserved());
  }

  btnZeroTUsClick(_action?: Action): void {
    const unit = this._save.getSelectedUnit();
    unit?.setTimeUnits?.(0);
    this.updateSoldierInfo();
  }

  txtTooltipIn(action: Action): void {
    const tooltip = String(action.getSender() && typeof (action.getSender() as { getTooltip?: () => string }).getTooltip === "function"
      ? (action.getSender() as { getTooltip: () => string }).getTooltip()
      : "");
    if (tooltip) {
      this.warning(tooltip);
    }
  }

  txtTooltipOut(_action: Action): void {
    this._txtTooltip.setText("");
    this._txtTooltip.draw();
  }

  override resize(dX: { value: number }, dY: { value: number }): void {
    super.resize(dX, dY);
    this._map.setWidth(Options.baseXResolution);
    this._map.setHeight(Options.baseYResolution);
  }

  stopScrolling(_action?: Action): void {}

  autosave(): void {
    this._autosave = true;
  }

  selectNextPlayerUnit(checkReselect = false, setReselect = false, checkInventory = false, _checkFOV = true): void {
    if (this.allowButtons()) {
      const unit = this._save.selectNextPlayerUnit(checkReselect, setReselect, checkInventory);
      this.updateSoldierInfo(_checkFOV);
      if (unit) {
        this._map.getCamera().centerOnPosition(unit.getPosition());
      }
      this._battleGame.cancelAllActions();
      this._battleGame.getCurrentAction().actor = unit;
      this._battleGame.setupCursor();
    }
  }

  selectPreviousPlayerUnit(checkReselect = false, setReselect = false, checkInventory = false): void {
    if (this.allowButtons()) {
      const unit = this._save.selectPreviousPlayerUnit(checkReselect, setReselect, checkInventory);
      this.updateSoldierInfo();
      if (unit) {
        this._map.getCamera().centerOnPosition(unit.getPosition());
      }
      this._battleGame.cancelAllActions();
      this._battleGame.getCurrentAction().actor = unit;
      this._battleGame.setupCursor();
    }
  }

  private getLeftHandItem(unit: BattleUnit): BattleItem | null {
    const melee = this.getSpecialMeleeWeapon(unit);
    const leftHandItem = unit.getItem("STR_LEFT_HAND");
    const rightHandItem = unit.getItem("STR_RIGHT_HAND");
    if (melee && rightHandItem && !leftHandItem) {
      return melee;
    }
    return leftHandItem;
  }

  private getRightHandItem(unit: BattleUnit): BattleItem | null {
    const melee = this.getSpecialMeleeWeapon(unit);
    const rightHandItem = unit.getItem("STR_RIGHT_HAND");
    if (melee && !rightHandItem) {
      return melee;
    }
    return rightHandItem;
  }

  private getSpecialMeleeWeapon(unit: BattleUnit): BattleItem | null {
    return unit.getSpecialWeapon(BattleType.BT_MELEE);
  }

  private handleItemClick(item: BattleItem | null): void {
    if (item && !this._battleGame.isBusy()) {
      this._battleGame.getCurrentAction().weapon = item;
      this.popup(new ActionMenuState(this._battleGame.getCurrentAction(), this._icons.getX(), this._icons.getY() + 16));
    }
  }
}
