import { RNG } from "../Engine/RNG.ts";
import { BattleType, ItemDamageType } from "../Mod/RuleItem.ts";
import { SpecialAbility } from "../Mod/Unit.ts";
import type { BattleItem } from "../Savegame/BattleItem.ts";
import { UnitFaction, UnitStatus, type BattleUnit } from "../Savegame/BattleUnit.ts";
import { BattleActionType, BattlescapeGame, type BattleAction } from "./BattlescapeGame.ts";
import { BattleState } from "./BattleState.ts";
import { CursorType } from "./Map.ts";
import { ExplosionBState } from "./ExplosionBState.ts";
import { Position } from "./Position.ts";

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * A melee attack state.
 */
export class MeleeAttackBState extends BattleState {
  private _unit: BattleUnit | null = null;
  private _target: BattleUnit | null = null;
  private _weapon: BattleItem | null = null;
  private _ammo: BattleItem | null = null;
  private _voxel = new Position();
  private _initialized = false;

  constructor(parent: BattlescapeGame, action: BattleAction) {
    super(parent, action);
  }

  init(): void {
    if (this._initialized) {
      return;
    }
    this._initialized = true;

    this._weapon = this._action.weapon;
    if (!this._weapon) {
      this._parent.popState();
      return;
    }
    this._ammo = this._weapon.getAmmoItem() || this._weapon;

    const targetTile = this._parent.getSave().getTile(this._action.target);
    if (!targetTile) {
      this._parent.popState();
      return;
    }

    this._unit = this._action.actor;
    if (!this._unit ||
      this._unit.isOut() ||
      this._unit.getHealth() === 0 ||
      this._unit.getHealth() < this._unit.getStunlevel()) {
      this._parent.popState();
      return;
    }

    if (this._unit.getFaction() !== this._parent.getSave().getSide()) {
      const targetUnit = targetTile.getUnit();
      if (!this._ammo ||
        !targetUnit ||
        targetUnit.isOut() ||
        targetUnit !== this._parent.getSave().getSelectedUnit()) {
        this._unit.setTimeUnits(this._unit.getTimeUnits() + this._unit.getActionTUs(this._action.type, this._weapon));
        this._parent.popState();
        return;
      }
      this._unit.lookAt(this._action.target, this._unit.getTurretType() !== -1);
      while (this._unit.getStatus() === UnitStatus.STATUS_TURNING) {
        this._unit.turn();
      }
    }

    const ai = this._unit.getAIModule();
    if (this._unit.getFaction() === this._parent.getSave().getSide() &&
      this._unit.getFaction() !== UnitFaction.FACTION_PLAYER &&
      !BattlescapeGame._debugPlay &&
      ai?.getTarget?.()) {
      this._target = ai.getTarget?.() || null;
    } else {
      this._target = targetTile.getUnit();
    }
    if (!this._target) {
      this._parent.popState();
      return;
    }

    const height = this._target.getFloatHeight() + Math.trunc(this._target.getHeight() / 2) - targetTile.getTerrainLevel();
    this._voxel = this._action.target.multiply(new Position(16, 16, 24)).add(new Position(8, 8, height));
    this.performMeleeAttack();
  }

  think(): void {
    if (!this._unit || !this._weapon) {
      this._parent.popState();
      return;
    }

    this._parent.getSave().getBattleState()?.clearMouseScrollingState();

    const targetTile = this._parent.getSave().getTile(this._action.target);
    if (this._unit.getSpecialAbility() === SpecialAbility.SPECAB_BURNFLOOR ||
      this._unit.getSpecialAbility() === SpecialAbility.SPECAB_BURN_AND_EXPLODE) {
      targetTile?.ignite(15);
    }

    this.resolveHit();
    if (this._unit.getFaction() !== UnitFaction.FACTION_PLAYER &&
      this._unit.getFaction() === this._parent.getSave().getSide() &&
      this._unit.getTimeUnits() >= this._unit.getActionTUs(BattleActionType.BA_HIT, this._action.weapon) * 2 &&
      this._target &&
      this._target.getHealth() > 0 &&
      this._target.getHealth() > this._target.getStunlevel() &&
      this._weapon.getAmmoItem()) {
      this._unit.spendTimeUnits(this._unit.getActionTUs(BattleActionType.BA_HIT, this._weapon));
      this.performMeleeAttack();
      return;
    }

    if (this._action.cameraPosition.z !== -1) {
      this._parent.getMap().getCamera().setMapOffset(this._action.cameraPosition);
      this._parent.getMap().invalidate();
    }
    if (this._unit.getFaction() === this._parent.getSave().getSide()) {
      this._parent.getCurrentAction().type = BattleActionType.BA_NONE;
    }
    if (this._parent.getSave().getSide() === UnitFaction.FACTION_PLAYER || this._parent.getSave().getDebugMode()) {
      this._parent.setupCursor();
    }
    this._parent.convertInfected();
    this._parent.popState();
  }

  performMeleeAttack(): void {
    if (!this._unit || !this._weapon) {
      this._parent.popState();
      return;
    }
    this._unit.aim(true);
    this._unit.setCache(null);
    this._parent.getMap().cacheUnit(this._unit);

    if (!this._parent.getSave().getDebugMode() &&
      this._weapon.getRules().getBattleType() === BattleType.BT_MELEE &&
      this._ammo &&
      !this._ammo.spendBullet()) {
      this._parent.getSave().removeItem(this._ammo);
      this._weapon.setAmmoItem(null);
    }

    this._parent.getMap().setCursorType(CursorType.CT_NONE);
    this._parent.statePushFront(new ExplosionBState(this._parent, this._voxel, this._action.weapon, this._action.actor, null, true, true));
  }

  resolveHit(): void {
    if (!this._unit || !this._target || !this._weapon) {
      return;
    }
    if (!RNG.percent(this._unit.getFiringAccuracy(BattleActionType.BA_HIT, this._weapon))) {
      return;
    }

    if (this._unit.getGeoscapeSoldier() && this._target.getOriginalFaction() === UnitFaction.FACTION_HOSTILE) {
      this._unit.addMeleeExp();
    }

    if (this._weapon.getRules().getBattleType() === BattleType.BT_MELEE &&
      this._ammo &&
      this._ammo.getRules().getZombieUnit() &&
      (this._target.getGeoscapeSoldier() || this._target.getUnitRules()?.getRace() === "STR_CIVILIAN") &&
      !this._target.getSpawnUnit()) {
      this._target.setRespawn(true);
      this._target.setSpawnUnit(this._ammo.getRules().getZombieUnit());
    }

    let type = ItemDamageType.DT_STUN;
    let power = this._weapon.getRules().getMeleePower();
    if (this._weapon.getRules().getBattleType() === BattleType.BT_MELEE && this._ammo) {
      type = this._ammo.getRules().getDamageType();
      power = this._ammo.getRules().getPower();
    }
    if (this._weapon.getRules().isStrengthApplied()) {
      power += this._unit.getBaseStats().strength;
    }

    const difference = this._unit.getPosition().subtract(this._action.target);
    difference.x = clamp(difference.x, -1, 1);
    difference.y = clamp(difference.y, -1, 1);
    const damagePosition = this._voxel.add(difference);
    this._parent.getSave().getTileEngine()?.hit(damagePosition, power, type, this._unit);
    this._parent.checkForCasualties(this._ammo, this._unit);
  }
}
