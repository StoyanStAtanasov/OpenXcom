import { Options } from "../Engine/Options.ts";
import { RNG } from "../Engine/RNG.ts";
import { TilePart, VoxelType } from "../Mod/MapData.ts";
import { BattleType, ItemDamageType } from "../Mod/RuleItem.ts";
import { UnitFaction, UnitStatus, type BattleUnit } from "../Savegame/BattleUnit.ts";
import { Node } from "../Savegame/Node.ts";
import type { SavedBattleGame } from "../Savegame/SavedBattleGame.ts";
import { BattleActionType, createBattleAction, type BattleAction } from "./BattleAction.ts";
import { Pathfinding } from "./Pathfinding.ts";
import { Position, type PositionLike } from "./Position.ts";

export enum AIMode {
  AI_PATROL = 0,
  AI_AMBUSH,
  AI_COMBAT,
  AI_ESCAPE
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function scaleOdds(value: number, multiplier: number): number {
  return Math.trunc(value * multiplier);
}

export type AIModuleSave = {
  fromNode?: number;
  toNode?: number;
  AIMode?: number;
  wasHitBy?: number[];
};

export class AIModule {
  private _aggroTarget: BattleUnit | null = null;
  private _knownEnemies = 0;
  private _visibleEnemies = 0;
  private _spottingEnemies = 0;
  private _escapeTUs = 0;
  private _ambushTUs = 0;
  private _escapeAction: BattleAction = createBattleAction();
  private _ambushAction: BattleAction = createBattleAction();
  private _attackAction: BattleAction = createBattleAction();
  private _patrolAction: BattleAction = createBattleAction();
  private _psiAction: BattleAction = createBattleAction();
  private _rifle = false;
  private _melee = false;
  private _blaster = false;
  private _traceAI = Options.traceAI;
  private _didPsi = false;
  private _AIMode = AIMode.AI_PATROL;
  private _intelligence = 0;
  private _closestDist = 100;
  private _toNode: Node | null = null;
  private _reachable: number[] = [];
  private _reachableWithAttack: number[] = [];
  private _wasHitBy: number[] = [];
  private _reserve = BattleActionType.BA_NONE;
  private _targetFaction = UnitFaction.FACTION_PLAYER;

  constructor(private _save: SavedBattleGame, private _unit: BattleUnit, private _fromNode: Node | null) {
    this._intelligence = this._unit.getIntelligence();
    if (this._unit.getOriginalFaction() === UnitFaction.FACTION_NEUTRAL) {
      this._targetFaction = UnitFaction.FACTION_HOSTILE;
    }
  }

  reset(): void {
    this._escapeTUs = 0;
    this._ambushTUs = 0;
  }

  think(action: BattleAction): void {
    action.type = BattleActionType.BA_RETHINK;
    action.actor = this._unit;
    action.weapon = this._unit.getMainHandWeapon(false);
    const savedGame = this._save.getBattleState()?.getGame().getSavedGame();
    this._attackAction.diff = savedGame?.getDifficultyCoefficient?.() ?? savedGame?.getDifficulty?.() ?? 0;
    this._attackAction.actor = this._unit;
    this._attackAction.weapon = action.weapon;
    this._attackAction.number = action.number;
    this._escapeAction.number = action.number;
    this._knownEnemies = this.countKnownTargets();
    this._visibleEnemies = this.selectNearestTarget();
    this._spottingEnemies = this.getSpottingUnits(this._unit.getPosition());
    this._melee = this._unit.getMeleeWeapon() !== null;
    this._rifle = false;
    this._blaster = false;
    this._reachable = this._save.getPathfinding()?.findReachable(this._unit, this._unit.getTimeUnits()) || [];
    this._wasHitBy.length = 0;

    if (this._unit.getCharging()?.isOut()) {
      this._unit.setCharging(null);
    }

    if (action.weapon) {
      const rule = action.weapon.getRules();
      if (this._save.isItemUsable(action.weapon)) {
        if (rule.getBattleType() === BattleType.BT_FIREARM) {
          if (rule.getWaypoints() !== 0 || (action.weapon.getAmmoItem() && action.weapon.getAmmoItem()?.getRules().getWaypoints() !== 0)) {
            this._blaster = true;
            this._reachableWithAttack = this._save.getPathfinding()?.findReachable(
              this._unit,
              this._unit.getTimeUnits() - this._unit.getActionTUs(BattleActionType.BA_AIMEDSHOT, action.weapon)
            ) || [];
          } else {
            this._rifle = true;
            this._reachableWithAttack = this._save.getPathfinding()?.findReachable(
              this._unit,
              this._unit.getTimeUnits() - this._unit.getActionTUs(BattleActionType.BA_SNAPSHOT, action.weapon)
            ) || [];
          }
        } else if (rule.getBattleType() === BattleType.BT_MELEE) {
          this._melee = true;
          this._reachableWithAttack = this._save.getPathfinding()?.findReachable(
            this._unit,
            this._unit.getTimeUnits() - this._unit.getActionTUs(BattleActionType.BA_HIT, action.weapon)
          ) || [];
        }
      } else {
        action.weapon = null;
      }
    }

    if (this._spottingEnemies && !this._escapeTUs) {
      this.setupEscape();
    }

    if (this._knownEnemies && !this._melee && !this._ambushTUs) {
      this.setupAmbush();
    }

    this.setupAttack();
    this.setupPatrol();

    if (this._psiAction.type !== BattleActionType.BA_NONE && !this._didPsi) {
      this._didPsi = true;
      action.type = this._psiAction.type;
      action.target = this._psiAction.target.clone();
      action.number -= 1;
      action.weapon = this._psiAction.weapon;
      return;
    } else {
      this._didPsi = false;
    }

    let evaluate = false;
    switch (this._AIMode) {
      case AIMode.AI_PATROL:
        evaluate = Boolean(this._spottingEnemies || this._visibleEnemies || this._knownEnemies || RNG.percent(10));
        break;
      case AIMode.AI_AMBUSH:
        evaluate = !this._rifle || !this._ambushTUs || Boolean(this._visibleEnemies);
        break;
      case AIMode.AI_COMBAT:
        evaluate = this._attackAction.type === BattleActionType.BA_RETHINK;
        break;
      case AIMode.AI_ESCAPE:
        evaluate = !this._spottingEnemies || !this._knownEnemies;
        break;
    }

    if (this._spottingEnemies > 2 ||
      this._unit.getHealth() < 2 * this._unit.getBaseStats().health / 3 ||
      (this._aggroTarget && this._aggroTarget.getTurnsSinceSpotted() > this._intelligence)) {
      evaluate = true;
    }

    if (this._save.isCheating() && this._AIMode !== AIMode.AI_COMBAT) {
      evaluate = true;
    }

    if (evaluate) {
      this.evaluateAIMode();
    }

    this._reserve = BattleActionType.BA_NONE;

    if (this._AIMode === AIMode.AI_ESCAPE) {
      this._unit.setCharging(null);
      action.type = this._escapeAction.type;
      action.target = this._escapeAction.target.clone();
      action.finalAction = true;
      action.desperate = true;
      this._unit.setHiding(true);
    } else if (this._AIMode === AIMode.AI_PATROL) {
      this._unit.setCharging(null);
      if (action.weapon && action.weapon.getRules().getBattleType() === BattleType.BT_FIREARM) {
        switch (this._unit.getAggression()) {
          case 0:
            this._reserve = BattleActionType.BA_AIMEDSHOT;
            break;
          case 1:
            this._reserve = BattleActionType.BA_AUTOSHOT;
            break;
          case 2:
            this._reserve = BattleActionType.BA_SNAPSHOT;
            break;
          default:
            break;
        }
      }
      action.type = this._patrolAction.type;
      action.target = this._patrolAction.target.clone();
    } else if (this._AIMode === AIMode.AI_COMBAT) {
      action.type = this._attackAction.type;
      action.target = this._attackAction.target.clone();
      action.weapon = this._attackAction.weapon;
      if (action.weapon && action.type === BattleActionType.BA_THROW && action.weapon.getRules().getBattleType() === BattleType.BT_GRENADE) {
        this._unit.spendTimeUnits(4 + this._unit.getActionTUs(BattleActionType.BA_PRIME, action.weapon));
      }
      action.finalFacing = this._attackAction.finalFacing;
      action.TU = this._unit.getActionTUs(this._attackAction.type, this._attackAction.weapon);
      if (action.type === BattleActionType.BA_WALK && this._rifle &&
        this._unit.getTimeUnits() > this._unit.getActionTUs(BattleActionType.BA_SNAPSHOT, action.weapon)) {
        action.number -= 1;
      } else if (action.type === BattleActionType.BA_LAUNCH) {
        action.waypoints = this._attackAction.waypoints.map(point => point.clone());
      }
    } else if (this._AIMode === AIMode.AI_AMBUSH) {
      this._unit.setCharging(null);
      action.type = this._ambushAction.type;
      action.target = this._ambushAction.target.clone();
      action.finalFacing = this._ambushAction.finalFacing;
      action.finalAction = true;
    } else {
      action.type = BattleActionType.BA_NONE;
    }

    if (action.type === BattleActionType.BA_WALK) {
      if (!action.target.equals(this._unit.getPosition())) {
        this._escapeTUs = 0;
        this._ambushTUs = 0;
      } else {
        action.type = BattleActionType.BA_NONE;
      }
    }
  }

  setupAttack(): void {
    this._attackAction.type = BattleActionType.BA_RETHINK;
    this._psiAction.type = BattleActionType.BA_NONE;

    if (this._knownEnemies) {
      if (this.psiAction()) {
        return;
      }
      if (this._blaster) {
        this.wayPointAction();
      }
    }

    if (this.selectNearestTarget()) {
      if (this._melee && this._rifle) {
        this.selectMeleeOrRanged();
      }
      if (this._unit.getGrenadeFromBelt()) {
        this.grenadeAction();
      }
      if (this._melee) {
        this.meleeAction();
      }
      if (this._rifle) {
        this.projectileAction();
      }
    }

    if (this._attackAction.type !== BattleActionType.BA_RETHINK) {
      return;
    } else if (this._spottingEnemies || this._unit.getAggression() < RNG.generate(0, 3)) {
      this.findFirePoint();
    }
  }

  setupPatrol(): void {
    this._patrolAction = createBattleAction();
    this._patrolAction.TU = 0;
    const engine = this._save.getTileEngine();
    const pathfinding = this._save.getPathfinding();

    if (this._toNode && this._unit.getPosition().equals(this._toNode.getPosition())) {
      this._fromNode = this._toNode;
      this.freePatrolTarget();
      this._toNode = null;
      const dir = engine?.faceWindow(this._unit.getPosition()) ?? -1;
      if (dir !== -1 && dir !== this._unit.getDirection()) {
        this._unit.lookAt(dir);
        while (this._unit.getStatus() === UnitStatus.STATUS_TURNING) {
          this._unit.turn();
        }
      }
    }

    if (!engine || !pathfinding) {
      this._patrolAction.type = BattleActionType.BA_RETHINK;
      return;
    }

    if (!this._fromNode) {
      let closest = 1000000;
      for (const candidate of this._save.getNodes()) {
        if (candidate.isDummy()) {
          continue;
        }
        const d = engine.distanceSq(this._unit.getPosition(), candidate.getPosition());
        if (this._unit.getPosition().z === candidate.getPosition().z &&
          d < closest &&
          (!(candidate.getType() & Node.TYPE_SMALL) || this._unit.getArmor().getSize() === 1)) {
          this._fromNode = candidate;
          closest = d;
        }
      }
    }

    let triesLeft = 5;
    while (!this._toNode && triesLeft) {
      triesLeft--;
      let scout = true;

      if (this._save.getMissionType() !== "STR_BASE_DEFENSE") {
        const currentTile = this._save.getTile(this._unit.getPosition());
        if (this._save.isCheating() || !this._fromNode || this._fromNode.getRank() === 0 || currentTile?.getFire()) {
          scout = true;
        } else {
          scout = false;
        }
      } else if (this._unit.getArmor().getSize() === 1 &&
        this._attackAction.weapon &&
        this._attackAction.weapon.getRules().getAccuracySnap() &&
        !this._attackAction.weapon.getRules().getArcingShot() &&
        this._attackAction.weapon.getAmmoItem() &&
        !this._attackAction.weapon.getAmmoItem()?.getRules().getArcingShot() &&
        this._attackAction.weapon.getAmmoItem()?.getRules().getDamageType() !== ItemDamageType.DT_HE &&
        this._attackAction.weapon.getAmmoItem()?.getRules().getDamageType() !== ItemDamageType.DT_STUN) {
        const fromPosition = this._fromNode?.getPosition();
        const fromModule = fromPosition ? this._save.getModuleMap()[Math.trunc(fromPosition.x / 10)]?.[Math.trunc(fromPosition.y / 10)] : null;
        if (this._fromNode?.isTarget() && (fromModule?.[1] || 0) > 0) {
          const x = Math.trunc(this._unit.getPosition().x / 10) * 10;
          const y = Math.trunc(this._unit.getPosition().y / 10) * 10;
          for (let i = x; i < x + 9; ++i) {
            for (let j = y; j < y + 9; ++j) {
              const md = this._save.getTile(new Position(i, j, 1))?.getMapData(TilePart.O_OBJECT);
              if (md?.isBaseModule()) {
                this._patrolAction.actor = this._unit;
                this._patrolAction.target = new Position(i, j, 1);
                this._patrolAction.weapon = this._attackAction.weapon;
                this._patrolAction.type = BattleActionType.BA_SNAPSHOT;
                this._patrolAction.TU = this._patrolAction.actor.getActionTUs(this._patrolAction.type, this._patrolAction.weapon);
                return;
              }
            }
          }
        } else {
          let closest = 1000000;
          for (const candidate of this._save.getNodes()) {
            if (candidate.isDummy()) {
              continue;
            }

            const tile = this._save.getTile(candidate.getPosition());
            if (tile?.getUnit() && tile.getUnit()?.getFaction() === this._unit.getFaction()) {
              continue;
            }

            const position = candidate.getPosition();
            const module = this._save.getModuleMap()[Math.trunc(position.x / 10)]?.[Math.trunc(position.y / 10)];
            if (candidate.isTarget() && !candidate.isAllocated() && (module?.[1] || 0) > 0) {
              const d = engine.distanceSq(this._unit.getPosition(), position);
              if (!this._toNode || (d < closest && candidate !== this._fromNode)) {
                this._toNode = candidate;
                closest = d;
              }
            }
          }
        }
      }

      if (!this._toNode) {
        this._toNode = this._save.getPatrolNode(scout, this._unit, this._fromNode);
        if (!this._toNode) {
          this._toNode = this._save.getPatrolNode(!scout, this._unit, this._fromNode);
        }
      }

      if (this._toNode) {
        pathfinding.calculate(this._unit, this._toNode.getPosition());
        if (pathfinding.getStartDirection() === -1) {
          this._toNode = null;
        }
        pathfinding.abortPath();
      }
    }

    if (this._toNode) {
      this._toNode.allocateNode();
      this._patrolAction.actor = this._unit;
      this._patrolAction.type = BattleActionType.BA_WALK;
      this._patrolAction.target = this._toNode.getPosition().clone();
    } else {
      this._patrolAction.type = BattleActionType.BA_RETHINK;
    }
  }

  setupAmbush(): void {
    this._ambushAction.type = BattleActionType.BA_RETHINK;
    let bestScore = 0;
    this._ambushTUs = 0;
    let path: number[] = [];
    const engine = this._save.getTileEngine();
    const pathfinding = this._save.getPathfinding();

    if (!engine || !pathfinding) {
      return;
    }

    if (this.selectClosestKnownEnemy() && this._aggroTarget) {
      const BASE_SYSTEMATIC_SUCCESS = 100;
      const COVER_BONUS = 25;
      const FAST_PASS_THRESHOLD = 80;
      let origin = engine.getSightOriginVoxel(this._aggroTarget);

      for (const node of this._save.getNodes()) {
        if (node.isDummy()) {
          continue;
        }
        const pos = node.getPosition().clone();
        const tile = this._save.getTile(pos);
        if (!tile ||
          engine.distance(pos, this._unit.getPosition()) > 10 ||
          pos.z !== this._unit.getPosition().z ||
          tile.getDangerous() ||
          !this._reachableWithAttack.includes(this._save.getTileIndex(pos))) {
          continue;
        }

        if (this._traceAI) {
          tile.setPreview(10);
          tile.setMarkerColor(13);
        }

        const target = new Position();
        if (!engine.canTargetUnit(origin, tile, target, this._aggroTarget, false, this._unit) && !this.getSpottingUnits(pos)) {
          pathfinding.calculate(this._unit, pos);
          const ambushTUs = pathfinding.getTotalTUCost();
          if (pathfinding.getStartDirection() !== -1) {
            let score = BASE_SYSTEMATIC_SUCCESS;
            score -= ambushTUs;

            pathfinding.calculate(this._aggroTarget, pos);
            if (pathfinding.getStartDirection() !== -1) {
              if (engine.faceWindow(pos) !== -1) {
                score += COVER_BONUS;
              }
              if (score > bestScore) {
                path = pathfinding.copyPath();
                bestScore = score;
                this._ambushTUs = pos.equals(this._unit.getPosition()) ? 1 : ambushTUs;
                this._ambushAction.target = pos.clone();
                if (bestScore > FAST_PASS_THRESHOLD) {
                  break;
                }
              }
            }
          }
        }
      }

      if (bestScore > 0 && this._aggroTarget) {
        this._ambushAction.type = BattleActionType.BA_WALK;
        const ambushTile = this._save.getTile(this._ambushAction.target);
        origin = this._ambushAction.target.multiply(new Position(16, 16, 24)).add(
          new Position(8, 8, this._unit.getHeight() + this._unit.getFloatHeight() - (ambushTile?.getTerrainLevel() || 0) - 4)
        );
        let currentPos = this._aggroTarget.getPosition().clone();
        pathfinding.setUnit(this._aggroTarget);
        const nextPos = new Position();
        let tries = path.length;
        while (tries > 0) {
          const dir = path[path.length - 1];
          pathfinding.getTUCost(currentPos, dir, nextPos, this._aggroTarget, null, false);
          path.pop();
          currentPos = nextPos.clone();
          const tile = this._save.getTile(currentPos);
          const target = new Position();
          if (engine.canTargetUnit(origin, tile, target, this._unit, false, this._aggroTarget)) {
            this._ambushAction.finalFacing = engine.getDirectionTo(this._ambushAction.target, currentPos);
            break;
          }
          --tries;
        }
      }
    }
  }

  setupEscape(): void {
    const engine = this._save.getTileEngine();
    const pathfinding = this._save.getPathfinding();
    this._escapeAction.type = BattleActionType.BA_RETHINK;
    if (!engine || !pathfinding) {
      return;
    }

    const unitsSpottingMe = this.getSpottingUnits(this._unit.getPosition());
    const currentTilePreference = 15;
    let tries = -1;
    let coverFound = false;
    this.selectNearestTarget();
    this._escapeTUs = 0;

    const dist = this._aggroTarget ? engine.distance(this._unit.getPosition(), this._aggroTarget.getPosition()) : 0;
    let bestTileScore = -100000;
    let score = -100000;
    let bestTile = new Position();

    const EXPOSURE_PENALTY = 10;
    const FIRE_PENALTY = 40;
    const BASE_SYSTEMATIC_SUCCESS = 100;
    const BASE_DESPERATE_SUCCESS = 110;
    const FAST_PASS_THRESHOLD = 100;

    const randomTileSearch = this._save.getTileSearch().map(pos => pos.clone());
    RNG.shuffle(randomTileSearch);

    while (tries < 150 && !coverFound) {
      this._escapeAction.target = this._unit.getPosition().clone();

      if (!this._save.getTile(this._escapeAction.target)) {
        this._escapeAction.target = this._unit.getPosition().clone();
      }

      score = 0;

      if (tries === -1) {
        if (this._save.getTile(this._unit.lastCover)) {
          this._escapeAction.target = this._unit.lastCover.clone();
        }
      } else if (tries < 121) {
        const offset = randomTileSearch[tries] || new Position();
        this._escapeAction.target.x += offset.x;
        this._escapeAction.target.y += offset.y;
        score = BASE_SYSTEMATIC_SUCCESS;
        if (this._escapeAction.target.equals(this._unit.getPosition())) {
          if (unitsSpottingMe > 0) {
            this._escapeAction.target.x += RNG.generate(-20, 20);
            this._escapeAction.target.y += RNG.generate(-20, 20);
          } else {
            score += currentTilePreference;
          }
        }
      } else {
        score = BASE_DESPERATE_SUCCESS;
        this._escapeAction.target = this._unit.getPosition().clone();
        this._escapeAction.target.x += RNG.generate(-10, 10);
        this._escapeAction.target.y += RNG.generate(-10, 10);
        this._escapeAction.target.z = this._unit.getPosition().z + RNG.generate(-1, 1);
        if (this._escapeAction.target.z < 0) {
          this._escapeAction.target.z = 0;
        } else if (this._escapeAction.target.z >= this._save.getMapSizeZ()) {
          this._escapeAction.target.z = this._unit.getPosition().z;
        }
      }

      tries++;

      const tile = this._save.getTile(this._escapeAction.target);
      const distanceFromTarget = this._aggroTarget ? engine.distance(this._aggroTarget.getPosition(), this._escapeAction.target) : 0;
      if (dist >= distanceFromTarget) {
        score -= (distanceFromTarget - dist) * 10;
      } else {
        score += (distanceFromTarget - dist) * 10;
      }

      if (!tile) {
        score = -100001;
      } else {
        const spotters = this.getSpottingUnits(this._escapeAction.target);
        if (!this._reachable.includes(this._save.getTileIndex(this._escapeAction.target))) {
          continue;
        }

        if (this._spottingEnemies || spotters) {
          if (this._spottingEnemies <= spotters) {
            score -= (1 + spotters - this._spottingEnemies) * EXPOSURE_PENALTY;
          } else {
            score += (this._spottingEnemies - spotters) * EXPOSURE_PENALTY;
          }
        }
        if (tile.getFire()) {
          score -= FIRE_PENALTY;
        }
        if (tile.getDangerous()) {
          score -= BASE_SYSTEMATIC_SUCCESS;
        }

        if (this._traceAI) {
          tile.setMarkerColor(score < 0 ? 3 : (score < FAST_PASS_THRESHOLD / 2 ? 8 : (score < FAST_PASS_THRESHOLD ? 9 : 5)));
          tile.setPreview(10);
          tile.setTUMarker(score);
        }
      }

      if (tile && score > bestTileScore) {
        pathfinding.calculate(this._unit, this._escapeAction.target);
        if (this._escapeAction.target.equals(this._unit.getPosition()) || pathfinding.getStartDirection() !== -1) {
          bestTileScore = score;
          bestTile = this._escapeAction.target.clone();
          this._escapeTUs = pathfinding.getTotalTUCost();
          if (this._escapeAction.target.equals(this._unit.getPosition())) {
            this._escapeTUs = 1;
          }
          if (this._traceAI) {
            tile.setMarkerColor(score < 0 ? 7 : (score < FAST_PASS_THRESHOLD / 2 ? 10 : (score < FAST_PASS_THRESHOLD ? 4 : 5)));
            tile.setPreview(10);
            tile.setTUMarker(score);
          }
        }
        pathfinding.abortPath();
        if (bestTileScore > FAST_PASS_THRESHOLD) {
          coverFound = true;
        }
      }
    }

    this._escapeAction.target = bestTile;
    if (this._traceAI) {
      this._save.getTile(this._escapeAction.target)?.setMarkerColor(13);
    }

    if (bestTileScore <= -100000) {
      this._escapeAction.type = BattleActionType.BA_RETHINK;
      return;
    }

    this._escapeAction.type = BattleActionType.BA_WALK;
  }

  meleeAction(): void {
    const meleeWeapon = this._unit.getMeleeWeapon();
    const attackCost = this._unit.getActionTUs(BattleActionType.BA_HIT, meleeWeapon);
    const engine = this._save.getTileEngine();
    if (!engine || this._unit.getTimeUnits() < attackCost) {
      return;
    }

    if (this._aggroTarget && !this._aggroTarget.isOut()) {
      if (engine.validMeleeRange(this._unit, this._aggroTarget, engine.getDirectionTo(this._unit.getPosition(), this._aggroTarget.getPosition()))) {
        this.meleeAttack();
        return;
      }
    }

    const chargeReserve = this._unit.getTimeUnits() - attackCost;
    let distance = Math.trunc(chargeReserve / 4) + 1;
    this._aggroTarget = null;
    for (const unit of this._save.getUnits()) {
      const newDistance = engine.distance(this._unit.getPosition(), unit.getPosition());
      if (newDistance > 20 || !this.validTarget(unit, true, this._unit.getFaction() === UnitFaction.FACTION_HOSTILE)) {
        continue;
      }
      if ((newDistance < distance || newDistance === 1) && !unit.isOut()) {
        if (newDistance === 1 || this.selectPointNearTarget(unit, chargeReserve)) {
          this._aggroTarget = unit;
          this._attackAction.type = BattleActionType.BA_WALK;
          this._unit.setCharging(this._aggroTarget);
          distance = newDistance;
        }
      }
    }

    if (this._aggroTarget) {
      if (engine.validMeleeRange(this._unit, this._aggroTarget, engine.getDirectionTo(this._unit.getPosition(), this._aggroTarget.getPosition()))) {
        this.meleeAttack();
      }
    }
  }

  meleeAttack(): void {
    if (!this._aggroTarget) {
      return;
    }
    const sizeOffset = this._unit.getArmor().getSize() - 1;
    this._unit.lookAt(this._aggroTarget.getPosition().add(new Position(sizeOffset, sizeOffset, 0)), false);
    while (this._unit.getStatus() === UnitStatus.STATUS_TURNING) {
      this._unit.turn();
    }
    this._attackAction.target = this._aggroTarget.getPosition().clone();
    this._attackAction.type = BattleActionType.BA_HIT;
    this._attackAction.weapon = this._unit.getMeleeWeapon();
  }

  wayPointAction(): void {
    const weapon = this._attackAction.weapon;
    const ammo = weapon?.getAmmoItem();
    const pathfinding = this._save.getPathfinding();
    const engine = this._save.getTileEngine();
    if (!weapon || !ammo || !pathfinding || !engine) {
      return;
    }

    const attackCost = this._unit.getActionTUs(BattleActionType.BA_LAUNCH, weapon);
    if (this._unit.getTimeUnits() < attackCost) {
      return;
    }

    this._aggroTarget = null;
    for (const unit of this._save.getUnits()) {
      if (this._aggroTarget) {
        break;
      }
      if (!this.validTarget(unit, true, this._unit.getFaction() === UnitFaction.FACTION_HOSTILE)) {
        continue;
      }
      pathfinding.calculate(this._unit, unit.getPosition(), unit, -1);
      if (pathfinding.getStartDirection() !== -1 &&
        this.explosiveEfficacy(
          unit.getPosition(),
          this._unit,
          Math.trunc(ammo.getRules().getPower() / 20) + 1,
          this._attackAction.diff
        )) {
        this._aggroTarget = unit;
      }
      pathfinding.abortPath();
    }

    if (!this._aggroTarget) {
      return;
    }

    this._attackAction.type = BattleActionType.BA_LAUNCH;
    this._attackAction.TU = this._unit.getActionTUs(BattleActionType.BA_LAUNCH, weapon);
    if (this._attackAction.TU > this._unit.getTimeUnits()) {
      this._attackAction.type = BattleActionType.BA_RETHINK;
      return;
    }
    this._attackAction.waypoints.length = 0;

    let maxWaypoints = weapon.getRules().getWaypoints();
    if (maxWaypoints === 0) {
      maxWaypoints = ammo.getRules().getWaypoints();
    }
    if (maxWaypoints === -1) {
      maxWaypoints = 6 + (this._attackAction.diff * 2);
    }

    let lastWayPoint = this._unit.getPosition().clone();
    let lastPosition = this._unit.getPosition().clone();
    let currentPosition = this._unit.getPosition().clone();

    pathfinding.calculate(this._unit, this._aggroTarget.getPosition(), this._aggroTarget, -1);
    let pathDirection = pathfinding.dequeuePath();
    while (pathDirection !== -1 && this._attackAction.waypoints.length < maxWaypoints) {
      lastPosition = currentPosition.clone();
      const directionVector = Pathfinding.directionToVector(pathDirection);
      currentPosition = currentPosition.add(directionVector);
      const voxelPosA = new Position((currentPosition.x * 16) + 8, (currentPosition.y * 16) + 8, (currentPosition.z * 24) + 16);
      const voxelPosB = new Position((lastWayPoint.x * 16) + 8, (lastWayPoint.y * 16) + 8, (lastWayPoint.z * 24) + 16);
      const collidesWith = engine.calculateLine(voxelPosA, voxelPosB, false, null, this._unit, true);
      if (collidesWith > VoxelType.V_EMPTY && collidesWith < VoxelType.V_UNIT) {
        this._attackAction.waypoints.push(lastPosition.clone());
        lastWayPoint = lastPosition.clone();
      } else if (collidesWith === VoxelType.V_UNIT) {
        const target = this._save.getTile(currentPosition)?.getUnit();
        if (target === this._aggroTarget) {
          this._attackAction.waypoints.push(currentPosition.clone());
          lastWayPoint = currentPosition.clone();
        }
      }
      pathDirection = pathfinding.dequeuePath();
    }

    if (this._attackAction.waypoints.length > 0) {
      this._attackAction.target = this._attackAction.waypoints[0].clone();
    }
    if (!lastWayPoint.equals(this._aggroTarget.getPosition())) {
      this._attackAction.type = BattleActionType.BA_RETHINK;
    }
  }

  projectileAction(): void {
    if (!this._aggroTarget || !this._attackAction.weapon) {
      return;
    }
    const ammo = this._attackAction.weapon.getAmmoItem();
    if (!ammo) {
      return;
    }
    this._attackAction.target = this._aggroTarget.getPosition().clone();
    const radius = ammo.getRules().getExplosionRadius();
    if (!radius || this.explosiveEfficacy(this._aggroTarget.getPosition(), this._unit, radius, this._attackAction.diff)) {
      this.selectFireMethod();
    }
  }

  selectFireMethod(): void {
    const engine = this._save.getTileEngine();
    if (!engine || !this._attackAction.weapon) {
      return;
    }
    const distance = engine.distance(this._unit.getPosition(), this._attackAction.target);
    this._attackAction.type = BattleActionType.BA_RETHINK;
    const rules = this._attackAction.weapon.getRules();
    const tuAuto = rules.getTUAuto();
    const tuSnap = rules.getTUSnap();
    const tuAimed = rules.getTUAimed();
    const currentTU = this._unit.getTimeUnits();

    if (distance < 4) {
      if (tuAuto && currentTU >= this._unit.getActionTUs(BattleActionType.BA_AUTOSHOT, this._attackAction.weapon)) {
        this._attackAction.type = BattleActionType.BA_AUTOSHOT;
        return;
      }
      if (!tuSnap || currentTU < this._unit.getActionTUs(BattleActionType.BA_SNAPSHOT, this._attackAction.weapon)) {
        if (tuAimed && currentTU >= this._unit.getActionTUs(BattleActionType.BA_AIMEDSHOT, this._attackAction.weapon)) {
          this._attackAction.type = BattleActionType.BA_AIMEDSHOT;
        }
        return;
      }
      this._attackAction.type = BattleActionType.BA_SNAPSHOT;
      return;
    }

    if (distance > 12) {
      if (tuAimed && currentTU >= this._unit.getActionTUs(BattleActionType.BA_AIMEDSHOT, this._attackAction.weapon)) {
        this._attackAction.type = BattleActionType.BA_AIMEDSHOT;
        return;
      }
      if (distance < 20 &&
        tuSnap &&
        currentTU >= this._unit.getActionTUs(BattleActionType.BA_SNAPSHOT, this._attackAction.weapon)) {
        this._attackAction.type = BattleActionType.BA_SNAPSHOT;
        return;
      }
    }

    if (tuSnap && currentTU >= this._unit.getActionTUs(BattleActionType.BA_SNAPSHOT, this._attackAction.weapon)) {
      this._attackAction.type = BattleActionType.BA_SNAPSHOT;
      return;
    }
    if (tuAimed && currentTU >= this._unit.getActionTUs(BattleActionType.BA_AIMEDSHOT, this._attackAction.weapon)) {
      this._attackAction.type = BattleActionType.BA_AIMEDSHOT;
      return;
    }
    if (tuAuto && currentTU >= this._unit.getActionTUs(BattleActionType.BA_AUTOSHOT, this._attackAction.weapon)) {
      this._attackAction.type = BattleActionType.BA_AUTOSHOT;
    }
  }

  grenadeAction(): void {
    const grenade = this._unit.getGrenadeFromBelt();
    const engine = this._save.getTileEngine();
    if (!grenade || !engine || !this._aggroTarget) {
      return;
    }
    let tu = 4;
    tu += this._unit.getActionTUs(BattleActionType.BA_PRIME, grenade);
    tu += this._unit.getActionTUs(BattleActionType.BA_THROW, grenade);
    if (tu <= this._unit.getTimeUnits()) {
      const action = createBattleAction();
      action.weapon = grenade;
      action.type = BattleActionType.BA_THROW;
      action.actor = this._unit;

      if (this.explosiveEfficacy(this._aggroTarget.getPosition(), this._unit, grenade.getRules().getExplosionRadius(), this._attackAction.diff, true)) {
        action.target = this._aggroTarget.getPosition().clone();
      } else if (!this.getNodeOfBestEfficacy(action)) {
        return;
      }

      const targetTile = this._save.getTile(action.target);
      if (!targetTile) {
        return;
      }
      const originVoxel = engine.getOriginVoxel(action, null);
      const targetVoxel = action.target.multiply(new Position(16, 16, 24)).add(
        new Position(8, 8, 2 - targetTile.getTerrainLevel())
      );

      if (engine.validateThrow(action, originVoxel, targetVoxel)) {
        this._attackAction.weapon = grenade;
        this._attackAction.target = action.target.clone();
        this._attackAction.type = BattleActionType.BA_THROW;
        this._attackAction.TU = tu;
        this._rifle = false;
        this._melee = false;
      }
    }
  }

  getNodeOfBestEfficacy(action: BattleAction): boolean {
    const engine = this._save.getTileEngine();
    const weapon = action.weapon;
    if (!engine || !weapon) {
      return false;
    }
    const mod = this._save.getBattleState()?.getGame().getMod?.();
    if (this._save.getTurn() < (mod?.getTurnAIUseGrenade?.() ?? 3)) {
      return false;
    }

    let bestScore = 2;
    const originVoxel = engine.getSightOriginVoxel(this._unit);
    const targetVoxel = new Position();
    for (const node of this._save.getNodes()) {
      if (node.isDummy()) {
        continue;
      }
      let dist = engine.distance(node.getPosition(), this._unit.getPosition());
      if (dist <= 20 && dist > weapon.getRules().getExplosionRadius() &&
        engine.canTargetTile(originVoxel, this._save.getTile(node.getPosition()), TilePart.O_FLOOR, targetVoxel, this._unit, false)) {
        let nodePoints = 0;
        for (const unit of this._save.getUnits()) {
          dist = engine.distance(node.getPosition(), unit.getPosition());
          if (!unit.isOut() && dist < weapon.getRules().getExplosionRadius()) {
            const targetOriginVoxel = engine.getSightOriginVoxel(unit);
            if (engine.canTargetTile(targetOriginVoxel, this._save.getTile(node.getPosition()), TilePart.O_FLOOR, targetVoxel, unit, false)) {
              if ((this._unit.getFaction() === UnitFaction.FACTION_HOSTILE && unit.getFaction() !== UnitFaction.FACTION_HOSTILE) ||
                (this._unit.getFaction() === UnitFaction.FACTION_NEUTRAL && unit.getFaction() === UnitFaction.FACTION_HOSTILE)) {
                if (unit.getTurnsSinceSpotted() <= this._intelligence) {
                  nodePoints++;
                }
              } else {
                nodePoints -= 2;
              }
            }
          }
        }
        if (nodePoints > bestScore) {
          bestScore = nodePoints;
          action.target = node.getPosition().clone();
        }
      }
    }
    return bestScore > 2;
  }

  psiAction(): boolean {
    const engine = this._save.getTileEngine();
    const item = this._unit.getSpecialWeapon(BattleType.BT_PSIAMP);
    if (!engine || !item) {
      return false;
    }
    const psiWeaponRules = item.getRules();
    let cost = psiWeaponRules.getTUUse();
    if (!psiWeaponRules.getFlatRate()) {
      cost = Math.floor(this._unit.getBaseStats().tu * cost / 100.0);
    }
    const losRequired = psiWeaponRules.isLOSRequired();

    this._aggroTarget = null;
    if (this._unit.getOriginalFaction() === this._unit.getFaction() &&
      this._unit.getTimeUnits() > this._escapeTUs + cost &&
      !this._didPsi) {
      const psiAttackStrength = Math.trunc(this._unit.getBaseStats().psiSkill * this._unit.getBaseStats().psiStrength / 50);
      let chanceToAttack = 0;

      for (const unit of this._save.getUnits()) {
        if (unit.getArmor().getSize() === 1 &&
          this.validTarget(unit, true, false) &&
          unit.getOriginalFaction() === this._targetFaction &&
          (!losRequired || this._unit.getVisibleUnits().includes(unit))) {
          const chanceToAttackMe = Math.trunc(
            psiAttackStrength +
            (unit.getBaseStats().psiSkill > 0 ? unit.getBaseStats().psiSkill * -0.4 : 0) -
            engine.distance(unit.getPosition(), this._unit.getPosition()) -
            unit.getBaseStats().psiStrength +
            RNG.generate(55, 105)
          );

          if (chanceToAttackMe > chanceToAttack) {
            chanceToAttack = chanceToAttackMe;
            this._aggroTarget = unit;
          }
        }
      }

      if (!this._aggroTarget || !chanceToAttack) {
        return false;
      }

      const ammo = this._attackAction.weapon?.getAmmoItem();
      if (this._visibleEnemies && this._attackAction.weapon && ammo) {
        if (ammo.getRules().getPower() >= chanceToAttack) {
          return false;
        }
      } else if (RNG.generate(35, 155) >= chanceToAttack) {
        return false;
      }

      if (chanceToAttack >= 30) {
        let controlOdds = 40;
        const morale = this._aggroTarget.getMorale();
        const bravery = Math.trunc((110 - this._aggroTarget.getBaseStats().bravery) / 10);
        if (bravery > 6) {
          controlOdds -= 15;
        }
        if (bravery < 4) {
          controlOdds += 15;
        }
        if (morale >= 40) {
          if (morale - 10 * bravery < 50) {
            controlOdds -= 15;
          }
        } else {
          controlOdds += 15;
        }
        if (!morale) {
          controlOdds = 100;
        }
        if (RNG.percent(controlOdds)) {
          this._psiAction.type = BattleActionType.BA_MINDCONTROL;
          this._psiAction.target = this._aggroTarget.getPosition().clone();
          this._psiAction.weapon = item;
          return true;
        }
      }

      this._psiAction.type = BattleActionType.BA_PANIC;
      this._psiAction.target = this._aggroTarget.getPosition().clone();
      this._psiAction.weapon = item;
      return true;
    }
    return false;
  }

  explosiveEfficacy(targetPosLike: PositionLike, attackingUnit: BattleUnit, radius: number, diff: number, grenade = false): boolean {
    const targetPos = Position.from(targetPosLike);
    const engine = this._save.getTileEngine();
    const battleState = this._save.getBattleState();
    const game = battleState?.getGame();
    const mod = game?.getMod?.();
    const blasterTurn = mod?.getTurnAIUseBlaster?.() ?? 3;
    const grenadeTurn = mod?.getTurnAIUseGrenade?.() ?? 3;
    if (!engine ||
      (!grenade && this._save.getTurn() < blasterTurn) ||
      (grenade && this._save.getTurn() < grenadeTurn)) {
      return false;
    }

    const targetTile = this._save.getTile(targetPos);
    if (!targetTile) {
      return false;
    }

    if (grenade && targetPos.z > 0 && targetTile.hasNoFloor(this._save.getTile(targetPos.subtract(new Position(0, 0, 1))))) {
      return false;
    }

    if (diff === -1) {
      const savedGame = game?.getSavedGame?.();
      diff = savedGame?.getDifficultyCoefficient?.() ?? savedGame?.getDifficulty?.() ?? 0;
    }

    const distance = engine.distance(attackingUnit.getPosition(), targetPos);
    const injuryLevel = attackingUnit.getBaseStats().health - attackingUnit.getHealth();
    let desperation = Math.trunc((100 - attackingUnit.getMorale()) / 10);
    let enemiesAffected = 0;
    if (injuryLevel > Math.trunc(attackingUnit.getBaseStats().health / 3) * 2) {
      desperation += 3;
    }

    let efficacy = desperation;
    if (Math.abs(attackingUnit.getPosition().z - targetPos.z) <= Options.battleExplosionHeight && distance <= radius) {
      efficacy -= 4;
    }

    efficacy += Math.trunc(diff / 2);

    const target = targetTile.getUnit();
    if (target && !targetTile.getDangerous()) {
      ++enemiesAffected;
      ++efficacy;
    }

    for (const unit of this._save.getUnits()) {
      if (!unit.isOut() &&
        unit !== attackingUnit &&
        unit !== target &&
        Math.abs(unit.getPosition().z - targetPos.z) <= Options.battleExplosionHeight &&
        engine.distance(unit.getPosition(), targetPos) <= radius) {
        if (unit.getTile()?.getDangerous?.() ||
          (unit.getFaction() === this._targetFaction && unit.getTurnsSinceSpotted() > this._intelligence)) {
          continue;
        }

        const voxelPosA = new Position((targetPos.x * 16) + 8, (targetPos.y * 16) + 8, (targetPos.z * 24) + 12);
        const unitPos = unit.getPosition();
        const voxelPosB = new Position((unitPos.x * 16) + 8, (unitPos.y * 16) + 8, (unitPos.z * 24) + 12);
        const traj: Position[] = [];
        const collidesWith = engine.calculateLine(voxelPosA, voxelPosB, false, traj, target, true, false, unit);
        const hit = traj[0];

        if (collidesWith === VoxelType.V_UNIT && hit && hit.divide(new Position(16, 16, 24)).equals(unit.getPosition())) {
          if (unit.getFaction() === this._targetFaction) {
            ++enemiesAffected;
            ++efficacy;
          } else if (unit.getFaction() === attackingUnit.getFaction() ||
            (attackingUnit.getFaction() === UnitFaction.FACTION_NEUTRAL && unit.getFaction() === UnitFaction.FACTION_PLAYER)) {
            efficacy -= 2;
          }
        }
      }
    }

    if (grenade && desperation < 6 && enemiesAffected < 2) {
      return false;
    }
    return efficacy > 0 || enemiesAffected >= 10;
  }

  evaluateAIMode(): void {
    if (this._unit.getCharging() && this._attackAction.type !== BattleActionType.BA_RETHINK) {
      this._AIMode = AIMode.AI_COMBAT;
      return;
    }

    let escapeOdds = 15;
    if (this._melee) {
      escapeOdds = 12;
    }
    if (this._unit.getFaction() === UnitFaction.FACTION_HOSTILE &&
      (this._unit.getTimeUnits() > this._unit.getBaseStats().tu / 2 || this._unit.getCharging())) {
      escapeOdds = 5;
    }
    let ambushOdds = 12;
    let combatOdds = 20;
    let patrolOdds = this._visibleEnemies ? 15 : 30;

    if (this._spottingEnemies) {
      patrolOdds = 0;
      if (this._escapeTUs === 0) {
        this.setupEscape();
      }
    }

    if (!this._rifle || this._ambushTUs === 0) {
      ambushOdds = 0;
      if (this._melee) {
        combatOdds = scaleOdds(combatOdds, 1.3);
      }
    }

    if (this._knownEnemies) {
      if (this._knownEnemies === 1) {
        combatOdds = scaleOdds(combatOdds, 1.2);
      }
      if (this._escapeTUs === 0) {
        if (this.selectClosestKnownEnemy()) {
          this.setupEscape();
        } else {
          escapeOdds = 0;
        }
      }
    } else if (this._unit.getFaction() === UnitFaction.FACTION_HOSTILE) {
      combatOdds = 0;
      escapeOdds = 0;
    }

    switch (this._AIMode) {
      case AIMode.AI_PATROL:
        patrolOdds = scaleOdds(patrolOdds, 1.1);
        break;
      case AIMode.AI_AMBUSH:
        ambushOdds = scaleOdds(ambushOdds, 1.1);
        break;
      case AIMode.AI_COMBAT:
        combatOdds = scaleOdds(combatOdds, 1.1);
        break;
      case AIMode.AI_ESCAPE:
        escapeOdds = scaleOdds(escapeOdds, 1.1);
        break;
    }

    const baseHealth = this._unit.getBaseStats().health;
    if (this._unit.getHealth() < baseHealth / 3) {
      escapeOdds = scaleOdds(escapeOdds, 1.7);
      combatOdds = scaleOdds(combatOdds, 0.6);
      ambushOdds = scaleOdds(ambushOdds, 0.75);
    } else if (this._unit.getHealth() < 2 * (baseHealth / 3)) {
      escapeOdds = scaleOdds(escapeOdds, 1.4);
      combatOdds = scaleOdds(combatOdds, 0.8);
      ambushOdds = scaleOdds(ambushOdds, 0.8);
    } else if (this._unit.getHealth() < baseHealth) {
      escapeOdds = scaleOdds(escapeOdds, 1.1);
    }

    switch (this._unit.getAggression()) {
      case 0:
        escapeOdds = scaleOdds(escapeOdds, 1.4);
        combatOdds = scaleOdds(combatOdds, 0.7);
        break;
      case 1:
        ambushOdds = scaleOdds(ambushOdds, 1.1);
        break;
      case 2:
        combatOdds = scaleOdds(combatOdds, 1.4);
        escapeOdds = scaleOdds(escapeOdds, 0.7);
        break;
      default:
        combatOdds = scaleOdds(combatOdds, clamp(1.2 + (this._unit.getAggression() / 10.0), 0.1, 2.0));
        escapeOdds = scaleOdds(escapeOdds, clamp(0.9 - (this._unit.getAggression() / 10.0), 0.1, 2.0));
        break;
    }

    if (this._AIMode === AIMode.AI_COMBAT) {
      ambushOdds = scaleOdds(ambushOdds, 1.5);
    }

    if (this._spottingEnemies) {
      escapeOdds = Math.trunc(10 * escapeOdds * (this._spottingEnemies + 10) / 100);
      combatOdds = Math.trunc(5 * combatOdds * (this._spottingEnemies + 20) / 100);
    } else {
      escapeOdds = Math.trunc(escapeOdds / 2);
    }

    if (this._visibleEnemies) {
      combatOdds = Math.trunc(10 * combatOdds * (this._visibleEnemies + 10) / 100);
      if (this._closestDist < 5) {
        ambushOdds = 0;
      }
    }

    if (this._ambushTUs) {
      ambushOdds = scaleOdds(ambushOdds, 1.7);
    } else {
      ambushOdds = 0;
    }

    if (this._save.getMissionType() === "STR_BASE_DEFENSE") {
      escapeOdds = scaleOdds(escapeOdds, 0.75);
      ambushOdds = scaleOdds(ambushOdds, 0.6);
    }

    if (!this._melee && !this._rifle && !this._blaster && !this._unit.getGrenadeFromBelt() && this._unit.getBaseStats().psiSkill === 0) {
      combatOdds = 0;
      ambushOdds = 0;
    }

    const decision = RNG.generate(1, Math.max(1, patrolOdds + ambushOdds + escapeOdds + combatOdds));
    if (decision > escapeOdds) {
      if (decision > escapeOdds + ambushOdds) {
        if (decision > escapeOdds + ambushOdds + combatOdds) {
          this._AIMode = AIMode.AI_PATROL;
        } else {
          this._AIMode = AIMode.AI_COMBAT;
        }
      } else {
        this._AIMode = AIMode.AI_AMBUSH;
      }
    } else {
      this._AIMode = AIMode.AI_ESCAPE;
    }

    if ((this._unit.getFaction() === UnitFaction.FACTION_HOSTILE && this._save.isCheating()) || this._unit.getCharging()) {
      this._AIMode = AIMode.AI_COMBAT;
    }

    if (this._AIMode === AIMode.AI_COMBAT) {
      const attackTile = this._save.getTile(this._attackAction.target);
      if (attackTile?.getUnit()) {
        if (this._attackAction.type !== BattleActionType.BA_RETHINK) {
          return;
        }
        if (this.findFirePoint()) {
          return;
        }
      } else if (this.selectRandomTarget() && this.findFirePoint()) {
        return;
      }
      this._AIMode = AIMode.AI_PATROL;
    }

    if (this._AIMode === AIMode.AI_PATROL) {
      if (this._toNode) {
        return;
      }
      if (this._patrolAction.type === BattleActionType.BA_SNAPSHOT) {
        return;
      }
      this._AIMode = AIMode.AI_AMBUSH;
    }

    if (this._AIMode === AIMode.AI_AMBUSH) {
      if (this._ambushTUs !== 0) {
        return;
      }
      this._AIMode = AIMode.AI_ESCAPE;
    }
  }

  findFirePoint(): boolean {
    if (!this.selectClosestKnownEnemy() || !this._aggroTarget) {
      return false;
    }
    const engine = this._save.getTileEngine();
    const pathfinding = this._save.getPathfinding();
    if (!engine || !pathfinding) {
      return false;
    }
    const randomTileSearch = this._save.getTileSearch().map(pos => pos.clone());
    RNG.shuffle(randomTileSearch);
    const target = new Position();
    const BASE_SYSTEMATIC_SUCCESS = 100;
    const FAST_PASS_THRESHOLD = 125;
    let bestScore = 0;
    this._attackAction.type = BattleActionType.BA_RETHINK;

    for (const offset of randomTileSearch) {
      const pos = this._unit.getPosition().add(offset);
      const tile = this._save.getTile(pos);
      if (!tile || !this._reachableWithAttack.includes(this._save.getTileIndex(pos))) {
        continue;
      }
      let score = 0;
      const origin = pos.multiply(new Position(16, 16, 24)).add(
        new Position(8, 8, this._unit.getHeight() + this._unit.getFloatHeight() - tile.getTerrainLevel() - 4)
      );

      if (engine.canTargetUnit(origin, this._aggroTarget.getTile() as ReturnType<SavedBattleGame["getTile"]>, target, this._unit, false)) {
        pathfinding.calculate(this._unit, pos);
        if (pathfinding.getStartDirection() !== -1) {
          score = BASE_SYSTEMATIC_SUCCESS - this.getSpottingUnits(pos) * 10;
          score += this._unit.getTimeUnits() - pathfinding.getTotalTUCost();
          if (!this._aggroTarget.checkViewSector(pos)) {
            score += 10;
          }
          if (score > bestScore) {
            bestScore = score;
            this._attackAction.target = pos.clone();
            this._attackAction.finalFacing = engine.getDirectionTo(pos, this._aggroTarget.getPosition());
            if (score > FAST_PASS_THRESHOLD) {
              break;
            }
          }
        }
      }
    }

    if (bestScore > 70) {
      this._attackAction.type = BattleActionType.BA_WALK;
      return true;
    }

    return false;
  }

  selectMeleeOrRanged(): void {
    const rangedWeapon = this._attackAction.weapon?.getRules() || null;
    const meleeItem = this._unit.getMeleeWeapon();
    const meleeWeapon = meleeItem ? meleeItem.getRules() : null;

    if (!meleeWeapon) {
      this._melee = false;
      return;
    }
    if (!rangedWeapon || this._attackAction.weapon?.getAmmoItem() === null) {
      this._rifle = false;
      return;
    }
    if (!this._aggroTarget) {
      this._melee = false;
      return;
    }

    let meleeOdds = 10;
    let dmg = meleeWeapon.getPower();
    if (meleeWeapon.isStrengthApplied()) {
      dmg += this._unit.getBaseStats().strength;
    }
    dmg *= this._aggroTarget.getArmor().getDamageModifier(meleeWeapon.getDamageType());

    if (dmg > 50) {
      meleeOdds += Math.trunc((dmg - 50) / 2);
    }
    if (this._visibleEnemies > 1) {
      meleeOdds -= 20 * (this._visibleEnemies - 1);
    }

    if (meleeOdds > 0 && this._unit.getHealth() >= 2 * this._unit.getBaseStats().health / 3) {
      if (this._unit.getAggression() === 0) {
        meleeOdds -= 20;
      } else if (this._unit.getAggression() > 1) {
        meleeOdds += 10 * this._unit.getAggression();
      }

      if (RNG.percent(meleeOdds)) {
        this._rifle = false;
        this._reachableWithAttack = this._save.getPathfinding()?.findReachable(
          this._unit,
          this._unit.getTimeUnits() - this._unit.getActionTUs(BattleActionType.BA_HIT, meleeWeapon)
        ) || [];
        return;
      }
    }
    this._melee = false;
  }

  load(node: AIModuleSave): void {
    const fromNodeID = node.fromNode ?? -1;
    const toNodeID = node.toNode ?? -1;
    this._AIMode = node.AIMode ?? AIMode.AI_PATROL;
    this._wasHitBy = [...(node.wasHitBy || this._wasHitBy)];
    if (fromNodeID >= 0 && fromNodeID < this._save.getNodes().length) {
      this._fromNode = this._save.getNodes()[fromNodeID];
    }
    if (toNodeID >= 0 && toNodeID < this._save.getNodes().length) {
      this._toNode = this._save.getNodes()[toNodeID];
    }
  }

  save(): AIModuleSave {
    return {
      fromNode: this._fromNode ? this._fromNode.getID() : -1,
      toNode: this._toNode ? this._toNode.getID() : -1,
      AIMode: this._AIMode,
      wasHitBy: [...this._wasHitBy]
    };
  }

  setWasHitBy(attacker: BattleUnit): void {
    if (attacker.getFaction() !== this._unit.getFaction() && !this.getWasHitBy(attacker.getId())) {
      this._wasHitBy.push(attacker.getId());
    }
  }

  getWasHitBy(attacker: number): boolean {
    return this._wasHitBy.includes(attacker);
  }

  countKnownTargets(): number {
    let knownEnemies = 0;
    if (this._unit.getFaction() === UnitFaction.FACTION_HOSTILE) {
      for (const unit of this._save.getUnits()) {
        if (this.validTarget(unit, true, true)) {
          ++knownEnemies;
        }
      }
    }
    return knownEnemies;
  }

  getSpottingUnits(posLike: PositionLike): number {
    const pos = Position.from(posLike);
    const checking = !pos.equals(this._unit.getPosition());
    let tally = 0;
    const engine = this._save.getTileEngine();
    if (!engine) {
      return 0;
    }
    for (const unit of this._save.getUnits()) {
      if (this.validTarget(unit, false, false)) {
        const dist = engine.distance(pos, unit.getPosition());
        if (dist > 20) {
          continue;
        }
        const originVoxel = engine.getSightOriginVoxel(unit);
        originVoxel.z -= 2;
        const targetVoxel = new Position();
        if (engine.canTargetUnit(originVoxel, this._save.getTile(pos), targetVoxel, unit, false, checking ? this._unit : null)) {
          tally++;
        }
      }
    }
    return tally;
  }

  selectNearestTarget(): number {
    let tally = 0;
    this._closestDist = 100;
    this._aggroTarget = null;
    const target = new Position();
    const engine = this._save.getTileEngine();
    if (!engine) {
      return 0;
    }

    for (const unit of this._save.getUnits()) {
      if (this.validTarget(unit, true, this._unit.getFaction() === UnitFaction.FACTION_HOSTILE) &&
        engine.visible(this._unit, unit.getTile() as ReturnType<SavedBattleGame["getTile"]>)) {
        tally++;
        const dist = engine.distance(this._unit.getPosition(), unit.getPosition());
        if (dist < this._closestDist) {
          let valid = false;
          if (this._rifle || !this._melee) {
            const action = createBattleAction();
            action.actor = this._unit;
            action.weapon = this._attackAction.weapon;
            action.target = unit.getPosition();
            const origin = engine.getOriginVoxel(action, null);
            valid = engine.canTargetUnit(origin, unit.getTile() as ReturnType<SavedBattleGame["getTile"]>, target, this._unit, false);
          } else if (this.selectPointNearTarget(unit, this._unit.getTimeUnits())) {
            const dir = engine.getDirectionTo(this._attackAction.target, unit.getPosition());
            valid = engine.validMeleeRange(this._attackAction.target, dir, this._unit, unit, null);
          }
          if (valid) {
            this._closestDist = dist;
            this._aggroTarget = unit;
          }
        }
      }
    }
    return this._aggroTarget ? tally : 0;
  }

  selectClosestKnownEnemy(): boolean {
    this._aggroTarget = null;
    let minDist = 255;
    const engine = this._save.getTileEngine();
    if (!engine) {
      return false;
    }
    for (const unit of this._save.getUnits()) {
      if (this.validTarget(unit, true, false)) {
        const dist = engine.distance(unit.getPosition(), this._unit.getPosition());
        if (dist < minDist) {
          minDist = dist;
          this._aggroTarget = unit;
        }
      }
    }
    return this._aggroTarget !== null;
  }

  selectRandomTarget(): boolean {
    let farthest = -100;
    this._aggroTarget = null;
    const engine = this._save.getTileEngine();
    if (!engine) {
      return false;
    }
    for (const unit of this._save.getUnits()) {
      if (this.validTarget(unit, true, this._unit.getFaction() === UnitFaction.FACTION_HOSTILE)) {
        const dist = RNG.generate(0, 20) - engine.distance(this._unit.getPosition(), unit.getPosition());
        if (dist > farthest) {
          farthest = dist;
          this._aggroTarget = unit;
        }
      }
    }
    return this._aggroTarget !== null;
  }

  selectPointNearTarget(target: BattleUnit, maxTUs: number): boolean {
    const size = this._unit.getArmor().getSize();
    const targetsize = target.getArmor().getSize();
    let returnValue = false;
    let distance = 1000;
    const engine = this._save.getTileEngine();
    const pathfinding = this._save.getPathfinding();
    if (!engine || !pathfinding) {
      return false;
    }
    for (let z = -1; z <= 1; ++z) {
      for (let x = -size; x <= targetsize; ++x) {
        for (let y = -size; y <= targetsize; ++y) {
          if (!x && !y) {
            continue;
          }
          const checkPath = target.getPosition().add(new Position(x, y, z));
          const tile = this._save.getTile(checkPath);
          if (!tile || !this._reachable.includes(this._save.getTileIndex(checkPath))) {
            continue;
          }
          const dir = engine.getDirectionTo(checkPath, target.getPosition());
          const valid = engine.validMeleeRange(checkPath, dir, this._unit, target, null);
          const fitHere = this._save.setUnitPosition(this._unit, checkPath, true);
          if (valid && fitHere && !tile.getDangerous()) {
            pathfinding.calculate(this._unit, checkPath, null, maxTUs);
            if (pathfinding.getStartDirection() !== -1 && pathfinding.getPath().length < distance) {
              this._attackAction.target = checkPath;
              returnValue = true;
              distance = pathfinding.getPath().length;
            }
            pathfinding.abortPath();
          }
        }
      }
    }
    return returnValue;
  }

  validTarget(unit: BattleUnit, assessDanger: boolean, includeCivs: boolean): boolean {
    if (unit.isOut() ||
      (this._unit.getFaction() === UnitFaction.FACTION_HOSTILE && this._intelligence < unit.getTurnsSinceSpotted()) ||
      (assessDanger && Boolean(unit.getTile()?.getDangerous?.())) ||
      unit.getFaction() === this._unit.getFaction()) {
      return false;
    }

    if (includeCivs) {
      return true;
    }
    return unit.getFaction() === this._targetFaction;
  }

  getReserveMode(): BattleActionType {
    return this._reserve;
  }

  getTarget(): BattleUnit | null {
    return this._aggroTarget;
  }

  freePatrolTarget(): void {
    this._toNode?.freeNode();
  }
}
