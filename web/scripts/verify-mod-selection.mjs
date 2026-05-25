import { spawnSync } from "node:child_process";
import { dirname, join, normalize } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const webRoot = normalize(join(dirname(fileURLToPath(import.meta.url)), ".."));

function run(command, args, cwd = webRoot) {
  const result = spawnSync(command, args, { cwd, encoding: "utf8", stdio: "pipe" });
  if (result.status !== 0) {
    process.stdout.write(result.stdout || "");
    process.stderr.write(result.stderr || "");
    if (result.error) {
      throw result.error;
    }
    throw new Error(`${command} ${args.join(" ")} failed with status ${result.status}`);
  }
  return result.stdout;
}

function runNpm(args) {
  if (process.platform === "win32") {
    return run("cmd.exe", ["/d", "/s", "/c", ["npm.cmd", ...args.map(quoteForCmd)].join(" ")]);
  }
  return run("npm", args);
}

function quoteForCmd(arg) {
  const value = String(arg);
  if (!/[ \t\r\n"&|^<>()]/.test(value)) {
    return value;
  }
  return `"${value.replace(/"/g, '\\"')}"`;
}

class LocalStorageMock {
  #data = new Map();

  getItem(key) {
    return this.#data.has(key) ? this.#data.get(key) : null;
  }

  setItem(key, value) {
    this.#data.set(key, String(value));
  }

  removeItem(key) {
    this.#data.delete(key);
  }

  clear() {
    this.#data.clear();
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function activeIds(Options) {
  return Options.mods.filter(([, enabled]) => enabled).map(([id]) => id);
}

runNpm(["run", "build"]);
runNpm(["run", "typecheck"]);

globalThis.localStorage = new LocalStorageMock();
const [{ Options }, { ModInfo }, { FileMap }] = await Promise.all([
  import(pathToFileURL(join(webRoot, "dist", "Engine", "Options.js")).href),
  import(pathToFileURL(join(webRoot, "dist", "Engine", "ModInfo.js")).href),
  import(pathToFileURL(join(webRoot, "dist", "Engine", "FileMap.js")).href)
]);

const manifestBoth = {
  xcom1RulesetFiles: ["bin/standard/xcom1/a.rul", "bin/standard/xcom1/b.rul"],
  xcom2RulesetFiles: ["bin/standard/xcom2/a.rul", "bin/standard/xcom2/b.rul"],
  ufoPalettesDat: "XCOM/GEODATA/PALETTES.DAT",
  ufoTerrainDir: "XCOM/TERRAIN",
  tftdPalettesDat: "TFD/GEODATA/PALETTES.DAT",
  tftdTerrainDir: "TFD/TERRAIN",
  commonSoldierNameFiles: ["bin/common/SoldierName/English.nam"]
};

const master = new ModInfo("xcom1", "X-COM", true, true, "1.0", "dev", "master", "", "", "bin/standard/xcom1");
const standalone = new ModInfo("standalone", "Standalone", false, true, "1.0", "dev", "standalone", "", "", "bin/standard/standalone");
const dependent = new ModInfo("dependent", "Dependent", false, true, "1.0", "dev", "dependent", "", "xcom1", "bin/standard/dependent");
assert(master.canActivate("xcom2"), "master mod should activate for any current master");
assert(standalone.canActivate("xcom2"), "standalone mod should activate for any current master");
assert(dependent.canActivate("xcom1"), "dependent mod should activate for matching current master");
assert(!dependent.canActivate("xcom2"), "dependent mod should not activate for a different current master");

Options.setResourceManifestForTests(manifestBoth);
Options.mods = [];
Options.updateMods();
assert(JSON.stringify(Options.mods) === JSON.stringify([["xcom1", true], ["xcom2", false]]), "both installs should default to xcom1 active and xcom2 inactive");
assert(Options.getActiveMaster() === "xcom1", "active master should default to xcom1 when UFO data exists");
assert(Options.getModInfo("xcom1").isMaster() && Options.getModInfo("xcom2").isMaster(), "xcom1/xcom2 should be registered as masters");
let rulesets = FileMap.getRulesets();
assert(rulesets.length === 1 && rulesets[0][0] === "xcom1", "default xcom1 active path should map only xcom1 rulesets");
assert(JSON.stringify(rulesets[0][1]) === JSON.stringify(manifestBoth.xcom1RulesetFiles), "xcom1 rulesets should stay grouped");
assert(activeIds(Options).length === 1, "exactly one master should be active");

Options.setResourceManifestForTests(manifestBoth);
Options.mods = [["xcom1", false], ["xcom2", true]];
Options.updateMods();
assert(Options.getActiveMaster() === "xcom2", "explicit xcom2 master should remain active");
rulesets = FileMap.getRulesets();
assert(rulesets.length === 1 && rulesets[0][0] === "xcom2", "explicit xcom2 active path should map only xcom2 rulesets");
assert(JSON.stringify(rulesets[0][1]) === JSON.stringify(manifestBoth.xcom2RulesetFiles), "xcom2 rulesets should stay grouped");

Options.setResourceManifestForTests(manifestBoth);
Options.mods = [["xcom1", true], ["xcom2", true]];
Options.updateMods();
assert(JSON.stringify(activeIds(Options)) === JSON.stringify(["xcom1"]), "refreshMods should turn off duplicate active masters after the first active master");

Options.setResourceManifestForTests({
  xcom2RulesetFiles: ["bin/standard/xcom2/only.rul"],
  tftdPalettesDat: "TFD/GEODATA/PALETTES.DAT",
  tftdTerrainDir: "TFD/TERRAIN"
});
Options.mods = [];
Options.updateMods();
assert(JSON.stringify(Options.mods) === JSON.stringify([["xcom2", true]]), "TFTD-only installs should default to xcom2 active");
assert(Options.getActiveMaster() === "xcom2", "TFTD-only active master should be xcom2");

FileMap.clear();
FileMap.mapFile("modA", "base", "Ruleset", "one.rul", false);
FileMap.mapFile("modA", "base", "Ruleset", "two.rul", false);
rulesets = FileMap.getRulesets();
assert(rulesets.length === 1 && rulesets[0][0] === "modA" && rulesets[0][1].length === 2, "mapFile should group consecutive rulesets for one mod");
FileMap.recordRulesets("high", ["h.rul"]);
FileMap.recordRulesets("low", ["l.rul"]);
rulesets = FileMap.getRulesets();
assert(JSON.stringify(rulesets.map(([id]) => id).slice(0, 2)) === JSON.stringify(["low", "high"]), "recordRulesets should leave the later/high-priority group last after reverse-order mapping");

console.log("VERIFY_MOD_SELECTION ok", JSON.stringify({
  bothDefault: [["xcom1", true], ["xcom2", false]],
  tftdOnly: [["xcom2", true]],
  groupedRulesets: rulesets.length
}));
