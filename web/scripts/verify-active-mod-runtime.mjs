import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, rm, writeFile } from "node:fs/promises";
import http from "node:http";
import { dirname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const webRoot = normalize(join(dirname(fileURLToPath(import.meta.url)), ".."));
const repoRoot = normalize(join(webRoot, ".."));
const outputRoot = join(repoRoot, "output", "playwright");
const verifierPath = join(outputRoot, "verify-active-mod-runtime.js");
const session = "openxcom-active-mod-runtime";
const url = "http://127.0.0.1:4173/web/index.html";

const verifier = String.raw`async page => {
  await page.goto("http://127.0.0.1:4173/web/index.html");
  await page.waitForFunction(() => document.readyState === "complete");
  await page.waitForFunction(() => window.openxcomGame?.getMod?.());

  const result = await page.evaluate(async () => {
    const [{ Options }, { FileMap }] = await Promise.all([
      import("/web/dist/Engine/Options.js"),
      import("/web/dist/Engine/FileMap.js")
    ]);
    const assert = (condition, message) => {
      if (!condition) throw new Error(message);
    };

    const manifestResponse = await fetch("/web/dist/resource-manifest.json");
    const manifest = await manifestResponse.json();
    assert((manifest.xcom2RulesetFiles || []).length > 0, "verifier requires generated xcom2 ruleset files");
    assert(manifest.tftdPalettesDat || manifest.tftdTerrainDir || manifest.tftdSoundDir, "verifier requires copied TFTD/TFD original data");

    const game = window.openxcomGame;
    Options.setResourceManifestForTests(null);
    Options.mods = [["xcom1", false], ["xcom2", true]];
    Options.updateMods();
    const rulesets = FileMap.getRulesets();
    assert(Options.getActiveMaster() === "xcom2", "Options should keep xcom2 as active master");
    assert(rulesets.length > 0 && rulesets[0][0] === "xcom2", "FileMap rulesets should start with active xcom2");

    await game.loadMods();
    await game.loadLanguages();
    const mod = game.getMod();
    assert(mod.getCraft("STR_TRITON") !== null, "xcom2 craft STR_TRITON should load");
    assert(mod.getCraft("STR_SKYRANGER") === null, "xcom1 craft STR_SKYRANGER should not load into xcom2-only runtime");
    assert(mod.getItem("STR_DART_PISTOL") !== null, "xcom2 item STR_DART_PISTOL should load");
    assert(mod.getItem("STR_RIFLE") === null, "xcom1 item STR_RIFLE should not load into xcom2-only runtime");
    assert(mod.getUfo("STR_SURVEY_SHIP") !== null, "xcom2 USO STR_SURVEY_SHIP should load");
    assert(String(game.getLanguage().getString("STR_TRITON")) === "TRITON", "active xcom2 language file should load STR_TRITON");

    const sand = await mod.loadMapDataSet("SAND");
    assert(sand.getSize() > 0, "default active xcom2 terrain loader should load SAND from TFTD TERRAIN data");
    const seabedBlock = await mod.loadMapBlock("SEABED00");
    assert(seabedBlock.byteLength > 0, "default active xcom2 map loader should load SEABED00 from TFTD MAPS data");

    const save = mod.newSave();
    const firstBase = save.getBases()[0];
    const craftTypes = firstBase.getCrafts().map(craft => craft.getRules().getType());
    assert(craftTypes.includes("STR_TRITON"), "xcom2 starting base should create a Triton craft");

    return {
      activeMaster: Options.getActiveMaster(),
      rulesetCount: rulesets[0][1].length,
      craftTypes,
      triton: String(game.getLanguage().getString("STR_TRITON")),
      sandSize: sand.getSize(),
      seabedBlockBytes: seabedBlock.byteLength
    };
  });

  await page.evaluate(value => {
    console.log("VERIFY_ACTIVE_MOD_RUNTIME ok " + JSON.stringify(value));
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
  line("VERIFY_ACTIVE_MOD_RUNTIME");
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
    if (!consoleResult.stdout.includes("VERIFY_ACTIVE_MOD_RUNTIME ok") || consoleResult.stdout.includes("[ERROR]")) {
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
  line("VERIFY_ACTIVE_MOD_RUNTIME ok");
}

await main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
