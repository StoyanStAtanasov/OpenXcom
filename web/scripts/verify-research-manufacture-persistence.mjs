import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, rm, writeFile } from "node:fs/promises";
import http from "node:http";
import { dirname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const webRoot = normalize(join(dirname(fileURLToPath(import.meta.url)), ".."));
const repoRoot = normalize(join(webRoot, ".."));
const outputRoot = join(repoRoot, "output", "playwright");
const verifierPath = join(outputRoot, "verify-research-manufacture-persistence.js");
const session = "openxcom-research-manufacture-persistence";
const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const url = "http://127.0.0.1:4173/web/index.html";

const verifier = String.raw`async page => {
  await page.goto("http://127.0.0.1:4173/web/index.html");
  await page.waitForFunction(() => document.readyState === "complete");
  await page.waitForFunction(() => window.openxcomGame?.getMod?.());

  const result = await page.evaluate(async () => {
    const [
      { SavedGame },
      { Base },
      { ResearchProject },
      { Production },
      { RuleResearch },
      { RuleManufacture },
      { Options }
    ] = await Promise.all([
      import("/web/dist/Savegame/SavedGame.js"),
      import("/web/dist/Savegame/Base.js"),
      import("/web/dist/Savegame/ResearchProject.js"),
      import("/web/dist/Savegame/Production.js"),
      import("/web/dist/Mod/RuleResearch.js"),
      import("/web/dist/Mod/RuleManufacture.js"),
      import("/web/dist/Engine/Options.js")
    ]);

    const assert = (condition, message) => {
      if (!condition) {
        throw new Error(message);
      }
    };

    const contractMissing = message => {
      throw new Error(message);
    };

    const game = window.openxcomGame;
    assert(!!game, "openxcomGame is missing");
    const mod = game.getMod();
    assert(!!mod, "openxcomGame.getMod() is missing");
    assert(typeof mod.getResearch === "function", "Mod.getResearch contract missing");
    assert(typeof mod.getResearchList === "function", "Mod.getResearchList contract missing");
    assert(typeof mod.getManufacture === "function", "Mod.getManufacture contract missing");
    assert(typeof mod.getManufactureList === "function", "Mod.getManufactureList contract missing");

    const original = {
      getResearch: mod.getResearch.bind(mod),
      getResearchList: mod.getResearchList.bind(mod),
      getManufacture: mod.getManufacture.bind(mod),
      getManufactureList: mod.getManufactureList.bind(mod)
    };

    const researchName = "STR_VERIFY_RESEARCH_TOPIC";
    const manufactureName = "STR_VERIFY_MANUFACTURE_ITEM";

    const researchRule = new RuleResearch(researchName);
    researchRule.load({
      name: researchName,
      dependencies: [],
      unlocks: [],
      getOneFree: [],
      requires: [],
      cost: 12,
      points: 0
    });
    const manufactureRule = new RuleManufacture(manufactureName);
    manufactureRule.load({
      name: manufactureName,
      category: "STR_MISC",
      requires: [],
      requiredItems: {},
      space: 1,
      time: 6,
      cost: 300
    });

    const fakeResearch = new Map([[researchName, researchRule]]);
    const fakeManufacture = new Map([[manufactureName, manufactureRule]]);
    mod.getResearch = (name, error = false) => {
      if (fakeResearch.has(name)) {
        return fakeResearch.get(name);
      }
      const value = original.getResearch(name, error);
      if (!value && error) {
        contractMissing('Missing research contract for "' + name + '". Add/restore a named RuleResearch in mod.getResearch.');
      }
      return value;
    };
    mod.getResearchList = () => [...fakeResearch.keys()];
    mod.getManufacture = (name, error = false) => {
      if (fakeManufacture.has(name)) {
        return fakeManufacture.get(name);
      }
      const value = original.getManufacture(name, error);
      if (!value && error) {
        contractMissing('Missing manufacture contract for "' + name + '". Add/restore a named RuleManufacture in mod.getManufacture.');
      }
      return value;
    };
    mod.getManufactureList = () => [...fakeManufacture.keys()];

    try {
      const filename = "verify-research-manufacture-roundtrip.sav";
      const key = "openxcom.file:" + Options.getMasterUserFolder() + filename;
      localStorage.removeItem(key);

      const writeSave = new SavedGame();
      writeSave.setName(filename);
      writeSave.setMonthsPassed(0);
      writeSave.setFunds(20000);
      const writeBase = writeSave.getBases()[0];
      writeBase.setMod(mod);
      writeBase.setName("VERIFY BASE");
      writeBase.getResearch().length = 0;
      writeBase.getProductions().length = 0;

      const project = new ResearchProject(researchRule, 12);
      project.setAssigned(3);
      project.setSpent(4);
      writeBase.addResearch(project);

      const production = new Production(manufactureRule, 9);
      production.setAssignedEngineers(2);
      production.setTimeSpent(6);
      production.setInfiniteAmount(true);
      production.setSellItems(true);
      writeBase.addProduction(production);

      writeSave.save(filename);

      const savedRaw = localStorage.getItem(key);
      assert(!!savedRaw, "Saved round-trip fixture was not written to localStorage");
      const parsed = JSON.parse(savedRaw);
      const doc = Array.isArray(parsed) ? parsed[1] : parsed;
      const savedBase = (doc.bases || [])[0];
      assert(!!savedBase, "Saved game base node missing");
      assert(Array.isArray(savedBase.research), "Saved base research did not serialize as an array");
      assert(Array.isArray(savedBase.productions), "Saved base productions did not serialize as an array");
      assert(
        savedBase.research.length === 1,
        "Saved base research length was " + (savedBase.research.length || 0) + ", expected 1"
      );
      assert(
        savedBase.productions.length === 1,
        "Saved base productions length was " + (savedBase.productions.length || 0) + ", expected 1"
      );
      const savedResearch = savedBase.research[0];
      const savedProduction = savedBase.productions[0];
      assert(savedResearch?.project === researchName, "Saved research project id was not round-tripped correctly");
      assert(savedProduction?.item === manufactureName, "Saved production item id was not round-tripped correctly");

      const readSave = new SavedGame();
      readSave.load(filename, mod);
      const readBase = readSave.getBases()[0];
      assert(!!readBase, "Loaded save did not contain any base");
      const loadedResearch = readBase.getResearch()[0];
      const loadedProduction = readBase.getProductions()[0];
      assert(!!loadedResearch, "Loaded base was missing research project");
      assert(!!loadedProduction, "Loaded base was missing production entry");
      assert(loadedResearch.getRules().getName() === researchName, "Research rule name did not round-trip");
      assert(loadedResearch.getAssigned() === 3, "Research assigned scientists did not round-trip");
      assert(loadedResearch.getSpent() === 4, "Research spent amount did not round-trip");
      assert(loadedResearch.getCost() === 12, "Research cost did not round-trip");
      assert(loadedProduction.getRules().getName() === manufactureName, "Production rule name did not round-trip");
      assert(loadedProduction.getAssignedEngineers() === 2, "Production assigned engineers did not round-trip");
      assert(loadedProduction.getTimeSpent() === 6, "Production timeSpent did not round-trip");
      assert(loadedProduction.getAmountTotal() === 9, "Production amountTotal did not round-trip");
      assert(loadedProduction.getInfiniteAmount() === true, "Production infinite flag did not round-trip");
      assert(loadedProduction.getSellItems() === true, "Production sell flag did not round-trip");

      return {
        serialized: {
          researchLen: savedBase.research.length,
          productionsLen: savedBase.productions.length,
          researchNode: savedResearch,
          productionNode: savedProduction
        },
        loaded: {
          research: {
            name: loadedResearch.getRules().getName(),
            assigned: loadedResearch.getAssigned(),
            spent: loadedResearch.getSpent(),
            cost: loadedResearch.getCost()
          },
          production: {
            name: loadedProduction.getRules().getName(),
            assignedEngineers: loadedProduction.getAssignedEngineers(),
            timeSpent: loadedProduction.getTimeSpent(),
            amount: loadedProduction.getAmountTotal(),
            infinite: loadedProduction.getInfiniteAmount(),
            sell: loadedProduction.getSellItems()
          }
        }
      };
    } finally {
      mod.getResearch = original.getResearch;
      mod.getResearchList = original.getResearchList;
      mod.getManufacture = original.getManufacture;
      mod.getManufactureList = original.getManufactureList;
      const key = "openxcom.file:" + Options.getMasterUserFolder() + "verify-research-manufacture-roundtrip.sav";
      localStorage.removeItem(key);
      localStorage.removeItem(key + "-new");
    }
  });

  await page.evaluate(value => console.log("VERIFY_RESEARCH_MANUFACTURE_PERSISTENCE ok " + JSON.stringify(value)), result);
}`;

function line(message) {
  console.log(message);
}

function quoteForCmd(arg) {
  const value = String(arg);
  if (!/[ \t\r\n"&|^<>\(\)]/.test(value)) {
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
  line("- browser VERIFY_RESEARCH_MANUFACTURE_PERSISTENCE");
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

    if (!runConsoleResult.stdout.includes("VERIFY_RESEARCH_MANUFACTURE_PERSISTENCE ok") || runConsoleResult.stdout.includes("[ERROR]")) {
      throw new Error(`Browser verifier marker missing or error present:\nrun-code:\n${runCodeResult.stdout}\nconsole:\n${runConsoleResult.stdout}`);
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
  line("VERIFY_RESEARCH_MANUFACTURE_PERSISTENCE");
  await run("build", process.execPath, [join(webRoot, "scripts", "build.mjs")]);
  await run("typecheck", npm, ["run", "typecheck"], webRoot);
  await runBrowserVerifier();
  line("VERIFY_RESEARCH_MANUFACTURE_PERSISTENCE ok");
}

await main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
