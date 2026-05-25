import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, rm, writeFile } from "node:fs/promises";
import http from "node:http";
import { dirname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const webRoot = normalize(join(dirname(fileURLToPath(import.meta.url)), ".."));
const repoRoot = normalize(join(webRoot, ".."));
const outputRoot = join(repoRoot, "output", "playwright");
const verifierPath = join(outputRoot, "verify-new-battle-sandbox.js");
const session = "openxcom-new-battle-sandbox";
const url = "http://127.0.0.1:4173/web/index.html";

const verifier = String.raw`async page => {
  await page.goto("http://127.0.0.1:4173/web/index.html");
  await page.waitForFunction(() => document.readyState === "complete");
  await page.waitForFunction(() => {
    const mod = window.openxcomGame?.getMod?.();
    return mod?.getSoldiersList?.().length > 0 &&
      mod?.getCraftsList?.().some(type => (mod.getCraft(type)?.getSoldiers?.() || 0) > 0) &&
      mod?.getItemsList?.().length > 0 &&
      mod?.getResearchList?.().length > 0;
  });

  const result = await page.evaluate(async () => {
    const [
      { NewBattleState },
      { BattlescapeGenerator },
      { BriefingState },
      { Ufo, UfoStatus },
      { MissionSite },
      { AlienBase },
      { BattleType },
      { RNG }
    ] = await Promise.all([
      import("/web/dist/Menu/NewBattleState.js"),
      import("/web/dist/Battlescape/BattlescapeGenerator.js"),
      import("/web/dist/Battlescape/BriefingState.js"),
      import("/web/dist/Savegame/Ufo.js"),
      import("/web/dist/Savegame/MissionSite.js"),
      import("/web/dist/Savegame/AlienBase.js"),
      import("/web/dist/Mod/RuleItem.js"),
      import("/web/dist/Engine/RNG.js")
    ]);

    const assert = (condition, message) => {
      if (!condition) throw new Error(message);
    };
    const game = window.openxcomGame;
    const mod = game.getMod();
    localStorage.removeItem("openxcom.battle.cfg");
    localStorage.removeItem("openxcom.battle-sandbox-verify.cfg");
    RNG.setSeed(12345);

    const expected = { baseItems: 0, craftItems: 0, research: 0 };
    for (const itemType of mod.getItemsList()) {
      const rule = mod.getItem(itemType);
      if (!rule || rule.getBattleType() === BattleType.BT_CORPSE || !rule.isRecoverable()) {
        continue;
      }
      expected.baseItems++;
      if (rule.getBattleType() !== BattleType.BT_NONE && !rule.isFixed() && rule.getBigSprite() > -1) {
        expected.craftItems++;
      }
    }
    expected.research = mod.getResearchList().filter(type => mod.getResearch(type)).length;

    // Existing sandbox init/load/cbxCraft path coverage.
    const state = new NewBattleState();
    state.initSave();
    const save = game.getSavedGame();
    const base = save.getBases()[0];
    const craft = base.getCrafts()[0];
    assert(base.getCrafts().length === 1, "initSave should keep exactly one selected craft");
    assert(base.getSoldiers().length === 30, "initSave should generate 30 soldiers");
    const assigned = base.getSoldiers().filter(soldier => soldier.getCraft() === craft).length;
    assert(assigned === Math.min(30, craft.getRules().getSoldiers()), "initSave should assign first soldiers up to craft capacity");
    assert(base.getStorageItems().getTotalQuantity() === expected.baseItems, "initSave recoverable base item count mismatch");
    assert(craft.getItems().getTotalQuantity() === expected.craftItems, "initSave craft item count mismatch");
    assert(mod.getResearchList().every(type => save.isResearched(type, false)), "initSave should mark all research complete");

    state.save("battle-sandbox-verify");
    const savedSettings = JSON.parse(localStorage.getItem("openxcom.battle-sandbox-verify.cfg"));
    assert(savedSettings.base?.crafts?.length === 1, "save should persist base craft snapshot");
    assert(savedSettings.base?.soldiers?.length === 30, "save should persist sandbox soldiers");
    assert(savedSettings.depth === undefined, "save should follow C++ settings shape and not persist depth");

    const loadedState = new NewBattleState();
    loadedState.load("battle-sandbox-verify");
    const loadedSave = game.getSavedGame();
    const loadedBase = loadedSave.getBases()[0];
    assert(loadedBase.getCrafts().length === 1, "load should restore one craft from base snapshot");
    assert(loadedBase.getSoldiers().length === 30, "load should restore saved sandbox soldiers");
    assert(loadedBase.getStorageItems().getTotalQuantity() === expected.baseItems, "load should reseed recoverable base items");
    assert(mod.getResearchList().every(type => loadedSave.isResearched(type, false)), "load should mark all research complete");

    const currentCraft = loadedBase.getCrafts()[0];
    const currentAssigned = loadedBase.getSoldiers().filter(soldier => soldier.getCraft() === currentCraft).length;
    const smallerIndex = loadedState._crafts.findIndex(type => {
      const rule = mod.getCraft(type);
      return rule && rule.getSoldiers() > 0 && rule.getSoldiers() < currentAssigned;
    });
    assert(smallerIndex >= 0, "verifier needs a craft rule with smaller soldier capacity");
    loadedState._cbxCraft.setSelected(smallerIndex);
    loadedState.cbxCraftChange(null);
    const changedCraft = loadedBase.getCrafts()[0];
    const max = changedCraft.getRules().getSoldiers();
    const trimmedAssigned = loadedBase.getSoldiers().filter(soldier => soldier.getCraft() === changedCraft).length;
    assert(loadedBase.getCrafts().length === 1, "cbxCraftChange should mutate the existing craft rather than selecting another base craft");
    assert(trimmedAssigned <= max, "cbxCraftChange should unassign overflow soldiers in reverse order");

    // Extend to cover NewBattleState.btnOkClick route branches in a fast way.
    const generatorRuns = [];
    const originalRun = BattlescapeGenerator.prototype.run;
    BattlescapeGenerator.prototype.run = async function () {
      const terrainType = this._terrain?.getType?.() || "";
      const missionType = this._save?.getMissionType?.() || "";
      const base = this._base || null;
      const craft = this._craft || null;
      const mission = this._mission || null;
      const alienBase = this._alienBase || null;
      const ufo = this._ufo || null;
      generatorRuns.push({
        missionType,
        terrainType,
        craft: {
          id: craft?.getId?.() || 0,
          type: craft?.getRules?.().getType?.() || craft?.getType?.() || "",
          inBattlescape: craft?.isInBattlescape?.() || false,
          speed: craft?.getSpeed?.() || 0
        },
        base: {
          id: base?.getId?.() || 0,
          type: base?.getType?.() || "",
          inBattlescape: base?.isInBattlescape?.() || false,
          object: base
        },
        missionSite: mission,
        alienBase,
        ufo,
        worldShade: this._worldShade ?? 0,
        difficulty: this._difficulty ?? 0,
        alienRace: this._alienRace || "",
        alienItemLevel: this._alienItemLevel ?? 0,
        inBattlescape: {
          base: this._base?.isInBattlescape?.() || false,
          craft: this._craft?.isInBattlescape?.() || false,
          mission: this._mission?.isInBattlescape?.() || false,
          alienBase: this._alienBase?.isInBattlescape?.() || false,
          ufo: this._ufo?.isInBattlescape?.() || false
        },
        targetKind: this._ufo ? "ufo" : this._alienBase ? "alienBase" : this._mission ? "missionSite" : "none",
        targetType: this._ufo ? ufo?.getRules?.().getType?.() : mission?.getRules?.().getType?.() || ""
      });
    };

    const missionTypes = mod.getDeploymentsList() || [];
    const branchIndexes = {
      baseDefense: missionTypes.indexOf("STR_BASE_DEFENSE"),
      alienBase: missionTypes.findIndex(type => {
        if (type === "STR_BASE_DEFENSE") {
          return false;
        }
        const deployment = mod.getDeployment(type);
        return deployment?.isAlienBase?.() === true;
      }),
      ufo: missionTypes.findIndex(type => {
        if (type === "STR_BASE_DEFENSE") {
          return false;
        }
        return Boolean(mod.getUfo(type));
      }),
      missionSite: missionTypes.findIndex(type => {
        if (type === "STR_BASE_DEFENSE") {
          return false;
        }
        const deployment = mod.getDeployment(type);
        return Boolean(deployment) && !deployment.isAlienBase?.() && !mod.getUfo(type);
      })
    };

    const missionHasAlienMission = mod.getAlienMissionList?.().length > 0;

    const branchOrder = ["baseDefense", "alienBase", "ufo", "missionSite"];
    const runBranch = async (branchName, missionIndex, options = {}) => {
      const detail = {
        branch: branchName,
        covered: false,
        skipped: false,
        mission: missionIndex >= 0 && missionTypes[missionIndex] ? missionTypes[missionIndex] : ""
      };
      if (missionIndex < 0) {
        detail.skipped = true;
        detail.skipReason = "No matching mission rule available in this ruleset";
        return detail;
      }
      if (branchName === "missionSite" && !missionHasAlienMission) {
        detail.skipped = true;
        detail.skipReason = "No alien mission rule in this ruleset";
        return detail;
      }

      const branchState = new NewBattleState();
      branchState.initSave();
      const branchSave = game.getSavedGame();
      assert(branchSave, "branch setup should keep a save");
      const branchBase = branchSave.getBases()[0];
      assert(branchBase && branchBase.getCrafts().length > 0, "branch setup should keep a base craft");

      const branchCraft = branchBase.getCrafts()[0];
      assert(branchCraft, "branch setup should have a selected craft");

      const originalStates = game._states;
      const originalDeleted = game._deleted;
      const beforeRunCount = generatorRuns.length;
      const originalGenerate = RNG.generate;
      const rngValues = options.rngValues || [];
      let rngIndex = 0;
      if (rngValues.length > 0) {
        RNG.generate = (min, max) => {
          if (rngIndex < rngValues.length) {
            const forced = rngValues[rngIndex++];
            assert(Number.isInteger(forced), "Forced RNG value must be an integer");
            assert(forced >= min && forced <= max, "Forced RNG value out of range");
            return forced;
          }
          return originalGenerate(min, max);
        };
      }

      let topState = null;
      let detailMissionType = "";
      let runData;
      game._states = [];
      game._deleted = [];
      game._states.push({ id: "sandbox-verifier-sentinel" }, branchState);
      branchState._cbxMission.setSelected(missionIndex);
      branchState.cbxMissionChange(null);
      branchState._cbxCraft.setSelected(0);
      branchState.cbxCraftChange(null);
      branchState._cbxDifficulty.setSelected(options.difficulty ?? 2);
      branchState._slrDarkness.setValue(options.darkness ?? 8);
      branchState._slrAlienTech.setValue(options.alienTech ?? 1);
      branchState._cbxAlienRace.setSelected(options.alienRace ?? 0);
      if (options.terrainIndex != null) {
        branchState._cbxTerrain.setSelected(options.terrainIndex);
        branchState.cbxTerrainChange(null);
      }
      if (options.missionTerrain) {
        branchState._cbxTerrain.setSelected(Math.max(0, options.missionTerrain));
        branchState.cbxTerrainChange(null);
      }

      try {
        await branchState.btnOkClick(null);
        topState = game._states[game._states.length - 1];
        runData = generatorRuns[generatorRuns.length - 1];
        detailMissionType = game.getSavedGame()?.getSavedBattle()?.getMissionType() || "";
      } finally {
        RNG.generate = originalGenerate;
        game._states = originalStates;
        game._deleted = originalDeleted;
      }

      assert(generatorRuns.length > beforeRunCount, branchName + " branch must call patched BattlescapeGenerator.run");
      const afterSave = game.getSavedGame();
      const battle = afterSave?.getSavedBattle();
      assert(topState instanceof BriefingState, branchName + " should push BriefingState");
      assert(battle, branchName + " should create a SavedBattleGame");

      detail.branchMissionType = detailMissionType || battle.getMissionType();
      detail.briefingCraft = topState._craft === null ? "null" : String(topState._craft?.getRules?.().getType?.() || topState._craft?.getType?.());
      detail.briefingBase = topState._base ? String(topState._base?.getName?.()) : "null";
      detail.generated = {
        missionType: runData.missionType,
        targetKind: runData.targetKind,
        terrainType: runData.terrainType,
        worldShade: runData.worldShade,
        alienRace: runData.alienRace,
        alienItemLevel: runData.alienItemLevel,
        craftType: runData.craft.type,
        craftInBattlescape: runData.craft.inBattlescape,
        craftSpeed: runData.craft.speed
      };

      assert(runData.missionType === battle.getMissionType() || (branchName === "ufo" && (
        battle.getMissionType() === "STR_UFO_GROUND_ASSAULT" || battle.getMissionType() === "STR_UFO_CRASH_RECOVERY"
      )), branchName + " should configure SavedBattleGame mission type");
      assert(runData.worldShade === branchState._slrDarkness.getValue(), branchName + " should pass configured world shade");
      assert(runData.alienRace === branchState._alienRaces[branchState._cbxAlienRace.getSelected()] || runData.alienRace === "", branchName + " should pass configured alien race");
      assert(runData.alienItemLevel === branchState._slrAlienTech.getValue(), branchName + " should pass configured alien item level");
      assert(afterSave.getDifficulty() === branchState._cbxDifficulty.getSelected(), branchName + " should persist configured difficulty");
      if (branchName === "baseDefense") {
        assert(topState._craft === null, "Base defense briefing must receive null craft");
        assert(topState._base === branchBase, "Base defense briefing must receive base target");
      } else {
        assert(topState._base === null, branchName + " should pass null base to briefing");
        assert(topState._craft === branchCraft, branchName + " should pass selected craft to briefing");
      }

      if (branchName === "alienBase") {
        const destination = branchCraft.getDestination?.();
        assert(destination instanceof AlienBase, "Alien-base branch should attach an AlienBase destination");
        assert(destination === runData.alienBase, "Generator should keep alien-base target");
        assert(afterSave.getAlienBases().includes(destination), "AlienBase should be attached to SavedGame");
      } else if (branchName === "ufo") {
        const destination = branchCraft.getDestination?.();
        assert(destination instanceof Ufo, "UFO branch should attach a Ufo destination");
        assert(destination === runData.ufo, "Generator should keep ufo target");
        assert(afterSave.getUfos().includes(destination), "Ufo should be attached to SavedGame");
        const status = destination.getStatus?.();
        assert(status === UfoStatus.LANDED || status === UfoStatus.CRASHED, "UFO branch should set landed/crashed ufo status");
        const expected = status === UfoStatus.LANDED ? "STR_UFO_GROUND_ASSAULT" : "STR_UFO_CRASH_RECOVERY";
        assert(detail.branchMissionType === expected, "UFO branch should map mission by landed/crashed status");
      } else if (branchName === "missionSite") {
        const destination = branchCraft.getDestination?.();
        assert(destination instanceof MissionSite, "Mission-site branch should attach a MissionSite destination");
        assert(destination === runData.missionSite, "Generator should keep mission-site target");
        assert(afterSave.getMissionSites().includes(destination), "Mission-site should be attached to SavedGame");
      } else {
        assert(runData.base.object === branchBase, "Base-defense should set base on generator");
      }
      if (branchName !== "baseDefense") {
        assert(runData.craft.type === branchCraft.getRules().getType(), branchName + " should pass craft to generator");
      }
      assert(branchCraft.getDestination?.() || branchName === "baseDefense", branchName + " should attach destination on non-base defense branch");
      assert(branchCraft.getSpeed() === 0, branchName + " should set craft speed to 0");

      detail.covered = true;
      return detail;
    };

    const coverage = {};
    try {
      for (const branchName of branchOrder) {
        coverage[branchName] = await runBranch(branchName, branchIndexes[branchName], {
          darkness: 9,
          alienTech: 3,
          difficulty: 2,
          rngValues: branchName === "ufo" ? [1] : []
        });
      }
    } finally {
      BattlescapeGenerator.prototype.run = originalRun;
    }
    const coveredBranches = branchOrder.filter(branch => coverage[branch].covered);
    const skippedBranches = branchOrder.filter(branch => coverage[branch].skipped);

    return {
      craft: craft.getRules().getType(),
      assigned,
      baseItems: expected.baseItems,
      craftItems: expected.craftItems,
      research: expected.research,
      trimmedAssigned,
      max,
      branches: {
        requested: branchOrder,
        covered: coveredBranches,
        skipped: skippedBranches,
        details: coverage
      }
    };
  });
  await page.evaluate(value => {
    console.log("VERIFY_NEW_BATTLE_SANDBOX ok " + JSON.stringify(value));
    const branchSummary = value?.branches ? {
      requested: value.branches.requested || [],
      covered: value.branches.covered || [],
      skipped: value.branches.skipped || []
    } : null;
    console.log("VERIFY_NEW_BATTLE_SANDBOX_BRANCHES " + JSON.stringify(branchSummary));
  }, result);
}`;

function line(message) {
  console.log(message);
}

function run(label, command, args, cwd = webRoot) {
  line("- " + label);
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", chunk => { stdout += chunk; });
    child.stderr.on("data", chunk => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", code => {
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        process.stdout.write(stdout);
        process.stderr.write(stderr);
        reject(new Error(label + " failed with status " + code));
      }
    });
  });
}

function runNpm(label, args, cwd = webRoot) {
  if (process.platform === "win32") {
    return run(label, "cmd.exe", ["/d", "/s", "/c", "npm.cmd", ...args], cwd);
  }
  return run(label, "npm", args, cwd);
}

function serverReady() {
  return new Promise(resolve => {
    const req = http.get(url, res => {
      res.resume();
      resolve(res.statusCode === 200);
    });
    req.setTimeout(1000, () => {
      req.destroy();
      resolve(false);
    });
    req.on("error", () => resolve(false));
  });
}

async function waitForServer() {
  for (let i = 0; i < 40; ++i) {
    if (await serverReady()) {
      return;
    }
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error("Local web server did not become ready");
}

async function main() {
  line("VERIFY_NEW_BATTLE_SANDBOX");
  await run("build", process.execPath, [join(webRoot, "scripts", "build.mjs")]);
  await runNpm("typecheck", ["run", "typecheck"], webRoot);
  await mkdir(outputRoot, { recursive: true });
  await writeFile(verifierPath, verifier, "utf8");

  let server = null;
  if (!(await serverReady())) {
    server = spawn(process.execPath, [join(webRoot, "scripts", "serve.mjs")], {
      cwd: repoRoot,
      windowsHide: true,
      stdio: "ignore"
    });
    await waitForServer();
  }

  try {
    await runNpm("playwright open", [
      "exec", "--yes", "--package", "@playwright/cli", "--",
      "playwright-cli", "--session", session, "open", url
    ], repoRoot);
    const runCodeResult = await runNpm("playwright run-code", [
      "exec", "--yes", "--package", "@playwright/cli", "--",
      "playwright-cli", "--session", session, "run-code", "--filename", verifierPath
    ], repoRoot);
    const consoleResult = await runNpm("playwright console", [
      "exec", "--yes", "--package", "@playwright/cli", "--",
      "playwright-cli", "--session", session, "console"
    ], repoRoot);
    if (!consoleResult.stdout.includes("VERIFY_NEW_BATTLE_SANDBOX ok") || consoleResult.stdout.includes("[ERROR]")) {
      throw new Error("Browser verifier marker missing or console error present\nRUN-CODE:\n" + runCodeResult.stdout + "\nCONSOLE:\n" + consoleResult.stdout);
    }
  } finally {
    await runNpm("playwright close", [
      "exec", "--yes", "--package", "@playwright/cli", "--",
      "playwright-cli", "--session", session, "close"
    ], repoRoot).catch(() => {});
    await rm(verifierPath, { force: true }).catch(() => {});
    const cliDir = join(repoRoot, ".playwright-cli");
    if (existsSync(cliDir) && normalize(cliDir).startsWith(repoRoot)) {
      await rm(cliDir, { recursive: true, force: true });
    }
    if (server) {
      server.kill();
    }
  }
  line("VERIFY_NEW_BATTLE_SANDBOX ok");
}

await main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
