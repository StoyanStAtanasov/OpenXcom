import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, rm, writeFile } from "node:fs/promises";
import http from "node:http";
import { dirname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const webRoot = normalize(join(dirname(fileURLToPath(import.meta.url)), ".."));
const repoRoot = normalize(join(webRoot, ".."));
const outputRoot = join(repoRoot, "output", "playwright");
const verifierPath = join(outputRoot, "verify-debriefing.js");
const session = "openxcom-debriefing";
const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const url = "http://127.0.0.1:4173/web/index.html";

const verifier = String.raw`async page => {
  await page.goto("http://127.0.0.1:4173/web/index.html");
  await page.waitForFunction(() => document.readyState === "complete");
  await page.waitForFunction(() => window.openxcomGame?.getMod()?.getInventory?.("STR_GROUND"));

  const result = await page.evaluate(async () => {
    const [
      { DebriefingState },
      { BattleType },
      { UnitFaction, UnitStatus },
      { ItemContainer },
      { Vehicle },
      { Options },
      { SoldierRank },
      { SavedGame },
      { ManageAlienContainmentState },
      { SellState },
      { SaveType },
      { OPT_BATTLESCAPE }
    ] = await Promise.all([
      import("/web/dist/Battlescape/DebriefingState.js"),
      import("/web/dist/Mod/RuleItem.js"),
      import("/web/dist/Savegame/BattleUnit.js"),
      import("/web/dist/Savegame/ItemContainer.js"),
      import("/web/dist/Savegame/Vehicle.js"),
      import("/web/dist/Engine/Options.js"),
      import("/web/dist/Savegame/Soldier.js"),
      import("/web/dist/Savegame/SavedGame.js"),
      import("/web/dist/Basescape/ManageAlienContainmentState.js"),
      import("/web/dist/Basescape/SellState.js"),
      import("/web/dist/Menu/SaveGameState.js"),
      import("/web/dist/Menu/OptionsBaseState.js")
    ]);
    const assert = (condition, message) => {
      if (!condition) throw new Error(message);
    };

    const makeTrackedDiary = (baseScore = 0, manageResult = true) => {
      const stats = {
        getScoreTotal: _ => baseScore,
        awardPostMortemKill: kills => { stats.postMortemKills = kills; },
        awardBestOfRank: score => { stats.bestOfRank = score; },
        awardBestOverall: score => { stats.bestOverall = score; },
        updateDiary: () => { stats.updateDiaryCalls += 1; },
        manageCommendations: () => {
          ++stats.manageCommendationsCalls;
          return manageResult;
        }
      };
      stats.postMortemKills = 0;
      stats.bestOfRank = 0;
      stats.bestOverall = 0;
      stats.updateDiaryCalls = 0;
      stats.manageCommendationsCalls = 0;
      return stats;
    };

    const makeRule = (type, clipSize = 0, compatibleAmmo = [], options = {}) => ({
      getType: () => type,
      getName: () => options.name || type,
      getClipSize: () => clipSize,
      getCompatibleAmmo: () => compatibleAmmo,
      getBattleType: () => options.battleType ?? BattleType.BT_NONE,
      isRecoverable: () => options.recoverable ?? true,
      isFixed: () => options.fixed ?? false,
      getSpecialType: () => options.specialType ?? 0,
      getRecoveryPoints: () => options.recoveryPoints ?? 0,
      getRequirements: () => options.requirements || [],
      isAlien: () => options.isAlien ?? false,
      getSellCost: () => options.sellCost ?? 0
    });
    const rifle = makeRule("STR_RIFLE", 0);
    const tankNoAmmo = makeRule("STR_TANK_NO_AMMO", 10);
    const tankAmmoed = makeRule("STR_TANK_AMMOED", 6, ["STR_TANK_AMMO"]);
    const tankAmmo = makeRule("STR_TANK_AMMO", 2);
    const managedContainmentAlien = makeRule("STR_SECTOID", 0, [], { isAlien: true, sellCost: 125, recoveryPoints: 40 });
    const managedContainmentResearch = makeRule("STR_SECTOID_RESEARCH", 0, [], { isAlien: true });
    const managedContainmentCorpse = makeRule("STR_SECTOID_CORPSE", 0, [], { name: "STR_SECTOID_CORPSE", sellCost: 25, isAlien: false });
    const rules = new Map([
      [rifle.getType(), rifle],
      [tankNoAmmo.getType(), tankNoAmmo],
      [tankAmmoed.getType(), tankAmmoed],
      [tankAmmo.getType(), tankAmmo],
      [managedContainmentAlien.getType(), managedContainmentAlien],
      [managedContainmentResearch.getType(), managedContainmentResearch],
      [managedContainmentCorpse.getType(), managedContainmentCorpse]
    ]);

    const game = window.openxcomGame;
    const mod = game.getMod();
    const originalGetItem = mod.getItem.bind(mod);
    const originalGetUnit = mod.getUnit.bind(mod);
    const originalGetArmor = mod.getArmor.bind(mod);
    const originalGetResearch = mod.getResearch.bind(mod);
    const originalGetDeployment = mod.getDeployment.bind(mod);
    const originalGetItemsList = mod.getItemsList?.bind(mod);
    const originalPlayMusic = mod.playMusic.bind(mod);
    const originalSave = game.getSavedGame();
    const originalStates = [...game._states];
    const originalAutosave = Options.autosave;
    const originalStorageLimitsEnforced = Options.storageLimitsEnforced;
    const originalCanSellLiveAliens = Options.canSellLiveAliens;
    const originalFieldPromotions = Options.fieldPromotions;
    const originalGetSurface = mod.getSurface?.bind(mod);
    let playedMusic = null;
    mod.getItem = (type, error = false) => {
      const rule = rules.get(type) || null;
      if (!rule && error) throw new Error("missing fake rule " + type);
      return rule;
    };
    mod.getItemsList = () => Array.from(rules.keys());
    mod.getUnit = type => type === "STR_TANK_AMMOED" ? { getArmor: () => "STR_TANK_ARMOR" } : (type === "STR_SECTOID" ? { getArmor: () => "STR_SECTOID_ARMOR" } : null);
    mod.getArmor = type => type === "STR_TANK_ARMOR" ? { getSize: () => 2 } : (type === "STR_SECTOID_ARMOR" ? { getCorpseGeoscape: () => "STR_SECTOID_CORPSE" } : null);
    mod.getResearch = type => type === "STR_SECTOID" || type === "STR_SECTOID_RESEARCH" ? { getName: () => type } : null;
    mod.playMusic = (name, id = 0) => { playedMusic = { name, id }; };
    mod.getDeployment = type => type === "STR_TEST_MISSION"
      ? {
          getObjectiveCompleteInfo: () => ({ text: "STR_OBJECTIVE_COMPLETE_TEST", score: 55, hasInfo: true }),
          getObjectiveFailedInfo: () => ({ text: "STR_OBJECTIVE_FAILED_TEST", score: -40, hasInfo: true }),
          getEscapeType: () => 0,
          getNextStage: () => "",
          getObjectiveType: () => 0
        }
      : null;

    try {
      const baseItems = new ItemContainer();
      baseItems.load({
        STR_RIFLE: 3,
        STR_TANK_NO_AMMO: 1,
        STR_TANK_AMMOED: 2,
        STR_TANK_AMMO: 3
      });
      const craftItems = new ItemContainer();
      craftItems.load({ STR_RIFLE: 5 });
      const craftVehicles = [
        new Vehicle(tankNoAmmo, 10, 4),
        new Vehicle(tankNoAmmo, 10, 4),
        new Vehicle(tankAmmoed, 6, 4),
        new Vehicle(tankAmmoed, 6, 4)
      ];
      const base = { getStorageItems: () => baseItems };
      const craft = {
        getItems: () => craftItems,
        getVehicles: () => craftVehicles,
        getName: () => "SKYRANGER-1"
      };
      const state = new DebriefingState();
      state.reequipCraft(base, craft, true);

      const vehicles = craft.getVehicles();
      const missing = state._missingItems;
      assert(craftItems.getItem("STR_RIFLE") === 3, "craft item shortage was not removed from craft loadout");
      assert(baseItems.getItem("STR_RIFLE") === 0, "base rifles were not consumed");
      assert(vehicles.length === 2, "craft vehicles were not rebuilt from available stores/ammo");
      assert(vehicles.filter(vehicle => vehicle.getRules().getType() === "STR_TANK_NO_AMMO").length === 1, "no-ammo HWP re-add mismatch");
      const ammoed = vehicles.find(vehicle => vehicle.getRules().getType() === "STR_TANK_AMMOED");
      assert(ammoed, "ammoed HWP was not re-added");
      assert(ammoed.getAmmo() === 6, "ammoed HWP clip size mismatch");
      assert(ammoed.getSize() === 4, "ammoed HWP armor size mismatch");
      assert(baseItems.getItem("STR_TANK_NO_AMMO") === 0, "no-ammo HWP item not consumed");
      assert(baseItems.getItem("STR_TANK_AMMOED") === 1, "ammoed HWP item consumption mismatch");
      assert(baseItems.getItem("STR_TANK_AMMO") === 0, "ammo pack consumption mismatch");
      assert(missing.some(item => item.item === "STR_RIFLE" && item.qty === 2 && item.craft === "SKYRANGER-1"), "missing rifle stat absent");
      assert(missing.some(item => item.item === "STR_TANK_NO_AMMO" && item.qty === 1 && item.craft === "SKYRANGER-1"), "missing HWP stat absent");
      assert(missing.some(item => item.item === "STR_TANK_AMMO" && item.qty === 3 && item.craft === "SKYRANGER-1"), "missing HWP ammo stat absent");

      game.setSavedGame({ isResearched: requirements => Array.isArray(requirements) && requirements.length === 0 });
      const recoverBaseItems = new ItemContainer();
      const reused = [];
      const recoverBase = {
        getStorageItems: () => recoverBaseItems,
        getCrafts: () => [{ reuseItem: item => reused.push(item) }]
      };
      const fuelRule = makeRule("STR_ELERIUM_115", 0, [], { name: "STR_ELERIUM_115", recoveryPoints: 9 });
      const artifactRule = makeRule("STR_ALIEN_ARTIFACT", 0, [], { battleType: BattleType.BT_GRENADE, recoveryPoints: 5, requirements: ["STR_ALIEN_ARTIFACT_RESEARCH"] });
      const corpseRule = makeRule("STR_SECTOID_BODY", 0, [], { battleType: BattleType.BT_CORPSE, recoveryPoints: 12 });
      rules.set(corpseRule.getType(), corpseRule);
      const ammoRule = makeRule("STR_CLIP", 6, [], { battleType: BattleType.BT_AMMO });
      const weaponRule = makeRule("STR_WEAPON", 0, ["STR_CLIP"], { battleType: BattleType.BT_FIREARM, recoveryPoints: 4, requirements: ["STR_WEAPON_RESEARCH"] });
      const reusableRule = makeRule("STR_FUEL", 0, [], { battleType: BattleType.BT_NONE });
      const deadAlien = {
        getStatus: () => UnitStatus.STATUS_DEAD,
        getHealth: () => 0,
        getStunlevel: () => 0,
        getOriginalFaction: () => UnitFaction.FACTION_HOSTILE,
        getSpawnUnit: () => "",
        getType: () => "STR_SECTOID",
        getValue: () => 20,
        getArmor: () => ({ getCorpseGeoscape: () => "STR_SECTOID_CORPSE", getCorpseBattlescape: () => ["STR_SECTOID_BODY"] })
      };
      const item = (rule, options = {}) => ({
        getRules: () => rule,
        getXCOMProperty: () => options.xcom || false,
        getUnit: () => options.unit || null,
        getAmmoQuantity: () => options.ammoQty || 0,
        getAmmoItem: () => options.ammoItem || null
      });
      const clip = item(ammoRule, { ammoQty: 3 });
      const recoveryState = new DebriefingState();
      recoveryState.prepareDebriefing();
      recoveryState.recoverItems([
        item(fuelRule),
        item(artifactRule),
        item(corpseRule, { unit: deadAlien }),
        item(ammoRule, { ammoQty: 4 }),
        item(weaponRule, { ammoItem: clip }),
        item(reusableRule)
      ], recoverBase);

      const stat = (state, name) => state._stats.find(entry => entry.item === name);
      const liveUnit = (options = {}) => ({
        getStatus: () => UnitStatus.STATUS_UNCONSCIOUS,
        getHealth: () => 10,
        getStunlevel: () => 20,
        getOriginalFaction: () => UnitFaction.FACTION_HOSTILE,
        getSpawnUnit: () => options.spawnUnit || "",
        getType: () => options.type || "STR_SECTOID",
        getValue: () => options.value || 20,
        getArmor: () => ({
          getCorpseGeoscape: () => options.corpseGeo || "STR_SECTOID_CORPSE",
          getCorpseBattlescape: () => options.corpseBattle || ["STR_SECTOID_BODY"]
        })
      });
      const artifactStat = stat(recoveryState, "STR_ALIEN_ARTIFACTS_RECOVERED");
      assert(artifactStat.qty === 2 && artifactStat.score === 9, "artifact recovery stat mismatch " + JSON.stringify(artifactStat));
      assert(stat(recoveryState, "STR_ELERIUM_115").qty === 50 && stat(recoveryState, "STR_ELERIUM_115").score === 9, "alien fuel recovery stat mismatch");
      assert(stat(recoveryState, "STR_ALIEN_CORPSES_RECOVERED").qty === 1 && stat(recoveryState, "STR_ALIEN_CORPSES_RECOVERED").score === 12, "corpse recovery stat mismatch");
      assert(recoverBaseItems.getItem("STR_ALIEN_ARTIFACT") === 1, "artifact was not returned to base stores");
      assert(recoverBaseItems.getItem("STR_SECTOID_CORPSE") === 1, "corpse geoscape item was not returned to base stores");
      assert(recoverBaseItems.getItem("STR_WEAPON") === 1, "firearm was not returned to base stores");
      assert(recoverBaseItems.getItem("STR_CLIP") === 0, "ammo clip should be counted as rounds, not stored directly");
      assert(recoverBaseItems.getItem("STR_FUEL") === 1, "BT_NONE item was not returned to base stores");
      assert(reused.includes("STR_FUEL"), "BT_NONE recovery did not notify craft reuseItem");
      assert(recoveryState._rounds.get(ammoRule) === 7, "round aggregation mismatch");

      const fallbackItems = new ItemContainer();
      const fallbackBase = {
        getStorageItems: () => fallbackItems,
        getAvailableContainment: () => 0,
        getUsedContainment: () => 0
      };
      game.setSavedGame({ getMonthsPassed: () => 0, isResearched: () => false, getSavedBattle: () => null });
      const fallbackState = new DebriefingState();
      fallbackState.prepareDebriefing();
      fallbackState.recoverAlien(liveUnit(), fallbackBase);
      assert(fallbackState._noContainment === true, "no-containment flag not set");
      assert(stat(fallbackState, "STR_ALIEN_CORPSES_RECOVERED").qty === 1 && stat(fallbackState, "STR_ALIEN_CORPSES_RECOVERED").score === 12, "no-containment corpse fallback stat mismatch");
      assert(fallbackItems.getItem("STR_SECTOID_CORPSE") === 1, "no-containment corpse fallback item not stored");
      assert(fallbackItems.getItem("STR_SECTOID") === 0, "no-containment path stored live alien");

      const containmentItems = new ItemContainer();
      const containmentBase = {
        getStorageItems: () => containmentItems,
        getAvailableContainment: () => 1,
        getUsedContainment: () => 2
      };
      game.setSavedGame({ getMonthsPassed: () => 0, isResearched: () => false, getSavedBattle: () => null });
      const containmentState = new DebriefingState();
      containmentState._limitsEnforced = 1;
      containmentState.prepareDebriefing();
      containmentState.recoverAlien(liveUnit({ value: 20 }), containmentBase);
      assert(stat(containmentState, "STR_LIVE_ALIENS_RECOVERED").qty === 1 && stat(containmentState, "STR_LIVE_ALIENS_RECOVERED").score === 40, "live alien research score mismatch");
      assert(containmentItems.getItem("STR_SECTOID") === 1, "live alien was not stored in containment");
      assert(containmentState._manageContainment === true, "overfull containment flag not set");
      const manageContainmentCtorItems = new ItemContainer();
      manageContainmentCtorItems.load({ STR_SECTOID: 2 });
      const manageContainmentCtorBase = {
        getStorageItems: () => manageContainmentCtorItems,
        getResearch: () => [
          { getRules: () => ({ getName: () => "STR_SECTOID" }) },
          { getRules: () => ({ getName: () => "STR_SECTOID_RESEARCH" }) }
        ],
        getFreeContainment: () => 1,
        getUsedContainment: () => 2,
        getName: () => "BASE_ALPHA"
      };
      const manageContainmentCtorState = new ManageAlienContainmentState(manageContainmentCtorBase, OPT_BATTLESCAPE);
      assert(JSON.stringify(manageContainmentCtorState._aliens) === JSON.stringify(["STR_SECTOID", "STR_SECTOID_RESEARCH"]), "containment ctor alien row ids mismatch " + JSON.stringify(manageContainmentCtorState._aliens));
      assert(manageContainmentCtorState._lstAliens.getTexts() === 2, "containment ctor did not include both stored and research-only aliens");

      let convertedFaction = null;
      let convertedSpawn = null;
      game.setSavedGame({
        getSavedBattle: () => ({
          convertUnit: unit => {
            convertedSpawn = unit.getSpawnUnit();
            return { convertToFaction: faction => { convertedFaction = faction; } };
          }
        }),
        getMonthsPassed: () => 0,
        isResearched: () => false
      });
      const spawnState = new DebriefingState();
      spawnState.recoverAlien(liveUnit({ spawnUnit: "STR_CHRYSSALID" }), fallbackBase);
      assert(convertedSpawn === "STR_CHRYSSALID", "spawn-unit conversion did not call SavedBattleGame.convertUnit");
      assert(convertedFaction === UnitFaction.FACTION_PLAYER, "spawn-unit conversion did not convert new unit to player faction");
      assert(spawnState._noContainment === false, "spawn-unit conversion continued into containment path");

      const missionBaseItems = new ItemContainer();
      const missionCraftItems = new ItemContainer();
      let craftReturned = false;
      let craftMissionComplete = false;
      let craftInBattlescape = true;
      const missionCraft = {
        isInBattlescape: () => craftInBattlescape,
        getLongitude: () => 0,
        getLatitude: () => 0,
        getDestination: () => ({
          getType: () => "STR_TEST_SITE",
          getMarkerName: () => "STR_TEST_SITE_",
          getMarkerId: () => 7
        }),
        returnToBase: () => { craftReturned = true; },
        setMissionComplete: value => { craftMissionComplete = value; },
        setInBattlescape: value => { craftInBattlescape = value; },
        getItems: () => missionCraftItems,
        getVehicles: () => [],
        getName: () => "SKYRANGER-2",
        getRules: () => ({ getScore: () => 100 })
      };
      const missionBase = {
        getCrafts: () => [missionCraft],
        isInBattlescape: () => false,
        getStorageItems: () => missionBaseItems,
        getVehicles: () => []
      };
        const rankName = {
          [SoldierRank.RANK_ROOKIE]: "STR_ROOKIE",
          [SoldierRank.RANK_SQUADDIE]: "STR_SQUADDIE",
          [SoldierRank.RANK_SERGEANT]: "STR_SERGEANT",
          [SoldierRank.RANK_CAPTAIN]: "STR_CAPTAIN",
          [SoldierRank.RANK_COLONEL]: "STR_COLONEL",
          [SoldierRank.RANK_COMMANDER]: "STR_COMMANDER"
        };
        const makeTrackedSoldier = ({ id, name, rank, woundRecovery = 0, diary }) => ({
          getId: () => id,
          getName: () => name,
          getRank: () => rank,
          getRankString: () => rankName[rank],
          getDiary: () => diary,
          getWoundRecovery: () => woundRecovery,
          getCurrentStats: () => ({ tu: 12, stamina: 13, health: 14, bravery: 15, reactions: 16, firing: 17, throwing: 18, strength: 19, psiStrength: 20, psiSkill: 21, melee: 22 }),
          getInitStats: () => ({ tu: 10, stamina: 10, health: 10, bravery: 10, reactions: 10, firing: 10, throwing: 10, strength: 10, psiStrength: 10, psiSkill: 10, melee: 10 }),
          calcStatString: () => {}
        });
        const liveSoldierDiary = makeTrackedDiary(3, true);
        const liveSoldier = makeTrackedSoldier({
          id: 101,
          name: "ALPHA",
          rank: SoldierRank.RANK_CAPTAIN,
          woundRecovery: 3,
          diary: liveSoldierDiary
        });
        const deadBestSoldierDiary = makeTrackedDiary(5, true);
        const deadBestSoldier = makeTrackedSoldier({
          id: 201,
          name: "BRAVO",
          rank: SoldierRank.RANK_SERGEANT,
          woundRecovery: 2,
          diary: deadBestSoldierDiary
        });
        const deadKiaSoldierDiary = makeTrackedDiary(12, false);
        const deadKiaSoldier = makeTrackedSoldier({
          id: 202,
          name: "CHARLIE",
          rank: SoldierRank.RANK_SERGEANT,
          woundRecovery: 1,
          diary: deadKiaSoldierDiary
        });
        const unitStats = options => ({
          kills: options.kills || [],
          loneSurvivor: false,
          ironMan: false,
          KIA: options.KIA || false,
          MIA: options.MIA || false
        });
        const battleUnit = options => {
          const stats = unitStats(options);
          return {
            getOriginalFaction: () => options.oldFaction,
            getFaction: () => options.faction ?? options.oldFaction,
            getStatus: () => options.status,
            getStunlevel: () => options.stun ?? 0,
            getHealth: () => options.health ?? 10,
            isInExitArea: point => options.exitArea === point,
            instaKill: () => { options.status = UnitStatus.STATUS_DEAD; },
            getValue: () => options.value ?? 0,
            getId: () => options.id ?? 0,
            getTile: () => ({}),
            getPosition: () => ({ equals: () => false }),
            setTile: () => {},
            killedBy: () => options.killedBy ?? UnitFaction.FACTION_HOSTILE,
            updateGeoscapeStats: () => { options.updated = true; },
            getStatistics: () => stats,
            getMurdererId: () => options.murdererId ?? -1,
            getInventory: () => [],
            postMissionProcedures: (_save, statIncrease) => { statIncrease.tu = 1; return true; },
            getGeoscapeSoldier: () => options.soldier || null,
            getType: () => options.type || "STR_TEST_UNIT",
            getItem: () => null,
            isOut: () => false
          };
        };
        const livePlayer = battleUnit({
          oldFaction: UnitFaction.FACTION_PLAYER,
          status: UnitStatus.STATUS_STANDING,
          exitArea: 1,
          value: 40,
          id: 101,
          soldier: liveSoldier,
          faction: UnitFaction.FACTION_PLAYER,
          kills: [{ id: 201, turn: 2, faction: UnitFaction.FACTION_HOSTILE, status: UnitStatus.STATUS_DEAD }]
        });
        const deadBestSoldierUnit = battleUnit({
          oldFaction: UnitFaction.FACTION_PLAYER,
          status: UnitStatus.STATUS_DEAD,
          id: 201,
          soldier: deadBestSoldier,
          faction: UnitFaction.FACTION_PLAYER,
          value: 0,
          KIA: false,
          MIA: false,
          kills: [{ id: 301, turn: 3, faction: UnitFaction.FACTION_HOSTILE, status: UnitStatus.STATUS_DEAD }]
        });
        const deadKiaSoldierUnit = battleUnit({
          oldFaction: UnitFaction.FACTION_PLAYER,
          status: UnitStatus.STATUS_DEAD,
          id: 202,
          soldier: deadKiaSoldier,
          faction: UnitFaction.FACTION_PLAYER,
          value: 0,
          KIA: true,
          MIA: false,
          kills: []
        });
        const deadAlienUnit = battleUnit({
          oldFaction: UnitFaction.FACTION_HOSTILE,
          status: UnitStatus.STATUS_DEAD,
          killedBy: UnitFaction.FACTION_PLAYER,
          value: 20,
          id: 203
        });
        const savedCivilian = battleUnit({
          oldFaction: UnitFaction.FACTION_NEUTRAL,
          status: UnitStatus.STATUS_STANDING,
          value: 30,
          id: 301
        });
        const missionBattle = {
          getMissionType: () => "STR_TEST_MISSION",
          isAborted: () => false,
          allObjectivesDestroyed: () => false,
          getUnits: () => [livePlayer, deadBestSoldierUnit, deadKiaSoldierUnit, deadAlienUnit, savedCivilian],
          getItems: () => [],
          getTiles: () => [],
          getMapSizeXYZ: () => 0,
          getConditionalRecoveredItems: () => [],
          getGuaranteedRecoveredItems: () => [],
          getModuleMap: () => [],
          getGlobalShade: () => 4
        };
        let savedBattleForMission = missionBattle;
        const missionStatistics = [];
        let missionPromotionsParticipants = [];
        const missionSave = {
          getSavedBattle: () => savedBattleForMission,
          setSavedBattle: battle => { savedBattleForMission = battle; },
          getTime: () => ({ clone: () => ({ cloned: true }) }),
          getBases: () => [missionBase],
          getRegions: () => [],
          getCountries: () => [],
          getUfos: () => [],
          getMissionSites: () => [],
          getAlienBases: () => [],
          getAlienMissions: () => [],
          findAlienMission: () => null,
          getMonthsPassed: () => 0,
          getMissionStatistics: () => missionStatistics,
          getSoldier: id => {
            switch (id) {
            case 101:
              return liveSoldier;
            case 201:
              return deadBestSoldier;
            case 202:
              return deadKiaSoldier;
            default:
              return null;
            }
          },
          getDeadSoldiers: () => [deadBestSoldier, deadKiaSoldier],
          setBattleGame: () => {},
          handlePromotions: participants => {
            missionPromotionsParticipants = participants.map(soldier => soldier.getId());
            return true;
          },
          killSoldier: () => -1,
          isResearched: requirements => Array.isArray(requirements) && requirements.length === 0
        };
        game.setSavedGame(missionSave);
        const missionState = new DebriefingState();
        missionState.init();
        const missionStat = name => missionState._stats.find(entry => entry.item === name);
        assert(craftReturned && craftMissionComplete && craftInBattlescape === false, "craft battlescape completion flags not applied");
        assert(missionState._missionStatistics.type === "STR_TEST_MISSION", "mission type not recorded");
        assert(missionState._missionStatistics.success === true, "mission success not recorded");
        assert(missionStatistics.length === 1 && missionStatistics[0] === missionState._missionStatistics, "mission statistics were not pushed to save");
        assert(missionState._missionStatistics.id === 0 && missionState._missionStatistics.daylight === 4, "mission statistics id/daylight mismatch");
        assert(missionState._missionStatistics.score === 105 && missionState._missionStatistics.rating === "STR_RATING_OK", "mission statistics score/rating mismatch");
        assert(missionState._missionStatistics.valiantCrux === true, "valiant crux was not marked for flawless civilian save");
        assert(missionState._missionStatistics.injuryList.get(101) === 3, "injury list was not recorded");
        assert(savedBattleForMission === null, "saved battle was not cleared after final mission-stat commit");
        assert(playedMusic?.name === "GMMARS", "debriefing music was not requested");
        assert(missionState._missionStatistics.markerName === "STR_TEST_SITE_" && missionState._missionStatistics.markerId === 7, "mission marker not recorded");
        assert(missionState._base === missionBase, "mission base not retained");
        assert(missionStat("STR_ALIENS_KILLED").qty === 1 && missionStat("STR_ALIENS_KILLED").score === 20, "dead hostile unit stat mismatch");
        assert(missionStat("STR_CIVILIANS_SAVED").qty === 1 && missionStat("STR_CIVILIANS_SAVED").score === 30, "civilian saved stat mismatch");
        assert(missionStat("STR_OBJECTIVE_COMPLETE_TEST").qty === 1 && missionStat("STR_OBJECTIVE_COMPLETE_TEST").score === 55, "objective-complete stat mismatch");
        assert(missionState._soldierStats.length === 1 && missionState._soldierStats[0].name === "ALPHA" && missionState._soldierStats[0].stats.tu === 1, "soldier post-mission stats not captured");
        assert(deadBestSoldierDiary.postMortemKills === 1, "post-mortem kill award was not recorded on diary");
        assert(deadKiaSoldierDiary.bestOfRank === missionState._missionStatistics.score + 12, "best-of-rank diary award was not applied");
        assert(deadKiaSoldierDiary.bestOverall === missionState._missionStatistics.score + 12, "best-overall diary award was not applied");
        assert(liveSoldierDiary.updateDiaryCalls + deadBestSoldierDiary.updateDiaryCalls + deadKiaSoldierDiary.updateDiaryCalls === 3, "diary updates were not run for all geoscape soldiers");
        assert(liveSoldierDiary.manageCommendationsCalls + deadBestSoldierDiary.manageCommendationsCalls + deadKiaSoldierDiary.manageCommendationsCalls === 3, "commendation checks were not run for each geoscape soldier");
        assert(missionState._soldiersCommended.map(soldier => soldier.getId()).includes(101), "live commended soldier was not pushed to _soldiersCommended");
        assert(missionState._deadSoldiersCommended.map(soldier => soldier.getId()).includes(202), "KIA soldier was not pushed to _deadSoldiersCommended");
        assert(missionState._promotions === true, "promotion result was not propagated from handlePromotions");
        assert(JSON.stringify(missionPromotionsParticipants) === JSON.stringify([101, 201, 202]), "handlePromotions participants did not match battle geoscape soldiers");

        const makePromotionSoldier = (rank, score) => {
          let currentRank = rank;
          return {
            getRank: () => currentRank,
            promoteRank: () => { currentRank = Math.min(SoldierRank.RANK_COMMANDER, currentRank + 1); },
            getCurrentStats: () => ({ tu: score, stamina: score, health: score, bravery: score, reactions: score, firing: score, throwing: score, strength: score, psiStrength: 0, psiSkill: 0, melee: score }),
            getMissions: () => 0,
            getKills: () => 0
          };
        };
        const promotionSave = new SavedGame();
        const promotionParticipant = makePromotionSoldier(SoldierRank.RANK_SQUADDIE, 1);
        const promotionNonParticipant = makePromotionSoldier(SoldierRank.RANK_SQUADDIE, 50);
        promotionSave._bases = [{
          getSoldiers: () => [
            promotionNonParticipant,
            promotionParticipant,
            makePromotionSoldier(SoldierRank.RANK_ROOKIE, 1),
            makePromotionSoldier(SoldierRank.RANK_ROOKIE, 1),
            makePromotionSoldier(SoldierRank.RANK_ROOKIE, 1)
          ],
          getTransfers: () => []
        }];
        Options.fieldPromotions = true;
        assert(promotionSave.handlePromotions([promotionParticipant]) === true, "field promotion quota did not promote a participant");
        assert(promotionParticipant.getRank() === SoldierRank.RANK_SERGEANT, "field promotions did not restrict promotion to battle participant");
        assert(promotionNonParticipant.getRank() === SoldierRank.RANK_SQUADDIE, "field promotions promoted a nonparticipant");
        Options.fieldPromotions = originalFieldPromotions;

      const debriefFollowSaveBase = new ItemContainer();
      debriefFollowSaveBase.load({ STR_SECTOID: 3, STR_RIFLE: 12 });
      const debriefFollowBase = {
        getStorageItems: () => debriefFollowSaveBase,
        getResearch: () => [],
        getName: () => "BASE_FOLLOW",
        storesOverfull: () => true,
        getUsedStores: () => 40,
        getAvailableStores: () => 12,
        getSoldiers: () => [],
        getCrafts: () => [],
        getTransfers: () => [],
        getAvailableScientists: () => 0,
        getAvailableEngineers: () => 0,
        getFreeContainment: () => 4,
        getUsedContainment: () => 1
      };
      const storageLimitsFollowSave = {
        getFunds: () => 0,
        setFunds: () => {},
        getMonthsPassed: () => 0,
        isIronman: () => false,
        isResearched: () => false
      };
      game.setSavedGame(storageLimitsFollowSave);
      const storageLimitsFollowState = new DebriefingState();
      storageLimitsFollowState._base = debriefFollowBase;
      storageLimitsFollowState._manageContainment = false;
      storageLimitsFollowState._destroyBase = false;
      game._states = [storageLimitsFollowState];
      Options.storageLimitsEnforced = true;
      Options.autosave = true;
      storageLimitsFollowState.btnOkClick();
      const storageLimitsFollowStack = game._states.map(state => state.constructor.name);
      assert(storageLimitsFollowStack[0] === "SellState", "storage-overfull follow-up should open SellState first");
      assert(storageLimitsFollowStack[1] === "ErrorMessageState", "storage-overfull follow-up should open storage error second");
      assert(storageLimitsFollowStack[2] === "SaveGameState", "storage-overfull follow-up should queue autosave");
      assert(storageLimitsFollowStack[2] === "SaveGameState" && game._states[2]._type === SaveType.SAVE_AUTO_GEOSCAPE, "storage-overfull follow-up did not queue autosave save type");
      const storageLimitsErrorMessage = game._states[1]._txtMessage?.getText?.() || "";
      assert(storageLimitsErrorMessage.length > 0, "storage-overfull follow-up should include error message");

      const ironmanManageBase = {
        getStorageItems: () => {
          const storage = new ItemContainer();
          storage.load({ STR_SECTOID: 1 });
          return storage;
        },
        getResearch: () => [
          { getRules: () => ({ getName: () => "STR_SECTOID" }) }
        ],
        getFreeContainment: () => 4,
        getUsedContainment: () => 1,
        getName: () => "BASE_MANAGE",
        getUsedStores: () => 0,
        getAvailableStores: () => 10,
        getSoldiers: () => [],
        getCrafts: () => [],
        getTransfers: () => [],
        getAvailableScientists: () => 0,
        getAvailableEngineers: () => 0,
        storesOverfull: () => false
      };
      const ironmanFollowSave = {
        getFunds: () => 0,
        setFunds: () => {},
        getMonthsPassed: () => 0,
        isIronman: () => true,
        isResearched: () => false
      };
      game.setSavedGame(ironmanFollowSave);
      const ironmanManageFollowState = new DebriefingState();
      ironmanManageFollowState._base = ironmanManageBase;
      ironmanManageFollowState._manageContainment = true;
      ironmanManageFollowState._destroyBase = false;
      game._states = [ironmanManageFollowState];
      Options.autosave = false;
      ironmanManageFollowState.btnOkClick();
      const ironmanManageFollowStack = game._states.map(state => state.constructor.name);
      assert(ironmanManageFollowStack[0] === "ManageAlienContainmentState", "manage-containment follow-up should open ManageAlienContainmentState first");
      assert(ironmanManageFollowStack[1] === "ErrorMessageState", "manage-containment follow-up should open containment error second");
      assert(ironmanManageFollowStack[2] === "SaveGameState", "manage-containment follow-up should queue SaveGameState");
      assert(game._states[2]._type === SaveType.SAVE_IRONMAN, "manage-containment follow-up did not queue ironman save");
      assert((game._states[1]._txtMessage?.getText?.() || "").length > 0, "containment follow-up should include error message");

      const directManageBaseItems = new ItemContainer();
      directManageBaseItems.load({ STR_SECTOID: 2 });
      let directContainmentOverfull = false;
      const directGetSurface = [];
      const directManageBase = {
        getStorageItems: () => directManageBaseItems,
        getResearch: () => [],
        getFreeContainment: () => 4,
        getUsedContainment: () => 0,
        getName: () => "BASE_DIRECT",
        storesOverfull: () => directContainmentOverfull,
        getUsedStores: () => 8,
        getAvailableStores: () => 10,
        getSoldiers: () => [],
        getCrafts: () => [],
        getTransfers: () => [],
        getAvailableScientists: () => 0,
        getAvailableEngineers: () => 0
      };
      const directManageSaveFunds = { value: 500 };
      const directManageSave = {
        getMonthsPassed: () => 0,
        getFunds: () => directManageSaveFunds.value,
        setFunds: value => { directManageSaveFunds.value = value; },
        isResearched: () => false
      };
      game.setSavedGame(directManageSave);
      Options.canSellLiveAliens = false;
      const directManageNoSell = new ManageAlienContainmentState(directManageBase, OPT_BATTLESCAPE);
      directManageNoSell._sel = 0;
      directManageNoSell._qtys[0] = 1;
      game._states = [directManageNoSell];
      directManageNoSell.btnOkClick();
      assert(directManageBaseItems.getItem("STR_SECTOID") === 1, "manage-containment should remove one live alien");
      assert(directManageBaseItems.getItem("STR_SECTOID_CORPSE") === 1, "manage-containment without sell should convert removed alien to corpse");
      assert(directManageSaveFunds.value === 500, "manage-containment without sell should not add funds");
      mod.getSurface = name => {
        directGetSurface.push(name);
        return originalGetSurface ? originalGetSurface(name) : null;
      };
      const directManageFunds = { value: 500 };
      const directManageSaveForSell = {
        getMonthsPassed: () => 0,
        getFunds: () => directManageFunds.value,
        setFunds: value => { directManageFunds.value = value; },
        isResearched: () => false
      };
      game.setSavedGame(directManageSaveForSell);
      directManageBaseItems.load({ STR_SECTOID: 2 });
      directContainmentOverfull = true;
      Options.canSellLiveAliens = true;
      const directManageSell = new ManageAlienContainmentState(directManageBase, OPT_BATTLESCAPE);
      directManageSell._sel = 0;
      directManageSell._qtys[0] = 1;
      game._states = [directManageSell];
      directManageSell.btnOkClick();
      const directManageSellStack = game._states.map(state => state.constructor.name);
      assert(directManageSellStack[0] === "SellState", "manage-containment sell path should push SellState when overfull");
      assert(directManageSellStack[1] === "ErrorMessageState", "manage-containment sell path should push storage error");
      assert(directManageFunds.value === 500 + managedContainmentAlien.getSellCost(), "manage-containment sell path should add sell cost");
      assert(directGetSurface.includes("BACK01.SCR"), "manage-containment sell path should request BACK01.SCR for battlescape storage warning");

      const attachPersistenceContainment = base => {
        base.setMod(mod);
        base.getAvailableContainment = () => 1;
        base.getUsedContainment = () => base.getStorageItems().getItem("STR_SECTOID") + base.getResearch().length;
        base.getFreeContainment = () => base.getAvailableContainment() - base.getUsedContainment();
        base.storesOverfull = () => false;
      };
      const addInterrogationProject = base => {
        base.getResearch().push({
          getRules: () => ({ getName: () => "STR_SECTOID_RESEARCH" }),
          getAssigned: () => 1,
          setAssigned: () => {},
          isFinished: () => false,
          save: () => ({ project: "STR_SECTOID_RESEARCH", assigned: 1, spent: 3, cost: 10 })
        });
      };
      const runLiveAlienPersistenceChain = (filename, canSell) => {
        const save = new SavedGame();
        save.setName(filename);
        save.setMonthsPassed(0);
        save.setFunds(500);
        const base = save.getBases()[0];
        base.setName("BASE_PERSIST");
        base.getStorageItems().load({});
        base.setScientists(7);
        base.setEngineers(3);
        addInterrogationProject(base);
        attachPersistenceContainment(base);

        game.setSavedGame(save);
        Options.canSellLiveAliens = canSell;
        Options.storageLimitsEnforced = true;
        Options.autosave = false;
        const debrief = new DebriefingState();
        debrief._limitsEnforced = 1;
        debrief.prepareDebriefing();
        debrief._base = base;
        debrief.recoverAlien(liveUnit({ value: 20 }), base);
        assert(debrief._manageContainment === true, "live alien persistence chain did not request containment management");
        game._states = [debrief];
        debrief.btnOkClick();
        const manage = game._states.find(state => state.constructor.name === "ManageAlienContainmentState");
        assert(manage, "live alien persistence chain did not push ManageAlienContainmentState");
        const alienRow = manage._aliens.indexOf("STR_SECTOID");
        assert(alienRow !== -1, "live alien persistence chain did not list stored alien");
        manage._sel = alienRow;
        manage.increaseByValue(1);
        game._states = [manage];
        manage.btnOkClick();
        save.save(filename);
        const reloaded = new SavedGame();
        reloaded.load(filename, mod);
        return { reloaded, original: save };
      };

      const noSellPersistence = runLiveAlienPersistenceChain("verify_live_alien_nosell.sav", false);
      const noSellBase = noSellPersistence.reloaded.getBases()[0];
      assert(noSellBase.getStorageItems().getItem("STR_SECTOID") === 0, "no-sell persistence kept live alien after manage containment");
      assert(noSellBase.getStorageItems().getItem("STR_SECTOID_CORPSE") === 1, "no-sell persistence did not round-trip corpse conversion");
      assert(noSellPersistence.reloaded.getFunds() === 500, "no-sell persistence should keep funds unchanged");
      assert(noSellBase.getResearch().some(project => project.getRules().getName() === "STR_SECTOID_RESEARCH" && project.getAssigned() === 1), "interrogation research did not round-trip through SavedGame load/save");

      const sellPersistence = runLiveAlienPersistenceChain("verify_live_alien_sell.sav", true);
      const sellBase = sellPersistence.reloaded.getBases()[0];
      assert(sellBase.getStorageItems().getItem("STR_SECTOID") === 0, "sell persistence kept live alien after manage containment");
      assert(sellBase.getStorageItems().getItem("STR_SECTOID_CORPSE") === 0, "sell persistence incorrectly created a corpse");
      assert(sellPersistence.reloaded.getFunds() === 500 + managedContainmentAlien.getSellCost(), "sell persistence did not round-trip funds from live alien sale");

        const medalSoldier = {
          getName: () => "BRAVO",
          getRankString: () => "STR_SERGEANT",
          getDiary: () => ({
            getKillTotal: () => 4,
            getSoldierCommendations: () => []
          })
        };
      const followSave = {
        getMonthsPassed: () => 0,
        isIronman: () => false,
        getName: () => "follow",
        getBases: () => []
      };
      game.setSavedGame(followSave);
      Options.autosave = true;
      const followState = new DebriefingState();
      followState._deadSoldiersCommended = [medalSoldier];
      followState._soldiersCommended = [medalSoldier];
      followState._promotions = true;
      followState._missingItems = [{ item: "STR_RIFLE", qty: 1, craft: "SKYRANGER-3" }];
      followState._base = { storesOverfull: () => false };
      followState._destroyBase = false;
      followState._manageContainment = false;
      game._states = [followState];
      followState.btnOkClick();
      const followStack = game._states.map(state => state.constructor.name);
      assert(JSON.stringify(followStack) === JSON.stringify([
        "CommendationLateState",
        "CommendationState",
        "PromotionsState",
        "CannotReequipState",
        "SaveGameState"
      ]), "OK follow-up stack order mismatch " + JSON.stringify(followStack));

      return {
        craftItems: Object.fromEntries(craftItems.getContents()),
        baseItems: Object.fromEntries(baseItems.getContents()),
        vehicles: vehicles.map(vehicle => ({ type: vehicle.getRules().getType(), ammo: vehicle.getAmmo(), size: vehicle.getSize() })),
        missing,
        recovered: Object.fromEntries(recoverBaseItems.getContents()),
        rounds: recoveryState._rounds.get(ammoRule),
        alienRecovery: {
          corpseFallback: Object.fromEntries(fallbackItems.getContents()),
          liveAlien: Object.fromEntries(containmentItems.getContents()),
          manageContainment: containmentState._manageContainment,
          convertedSpawn,
          convertedFaction,
          missionStats: {
            aliensKilled: missionStat("STR_ALIENS_KILLED"),
            civiliansSaved: missionStat("STR_CIVILIANS_SAVED"),
            objectiveComplete: missionStat("STR_OBJECTIVE_COMPLETE_TEST"),
            soldierRows: missionState._soldierStats.length,
            pushedMissionStats: missionStatistics.length,
            rating: missionState._missionStatistics.rating,
            music: playedMusic,
            followStack
          }
        }
      };
    } finally {
      game.setSavedGame(originalSave);
      game._states = originalStates;
      Options.autosave = originalAutosave;
      Options.fieldPromotions = originalFieldPromotions;
      Options.storageLimitsEnforced = originalStorageLimitsEnforced;
      Options.canSellLiveAliens = originalCanSellLiveAliens;
      mod.getItem = originalGetItem;
      mod.getUnit = originalGetUnit;
      mod.getArmor = originalGetArmor;
      mod.getResearch = originalGetResearch;
      mod.getDeployment = originalGetDeployment;
      mod.getItemsList = originalGetItemsList || (() => []);
      mod.playMusic = originalPlayMusic;
      if (originalGetSurface) {
        mod.getSurface = originalGetSurface;
      }
    }
  });

  await page.evaluate(value => console.log("VERIFY_DEBRIEFING ok " + JSON.stringify(value)), result);
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
  line("- browser VERIFY_DEBRIEFING");
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
    if (!stdout.includes("VERIFY_DEBRIEFING ok") || stdout.includes("[ERROR]")) {
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
    server?.kill();
  }
}

async function main() {
  line("VERIFY_DEBRIEFING");
  await run("build", process.execPath, [join(webRoot, "scripts", "build.mjs")]);
  await run("typecheck", npm, ["run", "typecheck"], webRoot);
  await runBrowserVerifier();
  line("VERIFY_DEBRIEFING ok");
}

await main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
