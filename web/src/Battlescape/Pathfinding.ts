import { Options } from "../Engine/Options.ts";
import { MovementType } from "../Mod/Armor.ts";
import { TilePart } from "../Mod/MapData.ts";
import { SpecialAbility } from "../Mod/Unit.ts";
import { UnitFaction, type BattleUnit } from "../Savegame/BattleUnit.ts";
import type { SavedBattleGame } from "../Savegame/SavedBattleGame.ts";
import type { Tile } from "../Savegame/Tile.ts";
import { KMOD_CTRL } from "../types.ts";
import { BattleActionType } from "./BattleAction.ts";
import { PathfindingOpenSet } from "./PathfindingOpenSet.ts";
import { PathfindingNode } from "./PathfindingNode.ts";
import { Position, type PositionLike } from "./Position.ts";

export enum BigWallType {
  BLOCK = 1,
  BIGWALLNESW,
  BIGWALLNWSE,
  BIGWALLWEST,
  BIGWALLNORTH,
  BIGWALLEAST,
  BIGWALLSOUTH,
  BIGWALLEASTANDSOUTH,
  BIGWALLWESTANDNORTH
}

/**
 * A utility class that calculates the shortest path between two points on the battlescape map.
 */
export class Pathfinding {
  private _save: SavedBattleGame;
  private _nodes: PathfindingNode[] = [];
  private _size = 0;
  private _unit: BattleUnit | null = null;
  private _pathPreviewed = false;
  private _strafeMove = false;
  private _totalTUCost = 0;
  private _modifierUsed = false;
  private _movementType = MovementType.MT_WALK;
  private _path: number[] = [];

  static readonly DIR_UP = 8;
  static readonly DIR_DOWN = 9;
  static readonly O_BIGWALL = -1;

  static readonly BLOCK = BigWallType.BLOCK;
  static readonly BIGWALLNESW = BigWallType.BIGWALLNESW;
  static readonly BIGWALLNWSE = BigWallType.BIGWALLNWSE;
  static readonly BIGWALLWEST = BigWallType.BIGWALLWEST;
  static readonly BIGWALLNORTH = BigWallType.BIGWALLNORTH;
  static readonly BIGWALLEAST = BigWallType.BIGWALLEAST;
  static readonly BIGWALLSOUTH = BigWallType.BIGWALLSOUTH;
  static readonly BIGWALLEASTANDSOUTH = BigWallType.BIGWALLEASTANDSOUTH;
  static readonly BIGWALLWESTANDNORTH = BigWallType.BIGWALLWESTANDNORTH;

  static red = 3;
  static green = 4;
  static yellow = 10;

  constructor(save: SavedBattleGame) {
    this._save = save;
    this._size = this._save.getMapSizeXYZ();
    this._nodes = [];
    for (let i = 0; i < this._size; ++i) {
      this._nodes.push(new PathfindingNode(this._save.getTileCoords(i)));
    }
  }

  isOnStairs(_startPosition: PositionLike, _endPosition: PositionLike): boolean {
    const startPosition = Position.from(_startPosition);
    const endPosition = Position.from(_endPosition);
    const south1 = endPosition.add(new Position(0, 1, 0));
    const south2 = endPosition.add(new Position(0, 2, 0));
    const south3 = endPosition.add(new Position(0, 3, 0));
    const east1 = endPosition.add(new Position(1, 0, 0));
    const east2 = endPosition.add(new Position(2, 0, 0));
    const east3 = endPosition.add(new Position(3, 0, 0));

    // X-COM stairs.
    if (this._save.getTile(south1)?.getTerrainLevel() === -16) {
      if (this._save.getTile(south2) && this._save.getTile(south2)?.getTerrainLevel() !== -8) {
        return false;
      }
      if (startPosition.equals(south1) || startPosition.equals(south2) || startPosition.equals(south3)) {
        return true;
      }
    }
    if (this._save.getTile(east1)?.getTerrainLevel() === -16) {
      if (this._save.getTile(east2) && this._save.getTile(east2)?.getTerrainLevel() !== -8) {
        return false;
      }
      if (startPosition.equals(east1) || startPosition.equals(east2) || startPosition.equals(east3)) {
        return true;
      }
    }

    // TFTD stairs.
    if (this._save.getTile(south1)?.getTerrainLevel() === -18) {
      if (this._save.getTile(south2) && this._save.getTile(south2)?.getTerrainLevel() !== -12) {
        return false;
      }
      if (startPosition.equals(south1) || startPosition.equals(south2) || startPosition.equals(south3)) {
        return true;
      }
    }
    if (this._save.getTile(east1)?.getTerrainLevel() === -18) {
      if (this._save.getTile(east2) && this._save.getTile(east2)?.getTerrainLevel() !== -12) {
        return false;
      }
      if (startPosition.equals(east1) || startPosition.equals(east2) || startPosition.equals(east3)) {
        return true;
      }
    }
    return false;
  }

  isBlocked(tile: Tile | null, part: number, missileTarget: BattleUnit | null, bigWallExclusion?: number): boolean;
  isBlocked(startTile: Tile | null, endTile: Tile | null, direction: number, missileTarget: BattleUnit | null): boolean;
  isBlocked(startTile: Tile | null, endTileOrPart: Tile | number | null, directionOrMissileTarget: number | BattleUnit | null, missileTargetOrBigWallExclusion?: BattleUnit | number | null, _bigWallExclusion = -1): boolean {
    if (typeof endTileOrPart === "number") {
      const missileTarget = (directionOrMissileTarget || null) as BattleUnit | null;
      const bigWallExclusion = typeof missileTargetOrBigWallExclusion === "number" ? missileTargetOrBigWallExclusion : _bigWallExclusion;
      return this.isBlockedPart(startTile, endTileOrPart, missileTarget, bigWallExclusion);
    }
    return this.isBlockedDirection(startTile, endTileOrPart, directionOrMissileTarget as number, (missileTargetOrBigWallExclusion || null) as BattleUnit | null);
  }

  calculate(unit: BattleUnit, _endPosition: PositionLike, target: BattleUnit | null = null, maxTUCost = 1000): void {
    this._totalTUCost = 0;
    this._path = [];
    let endPosition = Position.from(_endPosition);
    if (endPosition.x > this._save.getMapSizeX() - unit.getArmor().getSize() ||
      endPosition.y > this._save.getMapSizeY() - unit.getArmor().getSize() ||
      endPosition.x < 0 ||
      endPosition.y < 0) {
      return;
    }

    const sneak = Options.sneakyAI && unit.getFaction() === UnitFaction.FACTION_HOSTILE;
    const startPosition = unit.getPosition();
    this._movementType = unit.getMovementType();
    if (target !== null && maxTUCost === -1) {
      this._movementType = MovementType.MT_FLY;
      maxTUCost = 10000;
    }
    this._unit = unit;

    let destinationTile = this._save.getTile(endPosition);
    if (this.isBlocked(destinationTile, TilePart.O_FLOOR, target) || this.isBlocked(destinationTile, TilePart.O_OBJECT, target)) {
      return;
    }

    if (this.isOnStairs(startPosition, endPosition)) {
      endPosition = endPosition.add(new Position(0, 0, 1));
      destinationTile = this._save.getTile(endPosition);
    }
    while (endPosition.z !== this._save.getMapSizeZ() && destinationTile?.getTerrainLevel() === -24) {
      endPosition = endPosition.add(new Position(0, 0, 1));
      destinationTile = this._save.getTile(endPosition);
    }
    if (endPosition.z === this._save.getMapSizeZ()) {
      return;
    }
    while (this.canFallDown(destinationTile, unit.getArmor().getSize()) && this._movementType !== MovementType.MT_FLY) {
      endPosition = endPosition.add(new Position(0, 0, -1));
      destinationTile = this._save.getTile(endPosition);
    }
    if (this.isBlocked(destinationTile, TilePart.O_FLOOR, target) || this.isBlocked(destinationTile, TilePart.O_OBJECT, target)) {
      return;
    }

    const size = unit.getArmor().getSize() - 1;
    if (size >= 1) {
      let its = 0;
      const dir = [4, 2, 3];
      for (let x = 0; x <= size; x += size) {
        for (let y = 0; y <= size; y += size) {
          if (x || y) {
            const checkTile = this._save.getTile(endPosition.add(new Position(x, y, 0)));
            if ((this.isBlocked(destinationTile, checkTile, dir[its], unit) &&
              this.isBlocked(destinationTile, checkTile, dir[its], target)) ||
              (checkTile?.getUnit() &&
                checkTile.getUnit() !== unit &&
                checkTile.getUnit()?.getVisible() &&
                checkTile.getUnit() !== target)) {
              return;
            }
            if (x && y) {
              if (checkTile?.getMapData(TilePart.O_NORTHWALL)?.isDoor() ||
                checkTile?.getMapData(TilePart.O_WESTWALL)?.isDoor()) {
                return;
              }
            }
            ++its;
          }
        }
      }
    }

    this._modifierUsed = (Options.getKeyModifiers() & KMOD_CTRL) !== 0;
    this._strafeMove = false;
    if (Options.strafe && startPosition.z === endPosition.z &&
      Math.abs(startPosition.x - endPosition.x) <= 1 &&
      Math.abs(startPosition.y - endPosition.y) <= 1) {
      this._strafeMove = this._modifierUsed;
    }

    if (startPosition.z === endPosition.z && this.bresenhamPath(startPosition, endPosition, target, sneak)) {
      this._path.reverse();
      return;
    }
    this.abortPath();
    if (!this.aStarPath(startPosition, endPosition, target, sneak, maxTUCost)) {
      this.abortPath();
    }
  }

  static directionToVector(direction: number, vector?: Position): Position {
    const x = [0, 1, 1, 1, 0, -1, -1, -1, 0, 0];
    const y = [-1, -1, 0, 1, 1, 1, 0, -1, 0, 0];
    const z = [0, 0, 0, 0, 0, 0, 0, 0, 1, -1];
    const result = vector || new Position();
    result.x = x[direction] ?? 0;
    result.y = y[direction] ?? 0;
    result.z = z[direction] ?? 0;
    return result;
  }

  static vectorToDirection(vector: PositionLike, dir?: { value: number }): number {
    const x = [0, 1, 1, 1, 0, -1, -1, -1];
    const y = [-1, -1, 0, 1, 1, 1, 0, -1];
    let result = -1;
    for (let i = 0; i < 8; ++i) {
      if (vector.x === x[i] && vector.y === y[i]) {
        result = i;
        break;
      }
    }
    if (dir) {
      dir.value = result;
    }
    return result;
  }

  getStartDirection(): number {
    if (this._path.length > 0) {
      return this._path[this._path.length - 1];
    }
    return -1;
  }

  dequeuePath(): number {
    if (this._path.length > 0) {
      return this._path.pop() ?? -1;
    }
    return -1;
  }

  getTUCost(_startPosition: PositionLike, direction: number, endPosition: Position, unit: BattleUnit, target: BattleUnit | null, missile: boolean): number {
    this._unit = unit;
    const startPosition = Position.from(_startPosition);
    this.assignPosition(endPosition, startPosition.add(Pathfinding.directionToVector(direction)));
    let fellDown = false;
    let triedStairs = false;
    const size = unit.getArmor().getSize() - 1;
    let cost = 0;
    let numberOfPartsGoingUp = 0;
    let numberOfPartsGoingDown = 0;
    let numberOfPartsFalling = 0;
    let numberOfPartsChangingHeight = 0;
    let totalCost = 0;

    for (let x = 0; x <= size; ++x) {
      for (let y = 0; y <= size; ++y) {
        const offset = new Position(x, y, 0);
        let startTile = this._save.getTile(startPosition.add(offset));
        let destinationTile = this._save.getTile(endPosition.add(offset));
        let belowDestination = this._save.getTile(endPosition.add(offset).add(new Position(0, 0, -1)));
        const aboveDestination = this._save.getTile(endPosition.add(offset).add(new Position(0, 0, 1)));

        if (!startTile || !destinationTile) {
          return 255;
        }
        if (!x && !y && this._movementType !== MovementType.MT_FLY && this.canFallDown(startTile, size + 1)) {
          if (direction !== Pathfinding.DIR_DOWN) {
            return 255;
          }
          fellDown = true;
        }
        if (direction < Pathfinding.DIR_UP && startTile.getTerrainLevel() > -16) {
          if (this.isBlocked(startTile, destinationTile, direction, target)) {
            return 255;
          }
          if (startTile.getTerrainLevel() - destinationTile.getTerrainLevel() > 8) {
            return 255;
          }
        }

        const verticalOffset = new Position();
        if (direction < Pathfinding.DIR_UP && startTile.getTerrainLevel() <= -16 && aboveDestination && !aboveDestination.hasNoFloor(destinationTile)) {
          numberOfPartsGoingUp++;
          verticalOffset.z++;
          if (!triedStairs) {
            endPosition.z++;
            destinationTile = this._save.getTile(endPosition.add(offset));
            belowDestination = this._save.getTile(endPosition.add(new Position(x, y, -1)));
            triedStairs = true;
          }
        } else if (direction < Pathfinding.DIR_UP && !fellDown && this._movementType !== MovementType.MT_FLY && belowDestination && this.canFallDown(destinationTile) && belowDestination.getTerrainLevel() <= -12) {
          numberOfPartsGoingDown++;
          if (numberOfPartsGoingDown === (size + 1) * (size + 1)) {
            endPosition.z--;
            destinationTile = this._save.getTile(endPosition.add(offset));
            belowDestination = this._save.getTile(endPosition.add(new Position(x, y, -1)));
            fellDown = true;
          }
        } else if (!missile && this._movementType === MovementType.MT_FLY && belowDestination && belowDestination.getUnit() && belowDestination.getUnit() !== unit) {
          const unitBelow = belowDestination.getUnit();
          if (unitBelow && unitBelow.getHeight() + unitBelow.getFloatHeight() - belowDestination.getTerrainLevel() > 26) {
            return 255;
          }
        }

        if (!destinationTile) {
          return 255;
        }

        if (direction < Pathfinding.DIR_UP && endPosition.z === startTile.getPosition().z) {
          if (this.isBlocked(startTile, destinationTile, direction, target)) {
            return 255;
          }
          if (startTile.getTerrainLevel() - destinationTile.getTerrainLevel() > 8) {
            return 255;
          }
        } else if (direction >= Pathfinding.DIR_UP && !fellDown) {
          if (this.validateUpDown(unit, startPosition.add(offset), direction, missile)) {
            cost = 8;
          } else {
            return 255;
          }
        }

        if (this._movementType !== MovementType.MT_FLY && !fellDown && this.canFallDown(startTile)) {
          numberOfPartsFalling++;
          if (numberOfPartsFalling === (size + 1) * (size + 1) && direction !== Pathfinding.DIR_DOWN) {
            return 0;
          }
        }
        startTile = this._save.getTile(startTile.getPosition().add(verticalOffset));
        if (!startTile) {
          return 255;
        }

        if (direction < Pathfinding.DIR_UP && numberOfPartsGoingUp !== 0) {
          if (this.isBlocked(startTile, destinationTile, direction, target)) {
            return 255;
          }
          if (startTile.getTerrainLevel() - destinationTile.getTerrainLevel() > 8) {
            return 255;
          }
        }

        let wallCounter = 0;
        let wallTmp = 0;
        let wallcost = 0;
        if (direction === 0 || direction === 7 || direction === 1) {
          wallTmp += startTile.getTUCost(TilePart.O_NORTHWALL, this._movementType);
          if (wallTmp > 0) {
            wallcost += wallTmp;
            wallCounter += 1;
          }
        }
        if (!fellDown && (direction === 2 || direction === 1 || direction === 3)) {
          wallTmp += destinationTile.getTUCost(TilePart.O_WESTWALL, this._movementType);
          if (wallTmp > 0) {
            wallcost += wallTmp;
            wallCounter += 1;
          }
        }
        if (!fellDown && (direction === 4 || direction === 3 || direction === 5)) {
          wallTmp += destinationTile.getTUCost(TilePart.O_NORTHWALL, this._movementType);
          if (wallTmp > 0) {
            wallcost += wallTmp;
            wallCounter += 1;
          }
        }
        if (direction === 6 || direction === 5 || direction === 7) {
          wallTmp += startTile.getTUCost(TilePart.O_WESTWALL, this._movementType);
          if (wallTmp > 0) {
            wallcost += wallTmp;
            wallCounter += 1;
          }
        }
        if (wallCounter > 0) {
          wallcost = Math.trunc(wallcost / wallCounter);
        }

        if (x && y) {
          if (destinationTile.getMapData(TilePart.O_NORTHWALL)?.isDoor() ||
            destinationTile.getMapData(TilePart.O_WESTWALL)?.isDoor()) {
            return 255;
          }
        }
        if (this.isBlocked(destinationTile, TilePart.O_FLOOR, target) || this.isBlocked(destinationTile, TilePart.O_OBJECT, target)) {
          return 255;
        }

        if (direction < Pathfinding.DIR_UP && !fellDown && destinationTile.hasNoFloor(null)) {
          cost = 4;
        }
        if (direction < Pathfinding.DIR_UP) {
          cost += destinationTile.getTUCost(TilePart.O_FLOOR, this._movementType);
          if (!fellDown && !triedStairs && destinationTile.getMapData(TilePart.O_OBJECT)) {
            cost += destinationTile.getTUCost(TilePart.O_OBJECT, this._movementType);
          }
          if (verticalOffset.z > 0) {
            cost++;
          }
        }

        if (direction < Pathfinding.DIR_UP && (direction & 1)) {
          cost = Math.trunc(cost * 1.5);
        }
        cost += wallcost;
        if (unit.getFaction() !== UnitFaction.FACTION_PLAYER &&
          unit.getSpecialAbility() < SpecialAbility.SPECAB_BURNFLOOR &&
          destinationTile.getFire() > 0) {
          cost += 32;
        }

        if (this._save.getDepth() > 0 && (destinationTile.getFire() > 0 || destinationTile.getSmoke() > 0)) {
          cost += 2;
        }

        if (missile && destinationTile.getUnit()) {
          const unitHere = destinationTile.getUnit();
          if (unitHere && unitHere !== target && !unitHere.isOut()) {
            if (unitHere.getFaction() === unit.getFaction()) {
              return 255;
            }
            const intelligence = unit.getUnitRules()?.getIntelligence() ?? null;
            if (intelligence !== null && unitHere.getTurnsSinceSpotted() <= intelligence) {
              return 255;
            }
          }
        }

        if (Options.strafe && this._strafeMove) {
          if (size) {
            this._strafeMove = false;
          } else if (Math.min(Math.abs(8 + direction - unit.getDirection()), Math.min(Math.abs(unit.getDirection() - direction), Math.abs(8 + unit.getDirection() - direction))) > 2) {
            this._strafeMove = false;
          } else if (unit.getDirection() !== direction) {
            cost += 1;
          }
        }

        totalCost += cost;
        cost = 0;
      }
    }

    if (size) {
      totalCost = Math.trunc(totalCost / ((size + 1) * (size + 1)));
      let startTile = this._save.getTile(endPosition.add(new Position(1, 1, 0)));
      let destinationTile = this._save.getTile(endPosition);
      if (!startTile || !destinationTile) {
        return 255;
      }
      if (this.isBlocked(startTile, destinationTile, 7, target)) {
        return 255;
      }
      if (!fellDown && Math.abs(startTile.getTerrainLevel() - destinationTile.getTerrainLevel()) > 10) {
        return 255;
      }
      startTile = this._save.getTile(endPosition.add(new Position(1, 0, 0)));
      destinationTile = this._save.getTile(endPosition.add(new Position(0, 1, 0)));
      if (!startTile || !destinationTile) {
        return 255;
      }
      if (this.isBlocked(startTile, destinationTile, 5, target)) {
        return 255;
      }
      if (!fellDown && Math.abs(startTile.getTerrainLevel() - destinationTile.getTerrainLevel()) > 10) {
        return 255;
      }
      if (numberOfPartsChangingHeight === 1) {
        return 255;
      }
    }

    if (missile) {
      return 0;
    }
    return totalCost;
  }

  abortPath(): void {
    this._totalTUCost = 0;
    this._path = [];
  }

  getStrafeMove(): boolean {
    return this._strafeMove;
  }

  validateUpDown(bu: BattleUnit, _startPosition: PositionLike, direction: number, missile = false): boolean {
    const startPosition = Position.from(_startPosition);
    const endPosition = Pathfinding.directionToVector(direction).add(startPosition);
    const startTile = this._save.getTile(startPosition);
    const belowStart = this._save.getTile(startPosition.add(new Position(0, 0, -1)));
    const destinationTile = this._save.getTile(endPosition);
    const startFloor = startTile?.getMapData(TilePart.O_FLOOR);
    const destinationFloor = destinationTile?.getMapData(TilePart.O_FLOOR);

    if (startFloor && destinationTile && destinationFloor && startFloor.isGravLift() && destinationFloor.isGravLift()) {
      if (missile) {
        if (direction === Pathfinding.DIR_UP) {
          if (destinationFloor.getLoftID(0) !== 0) {
            return false;
          }
        } else if (startFloor.getLoftID(0) !== 0) {
          return false;
        }
      }
      return true;
    }
    if (bu.getMovementType() === MovementType.MT_FLY) {
      if ((direction === Pathfinding.DIR_UP && destinationTile && destinationTile.hasNoFloor(startTile)) ||
        (direction === Pathfinding.DIR_DOWN && destinationTile && startTile?.hasNoFloor(belowStart))) {
        return true;
      }
    }
    return false;
  }

  previewPath(bRemove = false): boolean {
    if (this._path.length === 0 || !this._unit) {
      return false;
    }
    if (!bRemove && this._pathPreviewed) {
      return false;
    }

    this._pathPreviewed = !bRemove;
    let pos = this._unit.getPosition().clone();
    const destination = new Position();
    let tus = this._unit.getTimeUnits();
    if (this._unit.isKneeled()) {
      tus -= 8;
    }
    let energy = this._unit.getEnergy();
    const size = this._unit.getArmor().getSize() - 1;
    let total = this._unit.isKneeled() ? 8 : 0;
    let switchBack = false;
    if (this._save.getTUReserved() === BattleActionType.BA_NONE) {
      switchBack = true;
      this._save.setTUReserved(BattleActionType.BA_AUTOSHOT);
    }
    this._modifierUsed = (Options.getKeyModifiers() & KMOD_CTRL) !== 0;
    const running = Options.strafe && this._modifierUsed && this._unit.getArmor().getSize() === 1 && this._path.length > 1;

    for (let index = this._path.length - 1; index >= 0; --index) {
      const dir = this._path[index];
      let tu = this.getTUCost(pos, dir, destination, this._unit, null, false);
      let energyUse = tu;
      if (dir >= Pathfinding.DIR_UP) {
        energyUse = 0;
      } else if (running) {
        tu = Math.trunc(tu * 0.75);
        energyUse = Math.trunc(energyUse * 1.5);
      }
      energy -= Math.trunc(energyUse / 2);
      tus -= tu;
      total += tu;
      const reserve = this._save.checkReservedTU(this._unit, total, true);
      pos = destination.clone();
      for (let x = size; x >= 0; --x) {
        for (let y = size; y >= 0; --y) {
          const tile = this._save.getTile(pos.add(new Position(x, y, 0)));
          const tileAbove = this._save.getTile(pos.add(new Position(x, y, 1)));
          if (!tile) {
            continue;
          }
          if (!bRemove) {
            if (index === 0) {
              tile.setPreview(10);
            } else {
              tile.setPreview(this._path[index - 1]);
            }
            if ((x && y) || size === 0) {
              tile.setTUMarker(Math.max(0, tus));
            }
            if (tileAbove && tileAbove.getPreview() === 0 && tu === 0 && this._movementType !== MovementType.MT_FLY) {
              tileAbove.setPreview(Pathfinding.DIR_DOWN);
            }
          } else {
            tile.setPreview(-1);
            tile.setTUMarker(-1);
          }
          tile.setMarkerColor(bRemove ? 0 : ((tus >= 0 && energy >= 0) ? (reserve ? Pathfinding.green : Pathfinding.yellow) : Pathfinding.red));
        }
      }
    }
    if (switchBack) {
      this._save.setTUReserved(BattleActionType.BA_NONE);
    }
    return true;
  }

  removePreview(): boolean {
    if (!this._pathPreviewed) {
      return false;
    }
    return this.previewPath(true);
  }

  setUnit(unit: BattleUnit | null): void {
    this._unit = unit;
    this._movementType = unit ? unit.getMovementType() : MovementType.MT_WALK;
  }

  findReachable(unit: BattleUnit, tuMax: number): number[] {
    const start = unit.getPosition();
    const energyMax = unit.getEnergy();
    for (const node of this._nodes) {
      node.reset();
    }
    const startNode = this.getNode(start);
    startNode.connect(0, null, 0);
    const unvisited = new PathfindingOpenSet();
    unvisited.push(startNode);
    const reachable: PathfindingNode[] = [];
    while (!unvisited.empty()) {
      const currentNode = unvisited.pop();
      const currentPos = currentNode.getPosition();

      for (let direction = 0; direction < 10; ++direction) {
        const nextPos = new Position();
        const tuCost = this.getTUCost(currentPos, direction, nextPos, unit, null, false);
        if (tuCost === 255) {
          continue;
        }
        if (currentNode.getTUCost(false) + tuCost > tuMax || Math.trunc((currentNode.getTUCost(false) + tuCost) / 2) > energyMax) {
          continue;
        }
        const nextNode = this.getNode(nextPos);
        if (nextNode.isChecked()) {
          continue;
        }
        const totalTuCost = currentNode.getTUCost(false) + tuCost;
        if (!nextNode.inOpenSet() || nextNode.getTUCost(false) > totalTuCost) {
          nextNode.connect(totalTuCost, currentNode, direction);
          unvisited.push(nextNode);
        }
      }
      currentNode.setChecked();
      reachable.push(currentNode);
    }
    reachable.sort((a, b) => a.getTUCost(false) - b.getTUCost(false));
    return reachable.map(node => this._save.getTileIndex(node.getPosition()));
  }

  getTotalTUCost(): number {
    return this._totalTUCost;
  }

  isPathPreviewed(): boolean {
    return this._pathPreviewed;
  }

  isModifierUsed(): boolean {
    return this._modifierUsed;
  }

  getPath(): readonly number[] {
    return this._path;
  }

  copyPath(): number[] {
    return [...this._path];
  }

  private getNode(pos: PositionLike): PathfindingNode {
    const node = this._nodes[this._save.getTileIndex(pos)];
    if (!node) {
      throw new Error(`Pathfinding::getNode out of bounds ${Position.from(pos).toString()}`);
    }
    return node;
  }

  private assignPosition(target: Position, source: PositionLike): void {
    target.x = source.x;
    target.y = source.y;
    target.z = source.z;
  }

  private canFallDown(destinationTile: Tile | null, size?: number): boolean {
    if (!destinationTile) {
      return false;
    }
    if (size == null) {
      if (destinationTile.getPosition().z === 0) {
        return false;
      }
      const tileBelow = this._save.getTile(destinationTile.getPosition().subtract(new Position(0, 0, 1)));
      return destinationTile.hasNoFloor(tileBelow);
    }
    for (let x = 0; x !== size; ++x) {
      for (let y = 0; y !== size; ++y) {
        const checkPos = destinationTile.getPosition().add(new Position(x, y, 0));
        const checkTile = this._save.getTile(checkPos);
        if (!this.canFallDown(checkTile)) {
          return false;
        }
      }
    }
    return true;
  }

  private bresenhamPath(_origin: PositionLike, _target: PositionLike, targetUnit: BattleUnit | null, sneak = false, maxTUCost = 1000): boolean {
    if (!this._unit) {
      this.notTranslated("Pathfinding::bresenhamPath without unit");
    }
    const origin = Position.from(_origin);
    const target = Position.from(_target);
    const xd = [0, 1, 1, 1, 0, -1, -1, -1];
    const yd = [-1, -1, 0, 1, 1, 1, 0, -1];

    let x0 = origin.x;
    let x1 = target.x;
    let y0 = origin.y;
    let y1 = target.y;
    let z0 = origin.z;
    let z1 = target.z;

    const swap_xy = Math.abs(y1 - y0) > Math.abs(x1 - x0);
    if (swap_xy) {
      [x0, y0] = [y0, x0];
      [x1, y1] = [y1, x1];
    }

    const swap_xz = Math.abs(z1 - z0) > Math.abs(x1 - x0);
    if (swap_xz) {
      [x0, z0] = [z0, x0];
      [x1, z1] = [z1, x1];
    }

    const delta_x = Math.abs(x1 - x0);
    const delta_y = Math.abs(y1 - y0);
    const delta_z = Math.abs(z1 - z0);
    let drift_xy = Math.trunc(delta_x / 2);
    let drift_xz = Math.trunc(delta_x / 2);
    const step_x = x0 > x1 ? -1 : 1;
    const step_y = y0 > y1 ? -1 : 1;
    const step_z = z0 > z1 ? -1 : 1;
    let y = y0;
    let z = z0;
    let lastPoint = origin.clone();
    let lastTUCost = -1;
    this._totalTUCost = 0;

    for (let x = x0; x !== x1 + step_x; x += step_x) {
      let cx = x;
      let cy = y;
      let cz = z;
      if (swap_xz) {
        [cx, cz] = [cz, cx];
      }
      if (swap_xy) {
        [cx, cy] = [cy, cx];
      }

      if (x !== x0 || y !== y0 || z !== z0) {
        const realNextPoint = new Position(cx, cy, cz);
        const nextPoint = realNextPoint.clone();
        let dir = 0;
        for (; dir < 8; ++dir) {
          if (xd[dir] === cx - lastPoint.x && yd[dir] === cy - lastPoint.y) {
            break;
          }
        }
        const tuCost = this.getTUCost(lastPoint, dir, nextPoint, this._unit, targetUnit, Boolean(targetUnit && maxTUCost === 10000));
        if (sneak && this._save.getTile(nextPoint)?.getVisible()) {
          return false;
        }

        const isDiagonal = (dir & 1) !== 0;
        const lastTUCostDiagonal = lastTUCost + Math.trunc(lastTUCost / 2);
        const tuCostDiagonal = tuCost + Math.trunc(tuCost / 2);
        if (nextPoint.equals(realNextPoint) &&
          tuCost < 255 &&
          (tuCost === lastTUCost || (isDiagonal && tuCost === lastTUCostDiagonal) || (!isDiagonal && tuCostDiagonal === lastTUCost) || lastTUCost === -1) &&
          !this.isBlocked(this._save.getTile(lastPoint), this._save.getTile(nextPoint), dir, targetUnit)) {
          this._path.push(dir);
        } else {
          return false;
        }
        if (targetUnit === null && tuCost !== 255) {
          lastTUCost = tuCost;
          this._totalTUCost += tuCost;
        }
        lastPoint = new Position(cx, cy, cz);
      }

      drift_xy -= delta_y;
      drift_xz -= delta_z;
      if (drift_xy < 0) {
        y += step_y;
        drift_xy += delta_x;
      }
      if (drift_xz < 0) {
        z += step_z;
        drift_xz += delta_x;
      }
    }

    return true;
  }

  private aStarPath(_origin: PositionLike, _target: PositionLike, missileTarget: BattleUnit | null, sneak = false, maxTUCost = 1000): boolean {
    if (!this._unit) {
      this.notTranslated("Pathfinding::aStarPath without unit");
    }
    const startPosition = Position.from(_origin);
    const endPosition = Position.from(_target);
    for (const node of this._nodes) {
      node.reset();
    }

    const start = this.getNode(startPosition);
    start.connect(0, null, 0, endPosition);
    const openList = new PathfindingOpenSet();
    openList.push(start);
    const missile = Boolean(missileTarget && maxTUCost === 10000);
    while (!openList.empty()) {
      const currentNode = openList.pop();
      const currentPos = currentNode.getPosition();
      currentNode.setChecked();
      if (currentPos.equals(endPosition)) {
        this._path = [];
        let pf: PathfindingNode | null = currentNode;
        while (pf && pf.getPrevNode()) {
          this._path.push(pf.getPrevDir());
          pf = pf.getPrevNode();
        }
        return true;
      }

      for (let direction = 0; direction < 10; ++direction) {
        const nextPos = new Position();
        let tuCost = this.getTUCost(currentPos, direction, nextPos, this._unit, missileTarget, missile);
        if (tuCost >= 255) {
          continue;
        }
        if (sneak && this._save.getTile(nextPos)?.getVisible()) {
          tuCost *= 2;
        }
        const nextNode = this.getNode(nextPos);
        if (nextNode.isChecked()) {
          continue;
        }
        this._totalTUCost = currentNode.getTUCost(missile) + tuCost;
        if ((!nextNode.inOpenSet() || nextNode.getTUCost(missile) > this._totalTUCost) && this._totalTUCost <= maxTUCost) {
          nextNode.connect(this._totalTUCost, currentNode, direction, endPosition);
          openList.push(nextNode);
        }
      }
    }
    return false;
  }

  private isBlockedPart(tile: Tile | null, part: number, missileTarget: BattleUnit | null, bigWallExclusion = -1): boolean {
    if (!tile) {
      return true;
    }

    if (part === Pathfinding.O_BIGWALL) {
      const object = tile.getMapData(TilePart.O_OBJECT);
      return Boolean(object && object.getBigWall() !== 0 && object.getBigWall() <= Pathfinding.BIGWALLNWSE && object.getBigWall() !== bigWallExclusion);
    }

    const object = tile.getMapData(TilePart.O_OBJECT);
    if (part === TilePart.O_WESTWALL) {
      if (object && (object.getBigWall() === Pathfinding.BIGWALLWEST || object.getBigWall() === Pathfinding.BIGWALLWESTANDNORTH)) {
        return true;
      }
      const tileWest = this._save.getTile(tile.getPosition().add(new Position(-1, 0, 0)));
      if (!tileWest) {
        return true;
      }
      const westObject = tileWest.getMapData(TilePart.O_OBJECT);
      if (westObject && (westObject.getBigWall() === Pathfinding.BIGWALLEAST || westObject.getBigWall() === Pathfinding.BIGWALLEASTANDSOUTH)) {
        return true;
      }
    }
    if (part === TilePart.O_NORTHWALL) {
      if (object && (object.getBigWall() === Pathfinding.BIGWALLNORTH || object.getBigWall() === Pathfinding.BIGWALLWESTANDNORTH)) {
        return true;
      }
      const tileNorth = this._save.getTile(tile.getPosition().add(new Position(0, -1, 0)));
      if (!tileNorth) {
        return true;
      }
      const northObject = tileNorth.getMapData(TilePart.O_OBJECT);
      if (northObject && (northObject.getBigWall() === Pathfinding.BIGWALLSOUTH || northObject.getBigWall() === Pathfinding.BIGWALLEASTANDSOUTH)) {
        return true;
      }
    }
    if (part === TilePart.O_FLOOR) {
      const unit = tile.getUnit();
      if (unit) {
        if (unit === this._unit || unit === missileTarget || unit.isOut()) {
          return false;
        }
        if (this._unit) {
          if (this._unit.getFaction() === UnitFaction.FACTION_PLAYER && unit.getVisible()) {
            return true;
          }
          if (this._unit.getFaction() === unit.getFaction()) {
            return true;
          }
          if (this._unit.getFaction() === UnitFaction.FACTION_HOSTILE && this._unit.getUnitsSpottedThisTurn().includes(unit)) {
            return true;
          }
        }
      } else if (tile.hasNoFloor(null) && this._movementType !== MovementType.MT_FLY) {
        let pos = tile.getPosition().clone();
        while (pos.z >= 0) {
          const t = this._save.getTile(pos);
          if (!t) {
            return true;
          }
          const fallingUnit = t.getUnit();
          if (fallingUnit && fallingUnit !== this._unit) {
            if (this._unit && this._unit.getArmor().getSize() > 1) {
              return true;
            }
            if (fallingUnit !== missileTarget && !fallingUnit.isOut() && fallingUnit.getArmor().getSize() > 1) {
              return true;
            }
          }
          if (!t.hasNoFloor(null)) {
            break;
          }
          pos = pos.add(new Position(0, 0, -1));
        }
      }
    }

    const tilePart = part as TilePart;
    const mapData = tile.getMapData(tilePart);
    if (missileTarget && mapData && (mapData.isDoor() || (mapData.isUFODoor() && !tile.isUfoDoorOpen(tilePart)))) {
      return true;
    }
    return tile.getTUCost(tilePart, this._movementType) === 255;
  }

  private isBlockedDirection(startTile: Tile | null, _endTile: Tile | null, direction: number, missileTarget: BattleUnit | null): boolean {
    if (!startTile) {
      return true;
    }
    const currentPosition = startTile.getPosition();
    const oneTileNorth = new Position(0, -1, 0);
    const oneTileEast = new Position(1, 0, 0);
    const oneTileSouth = new Position(0, 1, 0);
    const oneTileWest = new Position(-1, 0, 0);

    switch (direction) {
      case 0:
        if (this.isBlockedPart(startTile, TilePart.O_NORTHWALL, missileTarget)) return true;
        break;
      case 1:
        if (this.isBlockedPart(startTile, TilePart.O_NORTHWALL, missileTarget)) return true;
        if (this.isBlockedPart(this._save.getTile(currentPosition.add(oneTileNorth).add(oneTileEast)), TilePart.O_WESTWALL, missileTarget)) return true;
        if (this.isBlockedPart(this._save.getTile(currentPosition.add(oneTileEast)), TilePart.O_WESTWALL, missileTarget)) return true;
        if (this.isBlockedPart(this._save.getTile(currentPosition.add(oneTileEast)), TilePart.O_NORTHWALL, missileTarget)) return true;
        if (this.isBlockedPart(this._save.getTile(currentPosition.add(oneTileEast)), Pathfinding.O_BIGWALL, missileTarget, Pathfinding.BIGWALLNESW)) return true;
        if (this.isBlockedPart(this._save.getTile(currentPosition.add(oneTileNorth)), Pathfinding.O_BIGWALL, missileTarget, Pathfinding.BIGWALLNESW)) return true;
        break;
      case 2:
        if (this.isBlockedPart(this._save.getTile(currentPosition.add(oneTileEast)), TilePart.O_WESTWALL, missileTarget)) return true;
        break;
      case 3:
        if (this.isBlockedPart(this._save.getTile(currentPosition.add(oneTileEast)), TilePart.O_WESTWALL, missileTarget)) return true;
        if (this.isBlockedPart(this._save.getTile(currentPosition.add(oneTileSouth)), TilePart.O_NORTHWALL, missileTarget)) return true;
        if (this.isBlockedPart(this._save.getTile(currentPosition.add(oneTileSouth).add(oneTileEast)), TilePart.O_NORTHWALL, missileTarget)) return true;
        if (this.isBlockedPart(this._save.getTile(currentPosition.add(oneTileSouth).add(oneTileEast)), TilePart.O_WESTWALL, missileTarget)) return true;
        if (this.isBlockedPart(this._save.getTile(currentPosition.add(oneTileEast)), Pathfinding.O_BIGWALL, missileTarget, Pathfinding.BIGWALLNWSE)) return true;
        if (this.isBlockedPart(this._save.getTile(currentPosition.add(oneTileSouth)), Pathfinding.O_BIGWALL, missileTarget, Pathfinding.BIGWALLNWSE)) return true;
        break;
      case 4:
        if (this.isBlockedPart(this._save.getTile(currentPosition.add(oneTileSouth)), TilePart.O_NORTHWALL, missileTarget)) return true;
        break;
      case 5:
        if (this.isBlockedPart(startTile, TilePart.O_WESTWALL, missileTarget)) return true;
        if (this.isBlockedPart(this._save.getTile(currentPosition.add(oneTileSouth)), TilePart.O_WESTWALL, missileTarget)) return true;
        if (this.isBlockedPart(this._save.getTile(currentPosition.add(oneTileSouth)), TilePart.O_NORTHWALL, missileTarget)) return true;
        if (this.isBlockedPart(this._save.getTile(currentPosition.add(oneTileSouth)), Pathfinding.O_BIGWALL, missileTarget, Pathfinding.BIGWALLNESW)) return true;
        if (this.isBlockedPart(this._save.getTile(currentPosition.add(oneTileWest)), Pathfinding.O_BIGWALL, missileTarget, Pathfinding.BIGWALLNESW)) return true;
        if (this.isBlockedPart(this._save.getTile(currentPosition.add(oneTileSouth).add(oneTileWest)), TilePart.O_NORTHWALL, missileTarget)) return true;
        break;
      case 6:
        if (this.isBlockedPart(startTile, TilePart.O_WESTWALL, missileTarget)) return true;
        break;
      case 7:
        if (this.isBlockedPart(startTile, TilePart.O_WESTWALL, missileTarget)) return true;
        if (this.isBlockedPart(startTile, TilePart.O_NORTHWALL, missileTarget)) return true;
        if (this.isBlockedPart(this._save.getTile(currentPosition.add(oneTileWest)), TilePart.O_NORTHWALL, missileTarget)) return true;
        if (this.isBlockedPart(this._save.getTile(currentPosition.add(oneTileNorth)), TilePart.O_WESTWALL, missileTarget)) return true;
        if (this.isBlockedPart(this._save.getTile(currentPosition.add(oneTileNorth)), Pathfinding.O_BIGWALL, missileTarget, Pathfinding.BIGWALLNWSE)) return true;
        if (this.isBlockedPart(this._save.getTile(currentPosition.add(oneTileWest)), Pathfinding.O_BIGWALL, missileTarget, Pathfinding.BIGWALLNWSE)) return true;
        break;
    }
    return false;
  }

  private notTranslated(method: string): never {
    throw new Error(`${method} is not translated yet`);
  }
}
