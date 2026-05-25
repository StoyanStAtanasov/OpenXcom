import { spawn } from "node:child_process";
import { dirname, join, normalize } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const webRoot = normalize(join(dirname(fileURLToPath(import.meta.url)), ".."));

function run(label, command, args, cwd = webRoot) {
  console.log("- " + label);
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

function runNpm(label, args) {
  if (process.platform === "win32") {
    return run(label, "cmd.exe", ["/d", "/s", "/c", "npm.cmd", ...args]);
  }
  return run(label, "npm", args);
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function makeRule(RuleCommendations, node) {
  const rule = new RuleCommendations();
  rule.load(node);
  return rule;
}

function makeMod(rules, itemRules = new Map()) {
  return {
    getCommendationsList: () => rules,
    getCommendation: type => rules.get(type) || null,
    getItem: type => itemRules.get(type) || {
      getBattleType: () => 1,
      getDamageType: () => 1
    },
    getUfosList: () => [],
    getDeploymentsList: () => [],
    getCountriesList: () => []
  };
}

function commendationSummary(diary) {
  return diary.getSoldierCommendations().map(commendation => ({
    type: commendation.getType(),
    noun: commendation.getNoun(),
    decoration: commendation.getDecorationLevelInt(),
    isNew: commendation.isNew()
  }));
}

async function main() {
  await runNpm("build", ["run", "build"]);
  await runNpm("typecheck", ["run", "typecheck"]);

  const [
    { Mod },
    { RuleCommendations, parseCommendationsRul },
    { SoldierDiary, BattleUnitKills }
  ] = await Promise.all([
    import(pathToFileURL(join(webRoot, "dist", "Mod", "Mod.js")).href),
    import(pathToFileURL(join(webRoot, "dist", "Mod", "RuleCommendations.js")).href),
    import(pathToFileURL(join(webRoot, "dist", "Savegame", "SoldierDiary.js")).href)
  ]);

  const parsed = parseCommendationsRul(`
metadata:
  id: test
commendations:
  - type: STR_MEDAL_ORIGINAL8_NAME
    description: STR_MEDAL_ORIGINAL8_DESCRIPTION
    sprite: 4
    criteria:
      totalKills: [1, 2, 2, 5]
      totalKillsByRace:
        - 2
        - 4
    killCriteria:
      -
        - [2, [STR_SECTOID, STATUS_DEAD]]
        - [1, [BT_FIREARM, DT_PLASMA]]
      -
        - [1, [FACTION_HOSTILE]]
items:
  - type: STR_IGNORED
`);
  assert(parsed.length === 1, "top-level commendations block should parse one rule");
  assert(parsed[0].type === "STR_MEDAL_ORIGINAL8_NAME", "commendation type should parse");
  assert(parsed[0].sprite === 4, "commendation sprite should parse");
  assert(parsed[0].criteria?.totalKills?.join(",") === "1,2,2,5", "inline criteria thresholds should parse");
  assert(parsed[0].criteria?.totalKillsByRace?.join(",") === "2,4", "block criteria thresholds should parse");
  assert(parsed[0].killCriteria?.length === 2, "killCriteria OR blocks should parse");
  assert(parsed[0].killCriteria?.[0]?.[0]?.[0] === 2, "killCriteria pair count should parse");
  assert(parsed[0].killCriteria?.[0]?.[0]?.[1]?.[1] === "STATUS_DEAD", "killCriteria details should parse");

  const parsedRule = makeRule(RuleCommendations, parsed[0]);
  assert([...parsedRule.getCriteria().keys()].join(",") === "totalKills,totalKillsByRace", "criteria map should follow std::map key order");

  const mod = new Mod();
  const aRule = makeRule(RuleCommendations, { criteria: { totalKills: [1] } });
  const bRule = makeRule(RuleCommendations, { criteria: { totalKills: [1] } });
  mod.commendations.set("STR_B_MEDAL", bRule);
  mod.commendations.set("STR_A_MEDAL", aRule);
  assert(mod.getCommendation("STR_A_MEDAL") === aRule, "Mod::getCommendation should return stored rule");
  assert([...mod.getCommendationsList().keys()].join(",") === "STR_A_MEDAL,STR_B_MEDAL", "Mod::getCommendationsList should follow std::map order");

  const killRule = makeRule(RuleCommendations, { criteria: { totalKills: [1, 2] } });
  const diary = new SoldierDiary();
  diary.load({
    missionIdList: [7],
    killList: [
      { race: "STR_SECTOID", rank: "STR_SOLDIER", weapon: "STR_RIFLE", weaponAmmo: "STR_RIFLE_CLIP", status: 6, faction: 1, mission: 7, turn: 4 }
    ]
  }, makeMod(new Map([["STR_KILL_MEDAL", killRule]])));
  assert(diary.manageCommendations(makeMod(new Map([["STR_KILL_MEDAL", killRule]])), [{ id: 7, success: true, score: 100, region: "STR_REGION", country: "STR_COUNTRY", type: "STR_UFO_CRASH_RECOVERY", ufo: "STR_SMALL_SCOUT", daylight: true, valiantCrux: false, lootValue: 0, isBaseDefense: () => false, isUfoMission: () => true, isAlienBase: () => false, isDarkness: () => false }]), "first no-noun kill medal should award");
  assert(!diary.manageCommendations(makeMod(new Map([["STR_KILL_MEDAL", killRule]])), []), "second no-noun level should not award before threshold");
  diary.getKills().push(new BattleUnitKills({ race: "STR_SECTOID", rank: "STR_SOLDIER", weapon: "STR_RIFLE", weaponAmmo: "STR_RIFLE_CLIP", status: 6, faction: 1, mission: 7, turn: 7 }));
  assert(diary.manageCommendations(makeMod(new Map([["STR_KILL_MEDAL", killRule]])), []), "second no-noun kill medal should award after next threshold");

  const modularRule = makeRule(RuleCommendations, { criteria: { totalKillsByRace: [2] } });
  const modularDiary = new SoldierDiary();
  modularDiary.load({
    killList: [
      { race: "STR_SECTOID", rank: "STR_SOLDIER", weapon: "STR_RIFLE", weaponAmmo: "STR_RIFLE_CLIP", status: 6, faction: 1, mission: 1, turn: 1 },
      { race: "STR_SECTOID", rank: "STR_LEADER", weapon: "STR_RIFLE", weaponAmmo: "STR_RIFLE_CLIP", status: 6, faction: 1, mission: 1, turn: 2 }
    ]
  }, makeMod(new Map([["STR_RACE_MEDAL", modularRule]])));
  assert(modularDiary.manageCommendations(makeMod(new Map([["STR_RACE_MEDAL", modularRule]])), []), "modular race medal should award");
  assert(commendationSummary(modularDiary)[0].noun === "STR_SECTOID", "modular race medal should use the race noun");

  const criteriaRule = makeRule(RuleCommendations, {
    criteria: { killsWithCriteriaCareer: [1] },
    killCriteria: [[[2, ["STR_SECTOID", "STATUS_DEAD"]]]]
  });
  const criteriaDiary = new SoldierDiary();
  criteriaDiary.load({
    killList: [
      { race: "STR_SECTOID", rank: "STR_SOLDIER", weapon: "STR_RIFLE", weaponAmmo: "STR_RIFLE_CLIP", status: 6, faction: 1, mission: 1, turn: 1 },
      { race: "STR_SECTOID", rank: "STR_LEADER", weapon: "STR_RIFLE", weaponAmmo: "STR_RIFLE_CLIP", status: 6, faction: 1, mission: 2, turn: 2 }
    ]
  }, makeMod(new Map([["STR_CRITERIA_MEDAL", criteriaRule]])));
  assert(criteriaDiary.manageCommendations(makeMod(new Map([["STR_CRITERIA_MEDAL", criteriaRule]])), []), "career killCriteria medal should award");

  console.log("VERIFY_SOLDIER_DIARY_COMMENDATIONS ok " + JSON.stringify({
    parsed: parsed[0].type,
    noNoun: commendationSummary(diary),
    modular: commendationSummary(modularDiary),
    killCriteria: commendationSummary(criteriaDiary)
  }));
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
