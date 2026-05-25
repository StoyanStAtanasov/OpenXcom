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
    return run("cmd.exe", ["/d", "/s", "/c", "npm.cmd", ...args]);
  }
  return run("npm", args);
}

class LocalStorageMock {
  #data = new Map();

  get length() {
    return this.#data.size;
  }

  key(index) {
    return [...this.#data.keys()][index] ?? null;
  }

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

function storageKey(path) {
  return `openxcom.file:${path.replaceAll("\\", "/")}`;
}

function text(value) {
  return {
    arg(arg) {
      return text(value.includes("{0}") ? value.replaceAll("{0}", String(arg)) : `${value} ${arg}`);
    },
    toString() {
      return value;
    }
  };
}

const language = {
  getString(id) {
    const strings = new Map([
      ["STR_QUICK_SAVE_SLOT", "Quick Save"],
      ["STR_AUTO_SAVE_GEOSCAPE_SLOT", "Auto Geoscape"],
      ["STR_AUTO_SAVE_BATTLESCAPE_SLOT", "Auto Battlescape"],
      ["STR_GEOSCAPE", "Geoscape"],
      ["STR_BATTLESCAPE", "Battlescape"],
      ["STR_TURN", "Turn {0}"],
      ["STR_IRONMAN", "Ironman"],
      ["STR_DATE_FIRST", "{0}st"],
      ["STR_DATE_SECOND", "{0}nd"],
      ["STR_DATE_THIRD", "{0}rd"],
      ["STR_DATE_FOURTH", "{0}th"],
      ["STR_JAN", "Jan"]
    ]);
    return text(strings.get(id) || id);
  }
};

runNpm(["run", "build"]);

globalThis.localStorage = new LocalStorageMock();

const dist = (...parts) => pathToFileURL(join(webRoot, "dist", ...parts)).href;
const [{ SavedGame }, { Options }, crossPlatform] = await Promise.all([
  import(dist("Savegame", "SavedGame.js")),
  import(dist("Engine", "Options.js")),
  import(dist("Engine", "CrossPlatform.js"))
]);

const master = Options.getMasterUserFolder();
Options.mods = [["xcom1", true], ["verified-addon", true]];

const save = new SavedGame();
save.setName("Alpha Save");
save.setFunds(123456);
save.setIronman(true);
save.save("alpha.sav");

const alphaRaw = localStorage.getItem(storageKey(`${master}alpha.sav`));
assert(alphaRaw, "SavedGame.save did not write alpha.sav through CrossPlatform storage");
const alphaParsed = JSON.parse(alphaRaw);
assert(Array.isArray(alphaParsed) && alphaParsed.length === 2, "SavedGame.save did not write brief + full document array");
assert(alphaParsed[0].name === "Alpha Save", "SavedGame.save brief name mismatch");
assert(typeof alphaParsed[0].savedAt === "number", "SavedGame.save brief savedAt missing");
assert(alphaParsed[0].mods.some(mod => mod.startsWith("xcom1 ver:")), "SavedGame.save brief active mod list missing xcom1");

const loaded = new SavedGame();
loaded.load("alpha.sav", null);
assert(loaded.getName() === "Alpha Save", "SavedGame.load did not restore name from brief");
assert(loaded.getFunds() === 123456, "SavedGame.load did not restore funds from full node");
assert(loaded.isIronman(), "SavedGame.load did not restore ironman from brief");

const quick = new SavedGame();
quick.setName("Quick Internal Name");
quick.save(SavedGame.QUICKSAVE);

const battle = new SavedGame();
battle.setName("Battle Save");
battle.setSavedBattle({
  getMissionType: () => "STR_UFO_CRASH_RECOVERY",
  getTurn: () => 7,
  save: () => ({ width: 1, length: 1, height: 1, selectedUnit: -1, mapdatasets: [], units: [], items: [] })
});
battle.save("battle.sav");

localStorage.setItem(storageKey(`${master}wrong-master.sav`), JSON.stringify([{
  name: "Wrong Master",
  time: { weekday: 6, day: 1, month: 1, year: 1999, hour: 12, minute: 0, second: 0 },
  mods: ["tftd ver: 1.0"],
  savedAt: 10
}, { funds: [1] }]));

localStorage.setItem(storageKey(`${master}old-style.sav`), JSON.stringify([{
  name: "Old Style",
  time: { weekday: 6, day: 2, month: 1, year: 1999, hour: 13, minute: 5, second: 0 },
  savedAt: 20
}, { funds: [2] }]));

const regularList = SavedGame.getList(language, false);
assert(regularList.some(entry => entry.fileName === "alpha.sav" && entry.displayName === "Alpha Save"), "SavedGame.getList missing regular save");
assert(regularList.some(entry => entry.fileName === "old-style.sav"), "SavedGame.getList should keep old xcom1 saves with no mods");
assert(!regularList.some(entry => entry.fileName === "wrong-master.sav"), "SavedGame.getList did not filter inactive master save");
assert(regularList.some(entry => entry.fileName === "battle.sav" && entry.details.includes("Battlescape") && entry.details.includes("Turn 7")), "SavedGame.getSaveInfo did not report battlescape mission/turn details");
assert(regularList.some(entry => entry.fileName === "alpha.sav" && entry.details.includes("Ironman")), "SavedGame.getSaveInfo did not append ironman details");

const autoList = SavedGame.getList(language, true);
assert(autoList.some(entry => entry.fileName === SavedGame.QUICKSAVE && entry.displayName === "Quick Save" && entry.reserved), "SavedGame.getList missing reserved quicksave info");

localStorage.setItem(storageKey(`${master}move-old.sav`), "move payload");
assert(crossPlatform.fileExists(`${master}move-old.sav`), "CrossPlatform.fileExists did not see seeded save");
assert(crossPlatform.moveFile(`${master}move-old.sav`, `${master}move-new.sav`), "CrossPlatform.moveFile returned false for existing save");
assert(!crossPlatform.fileExists(`${master}move-old.sav`), "CrossPlatform.moveFile did not remove old path");
assert(localStorage.getItem(storageKey(`${master}move-new.sav`)) === "move payload", "CrossPlatform.moveFile did not write new path");
assert(crossPlatform.deleteFile(`${master}move-new.sav`), "CrossPlatform.deleteFile returned false");
assert(!crossPlatform.fileExists(`${master}move-new.sav`), "CrossPlatform.deleteFile did not remove save");

console.log("VERIFY_SAVE_MENU ok", JSON.stringify({
  regular: regularList.map(entry => entry.fileName),
  auto: autoList.map(entry => entry.fileName)
}));
