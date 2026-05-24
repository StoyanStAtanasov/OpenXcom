import { Options } from "../Engine/Options.ts";
import { ItemDamageType } from "../Mod/RuleItem.ts";
import { BattleItem } from "../Savegame/BattleItem.ts";
import { UnitFaction, UnitStatus, type BattleUnit } from "../Savegame/BattleUnit.ts";
import { BattleState } from "./BattleState.ts";
import type { BattlescapeGame } from "./BattlescapeGame.ts";
import { BattlescapeState } from "./BattlescapeState.ts";
import { InfoboxOKState } from "./InfoboxOKState.ts";
import { InfoboxState } from "./InfoboxState.ts";
import { Position } from "./Position.ts";

/**
 * State for dying or unconscious units.
 */
export class UnitDieBState extends BattleState {
  private _extraFrame = 0;

  constructor(
    parent: BattlescapeGame,
    private _unit: BattleUnit,
    private _damageType: ItemDamageType,
    private _noSound: boolean,
    private _noCorpse: boolean
  ) {
    super(parent);
    if (this._damageType === ItemDamageType.DT_HE || this._unit.getStatus() === UnitStatus.STATUS_UNCONSCIOUS) {
      this._unit.setDirection(3);
      this._unit.startFalling();
      while (this._unit.getStatus() === UnitStatus.STATUS_COLLAPSING) {
        this._unit.keepFalling();
      }
      if (this._parent.getSave().isBeforeGame?.()) {
        if (!this._noCorpse) {
          this.convertUnitToCorpse();
        }
        this._extraFrame = 3;
      }
    } else {
      if (this._unit.getFaction() === UnitFaction.FACTION_PLAYER) {
        this._parent.getMap().setUnitDying(true);
      }
      this._parent.setStateInterval(BattlescapeState.DEFAULT_ANIM_SPEED);
      if (this._unit.getDirection() !== 3) {
        this._parent.setStateInterval(Math.trunc(BattlescapeState.DEFAULT_ANIM_SPEED / 3));
      }
    }

    this._unit.clearVisibleTiles();
    this._unit.clearVisibleUnits();
    this._unit.freePatrolTarget();
  }

  init(): void {
    if (this._parent.getSave().getBattleState() && !this._unit.getTile()) {
      this._parent.popState();
    }
  }

  think(): void {
    if (this._extraFrame === 3) {
      this._parent.popState();
      return;
    }
    if (this._unit.getDirection() !== 3 && this._damageType !== ItemDamageType.DT_HE) {
      let dir = this._unit.getDirection() + 1;
      if (dir === 8) {
        dir = 0;
      }
      this._unit.lookAt(dir);
      this._unit.turn();
      if (dir === 3) {
        this._parent.setStateInterval(BattlescapeState.DEFAULT_ANIM_SPEED);
      }
    } else if (this._unit.getStatus() === UnitStatus.STATUS_COLLAPSING) {
      this._unit.keepFalling();
    } else if (!this._unit.isOut()) {
      this._unit.startFalling();
      if (this._unit.getRespawn()) {
        while (this._unit.getStatus() === UnitStatus.STATUS_COLLAPSING) {
          this._unit.keepFalling();
        }
      }
    }

    if (this._extraFrame === 2) {
      this._parent.getMap().setUnitDying(false);
      this._parent.getTileEngine()?.calculateUnitLighting();
      this._parent.popState();
      if (this._unit.getOriginalFaction() === UnitFaction.FACTION_PLAYER) {
        const battleState = this._parent.getSave().getBattleState();
        const game = battleState?.getGame();
        if (game) {
          if (this._unit.getStatus() === UnitStatus.STATUS_DEAD) {
            if (this._damageType === ItemDamageType.DT_NONE && !this._unit.getSpawnUnit()) {
              game.pushState(new InfoboxOKState(String(game.getLanguage()
                .getString("STR_HAS_DIED_FROM_A_FATAL_WOUND", this._unit.getGender())
                .arg(this._unit.getName(game.getLanguage())))));
            } else if (Options.battleNotifyDeath && this._unit.getGeoscapeSoldier()) {
              game.pushState(new InfoboxState(String(game.getLanguage()
                .getString("STR_HAS_BEEN_KILLED", this._unit.getGender())
                .arg(this._unit.getName(game.getLanguage())))));
            }
          } else {
            game.pushState(new InfoboxOKState(String(game.getLanguage()
              .getString("STR_HAS_BECOME_UNCONSCIOUS", this._unit.getGender())
              .arg(this._unit.getName(game.getLanguage())))));
          }
        }
      }
      if (this._parent.getSave().getSide() === UnitFaction.FACTION_PLAYER) {
        this._parent.autoEndBattle();
      }
    } else if (this._extraFrame === 1) {
      this._extraFrame++;
    } else if (this._unit.isOut()) {
      this._extraFrame = 1;
      if (this._unit.getStatus() === UnitStatus.STATUS_UNCONSCIOUS && !this._unit.getCapturable()) {
        this._unit.instaKill();
      }
      if (this._unit.getTurnsSinceSpotted() < 255) {
        this._unit.setTurnsSinceSpotted(255);
      }
      if (this._unit.getSpawnUnit()) {
        this._parent.convertUnit(this._unit);
      } else if (!this._noCorpse) {
        this.convertUnitToCorpse();
      }
      if (this._unit === this._parent.getSave().getSelectedUnit()) {
        this._parent.getSave().setSelectedUnit(null);
      }
    }
    this._parent.getMap().invalidate();
  }

  cancel(): void {}

  convertUnitToCorpse(): void {
    const tile = this._unit.getTile();
    const lastPosition = tile?.getPosition?.()?.clone() || this._unit.getPosition().clone();
    const size = this._unit.getArmor().getSize();
    const dropItems = this._unit.hasInventory();

    if (!lastPosition.equals(new Position(-1, -1, -1))) {
      this._parent.getSave().removeUnconsciousBodyItem(this._unit);
    }

    if (dropItems) {
      const itemsToKeep: BattleItem[] = [];
      for (const item of [...this._unit.getInventory()]) {
        this._parent.dropItem(lastPosition, item);
        if (!item.getRules().isFixed()) {
          item.setOwner(null);
        } else {
          itemsToKeep.push(item);
        }
      }
      this._unit.getInventory().length = 0;
      this._unit.getInventory().push(...itemsToKeep);
    }

    this._unit.setTile(null);
    if (lastPosition.equals(new Position(-1, -1, -1))) {
      for (const item of this._parent.getSave().getItems()) {
        if (item.getUnit() === this._unit) {
          const corpseRules = this.getCorpseRules(0);
          if (corpseRules) {
            item.convertToCorpse(corpseRules);
          }
          break;
        }
      }
      return;
    }

    const corpseTypes = this._unit.getArmor().getCorpseBattlescape();
    if (corpseTypes.length === 0) {
      this.clearUnitTiles(lastPosition, size);
      return;
    }
    let corpseIndex = size * size - 1;
    for (let y = size - 1; y >= 0; --y) {
      for (let x = size - 1; x >= 0; --x) {
        const pos = lastPosition.add(new Position(x, y, 0));
        const currentTile = this._parent.getSave().getTile(pos);
        if (currentTile?.getUnit() === this._unit) {
          currentTile.setUnit(null);
        }
        const corpseRules = this.getCorpseRules(corpseIndex);
        if (corpseRules) {
          const corpse = new BattleItem(corpseRules, this._parent.getSave().getCurrentItemId());
          corpse.setUnit(this._unit);
          this._parent.dropItem(pos, corpse, true);
        }
        corpseIndex--;
      }
    }
  }

  private clearUnitTiles(lastPosition: Position, size: number): void {
    for (let y = size - 1; y >= 0; --y) {
      for (let x = size - 1; x >= 0; --x) {
        const tile = this._parent.getSave().getTile(lastPosition.add(new Position(x, y, 0)));
        if (tile?.getUnit() === this._unit) {
          tile.setUnit(null);
        }
      }
    }
  }

  private getCorpseRules(index: number) {
    const corpseTypes = this._unit.getArmor().getCorpseBattlescape();
    const corpseType = corpseTypes[index] || corpseTypes[0] || "";
    return corpseType ? this._parent.getMod()?.getItem(corpseType, true) || null : null;
  }
}
