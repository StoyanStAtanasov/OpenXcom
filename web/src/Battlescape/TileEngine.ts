import { Position, type PositionLike } from "./Position.ts";
import { BattleActionType, createBattleAction, type BattleAction } from "./BattleAction.ts";
import { Pathfinding } from "./Pathfinding.ts";
import { MeleeAttackBState } from "./MeleeAttackBState.ts";
import { ProjectileFlyBState } from "./ProjectileFlyBState.ts";
import { Options } from "../Engine/Options.ts";
import { RNG } from "../Engine/RNG.ts";
import { MovementType } from "../Mod/Armor.ts";
import { BattleType, ItemDamageType } from "../Mod/RuleItem.ts";
import type { RuleInventory } from "../Mod/RuleInventory.ts";
import { MapData, TilePart, VoxelType } from "../Mod/MapData.ts";
import type { BattleItem } from "../Savegame/BattleItem.ts";
import { UnitFaction, UnitStatus, type BattleUnit } from "../Savegame/BattleUnit.ts";
import type { SavedBattleGame } from "../Savegame/SavedBattleGame.ts";
import type { Tile } from "../Savegame/Tile.ts";
import { AIModule } from "./AIModule.ts";

type TileEngineModLike = {
  getInventory?: (id: string, error?: boolean) => RuleInventory | null;
};

type ReactionSpotter = {
  unit: BattleUnit;
  attackType: BattleActionType;
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function degToRad(value: number): number {
  return value * Math.PI / 180.0;
}

/**
 * Utility class for battlescape tile interactions.
 *
 * This is the first translated TileEngine slice: geometry helpers, lighting,
 * item/drop/door helpers, and the first voxel trajectory path.
 */
export class TileEngine {
  static readonly MAX_VIEW_DISTANCE = 20;
  static readonly MAX_VIEW_DISTANCE_SQR = TileEngine.MAX_VIEW_DISTANCE * TileEngine.MAX_VIEW_DISTANCE;
  static readonly MAX_VOXEL_VIEW_DISTANCE = TileEngine.MAX_VIEW_DISTANCE * 16;
  static readonly MAX_DARKNESS_TO_SEE_UNITS = 9;
  static readonly DAMAGE_RANGE = 100;
  static readonly EXPLOSIVE_DAMAGE_RANGE = 50;
  static readonly FIRE_DAMAGE_RANGE: [number, number] = [5, 10];
  private static readonly heightFromCenter = [0, -2, +2, -4, +4, -6, +6, -8, +8, -12, +12];
  private _personalLighting = true;
  private _cacheTile: Tile | null = null;
  private _cacheTileBelow: Tile | null = null;
  private _cacheTilePos = new Position();

  constructor(private _save: SavedBattleGame, private _voxelData: number[] = []) {}

  distanceUnitToPositionSq(unit: BattleUnit, pos: PositionLike, considerZ: boolean): number {
    const target = Position.from(pos);
    let x = unit.getPosition().x - target.x;
    let y = unit.getPosition().y - target.y;
    const z = considerZ ? unit.getPosition().z - target.z : 0;
    if (unit.getArmor().getSize() > 1) {
      if (unit.getPosition().x < target.x) {
        x++;
      }
      if (unit.getPosition().y < target.y) {
        y++;
      }
    }
    return x * x + y * y + z * z;
  }

  distance(pos1: PositionLike, pos2: PositionLike): number {
    const a = Position.from(pos1);
    const b = Position.from(pos2);
    const x = a.x - b.x;
    const y = a.y - b.y;
    return Math.ceil(Math.sqrt(x * x + y * y));
  }

  distanceSq(pos1: PositionLike, pos2: PositionLike, considerZ = true): number {
    const a = Position.from(pos1);
    const b = Position.from(pos2);
    const x = a.x - b.x;
    const y = a.y - b.y;
    const z = considerZ ? a.z - b.z : 0;
    return x * x + y * y + z * z;
  }

  getDirectionTo(origin: PositionLike, target: PositionLike): number {
    const from = Position.from(origin);
    const to = Position.from(target);
    const ox = to.x - from.x;
    const oy = to.y - from.y;
    const angle = Math.atan2(ox, -oy);
    const quarter = Math.PI / 4;
    const pie = [
      quarter * 4.0 - quarter / 2.0,
      quarter * 3.0 - quarter / 2.0,
      quarter * 2.0 - quarter / 2.0,
      quarter - quarter / 2.0
    ];

    if (angle > pie[0] || angle < -pie[0]) return 4;
    if (angle > pie[1]) return 3;
    if (angle > pie[2]) return 2;
    if (angle > pie[3]) return 1;
    if (angle < -pie[1]) return 5;
    if (angle < -pie[2]) return 6;
    if (angle < -pie[3]) return 7;
    return 0;
  }

  faceWindow(position: PositionLike): number {
    const pos = Position.from(position);
    const oneTileEast = new Position(1, 0, 0);
    const oneTileSouth = new Position(0, 1, 0);
    let tile = this._save.getTile(pos);
    if (tile?.getMapData(TilePart.O_NORTHWALL)?.getBlock(ItemDamageType.DT_NONE) === 0) return 0;
    tile = this._save.getTile(pos.add(oneTileEast));
    if (tile?.getMapData(TilePart.O_WESTWALL)?.getBlock(ItemDamageType.DT_NONE) === 0) return 2;
    tile = this._save.getTile(pos.add(oneTileSouth));
    if (tile?.getMapData(TilePart.O_NORTHWALL)?.getBlock(ItemDamageType.DT_NONE) === 0) return 4;
    tile = this._save.getTile(pos);
    if (tile?.getMapData(TilePart.O_WESTWALL)?.getBlock(ItemDamageType.DT_NONE) === 0) return 6;
    return -1;
  }

  applyGravity(tile: Tile | null): Tile | null {
    if (!tile || (tile.getInventory().length === 0 && !tile.getUnit())) {
      return tile;
    }

    const originalPosition = tile.getPosition();
    let resultTile: Tile | null = tile;
    const occupant = tile.getUnit();

    if (occupant) {
      const unitPosition = occupant.getPosition().clone();
      while (unitPosition.z >= 0) {
        let canFall = true;
        for (let y = 0; y < occupant.getArmor().getSize() && canFall; ++y) {
          for (let x = 0; x < occupant.getArmor().getSize() && canFall; ++x) {
            resultTile = this._save.getTile(new Position(unitPosition.x + x, unitPosition.y + y, unitPosition.z));
            const below = this._save.getTile(new Position(unitPosition.x + x, unitPosition.y + y, unitPosition.z - 1));
            if (!resultTile?.hasNoFloor(below || null)) {
              canFall = false;
            }
          }
        }
        if (!canFall) {
          break;
        }
        unitPosition.z--;
      }

      if (!unitPosition.equals(occupant.getPosition())) {
        if (occupant.getHealth() !== 0 && occupant.getStunlevel() < occupant.getHealth()) {
          if (occupant.getMovementType() === MovementType.MT_FLY) {
            occupant.setPosition(occupant.getPosition());
          } else {
            occupant.setPosition(occupant.getPosition());
            this._save.addFallingUnit(occupant);
          }
        } else if (occupant.isOut()) {
          const origin = occupant.getPosition();
          for (let y = occupant.getArmor().getSize() - 1; y >= 0; --y) {
            for (let x = occupant.getArmor().getSize() - 1; x >= 0; --x) {
              this._save.getTile(origin.add(new Position(x, y, 0)))?.setUnit(null);
            }
          }
          occupant.setPosition(unitPosition);
        }
      }
    }

    let itemPosition = originalPosition.clone();
    let canFall = true;
    while (itemPosition.z >= 0 && canFall) {
      resultTile = this._save.getTile(itemPosition);
      const below = this._save.getTile(new Position(itemPosition.x, itemPosition.y, itemPosition.z - 1));
      if (!resultTile?.hasNoFloor(below || null)) {
        canFall = false;
      }
      itemPosition = new Position(itemPosition.x, itemPosition.y, itemPosition.z - 1);
    }

    if (resultTile && tile !== resultTile) {
      const inventory = [...tile.getInventory()];
      for (const item of inventory) {
        if (item.getUnit() && item.getUnit()?.getPosition().equals(tile.getPosition())) {
          item.getUnit()?.setPosition(resultTile.getPosition());
        }
        resultTile.addItem(item, item.getSlot() || this.getGroundInventory(null));
      }
      tile.getInventory().length = 0;
    }

    return resultTile;
  }

  itemDrop(tile: Tile | null, item: BattleItem, mod: TileEngineModLike | null | undefined, newItem = false, removeItem = false): void {
    if (!tile || item.getRules().isFixed()) {
      return;
    }

    const position = tile.getPosition();
    tile.addItem(item, this.getGroundInventory(mod));

    if (item.getUnit()) {
      item.getUnit()?.setPosition(position);
    }

    if (newItem) {
      this._save.getItems().push(item);
    } else if (this._save.getSide() !== 0) {
      item.setTurnFlag(true);
    }

    if (removeItem) {
      item.moveToOwner(null);
    } else if (item.getRules().getBattleType() !== BattleType.BT_GRENADE && item.getRules().getBattleType() !== BattleType.BT_PROXIMITYGRENADE) {
      item.setOwner(null);
    }

    this.applyGravity(this._save.getTile(position));

    if (item.getRules().getBattleType() === BattleType.BT_FLARE) {
      this.calculateTerrainLighting();
      this.calculateFOV(position);
    }
  }

  unitOpensDoor(unit: BattleUnit, rClick = false, dir = -1): number {
    let door = -1;
    let tuCost = 0;
    let openedTile: Tile | null = null;
    let openedPart = TilePart.O_FLOOR;
    const size = unit.getArmor().getSize();
    const unitTile = this._save.getTile(unit.getPosition());
    const z = (unitTile?.getTerrainLevel() || 0) < -12 ? 1 : 0;
    const direction = dir === -1 ? unit.getDirection() : dir;

    for (let x = 0; x < size && door === -1; ++x) {
      for (let y = 0; y < size && door === -1; ++y) {
        const origin = unit.getPosition().add(new Position(x, y, z));
        const tile = this._save.getTile(origin);
        if (!tile) {
          continue;
        }
        const checkPositions = this.getDoorCheckPositions(direction, x, y, rClick);
        for (const check of checkPositions) {
          openedTile = this._save.getTile(origin.add(check.offset));
          if (!openedTile) {
            continue;
          }
          door = openedTile.openDoor(check.part, unit, this._save.getBattleGame()?.getReservedAction() ?? 0);
          if (door !== -1) {
            openedPart = check.part;
            if (door === 1) {
              this.checkAdjacentDoors(origin.add(check.offset), check.part);
            }
            break;
          }
        }
        if (door === 0 && rClick && openedTile) {
          const part = openedPart === TilePart.O_WESTWALL ? TilePart.O_NORTHWALL : TilePart.O_WESTWALL;
          tuCost = openedTile.getTUCost(part, unit.getMovementType());
        } else if ((door === 1 || door === 4) && openedTile) {
          tuCost = openedTile.getTUCost(openedPart, unit.getMovementType());
        }
      }
    }

    if (tuCost !== 0) {
      const battleGame = this._save.getBattleGame();
      if (!battleGame || battleGame.checkReservedTU(unit, tuCost)) {
        if (unit.spendTimeUnits(tuCost)) {
          this.calculateFOV(unit.getPosition());
        } else {
          return 4;
        }
      } else {
        return 5;
      }
    }

    return door;
  }

  checkAdjacentDoors(posLike: PositionLike, part: TilePart): void {
    const pos = Position.from(posLike);
    const westSide = part === TilePart.O_WESTWALL;
    for (let i = 1; ; ++i) {
      const offset = westSide ? new Position(0, i, 0) : new Position(i, 0, 0);
      const tile = this._save.getTile(pos.add(offset));
      if (tile?.getMapData(part)?.isUFODoor()) {
        tile.openDoor(part);
      } else {
        break;
      }
    }
    for (let i = -1; ; --i) {
      const offset = westSide ? new Position(0, i, 0) : new Position(i, 0, 0);
      const tile = this._save.getTile(pos.add(offset));
      if (tile?.getMapData(part)?.isUFODoor()) {
        tile.openDoor(part);
      } else {
        break;
      }
    }
  }

  closeUfoDoors(): number {
    let doorsClosed = 0;
    for (const tile of this._save.getTiles()) {
      const unit = tile.getUnit();
      if (unit && unit.getArmor().getSize() > 1) {
        const oneTileNorth = this._save.getTile(tile.getPosition().add(new Position(0, -1, 0)));
        const oneTileWest = this._save.getTile(tile.getPosition().add(new Position(-1, 0, 0)));
        if ((tile.isUfoDoorOpen(TilePart.O_NORTHWALL) && oneTileNorth?.getUnit() === unit) ||
          (tile.isUfoDoorOpen(TilePart.O_WESTWALL) && oneTileWest?.getUnit() === unit)) {
          continue;
        }
      }
      doorsClosed += tile.closeUfoDoor();
    }
    return doorsClosed;
  }

  /**
   * Handles bullet/weapon hits.
   */
  hit(centerLike: PositionLike, power: number, type: ItemDamageType, unit: BattleUnit | null = null): BattleUnit | null {
    const center = Position.from(centerLike);
    const tile = this._save.getTile(center.divide(new Position(16, 16, 24)));
    if (!tile) {
      return null;
    }

    let hitUnit = tile.getUnit();
    this.voxelCheckFlush();
    const part = this.voxelCheck(center, unit);
    if (part >= VoxelType.V_FLOOR && part <= VoxelType.V_OBJECT) {
      const rndPower = RNG.generate(Math.trunc(power / 4), Math.trunc((power * 3) / 4));
      const tilePart = part as unknown as TilePart;
      const object = tile.getMapData(TilePart.O_OBJECT);
      if (part === VoxelType.V_OBJECT && object && rndPower >= object.getArmor() &&
        this._save.getMissionType() === "STR_BASE_DEFENSE" && object.isBaseModule()) {
        const module = this._save.getModuleMap()[Math.trunc(center.x / 16 / 10)]?.[Math.trunc(center.y / 16 / 10)];
        if (module) {
          module[1]--;
        }
      }
      if (tile.damage(tilePart, rndPower, this._save.getObjectiveType())) {
        this._save.addDestroyedObjective();
      }
    } else if (part === VoxelType.V_UNIT) {
      const dmgRng = type === ItemDamageType.DT_HE ? TileEngine.EXPLOSIVE_DAMAGE_RANGE : TileEngine.DAMAGE_RANGE;
      const min = Math.trunc(power * (100 - dmgRng) / 100);
      const max = Math.trunc(power * (100 + dmgRng) / 100);
      const rndPower = RNG.generate(min, max);
      let verticalOffset = 0;
      if (!hitUnit) {
        const below = this._save.getTile(new Position(Math.trunc(center.x / 16), Math.trunc(center.y / 16), Math.trunc(center.z / 24) - 1));
        if (below?.getUnit()) {
          hitUnit = below.getUnit();
          verticalOffset = 24;
        }
      }
      if (hitUnit && hitUnit.getHealth() !== 0 && hitUnit.getStunlevel() < hitUnit.getHealth()) {
        const sizeCenter = hitUnit.getArmor().getSize() * 8;
        const target = hitUnit.getPosition()
          .multiply(new Position(16, 16, 24))
          .add(new Position(sizeCenter, sizeCenter, hitUnit.getFloatHeight() - tile.getTerrainLevel()));
        const relative = center.subtract(target).subtract(new Position(0, 0, verticalOffset));
        hitUnit.damage(relative, rndPower, type);
        if (hitUnit.getOriginalFaction() === UnitFaction.FACTION_HOSTILE &&
          unit?.getOriginalFaction() === UnitFaction.FACTION_PLAYER &&
          type !== ItemDamageType.DT_NONE) {
          unit.addFiringExp();
        }
      }
    }

    this.applyGravity(tile);
    this.calculateSunShading();
    this.calculateTerrainLighting();
    this.calculateFOV(center.divide(new Position(16, 16, 24)));
    return hitUnit;
  }

  /**
   * Handles area explosions, smoke, and fire.
   */
  explode(centerLike: PositionLike, power: number, type: ItemDamageType, maxRadius: number, unit: BattleUnit | null = null): void {
    const center = Position.from(centerLike);
    const centerZ = Math.trunc(center.z / 24) + 0.5;
    const centerX = Math.trunc(center.x / 16) + 0.5;
    const centerY = Math.trunc(center.y / 16) + 0.5;
    const centerTilePos = new Position(Math.trunc(centerX), Math.trunc(centerY), Math.trunc(centerZ));
    let hitSide = 0;
    let diagonalWall = 0;
    let workingPower = power;
    if (type === ItemDamageType.DT_IN) {
      workingPower = Math.trunc(workingPower / 2);
    }

    const affected = new Set<Tile>();
    const exHeight = clamp(Options.battleExplosionHeight, 0, 3);
    let verticalDecay = 1000;
    switch (exHeight) {
      case 1:
        verticalDecay = 30;
        break;
      case 2:
        verticalDecay = 10;
        break;
      case 3:
        verticalDecay = 5;
        break;
      default:
        break;
    }

    const firstOrigin = this._save.getTile(centerTilePos);
    if (!firstOrigin) {
      return;
    }
    if (firstOrigin.isBigWall()) {
      diagonalWall = firstOrigin.getMapData(TilePart.O_OBJECT)?.getBigWall() || 0;
      if (diagonalWall === Pathfinding.BIGWALLNWSE) {
        hitSide = (center.x % 16 - center.y % 16) > 0 ? 1 : -1;
      }
      if (diagonalWall === Pathfinding.BIGWALLNESW) {
        hitSide = (center.x % 16 + center.y % 16 - 15) > 0 ? 1 : -1;
      }
    }

    for (let fi = -90; fi <= 90; fi += 5) {
      for (let te = 0; te <= 360; te += 3) {
        const cosTe = Math.cos(degToRad(te));
        const sinTe = Math.sin(degToRad(te));
        const sinFi = Math.sin(degToRad(fi));
        const cosFi = Math.cos(degToRad(fi));

        let origin = this._save.getTile(centerTilePos);
        let dest = origin;
        let distance = 0;
        let rayPower = workingPower;
        while (dest && rayPower > 0 && distance <= maxRadius) {
          if (type === ItemDamageType.DT_HE) {
            dest.setExplosive(rayPower, 0);
          }

          if (!affected.has(dest)) {
            affected.add(dest);
            this.applyExplosionDamage(dest, centerTilePos, rayPower, type, unit);
          }

          distance += 1.0;
          const tileX = Math.floor(centerX + distance * sinTe * cosFi);
          const tileY = Math.floor(centerY + distance * cosTe * cosFi);
          const tileZ = Math.floor(centerZ + distance * sinFi);

          origin = dest;
          dest = this._save.getTile(new Position(tileX, tileY, tileZ));
          if (!dest) {
            break;
          }

          rayPower -= 10;
          if (origin.getPosition().z !== tileZ) {
            rayPower -= verticalDecay;
          }

          if (type === ItemDamageType.DT_IN) {
            const direction = Pathfinding.vectorToDirection(origin.getPosition().subtract(dest.getPosition()));
            if (direction !== -1 && direction % 2) {
              rayPower -= 5;
            }
          }

          if (distance > 0.5) {
            if (distance > 1.5) {
              rayPower -= this.verticalBlockage(origin, dest, type, false) * 2;
              rayPower -= this.horizontalBlockage(origin, dest, type, false) * 2;
            } else {
              let skipObject = diagonalWall === 0;
              if (diagonalWall === Pathfinding.BIGWALLNESW) {
                if (hitSide < 0 && te >= 135 && te < 315) {
                  skipObject = true;
                }
                if (hitSide > 0 && (te < 135 || te > 315)) {
                  skipObject = true;
                }
              }
              if (diagonalWall === Pathfinding.BIGWALLNWSE) {
                if (hitSide > 0 && te >= 45 && te < 225) {
                  skipObject = true;
                }
                if (hitSide < 0 && (te < 45 || te > 225)) {
                  skipObject = true;
                }
              }
              rayPower -= this.verticalBlockage(origin, dest, type, skipObject) * 2;
              rayPower -= this.horizontalBlockage(origin, dest, type, skipObject) * 2;
            }
          }
        }
      }
    }

    if (type === ItemDamageType.DT_HE) {
      for (const tile of affected) {
        if (this.detonate(tile)) {
          this._save.addDestroyedObjective();
        }
        this.applyGravity(tile);
        this.applyGravity(this._save.getTile(tile.getPosition().add(new Position(0, 0, 1))));
      }
    }

    this.calculateSunShading();
    this.calculateTerrainLighting();
    this.calculateFOV(centerTilePos);
  }

  checkForTerrainExplosions(): Tile | null {
    for (const tile of this._save.getTiles()) {
      if (tile.getExplosive()) {
        return tile;
      }
    }
    return null;
  }

  togglePersonalLighting(): void {
    this._personalLighting = !this._personalLighting;
  }

  voxelCheckFlush(): void {
    this._cacheTile = null;
    this._cacheTileBelow = null;
    this._cacheTilePos = new Position();
  }

  voxelCheck(_voxel: PositionLike, _excludeUnit: BattleUnit | null = null, _excludeAllUnits = false, _onlyVisible = false, _excludeAllBut: BattleUnit | null = null): VoxelType {
    const voxel = Position.from(_voxel);
    if (voxel.x < 0 || voxel.y < 0 || voxel.z < 0) {
      return VoxelType.V_OUTOFBOUNDS;
    }
    const pos = voxel.divide(new Position(16, 16, 24));
    let tile: Tile | null;
    let tileBelow: Tile | null;
    if (this._cacheTilePos.equals(pos)) {
      tile = this._cacheTile;
      tileBelow = this._cacheTileBelow;
    } else {
      tile = this._save.getTile(pos);
      if (!tile) {
        return VoxelType.V_OUTOFBOUNDS;
      }
      tileBelow = this._save.getTile(pos.add(new Position(0, 0, -1)));
      this._cacheTilePos = pos;
      this._cacheTile = tile;
      this._cacheTileBelow = tileBelow;
    }
    if (!tile) {
      return VoxelType.V_OUTOFBOUNDS;
    }

    if (tile.isVoid() && !tile.getUnit() && !tileBelow?.getUnit()) {
      return VoxelType.V_EMPTY;
    }

    if (tile.getMapData(TilePart.O_FLOOR)?.isGravLift() && (voxel.z % 24 === 0 || voxel.z % 24 === 1)) {
      if (!tileBelow?.getMapData(TilePart.O_FLOOR)?.isGravLift()) {
        return VoxelType.V_FLOOR;
      }
    }

    for (let i = VoxelType.V_FLOOR; i <= VoxelType.V_OBJECT; ++i) {
      const part = i as unknown as TilePart;
      const mapData = tile.getMapData(part);
      if ((part === TilePart.O_WESTWALL || part === TilePart.O_NORTHWALL) && tile.isUfoDoorOpen(part)) {
        continue;
      }
      if (!mapData) {
        continue;
      }
      const x = 15 - (voxel.x % 16);
      const y = voxel.y % 16;
      const loft = mapData.getLoftID(Math.trunc((voxel.z % 24) / 2));
      if (this.loftVoxelOccupied(loft, x, y)) {
        return i as VoxelType;
      }
    }

    if (!_excludeAllUnits) {
      let unit = tile.getUnit();
      if (!unit && tile.hasNoFloor(tileBelow)) {
        tile = tileBelow;
        unit = tile?.getUnit() || null;
      }
      if (unit && unit !== _excludeUnit && (!_excludeAllBut || unit === _excludeAllBut) && (!_onlyVisible || unit.getVisible())) {
        let terrainHeight = 0;
        const unitPosition = unit.getPosition();
        for (let x = 0; x < unit.getArmor().getSize(); ++x) {
          for (let y = 0; y < unit.getArmor().getSize(); ++y) {
            const terrainTile = this._save.getTile(unitPosition.add(new Position(x, y, 0)));
            if (terrainTile && terrainTile.getTerrainLevel() < terrainHeight) {
              terrainHeight = terrainTile.getTerrainLevel();
            }
          }
        }
        const bottomVoxel = unitPosition.z * 24 + unit.getFloatHeight() - terrainHeight;
        if (voxel.z > bottomVoxel && voxel.z <= bottomVoxel + unit.getHeight()) {
          const x = 15 - (voxel.x % 16);
          const y = voxel.y % 16;
          let part = 0;
          if (unit.getArmor().getSize() > 1 && tile) {
            const tilePosition = tile.getPosition();
            const parts = [1, 0, 3, 2];
            part = parts[tilePosition.x - unitPosition.x + (tilePosition.y - unitPosition.y) * 2] || 0;
          }
          if (this.loftVoxelOccupied(unit.getLoftemps(part), x, y)) {
            return VoxelType.V_UNIT;
          }
        }
      }
    }
    return VoxelType.V_EMPTY;
  }

  recalculateFOV(): void {
    for (const unit of this._save.getUnits()) {
      if (unit.getTile()) {
        this.calculateFOV(unit);
      }
    }
  }

  calculateFOV(unitOrPosition?: unknown): boolean {
    if (!unitOrPosition) {
      return false;
    }

    if (this.isPositionLike(unitOrPosition)) {
      const position = Position.from(unitOrPosition);
      let spotted = false;
      for (const unit of this._save.getUnits()) {
        if (this.distanceSq(position, unit.getPosition()) <= TileEngine.MAX_VIEW_DISTANCE_SQR) {
          spotted = this.calculateFOV(unit) || spotted;
        }
      }
      return spotted;
    }

    if (!this.isBattleUnitLike(unitOrPosition)) {
      return false;
    }

    const unit = unitOrPosition;
    const oldNumVisibleUnits = unit.getUnitsSpottedThisTurn().length;
    const center = unit.getPosition();
    const rawDirection = Options.strafe && unit.getTurretType() > -1 ? unit.getTurretDirection() : unit.getDirection();
    const direction = ((rawDirection % 8) + 8) % 8;
    const swap = direction === 0 || direction === 4;
    const signX = [+1, +1, +1, +1, -1, -1, -1, -1];
    const signY = [-1, -1, -1, +1, +1, +1, -1, -1];

    unit.clearVisibleUnits();
    unit.clearVisibleTiles();

    if (unit.isOut()) {
      return false;
    }

    let pos = unit.getPosition();
    const unitTile = this._save.getTile(unit.getPosition());
    if (unitTile && unit.getHeight() + unit.getFloatHeight() - unitTile.getTerrainLevel() >= 28) {
      const tileAbove = this._save.getTile(pos.add(new Position(0, 0, 1)));
      if (tileAbove?.hasNoFloor(null)) {
        pos = pos.add(new Position(0, 0, 1));
      }
    }

    for (let x = 0; x <= TileEngine.MAX_VIEW_DISTANCE; ++x) {
      const y1 = direction % 2 ? 0 : -x;
      const y2 = direction % 2 ? TileEngine.MAX_VIEW_DISTANCE : x;
      for (let y = y1; y <= y2; ++y) {
        const distanceSqr = x * x + y * y;
        if (distanceSqr > TileEngine.MAX_VIEW_DISTANCE_SQR) {
          continue;
        }
        for (let z = 0; z < this._save.getMapSizeZ(); ++z) {
          const test = new Position(
            center.x + signX[direction] * (swap ? y : x),
            center.y + signY[direction] * (swap ? x : y),
            z
          );
          const tile = this._save.getTile(test);
          if (!tile) {
            continue;
          }

          const visibleUnit = tile.getUnit();
          if (visibleUnit && !visibleUnit.isOut() && this.visible(unit, tile)) {
            if (unit.getFaction() === UnitFaction.FACTION_PLAYER) {
              visibleUnit.getTile()?.setVisible?.(+1);
              visibleUnit.setVisible(true);
            }
            if ((visibleUnit.getFaction() === UnitFaction.FACTION_HOSTILE && unit.getFaction() === UnitFaction.FACTION_PLAYER) ||
              (visibleUnit.getFaction() !== UnitFaction.FACTION_HOSTILE && unit.getFaction() === UnitFaction.FACTION_HOSTILE)) {
              unit.addToVisibleUnits(visibleUnit);
              unit.addToVisibleTiles(visibleUnit.getTile());

              if (unit.getFaction() === UnitFaction.FACTION_HOSTILE && visibleUnit.getFaction() !== UnitFaction.FACTION_HOSTILE) {
                visibleUnit.setTurnsSinceSpotted(0);
              }
            }
          }

          if (unit.getFaction() === UnitFaction.FACTION_PLAYER) {
            const size = unit.getArmor().getSize();
            for (let xo = 0; xo < size; ++xo) {
              for (let yo = 0; yo < size; ++yo) {
                const poso = pos.add(new Position(xo, yo, 0));
                const trajectory: Position[] = [];
                const result = this.calculateLine(poso, test, true, trajectory, unit, false);
                let length = trajectory.length;
                if ((result as number) > 127) {
                  --length;
                }
                for (let i = 0; i < length; ++i) {
                  const linePos = trajectory[i];
                  const visibleTile = this._save.getTile(linePos);
                  if (!visibleTile) {
                    continue;
                  }
                  visibleTile.setVisible(+1);
                  visibleTile.setDiscovered(true, 2);
                  this._save.getTile(new Position(linePos.x + 1, linePos.y, linePos.z))?.setDiscovered(true, 0);
                  this._save.getTile(new Position(linePos.x, linePos.y + 1, linePos.z))?.setDiscovered(true, 1);
                }
              }
            }
          }
        }
      }
    }

    return unit.getUnitsSpottedThisTurn().length > oldNumVisibleUnits && unit.getVisibleUnits().length > 0;
  }

  checkReactionFire(unit: BattleUnit): boolean {
    if (unit.getFaction() !== this._save.getSide() || !unit.getTile()) {
      return false;
    }

    const spotters = this.getSpottingUnits(unit);
    let result = false;

    if (unit.getFaction() === unit.getOriginalFaction() || unit.getFaction() !== UnitFaction.FACTION_HOSTILE) {
      let reactor = this.getReactor(spotters, unit);
      while (reactor.unit !== unit) {
        if (!this.tryReaction(reactor.unit, unit, reactor.attackType)) {
          const index = spotters.findIndex(spotter => spotter.unit === reactor.unit);
          if (index !== -1) {
            spotters.splice(index, 1);
          }
          reactor = this.getReactor(spotters, unit);
          continue;
        }
        reactor = this.getReactor(spotters, unit);
        result = true;
      }
    }
    return result;
  }

  getSpottingUnits(unit: BattleUnit): ReactionSpotter[] {
    const spotters: ReactionSpotter[] = [];
    const tile = unit.getTile() as Tile | null;

    if (this._save.getSide() !== UnitFaction.FACTION_NEUTRAL) {
      for (const candidate of this._save.getUnits()) {
        if (!candidate.isOut() &&
          candidate.getHealth() !== 0 &&
          candidate.getStunlevel() < candidate.getHealth() &&
          candidate.getFaction() !== this._save.getSide() &&
          candidate.getFaction() !== UnitFaction.FACTION_NEUTRAL &&
          this.distanceSq(unit.getPosition(), candidate.getPosition()) <= TileEngine.MAX_VIEW_DISTANCE_SQR) {
          const falseAction = createBattleAction();
          falseAction.type = BattleActionType.BA_SNAPSHOT;
          falseAction.actor = candidate;
          falseAction.target = unit.getPosition().clone();
          const originVoxel = this.getOriginVoxel(falseAction, null);
          const targetVoxel = new Position();
          const ai = candidate.getAIModule();
          const gotHit = (ai?.getWasHitBy?.(unit.getId()) ?? false) || (!ai && candidate.getHitState());

          if ((candidate.checkViewSector(unit.getPosition()) || gotHit) &&
            this.canTargetUnit(originVoxel, tile, targetVoxel, candidate, false) &&
            this.visible(candidate, tile)) {
            if (candidate.getFaction() === UnitFaction.FACTION_PLAYER) {
              unit.setVisible(true);
            }
            candidate.addToVisibleUnits(unit);
            const attackType = this.determineReactionType(candidate, unit);
            if (attackType !== BattleActionType.BA_NONE) {
              spotters.push({ unit: candidate, attackType });
            }
          }
        }
      }
    }
    return spotters;
  }

  getReactor(spotters: ReactionSpotter[], unit: BattleUnit): ReactionSpotter {
    let bestScore = -1;
    let reactor: BattleUnit | null = null;
    let attackType = BattleActionType.BA_NONE;
    for (const spotter of spotters) {
      const candidate = spotter.unit;
      if (!candidate.isOut() &&
        !candidate.getRespawn() &&
        this.determineReactionType(candidate, unit) !== BattleActionType.BA_NONE &&
        candidate.getReactionScore() > bestScore) {
        bestScore = candidate.getReactionScore();
        reactor = candidate;
        attackType = spotter.attackType;
      }
    }
    if (unit.getReactionScore() <= bestScore && reactor) {
      if (reactor.getOriginalFaction() === UnitFaction.FACTION_PLAYER) {
        reactor.addReactionExp();
      }
      return { unit: reactor, attackType };
    }
    return { unit, attackType: BattleActionType.BA_NONE };
  }

  determineReactionType(unit: BattleUnit, target: BattleUnit): BattleActionType {
    const meleeWeapon = unit.getMeleeWeapon();
    if (meleeWeapon &&
      this.validMeleeRange(unit, target, unit.getDirection()) &&
      unit.getActionTUs(BattleActionType.BA_HIT, meleeWeapon) > 0 &&
      unit.getTimeUnits() > unit.getActionTUs(BattleActionType.BA_HIT, meleeWeapon) &&
      this.reactionWeaponResearched(unit, meleeWeapon) &&
      this._save.isItemUsable(meleeWeapon)) {
      return BattleActionType.BA_HIT;
    }

    const weapon = unit.getMainHandWeapon(unit.getFaction() !== UnitFaction.FACTION_PLAYER);
    if (weapon &&
      weapon.getRules().getBattleType() !== BattleType.BT_MELEE &&
      weapon.getRules().getTUSnap() &&
      this.distanceSq(unit.getPosition(), target.getPosition(), false) < weapon.getRules().getMaxRangeSq() &&
      weapon.getAmmoItem() &&
      unit.getActionTUs(BattleActionType.BA_SNAPSHOT, weapon) > 0 &&
      unit.getTimeUnits() > unit.getActionTUs(BattleActionType.BA_SNAPSHOT, weapon) &&
      this.reactionWeaponResearched(unit, weapon) &&
      this._save.isItemUsable(weapon)) {
      return BattleActionType.BA_SNAPSHOT;
    }

    return BattleActionType.BA_NONE;
  }

  tryReaction(unit: BattleUnit, target: BattleUnit, attackType: BattleActionType): boolean {
    const action = createBattleAction();
    action.cameraPosition = this._save.getBattleState()?.getMap().getCamera().getMapOffset() || new Position(0, 0, -1);
    action.actor = unit;
    action.weapon = attackType === BattleActionType.BA_HIT ? unit.getMeleeWeapon() : unit.getMainHandWeapon(unit.getFaction() !== UnitFaction.FACTION_PLAYER);
    if (!action.weapon) {
      return false;
    }
    action.type = attackType;
    action.target = target.getPosition().clone();
    action.TU = unit.getActionTUs(action.type, action.weapon);

    const ammo = action.weapon.getAmmoItem();
    if (ammo && ammo.getAmmoQuantity() && unit.getTimeUnits() >= action.TU) {
      action.targeting = true;
      if (unit.getFaction() === UnitFaction.FACTION_HOSTILE) {
        let ai = unit.getAIModule();
        if (!ai) {
          ai = new AIModule(this._save, unit, null);
          unit.setAIModule(ai);
        }
        if (action.type !== BattleActionType.BA_HIT &&
          ammo.getRules().getExplosionRadius() &&
          ai?.explosiveEfficacy?.(action.target, unit, ammo.getRules().getExplosionRadius(), -1) === false) {
          action.targeting = false;
        }
      }

      if (action.targeting && unit.spendTimeUnits(action.TU)) {
        action.TU = 0;
        const battleGame = this._save.getBattleGame();
        if (!battleGame) {
          return false;
        }
        if (action.type === BattleActionType.BA_HIT) {
          battleGame.statePushBack(new MeleeAttackBState(battleGame, action));
        } else {
          battleGame.statePushBack(new ProjectileFlyBState(battleGame, action));
        }
        return true;
      }
    }
    return false;
  }

  visible(currentUnit: BattleUnit, tile: Tile | null): boolean {
    const targetUnit = tile?.getUnit() || null;
    if (!tile || !targetUnit) {
      return false;
    }

    const tileDistance = this.distance(currentUnit.getPosition(), tile.getPosition());
    if ((currentUnit.getFaction() === UnitFaction.FACTION_PLAYER &&
      tileDistance > 9 &&
      tile.getShade() > TileEngine.MAX_DARKNESS_TO_SEE_UNITS) ||
      tileDistance > TileEngine.MAX_VIEW_DISTANCE) {
      return false;
    }

    if (currentUnit.getFaction() === targetUnit.getFaction()) {
      return true;
    }

    const originVoxel = this.getSightOriginVoxel(currentUnit);
    const scanVoxel = new Position();
    let unitSeen = this.canTargetUnit(originVoxel, tile, scanVoxel, currentUnit, false);

    if (unitSeen) {
      const trajectory: Position[] = [];
      this.calculateLine(originVoxel, scanVoxel, true, trajectory, currentUnit);
      let currentTile = this._save.getTile(currentUnit.getPosition());
      let visibleDistance = trajectory.length;
      for (const voxel of trajectory) {
        const tracedTile = this._save.getTile(new Position(
          Math.trunc(voxel.x / 16),
          Math.trunc(voxel.y / 16),
          Math.trunc(voxel.z / 24)
        ));
        if (tracedTile && tracedTile !== currentTile) {
          currentTile = tracedTile;
        }
        if (currentTile?.getFire() === 0) {
          visibleDistance += Math.trunc(currentTile.getSmoke() / 3);
        }
        if (visibleDistance > TileEngine.MAX_VOXEL_VIEW_DISTANCE) {
          unitSeen = false;
          break;
        }
      }
    }

    return unitSeen;
  }

  canTargetUnit(originVoxel: PositionLike, tile: Tile | null, scanVoxel: Position, excludeUnit: BattleUnit | null, rememberObstacles: boolean, potentialUnit: BattleUnit | null = null): boolean {
    if (!tile) {
      return false;
    }

    const origin = Position.from(originVoxel);
    const targetVoxel = new Position(
      tile.getPosition().x * 16 + 8,
      tile.getPosition().y * 16 + 8,
      tile.getPosition().z * 24
    );
    const hypothetical = potentialUnit !== null;
    const targetUnit = potentialUnit || tile.getUnit();
    if (!targetUnit || targetUnit === excludeUnit) {
      return false;
    }

    let targetMinHeight = targetVoxel.z - tile.getTerrainLevel();
    targetMinHeight += targetUnit.getFloatHeight();
    let targetMaxHeight = targetMinHeight;
    let unitRadius = targetUnit.getLoftemps();
    const targetSize = targetUnit.getArmor().getSize() - 1;
    const xOffset = targetUnit.getPosition().x - tile.getPosition().x;
    const yOffset = targetUnit.getPosition().y - tile.getPosition().y;
    if (targetSize > 0) {
      unitRadius = 3;
    }

    const relPos = targetVoxel.subtract(origin);
    const relLength = Math.sqrt(relPos.x * relPos.x + relPos.y * relPos.y);
    const normal = relLength === 0 ? 0 : unitRadius / relLength;
    const relX = Math.floor(relPos.y * normal + 0.5);
    const relY = Math.floor(-relPos.x * normal + 0.5);
    const sliceTargets = [0, 0, relX, relY, -relX, -relY, relY, -relX, -relY, relX];

    let heightRange = targetUnit.isOut() ? 12 : targetUnit.getHeight();
    targetMaxHeight += heightRange;
    const targetCenterHeight = Math.trunc((targetMaxHeight + targetMinHeight) / 2);
    heightRange = Math.trunc(heightRange / 2);
    if (heightRange > 10) {
      heightRange = 10;
    }
    if (heightRange <= 0) {
      heightRange = 0;
    }

    for (let i = 0; i <= heightRange; ++i) {
      scanVoxel.z = targetCenterHeight + (TileEngine.heightFromCenter[i] || 0);
      for (let j = 0; j < 5; ++j) {
        if (i < heightRange - 1 && j > 2) {
          break;
        }
        scanVoxel.x = targetVoxel.x + (sliceTargets[j * 2] ?? 0);
        scanVoxel.y = targetVoxel.y + (sliceTargets[j * 2 + 1] ?? 0);
        const trajectory: Position[] = [];
        const result = this.calculateLine(origin, scanVoxel, false, trajectory, excludeUnit, true, false);
        if (result === VoxelType.V_UNIT) {
          const hit = trajectory[0];
          if (!hit) {
            continue;
          }
          for (let x = 0; x <= targetSize; ++x) {
            for (let y = 0; y <= targetSize; ++y) {
              if (Math.trunc(hit.x / 16) === Math.trunc(scanVoxel.x / 16) + x + xOffset &&
                Math.trunc(hit.y / 16) === Math.trunc(scanVoxel.y / 16) + y + yOffset &&
                hit.z >= targetMinHeight &&
                hit.z <= targetMaxHeight) {
                return true;
              }
            }
          }
        } else if (result === VoxelType.V_EMPTY && hypothetical && trajectory.length > 0) {
          return true;
        }
        if (rememberObstacles && trajectory.length > 0) {
          const hit = trajectory[0];
          this._save.getTile(new Position(
            Math.trunc(hit.x / 16),
            Math.trunc(hit.y / 16),
            Math.trunc(hit.z / 24)
          ))?.setObstacle(result);
        }
      }
    }

    return false;
  }

  checkVoxelExposure(originVoxel: PositionLike, tile: Tile | null, excludeUnit: BattleUnit | null, excludeAllBut: BattleUnit | null = null): number {
    if (!tile) {
      return 0;
    }

    const targetVoxel = new Position(
      tile.getPosition().x * 16 + 8,
      tile.getPosition().y * 16 + 8,
      tile.getPosition().z * 24
    );
    const otherUnit = tile.getUnit();
    if (!otherUnit || otherUnit === excludeUnit) {
      return 0;
    }

    let targetMinHeight = targetVoxel.z - tile.getTerrainLevel();
    targetMinHeight += otherUnit.getFloatHeight();
    let unitRadius = otherUnit.getLoftemps();
    if (otherUnit.getArmor().getSize() > 1) {
      unitRadius = 3;
    }

    const origin = Position.from(originVoxel);
    const relPos = targetVoxel.subtract(origin);
    const relLength = Math.sqrt(relPos.x * relPos.x + relPos.y * relPos.y);
    const normal = relLength === 0 ? 0 : unitRadius / relLength;
    const relX = Math.floor(relPos.y * normal + 0.5);
    const relY = Math.floor(-relPos.x * normal + 0.5);
    const sliceTargets = [0, 0, relX, relY, -relX, -relY];
    const heightRange = otherUnit.isOut() ? 12 : otherUnit.getHeight();
    const targetMaxHeight = targetMinHeight + heightRange;

    let total = 0;
    let visible = 0;
    for (let i = heightRange; i >= 0; i -= 2) {
      ++total;
      const scanVoxel = new Position(0, 0, targetMinHeight + i);
      for (let j = 0; j < 3; ++j) {
        scanVoxel.x = targetVoxel.x + (sliceTargets[j * 2] ?? 0);
        scanVoxel.y = targetVoxel.y + (sliceTargets[j * 2 + 1] ?? 0);
        const trajectory: Position[] = [];
        const result = this.calculateLine(origin, scanVoxel, false, trajectory, excludeUnit, true, false, excludeAllBut);
        const hit = trajectory[0];
        if (result === VoxelType.V_UNIT && hit &&
          Math.trunc(hit.x / 16) === Math.trunc(scanVoxel.x / 16) &&
          Math.trunc(hit.y / 16) === Math.trunc(scanVoxel.y / 16) &&
          hit.z >= targetMinHeight &&
          hit.z <= targetMaxHeight) {
          ++visible;
        }
      }
    }

    return total > 0 ? Math.trunc((visible * 100) / total) : 0;
  }

  canTargetTile(originVoxel: PositionLike, tile: Tile | null, part: TilePart | number, scanVoxel: Position, excludeUnit: BattleUnit | null, rememberObstacles: boolean): boolean {
    if (!tile) {
      return false;
    }

    const sliceObjectSpiral = [
      8, 8, 8, 6, 10, 6, 10, 8, 10, 10, 8, 10, 6, 10, 6, 8, 6, 6,
      8, 4, 10, 4, 12, 4, 12, 6, 12, 8, 12, 10, 12, 12, 10, 12, 8, 12, 6, 12, 4, 12, 4, 10, 4, 8, 4, 6, 4, 4, 6, 4,
      8, 1, 12, 1, 15, 1, 15, 4, 15, 8, 15, 12, 15, 15, 12, 15, 8, 15, 4, 15, 1, 15, 1, 12, 1, 8, 1, 4, 1, 1, 4, 1
    ];
    const westWallSpiral = [0, 7, 0, 9, 0, 6, 0, 11, 0, 4, 0, 13, 0, 2];
    const northWallSpiral = [7, 0, 9, 0, 6, 0, 11, 0, 4, 0, 13, 0, 2];
    const targetVoxel = new Position(tile.getPosition().x * 16, tile.getPosition().y * 16, tile.getPosition().z * 24);

    let spiralArray: number[];
    let spiralCount: number;
    let minZ = 0;
    let maxZ = 0;
    let minZfound = false;
    let maxZfound = false;
    let dummy = false;

    if (part === TilePart.O_OBJECT) {
      spiralArray = sliceObjectSpiral;
      spiralCount = 41;
    } else if (part === TilePart.O_NORTHWALL) {
      spiralArray = northWallSpiral;
      spiralCount = 7;
    } else if (part === TilePart.O_WESTWALL) {
      spiralArray = westWallSpiral;
      spiralCount = 7;
    } else if (part === TilePart.O_FLOOR) {
      spiralArray = sliceObjectSpiral;
      spiralCount = 41;
      minZfound = true;
      maxZfound = true;
    } else if (part === MapData.O_DUMMY) {
      spiralArray = sliceObjectSpiral;
      spiralCount = 41;
      minZ = 12;
      maxZ = 12;
      minZfound = true;
      maxZfound = true;
    } else {
      return false;
    }

    this.voxelCheckFlush();

    if (!minZfound) {
      for (let j = 1; j < 12 && !minZfound; ++j) {
        for (let i = 0; i < spiralCount; ++i) {
          const tx = spiralArray[i * 2];
          const ty = spiralArray[i * 2 + 1];
          if (this.voxelCheck(new Position(targetVoxel.x + tx, targetVoxel.y + ty, targetVoxel.z + j * 2), null, true) === part) {
            minZ = j * 2;
            minZfound = true;
            break;
          }
        }
      }
    }

    if (!minZfound) {
      if (!rememberObstacles) {
        return false;
      }
      minZ = 10;
      minZfound = true;
      dummy = true;
    }

    if (!maxZfound) {
      for (let j = 10; j >= 0 && !maxZfound; --j) {
        for (let i = 0; i < spiralCount; ++i) {
          const tx = spiralArray[i * 2];
          const ty = spiralArray[i * 2 + 1];
          if (this.voxelCheck(new Position(targetVoxel.x + tx, targetVoxel.y + ty, targetVoxel.z + j * 2), null, true) === part) {
            maxZ = j * 2;
            maxZfound = true;
            break;
          }
        }
      }
    }

    if (!maxZfound) {
      if (!rememberObstacles) {
        return false;
      }
      maxZ = 10;
      maxZfound = true;
      dummy = true;
    }

    if (minZ > maxZ) {
      minZ = maxZ;
    }
    let rangeZ = maxZ - minZ;
    if (rangeZ > 10) {
      rangeZ = 10;
    }
    const centerZ = Math.trunc((maxZ + minZ) / 2);
    const origin = Position.from(originVoxel);

    for (let j = 0; j <= rangeZ; ++j) {
      scanVoxel.z = targetVoxel.z + centerZ + (TileEngine.heightFromCenter[j] || 0);
      for (let i = 0; i < spiralCount; ++i) {
        scanVoxel.x = targetVoxel.x + (spiralArray[i * 2] ?? 0);
        scanVoxel.y = targetVoxel.y + (spiralArray[i * 2 + 1] ?? 0);
        const trajectory: Position[] = [];
        const result = this.calculateLine(origin, scanVoxel, false, trajectory, excludeUnit, true);
        const hit = trajectory[0];
        if (result === part && !dummy && hit &&
          Math.trunc(hit.x / 16) === Math.trunc(scanVoxel.x / 16) &&
          Math.trunc(hit.y / 16) === Math.trunc(scanVoxel.y / 16) &&
          Math.trunc(hit.z / 24) === Math.trunc(scanVoxel.z / 24)) {
          return true;
        }
        if (rememberObstacles && hit) {
          this._save.getTile(new Position(
            Math.trunc(hit.x / 16),
            Math.trunc(hit.y / 16),
            Math.trunc(hit.z / 24)
          ))?.setObstacle(result);
        }
      }
    }

    return false;
  }

  validMeleeRange(attacker: BattleUnit, target: BattleUnit | null, dir: number): boolean;
  validMeleeRange(pos: PositionLike, direction: number, attacker: BattleUnit, target: BattleUnit | null, dest?: Position | null, preferEnemy?: boolean): boolean;
  validMeleeRange(attackerOrPosition: BattleUnit | PositionLike, targetOrDirection: BattleUnit | number | null, dirOrAttacker: number | BattleUnit, target: BattleUnit | null = null, dest: Position | null = null, preferEnemy = true): boolean {
    if (this.isBattleUnitLike(attackerOrPosition)) {
      const attacker = attackerOrPosition;
      return this.validMeleeRange(attacker.getPosition(), dirOrAttacker as number, attacker, targetOrDirection as BattleUnit | null, null, true);
    }

    const pos = Position.from(attackerOrPosition);
    const direction = targetOrDirection as number;
    const attacker = dirOrAttacker as BattleUnit;
    if (direction < 0 || direction > 7) {
      return false;
    }

    const potentialTargets: BattleUnit[] = [];
    let chosenTarget: BattleUnit | null = null;
    const directionVector = Pathfinding.directionToVector(direction);
    const size = attacker.getArmor().getSize() - 1;

    for (let x = 0; x <= size; ++x) {
      for (let y = 0; y <= size; ++y) {
        const offset = new Position(x, y, 0);
        const origin = this._save.getTile(pos.add(offset));
        let targetTile = this._save.getTile(pos.add(offset).add(directionVector));
        const aboveTargetTile = this._save.getTile(pos.add(new Position(x, y, 1)).add(directionVector));
        const belowTargetTile = this._save.getTile(pos.add(new Position(x, y, -1)).add(directionVector));

        if (!targetTile || !origin) {
          continue;
        }
        if (origin.getTerrainLevel() <= -16 && aboveTargetTile && !aboveTargetTile.hasNoFloor(targetTile)) {
          targetTile = aboveTargetTile;
        } else if (belowTargetTile && targetTile.hasNoFloor(belowTargetTile) && !targetTile.getUnit() && belowTargetTile.getTerrainLevel() <= -16) {
          targetTile = belowTargetTile;
        }

        const targetUnit = targetTile.getUnit();
        if (!targetUnit || (target && targetUnit !== target)) {
          continue;
        }

        const originPosition = origin.getPosition();
        const originVoxel = new Position(
          originPosition.x * 16 + 8,
          originPosition.y * 16 + 8,
          originPosition.z * 24 + attacker.getHeight() + attacker.getFloatHeight() - 4 - origin.getTerrainLevel()
        );
        const targetVoxel = new Position();
        if (this.canTargetUnit(originVoxel, targetTile, targetVoxel, attacker, false)) {
          if (dest) {
            this.assignPosition(dest, targetTile.getPosition());
          }
          if (target) {
            return true;
          }
          potentialTargets.push(targetUnit);
        }
      }
    }

    for (const unit of potentialTargets) {
      if (!chosenTarget) {
        chosenTarget = unit;
      } else if ((preferEnemy && unit.getFaction() !== attacker.getFaction()) ||
        (!preferEnemy && unit.getFaction() === attacker.getFaction() && unit.getFatalWounds() > chosenTarget.getFatalWounds())) {
        chosenTarget = unit;
      }
    }

    if (dest && chosenTarget) {
      this.assignPosition(dest, chosenTarget.getPosition());
    }

    return chosenTarget !== null;
  }

  validateThrow(action: BattleAction, originVoxelLike: PositionLike, targetVoxelLike: PositionLike, curve: { value: number } | null = null, voxelType: { value: number } | null = null, forced = false): boolean {
    const actor = action.actor;
    const weapon = action.weapon;
    if (!actor || !weapon) {
      return false;
    }

    let foundCurve = false;
    let curvature: number;
    if (action.type === BattleActionType.BA_THROW) {
      curvature = Math.max(
        0.48,
        1.73 / Math.sqrt(Math.sqrt(actor.getBaseStats().strength / weapon.getRules().getWeight())) + (actor.isKneeled() ? 0.1 : 0.0)
      );
    } else {
      curvature = 1.73 / Math.sqrt(Math.sqrt(70.0 / 10.0)) + (actor.isKneeled() ? 0.1 : 0.0);
    }

    const originVoxel = Position.from(originVoxelLike);
    const targetVoxel = Position.from(targetVoxelLike);
    const targetTile = this._save.getTile(action.target);
    const targetPos = targetVoxel.divide(new Position(16, 16, 24));
    const object = targetTile?.getMapData(TilePart.O_OBJECT) || null;
    if (action.type === BattleActionType.BA_THROW &&
      targetTile &&
      object &&
      object.getTUCost(MovementType.MT_WALK) === 255 &&
      !(targetTile.isBigWall() && (object.getBigWall() < 1 || object.getBigWall() > 3))) {
      return false;
    }

    if (!this.validThrowRange(action, originVoxel, targetTile)) {
      return false;
    }

    const trajectory: Position[] = [];
    let test = VoxelType.V_OUTOFBOUNDS;
    while (!foundCurve && curvature < 5.0) {
      trajectory.length = 0;
      test = this.calculateParabola(originVoxel, targetVoxel, true, trajectory, actor, curvature, new Position());
      const impact = trajectory[trajectory.length - 1];
      const hitPos = impact ? impact.add(new Position(0, 0, 1)).divide(new Position(16, 16, 24)) : new Position();
      const dropPosition = this.getTrajectoryPositionFromEnd(trajectory, -2);
      const tilePos = dropPosition.divide(new Position(16, 16, 24));
      if (forced || (test !== VoxelType.V_OUTOFBOUNDS && tilePos.equals(targetPos))) {
        if (voxelType) {
          voxelType.value = test;
        }
        foundCurve = true;
      } else {
        curvature += 0.5;
        if (test !== VoxelType.V_OUTOFBOUNDS && actor.getFaction() === UnitFaction.FACTION_PLAYER) {
          this._save.getTile(hitPos)?.setObstacle(test);
        }
      }
    }

    if (curvature >= 5.0) {
      return false;
    }
    if (curve) {
      curve.value = curvature;
    }
    return true;
  }

  getSightOriginVoxel(currentUnit: BattleUnit): Position {
    const originVoxel = new Position(
      currentUnit.getPosition().x * 16 + 8,
      currentUnit.getPosition().y * 16 + 8,
      currentUnit.getPosition().z * 24
    );
    const tile = this._save.getTile(currentUnit.getPosition());
    originVoxel.z += -(tile?.getTerrainLevel() || 0);
    originVoxel.z += currentUnit.getHeight() + currentUnit.getFloatHeight() - 1;
    const tileAbove = this._save.getTile(currentUnit.getPosition().add(new Position(0, 0, 1)));
    if (currentUnit.getArmor().getSize() > 1) {
      originVoxel.x += 8;
      originVoxel.y += 8;
      originVoxel.z += 1;
    }
    if (originVoxel.z >= (currentUnit.getPosition().z + 1) * 24 && (!tileAbove || !tileAbove.hasNoFloor(null))) {
      while (originVoxel.z >= (currentUnit.getPosition().z + 1) * 24) {
        originVoxel.z--;
      }
    }
    return originVoxel;
  }

  getOriginVoxel(action: BattleAction, tile: Tile | null = null): Position {
    const dirYshift = [1, 1, 8, 15, 15, 15, 8, 1];
    const dirXshift = [8, 14, 15, 15, 8, 1, 1, 1];
    const actor = action.actor;
    if (!actor) {
      return new Position();
    }
    const originTile = tile || actor.getTile();
    if (!originTile?.getPosition) {
      return new Position();
    }

    const origin = originTile.getPosition();
    const tileAbove = this._save.getTile(origin.add(new Position(0, 0, 1)));
    const originVoxel = new Position(origin.x * 16, origin.y * 16, origin.z * 24);

    if (actor.getPosition().equals(origin) || action.type !== BattleActionType.BA_LAUNCH) {
      originVoxel.z += -((originTile as Tile).getTerrainLevel?.() || 0);
      originVoxel.z += actor.getHeight() + actor.getFloatHeight();
      originVoxel.z -= action.type === BattleActionType.BA_THROW ? 3 : 4;
      if (originVoxel.z >= (origin.z + 1) * 24) {
        if (tileAbove && tileAbove.hasNoFloor(null)) {
          origin.z++;
        } else {
          while (originVoxel.z >= (origin.z + 1) * 24) {
            originVoxel.z--;
          }
          originVoxel.z -= 4;
        }
      }
      const direction = this.getDirectionTo(origin, action.target);
      originVoxel.x += dirXshift[direction] * actor.getArmor().getSize();
      originVoxel.y += dirYshift[direction] * actor.getArmor().getSize();
    } else {
      originVoxel.x += 8;
      originVoxel.y += 8;
      originVoxel.z += 16;
    }
    return originVoxel;
  }

  verticalBlockage(startTile: Tile | null, endTile: Tile | null, type: ItemDamageType, skipObject = false): number {
    let block = 0;
    if (!startTile || !endTile) {
      return 0;
    }

    const direction = endTile.getPosition().z - startTile.getPosition().z;
    if (direction === 0) {
      return 0;
    }

    let x = startTile.getPosition().x;
    let y = startTile.getPosition().y;
    let z = startTile.getPosition().z;

    if (direction < 0) {
      block += this.blockage(startTile, TilePart.O_FLOOR, type);
      if (!skipObject) {
        block += this.blockage(startTile, TilePart.O_OBJECT, type, Pathfinding.DIR_DOWN);
      }
      if (x !== endTile.getPosition().x || y !== endTile.getPosition().y) {
        x = endTile.getPosition().x;
        y = endTile.getPosition().y;
        const currentTile = this._save.getTile(new Position(x, y, z));
        block += this.horizontalBlockage(startTile, currentTile, type, skipObject);
        block += this.blockage(currentTile, TilePart.O_FLOOR, type);
        if (!skipObject) {
          block += this.blockage(currentTile, TilePart.O_OBJECT, type, Pathfinding.DIR_DOWN);
        }
      }
    } else {
      z += 1;
      let currentTile = this._save.getTile(new Position(x, y, z));
      block += this.blockage(currentTile, TilePart.O_FLOOR, type);
      if (!skipObject) {
        block += this.blockage(currentTile, TilePart.O_OBJECT, type, Pathfinding.DIR_UP);
      }
      if (x !== endTile.getPosition().x || y !== endTile.getPosition().y) {
        x = endTile.getPosition().x;
        y = endTile.getPosition().y;
        currentTile = this._save.getTile(new Position(x, y, z));
        block += this.horizontalBlockage(startTile, currentTile, type, skipObject);
        block += this.blockage(currentTile, TilePart.O_FLOOR, type);
        if (!skipObject) {
          block += this.blockage(currentTile, TilePart.O_OBJECT, type, Pathfinding.DIR_UP);
        }
      }
    }

    return block;
  }

  horizontalBlockage(startTile: Tile | null, endTile: Tile | null, type: ItemDamageType, skipObject = false): number {
    const oneTileNorth = new Position(0, -1, 0);
    const oneTileEast = new Position(1, 0, 0);
    const oneTileSouth = new Position(0, 1, 0);
    const oneTileWest = new Position(-1, 0, 0);

    if (!startTile || !endTile || startTile.getPosition().z !== endTile.getPosition().z) {
      return 0;
    }

    let direction = Pathfinding.vectorToDirection(endTile.getPosition().subtract(startTile.getPosition()));
    if (direction === -1) {
      return 0;
    }

    let block = 0;
    let tmpTile: Tile | null;

    switch (direction) {
      case 0:
        block = this.blockage(startTile, TilePart.O_NORTHWALL, type);
        break;
      case 1:
        if (type === ItemDamageType.DT_NONE) {
          block = this.blockage(startTile, TilePart.O_NORTHWALL, type) + this.blockage(endTile, TilePart.O_WESTWALL, type);
          tmpTile = this._save.getTile(startTile.getPosition().add(oneTileNorth));
          if (tmpTile?.getMapData(TilePart.O_OBJECT) && tmpTile.getMapData(TilePart.O_OBJECT)?.getBigWall() !== Pathfinding.BIGWALLNESW) {
            block += this.blockage(tmpTile, TilePart.O_OBJECT, type, 3);
          }
          if (block === 0) break;
          block = this.blockage(this._save.getTile(startTile.getPosition().add(oneTileEast)), TilePart.O_NORTHWALL, type) +
            this.blockage(this._save.getTile(startTile.getPosition().add(oneTileEast)), TilePart.O_WESTWALL, type);
          tmpTile = this._save.getTile(startTile.getPosition().add(oneTileEast));
          if (tmpTile?.getMapData(TilePart.O_OBJECT) && tmpTile.getMapData(TilePart.O_OBJECT)?.getBigWall() !== Pathfinding.BIGWALLNESW) {
            block += this.blockage(tmpTile, TilePart.O_OBJECT, type, 7);
          }
        } else {
          block = Math.trunc((this.blockage(startTile, TilePart.O_NORTHWALL, type) + this.blockage(endTile, TilePart.O_WESTWALL, type)) / 2) +
            Math.trunc((this.blockage(this._save.getTile(startTile.getPosition().add(oneTileEast)), TilePart.O_WESTWALL, type) +
              this.blockage(this._save.getTile(startTile.getPosition().add(oneTileEast)), TilePart.O_NORTHWALL, type)) / 2);
          block += Math.trunc((this.blockage(this._save.getTile(startTile.getPosition().add(oneTileNorth)), TilePart.O_OBJECT, type, 4) +
            this.blockage(this._save.getTile(startTile.getPosition().add(oneTileEast)), TilePart.O_OBJECT, type, 6)) / 2);
        }
        break;
      case 2:
        block = this.blockage(endTile, TilePart.O_WESTWALL, type);
        break;
      case 3:
        if (type === ItemDamageType.DT_NONE) {
          block = this.blockage(this._save.getTile(startTile.getPosition().add(oneTileSouth)), TilePart.O_NORTHWALL, type) +
            this.blockage(endTile, TilePart.O_WESTWALL, type);
          tmpTile = this._save.getTile(startTile.getPosition().add(oneTileSouth));
          if (tmpTile?.getMapData(TilePart.O_OBJECT) && tmpTile.getMapData(TilePart.O_OBJECT)?.getBigWall() !== Pathfinding.BIGWALLNWSE) {
            block += this.blockage(tmpTile, TilePart.O_OBJECT, type, 1);
          }
          if (block === 0) break;
          block = this.blockage(this._save.getTile(startTile.getPosition().add(oneTileEast)), TilePart.O_WESTWALL, type) +
            this.blockage(endTile, TilePart.O_NORTHWALL, type);
          tmpTile = this._save.getTile(startTile.getPosition().add(oneTileEast));
          if (tmpTile?.getMapData(TilePart.O_OBJECT) && tmpTile.getMapData(TilePart.O_OBJECT)?.getBigWall() !== Pathfinding.BIGWALLNWSE) {
            block += this.blockage(tmpTile, TilePart.O_OBJECT, type, 5);
          }
        } else {
          block = Math.trunc((this.blockage(endTile, TilePart.O_WESTWALL, type) + this.blockage(endTile, TilePart.O_NORTHWALL, type)) / 2) +
            Math.trunc((this.blockage(this._save.getTile(startTile.getPosition().add(oneTileEast)), TilePart.O_WESTWALL, type) +
              this.blockage(this._save.getTile(startTile.getPosition().add(oneTileSouth)), TilePart.O_NORTHWALL, type)) / 2);
          block += Math.trunc((this.blockage(this._save.getTile(startTile.getPosition().add(oneTileSouth)), TilePart.O_OBJECT, type, 0) +
            this.blockage(this._save.getTile(startTile.getPosition().add(oneTileEast)), TilePart.O_OBJECT, type, 6)) / 2);
        }
        break;
      case 4:
        block = this.blockage(endTile, TilePart.O_NORTHWALL, type);
        break;
      case 5:
        if (type === ItemDamageType.DT_NONE) {
          block = this.blockage(this._save.getTile(startTile.getPosition().add(oneTileSouth)), TilePart.O_NORTHWALL, type) +
            this.blockage(this._save.getTile(startTile.getPosition().add(oneTileSouth)), TilePart.O_WESTWALL, type);
          tmpTile = this._save.getTile(startTile.getPosition().add(oneTileSouth));
          if (tmpTile?.getMapData(TilePart.O_OBJECT) && tmpTile.getMapData(TilePart.O_OBJECT)?.getBigWall() !== Pathfinding.BIGWALLNESW) {
            block += this.blockage(tmpTile, TilePart.O_OBJECT, type, 7);
          }
          if (block === 0) break;
          block = this.blockage(startTile, TilePart.O_WESTWALL, type) + this.blockage(endTile, TilePart.O_NORTHWALL, type);
          tmpTile = this._save.getTile(startTile.getPosition().add(oneTileWest));
          if (tmpTile?.getMapData(TilePart.O_OBJECT) && tmpTile.getMapData(TilePart.O_OBJECT)?.getBigWall() !== Pathfinding.BIGWALLNESW) {
            block += this.blockage(tmpTile, TilePart.O_OBJECT, type, 3);
          }
        } else {
          block = Math.trunc((this.blockage(endTile, TilePart.O_NORTHWALL, type) + this.blockage(startTile, TilePart.O_WESTWALL, type)) / 2) +
            Math.trunc((this.blockage(this._save.getTile(startTile.getPosition().add(oneTileSouth)), TilePart.O_WESTWALL, type) +
              this.blockage(this._save.getTile(startTile.getPosition().add(oneTileSouth)), TilePart.O_NORTHWALL, type)) / 2);
          block += Math.trunc((this.blockage(this._save.getTile(startTile.getPosition().add(oneTileSouth)), TilePart.O_OBJECT, type, 0) +
            this.blockage(this._save.getTile(startTile.getPosition().add(oneTileWest)), TilePart.O_OBJECT, type, 2)) / 2);
        }
        break;
      case 6:
        block = this.blockage(startTile, TilePart.O_WESTWALL, type);
        break;
      case 7:
        if (type === ItemDamageType.DT_NONE) {
          block = this.blockage(startTile, TilePart.O_NORTHWALL, type) +
            this.blockage(this._save.getTile(startTile.getPosition().add(oneTileNorth)), TilePart.O_WESTWALL, type);
          tmpTile = this._save.getTile(startTile.getPosition().add(oneTileNorth));
          if (tmpTile?.getMapData(TilePart.O_OBJECT) && tmpTile.getMapData(TilePart.O_OBJECT)?.getBigWall() !== Pathfinding.BIGWALLNWSE) {
            block += this.blockage(tmpTile, TilePart.O_OBJECT, type, 5);
          }
          if (block === 0) break;
          block = this.blockage(startTile, TilePart.O_WESTWALL, type) +
            this.blockage(this._save.getTile(startTile.getPosition().add(oneTileWest)), TilePart.O_NORTHWALL, type);
          tmpTile = this._save.getTile(startTile.getPosition().add(oneTileWest));
          if (tmpTile?.getMapData(TilePart.O_OBJECT) && tmpTile.getMapData(TilePart.O_OBJECT)?.getBigWall() !== Pathfinding.BIGWALLNWSE) {
            block += this.blockage(tmpTile, TilePart.O_OBJECT, type, 1);
          }
        } else {
          block = Math.trunc((this.blockage(startTile, TilePart.O_WESTWALL, type) + this.blockage(startTile, TilePart.O_NORTHWALL, type)) / 2) +
            Math.trunc((this.blockage(this._save.getTile(startTile.getPosition().add(oneTileNorth)), TilePart.O_WESTWALL, type) +
              this.blockage(this._save.getTile(startTile.getPosition().add(oneTileWest)), TilePart.O_NORTHWALL, type)) / 2);
          block += Math.trunc((this.blockage(this._save.getTile(startTile.getPosition().add(oneTileNorth)), TilePart.O_OBJECT, type, 4) +
            this.blockage(this._save.getTile(startTile.getPosition().add(oneTileWest)), TilePart.O_OBJECT, type, 2)) / 2);
        }
        break;
      default:
        break;
    }

    if (!skipObject || (type === ItemDamageType.DT_NONE && startTile.isBigWall())) {
      block += this.blockage(startTile, TilePart.O_OBJECT, type, direction);
    }

    if (type !== ItemDamageType.DT_NONE) {
      direction += 4;
      if (direction > 7) {
        direction -= 8;
      }
      if (endTile.isBigWall()) {
        block += this.blockage(endTile, TilePart.O_OBJECT, type, direction, true);
      }
    } else if (block <= 127) {
      direction += 4;
      if (direction > 7) {
        direction -= 8;
      }
      if (this.blockage(endTile, TilePart.O_OBJECT, type, direction, true) > 127) {
        return -1;
      }
    }

    return block;
  }

  calculateParabola(originLike: PositionLike, targetLike: PositionLike, storeTrajectory: boolean, trajectory: Position[] | null, excludeUnit: BattleUnit | null, curvature: number, deltaLike: PositionLike): VoxelType {
    const origin = Position.from(originLike);
    const target = Position.from(targetLike);
    const delta = Position.from(deltaLike);
    const ro = Math.sqrt(
      (target.x - origin.x) * (target.x - origin.x) +
      (target.y - origin.y) * (target.y - origin.y) +
      (target.z - origin.z) * (target.z - origin.z)
    );

    if (Math.abs(ro) <= Number.EPSILON) {
      return VoxelType.V_EMPTY;
    }

    let fi = Math.acos((target.z - origin.z) / ro);
    let te = Math.atan2(target.y - origin.y, target.x - origin.x);
    te += (delta.x / ro) / 2 * Math.PI;
    fi += ((delta.z + delta.y) / ro) / 14 * Math.PI * curvature;

    const zA = Math.sqrt(ro) * curvature;
    const zK = 4.0 * zA / ro / ro;
    let x = origin.x;
    let y = origin.y;
    let z = origin.z;
    let step = 8;
    let result = VoxelType.V_EMPTY;
    let lastPosition = new Position(x, y, z);
    let nextPosition = lastPosition;

    if (storeTrajectory && trajectory) {
      trajectory.push(lastPosition);
    }

    while (z > 0) {
      x = Math.trunc(origin.x + step * Math.cos(te) * Math.sin(fi));
      y = Math.trunc(origin.y + step * Math.sin(te) * Math.sin(fi));
      z = Math.trunc(origin.z + step * Math.cos(fi) - zK * (step - ro / 2.0) * (step - ro / 2.0) + zA);
      nextPosition = new Position(x, y, z);

      if (storeTrajectory && trajectory) {
        trajectory.pop();
      }
      result = this.calculateLine(lastPosition, nextPosition, storeTrajectory, storeTrajectory ? trajectory : null, excludeUnit);
      if (result !== VoxelType.V_EMPTY) {
        if (!storeTrajectory && trajectory) {
          result = this.calculateLine(lastPosition, nextPosition, false, trajectory, excludeUnit);
        }
        break;
      }
      lastPosition = nextPosition;
      ++step;
    }

    return result;
  }

  castedShade(voxelLike: PositionLike): number {
    const voxel = Position.from(voxelLike);
    let zStart = voxel.z;
    const tmpCoord = voxel.divide(new Position(16, 16, 24));
    let tile = this._save.getTile(tmpCoord);
    while (tile && tile.isVoid() && !tile.getUnit()) {
      zStart = tmpCoord.z * 24;
      --tmpCoord.z;
      tile = this._save.getTile(tmpCoord);
    }

    const tmpVoxel = voxel.clone();
    this.voxelCheckFlush();
    let z = zStart;
    for (; z > 0; --z) {
      tmpVoxel.z = z;
      if (this.voxelCheck(tmpVoxel, null) !== VoxelType.V_EMPTY) {
        break;
      }
    }
    return z;
  }

  isVoxelVisible(voxelLike: PositionLike): boolean {
    const voxel = Position.from(voxelLike);
    const zStart = voxel.z + 3;
    if (Math.trunc(zStart / 24) !== Math.trunc(voxel.z / 24)) {
      return true;
    }

    const tmpVoxel = voxel.clone();
    const zEnd = Math.trunc(zStart / 24) * 24 + 24;
    this.voxelCheckFlush();
    for (let z = zStart; z < zEnd; ++z) {
      tmpVoxel.z = z;
      if (this.voxelCheck(tmpVoxel, null) === VoxelType.V_OBJECT) return false;
      ++tmpVoxel.x;
      if (this.voxelCheck(tmpVoxel, null) === VoxelType.V_OBJECT) return false;
      ++tmpVoxel.y;
      if (this.voxelCheck(tmpVoxel, null) === VoxelType.V_OBJECT) return false;
    }
    return true;
  }

  calculateLine(originLike: PositionLike, targetLike: PositionLike, storeTrajectory: boolean, trajectory: Position[] | null = null, excludeUnit: BattleUnit | null = null, doVoxelCheck = true, onlyVisible = false, excludeAllBut: BattleUnit | null = null): VoxelType {
    const origin = Position.from(originLike);
    const target = Position.from(targetLike);

    let x: number;
    let x0: number;
    let x1: number;
    let y: number;
    let y0: number;
    let y1: number;
    let z: number;
    let z0: number;
    let z1: number;
    let step_x: number;
    let step_y: number;
    let step_z: number;
    let swap_xy: boolean;
    let swap_xz: boolean;
    let delta_x: number;
    let delta_y: number;
    let delta_z: number;
    let drift_xy: number;
    let drift_xz: number;
    let cx: number;
    let cy: number;
    let cz: number;
    let result: VoxelType;

    let lastPoint = origin.clone();
    let steps = 0;
    let excludeAllUnits = false;
    if (this._save.isBeforeGame()) {
      excludeAllUnits = true;
    }

    x0 = origin.x;
    x1 = target.x;
    y0 = origin.y;
    y1 = target.y;
    z0 = origin.z;
    z1 = target.z;

    swap_xy = Math.abs(y1 - y0) > Math.abs(x1 - x0);
    if (swap_xy) {
      [x0, y0] = [y0, x0];
      [x1, y1] = [y1, x1];
    }

    swap_xz = Math.abs(z1 - z0) > Math.abs(x1 - x0);
    if (swap_xz) {
      [x0, z0] = [z0, x0];
      [x1, z1] = [z1, x1];
    }

    delta_x = Math.abs(x1 - x0);
    delta_y = Math.abs(y1 - y0);
    delta_z = Math.abs(z1 - z0);

    drift_xy = Math.trunc(delta_x / 2);
    drift_xz = Math.trunc(delta_x / 2);

    if (x0 > x1) {
      step_x = -1;
    } else {
      step_x = 1;
    }
    if (y0 > y1) {
      step_y = -1;
    } else {
      step_y = 1;
    }
    if (z0 > z1) {
      step_z = -1;
    } else {
      step_z = 1;
    }

    y = y0;
    z = z0;

    if (doVoxelCheck) {
      this.voxelCheckFlush();
    }

    for (x = x0; ; x += step_x) {
      cx = x;
      cy = y;
      cz = z;

      if (swap_xz) [cx, cz] = [cz, cx];
      if (swap_xy) [cx, cy] = [cy, cx];

      if (storeTrajectory && trajectory) {
        trajectory.push(new Position(cx, cy, cz));
      }

      if (doVoxelCheck) {
        result = this.voxelCheck(new Position(cx, cy, cz), excludeUnit, false, onlyVisible, excludeAllBut);
        if (result !== VoxelType.V_EMPTY) {
          if (trajectory) {
            trajectory.push(new Position(cx, cy, cz));
          }
          return result;
        }
      } else {
        const currentPoint = new Position(cx, cy, cz);
        const temp_res = this.verticalBlockage(this._save.getTile(lastPoint), this._save.getTile(currentPoint), ItemDamageType.DT_NONE);
        result = this.horizontalBlockage(this._save.getTile(lastPoint), this._save.getTile(currentPoint), ItemDamageType.DT_NONE, steps < 2);
        steps++;
        if (result === -1) {
          if (temp_res > 127) {
            result = 0;
          } else {
            return result;
          }
        }
        result = result + temp_res;
        if (result > 127) {
          return result;
        }

        lastPoint = currentPoint;
      }

      if (x === x1) {
        break;
      }

      drift_xy = drift_xy - delta_y;
      drift_xz = drift_xz - delta_z;

      if (drift_xy < 0) {
        y = y + step_y;
        drift_xy = drift_xy + delta_x;
        if (doVoxelCheck) {
          cx = x;
          cz = z;
          cy = y;
          if (swap_xz) [cx, cz] = [cz, cx];
          if (swap_xy) [cx, cy] = [cy, cx];
          result = this.voxelCheck(new Position(cx, cy, cz), excludeUnit, excludeAllUnits, onlyVisible, excludeAllBut);
          if (result !== VoxelType.V_EMPTY) {
            if (trajectory) {
              trajectory.push(new Position(cx, cy, cz));
            }
            return result;
          }
        }
      }

      if (drift_xz < 0) {
        z = z + step_z;
        drift_xz = drift_xz + delta_x;
        if (doVoxelCheck) {
          cx = x;
          cy = y;
          cz = z;
          if (swap_xz) [cx, cz] = [cz, cx];
          if (swap_xy) [cx, cy] = [cy, cx];
          result = this.voxelCheck(new Position(cx, cy, cz), excludeUnit, excludeAllUnits, onlyVisible, excludeAllBut);
          if (result !== VoxelType.V_EMPTY) {
            if (trajectory) {
              trajectory.push(new Position(cx, cy, cz));
            }
            return result;
          }
        }
      }
    }

    return VoxelType.V_EMPTY;
  }

  calculateSunShading(tile?: Tile): void {
    const layer = 0;
    if (tile) {
      this.calculateTileSunShading(tile, layer);
      return;
    }
    for (const battleTile of this._save.getTiles()) {
      battleTile.resetLight(layer);
      this.calculateTileSunShading(battleTile, layer);
    }
  }

  calculateTerrainLighting(): void {
    const layer = 1;
    const fireLightPower = 15;
    for (const tile of this._save.getTiles()) {
      tile.resetLight(layer);
    }
    for (const tile of this._save.getTiles()) {
      const floorLight = tile.getMapData(TilePart.O_FLOOR)?.getLightSource() || 0;
      if (floorLight > 0) {
        this.addLight(tile.getPosition(), floorLight, layer);
      }
      const objectLight = tile.getMapData(TilePart.O_OBJECT)?.getLightSource() || 0;
      if (objectLight > 0) {
        this.addLight(tile.getPosition(), objectLight, layer);
      }
      if (tile.getFire()) {
        this.addLight(tile.getPosition(), fireLightPower, layer);
      }
      for (const item of tile.getInventory()) {
        if (item.getRules().getBattleType() === BattleType.BT_FLARE) {
          this.addLight(tile.getPosition(), item.getRules().getPower(), layer);
        }
      }
    }
  }

  calculateUnitLighting(): void {
    const layer = 2;
    const personalLightPower = 15;
    const fireLightPower = 15;
    for (const tile of this._save.getTiles()) {
      tile.resetLight(layer);
    }
    for (const unit of this._save.getUnits()) {
      if (this._personalLighting && unit.getFaction() === UnitFaction.FACTION_PLAYER && !unit.isOut()) {
        this.addLight(unit.getPosition(), personalLightPower, layer);
      }
      if (unit.getFire()) {
        this.addLight(unit.getPosition(), fireLightPower, layer);
      }
    }
  }

  private reactionWeaponResearched(unit: BattleUnit, weapon: BattleItem): boolean {
    if (unit.getOriginalFaction() !== UnitFaction.FACTION_PLAYER) {
      return true;
    }
    const requirements = weapon.getRules().getRequirements();
    const savedGame = this._save.getBattleState()?.getGame().getSavedGame();
    return savedGame ? savedGame.isResearched(requirements) : requirements.length === 0;
  }

  getVoxelData(): number[] {
    return this._voxelData;
  }

  static getHeightFromCenter(index: number): number {
    return TileEngine.heightFromCenter[index] || 0;
  }

  private applyExplosionDamage(dest: Tile, centerTilePos: Position, power: number, type: ItemDamageType, unit: BattleUnit | null): void {
    const dmgRng = type === ItemDamageType.DT_HE ? TileEngine.EXPLOSIVE_DAMAGE_RANGE : TileEngine.DAMAGE_RANGE;
    const min = Math.trunc(power * (100 - dmgRng) / 100);
    const max = Math.trunc(power * (100 + dmgRng) / 100);
    let hitUnit = dest.getUnit();
    const tileBelow = this._save.getTile(dest.getPosition().add(new Position(0, 0, -1)));
    if (!hitUnit && dest.getPosition().z > 0 && dest.hasNoFloor(tileBelow)) {
      const belowUnit = tileBelow?.getUnit() || null;
      if (belowUnit && belowUnit.getHeight() + belowUnit.getFloatHeight() - tileBelow!.getTerrainLevel() > 24) {
        hitUnit = belowUnit;
      }
    }

    switch (type) {
      case ItemDamageType.DT_STUN:
        if (hitUnit) {
          const relative = this.distance(dest.getPosition(), centerTilePos) < 2 ? new Position() : centerTilePos.subtract(dest.getPosition());
          hitUnit.damage(relative, RNG.generate(min, max), type);
        }
        for (const item of dest.getInventory()) {
          item.getUnit()?.damage(new Position(), RNG.generate(min, max), type);
        }
        break;
      case ItemDamageType.DT_HE:
        if (hitUnit) {
          const nearGroundZero = Math.abs(dest.getPosition().x - centerTilePos.x) < 2 &&
            Math.abs(dest.getPosition().y - centerTilePos.y) < 2 &&
            dest.getPosition().z === centerTilePos.z;
          const relative = nearGroundZero || dest.getPosition().z > centerTilePos.z
            ? new Position()
            : centerTilePos.add(new Position(0, 0, 5)).subtract(dest.getPosition());
          hitUnit.damage(relative, RNG.generate(min, max), type);
        }
        for (const item of [...dest.getInventory()]) {
          if (power > item.getRules().getArmor()) {
            if (item.getUnit()?.getStatus() === UnitStatus.STATUS_UNCONSCIOUS) {
              item.getUnit()?.kill();
            }
            this._save.removeItem(item);
          }
        }
        break;
      case ItemDamageType.DT_SMOKE:
        if (dest.getSmoke() < 10 && dest.getTerrainLevel() > -24) {
          dest.setFire(0);
          dest.setSmoke(RNG.generate(7, 15));
        }
        break;
      case ItemDamageType.DT_IN:
        if (!dest.isVoid()) {
          if (dest.getFire() === 0 && (dest.getMapData(TilePart.O_FLOOR) || dest.getMapData(TilePart.O_OBJECT))) {
            dest.setFire(dest.getFuel() + 1);
            dest.setSmoke(clamp(15 - Math.trunc(dest.getFlammability() / 10), 1, 12));
          }
          if (hitUnit) {
            const resistance = hitUnit.getArmor().getDamageModifier(ItemDamageType.DT_IN);
            if (resistance > 0.0) {
              hitUnit.damage(new Position(0, 0, 12 - dest.getTerrainLevel()), RNG.generate(TileEngine.FIRE_DAMAGE_RANGE[0], TileEngine.FIRE_DAMAGE_RANGE[1]), ItemDamageType.DT_IN, true);
              const burnTime = RNG.generate(0, Math.trunc(5.0 * resistance));
              if (hitUnit.getFire() < burnTime) {
                hitUnit.setFire(burnTime);
              }
            }
          }
        }
        break;
      default:
        break;
    }

    if (unit && hitUnit && hitUnit.getFaction() !== unit.getFaction()) {
      unit.addFiringExp();
    }
  }

  private detonate(tile: Tile): boolean {
    const explosive = tile.getExplosive();
    if (explosive === 0) {
      return false;
    }
    tile.setExplosive(0, 0, true);
    let objective = false;
    const pos = tile.getPosition();
    const tiles: Array<Tile | null> = [
      this._save.getTile(new Position(pos.x, pos.y, pos.z + 1)),
      this._save.getTile(new Position(pos.x + 1, pos.y, pos.z)),
      this._save.getTile(new Position(pos.x, pos.y + 1, pos.z)),
      tile,
      tile,
      tile,
      tile,
      this._save.getTile(new Position(pos.x, pos.y - 1, pos.z)),
      this._save.getTile(new Position(pos.x - 1, pos.y, pos.z))
    ];
    const parts = [
      TilePart.O_FLOOR,
      TilePart.O_WESTWALL,
      TilePart.O_NORTHWALL,
      TilePart.O_FLOOR,
      TilePart.O_WESTWALL,
      TilePart.O_NORTHWALL,
      TilePart.O_OBJECT,
      TilePart.O_OBJECT,
      TilePart.O_OBJECT
    ];
    let bigWallDestroyed = true;
    let skipNorthWest = false;

    for (let i = 8; i >= 0; --i) {
      const target = tiles[i];
      let currentPart = parts[i];
      const initialMapData = target?.getMapData(currentPart) || null;
      if (!target || !initialMapData) {
        continue;
      }
      const bigWall = initialMapData.getBigWall();
      if (i > 6 && !(
        bigWall === Pathfinding.BLOCK ||
        bigWall === Pathfinding.BIGWALLEASTANDSOUTH ||
        (i === 8 && bigWall === Pathfinding.BIGWALLEAST) ||
        (i === 7 && bigWall === Pathfinding.BIGWALLSOUTH)
      )) {
        continue;
      }
      if (bigWall !== 0) {
        skipNorthWest = true;
      }
      if (!bigWallDestroyed && i < 6) {
        continue;
      }
      if (skipNorthWest && (i === 2 || i === 1)) {
        continue;
      }

      let remainingPower = explosive;
      let destroyed = false;
      let volume = 0;
      let fireProof = target.getFlammability(currentPart);
      let fuel = target.getFuel(currentPart) + 1;
      for (let j = 0; j < 12; ++j) {
        if (target.getMapData(currentPart)?.getLoftID(j) !== 0) {
          volume++;
        }
      }
      if (i === 6 &&
        (bigWall === Pathfinding.BIGWALLNESW || bigWall === Pathfinding.BIGWALLNWSE) &&
        (2 * initialMapData.getArmor()) > remainingPower) {
        bigWallDestroyed = false;
      }

      while (target.getMapData(currentPart) &&
        target.getMapData(currentPart)!.getArmor() !== 255 &&
        2 * target.getMapData(currentPart)!.getArmor() <= remainingPower) {
        const currentMapData = target.getMapData(currentPart)!;
        if (i === 6 && (bigWall === Pathfinding.BIGWALLNESW || bigWall === Pathfinding.BIGWALLNWSE)) {
          bigWallDestroyed = true;
        }
        if (i === 6 &&
          (bigWall === Pathfinding.BIGWALLEAST ||
            bigWall === Pathfinding.BIGWALLSOUTH ||
            bigWall === Pathfinding.BIGWALLEASTANDSOUTH)) {
          skipNorthWest = false;
        }
        remainingPower -= 2 * currentMapData.getArmor();
        destroyed = true;
        if (this._save.getMissionType() === "STR_BASE_DEFENSE" && currentMapData.isBaseModule()) {
          const module = this._save.getModuleMap()[Math.trunc(tile.getPosition().x / 10)]?.[Math.trunc(tile.getPosition().y / 10)];
          if (module) {
            module[1]--;
          }
        }

        const dieMCD = currentMapData.getDieMCD();
        let nextPart = currentPart;
        if (dieMCD !== 0) {
          nextPart = currentMapData.getDataset()?.getObject?.(dieMCD)?.getObjectType() ?? currentPart;
        }
        if (target.destroy(currentPart, this._save.getObjectiveType())) {
          objective = true;
        }
        currentPart = nextPart;
        if (target.getMapData(currentPart)) {
          fireProof = target.getFlammability(currentPart);
          fuel = target.getFuel(currentPart) + 1;
        }
      }
      if (2 * fireProof < remainingPower && (target.getMapData(TilePart.O_FLOOR) || target.getMapData(TilePart.O_OBJECT))) {
        target.setFire(fuel);
        target.setSmoke(clamp(15 - Math.trunc(fireProof / 10), 1, 12));
      }
      if (destroyed) {
        if (target.getFire() && !target.getMapData(TilePart.O_FLOOR) && !target.getMapData(TilePart.O_OBJECT)) {
          target.setFire(0);
        }
        if (!target.getFire()) {
          const smoke = RNG.generate(1, Math.trunc(volume / 2) + 3) + Math.trunc(volume / 2);
          if (smoke > target.getSmoke()) {
            target.setSmoke(clamp(smoke, 0, 15));
          }
        }
      }
    }
    return objective;
  }

  private isPositionLike(value: unknown): value is PositionLike {
    if (typeof value !== "object" || value === null) {
      return false;
    }
    const candidate = value as Partial<PositionLike>;
    return typeof candidate.x === "number" && typeof candidate.y === "number" && typeof candidate.z === "number";
  }

  private isBattleUnitLike(value: unknown): value is BattleUnit {
    if (typeof value !== "object" || value === null) {
      return false;
    }
    const candidate = value as {
      getPosition?: unknown;
      getFaction?: unknown;
      clearVisibleUnits?: unknown;
      clearVisibleTiles?: unknown;
    };
    return typeof candidate.getPosition === "function" &&
      typeof candidate.getFaction === "function" &&
      typeof candidate.clearVisibleUnits === "function" &&
      typeof candidate.clearVisibleTiles === "function";
  }

  private assignPosition(target: Position, source: PositionLike): void {
    target.x = source.x;
    target.y = source.y;
    target.z = source.z;
  }

  private validThrowRange(action: BattleAction, origin: Position, target: Tile | null): boolean {
    const actor = action.actor;
    const weapon = action.weapon;
    if (action.type !== BattleActionType.BA_THROW) {
      return true;
    }
    if (!actor || !weapon || !target) {
      return false;
    }

    const offset = 2;
    const zd = origin.z - ((action.target.z * 24 + offset) - target.getTerrainLevel());
    let weight = weapon.getRules().getWeight();
    const ammo = weapon.getAmmoItem();
    if (ammo && ammo !== weapon) {
      weight += ammo.getRules().getWeight();
    }
    const maxDistance = (this.getMaxThrowDistance(weight, actor.getBaseStats().strength, zd) + 8) / 16.0;
    const xdiff = action.target.x - actor.getPosition().x;
    const ydiff = action.target.y - actor.getPosition().y;
    const realDistance = Math.sqrt(xdiff * xdiff + ydiff * ydiff);
    return realDistance <= maxDistance;
  }

  private getMaxThrowDistance(weight: number, strength: number, level: number): number {
    let curZ = level + 0.5;
    let dz = 1.0;
    let dist = 0;
    while (dist < 4000) {
      dist += 8;
      if (dz < -1) {
        curZ -= 8;
      } else {
        curZ += dz * 8;
      }

      if (curZ < 0 && dz < 0) {
        dz = Math.max(dz, -1.0);
        if (Math.abs(dz) > 1e-10) {
          dist -= curZ / dz;
        }
        break;
      }
      dz -= (50 * weight / strength) / 100;
      if (dz <= -2.0) {
        break;
      }
    }
    return Math.trunc(dist);
  }

  private getTrajectoryPositionFromEnd(trajectory: Position[], pos: number): Position {
    if (trajectory.length === 0) {
      return new Position();
    }
    const index = trajectory.length + pos - 1;
    if (index < 0) {
      return trajectory[0];
    }
    if (index >= trajectory.length) {
      return trajectory[trajectory.length - 1];
    }
    return trajectory[index];
  }

  private getDoorCheckPositions(direction: number, x: number, y: number, rClick: boolean): Array<{ offset: Position; part: TilePart }> {
    const checks: Array<{ offset: Position; part: TilePart }> = [];
    switch (direction) {
      case 0:
        checks.push({ offset: new Position(0, 0, 0), part: TilePart.O_NORTHWALL });
        if (x !== 0) checks.push({ offset: new Position(0, -1, 0), part: TilePart.O_WESTWALL });
        break;
      case 1:
        checks.push({ offset: new Position(0, 0, 0), part: TilePart.O_NORTHWALL });
        checks.push({ offset: new Position(1, -1, 0), part: TilePart.O_WESTWALL });
        if (rClick) {
          checks.push({ offset: new Position(1, 0, 0), part: TilePart.O_WESTWALL });
          checks.push({ offset: new Position(1, 0, 0), part: TilePart.O_NORTHWALL });
        }
        break;
      case 2:
        checks.push({ offset: new Position(1, 0, 0), part: TilePart.O_WESTWALL });
        break;
      case 3:
        if (!y) checks.push({ offset: new Position(1, 1, 0), part: TilePart.O_WESTWALL });
        if (!x) checks.push({ offset: new Position(1, 1, 0), part: TilePart.O_NORTHWALL });
        if (rClick) {
          checks.push({ offset: new Position(1, 0, 0), part: TilePart.O_WESTWALL });
          checks.push({ offset: new Position(0, 1, 0), part: TilePart.O_NORTHWALL });
        }
        break;
      case 4:
        checks.push({ offset: new Position(0, 1, 0), part: TilePart.O_NORTHWALL });
        break;
      case 5:
        checks.push({ offset: new Position(0, 0, 0), part: TilePart.O_WESTWALL });
        checks.push({ offset: new Position(-1, 1, 0), part: TilePart.O_NORTHWALL });
        if (rClick) {
          checks.push({ offset: new Position(0, 1, 0), part: TilePart.O_WESTWALL });
          checks.push({ offset: new Position(0, 1, 0), part: TilePart.O_NORTHWALL });
        }
        break;
      case 6:
        checks.push({ offset: new Position(0, 0, 0), part: TilePart.O_WESTWALL });
        if (y !== 0) checks.push({ offset: new Position(-1, 0, 0), part: TilePart.O_NORTHWALL });
        break;
      case 7:
        checks.push({ offset: new Position(0, 0, 0), part: TilePart.O_WESTWALL });
        checks.push({ offset: new Position(0, 0, 0), part: TilePart.O_NORTHWALL });
        if (x) checks.push({ offset: new Position(-1, -1, 0), part: TilePart.O_WESTWALL });
        if (y) checks.push({ offset: new Position(-1, -1, 0), part: TilePart.O_NORTHWALL });
        if (rClick) {
          checks.push({ offset: new Position(0, -1, 0), part: TilePart.O_WESTWALL });
          checks.push({ offset: new Position(-1, 0, 0), part: TilePart.O_NORTHWALL });
        }
        break;
      default:
        break;
    }
    return checks;
  }

  private getGroundInventory(mod: TileEngineModLike | null | undefined): RuleInventory {
    const ground = mod?.getInventory?.("STR_GROUND", true);
    if (!ground) {
      throw new Error("Inventory STR_GROUND not found.");
    }
    return ground;
  }

  private calculateTileSunShading(tile: Tile, layer: number): void {
    let power = 15 - this._save.getGlobalShade();
    if (this._save.getGlobalShade() <= 4) {
      let block = 0;
      const pos = tile.getPosition();
      for (let z = this._save.getMapSizeZ() - 1; z > pos.z; --z) {
        block += this.blockage(this._save.getTile(new Position(pos.x, pos.y, z)), TilePart.O_FLOOR, ItemDamageType.DT_NONE);
        block += this.blockage(this._save.getTile(new Position(pos.x, pos.y, z)), TilePart.O_OBJECT, ItemDamageType.DT_NONE, 9);
      }
      if (block > 0) {
        power -= 2;
      }
    }
    tile.addLight(power, layer);
  }

  private addLight(centerLike: PositionLike, power: number, layer: number): void {
    const center = Position.from(centerLike);
    for (let x = 0; x <= power; ++x) {
      for (let y = 0; y <= power; ++y) {
        for (let z = 0; z < this._save.getMapSizeZ(); ++z) {
          const distance = Math.round(Math.sqrt(x * x + y * y));
          const light = power - distance;
          this._save.getTile(new Position(center.x + x, center.y + y, z))?.addLight(light, layer);
          this._save.getTile(new Position(center.x - x, center.y - y, z))?.addLight(light, layer);
          this._save.getTile(new Position(center.x - x, center.y + y, z))?.addLight(light, layer);
          this._save.getTile(new Position(center.x + x, center.y - y, z))?.addLight(light, layer);
        }
      }
    }
  }

  private blockage(tile: Tile | null, part: TilePart, type: ItemDamageType, direction = -1, checkingFromOrigin = false): number {
    let amount = 0;
    if (!tile) {
      return 0;
    }

    const mapData = tile.getMapData(part);
    if (mapData) {
      let check = true;
      let wall = -1;
      if (direction !== -1) {
        wall = tile.getMapData(TilePart.O_OBJECT)?.getBigWall() ?? 0;
        if (type !== ItemDamageType.DT_SMOKE &&
          checkingFromOrigin &&
          (wall === Pathfinding.BIGWALLNESW || wall === Pathfinding.BIGWALLNWSE)) {
          check = false;
        }

        switch (direction) {
          case 0:
            if (wall === Pathfinding.BIGWALLWEST ||
              wall === Pathfinding.BIGWALLEAST ||
              wall === Pathfinding.BIGWALLSOUTH ||
              wall === Pathfinding.BIGWALLEASTANDSOUTH) {
              check = false;
            }
            break;
          case 1:
            if (wall === Pathfinding.BIGWALLWEST || wall === Pathfinding.BIGWALLSOUTH) {
              check = false;
            }
            break;
          case 2:
            if (wall === Pathfinding.BIGWALLNORTH ||
              wall === Pathfinding.BIGWALLSOUTH ||
              wall === Pathfinding.BIGWALLWEST ||
              wall === Pathfinding.BIGWALLWESTANDNORTH) {
              check = false;
            }
            break;
          case 3:
            if (wall === Pathfinding.BIGWALLNORTH ||
              wall === Pathfinding.BIGWALLWEST ||
              wall === Pathfinding.BIGWALLWESTANDNORTH) {
              check = false;
            }
            break;
          case 4:
            if (wall === Pathfinding.BIGWALLWEST ||
              wall === Pathfinding.BIGWALLEAST ||
              wall === Pathfinding.BIGWALLNORTH ||
              wall === Pathfinding.BIGWALLWESTANDNORTH) {
              check = false;
            }
            break;
          case 5:
            if (wall === Pathfinding.BIGWALLNORTH || wall === Pathfinding.BIGWALLEAST) {
              check = false;
            }
            break;
          case 6:
            if (wall === Pathfinding.BIGWALLNORTH ||
              wall === Pathfinding.BIGWALLSOUTH ||
              wall === Pathfinding.BIGWALLEAST ||
              wall === Pathfinding.BIGWALLEASTANDSOUTH) {
              check = false;
            }
            break;
          case 7:
            if (wall === Pathfinding.BIGWALLSOUTH ||
              wall === Pathfinding.BIGWALLEAST ||
              wall === Pathfinding.BIGWALLEASTANDSOUTH) {
              check = false;
            }
            break;
          case Pathfinding.DIR_UP:
          case Pathfinding.DIR_DOWN:
            if (wall !== 0 && wall !== Pathfinding.BLOCK) {
              check = false;
            }
            break;
          default:
            break;
        }
      } else if (part === TilePart.O_FLOOR && mapData.getBlock(type) === 0) {
        if (type !== ItemDamageType.DT_NONE) {
          amount += mapData.getArmor();
        } else if (!mapData.isNoFloor()) {
          return 256;
        }
      }

      if (check) {
        if (type === ItemDamageType.DT_SMOKE && wall !== 0 && !tile.isUfoDoorOpen(part)) {
          return 256;
        }
        amount += mapData.getBlock(type);
      }
    }

    if (tile.isUfoDoorOpen(part)) {
      amount = 0;
    }

    return amount;
  }

  private loftVoxelOccupied(loft: number, x: number, y: number): boolean {
    const idx = loft * 16 + y;
    const row = this._voxelData[idx] || 0;
    return Boolean(row & (1 << x));
  }
}
