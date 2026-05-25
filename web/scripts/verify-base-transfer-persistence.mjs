import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, rm, writeFile } from "node:fs/promises";
import http from "node:http";
import { dirname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const webRoot = normalize(join(dirname(fileURLToPath(import.meta.url)), ".."));
const repoRoot = normalize(join(webRoot, ".."));
const outputRoot = join(repoRoot, "output", "playwright");
const verifierPath = join(outputRoot, "verify-base-transfer-persistence.js");
const session = "openxcom-base-transfer-persistence";
const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const url = "http://127.0.0.1:4173/web/index.html";

const verifier = String.raw`async page => {
  await page.goto("http://127.0.0.1:4173/web/index.html");
  await page.waitForFunction(() => document.readyState === "complete");
  await page.waitForFunction(() => window.openxcomGame?.getMod()?.getInventory?.("STR_GROUND"));

  const result = await page.evaluate(async () => {
    const [
      { SavedGame },
      { Transfer },
      { TransferType },
      { Options }
    ] = await Promise.all([
      import("/web/dist/Savegame/SavedGame.js"),
      import("/web/dist/Savegame/Transfer.js"),
      import("/web/dist/Savegame/Transfer.js"),
      import("/web/dist/Engine/Options.js")
    ]);

    const assert = (condition, message) => {
      if (!condition) {
        throw new Error(message);
      }
    };

    const contractMissing = message => {
      throw new Error("Missing contract: " + message);
    };

    const game = window.openxcomGame;
    assert(game, "openxcomGame is missing");
    const mod = game.getMod();
    assert(mod, "openxcomGame.getMod() is missing");

    const originalSave = game.getSavedGame();
    const masterFolder = Options.getMasterUserFolder();
    const filename = "verify-base-transfer-persistence.sav";
    const storageKey = "openxcom.file:" + masterFolder + filename;
    const removeTransferKeys = () => {
      localStorage.removeItem(storageKey);
      localStorage.removeItem(storageKey + "-new");
      localStorage.removeItem(storageKey + "-new2");
    };

    const fakeRule = {
      getType: () => "STR_VERIF_CRAFT",
      getWeapons: () => 0,
      getMaxSpeed: () => 0,
      getMaxFuel: () => 0,
      getMaxDamage: () => 0,
      getRefuelItem: () => "",
      getRepairRate: () => 0,
      getMarker: () => 0,
      getName: () => "Verif Craft"
    };
    const fakeCraft = {
      getRules: () => fakeRule,
      getName: () => "Transfer Craft",
      load: () => {},
      save: () => ({ type: fakeRule.getType() })
    };
    let originalGetCraft = null;

    const expectedTransferData = {
      item: { id: "STR_PISTOL", qty: 3, hours: 4 },
      scientist: { qty: 2, hours: 6 },
      engineer: { qty: 4, hours: 8 },
      craft: { type: "STR_VERIF_CRAFT", hours: 10 }
    };

    try {
      const writeSave = new SavedGame();
      writeSave.setName(filename);

      const writeBase = writeSave.getBases()[0];
      assert(typeof writeBase.setMod === "function", "Base.setMod contract missing");
      writeBase.setMod(mod);
      writeBase.setName("TRANSFER PERSISTENCE BASE");
      writeBase.setScientists(7);
      writeBase.setEngineers(9);
      if (typeof writeBase.setInBattlescape === "function") {
        writeBase.setInBattlescape(true);
      } else {
        contractMissing("Base.setInBattlescape contract is missing");
      }
      if (typeof writeBase.setRetaliationTarget === "function") {
        writeBase.setRetaliationTarget(true);
      } else {
        contractMissing("Base.setRetaliationTarget contract is missing");
      }

      const transfers = writeBase.getTransfers();
      assert(typeof transfers.push === "function", "Base.getTransfers contract is missing");

      const itemTransfer = new Transfer(expectedTransferData.item.hours);
      itemTransfer.setItems(expectedTransferData.item.id, expectedTransferData.item.qty);
      transfers.push(itemTransfer);

      const scientistTransfer = new Transfer(expectedTransferData.scientist.hours);
      scientistTransfer.setScientists(expectedTransferData.scientist.qty);
      transfers.push(scientistTransfer);

      const engineerTransfer = new Transfer(expectedTransferData.engineer.hours);
      engineerTransfer.setEngineers(expectedTransferData.engineer.qty);
      transfers.push(engineerTransfer);

      const craftTransfer = new Transfer(expectedTransferData.craft.hours);
      craftTransfer.setCraft(fakeCraft);
      transfers.push(craftTransfer);

      if (typeof mod.getCraft !== "function") {
        contractMissing("Mod.getCraft contract is missing");
      }
      originalGetCraft = mod.getCraft.bind(mod);
      mod.getCraft = (type, error = false) => {
        if (type === fakeRule.getType()) {
          return fakeRule;
        }
        const value = originalGetCraft(type, error);
      if (error && !value) {
        contractMissing("Mod.getCraft contract is missing rule \"" + type + "\" for transfer craft load");
        }
        return value;
      };

      assert(transfers.length === 4, "Could not register 4 transfer fixtures before save");

      writeSave.save(filename);
      const savedRaw = localStorage.getItem(storageKey);
      assert(savedRaw, "verify save fixture was not written to localStorage");
      const parsed = JSON.parse(savedRaw);
      const doc = Array.isArray(parsed) ? (parsed[1] || {}) : parsed;
      const saveBaseNode = (doc.bases || [])[0];
      assert(saveBaseNode, "Saved document had no base node");

      if (!Array.isArray(saveBaseNode.transfers)) {
        contractMissing("Base.save persistence does not include transfers in SavedGame.saveBaseNode()");
      }
      const saveTransfers = saveBaseNode.transfers;
      assert(saveTransfers.length === 4, "Saved base transfer count was " + (saveTransfers.length || 0) + ", expected 4");

      const saveItemTransfer = saveTransfers.find(t => t?.itemId === expectedTransferData.item.id && t?.itemQty === expectedTransferData.item.qty);
      assert(saveItemTransfer, "Item transfer did not persist with itemId/itemQty fields");
      assert(saveItemTransfer.hours === expectedTransferData.item.hours, "Item transfer hours did not persist");

      const saveScientistTransfer = saveTransfers.find(t => t?.scientists === expectedTransferData.scientist.qty);
      assert(saveScientistTransfer, "Scientist transfer did not persist with scientists field");
      assert(saveScientistTransfer.hours === expectedTransferData.scientist.hours, "Scientist transfer hours did not persist");

      const saveEngineerTransfer = saveTransfers.find(t => t?.engineers === expectedTransferData.engineer.qty);
      assert(saveEngineerTransfer, "Engineer transfer did not persist with engineers field");
      assert(saveEngineerTransfer.hours === expectedTransferData.engineer.hours, "Engineer transfer hours did not persist");

      const saveCraftTransfer = saveTransfers.find(t => !!t?.craft);
      assert(saveCraftTransfer, "Craft transfer did not persist craft field");
      assert(typeof saveCraftTransfer.hours === "number", "Craft transfer did not persist hours");
      const saveCraftType = saveCraftTransfer?.craft?.type;
      assert(typeof saveCraftType === "string", "Craft transfer did not persist nested craft.type");

      if (typeof saveBaseNode.inBattlescape !== "boolean") {
        contractMissing("Base.save persistence does not include inBattlescape flag on base save node");
      }
      assert(saveBaseNode.inBattlescape === true, "Saved base inBattlescape value was not persisted as true");

      if (typeof saveBaseNode.retaliationTarget !== "boolean") {
        contractMissing("Base.save persistence does not include retaliationTarget flag on base save node");
      }
      assert(saveBaseNode.retaliationTarget === true, "Saved base retaliationTarget value was not persisted as true");

      const readSave = new SavedGame();
      readSave.load(filename, mod);
      const readBase = readSave.getBases()[0];
      assert(readBase, "Loaded save returned no base");

      if (!Array.isArray(readBase.getTransfers())) {
        contractMissing("Base.load persistence does not initialize transfer list with an array");
      }

      const loadedTransfers = readBase.getTransfers();
      if (loadedTransfers.length !== 4) {
        contractMissing("Base load persistence restored " + loadedTransfers.length + " transfers, expected 4");
      }
      const loadedItemTransfer = loadedTransfers.find(t => t?.getType?.() === TransferType.TRANSFER_ITEM);
      const loadedScientistTransfer = loadedTransfers.find(t => t?.getType?.() === TransferType.TRANSFER_SCIENTIST);
      const loadedEngineerTransfer = loadedTransfers.find(t => t?.getType?.() === TransferType.TRANSFER_ENGINEER);
      const loadedCraftTransfer = loadedTransfers.find(t => t?.getType?.() === TransferType.TRANSFER_CRAFT);

      assert(!!loadedItemTransfer, "Loaded base did not include item transfer");
      assert(loadedItemTransfer.getItems() === expectedTransferData.item.id, "Loaded item transfer did not preserve itemId");
      assert(loadedItemTransfer.getQuantity() === expectedTransferData.item.qty, "Loaded item transfer did not preserve itemQty");

      assert(!!loadedScientistTransfer, "Loaded base did not include scientist transfer");
      assert(loadedScientistTransfer.getQuantity() === expectedTransferData.scientist.qty, "Loaded scientist transfer did not preserve scientist qty");

      assert(!!loadedEngineerTransfer, "Loaded base did not include engineer transfer");
      assert(loadedEngineerTransfer.getQuantity() === expectedTransferData.engineer.qty, "Loaded engineer transfer did not preserve engineer qty");

      assert(!!loadedCraftTransfer, "Loaded base did not include craft transfer");
      const loadedCraft = loadedCraftTransfer.getCraft();
      assert(!!loadedCraft, "Loaded craft transfer did not include craft payload");
      const loadedCraftType = loadedCraft.getRules?.()?.getType?.() || loadedCraft.getType?.();
      assert(loadedCraftType === expectedTransferData.craft.type, "Loaded craft transfer did not preserve craft type");

      if (typeof readBase.isInBattlescape !== "function") {
        contractMissing("Base.isInBattlescape contract is missing during load verification");
      }
      if (typeof readBase.getRetaliationTarget !== "function") {
        contractMissing("Base.getRetaliationTarget contract is missing during load verification");
      }
      assert(readBase.isInBattlescape() === true, "Loaded base did not persist inBattlescape true");
      assert(readBase.getRetaliationTarget() === true, "Loaded base did not persist retaliationTarget true");

      return {
        savedTransferCount: saveTransfers.length,
        loadedTransferCount: loadedTransfers.length,
        flags: {
          savedInBattlescape: saveBaseNode.inBattlescape,
          savedRetaliationTarget: saveBaseNode.retaliationTarget,
          loadedInBattlescape: readBase.isInBattlescape(),
          loadedRetaliationTarget: readBase.getRetaliationTarget()
        }
      };
    } finally {
      if (mod && originalGetCraft) {
        mod.getCraft = originalGetCraft;
      }
      removeTransferKeys();
      game.setSavedGame(originalSave);
    }
  });

  await page.evaluate(value => console.log("VERIFY_BASE_TRANSFER_PERSISTENCE ok " + JSON.stringify(value)), result);
}`;

function line(message) {
  console.log(message);
}

function quoteForCmd(arg) {
  const value = String(arg);
  if (!/[ \t\r\n"&|^<>(\)]/.test(value)) {
    return value;
  }
  return `"${value.replace(/"/g, '\\"')}"`;
}

async function run(name, command, args, cwd = webRoot) {
  line(`- ${name}`);
  const useCmd = process.platform === "win32" && command.endsWith(".cmd");
  const runner = useCmd ? "cmd" : command;
  const runnerArgs = useCmd ? ["/d", "/s", "/c", [command, ...args.map(quoteForCmd)].join(" ")] : args;

  const stdout = [];
  const stderr = [];

  return await new Promise((resolve, reject) => {
    const child = spawn(runner, runnerArgs, {
      cwd,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"]
    });

    child.stdout.on("data", chunk => stdout.push(String(chunk)));
    child.stderr.on("data", chunk => stderr.push(String(chunk)));
    child.on("error", reject);
    child.on("close", code => {
      const outText = stdout.join("");
      const errText = stderr.join("");
      if (code === 0) {
        resolve({ stdout: outText, stderr: errText });
      } else {
        reject(new Error(`${name} failed\nstdout:\n${outText}\nstderr:\n${errText}`));
      }
    });
  });
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

async function runBrowserVerifier() {
  line("- browser VERIFY_BASE_TRANSFER_PERSISTENCE");
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
    await run("playwright open", npm, [
      "exec",
      "--yes",
      "--package",
      "@playwright/cli",
      "--",
      "playwright-cli",
      "--session",
      session,
      "open",
      url
    ], repoRoot);

    const runCodeResult = await run("playwright run-code", npm, [
      "exec",
      "--yes",
      "--package",
      "@playwright/cli",
      "--",
      "playwright-cli",
      "--session",
      session,
      "run-code",
      "--filename",
      verifierPath
    ], repoRoot);

    const runConsoleResult = await run("playwright console", npm, [
      "exec",
      "--yes",
      "--package",
      "@playwright/cli",
      "--",
      "playwright-cli",
      "--session",
      session,
      "console"
    ], repoRoot);

    if (!runConsoleResult.stdout.includes("VERIFY_BASE_TRANSFER_PERSISTENCE ok")) {
      throw new Error(`Verifier marker missing or invalid output:\nrun-code:\n${runCodeResult.stdout}\nconsole:\n${runConsoleResult.stdout}`);
    }
    if (runConsoleResult.stdout.includes("Missing contract")) {
      throw new Error(`Missing-transfer-persistence contract detected:\n${runConsoleResult.stdout}`);
    }
    if (runConsoleResult.stderr?.includes("Missing contract")) {
      throw new Error(`Missing-transfer-persistence contract detected:\n${runConsoleResult.stderr}`);
    }
  } finally {
    await run("playwright close", npm, [
      "exec",
      "--yes",
      "--package",
      "@playwright/cli",
      "--",
      "playwright-cli",
      "--session",
      session,
      "close"
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
}

async function main() {
  line("VERIFY_BASE_TRANSFER_PERSISTENCE");
  await run("build", process.execPath, [join(webRoot, "scripts", "build.mjs")]);
  await run("typecheck", npm, ["run", "typecheck"], webRoot);
  await runBrowserVerifier();
  line("VERIFY_BASE_TRANSFER_PERSISTENCE ok");
}

await main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
