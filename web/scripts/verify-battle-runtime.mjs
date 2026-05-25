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
    const [{ Pathfinding }, { TileEngine }, { Position }, { MovementType }, { UnitFaction }, { TilePart, VoxelType }] = await Promise.all([
      import("/web/dist/Battlescape/Pathfinding.js"),
      import("/web/dist/Battlescape/TileEngine.js"),
      import("/web/dist/Battlescape/Position.js"),
      import("/web/dist/Mod/Armor.js"),
      import("/web/dist/Savegame/BattleUnit.js"),
      import("/web/dist/Mod/MapData.js")
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
      isDoor() { return false; }
      isUFODoor() { return false; }
      isGravLift() { return this.gravLift; }
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
      }
      getPosition() { return this.pos.clone(); }
      getTerrainLevel() { return this.terrainLevel; }
      getVisible() { return this.visible; }
      isVoid() { return false; }
      getMapData(part) {
        return part === TilePart.O_FLOOR ? this.floor : null;
      }
      getTUCost(part) {
        if (part === TilePart.O_FLOOR) {
          return this.noFloor ? 255 : 4;
        }
        return 0;
      }
      hasNoFloor() { return this.noFloor; }
      getUnit() { return this.unit; }
      setUnit(unit) { this.unit = unit; }
      getFire() { return 0; }
      getSmoke() { return 0; }
      isUfoDoorOpen() { return false; }
    }

    class FakeSave {
      constructor(sizeX, sizeY, sizeZ) {
        this.sizeX = sizeX;
        this.sizeY = sizeY;
        this.sizeZ = sizeZ;
        this.tiles = new Map();
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

    return {
      straightPath: straightPath.copyPath(),
      straightTU: straightPath.getTotalTUCost(),
      aStarLength: aStarDirs.length,
      gravLift: true,
      flyingUp: true,
      potentialUnitTarget: scanVoxel.toString()
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
