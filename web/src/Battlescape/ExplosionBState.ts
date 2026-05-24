import { RNG } from "../Engine/RNG.ts";
import { BattleType, ItemDamageType } from "../Mod/RuleItem.ts";
import { SpecialAbility } from "../Mod/Unit.ts";
import type { BattleItem } from "../Savegame/BattleItem.ts";
import type { BattleUnit } from "../Savegame/BattleUnit.ts";
import type { Tile } from "../Savegame/Tile.ts";
import { BattleState } from "./BattleState.ts";
import type { BattlescapeGame } from "./BattlescapeGame.ts";
import { BattlescapeState } from "./BattlescapeState.ts";
import { Explosion } from "./Explosion.ts";
import { Position, type PositionLike } from "./Position.ts";

/**
 * Animates and resolves a battlescape hit or explosion.
 */
export class ExplosionBState extends BattleState {
  private _unit: BattleUnit | null;
  private _center: Position;
  private _item: BattleItem | null;
  private _tile: Tile | null;
  private _power = 0;
  private _areaOfEffect = false;
  private _initialized = false;
  private _finished = false;

  constructor(
    parent: BattlescapeGame,
    center: PositionLike,
    item: BattleItem | null,
    unit: BattleUnit | null,
    tile: Tile | null = null,
    private _lowerWeapon = false,
    private _cosmetic = false
  ) {
    super(parent);
    this._unit = unit;
    this._center = Position.from(center);
    this._item = item;
    this._tile = tile;
  }

  init(): void {
    if (this._initialized) {
      return;
    }
    this._initialized = true;

    const itemRules = this._item?.getRules() || null;
    if (itemRules) {
      this._power = itemRules.getPower();
      if (itemRules.isStrengthApplied() && this._unit) {
        this._power += this._unit.getBaseStats().strength;
      }
      this._areaOfEffect = itemRules.getBattleType() !== BattleType.BT_MELEE &&
        itemRules.getExplosionRadius() !== 0 &&
        !this._cosmetic;
    } else if (this._tile) {
      this._power = this._tile.getExplosive();
      this._areaOfEffect = true;
    } else if (this._unit &&
      (this._unit.getSpecialAbility() === SpecialAbility.SPECAB_EXPLODEONDEATH ||
        this._unit.getSpecialAbility() === SpecialAbility.SPECAB_BURN_AND_EXPLODE)) {
      this._power = this._parent.getMod()?.getItem(this._unit.getArmor().getCorpseGeoscape(), true)?.getPower() || 120;
      this._areaOfEffect = true;
    } else {
      this._power = 120;
      this._areaOfEffect = true;
    }

    const map = this._parent.getMap();
    const tilePosition = this._center.divide(new Position(16, 16, 24));
    const tile = this._parent.getSave().getTile(tilePosition);
    if (this._areaOfEffect) {
      if (!this._power) {
        this._parent.popState();
        return;
      }
      let frame = itemRules?.getHitAnimation() ?? 0;
      if (frame < 0) {
        frame = 0;
      }
      let frameDelay = 0;
      const counter = Math.max(1, Math.trunc((this._power / 5) / 5));
      const lowerLimit = Math.max(1, Math.trunc(this._power / 5));
      map.setBlastFlash(true);
      for (let i = 0; i < lowerLimit; ++i) {
        const p = this._center.add(new Position(
          RNG.generate(-Math.trunc(this._power / 2), Math.trunc(this._power / 2)),
          RNG.generate(-Math.trunc(this._power / 2), Math.trunc(this._power / 2)),
          0
        ));
        map.getExplosions().push(new Explosion(p, frame, frameDelay, true));
        if (i > 0 && i % counter === 0) {
          frameDelay++;
        }
      }
      this._parent.setStateInterval(Math.trunc(BattlescapeState.DEFAULT_ANIM_SPEED / 2));
      if (tile) {
        map.getCamera().centerOnPosition(tile.getPosition(), false);
      }
      map.invalidate();
      return;
    }

    this._parent.setStateInterval(Math.max(1, Math.trunc((BattlescapeState.DEFAULT_ANIM_SPEED / 2) - (10 * (itemRules?.getExplosionSpeed() || 0)))));
    let anim = itemRules?.getHitAnimation() ?? -1;
    if (this._cosmetic) {
      anim = itemRules?.getMeleeAnimation() ?? anim;
    }
    if (anim !== -1) {
      map.getExplosions().push(new Explosion(this._center, anim, 0, false, this._cosmetic));
    }
    map.getCamera().setViewLevel(Math.trunc(this._center.z / 24));
    if (this._cosmetic && this._parent.getSave().getSide() !== tile?.getUnit()?.getFaction() && tile) {
      map.getCamera().centerOnPosition(tile.getPosition(), false);
    }
    map.invalidate();
  }

  think(): void {
    const map = this._parent.getMap();
    if (map.getBlastFlash()) {
      map.setBlastFlash(false);
      return;
    }
    const explosions = map.getExplosions();
    if (explosions.length === 0) {
      this.explode();
      return;
    }
    for (let i = explosions.length - 1; i >= 0; --i) {
      if (!explosions[i].animate()) {
        explosions.splice(i, 1);
      }
    }
    map.invalidate();
    if (explosions.length === 0) {
      this.explode();
    }
  }

  cancel(): void {}

  private explode(): void {
    if (this._finished) {
      return;
    }
    this._finished = true;

    const save = this._parent.getSave();
    const engine = save.getTileEngine();
    if (!engine) {
      this._parent.popState();
      return;
    }

    let terrainExplosion = false;
    if (this._item) {
      if (!this._unit && this._item.getPreviousOwner()) {
        this._unit = this._item.getPreviousOwner();
      }
      let victim: BattleUnit | null = null;
      const rules = this._item.getRules();
      if (this._areaOfEffect) {
        engine.explode(this._center, this._power, rules.getDamageType(), rules.getExplosionRadius(), this._unit);
      } else if (!this._cosmetic) {
        victim = engine.hit(this._center, this._power, rules.getDamageType(), this._unit);
      }
      if (rules.getZombieUnit() &&
        victim &&
        victim.getArmor().getSize() === 1 &&
        (victim.getGeoscapeSoldier() || victim.getUnitRules()?.getRace() === "STR_CIVILIAN") &&
        !victim.getSpawnUnit()) {
        victim.setRespawn(true);
        victim.setSpawnUnit(rules.getZombieUnit());
      }
    }

    if (this._tile) {
      let damageType = ItemDamageType.DT_SMOKE;
      switch (this._tile.getExplosiveType()) {
        case 0:
          damageType = ItemDamageType.DT_HE;
          break;
        case 5:
          damageType = ItemDamageType.DT_IN;
          break;
        case 6:
          damageType = ItemDamageType.DT_STUN;
          break;
        default:
          damageType = ItemDamageType.DT_SMOKE;
          break;
      }
      if (damageType !== ItemDamageType.DT_HE) {
        this._tile.setExplosive(0, 0, true);
      }
      engine.explode(this._center, this._power, damageType, Math.trunc(this._power / 10));
      terrainExplosion = true;
    }

    if (!this._tile && !this._item) {
      let radius = 6;
      if (this._unit &&
        (this._unit.getSpecialAbility() === SpecialAbility.SPECAB_EXPLODEONDEATH ||
          this._unit.getSpecialAbility() === SpecialAbility.SPECAB_BURN_AND_EXPLODE)) {
        radius = this._parent.getMod()?.getItem(this._unit.getArmor().getCorpseGeoscape(), true)?.getExplosionRadius() || radius;
      }
      engine.explode(this._center, this._power, ItemDamageType.DT_HE, radius);
      terrainExplosion = true;
    }

    if (!this._cosmetic) {
      this._parent.checkForCasualties(this._item, this._unit, false, terrainExplosion);
    }
    if (this._lowerWeapon && this._unit) {
      this._unit.aim(false);
      this._unit.invalidateCache();
    }
    if (this._item &&
      (this._item.getRules().getBattleType() === BattleType.BT_GRENADE ||
        this._item.getRules().getBattleType() === BattleType.BT_PROXIMITYGRENADE)) {
      save.removeItem(this._item);
    }

    this._parent.popState();
    const chainedTile = engine.checkForTerrainExplosions();
    if (chainedTile) {
      this._parent.statePushFront(new ExplosionBState(
        this._parent,
        chainedTile.getPosition().multiply(new Position(16, 16, 24)),
        null,
        this._unit,
        chainedTile
      ));
    }
  }
}
