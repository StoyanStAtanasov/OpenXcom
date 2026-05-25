import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, rm, writeFile } from "node:fs/promises";
import http from "node:http";
import { dirname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const webRoot = normalize(join(dirname(fileURLToPath(import.meta.url)), ".."));
const repoRoot = normalize(join(webRoot, ".."));
const outputRoot = join(repoRoot, "output", "playwright");
const verifierPath = join(outputRoot, "verify-battle-runtime.js");
const session = "openxcom-battle-runtime";
const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const url = "http://127.0.0.1:4173/web/index.html";
const playwrightArgs = command => [
  "exec",
  "--yes",
  "--package",
  "@playwright/cli",
  "--",
  "playwright-cli",
  "--session",
  session,
  ...command
];

const verifier = String.raw`async page => {
  await page.goto("http://127.0.0.1:4173/web/index.html");
  await page.waitForFunction(() => document.readyState === "complete");

  const result = await page.evaluate(async () => {
    const [
      { Pathfinding },
      { TileEngine },
      { ExplosionBState },
      { ProjectileFlyBState },
      { Position },
      { MovementType },
      { UnitFaction, UnitStatus, UnitSide, UnitBodyPart },
      { TilePart, VoxelType },
      { BattlescapeGame, BattleActionType },
      { ItemDamageType, BattleType },
      { SpecialAbility },
      { Mod }
    ] = await Promise.all([
      import("/web/dist/Battlescape/Pathfinding.js"),
      import("/web/dist/Battlescape/TileEngine.js"),
      import("/web/dist/Battlescape/ExplosionBState.js"),
      import("/web/dist/Battlescape/ProjectileFlyBState.js"),
      import("/web/dist/Battlescape/Position.js"),
      import("/web/dist/Mod/Armor.js"),
      import("/web/dist/Savegame/BattleUnit.js"),
      import("/web/dist/Mod/MapData.js"),
      import("/web/dist/Battlescape/BattlescapeGame.js"),
      import("/web/dist/Mod/RuleItem.js"),
      import("/web/dist/Mod/Unit.js"),
      import("/web/dist/Mod/Mod.js")
    ]);

    const assert = (condition, message) => {
      if (!condition) {
        throw new Error(message);
      }
    };

    class FakeMapData {
      constructor({ gravLift = false, loft = 0 } = {}) {
        this.gravLift = gravLift;
        this.loft = loft;
      }
      getBigWall() { return 0; }
      getArmor() { return 0; }
      getBlock() { return 0; }
      getLightSource() { return 0; }
      isDoor() { return false; }
      isUFODoor() { return false; }
      isGravLift() { return this.gravLift; }
      isNoFloor() { return false; }
      getLoftID() { return this.loft; }
    }

    class FakeTile {
      constructor(pos, options = {}) {
        this.pos = pos.clone();
        this.terrainLevel = options.terrainLevel ?? 0;
        this.visible = Boolean(options.visible);
        this.noFloor = Boolean(options.noFloor);
        this.floor = options.floor ?? new FakeMapData();
        this.unit = options.unit ?? null;
        this.inventory = options.inventory ?? [];
        this.explosive = options.explosive ?? 0;
        this.explosiveType = options.explosiveType ?? 0;
        this.fire = options.fire ?? 0;
        this.smoke = options.smoke ?? 0;
        this.light = [0, 0, 0];
        this.dangerous = Boolean(options.dangerous);
      }
      getPosition() { return this.pos.clone(); }
      getTerrainLevel() { return this.terrainLevel; }
      getVisible() { return this.visible; }
      isVoid() { return false; }
      isBigWall() { return false; }
      getMapData(part) {
        return part === TilePart.O_FLOOR ? this.floor : null;
      }
      damage() { return false; }
      getTUCost(part) {
        if (part === TilePart.O_FLOOR) {
          return this.noFloor ? 255 : 4;
        }
        return 0;
      }
      hasNoFloor() { return this.noFloor; }
      getUnit() { return this.unit; }
      setUnit(unit) { this.unit = unit; }
      getInventory() { return this.inventory; }
      addItem(item) { this.inventory.push(item); }
      getExplosive() { return this.explosive; }
      getExplosiveType() { return this.explosiveType; }
      setExplosive(power, type = 0) { this.explosive = power; this.explosiveType = type; }
      getFuel() { return 0; }
      getFlammability() { return 0; }
      getFire() { return this.fire; }
      setFire(value) { this.fire = value; }
      getSmoke() { return this.smoke; }
      setSmoke(value) { this.smoke = value; }
      resetLight(layer) { this.light[layer] = 0; }
      addLight(light, layer) { this.light[layer] = Math.max(this.light[layer] || 0, light); }
      getShade() { return Math.max(0, 15 - Math.max(...this.light)); }
      setDangerous(danger) { this.dangerous = danger; }
      getDangerous() { return this.dangerous; }
      isUfoDoorOpen() { return false; }
    }

    class FakeSave {
      constructor(sizeX, sizeY, sizeZ) {
        this.sizeX = sizeX;
        this.sizeY = sizeY;
        this.sizeZ = sizeZ;
        this.tiles = new Map();
        this.units = [];
        this.fallingUnits = [];
        this.destroyedObjectives = 0;
        this.battleGame = null;
        for (let z = 0; z < sizeZ; ++z) {
          for (let y = 0; y < sizeY; ++y) {
            for (let x = 0; x < sizeX; ++x) {
              const pos = new Position(x, y, z);
              this.tiles.set(this.key(pos), new FakeTile(pos));
            }
          }
        }
      }
      key(pos) { return pos.x + "," + pos.y + "," + pos.z; }
      getMapSizeX() { return this.sizeX; }
      getMapSizeY() { return this.sizeY; }
      getMapSizeZ() { return this.sizeZ; }
      getMapSizeXYZ() { return this.sizeX * this.sizeY * this.sizeZ; }
      getTileCoords(index) {
        const z = Math.trunc(index / (this.sizeX * this.sizeY));
        const rem = index % (this.sizeX * this.sizeY);
        const y = Math.trunc(rem / this.sizeX);
        const x = rem % this.sizeX;
        return new Position(x, y, z);
      }
      getTileIndex(posLike) {
        const pos = Position.from(posLike);
        return pos.x + pos.y * this.sizeX + pos.z * this.sizeX * this.sizeY;
      }
      getTile(posLike) {
        const pos = Position.from(posLike);
        if (pos.x < 0 || pos.y < 0 || pos.z < 0 || pos.x >= this.sizeX || pos.y >= this.sizeY || pos.z >= this.sizeZ) {
          return null;
        }
        return this.tiles.get(this.key(pos)) ?? null;
      }
      setTile(posLike, tile) {
        this.tiles.set(this.key(Position.from(posLike)), tile);
      }
      getTiles() { return [...this.tiles.values()]; }
      getUnits() { return this.units; }
      getMissionType() { return ""; }
      getObjectiveType() { return 0; }
      addDestroyedObjective() { this.destroyedObjectives++; }
      getModuleMap() { return []; }
      getMoraleModifier() { return 100; }
      getGlobalShade() { return 0; }
      getBattleGame() { return this.battleGame; }
      addFallingUnit(unit) { this.fallingUnits.push(unit); }
      getDepth() { return 0; }
      isBeforeGame() { return false; }
    }

    const makeUnit = (pos, movementType = MovementType.MT_WALK) => ({
      getPosition: () => pos.clone(),
      getArmor: () => ({ getSize: () => 1 }),
      getMovementType: () => movementType,
      getFaction: () => UnitFaction.FACTION_PLAYER,
      getSpecialAbility: () => 0,
      getDirection: () => 2,
      getUnitsSpottedThisTurn: () => [],
      getUnitRules: () => null,
      getFloatHeight: () => 0,
      getLoftemps: () => 1,
      isOut: () => false,
      getHeight: () => 20,
      getVisible: () => true
    });

    const straightSave = new FakeSave(6, 5, 2);
    const straightPath = new Pathfinding(straightSave);
    const straightUnit = makeUnit(new Position(1, 2, 0));
    straightPath.calculate(straightUnit, new Position(4, 2, 0));
    assert(JSON.stringify(straightPath.copyPath()) === JSON.stringify([2, 2, 2]), "Bresenham east path did not preserve source directions");
    assert(straightPath.getTotalTUCost() === 12, "Bresenham total TU cost mismatch: " + straightPath.getTotalTUCost());

    const blockedSave = new FakeSave(6, 5, 2);
    blockedSave.setTile(new Position(2, 2, 0), new FakeTile(new Position(2, 2, 0), { noFloor: true }));
    const astarPath = new Pathfinding(blockedSave);
    astarPath.calculate(makeUnit(new Position(1, 2, 0)), new Position(4, 2, 0));
    const aStarDirs = astarPath.copyPath();
    assert(aStarDirs.length >= 3, "A* fallback did not produce a route around a blocked straight-line tile");
    assert(JSON.stringify(aStarDirs) !== JSON.stringify([2, 2, 2]), "A* fallback kept the blocked straight-line path");
    assert(aStarDirs.at(-1) !== Pathfinding.DIR_UP && aStarDirs.at(-1) !== Pathfinding.DIR_DOWN, "A* fallback unexpectedly started with vertical movement");

    const gravSave = new FakeSave(3, 3, 3);
    gravSave.setTile(new Position(1, 1, 0), new FakeTile(new Position(1, 1, 0), { floor: new FakeMapData({ gravLift: true }) }));
    gravSave.setTile(new Position(1, 1, 1), new FakeTile(new Position(1, 1, 1), { floor: new FakeMapData({ gravLift: true }) }));
    const gravPath = new Pathfinding(gravSave);
    assert(gravPath.validateUpDown(makeUnit(new Position(1, 1, 0)), new Position(1, 1, 0), Pathfinding.DIR_UP), "validateUpDown rejected a matching grav-lift up move");

    const flightSave = new FakeSave(3, 3, 3);
    flightSave.setTile(new Position(1, 1, 1), new FakeTile(new Position(1, 1, 1), { noFloor: true }));
    const flightPath = new Pathfinding(flightSave);
    assert(flightPath.validateUpDown(makeUnit(new Position(1, 1, 0), MovementType.MT_FLY), new Position(1, 1, 0), Pathfinding.DIR_UP), "validateUpDown rejected flying up through no roof");

    const lineSave = new FakeSave(6, 5, 1);
    const targetUnit = makeUnit(new Position(3, 2, 0));
    lineSave.setTile(new Position(3, 2, 0), new FakeTile(new Position(3, 2, 0), { unit: targetUnit }));
    const voxelData = Array(32).fill(0);
    for (let row = 16; row < 32; ++row) {
      voxelData[row] = 0xffff;
    }
    const tileEngine = new TileEngine(lineSave, voxelData);
    const scanVoxel = new Position();
    const originVoxel = new Position(1 * 16 + 8, 2 * 16 + 8, 10);
    assert(tileEngine.canTargetUnit(originVoxel, lineSave.getTile(new Position(3, 2, 0)), scanVoxel, straightUnit, false, targetUnit), "canTargetUnit rejected source potentialUnit line-of-fire path");
    assert(tileEngine.voxelCheck(scanVoxel, straightUnit) === VoxelType.V_UNIT, "canTargetUnit scan voxel did not resolve to the target unit");

    const makeStats = () => ({
      kills: [],
      KIA: false,
      wasUnconcious: false,
      slaveKills: 0,
      duplicateEntry(status, id) {
        return this.kills.some(kill => kill.status === status && kill.id === id);
      }
    });
    const makeCasualtyUnit = options => {
      const stats = makeStats();
      let murdererId = options.murdererId ?? 0;
      let killCount = 0;
      const soldier = options.soldier ?? null;
      return {
        _stats: stats,
        _killCount: () => killCount,
        getId: () => options.id,
        getType: () => options.type ?? "STR_TEST_UNIT",
        getUnitRules: () => ({
          getRace: () => options.race ?? "STR_TEST_RACE",
          getRank: () => options.rank ?? "STR_TEST_RANK",
          getSpecialAbility: () => options.specialAbility ?? SpecialAbility.SPECAB_NONE
        }),
        getSpecialAbility: () => options.specialAbility ?? SpecialAbility.SPECAB_NONE,
        getStatus: () => options.status ?? UnitStatus.STATUS_STANDING,
        getHealth: () => options.health ?? 100,
        getStunlevel: () => options.stun ?? 0,
        getFaction: () => options.faction,
        getOriginalFaction: () => options.originalFaction ?? options.faction,
        getGeoscapeSoldier: () => soldier,
        getMurdererId: () => murdererId,
        setMurdererId: id => { murdererId = id; },
        getMindControllerId: () => options.mindControllerId ?? 0,
        getItem: slot => options.items?.[slot] ?? null,
        getStatistics: () => stats,
        getFatalShotSide: () => UnitSide.SIDE_LEFT,
        getFatalShotBodyPart: () => UnitBodyPart.BODYPART_TORSO,
        getMurdererWeapon: () => options.murdererWeapon ?? "STR_BLEED_WEAPON",
        getMurdererWeaponAmmo: () => options.murdererWeaponAmmo ?? "STR_BLEED_AMMO",
        addKillCount: () => { killCount++; },
        killedBy: faction => { options.killedBy = faction; },
        moraleChange: amount => { options.morale = (options.morale ?? 0) + amount; },
        setTurnsSinceSpotted: value => { options.turnsSinceSpotted = value; },
        getArmor: () => ({ getSize: () => 1 }),
        isOut: () => false,
        getBaseStats: () => ({ bravery: 50 }),
        getDirection: () => 2,
        clearVisibleTiles: () => {},
        clearVisibleUnits: () => {},
        freePatrolTarget: () => {},
        getTile: () => null,
        getSpecialWeapon: () => null
      };
    };
    const makeItem = (name, damageType, ammo = []) => ({
      getRules: () => ({
        getName: () => name,
        getDamageType: () => damageType,
        getCompatibleAmmo: () => ammo
      })
    });
    const plasmaClip = makeItem("STR_PLASMA_CLIP", ItemDamageType.DT_PLASMA);
    const plasmaRifle = makeItem("STR_PLASMA_RIFLE", ItemDamageType.DT_NONE, ["STR_PLASMA_CLIP"]);
    const casualtySoldier = {
      getName: () => "Casualty",
      getRankString: () => "STR_SERGEANT"
    };
    const killer = makeCasualtyUnit({
      id: 7,
      faction: UnitFaction.FACTION_HOSTILE,
      health: 100,
      items: { STR_RIGHT_HAND: plasmaRifle },
      type: "STR_SECTOID"
    });
    const victim = makeCasualtyUnit({
      id: 11,
      faction: UnitFaction.FACTION_PLAYER,
      originalFaction: UnitFaction.FACTION_PLAYER,
      health: 0,
      soldier: casualtySoldier,
      type: "STR_XCOM_OPERATIVE"
    });
    const deadSoldiers = [];
    const savedGame = {
      getMissionStatistics: () => [{ id: "mission-0" }, { id: "mission-1" }],
      killSoldier: (soldier, cause) => {
        deadSoldiers.push({ soldier, cause });
        return 0;
      }
    };
    const psiButtonCalls = [];
    const pushedStates = [];
    const casualtySave = {
      getUnits: () => [killer, victim],
      getTurn: () => 4,
      getSide: () => UnitFaction.FACTION_PLAYER,
      getMoraleModifier: () => 100,
      getSelectedUnit: () => null,
      getBattleState: () => null
    };
    const parentState = {
      getGame: () => ({ getSavedGame: () => savedGame }),
      showPsiButton: visible => psiButtonCalls.push(visible),
      getMap: () => ({
        setUnitDying: value => { parentState.unitDying = value; },
        invalidate: () => {}
      })
    };
    const battleGame = Object.create(BattlescapeGame.prototype);
    battleGame._save = casualtySave;
    battleGame._parentState = parentState;
    battleGame._states = pushedStates;
    battleGame._deleted = [];
    battleGame.checkForCasualties(plasmaClip, killer, false, false);
    assert(killer._stats.kills.length === 1, "checkForCasualties did not award a kill to the murderer");
    const kill = killer._stats.kills[0].save();
    assert(kill.status === UnitStatus.STATUS_DEAD, "casualty kill status mismatch: " + kill.status);
    assert(kill.id === 11, "casualty kill victim id mismatch: " + kill.id);
    assert(kill.weapon === "STR_PLASMA_RIFLE", "casualty kill weapon was not resolved from compatible ammo");
    assert(kill.weaponAmmo === "STR_PLASMA_CLIP", "casualty kill ammo mismatch: " + kill.weaponAmmo);
    assert(kill.mission === 2, "casualty kill mission index mismatch: " + kill.mission);
    assert(victim._stats.KIA === true, "geoscape soldier was not marked KIA");
    assert(deadSoldiers.length === 1 && deadSoldiers[0].soldier === casualtySoldier, "saved game did not record killed soldier");
    assert(deadSoldiers[0].cause.type === "STR_SECTOID", "soldier death cause did not record murderer unit stats");
    assert(deadSoldiers[0].cause.faction === UnitFaction.FACTION_HOSTILE, "soldier death cause murderer faction mismatch");
    assert(pushedStates.length === 1, "UnitDieBState was not queued for the casualty");
    assert(psiButtonCalls.length === 1 && psiButtonCalls[0] === false, "psi button was not refreshed after casualties");

    const makeDamageUnit = options => {
      let health = options.health ?? 100;
      let stun = options.stun ?? 0;
      let fatalWounds = options.fatalWounds ?? 0;
      let killedByFaction = null;
      let morale = 100;
      let firingExp = 0;
      return {
        getPosition: () => options.position.clone(),
        setPosition: pos => { options.position = pos.clone(); },
        getArmor: () => ({
          getSize: () => 1,
          getDamageModifier: () => 1,
          getCorpseGeoscape: () => "STR_TEST_CORPSE"
        }),
        getMovementType: () => MovementType.MT_WALK,
        getFaction: () => options.faction,
        getOriginalFaction: () => options.originalFaction ?? options.faction,
        getHealth: () => health,
        getStunlevel: () => stun,
        getFatalWounds: () => fatalWounds,
        damage: () => {
          fatalWounds += options.fatalWoundDelta ?? 1;
          if (options.killOnDamage) {
            health = 0;
          }
          return options.adjustedDamage ?? 12;
        },
        killedBy: faction => {
          if (faction == null) {
            return killedByFaction;
          }
          killedByFaction = faction;
        },
        getKilledBy: () => killedByFaction,
        moraleChange: amount => { morale += amount; },
        getMorale: () => morale,
        getBaseStats: () => ({ bravery: options.bravery ?? 50, strength: 40 }),
        getSpecialAbility: () => options.specialAbility ?? SpecialAbility.SPECAB_NONE,
        isOut: () => false,
        getFloatHeight: () => 0,
        getHeight: () => 20,
        getLoftemps: () => 1,
        getVisible: () => true,
        addFiringExp: () => { firingExp++; },
        getFiringExp: () => firingExp
      };
    };

    const aftermathVoxelData = Array(32).fill(0);
    for (let row = 16; row < 32; ++row) {
      aftermathVoxelData[row] = 0xffff;
    }
    const hitSave = new FakeSave(3, 3, 1);
    const hitAttacker = makeDamageUnit({
      position: new Position(0, 1, 0),
      faction: UnitFaction.FACTION_PLAYER,
      originalFaction: UnitFaction.FACTION_PLAYER
    });
    const explodingVictim = makeDamageUnit({
      position: new Position(1, 1, 0),
      faction: UnitFaction.FACTION_HOSTILE,
      originalFaction: UnitFaction.FACTION_HOSTILE,
      specialAbility: SpecialAbility.SPECAB_EXPLODEONDEATH,
      killOnDamage: true,
      adjustedDamage: 12
    });
    hitSave.getTile(new Position(1, 1, 0)).setUnit(explodingVictim);
    const queuedExplosions = [];
    hitSave.battleGame = {
      getCurrentAction: () => ({ type: BattleActionType.BA_SNAPSHOT }),
      statePushNext: state => queuedExplosions.push(state)
    };
    const hitEngine = new TileEngine(hitSave, aftermathVoxelData);
    const hitResult = hitEngine.hit(new Position(1 * 16 + 8, 1 * 16 + 8, 10), 20, ItemDamageType.DT_AP, hitAttacker);
    assert(hitResult === explodingVictim, "TileEngine.hit did not return the hit unit");
    assert(explodingVictim.getKilledBy() === UnitFaction.FACTION_PLAYER, "TileEngine.hit did not credit fatal wounds to the attacker faction");
    assert(explodingVictim.getMorale() === 93, "TileEngine.hit morale loss mismatch: " + explodingVictim.getMorale());
    assert(hitAttacker.getFiringExp() === 1, "TileEngine.hit did not award firing experience");
    assert(queuedExplosions.length === 1, "TileEngine.hit did not queue explode-on-death aftermath");

    const blastSave = new FakeSave(3, 3, 1);
    const blastAttacker = makeDamageUnit({
      position: new Position(0, 1, 0),
      faction: UnitFaction.FACTION_PLAYER,
      originalFaction: UnitFaction.FACTION_PLAYER
    });
    const blastVictim = makeDamageUnit({
      position: new Position(1, 1, 0),
      faction: UnitFaction.FACTION_HOSTILE,
      originalFaction: UnitFaction.FACTION_HOSTILE
    });
    blastSave.getTile(new Position(1, 1, 0)).setUnit(blastVictim);
    const blastEngine = new TileEngine(blastSave, aftermathVoxelData);
    blastEngine.explode(new Position(1 * 16 + 8, 1 * 16 + 8, 12), 20, ItemDamageType.DT_STUN, 0, blastAttacker);
    assert(blastVictim.getKilledBy() === UnitFaction.FACTION_PLAYER, "TileEngine.explode did not credit fatal wounds to the attacker faction");
    assert(blastAttacker.getFiringExp() > 0, "TileEngine.explode did not award firing experience for hostile damage");

    const chainTile = new FakeTile(new Position(2, 1, 0), { explosive: 40 });
    const chainCalls = [];
    const chainedStates = [];
    const chainParent = {
      getSave: () => ({
        getTileEngine: () => ({
          explode: (...args) => chainCalls.push(args),
          checkForTerrainExplosions: () => chainTile
        }),
        removeItem: () => {}
      }),
      getMap: () => ({ cacheUnits: () => {}, getExplosions: () => [], getBlastFlash: () => false }),
      checkForCasualties: () => {},
      popState: () => { chainParent.popped = true; },
      statePushFront: state => chainedStates.push(state)
    };
    const chainState = new ExplosionBState(chainParent, new Position(8, 8, 0), null, hitAttacker, null);
    chainState._power = 40;
    chainState.explode();
    assert(chainParent.popped === true, "ExplosionBState did not pop before chaining terrain explosions");
    assert(chainedStates.length === 1, "ExplosionBState did not queue chained terrain explosion");
    assert(chainedStates[0]._center.equals(new Position(40, 24, 0)), "ExplosionBState chained terrain center lost the source +8,+8 voxel offset");

    const explosionSounds = [];
    const explosionCenters = [];
    const makeExplosionParent = ({ depth = 0, side = UnitFaction.FACTION_PLAYER, targetFaction = UnitFaction.FACTION_HOSTILE } = {}) => {
      const explosions = [];
      const tile = {
        getPosition: () => new Position(1, 1, 0),
        getUnit: () => ({ getFaction: () => targetFaction })
      };
      const parent = {
        intervals: [],
        invalidated: 0,
        getDepth: () => depth,
        getSave: () => ({
          getSide: () => side,
          getTile: () => tile
        }),
        getMap: () => ({
          setBlastFlash: value => { parent.blastFlash = value; },
          getExplosions: () => explosions,
          getCamera: () => ({
            centerOnPosition: (pos, smooth) => explosionCenters.push({ pos: pos.clone(), smooth }),
            setViewLevel: level => { parent.viewLevel = level; }
          }),
          getSoundAngle: pos => pos.x + pos.y + pos.z,
          invalidate: () => { parent.invalidated++; }
        }),
        getMod: () => ({
          getSoundByDepth: (sound, soundDepth) => ({
            play: (...args) => explosionSounds.push({ sound, depth: soundDepth, args })
          })
        }),
        setStateInterval: value => parent.intervals.push(value),
        popState: () => { parent.popped = true; }
      };
      return { parent, explosions };
    };
    const areaItem = {
      getRules: () => ({
        getPower: () => 90,
        isStrengthApplied: () => false,
        getBattleType: () => BattleType.BT_GRENADE,
        getExplosionRadius: () => 5,
        getHitAnimation: () => 88
      })
    };
    const areaExplosion = makeExplosionParent({ depth: 1 });
    new ExplosionBState(areaExplosion.parent, new Position(1 * 16 + 8, 1 * 16 + 8, 12), areaItem, null).init();
    assert(areaExplosion.explosions.length === 18, "ExplosionBState area explosion sprite count did not follow power/5");
    assert(areaExplosion.explosions[0].getCurrentFrame() === 80, "ExplosionBState underwater area animation did not subtract EXPLODE_FRAMES");
    assert(explosionSounds.length === 1 && explosionSounds[0].sound === Mod.LARGE_EXPLOSION && explosionSounds[0].depth === 1, "ExplosionBState area explosion did not play LARGE_EXPLOSION by depth");

    const hitItem = {
      getRules: () => ({
        getPower: () => 30,
        isStrengthApplied: () => false,
        getBattleType: () => BattleType.BT_FIREARM,
        getExplosionRadius: () => 0,
        getExplosionSpeed: () => 1,
        getHitAnimation: () => 12,
        getHitSound: () => 77,
        getMeleeAnimation: () => 21
      })
    };
    const hitExplosion = makeExplosionParent({ depth: 0 });
    new ExplosionBState(hitExplosion.parent, new Position(2 * 16 + 8, 3 * 16 + 8, 12), hitItem, null).init();
    assert(hitExplosion.explosions.length === 1 && hitExplosion.explosions[0].getCurrentFrame() === 12, "ExplosionBState bullet-hit animation mismatch");
    assert(explosionSounds.at(-1).sound === 77 && explosionSounds.at(-1).args[1] === 5, "ExplosionBState bullet-hit sound/angle mismatch");

    const centersBeforeHostileCosmetic = explosionCenters.length;
    const hostileCosmetic = makeExplosionParent({ side: UnitFaction.FACTION_HOSTILE, targetFaction: UnitFaction.FACTION_PLAYER });
    new ExplosionBState(hostileCosmetic.parent, new Position(1 * 16 + 8, 1 * 16 + 8, 24), hitItem, null, null, false, true).init();
    assert(hostileCosmetic.explosions.length === 1 && hostileCosmetic.explosions[0].getCurrentFrame() === 21, "ExplosionBState cosmetic hit did not use melee animation");
    assert(hostileCosmetic.parent.viewLevel === 1, "ExplosionBState cosmetic hit did not set source view level");
    assert(explosionCenters.length === centersBeforeHostileCosmetic + 1, "ExplosionBState cosmetic hit did not center hostile camera on player target");
    const cosmeticCenterCount = explosionCenters.length;
    const playerCosmetic = makeExplosionParent({ side: UnitFaction.FACTION_PLAYER, targetFaction: UnitFaction.FACTION_HOSTILE });
    new ExplosionBState(playerCosmetic.parent, new Position(1 * 16 + 8, 1 * 16 + 8, 24), hitItem, null, null, false, true).init();
    assert(explosionCenters.length === cosmeticCenterCount, "ExplosionBState cosmetic camera centered outside the source hostile-vs-player condition");

    const dangerSave = new FakeSave(5, 5, 1);
    const dangerEngine = new TileEngine(dangerSave, aftermathVoxelData);
    dangerEngine.setDangerZone(new Position(2, 2, 0), 2, null);
    assert(dangerSave.getTile(new Position(2, 2, 0)).getDangerous() === true, "TileEngine.setDangerZone did not mark the grenade epicenter dangerous");

    const dropSounds = [];
    const droppedItems = [];
    const dangerCalls = [];
    const thrower = {
      getFaction: () => UnitFaction.FACTION_HOSTILE
    };
    const grenadeRule = {
      getBattleType: () => BattleType.BT_GRENADE,
      getExplosionRadius: () => 2
    };
    const grenadeItem = {
      getRules: () => grenadeRule,
      getFuseTimer: () => 1
    };
    const dropVoxel = new Position(2 * 16 + 8, 2 * 16 + 8, 12);
    const projectileDrop = {
      getPosition: () => dropVoxel.clone(),
      getItem: () => grenadeItem
    };
    const projectileParent = {
      getMap: () => ({
        resetCameraSmoothing: () => {},
        getSoundAngle: pos => pos.x + pos.y
      }),
      getSave: () => ({
        getMapSizeX: () => 5,
        getMapSizeY: () => 5
      }),
      getMod: () => ({
        getSoundByDepth: (sound, depth) => ({
          play: (...args) => dropSounds.push({ sound, depth, args })
        })
      }),
      getDepth: () => 0,
      dropItem: (pos, item) => droppedItems.push({ pos: pos.clone(), item }),
      getTileEngine: () => ({
        setDangerZone: (pos, radius, unit) => dangerCalls.push({ pos: pos.clone(), radius, unit })
      }),
      statePushFront: state => { projectileParent.pushed = state; }
    };
    const projectileDropState = Object.create(ProjectileFlyBState.prototype);
    projectileDropState._unit = thrower;
    projectileDropState._action = { type: BattleActionType.BA_THROW, actor: thrower, target: new Position(2, 2, 0) };
    projectileDropState._parent = projectileParent;
    projectileDropState.handleImpact(projectileDrop);
    assert(dropSounds.length === 1 && dropSounds[0].sound === Mod.ITEM_DROP, "ProjectileFlyBState throw impact did not play ITEM_DROP");
    assert(droppedItems.length === 1 && droppedItems[0].item === grenadeItem && droppedItems[0].pos.equals(new Position(2, 2, 0)), "ProjectileFlyBState throw impact did not drop the grenade at the impact tile");
    assert(dangerCalls.length === 1 && dangerCalls[0].radius === 2 && dangerCalls[0].unit === thrower && dangerCalls[0].pos.equals(new Position(2, 2, 0)), "ProjectileFlyBState throw impact did not mark hostile grenade danger");

    const shotSounds = [];
    const cachedUnits = [];
    const aimed = [];
    const cacheValues = [];
    const firingUnit = {
      aim: value => aimed.push(value),
      setCache: value => cacheValues.push(value),
      getPosition: () => new Position(1, 1, 0)
    };
    const ammoRule = { getFireSound: () => 77 };
    const weaponRule = { getFireSound: () => 12 };
    const shotState = Object.create(ProjectileFlyBState.prototype);
    shotState._unit = firingUnit;
    shotState._ammo = {
      getRules: () => ammoRule,
      spendBullet: () => true
    };
    shotState._action = {
      type: BattleActionType.BA_SNAPSHOT,
      weapon: {
        getRules: () => weaponRule,
        setAmmoItem: item => { shotState.clearedAmmo = item; }
      }
    };
    shotState._parent = {
      getMap: () => ({
        cacheUnit: unit => cachedUnits.push(unit),
        getSoundAngle: pos => pos.x + pos.y
      }),
      getMod: () => ({
        getSoundByDepth: (sound, depth) => ({
          play: (...args) => shotSounds.push({ sound, depth, args })
        })
      }),
      getDepth: () => 0,
      getSave: () => ({
        getDebugMode: () => false,
        removeItem: () => {}
      })
    };
    shotState.startShotAnimation({ getOrigin: () => new Position(4, 4, 0) });
    assert(aimed.length === 1 && aimed[0] === true, "ProjectileFlyBState shot lift-off did not aim the unit");
    assert(cacheValues.length === 1 && cacheValues[0] === 0 && cachedUnits[0] === firingUnit, "ProjectileFlyBState shot lift-off did not clear and recache the unit");
    assert(shotSounds.length === 1 && shotSounds[0].sound === 77, "ProjectileFlyBState shot lift-off did not prefer ammo fire sound");

    const arcingCalls = [];
    const arcingStats = { shotsFiredCounter: 0 };
    const arcingTargetUnit = {
      getVisible: () => true,
      getFloatHeight: () => 0,
      getHeight: () => 20
    };
    const arcingTile = {
      getTerrainLevel: () => 0,
      getUnit: () => arcingTargetUnit,
      hasNoFloor: () => false,
      getMapData: () => null
    };
    const arcingEngine = {
      getOriginVoxel: () => new Position(8, 8, 12),
      validateThrow: (_action, _origin, _target, curveRef, testRef) => {
        curveRef.value = 0;
        testRef.value = VoxelType.V_UNIT;
        return true;
      },
      calculateParabola: (_origin, target, _store, trajectory) => {
        trajectory.push(target.clone());
        return VoxelType.V_UNIT;
      }
    };
    const arcingAmmoRule = {
      getBulletSprite: () => -1,
      getVaporColor: () => -1,
      getVaporDensity: () => -1,
      getVaporProbability: () => 5,
      getBulletSpeed: () => 0,
      getFireSound: () => -1
    };
    const arcingWeaponRule = {
      getArcingShot: () => true,
      getFireSound: () => 55,
      getBulletSprite: () => -1,
      getVaporColor: () => -1,
      getVaporDensity: () => -1,
      getVaporProbability: () => 5,
      getBulletSpeed: () => 0,
      getAimRange: () => 100,
      getMinRange: () => 0,
      getSnapRange: () => 100,
      getAutoRange: () => 100,
      getDropoff: () => 0
    };
    const arcingUnit = {
      getFaction: () => UnitFaction.FACTION_PLAYER,
      getFiringAccuracy: () => 120,
      getPosition: () => new Position(1, 1, 0),
      aim: value => arcingCalls.push("aim:" + value),
      setCache: value => arcingCalls.push("cache:" + value),
      getStatistics: () => arcingStats
    };
    const arcingWeapon = {
      getRules: () => arcingWeaponRule,
      getAmmoItem: () => arcingAmmo,
      setAmmoItem: item => { arcingWeapon.cleared = item; }
    };
    const arcingAmmo = {
      getRules: () => arcingAmmoRule,
      getAmmoQuantity: () => 1,
      spendBullet: () => true
    };
    arcingWeapon.getAmmoItem = () => arcingAmmo;
    const arcingState = Object.create(ProjectileFlyBState.prototype);
    arcingState._unit = arcingUnit;
    arcingState._ammo = arcingAmmo;
    arcingState._origin = new Position(1, 1, 0);
    arcingState._originVoxel = new Position(-1, -1, -1);
    arcingState._targetVoxel = new Position(2 * 16 + 8, 2 * 16 + 8, 12);
    arcingState._action = {
      type: BattleActionType.BA_SNAPSHOT,
      actor: arcingUnit,
      weapon: arcingWeapon,
      target: new Position(2, 2, 0),
      waypoints: [],
      cameraPosition: new Position(-1, -1, -1),
      autoShotCounter: 0,
      result: ""
    };
    arcingState._parent = {
      getMod: () => null,
      getSave: () => ({
        getTileEngine: () => arcingEngine,
        getTile: () => arcingTile,
        getSide: () => UnitFaction.FACTION_PLAYER,
        getBattleGame: () => ({ getPanicHandled: () => true }),
        getDebugMode: () => false,
        removeItem: () => {}
      }),
      getMap: () => ({
        setProjectile: projectile => { arcingState.projectile = projectile; },
        cacheUnit: unit => arcingCalls.push(unit === arcingUnit ? "cacheUnit" : "wrongCacheUnit"),
        getSoundAngle: pos => pos.x + pos.y
      }),
      getPanicHandled: () => true,
      getDepth: () => 0,
      setStateInterval: interval => arcingCalls.push("interval:" + interval),
      popState: () => arcingCalls.push("popState")
    };
    assert(arcingState.createNewProjectile() === true, "ProjectileFlyBState arcing shot did not create a projectile");
    assert(arcingStats.shotsFiredCounter === 1, "ProjectileFlyBState arcing shot did not increment shotsFiredCounter");

    const shotgunExplosions = [];
    const shotgunHitCalls = [];
    const shotgunStates = [];
    const shotgunHits = [];
    const shotgunLineCalls = [];
    const shotgunNerfs = [];
    let shotgunFiringXP = 5;
    let shotgunAccuracyCalls = 0;
    const shotgunActor = {
      getFaction: () => UnitFaction.FACTION_PLAYER,
      getFiringAccuracy: () => { shotgunAccuracyCalls++; return 900; },
      getFiringXP: () => shotgunFiringXP,
      nerfFiringXP: value => { shotgunNerfs.push(value); shotgunFiringXP = value; }
    };
    const shotgunAmmoRule = {
      getBulletSprite: () => -1,
      getVaporColor: () => -1,
      getVaporDensity: () => -1,
      getVaporProbability: () => 5,
      getBulletSpeed: () => 0,
      getShotgunPellets: () => 3,
      getExplosionRadius: () => 0,
      getHitAnimation: () => 44,
      getPower: () => 18,
      getDamageType: () => ItemDamageType.DT_AP,
      getFireSound: () => -1,
      getName: () => "STR_SHOTGUN_SHELL"
    };
    const shotgunAmmo = {
      getRules: () => shotgunAmmoRule
    };
    const shotgunWeaponRule = {
      getAutoShots: () => 1,
      getBulletSprite: () => -1,
      getVaporColor: () => -1,
      getVaporDensity: () => -1,
      getVaporProbability: () => 5,
      getBulletSpeed: () => 0,
      getAimRange: () => 100,
      getMinRange: () => 0,
      getSnapRange: () => 100,
      getAutoRange: () => 100,
      getDropoff: () => 0
    };
    const shotgunWeapon = {
      getRules: () => shotgunWeaponRule,
      getAmmoItem: () => shotgunAmmo
    };
    const shotgunEngine = {
      getOriginVoxel: () => new Position(8, 8, 12),
      calculateLine: (_origin, _target, storeTrajectory, trajectory) => {
        if (storeTrajectory && trajectory) {
          const impact = new Position(2 * 16 + 8 + shotgunLineCalls.length, 2 * 16 + 8, 12);
          trajectory.push(impact);
          shotgunLineCalls.push(impact);
          return VoxelType.V_UNIT;
        }
        return VoxelType.V_EMPTY;
      },
      hit: (pos, power, type, unit) => {
        shotgunHitCalls.push({ pos: pos.clone(), power, type, unit });
        shotgunFiringXP += 2;
        return null;
      }
    };
    const shotgunSave = {
      getTileEngine: () => shotgunEngine,
      getDepth: () => 0,
      getBattleGame: () => ({ getPanicHandled: () => false }),
      getTile: () => ({
        getUnit: () => ({
          getStatistics: () => ({ shotAtCounter: 0 })
        })
      })
    };
    const shotgunParent = {
      getMap: () => ({
        resetCameraSmoothing: () => {},
        getExplosions: () => shotgunExplosions
      }),
      getSave: () => shotgunSave,
      getMod: () => null,
      getTileEngine: () => shotgunEngine,
      statePushFront: state => shotgunStates.push(state)
    };
    const shotgunState = Object.create(ProjectileFlyBState.prototype);
    shotgunState._unit = shotgunActor;
    shotgunState._ammo = shotgunAmmo;
    shotgunState._origin = new Position(0, 0, 0);
    shotgunState._targetVoxel = new Position(5 * 16 + 8, 2 * 16 + 8, 12);
    shotgunState._projectileImpact = VoxelType.V_UNIT;
    shotgunState._action = {
      type: BattleActionType.BA_SNAPSHOT,
      actor: shotgunActor,
      weapon: shotgunWeapon,
      target: new Position(2, 2, 0),
      waypoints: [],
      cameraPosition: new Position(-1, -1, -1),
      autoShotCounter: 1,
      result: ""
    };
    shotgunState._parent = shotgunParent;
    shotgunState.projectileHitUnit = pos => shotgunHits.push(pos.clone());
    shotgunState.handleImpact({ getPosition: () => new Position(1 * 16 + 8, 1 * 16 + 8, 12) });
    assert(shotgunStates.length === 1, "ProjectileFlyBState shotgun impact did not queue the primary ExplosionBState");
    assert(shotgunLineCalls.length === 2, "ProjectileFlyBState shotgun cascade did not trace one secondary projectile per extra pellet");
    assert(shotgunExplosions.length === 2, "ProjectileFlyBState shotgun cascade did not add secondary hit animations");
    assert(shotgunHitCalls.length === 2 && shotgunHitCalls.every(call => call.power === 18 && call.type === ItemDamageType.DT_AP), "ProjectileFlyBState shotgun cascade did not apply secondary TileEngine.hit calls");
    assert(shotgunHits.length === 3, "ProjectileFlyBState shotgun cascade did not run projectileHitUnit for primary and secondary unit impacts");
    assert(shotgunAccuracyCalls === 2, "ProjectileFlyBState shotgun cascade did not compute reduced accuracy for each extra pellet");
    assert(shotgunNerfs.length === 1 && shotgunNerfs[0] === 6 && shotgunFiringXP === 6, "ProjectileFlyBState shotgun cascade did not cap firing XP after pellet hits");

    const outAimed = [];
    const outCacheValues = [];
    const outCacheUnits = [];
    const outState = Object.create(ProjectileFlyBState.prototype);
    outState._unit = {
      aim: value => outAimed.push(value),
      setCache: value => outCacheValues.push(value)
    };
    outState._ammo = shotgunAmmo;
    outState._projectileImpact = VoxelType.V_OUTOFBOUNDS;
    outState._action = {
      type: BattleActionType.BA_SNAPSHOT,
      target: new Position(4, 4, 0),
      autoShotCounter: 1,
      weapon: {
        getRules: () => ({ getAutoShots: () => 1 }),
        getAmmoItem: () => null
      }
    };
    outState._parent = {
      getSave: () => ({
        getTile: () => null
      }),
      getMap: () => ({
        resetCameraSmoothing: () => {},
        cacheUnits: () => outCacheUnits.push(true)
      })
    };
    outState.handleImpact({});
    assert(outAimed.length === 1 && outAimed[0] === false && outCacheValues[0] === 0 && outCacheUnits.length === 1, "ProjectileFlyBState out-of-bounds terminal impact did not lower and recache the weapon");

    const finishCalls = [];
    const finishUnit = {
      isOut: () => false,
      abortTurn: () => finishCalls.push("abortTurn")
    };
    const finishState = Object.create(ProjectileFlyBState.prototype);
    finishState._unit = finishUnit;
    finishState._ammo = null;
    finishState._action = {
      type: BattleActionType.BA_SNAPSHOT,
      cameraPosition: new Position(3, 4, 0),
      waypoints: [],
      weapon: null
    };
    finishState._parent = {
      getSave: () => ({
        getBattleState: () => ({ clearMouseScrollingState: () => finishCalls.push("clearMouseScrollingState") }),
        getUnitsFalling: () => false,
        getSide: () => UnitFaction.FACTION_PLAYER,
        getDebugMode: () => false
      }),
      getMap: () => ({
        getProjectile: () => null,
        getCamera: () => ({ setMapOffset: pos => finishCalls.push("setMapOffset:" + pos.toString()) }),
        invalidate: () => finishCalls.push("invalidate")
      }),
      getPanicHandled: () => true,
      getTileEngine: () => ({ checkReactionFire: unit => finishCalls.push(unit === finishUnit ? "checkReactionFire" : "wrongReactionUnit") }),
      setupCursor: () => finishCalls.push("setupCursor"),
      convertInfected: () => finishCalls.push("convertInfected"),
      popState: () => finishCalls.push("popState")
    };
    finishState.think();
    assert(JSON.stringify(finishCalls) === JSON.stringify([
      "clearMouseScrollingState",
      "setMapOffset:(3,4,0)",
      "invalidate",
      "checkReactionFire",
      "abortTurn",
      "setupCursor",
      "convertInfected",
      "popState"
    ]), "ProjectileFlyBState finish cleanup order mismatch: " + JSON.stringify(finishCalls));

    return {
      straightPath: straightPath.copyPath(),
      straightTU: straightPath.getTotalTUCost(),
      aStarLength: aStarDirs.length,
      gravLift: true,
      flyingUp: true,
      potentialUnitTarget: scanVoxel.toString(),
      casualtyKills: killer._stats.kills.length,
      casualtyDeaths: deadSoldiers.length,
      hitAftermathExplosions: queuedExplosions.length,
      blastKilledBy: blastVictim.getKilledBy(),
      explosionSounds: explosionSounds.length,
      hostileGrenadeDanger: dangerCalls.length,
      shotFireSound: shotSounds[0].sound,
      shotgunSecondaryHits: shotgunHitCalls.length,
      shotgunFiringXP,
      projectileFinishCleanup: finishCalls.length
    };
  });

  await page.evaluate(value => console.log("VERIFY_BATTLE_RUNTIME ok " + JSON.stringify(value)), result);
}`;

async function run(command, args, options = {}) {
  const useCmd = process.platform === "win32" && command.endsWith(".cmd");
  const runner = useCmd ? "cmd" : command;
  const runnerArgs = useCmd ? ["/d", "/s", "/c", [command, ...args.map(quoteForCmd)].join(" ")] : args;
  return await new Promise((resolve, reject) => {
    const child = spawn(runner, runnerArgs, {
      cwd: options.cwd || webRoot,
      shell: false,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, ...(options.env || {}) }
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", chunk => { stdout += chunk; });
    child.stderr.on("data", chunk => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", code => {
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        reject(new Error(`${command} ${args.join(" ")} failed with ${code}\n${stdout}\n${stderr}`));
      }
    });
  });
}

function quoteForCmd(arg) {
  const value = String(arg);
  if (!/[ \t\r\n"&|^<>()]/.test(value)) {
    return value;
  }
  return `"${value.replace(/"/g, '\\"')}"`;
}

function waitForServer(targetUrl, timeoutMs = 30000) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const attempt = () => {
      const req = http.get(targetUrl, res => {
        res.resume();
        resolve();
      });
      req.on("error", error => {
        if (Date.now() - started > timeoutMs) {
          reject(error);
        } else {
          setTimeout(attempt, 250);
        }
      });
    };
    attempt();
  });
}

await mkdir(outputRoot, { recursive: true });
await writeFile(verifierPath, verifier, "utf8");

let server;
try {
  await run(npm, ["run", "build"]);
  await run(npm, ["run", "typecheck"]);
  server = spawn(process.execPath, ["scripts/serve.mjs"], {
    cwd: webRoot,
    shell: false,
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"]
  });
  await waitForServer(url);
  await run(npm, playwrightArgs(["open", url]), { cwd: repoRoot });
  const runCodeResult = await run(npm, playwrightArgs(["run-code", "--filename", verifierPath]), { cwd: repoRoot });
  const consoleResult = await run(npm, playwrightArgs(["console"]), { cwd: repoRoot });
  if (!consoleResult.stdout.includes("VERIFY_BATTLE_RUNTIME ok") || consoleResult.stdout.includes("[ERROR]")) {
    throw new Error(`Battle runtime verifier marker missing or error present\nRUN-CODE:\n${runCodeResult.stdout}\nCONSOLE:\n${consoleResult.stdout}\n${consoleResult.stderr}`);
  }
  console.log("VERIFY_BATTLE_RUNTIME ok");
} finally {
  try {
    await run(npm, playwrightArgs(["close"]), { cwd: repoRoot });
  } catch {
    // Ignore cleanup failures when the browser was never opened.
  }
  if (server) {
    server.kill();
  }
  if (existsSync(verifierPath)) {
    await rm(verifierPath, { force: true });
  }
  const cliDir = join(repoRoot, ".playwright-cli");
  if (existsSync(cliDir) && normalize(cliDir).startsWith(repoRoot)) {
    await rm(cliDir, { recursive: true, force: true });
  }
}
