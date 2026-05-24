import { Options } from "../Engine/Options.ts";
import { RNG } from "../Engine/RNG.ts";
import type { BattleItem } from "../Savegame/BattleItem.ts";
import { UnitBodyPart, UnitFaction, UnitSide, UnitStatus, type BattleUnit, type BattleUnitKill } from "../Savegame/BattleUnit.ts";
import { BattleActionType, BattlescapeGame, type BattleAction } from "./BattlescapeGame.ts";
import { BattleState } from "./BattleState.ts";
import { CursorType } from "./Map.ts";
import { ExplosionBState } from "./ExplosionBState.ts";
import { InfoboxState } from "./InfoboxState.ts";
import { Position } from "./Position.ts";

function createBattleUnitKill(unit: BattleUnit, weapon: BattleItem, turn: number, side: UnitFaction): BattleUnitKill {
  const geoscapeSoldier = unit.getGeoscapeSoldier();
  const unitRules = unit.getUnitRules();
  const kill: BattleUnitKill = {
    name: "",
    type: "",
    rank: "",
    race: "",
    weapon: weapon.getRules().getName(),
    weaponAmmo: weapon.getRules().getName(),
    faction: unit.getFaction(),
    status: UnitStatus.STATUS_IGNORE_ME,
    mission: 0,
    turn: turn * 3 + side,
    id: unit.getId(),
    side: UnitSide.SIDE_FRONT,
    bodypart: UnitBodyPart.BODYPART_HEAD
  };

  if (geoscapeSoldier) {
    kill.name = geoscapeSoldier.getName();
  } else {
    kill.type = unit.getType();
  }

  if (unit.getOriginalFaction() === UnitFaction.FACTION_PLAYER) {
    if (geoscapeSoldier) {
      kill.rank = geoscapeSoldier.getRankString() || "STR_SOLDIER";
      kill.race = unitRules?.getRace() || "STR_FRIENDLY";
    } else {
      kill.rank = unitRules?.getRank() || "STR_HWPS";
      kill.race = unitRules?.getRace() || "STR_FRIENDLY";
    }
  } else if (unit.getOriginalFaction() === UnitFaction.FACTION_HOSTILE) {
    kill.rank = unitRules?.getRank() || "STR_LIVE_SOLDIER";
    kill.race = unitRules?.getRace() || "STR_HOSTILE";
  } else if (unit.getOriginalFaction() === UnitFaction.FACTION_NEUTRAL) {
    kill.rank = unitRules?.getRank() || "STR_CIVILIAN";
    kill.race = unitRules?.getRace() || "STR_NEUTRAL";
  } else {
    kill.rank = "STR_UNKNOWN";
    kill.race = "STR_UNKNOWN";
  }

  return kill;
}

/**
 * A Psi Attack state.
 */
export class PsiAttackBState extends BattleState {
  private _unit: BattleUnit | null = null;
  private _target: BattleUnit | null = null;
  private _item: BattleItem | null = null;
  private _initialized = false;

  constructor(parent: BattlescapeGame, action: BattleAction) {
    super(parent, action);
  }

  init(): void {
    if (this._initialized) {
      return;
    }
    this._initialized = true;

    this._item = this._action.weapon;
    this._unit = this._action.actor;

    const targetTile = this._parent.getSave().getTile(this._action.target);
    if (!targetTile) {
      this._parent.popState();
      return;
    }

    if (!this._unit || this._unit.getTimeUnits() < this._action.TU) {
      this._action.result = "STR_NOT_ENOUGH_TIME_UNITS";
      this._parent.popState();
      return;
    }

    this._target = targetTile.getUnit();
    if (!this._target || !this._item) {
      this._parent.popState();
      return;
    }

    const height = this._target.getFloatHeight() + Math.trunc(this._target.getHeight() / 2) - targetTile.getTerrainLevel();
    const voxel = this._action.target.multiply(new Position(16, 16, 24)).add(new Position(8, 8, height));
    this._parent.getMap().setCursorType(CursorType.CT_NONE);
    this._parent.statePushFront(new ExplosionBState(this._parent, voxel, this._item, this._unit, null, false, true));
  }

  think(): void {
    this.psiAttack();

    if (this._action.cameraPosition.z !== -1) {
      this._parent.getMap().getCamera().setMapOffset(this._action.cameraPosition);
      this._parent.getMap().invalidate();
    }
    if (this._parent.getSave().getSide() === UnitFaction.FACTION_PLAYER || this._parent.getSave().getDebugMode()) {
      this._parent.setupCursor();
    }
    this._parent.popState();
  }

  psiAttack(): void {
    if (!this._unit || !this._target || !this._item) {
      return;
    }

    let attackStrength = this._unit.getBaseStats().psiStrength * this._unit.getBaseStats().psiSkill / 50.0;
    let defenseStrength = this._target.getBaseStats().psiStrength +
      (this._target.getBaseStats().psiSkill > 0 ? 10.0 + this._target.getBaseStats().psiSkill / 5.0 : 10.0);
    const dist = this._parent.getTileEngine()?.distance(this._unit.getPosition(), this._action.target) || 0;
    attackStrength -= dist;
    attackStrength += RNG.generate(0, 55);

    if (this._action.type === BattleActionType.BA_MINDCONTROL) {
      defenseStrength += 20;
    }

    this._unit.addPsiSkillExp();
    if (Options.allowPsiStrengthImprovement) {
      this._target.addPsiStrengthExp();
    }
    if (attackStrength > defenseStrength) {
      this._action.actor?.addPsiSkillExp();
      this._action.actor?.addPsiSkillExp();

      const killStat = createBattleUnitKill(this._target, this._item, this._parent.getSave().getTurn(), this._parent.getSave().getSide());

      if (this._action.type === BattleActionType.BA_PANIC) {
        const moraleLoss = 110 - this._target.getBaseStats().bravery;
        if (moraleLoss > 0) {
          this._target.moraleChange(-moraleLoss);
        }
        this._target.setMindControllerId(this._unit.getId());
        if (!this._unit.getStatistics().duplicateEntry(UnitStatus.STATUS_PANICKING, this._target.getId())) {
          killStat.status = UnitStatus.STATUS_PANICKING;
          this._unit.getStatistics().kills.push({ ...killStat });
        }
        if (this._parent.getSave().getSide() === UnitFaction.FACTION_PLAYER) {
          const game = this._parent.getSave().getBattleState()?.getGame();
          game?.pushState(new InfoboxState(String(game.getLanguage().getString("STR_MORALE_ATTACK_SUCCESSFUL"))));
        }
      } else if (this._action.type === BattleActionType.BA_MINDCONTROL) {
        if (!this._unit.getStatistics().duplicateEntry(UnitStatus.STATUS_TURNING, this._target.getId())) {
          killStat.status = UnitStatus.STATUS_TURNING;
          this._unit.getStatistics().kills.push({ ...killStat });
        }
        this._target.setMindControllerId(this._unit.getId());
        this._target.convertToFaction(this._unit.getFaction());
        this._parent.getTileEngine()?.calculateFOV(this._target.getPosition());
        this._parent.getTileEngine()?.calculateUnitLighting();
        this._target.recoverTimeUnits();
        this._target.allowReselect();
        this._target.abortTurn();
        if (this._parent.getSave().getSide() === UnitFaction.FACTION_PLAYER) {
          if (Options.allowPsionicCapture) {
            this._parent.autoEndBattle();
          }
          const game = this._parent.getSave().getBattleState()?.getGame();
          game?.pushState(new InfoboxState(String(game.getLanguage().getString("STR_MIND_CONTROL_SUCCESSFUL"))));
          this._parent.getSave().getBattleState()?.updateSoldierInfo();
        } else {
          const battleState = this._parent.getSave().getBattleState();
          const game = battleState?.getGame();
          game?.pushState(new InfoboxState(String(game.getLanguage()
            .getString("STR_IS_UNDER_ALIEN_CONTROL", this._target.getGender())
            .arg(this._target.getName(game.getLanguage())))));
        }
      }
    } else if (Options.allowPsiStrengthImprovement) {
      this._target.addPsiStrengthExp();
    }
  }
}
