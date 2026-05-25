import { Position } from "./Position.ts";
import { Options, PATH_NONE } from "../Engine/Options.ts";
import { RNG } from "../Engine/RNG.ts";
import { KMOD_CTRL } from "../types.ts";
import { ChronoTrigger } from "../Mod/AlienDeployment.ts";
import { SpecialTileType } from "../Mod/MapData.ts";
import { BattleType, ItemDamageType } from "../Mod/RuleItem.ts";
import type { BattleItem } from "../Savegame/BattleItem.ts";
import { UnitFaction, UnitStatus, type BattleUnit } from "../Savegame/BattleUnit.ts";
import type { SavedBattleGame } from "../Savegame/SavedBattleGame.ts";
import { Pathfinding } from "./Pathfinding.ts";
import type { TileEngine } from "./TileEngine.ts";
import { CursorType, type Map } from "./Map.ts";
import type { BattlescapeState } from "./BattlescapeState.ts";
import type { BattleState } from "./BattleState.ts";
import { ExplosionBState } from "./ExplosionBState.ts";
import { InfoboxState } from "./InfoboxState.ts";
import { InfoboxOKState } from "./InfoboxOKState.ts";
import { MeleeAttackBState } from "./MeleeAttackBState.ts";
import { NextTurnState } from "./NextTurnState.ts";
import { ProjectileFlyBState } from "./ProjectileFlyBState.ts";
import { PsiAttackBState } from "./PsiAttackBState.ts";
import { UnitDieBState } from "./UnitDieBState.ts";
import { UnitFallBState } from "./UnitFallBState.ts";
import { UnitPanicBState } from "./UnitPanicBState.ts";
import { UnitTurnBState } from "./UnitTurnBState.ts";
import { UnitWalkBState } from "./UnitWalkBState.ts";
import { UnitInfoState } from "./UnitInfoState.ts";
import { AIModule } from "./AIModule.ts";
import { BattleActionType, createBattleAction, type BattleAction } from "./BattleAction.ts";

export { BattleActionType, createBattleAction, type BattleAction } from "./BattleAction.ts";

/**
 * Battlescape game - the core game engine of the battlescape game.
 */
export class BattlescapeGame {
  static _debugPlay = false;

  private _states: Array<BattleState | null> = [];
  private _deleted: BattleState[] = [];
  private _playerPanicHandled = true;
  private _AIActionCounter = 0;
  private _currentAction: BattleAction = createBattleAction();
  private _AISecondMove = false;
  private _playedAggroSound = false;
  private _endTurnRequested = false;
  private _endTurnProcessed = false;
  private _infoboxQueue: InfoboxOKState[] = [];

  constructor(private _save: SavedBattleGame, private _parentState: BattlescapeState) {
    this._currentAction.actor = null;
    this._currentAction.targeting = false;
    this._currentAction.type = BattleActionType.BA_NONE;
    BattlescapeGame._debugPlay = false;
    this.cancelCurrentAction(true);
  }

  think(): void {
    const state = this._states[0];
    if (state === null) {
      this._states.shift();
      this.endTurn();
      return;
    }
    if (state) {
      state.think();
      this.getMap().invalidate();
      return;
    }
    if (this._save.getUnitsFalling()) {
      this.statePushFront(new UnitFallBState(this));
      this._save.setUnitsFalling(false);
      return;
    }
    if (this._endTurnRequested) {
      this.endTurn();
      return;
    }
    if (this._save.getSide() !== UnitFaction.FACTION_PLAYER) {
      this._save.resetUnitHitStates();
      if (!BattlescapeGame._debugPlay) {
        const selected = this._save.getSelectedUnit();
        if (selected) {
          if (!this.handlePanickingUnit(selected)) {
            this.handleAI(selected);
          }
        } else if (!this._save.selectNextPlayerUnit(true, this._AISecondMove)) {
          if (!this._save.getDebugMode()) {
            this._endTurnRequested = true;
            this.statePushBack(null);
          } else {
            this._save.selectNextPlayerUnit();
            BattlescapeGame._debugPlay = true;
          }
        }
      }
    } else if (!this._playerPanicHandled) {
      this._playerPanicHandled = this.handlePanickingPlayer();
      this._save.getBattleState()?.updateSoldierInfo();
    }
  }

  init(): void {
    if (this._save.getSide() === UnitFaction.FACTION_PLAYER && this._save.getTurn() > 1) {
      this._playerPanicHandled = false;
    }
  }

  playableUnitSelected(): boolean {
    return Boolean(this._save.getSelectedUnit() && (this._save.getSide() === UnitFaction.FACTION_PLAYER || this._save.getDebugMode()));
  }

  handleState(): void {
    this.cleanupDeleted();
  }

  statePushFront(bs: BattleState): void {
    this._states.unshift(bs);
    bs.init();
  }

  statePushNext(bs: BattleState): void {
    if (this._states.length === 0) {
      this._states.push(bs);
      bs.init();
    } else {
      this._states.splice(1, 0, bs);
    }
  }

  statePushBack(bs: BattleState | null): void {
    this._states.push(bs);
    if (this._states.length === 1) {
      if (bs === null) {
        this._states.shift();
        this.endTurn();
        return;
      }
      bs.init();
    }
  }

  handleNonTargetAction(): void {
    if (this._currentAction.targeting) {
      this.setupCursor();
      return;
    }

    this._currentAction.cameraPosition = new Position(0, 0, -1);
    if (this._currentAction.result) {
      this._parentState.warning(this._currentAction.result);
      this._currentAction.result = "";
    } else if (this._currentAction.type === BattleActionType.BA_PRIME &&
      this._currentAction.value > -1 &&
      this._currentAction.actor &&
      this._currentAction.weapon) {
      if (this._currentAction.actor.spendTimeUnits(this._currentAction.TU)) {
        this._parentState.warning("STR_GRENADE_IS_ACTIVATED");
        this._currentAction.weapon.setFuseTimer(this._currentAction.value);
      } else {
        this._parentState.warning("STR_NOT_ENOUGH_TIME_UNITS");
      }
    } else if (this._currentAction.type === BattleActionType.BA_USE) {
      this._save.reviveUnconsciousUnits();
    } else if (this._currentAction.type === BattleActionType.BA_HIT && this._currentAction.actor && this._currentAction.weapon) {
      if (this._currentAction.actor.spendTimeUnits(this._currentAction.TU)) {
        this.statePushBack(new MeleeAttackBState(this, this._currentAction));
      } else {
        this._parentState.warning("STR_NOT_ENOUGH_TIME_UNITS");
      }
    }

    if (this._currentAction.type !== BattleActionType.BA_HIT) {
      this._currentAction.type = BattleActionType.BA_NONE;
    }
    this._parentState.updateSoldierInfo();
    this.setupCursor();
  }

  popState(): void {
    const state = this._states.shift();
    if (!state) {
      return;
    }

    const action = state.getAction();
    const actionFailed = Boolean(action.actor &&
      action.result &&
      action.actor.getFaction() === UnitFaction.FACTION_PLAYER &&
      this._playerPanicHandled &&
      (this._save.getSide() === UnitFaction.FACTION_PLAYER || BattlescapeGame._debugPlay));
    if (actionFailed) {
      this._parentState.warning(action.result);
    }
    this._deleted.push(state);

    if (action.actor && this.noActionsPending(action.actor)) {
      if (action.actor.getFaction() === UnitFaction.FACTION_PLAYER) {
        if (action.targeting && this._save.getSelectedUnit() && !actionFailed) {
          action.actor.spendTimeUnits(action.TU);
        }
        if (this._save.getSide() === UnitFaction.FACTION_PLAYER) {
          if ((action.type === BattleActionType.BA_THROW || action.type === BattleActionType.BA_LAUNCH) && !actionFailed) {
            if (action.type === BattleActionType.BA_LAUNCH) {
              this._currentAction.waypoints.length = 0;
            }
            this.cancelCurrentAction(true);
          }
          this._parentState.getGame().getCursor().setVisible(true);
          this.setupCursor();
        }
      } else {
        action.actor.spendTimeUnits(action.TU);
        if (BattlescapeGame._debugPlay) {
          this._parentState.getGame().getCursor().setVisible(true);
          this.setupCursor();
        }
      }
    }

    this._states[0]?.init();

    const selectedUnit = this._save.getSelectedUnit();
    if (!selectedUnit || selectedUnit.isOut()) {
      this.cancelCurrentAction();
      this.getMap().setCursorType(CursorType.CT_NORMAL, 1);
      this._parentState.getGame().getCursor().setVisible(true);
      if (this._save.getSide() === UnitFaction.FACTION_PLAYER) {
        this._save.setSelectedUnit(null);
      } else {
        this._save.selectNextPlayerUnit(true, true);
      }
    }
    this._parentState.updateSoldierInfo();
  }

  private noActionsPending(bu: BattleUnit): boolean {
    return !this._states.some(state => state?.getAction().actor === bu);
  }

  setStateInterval(_interval: number): void {}

  checkForCasualties(murderweapon: BattleItem | null, origMurderer: BattleUnit | null, hiddenExplosion = false, terrainExplosion = false): void {
    let murderer = origMurderer;
    if (murderer &&
      !murderer.getGeoscapeSoldier() &&
      murderer.getStatus() === UnitStatus.STATUS_DEAD &&
      murderer.getMurdererId() !== 0) {
      murderer = this._save.getUnits().find(unit => unit.getId() === murderer?.getMurdererId()) || murderer;
    }

    for (const victim of this._save.getUnits()) {
      if (victim.getStatus() === UnitStatus.STATUS_IGNORE_ME) {
        continue;
      }
      let victimMurderer = murderer;
      if (!victimMurderer && !terrainExplosion && victim.getMurdererId() !== 0) {
        victimMurderer = this._save.getUnits().find(unit => unit.getId() === victim.getMurdererId()) || null;
      }

      let noSound = false;
      let noCorpse = false;
      if (victim.getStatus() !== UnitStatus.STATUS_DEAD && victim.getHealth() === 0) {
        if (victim.getStatus() === UnitStatus.STATUS_UNCONSCIOUS) {
          noCorpse = true;
        }
        if (victimMurderer) {
          victimMurderer.addKillCount();
          victim.killedBy(victimMurderer.getFaction());
          victim.setMurdererId(victimMurderer.getId());
          const modifier = victimMurderer.getFaction() === UnitFaction.FACTION_PLAYER ? this._save.getMoraleModifier() : 100;
          if ((victim.getOriginalFaction() === UnitFaction.FACTION_PLAYER && victimMurderer.getFaction() === UnitFaction.FACTION_HOSTILE) ||
            (victim.getOriginalFaction() === UnitFaction.FACTION_HOSTILE && victimMurderer.getFaction() === UnitFaction.FACTION_PLAYER)) {
            victimMurderer.moraleChange(Math.trunc(20 * modifier / 100));
          }
          if (victim.getOriginalFaction() === victimMurderer.getOriginalFaction()) {
            victimMurderer.moraleChange(-Math.trunc(2000 / modifier));
          }
          if (victim.getOriginalFaction() === UnitFaction.FACTION_NEUTRAL) {
            victimMurderer.moraleChange(victimMurderer.getOriginalFaction() === UnitFaction.FACTION_PLAYER ? -Math.trunc(1000 / modifier) : 10);
          }
        }

        if (victim.getFaction() !== UnitFaction.FACTION_NEUTRAL) {
          const modifier = this._save.getMoraleModifier(victim);
          const loserMod = victim.getFaction() === UnitFaction.FACTION_HOSTILE ? 100 : this._save.getMoraleModifier();
          const winnerMod = victim.getFaction() === UnitFaction.FACTION_HOSTILE ? this._save.getMoraleModifier() : 100;
          for (const unit of this._save.getUnits()) {
            if (!unit.isOut() && unit.getArmor().getSize() === 1) {
              if (unit.getOriginalFaction() === victim.getOriginalFaction()) {
                const bravery = Math.trunc((110 - unit.getBaseStats().bravery) / 10);
                unit.moraleChange(-Math.trunc(modifier * 200 * bravery / loserMod / 100));
                if (victim.getFaction() === UnitFaction.FACTION_HOSTILE && victimMurderer) {
                  victimMurderer.setTurnsSinceSpotted(0);
                }
              } else {
                unit.moraleChange(Math.trunc(10 * winnerMod / 100));
              }
            }
          }
        }

        let damageType = ItemDamageType.DT_NONE;
        if (murderweapon) {
          damageType = murderweapon.getRules().getDamageType();
        } else if (hiddenExplosion || terrainExplosion) {
          damageType = ItemDamageType.DT_HE;
          noSound = hiddenExplosion;
        }
        this.statePushNext(new UnitDieBState(this, victim, damageType, noSound, noCorpse));
        if (victim.getGeoscapeSoldier()) {
          victim.getStatistics().KIA = true;
        }
      } else if (victim.getStunlevel() >= victim.getHealth() && victim.getStatus() !== UnitStatus.STATUS_UNCONSCIOUS) {
        if (victim.getGeoscapeSoldier()) {
          victim.getStatistics().wasUnconcious = true;
        }
        noSound = true;
        this.statePushNext(new UnitDieBState(this, victim, ItemDamageType.DT_STUN, noSound, noCorpse));
      }
    }
  }

  checkReservedTU(bu: BattleUnit, tu: number, justChecking = false): boolean {
    return this._save.checkReservedTU(bu, tu, justChecking);
  }

  handleAI(unit: BattleUnit): void {
    if (unit.getTimeUnits() <= 5) {
      unit.dontReselect();
    }
    if (this._AIActionCounter >= 2 || !unit.reselectAllowed()) {
      if (!this._save.selectNextPlayerUnit(true, this._AISecondMove)) {
        if (!this._save.getDebugMode()) {
          this._endTurnRequested = true;
          this.statePushBack(null);
        } else {
          this._save.selectNextPlayerUnit();
          BattlescapeGame._debugPlay = true;
        }
      }
      const selected = this._save.getSelectedUnit();
      if (selected) {
        this._parentState.updateSoldierInfo();
        this.getMap().getCamera().centerOnPosition(selected.getPosition());
        if (selected.getId() <= unit.getId()) {
          this._AISecondMove = true;
        }
      }
      this._AIActionCounter = 0;
      return;
    }

    unit.setVisible(false);
    this._save.getTileEngine()?.calculateFOV(unit.getPosition());

    if (!unit.getAIModule()) {
      unit.setAIModule(new AIModule(this._save, unit, null));
    }
    this._AIActionCounter++;
    if (this._AIActionCounter === 1) {
      this._playedAggroSound = false;
      unit.setHiding(false);
    }

    const action = createBattleAction();
    action.actor = unit;
    action.number = this._AIActionCounter;
    unit.think(action);

    if (action.type === BattleActionType.BA_RETHINK) {
      this._parentState.debug("Rethink");
      unit.think(action);
    }

    this._AIActionCounter = action.number;
    const weapon = unit.getMainHandWeapon();
    if (!weapon || !weapon.getAmmoItem()) {
      if (unit.getOriginalFaction() === UnitFaction.FACTION_HOSTILE && unit.getVisibleUnits().length === 0) {
        this.findItem(action);
      }
    }

    if (action.type === BattleActionType.BA_WALK) {
      this._parentState.debug(`Walking to ${action.target}`);
      if (this._save.getTile(action.target)) {
        this._save.getPathfinding()?.calculate(action.actor!, action.target);
      }
      if ((this._save.getPathfinding()?.getStartDirection() ?? -1) !== -1) {
        this.statePushBack(new UnitWalkBState(this, action));
      }
    }

    if (action.type === BattleActionType.BA_SNAPSHOT ||
      action.type === BattleActionType.BA_AUTOSHOT ||
      action.type === BattleActionType.BA_AIMEDSHOT ||
      action.type === BattleActionType.BA_THROW ||
      action.type === BattleActionType.BA_HIT ||
      action.type === BattleActionType.BA_MINDCONTROL ||
      action.type === BattleActionType.BA_PANIC ||
      action.type === BattleActionType.BA_LAUNCH) {
      this._parentState.debug(`Attack type=${action.type} target=${action.target} weapon=${action.weapon?.getRules().getName() || ""}`);
      action.TU = unit.getActionTUs(action.type, action.weapon);
      if (action.type === BattleActionType.BA_MINDCONTROL || action.type === BattleActionType.BA_PANIC) {
        this.statePushBack(new PsiAttackBState(this, action));
      } else {
        this.statePushBack(new UnitTurnBState(this, action));
        if (action.type === BattleActionType.BA_HIT) {
          action.weapon = unit.getMeleeWeapon();
          this.statePushBack(new MeleeAttackBState(this, action));
        } else {
          this.statePushBack(new ProjectileFlyBState(this, action));
        }
      }
    }

    if (action.type === BattleActionType.BA_NONE) {
      this._parentState.debug("Idle");
      this._AIActionCounter = 0;
      if (!this._save.selectNextPlayerUnit(true, this._AISecondMove)) {
        if (!this._save.getDebugMode()) {
          this._endTurnRequested = true;
          this.statePushBack(null);
        } else {
          this._save.selectNextPlayerUnit();
          BattlescapeGame._debugPlay = true;
        }
      }
      const selected = this._save.getSelectedUnit();
      if (selected) {
        this._parentState.updateSoldierInfo();
        this.getMap().getCamera().centerOnPosition(selected.getPosition());
        if (selected.getId() <= unit.getId()) {
          this._AISecondMove = true;
        }
      }
    }
  }

  dropItem(position: Position, item: BattleItem, newItem = false, removeItem = false): void {
    this.getTileEngine()?.itemDrop(this._save.getTile(position), item, this.getMod(), newItem, removeItem);
  }

  handlePanickingPlayer(): boolean {
    for (const unit of this._save.getUnits()) {
      if (unit.getFaction() === UnitFaction.FACTION_PLAYER &&
        unit.getOriginalFaction() === UnitFaction.FACTION_PLAYER &&
        this.handlePanickingUnit(unit)) {
        return false;
      }
    }
    return true;
  }

  handlePanickingUnit(unit: BattleUnit): boolean {
    const status = unit.getStatus();
    if (status !== UnitStatus.STATUS_PANICKING && status !== UnitStatus.STATUS_BERSERK) {
      return false;
    }

    this._save.setSelectedUnit(unit);
    this._parentState.getMap().setCursorType(CursorType.CT_NONE);
    if (unit.getVisible() || !Options.noAlienPanicMessages) {
      this.getMap().getCamera().centerOnPosition(unit.getPosition());
      const game = this._parentState.getGame();
      const message = status === UnitStatus.STATUS_PANICKING
        ? game.getLanguage().getString("STR_HAS_PANICKED", unit.getGender()).arg(unit.getName(game.getLanguage()))
        : game.getLanguage().getString("STR_HAS_GONE_BERSERK", unit.getGender()).arg(unit.getName(game.getLanguage()));
      game.pushState(new InfoboxState(String(message)));
    }

    const ba = createBattleAction();
    ba.actor = unit;
    if (status === UnitStatus.STATUS_PANICKING && RNG.generate(0, 100) <= 50) {
      let item = unit.getItem("STR_RIGHT_HAND");
      if (item) {
        this.dropItem(unit.getPosition(), item, false, true);
      }
      item = unit.getItem("STR_LEFT_HAND");
      if (item) {
        this.dropItem(unit.getPosition(), item, false, true);
      }
      unit.setCache(null);
      for (let i = 0; i < 20; ++i) {
        ba.target = new Position(unit.getPosition().x + RNG.generate(-5, 5), unit.getPosition().y + RNG.generate(-5, 5), unit.getPosition().z);
        if (i >= 10 && ba.target.z > 0) {
          ba.target.z--;
          if (i >= 15 && ba.target.z > 0) {
            ba.target.z--;
          }
        }
        if (this._save.getTile(ba.target)) {
          this._save.getPathfinding()?.calculate(unit, ba.target);
          if ((this._save.getPathfinding()?.getStartDirection() ?? -1) !== -1) {
            this.statePushBack(new UnitWalkBState(this, ba));
            break;
          }
        }
      }
    }

    this.statePushBack(new UnitPanicBState(this, ba.actor));
    unit.moraleChange(+15);
    return true;
  }

  convertUnit(unit: BattleUnit): BattleUnit {
    this.getSave().getBattleState()?.showPsiButton(false);
    const mod = this.getMod();
    if (!mod) {
      throw new Error("Cannot convert unit without loaded mod rules.");
    }
    const newUnit = this.getSave().convertUnit(unit, this._parentState.getGame().getSavedGame(), mod);
    this.getMap().cacheUnit(newUnit);
    return newUnit;
  }

  kneel(bu: BattleUnit): boolean {
    const tu = bu.isKneeled() ? 8 : 4;
    if (bu.getType() === "SOLDIER" && !bu.isFloating() && ((!bu.isKneeled() && this._save.getKneelReserved()) || this.checkReservedTU(bu, tu))) {
      if (bu.spendTimeUnits?.(tu)) {
        bu.kneel(!bu.isKneeled());
        this.getTileEngine()?.calculateFOV(bu);
        this.getMap().cacheUnits();
        this._parentState.updateSoldierInfo();
        this.getTileEngine()?.checkReactionFire(bu);
        return true;
      }
      this._parentState.warning("STR_NOT_ENOUGH_TIME_UNITS");
    }
    return false;
  }

  cancelCurrentAction(_bForce = false): boolean {
    if (this._save.getPathfinding()?.removePreview()) {
      return true;
    }
    if (this._currentAction.targeting &&
      this._currentAction.type === BattleActionType.BA_LAUNCH &&
      this._currentAction.waypoints.length > 0 &&
      !_bForce) {
      this._currentAction.waypoints.pop();
      this.getMap().getWaypoints().pop();
      if (this._currentAction.waypoints.length === 0) {
        this._parentState.showLaunchButton(false);
      }
      return true;
    }
    if (this._currentAction.targeting &&
      Options.battleConfirmFireMode &&
      this._currentAction.waypoints.length > 0 &&
      !_bForce) {
      this._currentAction.waypoints.pop();
      this.getMap().getWaypoints().pop();
      return true;
    }
    const actor = this._save.getSelectedUnit();
    this._currentAction = createBattleAction();
    this._currentAction.actor = actor;
    this.getMap().getWaypoints().length = 0;
    this._parentState.showLaunchButton(false);
    this.setupCursor();
    this._parentState.getGame().getCursor().setVisible(true);
    return true;
  }

  cancelAllActions(): void {
    this._save.getPathfinding()?.removePreview();
    const actor = this._save.getSelectedUnit();
    this._currentAction = createBattleAction();
    this._currentAction.actor = actor;
    this.getMap().getWaypoints().length = 0;
    this._parentState.showLaunchButton(false);
    this.setupCursor();
    this._parentState.getGame().getCursor().setVisible(true);
    this._states = [];
  }

  getCurrentAction(): BattleAction {
    return this._currentAction;
  }

  isBusy(): boolean {
    return this._states.length > 0;
  }

  primaryAction(pos: Position): void {
    let bPreviewed = Options.battleNewPreviewPath !== PATH_NONE;
    this.getMap().resetObstacles();
    if (this._currentAction.targeting && this._save.getSelectedUnit()) {
      if (this._currentAction.type === BattleActionType.BA_LAUNCH &&
        this._currentAction.weapon) {
        let maxWaypoints = this._currentAction.weapon.getRules().getWaypoints();
        if (maxWaypoints === 0) {
          maxWaypoints = this._currentAction.weapon.getAmmoItem()?.getRules().getWaypoints() || 0;
        }
        if (this._currentAction.waypoints.length < maxWaypoints || maxWaypoints === -1) {
          this._parentState.showLaunchButton(true);
          this._currentAction.waypoints.push(pos.clone());
          this.getMap().getWaypoints().push(pos.clone());
        }
        return;
      }

      if (this._currentAction.type === BattleActionType.BA_USE &&
        this._currentAction.weapon?.getRules().getBattleType() === BattleType.BT_MINDPROBE) {
        const targetUnit = this._save.selectUnit(pos);
        const selectedUnit = this._save.getSelectedUnit();
        if (targetUnit &&
          selectedUnit &&
          targetUnit.getFaction() !== selectedUnit.getFaction() &&
          targetUnit.getVisible() &&
          this._currentAction.actor &&
          this._currentAction.weapon) {
          if (!this._currentAction.weapon.getRules().isLOSRequired() ||
            this._currentAction.actor.getVisibleUnits().includes(targetUnit)) {
            if (this._currentAction.actor.spendTimeUnits(this._currentAction.TU)) {
              this._parentState.getGame().pushState(new UnitInfoState(targetUnit, this._parentState, false, true));
              this.cancelCurrentAction();
            } else {
              this._parentState.warning("STR_NOT_ENOUGH_TIME_UNITS");
            }
          } else {
            this._parentState.warning("STR_NO_LINE_OF_FIRE");
          }
        }
        return;
      }

      if (this._currentAction.type === BattleActionType.BA_PANIC ||
        this._currentAction.type === BattleActionType.BA_MINDCONTROL) {
        const targetUnit = this._save.selectUnit(pos);
        if (targetUnit &&
          targetUnit.getFaction() !== this._save.getSelectedUnit()?.getFaction() &&
          targetUnit.getVisible() &&
          this._currentAction.actor &&
          this._currentAction.weapon) {
          this._currentAction.TU = this._currentAction.actor.getActionTUs(this._currentAction.type, this._currentAction.weapon);
          this._currentAction.target = pos.clone();
          if (!this._currentAction.weapon.getRules().isLOSRequired() ||
            this._currentAction.actor.getVisibleUnits().includes(targetUnit)) {
            this.getMap().setCursorType(CursorType.CT_NONE);
            this._parentState.getGame().getCursor().setVisible(false);
            this._currentAction.cameraPosition = this.getMap().getCamera().getMapOffset();
            this.statePushBack(new PsiAttackBState(this, this._currentAction));
          } else {
            this._parentState.warning("STR_NO_LINE_OF_FIRE");
          }
        }
        return;
      }

      if (Options.battleConfirmFireMode &&
        (this._currentAction.waypoints.length === 0 || !pos.equals(this._currentAction.waypoints[0]))) {
        this._currentAction.waypoints.length = 0;
        this._currentAction.waypoints.push(pos.clone());
        this.getMap().getWaypoints().length = 0;
        this.getMap().getWaypoints().push(pos.clone());
        return;
      }

      if (!this._currentAction.actor || !this._currentAction.weapon) {
        return;
      }
      this._currentAction.target = pos.clone();
      this.getMap().setCursorType(CursorType.CT_NONE);
      if (Options.battleConfirmFireMode) {
        this._currentAction.waypoints.length = 0;
        this.getMap().getWaypoints().length = 0;
      }
      this._parentState.getGame().getCursor().setVisible(false);
      this._currentAction.cameraPosition = this.getMap().getCamera().getMapOffset();
      this._states.push(new ProjectileFlyBState(this, this._currentAction));
      this.statePushFront(new UnitTurnBState(this, this._currentAction));
      return;
    }

    this._currentAction.actor = this._save.getSelectedUnit();
    const unit = this._save.selectUnit(pos);
    if (unit && unit !== this._save.getSelectedUnit() && (unit.getVisible() || BattlescapeGame._debugPlay)) {
      if (unit.getFaction() === this._save.getSide()) {
        this._save.setSelectedUnit(unit);
        this._parentState.updateSoldierInfo();
        this.cancelCurrentAction();
        this.setupCursor();
        this._currentAction.actor = unit;
      }
      return;
    }

    if (!this.playableUnitSelected() || !this._currentAction.actor) {
      return;
    }

    const modifierPressed = (Options.getKeyModifiers() & KMOD_CTRL) !== 0;
    const pathfinding = this._save.getPathfinding();
    if (!pathfinding) {
      return;
    }
    if (bPreviewed &&
      (!this._currentAction.target.equals(pos) || pathfinding.isModifierUsed() !== modifierPressed)) {
      pathfinding.removePreview();
    }
    this._currentAction.target = pos.clone();
    pathfinding.calculate(this._currentAction.actor, this._currentAction.target);
    this._currentAction.run = false;
    this._currentAction.strafe = Options.strafe && modifierPressed && this._save.getSelectedUnit()?.getArmor().getSize() === 1;
    if (this._currentAction.strafe && pathfinding.getPath().length > 1) {
      this._currentAction.run = true;
      this._currentAction.strafe = false;
    }
    if (bPreviewed && !pathfinding.previewPath() && pathfinding.getStartDirection() !== -1) {
      pathfinding.removePreview();
      bPreviewed = false;
    }
    if (!bPreviewed && pathfinding.getStartDirection() !== -1) {
      this.getMap().setCursorType(CursorType.CT_NONE);
      this._parentState.getGame().getCursor().setVisible(false);
      this.statePushBack(new UnitWalkBState(this, this._currentAction));
    }
  }

  secondaryAction(pos: Position): void {
    this._currentAction.target = pos.clone();
    this._currentAction.actor = this._save.getSelectedUnit();
    this._currentAction.strafe = Options.strafe && (Options.getKeyModifiers() & KMOD_CTRL) !== 0 && (this._save.getSelectedUnit()?.getTurretType?.() ?? -1) > -1;
    if (this._currentAction.actor) {
      this.statePushBack(new UnitTurnBState(this, this._currentAction));
    }
  }

  launchAction(): void {
    if (this._currentAction.waypoints.length === 0) {
      return;
    }
    this._parentState.showLaunchButton(false);
    this.getMap().getWaypoints().length = 0;
    this._currentAction.target = this._currentAction.waypoints[0].clone();
    this.getMap().setCursorType(CursorType.CT_NONE);
    this._parentState.getGame().getCursor().setVisible(false);
    this._currentAction.cameraPosition = this.getMap().getCamera().getMapOffset();
    this._states.push(new ProjectileFlyBState(this, this._currentAction));
    this.statePushFront(new UnitTurnBState(this, this._currentAction));
  }

  psiButtonAction(): void {
    if (this._currentAction.waypoints.length !== 0) {
      return;
    }
    const selectedUnit = this._save.getSelectedUnit();
    const psiWeapon = selectedUnit?.getSpecialWeapon(BattleType.BT_PSIAMP) || null;
    if (!selectedUnit || !psiWeapon) {
      return;
    }
    this._currentAction.weapon = psiWeapon;
    this._currentAction.actor = selectedUnit;
    this._currentAction.targeting = true;
    this._currentAction.type = BattleActionType.BA_PANIC;
    this._currentAction.TU = selectedUnit.getActionTUs(this._currentAction.type, psiWeapon);
    this.setupCursor();
  }

  moveUpDown(unit: BattleUnit, dir: number): void {
    this._currentAction.actor = unit;
    this._currentAction.target = unit.getPosition().clone();
    if (dir === Pathfinding.DIR_UP) {
      this._currentAction.target.z++;
    } else {
      this._currentAction.target.z--;
    }
    this.getMap().setCursorType(CursorType.CT_NONE);
    this._parentState.getGame().getCursor().setVisible(false);
    const selectedUnit = this._save.getSelectedUnit();
    if (selectedUnit?.isKneeled()) {
      this.kneel(selectedUnit);
    }
    this.getPathfinding()?.calculate(this._currentAction.actor, this._currentAction.target);
    this.statePushBack(new UnitWalkBState(this, this._currentAction));
  }

  requestEndTurn(): void {
    this.cancelCurrentAction();
    if (!this._endTurnRequested) {
      this._endTurnRequested = true;
      this.statePushBack(null);
    }
  }

  endTurn(): void {
    BattlescapeGame._debugPlay = false;
    this._currentAction.type = BattleActionType.BA_NONE;
    this.getMap().getWaypoints().length = 0;
    this._currentAction.waypoints.length = 0;
    this._parentState.showLaunchButton(false);
    this._currentAction.targeting = false;
    this._AISecondMove = false;

    if (!this._endTurnProcessed) {
      this.getTileEngine()?.closeUfoDoors();

      if (this._save.getSide() !== UnitFaction.FACTION_NEUTRAL) {
        for (const tile of this._save.getTiles()) {
          for (const item of [...tile.getInventory()]) {
            if (item.getRules().getBattleType() === BattleType.BT_GRENADE && item.getFuseTimer() === 0) {
              const position = tile.getPosition();
              const center = new Position(position.x * 16 + 8, position.y * 16 + 8, position.z * 24 - tile.getTerrainLevel());
              this.statePushNext(new ExplosionBState(this, center, item, item.getPreviousOwner()));
              this._save.removeItem(item);
              this.statePushBack(null);
              return;
            }
          }
        }
      }
    }

    let terrainExplosion = this.getTileEngine()?.checkForTerrainExplosions() || null;
    if (terrainExplosion) {
      this.statePushNext(new ExplosionBState(
        this,
        terrainExplosion.getPosition().multiply(new Position(16, 16, 24)),
        null,
        null,
        terrainExplosion
      ));
      this.statePushBack(null);
      return;
    }

    if (!this._endTurnProcessed) {
      if (this._save.getSide() !== UnitFaction.FACTION_NEUTRAL) {
        for (const item of this._save.getItems()) {
          const battleType = item.getRules().getBattleType();
          if ((battleType === BattleType.BT_GRENADE || battleType === BattleType.BT_PROXIMITYGRENADE) && item.getFuseTimer() > 0) {
            item.setFuseTimer(item.getFuseTimer() - 1);
          }
        }
      }

      this._save.endTurn();
      terrainExplosion = this.getTileEngine()?.checkForTerrainExplosions() || null;
      if (terrainExplosion) {
        this.statePushNext(new ExplosionBState(
          this,
          terrainExplosion.getPosition().multiply(new Position(16, 16, 24)),
          null,
          null,
          terrainExplosion
        ));
        this.statePushBack(null);
        this._endTurnProcessed = true;
        return;
      }
    }

    this._endTurnProcessed = false;
    if (this._save.getSide() === UnitFaction.FACTION_PLAYER) {
      this.setupCursor();
    } else {
      this.getMap().setCursorType(CursorType.CT_NONE);
    }

    this.checkForCasualties(null, null, false, false);
    this._save.getTileEngine()?.calculateUnitLighting();

    const liveAliens = { value: 0 };
    const liveSoldiers = { value: 0 };
    this.tallyUnits(liveAliens, liveSoldiers);
    let inExit = 0;
    for (const unit of this._save.getUnits()) {
      if (!unit.isOut() && unit.getOriginalFaction() === UnitFaction.FACTION_PLAYER && unit.isInExitArea(SpecialTileType.END_POINT)) {
        inExit++;
      }
    }

    if (this._save.allObjectivesDestroyed() && this._save.getObjectiveType() === SpecialTileType.MUST_DESTROY) {
      this._parentState.finishBattle(false, liveSoldiers.value);
      return;
    }
    if (this._save.getTurnLimit() > 0 && this._save.getTurn() > this._save.getTurnLimit()) {
      switch (this._save.getChronoTrigger()) {
        case ChronoTrigger.FORCE_ABORT:
          this._save.setAborted(true);
          this._parentState.finishBattle(true, inExit);
          return;
        case ChronoTrigger.FORCE_WIN:
          this._parentState.finishBattle(false, liveSoldiers.value);
          return;
        case ChronoTrigger.FORCE_LOSE:
        default:
          this._save.setAborted(true);
          this._parentState.finishBattle(false, 0);
          return;
      }
    }

    if (liveAliens.value > 0 && liveSoldiers.value > 0) {
      this.showInfoBoxQueue();
      this._parentState.updateSoldierInfo();
      if (this.playableUnitSelected()) {
        const selected = this._save.getSelectedUnit();
        if (selected) {
          this.getMap().getCamera().centerOnPosition(selected.getPosition());
        }
        this.setupCursor();
      }
    }
    const battleComplete = liveAliens.value === 0 || liveSoldiers.value === 0;
    if ((this._save.getSide() !== UnitFaction.FACTION_NEUTRAL || battleComplete) && this._endTurnRequested) {
      this._parentState.getGame().pushState(new NextTurnState(this._save, this._parentState));
    }
    this._endTurnRequested = false;
  }

  setTUReserved(tur: BattleActionType): void {
    this._save.setTUReserved(tur);
  }

  setupCursor(): void {
    if (this._currentAction.targeting) {
      if (this._currentAction.type === BattleActionType.BA_THROW) {
        this.getMap().setCursorType(CursorType.CT_THROW);
      } else if (this._currentAction.type === BattleActionType.BA_MINDCONTROL ||
        this._currentAction.type === BattleActionType.BA_PANIC ||
        this._currentAction.type === BattleActionType.BA_USE) {
        this.getMap().setCursorType(CursorType.CT_PSI);
      } else if (this._currentAction.type === BattleActionType.BA_LAUNCH) {
        this.getMap().setCursorType(CursorType.CT_WAYPOINT);
      } else {
        this.getMap().setCursorType(CursorType.CT_AIM);
      }
    } else if (this._currentAction.type !== BattleActionType.BA_HIT) {
      this._currentAction.actor = this._save.getSelectedUnit();
      this.getMap().setCursorType(CursorType.CT_NORMAL, this._currentAction.actor?.getArmor().getSize() || 1);
    }
  }

  getMap(): Map {
    return this._parentState.getMap();
  }

  getSave(): SavedBattleGame {
    return this._save;
  }

  getTileEngine(): TileEngine | null {
    return this._save.getTileEngine();
  }

  getPathfinding(): Pathfinding | null {
    return this._save.getPathfinding();
  }

  getMod() {
    return this._parentState.getGame().getMod();
  }

  getPanicHandled(): boolean {
    return this._playerPanicHandled;
  }

  findItem(_action: BattleAction): void {}

  surveyItems(_action: BattleAction): BattleItem | null {
    return null;
  }

  worthTaking(_item: BattleItem, _action: BattleAction): boolean {
    return false;
  }

  takeItemFromGround(_item: BattleItem, _action: BattleAction): number {
    return 0;
  }

  takeItem(_item: BattleItem, _action: BattleAction): boolean {
    return false;
  }

  getReservedAction(): BattleActionType {
    return this._save.getTUReserved();
  }

  tallyUnits(liveAliens: { value: number }, liveSoldiers: { value: number }): void {
    liveAliens.value = 0;
    liveSoldiers.value = 0;
    for (const unit of this._save.getUnits()) {
      if (unit.isOut()) {
        continue;
      }
      if (unit.getOriginalFaction() === UnitFaction.FACTION_HOSTILE) {
        if (!Options.allowPsionicCapture || unit.getFaction() !== UnitFaction.FACTION_PLAYER || !unit.getCapturable()) {
          liveAliens.value++;
        }
      } else if (unit.getOriginalFaction() === UnitFaction.FACTION_PLAYER) {
        if (unit.getFaction() === UnitFaction.FACTION_PLAYER) {
          liveSoldiers.value++;
        } else {
          liveAliens.value++;
        }
      }
    }
  }

  convertInfected(): boolean {
    let converted = false;
    for (const unit of [...this._save.getUnits()]) {
      if (unit.getHealth() > 0 && unit.getHealth() >= unit.getStunlevel() && unit.getRespawn()) {
        converted = true;
        unit.setRespawn(false);
        this.convertUnit(unit);
      }
    }
    return converted;
  }

  setKneelReserved(reserved: boolean): void {
    this._save.setKneelReserved(reserved);
  }

  getKneelReserved(): boolean {
    return this._save.getKneelReserved();
  }

  checkForProximityGrenades(_unit: BattleUnit): boolean {
    return false;
  }

  cleanupDeleted(): void {
    this._deleted.length = 0;
  }

  getDepth(): number {
    return this._save.getDepth();
  }

  showInfoBoxQueue(): void {
    for (const state of this._infoboxQueue) {
      this._parentState.getGame().pushState(state);
    }
    this._infoboxQueue.length = 0;
  }

  missionComplete(): void {
    const game = this._parentState.getGame();
    const missionComplete = game.getMod()?.getDeployment(this._save.getMissionType())?.getObjectivePopup() || "";
    if (missionComplete) {
      this._infoboxQueue.push(new InfoboxOKState(String(game.getLanguage().getString(missionComplete))));
    }
  }

  getStates(): Array<BattleState | null> {
    return this._states;
  }

  autoEndBattle(): void {}
}
