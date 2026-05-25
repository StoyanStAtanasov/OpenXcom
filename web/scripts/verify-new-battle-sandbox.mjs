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
      { BattleType },
      { RNG }
    ] = await Promise.all([
      import("/web/dist/Menu/NewBattleState.js"),
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

    return {
      craft: craft.getRules().getType(),
      assigned,
      baseItems: expected.baseItems,
      craftItems: expected.craftItems,
      research: expected.research,
      trimmedAssigned,
      max
    };
  });
  await page.evaluate(value => console.log("VERIFY_NEW_BATTLE_SANDBOX ok " + JSON.stringify(value)), result);
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
