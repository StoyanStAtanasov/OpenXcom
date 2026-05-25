import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import http from "node:http";
import { dirname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
const webRoot = normalize(join(dirname(fileURLToPath(import.meta.url)), ".."));
const repoRoot = normalize(join(webRoot, ".."));
const outputRoot = join(repoRoot, "output", "playwright");
const verifierPath = join(outputRoot, "verify-geoscape-confirmations.js");
const session = "openxcom-geoscape-confirmations";
const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const url = "http://127.0.0.1:4173/web/index.html";

const baseDefenseVerifier = String.raw`async page => {
  await page.goto("http://127.0.0.1:4173/web/index.html");
  await page.waitForFunction(() => document.readyState === "complete");
  await page.waitForFunction(() => window.openxcomGame?.getMod()?.getInventory?.("STR_GROUND"));

  const result = await page.evaluate(async () => {
    const [
      { Base },
      { Country },
      { Region },
      { Waypoint },
      { AlienBase },
      { MissionSite },
      { AlienMission },
      { Ufo, UfoStatus },
      { Craft },
      { Soldier },
      { SoldierDeath },
      { Transfer },
      { BaseFacility },
      { GameTime },
      { MissionStatistics },
      { Vehicle },
      { SavedGame, GameEnding },
      { SaveConverter },
      { SavedBattleGame },
      { UnitFaction },
      { BriefingState },
      { AliensCrashState },
      { BattlescapeState },
      { NextTurnState },
      { InventoryState },
      { DebriefingState },
      { MonthlyReportState },
      { PsiTrainingState },
      { GeoscapeState },
      { ResearchCompleteState },
      { Mod },
      { Options },
      { getBrowserFile },
      { TextButton },
      { Window },
      { CommendationState },
      { SaveGameState, SaveType },
      { CutsceneState },
      { StatisticsState },
      { GoToMainMenuState },
      { LoadGameState },
      { OPT_GEOSCAPE },
      { Screen },
      { ResearchProject },
      { Production },
      { RuleResearch },
      { MissionObjective },
      { Ufopaedia }
    ] = await Promise.all([
      import("/web/dist/Savegame/Base.js"),
      import("/web/dist/Savegame/Country.js"),
      import("/web/dist/Savegame/Region.js"),
      import("/web/dist/Savegame/Waypoint.js"),
      import("/web/dist/Savegame/AlienBase.js"),
      import("/web/dist/Savegame/MissionSite.js"),
      import("/web/dist/Savegame/AlienMission.js"),
      import("/web/dist/Savegame/Ufo.js"),
      import("/web/dist/Savegame/Craft.js"),
      import("/web/dist/Savegame/Soldier.js"),
      import("/web/dist/Savegame/SoldierDeath.js"),
      import("/web/dist/Savegame/Transfer.js"),
      import("/web/dist/Savegame/BaseFacility.js"),
      import("/web/dist/Savegame/GameTime.js"),
      import("/web/dist/Savegame/MissionStatistics.js"),
      import("/web/dist/Savegame/Vehicle.js"),
      import("/web/dist/Savegame/SavedGame.js"),
      import("/web/dist/Savegame/SaveConverter.js"),
      import("/web/dist/Savegame/SavedBattleGame.js"),
      import("/web/dist/Savegame/BattleUnit.js"),
      import("/web/dist/Battlescape/BriefingState.js"),
      import("/web/dist/Battlescape/AliensCrashState.js"),
      import("/web/dist/Battlescape/BattlescapeState.js"),
      import("/web/dist/Battlescape/NextTurnState.js"),
      import("/web/dist/Battlescape/InventoryState.js"),
      import("/web/dist/Battlescape/DebriefingState.js"),
      import("/web/dist/Geoscape/MonthlyReportState.js"),
      import("/web/dist/Geoscape/PsiTrainingState.js"),
      import("/web/dist/Geoscape/GeoscapeState.js"),
      import("/web/dist/Geoscape/ResearchCompleteState.js"),
      import("/web/dist/Mod/Mod.js"),
      import("/web/dist/Engine/Options.js"),
      import("/web/dist/Engine/CrossPlatform.js"),
      import("/web/dist/Interface/TextButton.js"),
      import("/web/dist/Interface/Window.js"),
      import("/web/dist/Battlescape/CommendationState.js"),
      import("/web/dist/Menu/SaveGameState.js"),
      import("/web/dist/Menu/CutsceneState.js"),
      import("/web/dist/Menu/StatisticsState.js"),
      import("/web/dist/Menu/MainMenuState.js"),
      import("/web/dist/Menu/LoadGameState.js"),
      import("/web/dist/Menu/OptionsBaseState.js"),
      import("/web/dist/Engine/Screen.js"),
      import("/web/dist/Savegame/ResearchProject.js"),
      import("/web/dist/Savegame/Production.js"),
      import("/web/dist/Mod/RuleResearch.js"),
      import("/web/dist/Mod/RuleAlienMission.js"),
      import("/web/dist/Ufopaedia/Ufopaedia.js")
    ]);
    const assert = (condition, message) => {
      if (!condition) throw new Error(message);
    };
    const assertArrayEquals = (actual, expected, message) => {
      assert(Array.isArray(actual), message + ": actual is not an array");
      assert(actual.length === expected.length, message + ": length " + actual.length + " !== " + expected.length);
      for (let i = 0; i < expected.length; ++i) {
        assert(actual[i] === expected[i], message + ": index " + i + " " + actual[i] + " !== " + expected[i]);
      }
    };
    const replaceArray = (target, values) => {
      target.splice(0, target.length, ...values);
    };
    const makeRule = (type, options = {}) => ({
      getType: () => type,
      isFixed: () => options.fixed || false,
      getCompatibleAmmo: () => options.compatibleAmmo || [],
      getClipSize: () => options.clipSize ?? 0
    });
    const noAmmoRule = makeRule("HWP_NO_AMMO", { fixed: true, clipSize: 12 });
    const ammoedRule = makeRule("HWP_AMMOED", { fixed: true, clipSize: 6, compatibleAmmo: ["AMMO_PACK"] });
    const ammoRule = makeRule("AMMO_PACK", { clipSize: 2 });
    const craftRule = makeRule("CRAFT_HWP", { clipSize: 7 });
    const outRule = makeRule("OUT_HWP", { clipSize: 3 });
    const ordinaryRule = makeRule("ORDINARY");
    const rules = new Map([
      ["HWP_NO_AMMO", noAmmoRule],
      ["HWP_AMMOED", ammoedRule],
      ["AMMO_PACK", ammoRule],
      ["CRAFT_HWP", craftRule],
      ["OUT_HWP", outRule],
      ["ORDINARY", ordinaryRule]
    ]);
    const mod = {
      getItem: type => rules.get(type) || null,
      getUnit: type => type === "HWP_AMMOED" ? { getArmor: () => "HWP_ARMOR" } : null,
      getArmor: type => type === "HWP_ARMOR" ? { getSize: () => 2 } : null
    };
    const base = new Base(mod);
    base.getFacilities().push(
      { getBuildTime: () => 0, getRules: () => ({ getDefenseValue: () => 50 }) },
      { getBuildTime: () => 3, getRules: () => ({ getDefenseValue: () => 80 }) },
      { getBuildTime: () => 0, getRules: () => ({ getDefenseValue: () => 0 }) }
    );
    const craftVehicle = new Vehicle(craftRule, 7, 4);
    const outVehicle = new Vehicle(outRule, 3, 4);
    base.getCrafts().push(
      { getStatus: () => "STR_READY", getVehicles: () => [craftVehicle] },
      { getStatus: () => "STR_OUT", getVehicles: () => [outVehicle] }
    );
    base.getStorageItems().load({ HWP_NO_AMMO: 2, HWP_AMMOED: 3, AMMO_PACK: 4, ORDINARY: 5 });
    base.setupDefenses();

    const vehicles = base.getVehicles();
    const count = type => vehicles.filter(vehicle => vehicle.getRules().getType() === type).length;
    const ammoedVehicle = vehicles.find(vehicle => vehicle.getRules().getType() === "HWP_AMMOED");
    assert(base.getDefenses().length === 1, "completed defense facility filter failed");
    assert(vehicles.includes(craftVehicle), "ready craft vehicle missing");
    assert(!vehicles.includes(outVehicle), "STR_OUT craft vehicle should be ignored");
    assert(vehicles.length === 4, "expected ready craft vehicle plus three base HWPs");
    assert(count("HWP_NO_AMMO") === 2, "no-ammo fixed item conversion failed");
    assert(count("HWP_AMMOED") === 1, "ammo-limited fixed item conversion failed");
    assert(ammoedVehicle?.getAmmo() === 6, "ammoed HWP clip size mismatch");
    assert(ammoedVehicle?.getSize() === 2, "ammoed HWP armor size mismatch");
    assert(base.getStorageItems().getItem("HWP_NO_AMMO") === 0, "no-ammo HWP item not consumed");
    assert(base.getStorageItems().getItem("HWP_AMMOED") === 2, "ammoed HWP item consumption mismatch");
    assert(base.getStorageItems().getItem("AMMO_PACK") === 1, "ammo pack consumption mismatch");
    assert(base.getStorageItems().getItem("ORDINARY") === 5, "ordinary item should be untouched");

    base.cleanupDefenses(true);
    assert(base.getDefenses().length === 0, "defenses not cleared");
    assert(base.getVehicles().length === 0, "temporary defense vehicles not cleared");
    assert(base.getStorageItems().getItem("CRAFT_HWP") === 0, "craft-owned vehicle should not be reclaimed");
    assert(base.getStorageItems().getItem("HWP_NO_AMMO") === 2, "no-ammo HWP reclaim mismatch");
    assert(base.getStorageItems().getItem("HWP_AMMOED") === 3, "ammoed HWP reclaim mismatch");
    assert(base.getStorageItems().getItem("AMMO_PACK") === 4, "ammo reclaim mismatch");
    assert(base.getStorageItems().getItem("ORDINARY") === 5, "ordinary item changed during cleanup");

    const game = window.openxcomGame;
    assert(game, "openxcomGame missing");
    const realMod = game.getMod();
    assert(realMod, "game Mod missing");
    assert(realMod.musics?.has("GMGEO1"), "GMGEO1 music not loaded from original SOUND directory");
    assert(realMod.musics?.has("GMINTER"), "GMINTER music not loaded from original SOUND directory");
    const ufoFireSound = realMod.getSound("GEO.CAT", Mod.UFO_FIRE, false);
    assert(ufoFireSound, "GEO.CAT UFO_FIRE sound missing");
    const fireCount = ufoFireSound.getPlayCount();
    ufoFireSound.play();
    assert(ufoFireSound.getPlayCount() === fireCount + 1, "Sound.play did not record playback");
    assert(TextButton.soundPress === realMod.getSound("GEO.CAT", Mod.BUTTON_PRESS, false), "TextButton soundPress not assigned from Mod constants");
    assert(Window.soundPopup[0] === realMod.getSound("GEO.CAT", Mod.WINDOW_POPUP[0], false), "Window popup sound 0 not assigned from Mod constants");

    const originalSave = game.getSavedGame();
    const states = game._states;
    const originalStates = states.slice();

    try {
      const musicLogStart = realMod.musicRequestLog?.length || 0;
      const musicSave = new SavedGame();
      game.setSavedGame(musicSave);
      realMod.playingMusic = "";
      musicSave.setMonthsPassed(-1);
      new GeoscapeState().init();
      realMod.playingMusic = "";
      musicSave.setMonthsPassed(0);
      new GeoscapeState().init();
      realMod.playingMusic = "";
      const interState = new GeoscapeState();
      interState._dogfightsToBeStarted.push({});
      interState.init();
      const musicLog = realMod.musicRequestLog.slice(musicLogStart);
      assert(musicLog.some(entry => entry.name === "GMGEO" && entry.id === 1 && entry.track === "GMGEO1" && entry.found), "GeoscapeState init did not request GMGEO id 1 for first month");
      assert(musicLog.some(entry => entry.name === "GMGEO" && entry.id === 0 && entry.found), "GeoscapeState init did not request random GMGEO after first month");
      assert(musicLog.some(entry => entry.name === "GMINTER" && entry.id === 0 && entry.found), "GeoscapeState init did not request GMINTER for pending dogfight");

      const save = new SavedGame();
      const battle = new SavedBattleGame();
      battle.setMissionType("STR_TEST_MISSION");
      save.setSavedBattle(battle);
      game.setSavedGame(save);
      const hostile = {
        isOut: () => false,
        getOriginalFaction: () => UnitFaction.FACTION_HOSTILE,
        getFaction: () => UnitFaction.FACTION_HOSTILE,
        getCapturable: () => false,
        getArmor: () => ({ getSize: () => 1 }),
        getTile: () => null,
        setTile: () => {},
        getPosition: () => ({ add: () => ({ x: 0, y: 0, z: 0 }) }),
        setVisible: () => {},
        prepareNewTurn: () => {}
      };
      const player = {
        isOut: () => false,
        getOriginalFaction: () => UnitFaction.FACTION_PLAYER,
        getFaction: () => UnitFaction.FACTION_PLAYER,
        getArmor: () => ({ getSize: () => 1 }),
        getTile: () => null,
        setTile: () => {},
        getPosition: () => ({ add: () => ({ x: 0, y: 0, z: 0 }) }),
        setVisible: () => {},
        prepareNewTurn: () => {}
      };
      battle.getUnits().push(hostile, player);

      const originalGetDeployment = realMod.getDeployment.bind(realMod);
      try {
        realMod.getDeployment = id => id === "STR_TEST_MISSION"
          ? {
            getBriefingData: () => ({
              palette: 0,
              background: "BACK16.SCR",
              textOffset: 0,
              showTarget: true,
              showCraft: true,
              cutscene: "TEST_BRIEFING_CUTSCENE",
              music: "GMDEFEND",
              title: "STR_TEST_MISSION",
              desc: "STR_TEST_MISSION_BRIEFING"
            })
          }
          : originalGetDeployment(id);
        const cutsceneBriefing = new BriefingState();
        states.splice(0, states.length, cutsceneBriefing);
        cutsceneBriefing.init();
        assert(states[states.length - 1] instanceof CutsceneState, "BriefingState init should push CutsceneState for deployment briefing cutscenes");
        assert(states[states.length - 1]._cutsceneId === "TEST_BRIEFING_CUTSCENE", "BriefingState pushed CutsceneState with wrong cutscene id");
        assert(cutsceneBriefing._cutsceneId === "", "BriefingState should clear the cutscene id after pushing it");
      } finally {
        realMod.getDeployment = originalGetDeployment;
      }
      states.splice(0, states.length, ...originalStates);
      game.setSavedGame(save);

      const briefing = new BriefingState();
      game.pushState(briefing);
      briefing.btnOkClick();
      const startTop = states.slice(-3);
      assert(startTop[0] instanceof BattlescapeState, "BriefingState should push BattlescapeState first");
      assert(startTop[1] instanceof NextTurnState, "BriefingState should push NextTurnState after battlescape");
      assert(startTop[2] instanceof InventoryState, "BriefingState should push InventoryState on top");
      assert(battle.getBattleState() === startTop[0], "SavedBattleGame battle state link missing");
      startTop[2].btnOkClick();
      assert(states[states.length - 1] instanceof NextTurnState, "InventoryState OK should return to NextTurnState");

      states.splice(0, states.length, ...originalStates);
      const crashSave = new SavedGame();
      const crashBattle = new SavedBattleGame();
      crashBattle.setMissionType("STR_TEST_MISSION");
      crashSave.setSavedBattle(crashBattle);
      game.setSavedGame(crashSave);
      const crashBriefing = new BriefingState();
      game.pushState(crashBriefing);
      crashBriefing.btnOkClick();
      assert(states[states.length - 1] instanceof AliensCrashState, "BriefingState should open AliensCrashState when no aliens are alive");
      states[states.length - 1].btnOkClick();
      assert(states[states.length - 1] instanceof DebriefingState, "AliensCrashState OK should open DebriefingState");

      states.splice(0, states.length, ...originalStates);
      const originalAlienMissionLookup = realMod.getAlienMission.bind(realMod);
      const originalRegionLookup = realMod.getRegion.bind(realMod);
      try {
        const supplyRule = {
          getType: () => "STR_TEST_SUPPLY",
          getObjective: () => MissionObjective.OBJECTIVE_SUPPLY,
          getWaveCount: () => 1,
          getWave: () => ({ spawnTimer: 30, ufoCount: 1, ufoType: "STR_SMALL_SCOUT", trajectory: "TEST_TRAJECTORY" })
        };
        const regionRule = {
          getType: () => "STR_TEST_REGION",
          getMissionRegion: () => "STR_TEST_REGION",
          insideRegion: () => true
        };
        const countryRule = {
          getType: () => "STR_TEST_COUNTRY",
          insideCountry: () => true
        };
        const deployment = {
          getType: () => "STR_TEST_ALIEN_BASE_DEPLOYMENT",
          getMarkerName: () => "STR_ALIEN_BASE",
          getMarkerIcon: () => 0,
          getPoints: () => 42,
          chooseGenMissionType: () => "STR_TEST_SUPPLY",
          getGenMissionFrequency: () => 100
        };
        const supplyBase = new AlienBase(deployment);
        supplyBase.setLongitude(0.25);
        supplyBase.setLatitude(0.25);
        supplyBase.setAlienRace("STR_SECTOID");
        const supplySave = new SavedGame();
        supplySave.getAlienBases().push(supplyBase);
        const regionActivity = [];
        const countryActivity = [];
        supplySave.getRegions().push({
          getRules: () => regionRule,
          addActivityAlien: value => regionActivity.push(value),
          getActivityAlien: () => regionActivity
        });
        supplySave.getCountries().push({
          getRules: () => countryRule,
          addActivityAlien: value => countryActivity.push(value),
          getActivityAlien: () => countryActivity,
          getFunding: () => [0]
        });
        realMod.getAlienMission = name => name === "STR_TEST_SUPPLY" ? supplyRule : originalAlienMissionLookup(name);
        realMod.getRegion = name => name === "STR_TEST_REGION" ? regionRule : originalRegionLookup(name);
        game.setSavedGame(supplySave);
        const supplyGeoscape = new GeoscapeState();
        supplyGeoscape.time1Day();
        assertArrayEquals(regionActivity, [42], "Alien base daily region activity score mismatch");
        assertArrayEquals(countryActivity, [42], "Alien base daily country activity score mismatch");
        assert(supplySave.getAlienMissions().length === 1, "Alien base supply mission was not spawned");
        const supplyMission = supplySave.getAlienMissions()[0];
        assert(supplyMission.getRules().getType() === "STR_TEST_SUPPLY", "Supply mission rule type mismatch");
        assert(supplyMission.getRegion() === "STR_TEST_REGION", "Supply mission region mismatch");
        assert(supplyMission.getRace() === "STR_SECTOID", "Supply mission race mismatch");
        assert(supplyMission.getAlienBase() === supplyBase, "Supply mission did not retain alien base pointer");
        assert(supplyMission.getId() === 1, "Supply mission id should come from SavedGame.getId(ALIEN_MISSIONS)");
      } finally {
        realMod.getAlienMission = originalAlienMissionLookup;
        realMod.getRegion = originalRegionLookup;
      }

      const originalMissionScriptList = realMod.getMissionScriptList.bind(realMod);
      const originalMissionScriptLookup = realMod.getMissionScript.bind(realMod);
      const originalRegionsList = realMod.getRegionsList.bind(realMod);
      const originalRegionForMonthly = realMod.getRegion.bind(realMod);
      const originalAlienMissionForMonthly = realMod.getAlienMission.bind(realMod);
      const originalAlienRaceLookup = realMod.getAlienRace.bind(realMod);
      try {
        const generated = [];
        const makeScript = (type, options = {}) => ({
          getType: () => type,
          getFirstMonth: () => options.firstMonth ?? 0,
          getLastMonth: () => options.lastMonth ?? -1,
          getMaxRuns: () => options.maxRuns ?? -1,
          getVarName: () => options.varName || type,
          getMinDifficulty: () => options.minDifficulty ?? 0,
          getResearchTriggers: () => new Map(Object.entries(options.researchTriggers || {})),
          getConditionals: () => options.conditionals || [],
          getLabel: () => options.label || 0,
          getExecutionOdds: () => options.executionOdds ?? 100,
          getTargetBaseOdds: () => options.targetBaseOdds ?? 0,
          getSiteType: () => options.siteType || false,
          getMissionTypes: () => options.missionTypes || [],
          hasMissionWeights: () => options.hasMissionWeights || false,
          getRegions: () => options.regions || [],
          hasRegionWeights: () => options.hasRegionWeights || false,
          hasRaceWeights: () => options.hasRaceWeights || false,
          getUseTable: () => options.useTable ?? true,
          getDelay: () => options.delay ?? 90,
          getRepeatAvoidance: () => options.repeatAvoidance ?? 0,
          generate: (month, generationType) => {
            generated.push([type, generationType, month]);
            if (generationType === 0) return options.region || "";
            if (generationType === 1) return options.mission || "";
            if (generationType === 2) return options.race || "";
            return "";
          }
        });
        const commands = [
          makeScript("STR_BLOCKED_BY_TIME", { firstMonth: 99, siteType: true }),
          makeScript("STR_BLOCKED_BY_RUNS", { maxRuns: 1, varName: "STR_BLOCKED_RUNS", siteType: true }),
          makeScript("STR_BLOCKED_BY_RESEARCH", { researchTriggers: { STR_REQUIRED_RESEARCH: true }, siteType: true }),
          makeScript("STR_LABEL_FAILS", { label: 1, executionOdds: 0, siteType: true }),
          makeScript("STR_CONDITIONAL_BLOCKED", { conditionals: [1], siteType: true }),
          makeScript("STR_MONTHLY_SITE_SCRIPT", {
            siteType: true,
            varName: "STR_MONTHLY_VAR",
            hasMissionWeights: true,
            hasRegionWeights: true,
            missionTypes: ["STR_MONTHLY_MISSION"],
            mission: "STR_MONTHLY_MISSION",
            regions: ["STR_MONTHLY_REGION"],
            region: "STR_MONTHLY_REGION",
            race: "STR_SECTOID",
            hasRaceWeights: true,
            repeatAvoidance: 1,
            delay: 90
          })
        ];
        const scripts = new Map(commands.map(command => [command.getType(), command]));
        const monthlyMissionRule = {
          getType: () => "STR_MONTHLY_MISSION",
          getSpawnZone: () => 0,
          generateRace: () => "STR_SECTOID",
          getWaveCount: () => 1,
          getWave: () => ({ spawnTimer: 30, ufoCount: 1, ufoType: "STR_SMALL_SCOUT", trajectory: "TEST_TRAJECTORY" }),
          getObjective: () => MissionObjective.OBJECTIVE_SITE
        };
        const monthlyRegionRule = {
          getType: () => "STR_MONTHLY_REGION",
          getMissionRegion: () => "STR_MONTHLY_REGION_MAPPED",
          getMissionZones: () => [{ areas: [{ lonMin: 0.5, lonMax: 0.5, latMin: 0.25, latMax: 0.25, texture: -1, name: "STR_TEST_CITY" }] }],
          insideRegion: () => true
        };
        const monthlySave = new SavedGame();
        monthlySave.setMonthsPassed(0);
        monthlySave.isResearched = research => research !== "STR_REQUIRED_RESEARCH";
        const monthlyStrategy = monthlySave.getAlienStrategy();
        const strategyRuns = [];
        const strategyLocations = [];
        const strategyRemoved = [];
        monthlyStrategy.getMissionsRun = varName => varName === "STR_BLOCKED_RUNS" ? 1 : 0;
        monthlyStrategy.addMissionRun = varName => strategyRuns.push(varName);
        monthlyStrategy.addMissionLocation = (varName, regionName, zoneNumber, maximum) => strategyLocations.push([varName, regionName, zoneNumber, maximum]);
        monthlyStrategy.validMissionLocation = () => true;
        monthlyStrategy.validMissionRegion = () => true;
        monthlyStrategy.chooseRandomRegion = () => "STR_MONTHLY_REGION";
        monthlyStrategy.chooseRandomMission = () => "STR_MONTHLY_MISSION";
        monthlyStrategy.removeMission = (regionName, missionName) => {
          strategyRemoved.push([regionName, missionName]);
          return false;
        };
        realMod.getMissionScriptList = () => commands.map(command => command.getType());
        realMod.getMissionScript = name => scripts.get(name) || null;
        realMod.getRegionsList = () => ["STR_MONTHLY_REGION"];
        realMod.getRegion = name => name === "STR_MONTHLY_REGION" ? monthlyRegionRule : originalRegionForMonthly(name);
        realMod.getAlienMission = name => name === "STR_MONTHLY_MISSION" ? monthlyMissionRule : originalAlienMissionForMonthly(name);
        realMod.getAlienRace = name => name === "STR_SECTOID" ? { getType: () => "STR_SECTOID" } : originalAlienRaceLookup(name);
        game.setSavedGame(monthlySave);
        const monthlyGeoscape = new GeoscapeState();
        monthlyGeoscape.time1Month();
        assert(monthlySave.getMonthsPassed() === 1, "time1Month should increment the month before mission scheduling");
        assert(monthlySave.getAlienMissions().length === 1, "Monthly alien mission scheduler did not create exactly one mission");
        const monthlyMission = monthlySave.getAlienMissions()[0];
        assert(monthlyMission.getRules().getType() === "STR_MONTHLY_MISSION", "Monthly mission rule type mismatch");
        assert(monthlyMission.getRegion() === "STR_MONTHLY_REGION_MAPPED", "Monthly mission should store missionRegion fallback from RuleRegion");
        assert(monthlyMission.getRace() === "STR_SECTOID", "Monthly mission race mismatch");
        assert(monthlyMission.getId() === 1, "Monthly mission id should come from SavedGame.getId(ALIEN_MISSIONS)");
        assert(monthlyMission.save().missionSiteZone === 0, "Monthly site mission should retain selected mission-site zone");
        assertArrayEquals(strategyRuns, ["STR_MONTHLY_VAR"], "Monthly scheduler should record only the successful mission run");
        assertArrayEquals(strategyLocations[0], ["STR_MONTHLY_VAR", "STR_MONTHLY_REGION", 0, 1], "Monthly scheduler should record source anti-repeat mission location");
        assertArrayEquals(strategyRemoved[0], ["STR_MONTHLY_REGION", "STR_MONTHLY_MISSION"], "Monthly scheduler should remove useTable mission from strategy table");
        assert(!generated.some(entry => entry[0] === "STR_BLOCKED_BY_TIME" || entry[0] === "STR_BLOCKED_BY_RUNS" || entry[0] === "STR_BLOCKED_BY_RESEARCH" || entry[0] === "STR_CONDITIONAL_BLOCKED"), "Blocked monthly mission scripts reached processCommand generation");
        assert(monthlyGeoscape._popups.some(state => state instanceof MonthlyReportState), "time1Month should still queue MonthlyReportState after mission scheduling");
      } finally {
        realMod.getMissionScriptList = originalMissionScriptList;
        realMod.getMissionScript = originalMissionScriptLookup;
        realMod.getRegionsList = originalRegionsList;
        realMod.getRegion = originalRegionForMonthly;
        realMod.getAlienMission = originalAlienMissionForMonthly;
        realMod.getAlienRace = originalAlienRaceLookup;
      }

      states.splice(0, states.length, ...originalStates);
      localStorage.setItem(Options.getMasterUserFolder() + "GAME_1/SAVEINFO.DAT", btoa(String.fromCharCode(...new Uint8Array(0x28))));
      const converter = new SaveConverter(1, realMod);
      assertArrayEquals(converter.graphVector([10], 3, false), [10, 0, 0], "SaveConverter graphVector should source-resize with zero padding");
      assertArrayEquals(converter.graphVector([5, 6, 7, 8], 2, false), [5, 6], "SaveConverter graphVector should truncate to current month before first year");
      assertArrayEquals(converter.graphVector([1, 2, 3, 4], 2, true), [3, 4, 1, 2], "SaveConverter graphVector should rotate current month to front after first year");

      const graphSave = new SavedGame();
      graphSave.setName("graph-roundtrip");
      graphSave.setMonthsPassed(23);
      graphSave.setGraphRegionToggles("101001");
      graphSave.setGraphCountryToggles("010110");
      graphSave.setGraphFinanceToggles("111000");
      replaceArray(graphSave.getFundsList(), [100, 200, 300, 400]);
      replaceArray(graphSave.getMaintenances(), [11, 22, 33]);
      replaceArray(graphSave.getIncomes(), [44, 55, 66]);
      replaceArray(graphSave.getExpenditures(), [77, 88, 99]);
      replaceArray(graphSave.getResearchScores(), [3, 5, 8, 13]);
      graphSave.save("graph-roundtrip.sav");
      const graphLoaded = new SavedGame();
      graphLoaded.load("graph-roundtrip.sav", realMod);
      assert(graphLoaded.getMonthsPassed() === 23, "SavedGame graph monthsPassed did not round-trip");
      assert(graphLoaded.getGraphRegionToggles() === "101001", "SavedGame graphRegionToggles did not round-trip");
      assert(graphLoaded.getGraphCountryToggles() === "010110", "SavedGame graphCountryToggles did not round-trip");
      assert(graphLoaded.getGraphFinanceToggles() === "111000", "SavedGame graphFinanceToggles did not round-trip");
      assertArrayEquals(graphLoaded.getFundsList(), [100, 200, 300, 400], "SavedGame funds history did not round-trip");
      assertArrayEquals(graphLoaded.getMaintenances(), [11, 22, 33], "SavedGame maintenance history did not round-trip");
      assertArrayEquals(graphLoaded.getIncomes(), [44, 55, 66], "SavedGame income history did not round-trip");
      assertArrayEquals(graphLoaded.getExpenditures(), [77, 88, 99], "SavedGame expenditure history did not round-trip");
      assertArrayEquals(graphLoaded.getResearchScores(), [3, 5, 8, 13], "SavedGame research score history did not round-trip");

      const graphMonthly = new SavedGame();
      const thirteen = Array.from({ length: 13 }, (_, i) => i + 1);
      replaceArray(graphMonthly.getFundsList(), thirteen);
      replaceArray(graphMonthly.getMaintenances(), thirteen);
      replaceArray(graphMonthly.getIncomes(), thirteen);
      replaceArray(graphMonthly.getExpenditures(), thirteen);
      replaceArray(graphMonthly.getResearchScores(), thirteen);
      graphMonthly.getCountryFunding = () => 1000;
      graphMonthly.getBaseMaintenance = () => 300;
      graphMonthly.monthlyFunding();
      assertArrayEquals(graphMonthly.getFundsList(), [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 713, 713], "SavedGame monthlyFunding should erase one oldest funds entry");
      assertArrayEquals(graphMonthly.getMaintenances(), [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 300, 0], "SavedGame monthlyFunding should erase one oldest maintenance entry");
      assertArrayEquals(graphMonthly.getIncomes(), [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 1000], "SavedGame monthlyFunding should erase one oldest income entry");
      assertArrayEquals(graphMonthly.getExpenditures(), [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 300], "SavedGame monthlyFunding should erase one oldest expenditure entry");
      assertArrayEquals(graphMonthly.getResearchScores(), [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 0], "SavedGame monthlyFunding should erase one oldest research score entry");

      const targetSave = new SavedGame();
      targetSave.setName("geoscape-target-roundtrip");
      targetSave.setMonthsPassed(6);
      targetSave.getBases().length = 0;
      const regionName = realMod.getRegionsList()[0];
      const originalRoundtripGetRegion = realMod.getRegion.bind(realMod);
      const originalRoundtripGetCountry = realMod.getCountry.bind(realMod);
      const regionRule = { getType: () => "STR_ROUNDTRIP_REGION" };
      const countryRule = { getType: () => "STR_ROUNDTRIP_COUNTRY" };
      const pactCountryRule = { getType: () => "STR_ROUNDTRIP_PACT_COUNTRY" };
      realMod.getRegion = type => type === regionRule.getType() ? regionRule : originalRoundtripGetRegion(type);
      realMod.getCountry = type => {
        if (type === countryRule.getType()) return countryRule;
        if (type === pactCountryRule.getType()) return pactCountryRule;
        return originalRoundtripGetCountry(type);
      };
      const raceName = realMod.getAlienRacesList()[0];
      const deploymentRule = realMod.getDeployment("STR_ALIEN_BASE_ASSAULT") || realMod.getDeployment(realMod.getDeploymentsList()[0], true);
      const missionRule = realMod.getAlienMission(realMod.getAlienMissionList()[0], true);
      const ufoRule = realMod.getUfo(realMod.getUfosList()[0], true);
      const craftRule = realMod.getCraft("STR_SKYRANGER") || realMod.getCraft(realMod.getCraftsList()[0]);
      const trajectory = realMod.getUfoTrajectory("P0", true);
      assert(deploymentRule && missionRule && ufoRule && craftRule && trajectory, "Geoscape target roundtrip fixture rules missing");

      const targetRegion = new Region(regionRule);
      replaceArray(targetRegion.getActivityXcom(), [12, 34]);
      replaceArray(targetRegion.getActivityAlien(), [56, 78]);
      targetSave.getRegions().push(targetRegion);
      const targetCountry = new Country(countryRule, false);
      replaceArray(targetCountry.getFunding(), [111000, 222000]);
      replaceArray(targetCountry.getActivityXcom(), [7, 8]);
      replaceArray(targetCountry.getActivityAlien(), [9, 10]);
      targetCountry.setNewPact();
      targetSave.getCountries().push(targetCountry);
      const pactCountry = new Country(pactCountryRule, false);
      replaceArray(pactCountry.getFunding(), [333000]);
      replaceArray(pactCountry.getActivityXcom(), [11]);
      replaceArray(pactCountry.getActivityAlien(), [12]);
      pactCountry.setPact();
      targetSave.getCountries().push(pactCountry);

      const targetWaypoint = new Waypoint();
      targetWaypoint.setId(31);
      targetWaypoint.setName("ROUNDTRIP_WAYPOINT");
      targetWaypoint.setLongitude(1.25);
      targetWaypoint.setLatitude(0.35);
      targetSave.getWaypoints().push(targetWaypoint);

      const targetAlienBase = new AlienBase(deploymentRule);
      targetAlienBase.setId(41);
      targetAlienBase.setName("ROUNDTRIP_ALIEN_BASE");
      targetAlienBase.setLongitude(2.5);
      targetAlienBase.setLatitude(0.45);
      targetAlienBase.setAlienRace(raceName);
      targetAlienBase.setDiscovered(true);
      targetAlienBase.setInBattlescape(true);
      targetSave.getAlienBases().push(targetAlienBase);

      const targetMission = new AlienMission(missionRule);
      targetMission.setId(51);
      targetMission.setRegion(regionName, realMod);
      targetMission.setRace(raceName);
      targetMission.setAlienBase(targetAlienBase);
      targetMission.setMissionSiteZone(0);
      targetMission.start(120);
      targetSave.getAlienMissions().push(targetMission);

      const targetUfo = new Ufo(ufoRule);
      targetUfo.setId(61);
      targetUfo.setName("ROUNDTRIP_UFO");
      targetUfo.setLongitude(3.1);
      targetUfo.setLatitude(0.55);
      targetUfo.setDamage(7);
      targetUfo.setAltitude("STR_LOW_UC");
      targetUfo.setStatus(UfoStatus.FLYING);
      targetUfo.setDetected(true);
      targetUfo.setHyperDetected(true);
      targetUfo.setSecondsRemaining(125);
      targetUfo.setFireCountdown(8);
      targetUfo.setEscapeCountdown(9);
      targetUfo.setMissionInfo(targetMission, trajectory);
      targetUfo.setTrajectoryPoint(0);
      targetUfo.setDestination(targetWaypoint);
      targetSave.getUfos().push(targetUfo);

      const targetSite = new MissionSite(missionRule, deploymentRule);
      targetSite.setId(71);
      targetSite.setName("ROUNDTRIP_SITE");
      targetSite.setLongitude(4.2);
      targetSite.setLatitude(0.65);
      targetSite.setAlienRace(raceName);
      targetSite.setTexture(3);
      targetSite.setSecondsRemaining(1440);
      targetSite.setDetected(true);
      targetSite.setInBattlescape(true);
      targetSave.getMissionSites().push(targetSite);

      const targetBase = new Base(realMod);
      targetBase.setName("ROUNDTRIP_XCOM_BASE");
      targetBase.setLongitude(5.2);
      targetBase.setLatitude(0.75);
      targetBase.setScientists(4);
      targetBase.setEngineers(5);
      targetBase.setInBattlescape(true);
      targetBase.setRetaliationTarget(true);
      targetBase.getStorageItems().load({ STR_ALIEN_ALLOYS: 6 });
      const originalRoundtripGetBaseFacility = realMod.getBaseFacility.bind(realMod);
      const fakeFacilityRule = { getType: () => "STR_ROUNDTRIP_FACILITY" };
      realMod.getBaseFacility = type => type === fakeFacilityRule.getType() ? fakeFacilityRule : originalRoundtripGetBaseFacility(type);
      const targetFacility = new BaseFacility(fakeFacilityRule, targetBase);
      targetFacility.setX(2);
      targetFacility.setY(3);
      targetFacility.setBuildTime(6);
      targetBase.getFacilities().push(targetFacility);
      const targetResearchName = realMod.getResearchList().find(name => realMod.getResearch(name));
      let targetResearchRule = targetResearchName ? realMod.getResearch(targetResearchName, true) : null;
      const targetManufactureName = realMod.getManufactureList().find(name => realMod.getManufacture(name));
      let targetManufactureRule = targetManufactureName ? realMod.getManufacture(targetManufactureName, true) : null;
      const originalRoundtripGetResearch = realMod.getResearch.bind(realMod);
      const originalRoundtripGetResearchList = realMod.getResearchList.bind(realMod);
      const originalRoundtripGetManufacture = realMod.getManufacture.bind(realMod);
      const originalRoundtripGetManufactureList = realMod.getManufactureList.bind(realMod);
      if (!targetResearchRule) {
        targetResearchRule = {
          getName: () => "STR_ROUNDTRIP_RESEARCH",
          getCost: () => 37,
          getDependencies: () => [],
          getRequirements: () => [],
          getGetOneFree: () => [],
          getUnlocked: () => [],
          needItem: () => false
        };
        realMod.getResearch = name => name === targetResearchRule.getName() ? targetResearchRule : originalRoundtripGetResearch(name);
        realMod.getResearchList = () => [targetResearchRule.getName(), ...originalRoundtripGetResearchList()];
      }
      if (!targetManufactureRule) {
        targetManufactureRule = {
          getName: () => "STR_ROUNDTRIP_PRODUCTION"
        };
        realMod.getManufacture = name => name === targetManufactureRule.getName() ? targetManufactureRule : originalRoundtripGetManufacture(name);
        realMod.getManufactureList = () => [targetManufactureRule.getName(), ...originalRoundtripGetManufactureList()];
      }
      const targetResearch = new ResearchProject(targetResearchRule, 37);
      targetResearch.setAssigned(2);
      targetResearch.setSpent(11);
      targetResearch.setCost(37);
      targetBase.addResearch(targetResearch);
      const targetProduction = new Production(targetManufactureRule, 9);
      targetProduction.setAssignedEngineers(3);
      targetProduction.setTimeSpent(17);
      targetProduction.setInfiniteAmount(true);
      targetProduction.setSellItems(true);
      targetBase.addProduction(targetProduction);
      const targetCraft = new Craft(craftRule, targetBase, 81);
      targetCraft.setName("ROUNDTRIP_CRAFT");
      targetCraft.setFuel(88);
      targetCraft.setDamage(9);
      targetCraft.setLowFuel(true);
      targetCraft.setMissionComplete(true);
      targetCraft.setInterceptionOrder(3);
      targetCraft.setDestination(targetWaypoint);
      targetBase.getCrafts().push(targetCraft);
      const originalGetSoldier = realMod.getSoldier.bind(realMod);
      const originalGetSoldiersList = realMod.getSoldiersList.bind(realMod);
      const originalGetArmor = realMod.getArmor.bind(realMod);
      const zeroStats = () => ({ tu: 0, stamina: 0, health: 0, bravery: 0, reactions: 0, firing: 0, throwing: 0, strength: 0, psiStrength: 0, psiSkill: 0, melee: 0 });
      const soldierRule = {
        getType: () => "STR_ROUNDTRIP_SOLDIER_RULE",
        getArmor: () => "STR_ROUNDTRIP_ARMOR",
        getMinStats: zeroStats,
        getMaxStats: zeroStats,
        getStatCaps: zeroStats,
        getNames: () => [],
        getFemaleFrequency: () => 0
      };
      const soldierArmor = { getType: () => "STR_ROUNDTRIP_ARMOR" };
      realMod.getSoldier = type => type === soldierRule.getType() ? soldierRule : originalGetSoldier(type);
      realMod.getSoldiersList = () => [soldierRule.getType(), ...originalGetSoldiersList()];
      realMod.getArmor = type => type === soldierArmor.getType() ? soldierArmor : originalGetArmor(type);
      const targetSoldier = new Soldier(soldierRule, soldierArmor);
      targetSoldier.setName("ROUNDTRIP SOLDIER");
      targetSoldier.getInitStats().tu = 44;
      targetSoldier.getCurrentStats().firing = 55;
      targetSoldier.promoteRank();
      targetSoldier.addMissionCount();
      targetSoldier.addKillCount(3);
      targetSoldier.setPsiTraining(true);
      targetSoldier.setCraft(targetCraft);
      targetBase.getSoldiers().push(targetSoldier);
      const transferItem = new Transfer(12);
      transferItem.setItems("STR_ALIEN_ALLOYS", 4);
      targetBase.getTransfers().push(transferItem);
      const transferScientists = new Transfer(13);
      transferScientists.setScientists(2);
      targetBase.getTransfers().push(transferScientists);
      const transferEngineers = new Transfer(14);
      transferEngineers.setEngineers(3);
      targetBase.getTransfers().push(transferEngineers);
      const transferCraftPayload = new Craft(craftRule, targetBase, 82);
      transferCraftPayload.setName("ROUNDTRIP_TRANSFER_CRAFT");
      transferCraftPayload.setFuel(77);
      const transferCraft = new Transfer(15);
      transferCraft.setCraft(transferCraftPayload);
      targetBase.getTransfers().push(transferCraft);
      const transferSoldierPayload = new Soldier(soldierRule, soldierArmor);
      transferSoldierPayload.setName("ROUNDTRIP TRANSFER SOLDIER");
      const transferSoldier = new Transfer(16);
      transferSoldier.setSoldier(transferSoldierPayload);
      targetBase.getTransfers().push(transferSoldier);
      targetSave.getBases().push(targetBase);
      const alternateBase = new Base(realMod);
      alternateBase.setName("ROUNDTRIP_SECOND_BASE");
      alternateBase.setLongitude(6.2);
      alternateBase.setLatitude(0.85);
      targetSave.getBases().push(alternateBase);
      targetSave.setSelectedBase(1);
      assert(targetSave.getSelectedBase() === alternateBase, "SavedGame setSelectedBase did not update runtime selected base");
      const targetDeadSoldier = new Soldier(soldierRule, soldierArmor);
      targetDeadSoldier.setName("ROUNDTRIP DEAD SOLDIER");
      targetDeadSoldier.getInitStats().health = 31;
      targetDeadSoldier.die(new SoldierDeath(new GameTime(2, 3, 4, 2001, 5, 6, 7), { mission: 4, race: "STR_TEST_RACE" }));
      targetSave.getDeadSoldiers().push(targetDeadSoldier);
      const targetMissionStats = new MissionStatistics();
      targetMissionStats.id = 101;
      targetMissionStats.markerName = "STR_UFO";
      targetMissionStats.markerId = 9;
      targetMissionStats.region = "STR_TEST_REGION";
      targetMissionStats.country = "STR_TEST_COUNTRY";
      targetMissionStats.type = "STR_TEST_MISSION";
      targetMissionStats.ufo = "STR_TEST_UFO";
      targetMissionStats.success = true;
      targetMissionStats.score = 1234;
      targetMissionStats.rating = "STR_EXCELLENT";
      targetMissionStats.alienRace = "STR_SECTOID";
      targetMissionStats.daylight = 12;
      targetMissionStats.valiantCrux = true;
      targetMissionStats.lootValue = 4321;
      targetMissionStats.injuryList.set(91, 8);
      targetSave.getMissionStatistics().push(targetMissionStats);

      targetSave.save("geoscape-target-roundtrip.sav");
      const rawRoundtripSave = getBrowserFile(Options.getMasterUserFolder() + "geoscape-target-roundtrip.sav");
      assert(rawRoundtripSave, "SavedGame round-trip fixture was not written to browser storage");
      const savedRoundtripDoc = JSON.parse(rawRoundtripSave)[1];
      assert(!Object.prototype.hasOwnProperty.call(savedRoundtripDoc, "selectedBase"), "SavedGame.save should not serialize selectedBase; C++ keeps it runtime-only");
      const targetLoaded = new SavedGame();
      targetLoaded.load("geoscape-target-roundtrip.sav", realMod);
      assert(targetLoaded.getWaypoints().length === 1, "SavedGame waypoints did not round-trip");
      const loadedWaypoint = targetLoaded.getWaypoints()[0];
      assert(loadedWaypoint.getId() === 31 && loadedWaypoint.getLongitude() === 1.25 && loadedWaypoint.getLatitude() === 0.35, "Waypoint target fields did not round-trip");
      assert(loadedWaypoint.getName(game.getLanguage()) === "ROUNDTRIP_WAYPOINT", "Waypoint name did not round-trip");
      assert(targetLoaded.getRegions().length === 1, "SavedGame regions did not round-trip");
      const loadedRegion = targetLoaded.getRegions()[0];
      assert(loadedRegion.getRules().getType() === regionRule.getType(), "Region rule type did not round-trip");
      assertArrayEquals(loadedRegion.getActivityXcom(), [12, 34], "Region X-COM activity did not round-trip");
      assertArrayEquals(loadedRegion.getActivityAlien(), [56, 78], "Region alien activity did not round-trip");
      assert(targetLoaded.getCountries().length === 2, "SavedGame countries did not round-trip");
      const loadedCountry = targetLoaded.getCountries()[0];
      assert(loadedCountry.getRules().getType() === countryRule.getType() && loadedCountry.getNewPact(), "Country rule/newPact did not round-trip");
      assertArrayEquals(loadedCountry.getFunding(), [111000, 222000], "Country funding did not round-trip");
      assertArrayEquals(loadedCountry.getActivityXcom(), [7, 8], "Country X-COM activity did not round-trip");
      assertArrayEquals(loadedCountry.getActivityAlien(), [9, 10], "Country alien activity did not round-trip");
      const loadedPactCountry = targetLoaded.getCountries()[1];
      assert(loadedPactCountry.getRules().getType() === pactCountryRule.getType() && loadedPactCountry.getPact() && loadedPactCountry.getSatisfaction() === 0, "Country pact did not round-trip");
      assert(targetLoaded.getAlienBases().length === 1, "SavedGame alien bases did not round-trip");
      const loadedAlienBase = targetLoaded.getAlienBases()[0];
      assert(loadedAlienBase.getId() === 41 && loadedAlienBase.getDeployment().getType() === deploymentRule.getType(), "AlienBase id/deployment did not round-trip");
      assert(loadedAlienBase.isDiscovered() && loadedAlienBase.isInBattlescape(), "AlienBase flags did not round-trip");
      assert(loadedAlienBase.getAlienRace() === raceName, "AlienBase race did not round-trip");
      assert(targetLoaded.getAlienMissions().length === 1, "SavedGame alien missions did not round-trip");
      const loadedMission = targetLoaded.getAlienMissions()[0];
      assert(loadedMission.getId() === 51 && loadedMission.getRace() === raceName, "AlienMission id/race did not round-trip");
      assert(loadedMission.getAlienBase() === loadedAlienBase, "AlienMission alienBase link did not restore from saveId");
      assert(loadedMission.save().missionSiteZone === 0, "AlienMission missionSiteZone did not round-trip");
      assert(targetLoaded.getUfos().length === 1, "SavedGame UFOs did not round-trip");
      const loadedUfo = targetLoaded.getUfos()[0];
      assert(loadedUfo.getId() === 61 && loadedUfo.getMission() === loadedMission, "UFO id/mission link did not round-trip");
      assert(loadedUfo.getDetected() && loadedUfo.getHyperDetected(), "UFO detection flags did not round-trip");
      assert(loadedUfo.getDestination()?.getLongitude() === targetWaypoint.getLongitude(), "UFO destination longitude did not round-trip");
      assert(targetLoaded.getMissionSites().length === 1, "SavedGame mission sites did not round-trip");
      const loadedSite = targetLoaded.getMissionSites()[0];
      assert(loadedSite.getId() === 71 && loadedSite.getTexture() === 3 && loadedSite.getSecondsRemaining() === 1440, "MissionSite fields did not round-trip");
      assert(loadedSite.getDetected() && loadedSite.isInBattlescape(), "MissionSite flags did not round-trip");
      assert(targetLoaded.getBases().length === 2, "SavedGame base list did not round-trip");
      const loadedBase = targetLoaded.getBases()[0];
      assert(loadedBase.getName() === "ROUNDTRIP_XCOM_BASE" && loadedBase.getStorageItems().getItem("STR_ALIEN_ALLOYS") === 6, "Base core fields did not round-trip");
      const loadedAlternateBase = targetLoaded.getBases()[1];
      assert(loadedAlternateBase.getName() === "ROUNDTRIP_SECOND_BASE", "Second base did not round-trip");
      assert(targetLoaded.getSelectedBase() === loadedBase, "SavedGame.load should leave selectedBase at the default first base like C++");
      assert(loadedBase.getFacilities().length === 1, "Base facilities did not round-trip");
      const loadedFacility = loadedBase.getFacilities()[0];
      assert(loadedFacility.getRules().getType() === fakeFacilityRule.getType() && loadedFacility.getX() === 2 && loadedFacility.getY() === 3 && loadedFacility.getBuildTime() === 6, "BaseFacility type/position/buildTime did not round-trip");
      assert(loadedBase.isInBattlescape() && loadedBase.getRetaliationTarget(), "Base inBattlescape/retaliationTarget flags did not round-trip");
      assert(loadedBase.getScientists() === 4 && loadedBase.getEngineers() === 5, "Base free scientists/engineers did not round-trip");
      assert(loadedBase.getResearch().length === 1, "Base research projects did not round-trip");
      const loadedResearch = loadedBase.getResearch()[0];
      assert(loadedResearch.getRules().getName() === targetResearchRule.getName(), "Research project rule did not round-trip");
      assert(loadedResearch.getAssigned() === 2 && loadedResearch.getSpent() === 11 && loadedResearch.getCost() === 37, "Research project assigned/spent/cost did not round-trip");
      assert(loadedBase.getProductions().length === 1, "Base productions did not round-trip");
      const loadedProduction = loadedBase.getProductions()[0];
      assert(loadedProduction.getRules().getName() === targetManufactureRule.getName(), "Production rule did not round-trip");
      assert(loadedProduction.getAssignedEngineers() === 3 && loadedProduction.getTimeSpent() === 17 && loadedProduction.getAmountTotal() === 9, "Production assigned/spent/amount did not round-trip");
      assert(loadedProduction.getInfiniteAmount() && loadedProduction.getSellItems(), "Production infinite/sell flags did not round-trip");
      realMod.getResearch = originalRoundtripGetResearch;
      realMod.getResearchList = originalRoundtripGetResearchList;
      realMod.getManufacture = originalRoundtripGetManufacture;
      realMod.getManufactureList = originalRoundtripGetManufactureList;
      assert(loadedBase.getCrafts().length === 1, "Base craft list did not round-trip");
      const loadedCraft = loadedBase.getCrafts()[0];
      assert(loadedCraft.getId() === 81 && loadedCraft.getName(game.getLanguage()) === "ROUNDTRIP_CRAFT", "Craft id/name did not round-trip");
      assert(loadedCraft.getFuel() === 88 && loadedCraft.getDamage() === 9 && loadedCraft.getLowFuel(), "Craft fuel/damage/lowFuel did not round-trip");
      assert(loadedCraft.getMissionComplete() && loadedCraft.getInterceptionOrder() === 3, "Craft mission/interception fields did not round-trip");
      assert(loadedCraft.getDestination() === loadedWaypoint, "Craft destination did not restore to saved waypoint object");
      assert(loadedBase.getSoldiers().length === 1, "Base soldiers did not round-trip");
      const loadedSoldier = loadedBase.getSoldiers()[0];
      assert(loadedSoldier.getName() === "ROUNDTRIP SOLDIER" && loadedSoldier.getId() === targetSoldier.getId(), "Soldier name/id did not round-trip");
      assert(loadedSoldier.getInitStats().tu === 44 && loadedSoldier.getCurrentStats().firing === 55, "Soldier stats did not round-trip");
      assert(loadedSoldier.getRank() === targetSoldier.getRank() && loadedSoldier.getMissions() === 1 && loadedSoldier.getKills() === 3, "Soldier rank/mission/kill fields did not round-trip");
      assert(loadedSoldier.isInPsiTraining(), "Soldier psi-training flag did not round-trip");
      assert(loadedSoldier.getCraft() === loadedCraft, "Soldier craft link did not restore to saved craft object");
      assert(loadedBase.getTransfers().length === 5, "Base transfers did not round-trip");
      const loadedTransfers = loadedBase.getTransfers();
      assert(loadedTransfers[0].getHours() === 12 && loadedTransfers[0].getItems() === "STR_ALIEN_ALLOYS" && loadedTransfers[0].getQuantity() === 4, "Item transfer did not round-trip");
      assert(loadedTransfers[1].getHours() === 13 && loadedTransfers[1].getQuantity() === 2, "Scientist transfer did not round-trip");
      assert(loadedTransfers[2].getHours() === 14 && loadedTransfers[2].getQuantity() === 3, "Engineer transfer did not round-trip");
      assert(loadedTransfers[3].getHours() === 15 && loadedTransfers[3].getCraft()?.getName(game.getLanguage()) === "ROUNDTRIP_TRANSFER_CRAFT", "Craft transfer did not round-trip");
      assert(loadedTransfers[4].getHours() === 16 && loadedTransfers[4].getSoldier()?.getName() === "ROUNDTRIP TRANSFER SOLDIER", "Soldier transfer did not round-trip");
      assert(targetLoaded.getDeadSoldiers().length === 1, "Dead soldiers did not round-trip");
      const loadedDeadSoldier = targetLoaded.getDeadSoldiers()[0];
      assert(loadedDeadSoldier.getName() === "ROUNDTRIP DEAD SOLDIER" && loadedDeadSoldier.getInitStats().health === 31, "Dead soldier identity/stats did not round-trip");
      assert(loadedDeadSoldier.getDeath()?.getTime().getYear() === 2001 && loadedDeadSoldier.getDeath()?.getCause()?.mission === 4, "Soldier death data did not round-trip");
      assert(targetLoaded.getMissionStatistics().length === 1, "Mission statistics did not round-trip");
      const loadedMissionStats = targetLoaded.getMissionStatistics()[0];
      assert(loadedMissionStats.id === 101 && loadedMissionStats.score === 1234 && loadedMissionStats.rating === "STR_EXCELLENT", "Mission statistics id/score/rating did not round-trip");
      assert(loadedMissionStats.valiantCrux && loadedMissionStats.lootValue === 4321 && loadedMissionStats.injuryList?.["91"] === 8, "Mission statistics flags/loot/injury list did not round-trip");
      realMod.getRegion = originalRoundtripGetRegion;
      realMod.getCountry = originalRoundtripGetCountry;
      realMod.getBaseFacility = originalRoundtripGetBaseFacility;
      realMod.getSoldier = originalGetSoldier;
      realMod.getSoldiersList = originalGetSoldiersList;
      realMod.getArmor = originalGetArmor;

      const makeResearchRule = (name, options = {}) => {
        const rule = new RuleResearch(name);
        rule.load({
          name,
          lookup: options.lookup || "",
          cutscene: options.cutscene || "",
          cost: options.cost ?? 10,
          points: options.points ?? 0,
          dependencies: [],
          unlocks: options.unlocks || [],
          getOneFree: options.getOneFree || [],
          requires: []
        });
        return rule;
      };
      const primaryResearch = makeResearchRule("STR_TEST_PRIMARY_RESEARCH", {
        lookup: "STR_TEST_PRIMARY_REPORT",
        cutscene: "PRIMARY_RESEARCH_CUTSCENE",
        getOneFree: ["STR_TEST_BONUS_RESEARCH"],
        points: 7
      });
      const primaryLookup = makeResearchRule("STR_TEST_PRIMARY_REPORT");
      const bonusResearch = makeResearchRule("STR_TEST_BONUS_RESEARCH", {
        lookup: "STR_TEST_BONUS_REPORT",
        cutscene: "BONUS_RESEARCH_CUTSCENE",
        points: 11
      });
      const bonusLookup = makeResearchRule("STR_TEST_BONUS_REPORT");
      const researchRules = new Map([
        [primaryResearch.getName(), primaryResearch],
        [primaryLookup.getName(), primaryLookup],
        [bonusResearch.getName(), bonusResearch],
        [bonusLookup.getName(), bonusLookup]
      ]);
      const originalResearchMethods = {
        getResearch: realMod.getResearch.bind(realMod),
        getResearchList: realMod.getResearchList.bind(realMod),
        getManufacture: realMod.getManufacture.bind(realMod),
        getManufactureList: realMod.getManufactureList.bind(realMod),
        getItem: realMod.getItem.bind(realMod),
        getUnit: realMod.getUnit.bind(realMod)
      };
      const openedArticles = [];
      const originalOpenArticle = Ufopaedia.openArticle;
      try {
        realMod.getResearch = (name, error = false) => researchRules.get(name) || originalResearchMethods.getResearch(name, error);
        realMod.getResearchList = () => [...researchRules.keys()];
        realMod.getManufacture = () => null;
        realMod.getManufactureList = () => [];
        realMod.getItem = () => null;
        realMod.getUnit = () => null;
        Ufopaedia.openArticle = (_game, articleId) => {
          openedArticles.push(articleId);
        };

        const researchSave = new SavedGame();
        const researchBase = researchSave.getBases()[0];
        researchBase.setMod(realMod);
        const researchProject = new ResearchProject(primaryResearch, primaryResearch.getCost());
        researchProject.setAssigned(primaryResearch.getCost());
        researchBase.addResearch(researchProject);
        game.setSavedGame(researchSave);
        const geoscapeResearch = new GeoscapeState();
        geoscapeResearch.time1Day();

        const researchPopups = geoscapeResearch._popups;
        assert(researchPopups[0] instanceof CutsceneState, "Research cutscene should be queued before ResearchCompleteState");
        assert(researchPopups[0]._cutsceneId === "PRIMARY_RESEARCH_CUTSCENE", "Primary research cutscene id mismatch");
        assert(researchPopups[1] instanceof CutsceneState, "Bonus cutscene should follow primary research cutscene");
        assert(researchPopups[1]._cutsceneId === "BONUS_RESEARCH_CUTSCENE", "Bonus research cutscene id mismatch");
        assert(researchPopups[2] instanceof ResearchCompleteState, "ResearchCompleteState should follow research cutscenes");

        states.splice(0, states.length, researchPopups[2]);
        researchPopups[2].btnReportClick();
        assert(openedArticles.join("|") === "STR_TEST_BONUS_REPORT|STR_TEST_PRIMARY_REPORT", "ResearchCompleteState did not open bonus then primary Ufopaedia reports");
      } finally {
        realMod.getResearch = originalResearchMethods.getResearch;
        realMod.getResearchList = originalResearchMethods.getResearchList;
        realMod.getManufacture = originalResearchMethods.getManufacture;
        realMod.getManufactureList = originalResearchMethods.getManufactureList;
        realMod.getItem = originalResearchMethods.getItem;
        realMod.getUnit = originalResearchMethods.getUnit;
        Ufopaedia.openArticle = originalOpenArticle;
      }

      states.splice(0, states.length, ...originalStates);
      const originalAutosave = Options.autosave;
      const monthlyLogs = [];
      const originalConsoleLog = console.log;
      console.log = (...args) => {
        monthlyLogs.push(args.join(" "));
        originalConsoleLog(...args);
      };
      try {
        const makeMonthlySave = (ironman = false) => {
          const monthlySave = new SavedGame();
          monthlySave.setMonthsPassed(2);
          monthlySave.setFunds(250000);
          monthlySave.setIronman(ironman);
          monthlySave.setName("monthly-route");
          monthlySave.getBaseMaintenance = () => 0;
          monthlySave.getCountryFunding = () => 250000;
          const monthlyBase = monthlySave.getBases()[0];
          monthlyBase.setMod(realMod);
          const diary = {
            addMonthlyServiceCalls: 0,
            addMonthlyService: () => { diary.addMonthlyServiceCalls++; },
            manageCommendations: () => true,
            getSoldierCommendations: () => []
          };
          const soldier = {
            getId: () => 7001,
            getName: () => "MONTHLY SOLDIER",
            getRankString: () => "STR_SERGEANT",
            getDiary: () => diary,
            save: () => ({ type: "STR_MONTHLY_FAKE_SOLDIER", id: 7001, name: "MONTHLY SOLDIER" })
          };
          monthlyBase.getSoldiers().push(soldier);
          return { monthlySave, diary };
        };

        Options.autosave = true;
        const { monthlySave, diary } = makeMonthlySave(false);
        game.setSavedGame(monthlySave);
        const monthly = new MonthlyReportState(true, null);
        monthly._gameOver = false;
        states.splice(0, states.length, monthly);
        monthly.btnOkClick();
        const monthlyRoute = states.slice();
        assert(diary.addMonthlyServiceCalls === 1, "MonthlyReportState did not add monthly service before follow-up states");
        assert(monthlyRoute[0] instanceof CommendationState, "MonthlyReportState should push CommendationState first");
        assert(monthlyRoute[1] instanceof PsiTrainingState, "MonthlyReportState should push PsiTrainingState after commendations when psi report is requested");
        assert(monthlyRoute[2] instanceof SaveGameState, "MonthlyReportState should push SaveGameState last for autosave");
        assert(monthlyRoute[2]._type === SaveType.SAVE_AUTO_GEOSCAPE, "MonthlyReportState autosave should use SAVE_AUTO_GEOSCAPE");
        const autoSaveKey = "openxcom.file:browser://localStorage/openxcom/saves/_autogeo_.asav";
        localStorage.removeItem(autoSaveKey);
        for (let i = 0; i < 11; ++i) {
          monthlyRoute[2].think();
        }
        assert(localStorage.getItem(autoSaveKey), "MonthlyReportState autosave SaveGameState did not persist _autogeo_.asav");

        Options.autosave = false;
        const { monthlySave: ironmanSave } = makeMonthlySave(true);
        game.setSavedGame(ironmanSave);
        const gameOver = new MonthlyReportState(false, null);
        gameOver._gameOver = true;
        states.splice(0, states.length, gameOver);
        gameOver.btnOkClick();
        assert(gameOver._txtFailure.getVisible() === true, "MonthlyReportState first game-over click should reveal failure text");
        assert(states[0] === gameOver, "MonthlyReportState first game-over click should not push terminal states yet");
        gameOver.btnOkClick();
        const gameOverRoute = states.slice(1);
        assert(gameOverRoute[0] instanceof CutsceneState, "MonthlyReportState should push CutsceneState on visible game-over confirmation");
        assert(gameOverRoute[1] instanceof SaveGameState, "MonthlyReportState should push ironman SaveGameState after game-over cutscene");
        assert(gameOverRoute[1]._type === SaveType.SAVE_IRONMAN, "MonthlyReportState game-over ironman save should use SAVE_IRONMAN");

        const makeTerminalSave = (ending, monthsPassed = 2) => {
          const terminalSave = new SavedGame();
          terminalSave.setMonthsPassed(monthsPassed);
          terminalSave.setEnding(ending);
          terminalSave.setName("terminal-statistics-route");
          return terminalSave;
        };
        const originalGetVideo = realMod.getVideo;
        const originalLoad = SavedGame.prototype.load;
        const originalResolution = {
          x: Options.baseXResolution,
          y: Options.baseYResolution
        };
        try {
          realMod.getVideo = () => null;

          game.setSavedGame(makeTerminalSave(GameEnding.END_LOSE, 2));
          const loseCutscene = new CutsceneState(CutsceneState.LOSE_GAME);
          states.splice(0, states.length, loseCutscene);
          loseCutscene.init();
          assert(states.length === 1 && states[0] instanceof StatisticsState, "LOSE_GAME CutsceneState should route campaign saves to StatisticsState");
          assert(game.getSavedGame()?.getEnding?.() === GameEnding.END_LOSE, "LOSE_GAME CutsceneState should keep the terminal saved game for statistics");

          game.setSavedGame(makeTerminalSave(GameEnding.END_WIN, 3));
          const winCutscene = new CutsceneState(CutsceneState.WIN_GAME);
          states.splice(0, states.length, winCutscene);
          winCutscene.init();
          assert(states.length === 1 && states[0] instanceof StatisticsState, "WIN_GAME CutsceneState should route campaign saves to StatisticsState");

          game.setSavedGame(makeTerminalSave(GameEnding.END_LOSE, -1));
          const introCutscene = new CutsceneState(CutsceneState.LOSE_GAME);
          states.splice(0, states.length, introCutscene);
          introCutscene.init();
          assert(game.getSavedGame() === null, "pre-campaign terminal CutsceneState should clear the saved game");
          assert(states.length === 1 && states[0] instanceof GoToMainMenuState, "pre-campaign terminal CutsceneState should route to GoToMainMenuState");

          const openSave = makeTerminalSave(GameEnding.END_NONE, 4);
          game.setSavedGame(openSave);
          const openStats = new StatisticsState();
          states.splice(0, states.length, openStats);
          openStats.btnOkClick();
          assert(states.length === 0, "StatisticsState END_NONE OK should pop back to the previous state");
          assert(game.getSavedGame() === openSave, "StatisticsState END_NONE OK should keep the active saved game");

          game.setSavedGame(makeTerminalSave(GameEnding.END_WIN, 5));
          const terminalStats = new StatisticsState();
          states.splice(0, states.length, terminalStats);
          terminalStats.btnOkClick();
          assert(game.getSavedGame() === null, "StatisticsState terminal OK should clear the saved game");
          assert(states.length === 1 && states[0] instanceof GoToMainMenuState, "StatisticsState terminal OK should route to GoToMainMenuState");

          SavedGame.prototype.load = function loadTerminalSave() {
            this.setMonthsPassed(6);
            this.setEnding(GameEnding.END_WIN);
            this.setName("loaded-terminal-save");
          };
          game.setSavedGame(makeTerminalSave(GameEnding.END_NONE, 1));
          const loadEndedSave = new LoadGameState(OPT_GEOSCAPE, "terminal.asav", null);
          states.splice(0, states.length, loadEndedSave);
          for (let i = 0; i < 11; ++i) {
            loadEndedSave.think();
          }
          assert(states.length === 1 && states[0] instanceof StatisticsState, "LoadGameState should route ended saves to StatisticsState");
          assert(game.getSavedGame()?.getEnding?.() === GameEnding.END_WIN, "LoadGameState should keep the loaded terminal saved game");
          assert(Options.baseXResolution === Screen.ORIGINAL_WIDTH && Options.baseYResolution === Screen.ORIGINAL_HEIGHT, "LoadGameState ended-save route should reset to original resolution");
        } finally {
          realMod.getVideo = originalGetVideo;
          SavedGame.prototype.load = originalLoad;
          Options.baseXResolution = originalResolution.x;
          Options.baseYResolution = originalResolution.y;
        }

        assert(!monthlyLogs.some(line => line.includes("is not translated yet")), "MonthlyReportState still emitted untranslated follow-up log");
      } finally {
        console.log = originalConsoleLog;
        Options.autosave = originalAutosave;
      }
    } finally {
      states.splice(0, states.length, ...originalStates);
      game.setSavedGame(originalSave);
    }

    return {
      defenses: base.getDefenses().length,
      vehicles: base.getVehicles().length,
      storage: Object.fromEntries(base.getStorageItems().getContents()),
      briefingRoute: "InventoryState",
      crashRoute: "DebriefingState",
      audio: {
        geoscapeSound: realMod.getSound("GEO.CAT", Mod.UFO_FIRE, false)?.getPlayCount() || 0,
        musicRequests: realMod.musicRequestLog?.slice(-3) || []
      }
    };
  });

  await page.evaluate(value => console.log("VERIFY_GEOSCAPE_CONFIRMATIONS ok " + JSON.stringify(value)), result);
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

    child.stdout.on("data", chunk => {
      stdout.push(String(chunk));
    });
    child.stderr.on("data", chunk => {
      stderr.push(String(chunk));
    });

    child.on("error", error => {
      reject(error);
    });

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

function extractNumbers(text, startNeedle, endNeedle) {
  const start = text.indexOf(startNeedle);
  if (start < 0) {
    throw new Error(`Missing table start: ${startNeedle}`);
  }
  const bodyStart = text.indexOf(startNeedle.includes("const int") ? "{" : "[", start);
  const end = text.indexOf(endNeedle, bodyStart);
  if (bodyStart < 0 || end < 0) {
    throw new Error(`Could not isolate table: ${startNeedle}`);
  }
  return (text.slice(bodyStart, end).replace(/\/\*[\s\S]*?\*\//g, "").match(/\d+/g) || []).map(Number);
}

async function checkDogfightSourceParity() {
  line("- dogfight source parity");
  const cpp = await readFile(join(repoRoot, "src", "Geoscape", "DogfightState.cpp"), "utf8");
  const ts = await readFile(join(webRoot, "src", "Geoscape", "DogfightState.ts"), "utf8");
  const baseDefense = await readFile(join(webRoot, "src", "Geoscape", "BaseDefenseState.ts"), "utf8");
  const geoscape = await readFile(join(webRoot, "src", "Geoscape", "GeoscapeState.ts"), "utf8");
  const mod = await readFile(join(webRoot, "src", "Mod", "Mod.ts"), "utf8");
  const cppBlobs = extractNumbers(cpp, "const int DogfightState::_ufoBlobs[8][13][13]", "const int DogfightState::_projectileBlobs");
  const tsBlobs = extractNumbers(ts, "private static readonly _ufoBlobs = [", "  ];");
  if (cppBlobs.length !== 8 * 13 * 13 || tsBlobs.length !== cppBlobs.length) {
    throw new Error(`Dogfight blob dimensions mismatch: cpp=${cppBlobs.length}, ts=${tsBlobs.length}`);
  }
  const mismatch = cppBlobs.findIndex((value, index) => value !== tsBlobs[index]);
  if (mismatch !== -1) {
    throw new Error(`Dogfight blob mismatch at scalar ${mismatch}: cpp=${cppBlobs[mismatch]}, ts=${tsBlobs[mismatch]}`);
  }
  if (ts.includes("playGeoscapeSound(0)") || ts.includes("ufoBlobPixel(")) {
    throw new Error("DogfightState still has placeholder sound calls or radial blob helper");
  }
  for (const needle of [
    "playGeoscapeSound(this.game().getMod(), DOGFIGHT_SOUND_UFO_FIRE)",
    "playGeoscapeSound(this.game().getMod(), DOGFIGHT_SOUND_UFO_HIT)",
    "playGeoscapeSound(this.game().getMod(), DOGFIGHT_SOUND_INTERCEPTOR_HIT)",
    "playGeoscapeSound(this.game().getMod(), DOGFIGHT_SOUND_INTERCEPTOR_EXPLODE)",
    "playGeoscapeSound(this.game().getMod(), DOGFIGHT_SOUND_UFO_EXPLODE)",
    "playGeoscapeSound(this.game().getMod(), DOGFIGHT_SOUND_UFO_CRASH)"
  ]) {
    if (!ts.includes(needle)) {
      throw new Error(`DogfightState missing source-shaped sound call: ${needle}`);
    }
  }
  if (baseDefense.includes("Sound playback is not translated") || !baseDefense.includes("playGeoscapeSound(this.game().getMod(), \"GEO.CAT\", Mod.UFO_EXPLODE)")) {
    throw new Error("BaseDefenseState geoscape sound calls are not wired to Mod.");
  }
  if (!geoscape.includes("playMusic(\"GMGEO\", 1)") || !geoscape.includes("playMusic(\"GMGEO\")") || !geoscape.includes("playMusic(\"GMINTER\")")) {
    throw new Error("GeoscapeState init music paths are not source-shaped.");
  }
  if (!mod.includes("TextButton.soundPress = this.getSound(\"GEO.CAT\", Mod.BUTTON_PRESS, false)") || !mod.includes("Window.soundPopup[0] = this.getSound(\"GEO.CAT\", Mod.WINDOW_POPUP[0], false)")) {
    throw new Error("Mod loadExtraResources UI sound assignment is missing.");
  }
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
  line("- browser VERIFY_GEOSCAPE_CONFIRMATIONS");
  await mkdir(outputRoot, { recursive: true });
  await writeFile(verifierPath, baseDefenseVerifier, "utf8");

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
    const { stdout } = await run("playwright console", npm, [
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
    if (!stdout.includes("VERIFY_GEOSCAPE_CONFIRMATIONS ok") || stdout.includes("[ERROR]")) {
      throw new Error(`Browser verifier marker missing or console error present:\nrun-code stdout:\n${runCodeResult.stdout}\nconsole:\n${stdout}`);
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
  line("VERIFY_GEOSCAPE_CONFIRMATIONS");
  await run("build", process.execPath, [join(webRoot, "scripts", "build.mjs")]);
  await run("typecheck", npm, ["run", "typecheck"], webRoot);
  await checkDogfightSourceParity();
  await runBrowserVerifier();
  line("VERIFY_GEOSCAPE_CONFIRMATIONS ok");
}

await main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
