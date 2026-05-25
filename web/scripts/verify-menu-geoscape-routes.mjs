import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const webRoot = normalize(join(dirname(fileURLToPath(import.meta.url)), ".."));
const repoRoot = normalize(join(webRoot, ".."));

function readRepo(path) {
  return readFileSync(join(repoRoot, path), "utf8");
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function walk(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      walk(path, files);
    } else {
      files.push(path);
    }
  }
  return files;
}

const sourceChecks = [
  {
    cpp: "src/Menu/NewBattleState.cpp",
    ts: "web/src/Menu/NewBattleState.ts",
    cppNeedle: "new CraftInfoState(_game->getSavedGame()->getBases()->front(), 0)",
    tsNeedle: "new CraftInfoState(base, 0)"
  },
  {
    cpp: "src/Geoscape/InterceptState.cpp",
    ts: "web/src/Geoscape/InterceptState.ts",
    cppNeedle: "new ConfirmDestinationState(c, _target)",
    tsNeedle: "new ConfirmDestinationState(craft, this._target)"
  },
  {
    cpp: "src/Geoscape/MissionDetectedState.cpp",
    ts: "web/src/Geoscape/MissionDetectedState.ts",
    cppNeedle: "new InterceptState(_state->getGlobe(), 0, _mission)",
    tsNeedle: "new InterceptState(this._state.getGlobe(), null, this._mission)"
  },
  {
    cpp: "src/Geoscape/UfoDetectedState.cpp",
    ts: "web/src/Geoscape/UfoDetectedState.ts",
    cppNeedle: "new InterceptState(_state->getGlobe(), 0, _ufo)",
    tsNeedle: "new InterceptState(this._state.getGlobe(), null, this._ufo)"
  },
  {
    cpp: "src/Geoscape/SelectDestinationState.cpp",
    ts: "web/src/Geoscape/SelectDestinationState.ts",
    cppNeedle: "new ConfirmCydoniaState(_craft)",
    tsNeedle: "new ConfirmCydoniaState(this._craft)"
  }
];

for (const check of sourceChecks) {
  assert(readRepo(check.cpp).includes(check.cppNeedle), `${check.cpp} no longer contains expected source route ${check.cppNeedle}`);
  assert(readRepo(check.ts).includes(check.tsNeedle), `${check.ts} missing translated route ${check.tsNeedle}`);
}

const scopedFiles = [
  ...walk(join(webRoot, "src", "Menu")),
  ...walk(join(webRoot, "src", "Geoscape"))
].filter(path => path.endsWith(".ts"));

const markerHits = [];
for (const path of scopedFiles) {
  const text = readFileSync(path, "utf8");
  if (text.includes("not translated yet")) {
    markerHits.push(normalize(path).slice(repoRoot.length + 1));
  }
}
assert(markerHits.length === 0, `Menu/Geoscape still has not-translated markers: ${markerHits.join(", ")}`);

const targetInfo = readRepo("web/src/Geoscape/TargetInfoState.ts");
const target = readRepo("web/src/Savegame/Target.ts");
assert(targetInfo.includes('import type { TargetLike } from "../Savegame/Target.ts";'), "TargetInfoState should use the shared source TargetLike contract");
assert(target.includes("setName?(name: string): void;"), "TargetLike missing source setName contract used by TargetInfoState");

console.log("VERIFY_MENU_GEOSCAPE_ROUTES ok", JSON.stringify({
  sourceRoutes: sourceChecks.length,
  scannedFiles: scopedFiles.length
}));
