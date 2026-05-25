import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, rm, writeFile } from "node:fs/promises";
import http from "node:http";
import { dirname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const webRoot = normalize(join(dirname(fileURLToPath(import.meta.url)), ".."));
const repoRoot = normalize(join(webRoot, ".."));
const outputRoot = join(repoRoot, "output", "playwright");
const verifierPath = join(outputRoot, "verify-saveconverter-metadata.js");
const session = "openxcom-saveconverter-metadata";
const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const url = "http://127.0.0.1:4173/web/index.html";

const verifier = String.raw`async page => {
  await page.goto("http://127.0.0.1:4173/web/index.html");
  await page.waitForFunction(() => document.readyState === "complete");
  await page.waitForFunction(() => {
    const mod = window.openxcomGame?.getMod?.();
    const converter = mod?.getConverter?.();
    return converter?.getOffset?.("BASE.DAT_FACILITIES") === 0x16 &&
      mod?.getCraft?.(converter.getCrafts?.()[0]) &&
      mod?.getUfo?.(converter.getUfos?.()[0]) &&
      mod?.getDeployment?.("STR_ALIEN_BASE_ASSAULT") &&
      mod?.getDeployment?.("STR_TERROR_MISSION") &&
      mod?.getAlienMission?.("STR_ALIEN_TERROR");
  });

  const result = await page.evaluate(async () => {
    const [{ Mod }, { SaveConverter }, { SavedGame }, { SavedBattleGame }, { BattleItem }, { UnitStatus }, { MovementType }, { UnitWalkBState }, { UnitFallBState }, { Position }, { MissionObjective }, { ListLoadOriginalState }, { OPT_GEOSCAPE }, { Options }, { BattleActionType }, { ChronoTrigger }, { TilePart }, { TileEngine }] = await Promise.all([
      import("/web/dist/Mod/Mod.js"),
      import("/web/dist/Savegame/SaveConverter.js"),
      import("/web/dist/Savegame/SavedGame.js"),
      import("/web/dist/Savegame/SavedBattleGame.js"),
      import("/web/dist/Savegame/BattleItem.js"),
      import("/web/dist/Savegame/BattleUnit.js"),
      import("/web/dist/Mod/Armor.js"),
      import("/web/dist/Battlescape/UnitWalkBState.js"),
      import("/web/dist/Battlescape/UnitFallBState.js"),
      import("/web/dist/Battlescape/Position.js"),
      import("/web/dist/Mod/RuleAlienMission.js"),
      import("/web/dist/Menu/ListLoadOriginalState.js"),
      import("/web/dist/Menu/OptionsBaseState.js"),
      import("/web/dist/Engine/Options.js"),
      import("/web/dist/Battlescape/BattleAction.js"),
      import("/web/dist/Mod/AlienDeployment.js"),
      import("/web/dist/Mod/MapData.js"),
      import("/web/dist/Battlescape/TileEngine.js")
    ]);

    const assert = (condition, message) => {
      if (!condition) {
        throw new Error(message);
      }
    };

    const game = window.openxcomGame;
    assert(game, "openxcomGame is missing");
    const mod = game.getMod();
    assert(mod, "openxcomGame.getMod() is missing");
    assert(typeof Mod === "function", "Mod export from /web/dist/Mod/Mod.js is missing");
    assert(typeof mod.getConverter === "function", "Mod.getConverter() is missing; converter metadata is not exposed");
    const converter = mod.getConverter();
    assert(converter, "Mod.getConverter() returned null");
    assert(typeof converter.getOffset === "function", "RuleConverter.getOffset() is missing");
    assert(typeof converter.getMarkers === "function", "RuleConverter.getMarkers() is missing");
    assert(typeof converter.getCountries === "function", "RuleConverter.getCountries() is missing");
    assert(typeof converter.getItems === "function", "RuleConverter.getItems() is missing");
    assert(Array.isArray(converter.getMarkers()), "RuleConverter.getMarkers() did not return an array");
    assert(Array.isArray(converter.getCountries()), "RuleConverter.getCountries() did not return an array");
    assert(Array.isArray(converter.getItems()), "RuleConverter.getItems() did not return an array");

    const converterData = {
      baseFacilitiesOffset: converter.getOffset("BASE.DAT_FACILITIES"),
      craftDamageOffset: converter.getOffset("CRAFT.DAT_DAMAGE"),
      firstMarker: converter.getMarkers()[0],
      hasUSA: converter.getCountries().includes("STR_USA"),
      hasElerium: converter.getItems().includes("STR_ELERIUM_115")
    };
    assert(converterData.baseFacilitiesOffset === 0x16, "Unexpected BASE.DAT_FACILITIES offset: " + converterData.baseFacilitiesOffset);
    assert(converterData.craftDamageOffset === 0x0A, "Unexpected CRAFT.DAT_DAMAGE offset: " + converterData.craftDamageOffset);
    assert(converterData.firstMarker === "STR_UFO", "First converter marker was not STR_UFO");
    assert(converterData.hasUSA, "STR_USA is missing from converter countries");
    assert(converterData.hasElerium, "STR_ELERIUM_115 is missing from converter items");

    const saveConverter = new SaveConverter(1, mod);
    assert(saveConverter, "SaveConverter constructor returned null/undefined");
    assert(saveConverter._mod === mod, "SaveConverter did not store the provided Mod");
    assert(typeof saveConverter.loadOriginal === "function", "SaveConverter.loadOriginal() is missing");
    if (typeof saveConverter._rules === "object" && saveConverter._rules !== null) {
      assert(saveConverter._rules === converter, "SaveConverter _rules field did not match Mod.getConverter()");
    }

    const path = "browser://localStorage/openxcom/saves/GAME_1/";
    const toBase64 = bytes => {
      let text = "";
      for (let i = 0; i < bytes.length; ++i) {
        text += String.fromCharCode(bytes[i]);
      }
      return btoa(text);
    };
    const putDat = (name, bytes) => localStorage.setItem(path + name, toBase64(bytes));
    const writeI32 = (bytes, offset, value) => new DataView(bytes.buffer).setInt32(offset, value, true);
    const writeU16 = (bytes, offset, value) => new DataView(bytes.buffer).setUint16(offset, value, true);
    const writeS16 = (bytes, offset, value) => new DataView(bytes.buffer).setInt16(offset, value, true);
    const writeCString = (bytes, offset, value) => {
      for (let i = 0; i < value.length; ++i) {
        bytes[offset + i] = value.charCodeAt(i);
      }
      bytes[offset + value.length] = 0;
    };
    const expectReject = async (promise, text, message) => {
      let caught = "";
      try {
        await promise;
      } catch (error) {
        caught = error instanceof Error ? error.message : String(error);
      }
      assert(caught.includes(text), message + ": " + caught);
    };

    await expectReject(SaveConverter.importOriginalFiles([{
      name: "README.TXT",
      webkitRelativePath: "README.TXT",
      arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer
    }], game.getLanguage()), "No GAME_# original save files found", "Importing unrelated files should report a no-op original-save import");
    await expectReject(SaveConverter.importOriginalFiles([{
      name: "XCOM.DAT",
      webkitRelativePath: "GAME_8/XCOM.DAT",
      arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer
    }], game.getLanguage()), "GAME_8/SAVEINFO.DAT not found", "Importing GAME_# without SAVEINFO.DAT should report the source-required save header");
    await expectReject(SaveConverter.importOriginalFiles([{
      name: "SAVEINFO.DAT",
      webkitRelativePath: "GAME_7/SAVEINFO.DAT",
      arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer
    }], game.getLanguage()), "GAME_7/SAVEINFO.DAT is invalid", "Importing corrupt SAVEINFO.DAT should report the invalid source header");

    const importedSaveInfo = new Uint8Array(0x28);
    writeCString(importedSaveInfo, 0x02, "IMPORTED");
    writeU16(importedSaveInfo, 0x1c, 1998);
    writeU16(importedSaveInfo, 0x1e, 2);
    writeU16(importedSaveInfo, 0x20, 13);
    writeU16(importedSaveInfo, 0x22, 23);
    writeU16(importedSaveInfo, 0x24, 5);
    importedSaveInfo[0x26] = 1;
    await SaveConverter.importOriginalFiles([{
      name: "SAVEINFO.DAT",
      webkitRelativePath: "GAME_9/SAVEINFO.DAT",
      arrayBuffer: async () => importedSaveInfo.buffer
    }], game.getLanguage());
    const importedList = SaveConverter.getList(game.getLanguage());
    assert(importedList[8].id === 9, "Imported original save slot id mismatch");
    assert(importedList[8].name === "IMPORTED", "Imported SAVEINFO.DAT name mismatch");
    assert(importedList[8].time === "23:05", "Imported SAVEINFO.DAT time mismatch");
    assert(importedList[8].tactical, "Imported SAVEINFO.DAT tactical flag mismatch");
    assert(localStorage.getItem(path.replace("GAME_1/", "GAME_9/") + "SAVEINFO.DAT"), "Imported SAVEINFO.DAT was not stored in SaveConverter binary path");

    const entries = converter.getCountries().length + converter.getRegions().length;
    const xcom = new Uint8Array(entries * 12 * 4);
    const alien = new Uint8Array(entries * 12 * 4);
    for (let i = 0; i < entries * 12; ++i) {
      writeI32(xcom, i * 4, 1000 + i);
      writeI32(alien, i * 4, 2000 + i);
    }
    putDat("XCOM.DAT", xcom);
    putDat("ALIEN.DAT", alien);

    const diplom = new Uint8Array(converter.getCountries().length * 36);
    writeS16(diplom, 0x02, 2);
    for (let month = 0; month < 12; ++month) {
      writeS16(diplom, 0x04 + month * 2, 10 + month);
    }
    writeS16(diplom, 0x1e, 1);
    putDat("DIPLOM.DAT", diplom);

    const lease = new Uint8Array(16);
    writeS16(lease, 0x00, 16);
    writeS16(lease, 0x06, -32);
    writeS16(lease, 0x0c, 180);
    putDat("LEASE.DAT", lease);

    const liglob = new Uint8Array(0x94);
    writeI32(liglob, 0, 777000);
    for (let month = 0; month < 12; ++month) {
      writeI32(liglob, 0x04 + month * 4, 100 + month);
      writeI32(liglob, 0x34 + month * 4, 200 + month);
      writeI32(liglob, 0x64 + month * 4, 300 + month);
    }
    putDat("LIGLOB.DAT", liglob);

    const uiglob = new Uint8Array(0x40);
    writeU16(uiglob, 0x00, 42);
    writeU16(uiglob, 0x16, 1999);
    for (let month = 0; month < 12; ++month) {
      writeS16(uiglob, 0x18 + month * 2, 500 + month);
    }
    putDat("UIGLOB.DAT", uiglob);

    const iglob = new Uint8Array(0x40);
    writeI32(iglob, 0x00, 3);
    writeI32(iglob, 0x04, 1);
    writeI32(iglob, 0x08, 9);
    writeI32(iglob, 0x0c, 10);
    writeI32(iglob, 0x10, 11);
    writeI32(iglob, 0x14, 12);
    writeI32(iglob, 0x3c, 2);
    putDat("IGLOB.DAT", iglob);

    const strategyRegionIndex = 0;
    const strategyRegionName = converter.getRegions()[strategyRegionIndex];
    const strategyMissionEntry = converter.getMissions()
      .map((name, index) => ({ name, index, rule: name ? mod.getAlienMission(name) : null }))
      .find(entry => entry.rule && entry.rule.getObjective() !== MissionObjective.OBJECTIVE_SITE);
    assert(strategyMissionEntry, "Need a non-site alien mission for MISSIONS.DAT fixture");
    const strategyRaceIndex = Math.max(0, converter.getCrews().findIndex(name => name && name.length > 0));
    const strategyRaceName = converter.getCrews()[strategyRaceIndex];
    const zonal = new Uint8Array(12);
    zonal[strategyRegionIndex] = 11;
    putDat("ZONAL.DAT", zonal);
    const acts = new Uint8Array(12 * 7);
    acts[strategyRegionIndex * 7 + strategyMissionEntry.index] = 22;
    putDat("ACTS.DAT", acts);
    const missionsDat = new Uint8Array(12 * 7 * 8);
    missionsDat.fill(0xff);
    const strategyMissionDatOffset = (strategyRegionIndex * 7 + strategyMissionEntry.index) * 8;
    writeU16(missionsDat, strategyMissionDatOffset + 0x00, 7);
    writeU16(missionsDat, strategyMissionDatOffset + 0x02, 2);
    writeU16(missionsDat, strategyMissionDatOffset + 0x04, 4);
    writeU16(missionsDat, strategyMissionDatOffset + 0x06, strategyRaceIndex);
    putDat("MISSIONS.DAT", missionsDat);
    const zonalOnlyConverter = new SaveConverter(1, mod);
    zonalOnlyConverter._save = new SavedGame();
    zonalOnlyConverter.loadDatZonal();
    assert(zonalOnlyConverter._save.getAlienStrategy().save().regions?.[strategyRegionName] === 11, "Converted ZONAL.DAT region chance mismatch");

    const locEntrySize = 20;
    const loc = new Uint8Array(50 * locEntrySize);
    const writeLoc = (index, type, dat, lon, lat, timer, id, visibility = 0) => {
      const offset = index * locEntrySize;
      loc[offset] = type;
      loc[offset + 0x01] = dat;
      writeS16(loc, offset + 0x02, lon);
      writeS16(loc, offset + 0x04, lat);
      writeS16(loc, offset + 0x06, timer);
      writeS16(loc, offset + 0x0a, id);
      writeI32(loc, offset + 0x10, visibility);
    };
    writeLoc(0, 3, 0, 8, -16, 0, 11);
    writeLoc(1, 7, 0, 24, 32, 0, 77);
    writeLoc(2, 4, 0, 40, 48, 0, 88);
    writeLoc(3, 8, 0, 56, 64, 2, 99, 1);
    writeLoc(4, 2, 1, 72, 80, 0, 123);
    writeLoc(5, 1, 2, 96, 104, 3, 124);
    putDat("LOC.DAT", loc);

    const facilityOffset = converter.getOffset("BASE.DAT_FACILITIES");
    const itemsOffset = converter.getOffset("BASE.DAT_ITEMS");
    const baseEntrySize = itemsOffset + converter.getItems().length * 2 + 2;
    const baseDat = new Uint8Array(baseEntrySize * 8);
    for (let base = 0; base < 8; ++base) {
      const offset = base * baseEntrySize;
      for (let slot = 0; slot < 36; ++slot) {
        baseDat[offset + facilityOffset + slot] = 0xff;
      }
    }
    writeCString(baseDat, 0, "ALPHA");
    baseDat[facilityOffset + 7] = 1;
    baseDat[facilityOffset + 36 + 7] = 12;
    baseDat[converter.getOffset("BASE.DAT_ENGINEERS")] = 6;
    baseDat[converter.getOffset("BASE.DAT_SCIENTISTS")] = 7;
    const eleriumIndex = converter.getItems().indexOf("STR_ELERIUM_115");
    assert(eleriumIndex !== -1, "STR_ELERIUM_115 converter item missing for BASE.DAT fixture");
    writeU16(baseDat, itemsOffset + eleriumIndex * 2, 9);
    putDat("BASE.DAT", baseDat);

    const astore = new Uint8Array(24);
    astore[0x00] = 1;
    astore[0x01] = 1;
    astore[0x02] = 0;
    putDat("ASTORE.DAT", astore);

    const craftEntrySize = 128;
    const craftDat = new Uint8Array(50 * craftEntrySize);
    for (let i = 0; i < 50; ++i) {
      craftDat[i * craftEntrySize] = 0xff;
    }
    const craftOffset = craftEntrySize;
    craftDat[craftOffset] = converter.getCrafts().indexOf("STR_INTERCEPTOR");
    craftDat[craftOffset + converter.getOffset("CRAFT.DAT_LEFT_WEAPON")] = 0;
    writeU16(craftDat, craftOffset + converter.getOffset("CRAFT.DAT_LEFT_AMMO"), 4);
    craftDat[craftOffset + converter.getOffset("CRAFT.DAT_FLIGHT")] = 1;
    craftDat[craftOffset + converter.getOffset("CRAFT.DAT_RIGHT_WEAPON")] = 0xff;
    craftDat[craftOffset + converter.getOffset("CRAFT.DAT_RIGHT_AMMO")] = 0;
    writeU16(craftDat, craftOffset + converter.getOffset("CRAFT.DAT_DAMAGE"), 12);
    writeU16(craftDat, craftOffset + converter.getOffset("CRAFT.DAT_SPEED"), 900);
    writeU16(craftDat, craftOffset + converter.getOffset("CRAFT.DAT_DESTINATION"), 1);
    writeU16(craftDat, craftOffset + converter.getOffset("CRAFT.DAT_FUEL"), 500);
    writeU16(craftDat, craftOffset + converter.getOffset("CRAFT.DAT_BASE"), 0);
    writeU16(craftDat, craftOffset + converter.getOffset("CRAFT.DAT_STATUS"), 1);
    craftDat[craftOffset + converter.getOffset("CRAFT.DAT_ITEMS")] = 1;
    craftDat[craftOffset + converter.getOffset("CRAFT.DAT_ITEMS") + 5] = 2;
    writeI32(craftDat, craftOffset + converter.getOffset("CRAFT.DAT_STATE"), 1 << 1);
    const ufoOffset = 2 * craftEntrySize;
    craftDat[ufoOffset] = 5;
    writeU16(craftDat, ufoOffset + converter.getOffset("CRAFT.DAT_DAMAGE"), 0);
    writeU16(craftDat, ufoOffset + converter.getOffset("CRAFT.DAT_ALTITUDE"), 0);
    writeU16(craftDat, ufoOffset + converter.getOffset("CRAFT.DAT_SPEED"), 1000);
    writeS16(craftDat, ufoOffset + converter.getOffset("CRAFT.DAT_DEST_LON"), 120);
    writeS16(craftDat, ufoOffset + converter.getOffset("CRAFT.DAT_DEST_LAT"), -80);
    writeU16(craftDat, ufoOffset + converter.getOffset("CRAFT.DAT_MISSION"), 0);
    writeU16(craftDat, ufoOffset + converter.getOffset("CRAFT.DAT_REGION"), 0);
    writeU16(craftDat, ufoOffset + converter.getOffset("CRAFT.DAT_RACE"), 0);
    writeU16(craftDat, ufoOffset + converter.getOffset("CRAFT.DAT_TRAJECTORY"), 0);
    writeU16(craftDat, ufoOffset + converter.getOffset("CRAFT.DAT_TRAJECTORY_POINT"), 1);
    writeI32(craftDat, ufoOffset + converter.getOffset("CRAFT.DAT_STATE"), 1 << 6);
    putDat("CRAFT.DAT", craftDat);

    const soldierEntrySize = 80;
    const soldierDat = new Uint8Array(250 * soldierEntrySize);
    for (let i = 0; i < 250; ++i) {
      writeU16(soldierDat, i * soldierEntrySize + converter.getOffset("SOLDIER.DAT_RANK"), 0xffff);
    }
    const writeSoldier = (index, name, baseIndex, craftIndex, rank, idSeed) => {
      const offset = index * soldierEntrySize;
      writeU16(soldierDat, offset + converter.getOffset("SOLDIER.DAT_RANK"), rank);
      writeU16(soldierDat, offset + converter.getOffset("SOLDIER.DAT_BASE"), baseIndex);
      writeU16(soldierDat, offset + converter.getOffset("SOLDIER.DAT_CRAFT"), craftIndex);
      writeS16(soldierDat, offset + converter.getOffset("SOLDIER.DAT_MISSIONS"), 3 + idSeed);
      writeS16(soldierDat, offset + converter.getOffset("SOLDIER.DAT_KILLS"), 4 + idSeed);
      writeS16(soldierDat, offset + converter.getOffset("SOLDIER.DAT_RECOVERY"), idSeed === 0 ? 5 : 0);
      writeCString(soldierDat, offset + converter.getOffset("SOLDIER.DAT_NAME"), name);
      soldierDat[offset + converter.getOffset("SOLDIER.DAT_INITIAL_TU")] = 50 + idSeed;
      soldierDat[offset + converter.getOffset("SOLDIER.DAT_INITIAL_HE")] = 40 + idSeed;
      soldierDat[offset + converter.getOffset("SOLDIER.DAT_INITIAL_STA")] = 60 + idSeed;
      soldierDat[offset + converter.getOffset("SOLDIER.DAT_INITIAL_RE")] = 30 + idSeed;
      soldierDat[offset + converter.getOffset("SOLDIER.DAT_INITIAL_STR")] = 20 + idSeed;
      soldierDat[offset + converter.getOffset("SOLDIER.DAT_INITIAL_FA")] = 45 + idSeed;
      soldierDat[offset + converter.getOffset("SOLDIER.DAT_INITIAL_TA")] = 35 + idSeed;
      soldierDat[offset + converter.getOffset("SOLDIER.DAT_INITIAL_ME")] = 10 + idSeed;
      soldierDat[offset + converter.getOffset("SOLDIER.DAT_INITIAL_PST")] = 70 + idSeed;
      soldierDat[offset + converter.getOffset("SOLDIER.DAT_INITIAL_PSK")] = 0;
      soldierDat[offset + converter.getOffset("SOLDIER.DAT_INITIAL_BR")] = 6;
      soldierDat[offset + converter.getOffset("SOLDIER.DAT_IMPROVED_TU")] = 1;
      soldierDat[offset + converter.getOffset("SOLDIER.DAT_IMPROVED_HE")] = 2;
      soldierDat[offset + converter.getOffset("SOLDIER.DAT_IMPROVED_STA")] = 3;
      soldierDat[offset + converter.getOffset("SOLDIER.DAT_IMPROVED_RE")] = 4;
      soldierDat[offset + converter.getOffset("SOLDIER.DAT_IMPROVED_STR")] = 5;
      soldierDat[offset + converter.getOffset("SOLDIER.DAT_IMPROVED_FA")] = 6;
      soldierDat[offset + converter.getOffset("SOLDIER.DAT_IMPROVED_TA")] = 7;
      soldierDat[offset + converter.getOffset("SOLDIER.DAT_IMPROVED_ME")] = 8;
      soldierDat[offset + converter.getOffset("SOLDIER.DAT_IMPROVED_BR")] = 2;
      soldierDat[offset + converter.getOffset("SOLDIER.DAT_ARMOR")] = 0;
      soldierDat[offset + converter.getOffset("SOLDIER.DAT_PSI")] = 9 + idSeed;
      soldierDat[offset + converter.getOffset("SOLDIER.DAT_PSILAB")] = idSeed === 0 ? 1 : 0;
      soldierDat[offset + converter.getOffset("SOLDIER.DAT_GENDER")] = idSeed % 2;
      soldierDat[offset + converter.getOffset("SOLDIER.DAT_LOOK")] = 2 + idSeed;
    };
    writeSoldier(0, "ALPHA SOLDIER", 0, 4, 2, 0);
    writeSoldier(1, "TRANSFER SOLDIER", 0xffff, 0xffff, 1, 1);
    putDat("SOLDIER.DAT", soldierDat);

    const transferDat = new Uint8Array(8 * 6);
    const writeTransfer = (index, baseSrc, baseDest, hours, type, dat, qty) => {
      const offset = index * 8;
      transferDat[offset + 0x00] = baseSrc;
      transferDat[offset + 0x01] = baseDest;
      transferDat[offset + 0x02] = hours;
      transferDat[offset + 0x03] = type;
      transferDat[offset + 0x04] = dat;
      transferDat[offset + 0x06] = qty;
    };
    writeTransfer(0, 0xff, 0, 12, 0, eleriumIndex, 3);
    writeTransfer(1, 0xff, 0, 13, 3, 0, 4);
    writeTransfer(2, 0xff, 0, 14, 4, 0, 5);
    writeTransfer(3, 0xff, 0, 15, 1, 0, 1);
    writeTransfer(4, 0xff, 0, 16, 2, 1, 1);
    writeTransfer(5, 0xff, 0, 17, 5, 0, 1);
    putDat("TRANSFER.DAT", transferDat);

    const researchEntries = converter.getResearch()
      .map((name, index) => ({ name, index, rule: name ? mod.getResearch(name) : null }))
      .filter(entry => entry.rule && entry.rule.getCost() > 0);
    assert(researchEntries.length >= 3, "Need at least three nonzero-cost converter research entries for original-save fixture");
    const finishedEntry = researchEntries.find(entry => entry.rule.getUnlocked().length === 0) || researchEntries[0];
    const poppedEntry = researchEntries.find(entry => entry.name !== finishedEntry.name) || researchEntries[1];
    const projectEntry = researchEntries.find(entry => entry.name !== finishedEntry.name && entry.name !== poppedEntry.name) || researchEntries[2];
    const projectSpent = Math.max(0, Math.min(7, projectEntry.rule.getCost() - 1));
    const projectRemaining = projectEntry.rule.getCost() - projectSpent;
    const projectScientists = 3;

    const manufactureEntries = converter.getManufacture()
      .map((name, index) => ({ name, index, rule: name ? mod.getManufacture(name) : null }))
      .filter(entry => entry.rule);
    const productionEntry = manufactureEntries.find(entry => entry.rule.getManufactureTime() > 0) || manufactureEntries[0];
    assert(productionEntry, "Need a converter manufacture entry for BPROD.DAT fixture");
    const productionEngineers = 2;
    const productionTotal = 4;
    const productionProduced = 1;
    const productionRemaining = Math.max(1, productionEntry.rule.getManufactureTime() - 3);

    const zeroCostResearchEntry = mod.getResearchList()
      .map(name => ({ name, rule: mod.getResearch(name) }))
      .find(entry => entry.rule &&
        entry.rule.getCost() === 0 &&
        entry.rule.getRequirements().length > 0 &&
        !finishedEntry.rule.getUnlocked().includes(entry.name));
    assert(zeroCostResearchEntry, "Need a zero-cost research rule for UP.DAT fixture");
    const upEntry = converter.getUfopaedia()
      .map((name, index) => ({ name, index, article: name ? mod.getUfopaediaArticle(name) : null, zeroCostRequirements: [zeroCostResearchEntry.name] }))
      .find(entry => entry.article && entry.article.section !== "STR_NOT_AVAILABLE");
    assert(upEntry, "Need a discovered Ufopaedia article for UP.DAT fixture");
    if (!upEntry.article._requires.includes(zeroCostResearchEntry.name)) {
      upEntry.article._requires = [...upEntry.article._requires, zeroCostResearchEntry.name];
    }

    const researchDat = new Uint8Array(converter.getResearch().length * 0x20);
    researchDat[finishedEntry.index * 0x20 + 0x0a] = 1;
    researchDat[poppedEntry.index * 0x20 + 0x12] = 1;
    putDat("RESEARCH.DAT", researchDat);

    const upDat = new Uint8Array(converter.getUfopaedia().length * 0x20);
    upDat[upEntry.index * 0x20 + 0x08] = 2;
    putDat("UP.DAT", upDat);

    const projectDat = new Uint8Array(converter.getResearch().length * 3);
    writeU16(projectDat, projectEntry.index * 2, projectRemaining);
    projectDat[converter.getResearch().length * 2 + projectEntry.index] = projectScientists;
    putDat("PROJECT.DAT", projectDat);

    const bprodDat = new Uint8Array(converter.getManufacture().length * 10);
    writeI32(bprodDat, productionEntry.index * 4, productionRemaining);
    writeU16(bprodDat, converter.getManufacture().length * 4 + productionEntry.index * 2, productionEngineers);
    writeU16(bprodDat, converter.getManufacture().length * 6 + productionEntry.index * 2, productionTotal);
    writeU16(bprodDat, converter.getManufacture().length * 8 + productionEntry.index * 2, productionProduced);
    putDat("BPROD.DAT", bprodDat);

    const xbasesDat = new Uint8Array(12 * 4);
    writeU16(xbasesDat, 0x00, 1);
    writeU16(xbasesDat, 0x02, 0);
    putDat("XBASES.DAT", xbasesDat);

    const loaded = saveConverter.loadOriginal();
    assert(loaded.getName() === "GAME_1", "Converted save name mismatch");
    assert(loaded.getCountries().length === converter.getCountries().length, "Converted country count mismatch");
    assert(loaded.getRegions().length === converter.getRegions().length, "Converted region count mismatch");
    assert(loaded.getBases().length === 1, "Converted base count mismatch");
    const base = loaded.getBases()[0];
    assert(base.getName() === "ALPHA", "Converted BASE.DAT name mismatch");
    assert(Math.abs(base.getLongitude() - (8 * 0.125 * Math.PI / 180)) < 1e-9, "Converted base longitude mismatch");
    assert(Math.abs(base.getLatitude() - (-16 * 0.125 * Math.PI / 180)) < 1e-9, "Converted base latitude mismatch");
    assert(base.getEngineers() === 6 - productionEngineers && base.getScientists() === 7 - projectScientists, "Converted base personnel/project allocation mismatch");
    assert(base.getFacilities().length === 1, "Converted base facility count mismatch");
    assert(base.getFacilities()[0].getRules().getType() === converter.getFacilities()[1], "Converted base facility rule mismatch");
    assert(base.getFacilities()[0].getX() === 1 && base.getFacilities()[0].getY() === 1 && base.getFacilities()[0].getBuildTime() === 12, "Converted base facility placement/build time mismatch");
    assert(base.getStorageItems().getItem("STR_ELERIUM_115") === 9, "Converted BASE.DAT item quantity mismatch");
    assert(base.getStorageItems().getItem("STR_SECTOID_COMMANDER") === 1, "Converted ASTORE.DAT live alien mismatch");
    assert(base.getCrafts().length === 1, "Converted CRAFT.DAT base craft count mismatch");
    const craft = base.getCrafts()[0];
    assert(craft.getType() === "STR_INTERCEPTOR" && craft.getId() === 123, "Converted CRAFT.DAT craft rule/id mismatch");
    assert(craft.getBase() === base, "Converted CRAFT.DAT craft base link mismatch");
    assert(craft.getDestination() === loaded.getWaypoints()[0], "Converted CRAFT.DAT craft destination mismatch");
    assert(craft.getStatus() === "STR_OUT" && craft.getLowFuel(), "Converted CRAFT.DAT status/lowFuel mismatch");
    assert(craft.getDamage() === 12 && craft.getFuel() === 500, "Converted CRAFT.DAT damage/fuel mismatch");
    assert(craft.getSpeed() === craft.getRules().getMaxSpeed(), "Converted CRAFT.DAT outbound craft speed mismatch");
    assert(craft.getWeapons()[0]?.getRules().getType() === "STR_STINGRAY" && craft.getWeapons()[0]?.getAmmo() === 4, "Converted CRAFT.DAT left weapon mismatch");
    assert(craft.getWeapons()[1] === null, "Converted CRAFT.DAT right weapon mismatch");
    assert(craft.getVehicles().length === 1 && craft.getVehicles()[0].getRules().getType() === "STR_TANK_CANNON", "Converted CRAFT.DAT vehicle mismatch");
    assert(craft.getItems().getItem("STR_PISTOL") === 2, "Converted CRAFT.DAT item cargo mismatch");
    assert(loaded.getUfos().length === 1, "Converted CRAFT.DAT UFO count mismatch");
    const ufo = loaded.getUfos()[0];
    assert(ufo.getRules().getType() === "STR_SMALL_SCOUT" && ufo.getId() === 124, "Converted CRAFT.DAT UFO rule/id mismatch");
    assert(ufo.getAltitude() === "STR_GROUND" && ufo.getSecondsRemaining() === 15, "Converted CRAFT.DAT UFO altitude/timer mismatch");
    assert(ufo.getHyperDetected(), "Converted CRAFT.DAT UFO hyper-detected flag mismatch");
    assert(ufo.getTrajectory()?.getID?.() === "P0" && ufo.getTrajectoryPoint() === 1, "Converted CRAFT.DAT UFO trajectory mismatch");
    assert(loaded.getAlienMissions().length >= 1 && ufo.getMission()?.getRules?.().getType?.() === converter.getMissions()[0], "Converted CRAFT.DAT UFO mission linkage mismatch");
    const strategyNode = loaded.getAlienStrategy().save();
    const actsEntry = strategyNode.possibleMissions?.find(entry => entry.region === strategyRegionName);
    assert(actsEntry?.missions?.[strategyMissionEntry.name] === 22, "Converted ACTS.DAT mission chance mismatch");
    const strategyMissionNode = loaded.getAlienMissions()
      .map(mission => mission.save())
      .find(node => node.type === strategyMissionEntry.name && node.region === strategyRegionName && node.race === strategyRaceName);
    assert(strategyMissionNode, "Converted MISSIONS.DAT alien mission missing");
    assert(strategyMissionNode.nextWave === 7, "Converted MISSIONS.DAT nextWave mismatch");
    assert(strategyMissionNode.nextUfoCounter === 2, "Converted MISSIONS.DAT nextUfoCounter mismatch");
    assert(strategyMissionNode.spawnCountdown === 120, "Converted MISSIONS.DAT spawn countdown mismatch");
    assert(strategyMissionNode.missionSiteZone === -1, "Converted MISSIONS.DAT non-site mission zone mismatch");
    assert(base.getSoldiers().length === 1, "Converted SOLDIER.DAT base soldier count mismatch");
    const soldier = base.getSoldiers()[0];
    assert(soldier.getName() === "ALPHA SOLDIER" && soldier.getRank() === 2, "Converted SOLDIER.DAT name/rank mismatch");
    assert(soldier.getCraft() === craft, "Converted SOLDIER.DAT craft link mismatch");
    assert(soldier.getMissions() === 3 && soldier.getKills() === 4 && soldier.getWoundRecovery() === 5, "Converted SOLDIER.DAT missions/kills/recovery mismatch");
    assert(soldier.getInitStats().tu === 50 && soldier.getCurrentStats().tu === 51, "Converted SOLDIER.DAT TU stats mismatch");
    assert(soldier.getInitStats().bravery === 50 && soldier.getCurrentStats().bravery === 70, "Converted SOLDIER.DAT bravery stats mismatch");
    assert(soldier.isInPsiTraining() && soldier.getImprovement() === 9 && soldier.getGender() === 0 && soldier.getLook() === 2, "Converted SOLDIER.DAT psi/gender/look mismatch");
    assert(base.getTransfers().length === 6, "Converted TRANSFER.DAT transfer count mismatch");
    assert(base.getTransfers()[0].getType() === 0 && base.getTransfers()[0].getItems() === "STR_ELERIUM_115" && base.getTransfers()[0].getQuantity() === 3 && base.getTransfers()[0].getHours() === 12, "Converted TRANSFER.DAT item transfer mismatch");
    assert(base.getTransfers()[1].getType() === 3 && base.getTransfers()[1].getQuantity() === 4, "Converted TRANSFER.DAT scientist transfer mismatch");
    assert(base.getTransfers()[2].getType() === 4 && base.getTransfers()[2].getQuantity() === 5, "Converted TRANSFER.DAT engineer transfer mismatch");
    assert(base.getTransfers()[3].getType() === 1 && base.getTransfers()[3].getCraft()?.getType() === converter.getCrafts()[0], "Converted TRANSFER.DAT new craft transfer mismatch");
    assert(base.getTransfers()[4].getType() === 2 && base.getTransfers()[4].getSoldier()?.getName() === "TRANSFER SOLDIER", "Converted TRANSFER.DAT soldier transfer mismatch");
    assert(base.getTransfers()[5].getType() === 0 && base.getTransfers()[5].getItems() === "STR_SECTOID_COMMANDER" && base.getTransfers()[5].getQuantity() === 1, "Converted TRANSFER.DAT alien transfer mismatch");
    assert(loaded.isResearched(finishedEntry.name, false), "Converted RESEARCH.DAT finished research mismatch");
    assert(loaded.wasResearchPopped(poppedEntry.rule), "Converted RESEARCH.DAT popped research mismatch");
    for (const requirement of upEntry.zeroCostRequirements) {
      assert(loaded.isResearched(requirement, false), "Converted UP.DAT zero-cost Ufopaedia requirement missing: " + requirement);
    }
    const researchProject = base.getResearch().find(project => project.getRules().getName() === projectEntry.name);
    assert(researchProject, "Converted PROJECT.DAT research project missing");
    assert(researchProject.getAssigned() === projectScientists, "Converted PROJECT.DAT assigned scientists mismatch");
    assert(researchProject.getSpent() === projectSpent, "Converted PROJECT.DAT spent research mismatch");
    const productionProject = base.getProductions().find(production => production.getRules().getName() === productionEntry.name);
    assert(productionProject, "Converted BPROD.DAT production project missing");
    assert(productionProject.getAssignedEngineers() === productionEngineers, "Converted BPROD.DAT assigned engineers mismatch");
    assert(productionProject.getAmountTotal() === productionTotal, "Converted BPROD.DAT total quantity mismatch");
    assert(productionProject.getTimeSpent() === productionProduced * productionEntry.rule.getManufactureTime() + productionEntry.rule.getManufactureTime() - productionRemaining, "Converted BPROD.DAT time spent mismatch");
    assert(base.getRetaliationTarget(), "Converted XBASES.DAT retaliation target mismatch");
    assert(loaded.getWaypoints().length === 1 && loaded.getWaypoints()[0].getId() === 77, "Converted LOC.DAT waypoint mismatch");
    assert(loaded.getAlienBases().length === 1, "Converted LOC.DAT alien base count mismatch");
    assert(loaded.getAlienBases()[0].getId() === 88 && loaded.getAlienBases()[0].getAlienRace() === converter.getCrews()[0] && loaded.getAlienBases()[0].isDiscovered(), "Converted LOC.DAT alien base mismatch");
    assert(loaded.getMissionSites().length === 1, "Converted LOC.DAT mission site count mismatch");
    assert(loaded.getMissionSites()[0].getId() === 99 && loaded.getMissionSites()[0].getAlienRace() === converter.getCrews()[0], "Converted LOC.DAT mission site id/race mismatch");
    assert(loaded.getMissionSites()[0].getSecondsRemaining() === 7200 && !loaded.getMissionSites()[0].getDetected(), "Converted LOC.DAT mission timer/detected mismatch");
    assert(loaded.getTime().getYear() === 1999 && loaded.getTime().getMonth() === 4 && loaded.getTime().getDay() === 9, "Converted game date mismatch");
    assert(loaded.getTime().getWeekday() === 2 && loaded.getTime().getHour() === 10 && loaded.getTime().getMinute() === 11 && loaded.getTime().getSecond() === 12, "Converted game time mismatch");
    assert(loaded.getDifficulty() === 2, "Converted difficulty mismatch");
    assert(loaded.getMonthsPassed() === 3, "Converted monthsPassed mismatch");
    assert(loaded.getFundsList().join(",") === "300,301,302,777000", "Converted funds graph mismatch: " + loaded.getFundsList().join(","));
    assert(loaded.getExpenditures().join(",") === "100,101,102,103", "Converted expenditures graph mismatch");
    assert(loaded.getMaintenances().join(",") === "200,201,202,203", "Converted maintenance graph mismatch");
    assert(loaded.getResearchScores().join(",") === "500,501,502,503", "Converted research scores mismatch");
    assert(loaded.getIncomes().join(",") === "10000,11000,12000,13000", "Converted income graph mismatch");
    assert(loaded.getCountries()[0].getFunding().join(",") === "10000,11000,12000,13000", "Converted country funding mismatch");
    assert(loaded.getCountries()[0].getNewPact(), "Converted country newPact flag missing");
    assert(loaded.getCountries()[0].getActivityXcom().join(",") === "1000,1031,1062,1093", "Converted country X-COM activity mismatch");
    assert(loaded.getCountries()[0].getActivityAlien().join(",") === "2000,2031,2062,2093", "Converted country alien activity mismatch");
    assert(loaded.getRegions()[0].getActivityXcom().join(",") === "1016,1047,1078,1109", "Converted region X-COM activity mismatch");
    assert(loaded.getRegions()[0].getActivityAlien().join(",") === "2016,2047,2078,2109", "Converted region alien activity mismatch");
    assert(loaded.getAllIds().get("STR_UFO") === 42 && loaded.getAllIds().get("STR_CRASH_SITE") === 42 && loaded.getAllIds().get("STR_LANDING_SITE") === 42, "Converted marker ids mismatch");
    assert(loaded.getGlobeZoom() === 2, "Converted globe zoom mismatch");
    assert(Math.abs(loaded.getGlobeLatitude() - (-16 * 0.125 * Math.PI / 180)) < 1e-9, "Converted globe latitude mismatch");
    assert(Math.abs(loaded.getGlobeLongitude() - (32 * 0.125 * Math.PI / 180)) < 1e-9, "Converted globe longitude mismatch");

    const unitEntry = mod.getUnitsList()
      .map(name => ({ name, rule: mod.getUnit(name) }))
      .find(entry => entry.rule && mod.getArmor(entry.rule.getArmor()));
    assert(unitEntry, "Need a generated battle unit rule for SavedBattleGame load fixture");
    assert(mod.getItem("STR_PISTOL"), "Need STR_PISTOL for SavedBattleGame item fixture");
    assert(mod.getInventory("STR_RIGHT_HAND"), "Need STR_RIGHT_HAND inventory rule for SavedBattleGame item fixture");
    const battleGraph = new SavedBattleGame();
    battleGraph.load({
      width: 3,
      length: 3,
      height: 1,
      missionType: "STR_BASE_DEFENSE",
      globalshade: 7,
      turn: 5,
      selectedUnit: 1000001,
      mapdatasets: [],
      tuReserved: BattleActionType.BA_AIMEDSHOT,
      kneelReserved: true,
      ambience: 7,
      ambientVolume: 0.75,
      music: "BATTLE.CAT",
      turnLimit: 18,
      chronoTrigger: ChronoTrigger.FORCE_ABORT,
      cheatTurn: 40,
      moduleMap: [[[3, 3], [-1, -1]], [[1, 2], [5, 8]]],
      tiles: [{
        position: [2, 2, 0],
        mapDataID: [-1, 9, -1, -1],
        mapDataSetID: [-1, 2, -1, -1],
        smoke: 6,
        fire: 4,
        discovered: [true, false, true],
        openDoorWest: true
      }],
      units: [{
        id: 1000001,
        genUnitType: unitEntry.name,
        genUnitArmor: unitEntry.rule.getArmor(),
        faction: 0,
        originalFaction: 0,
        status: 0,
        position: [1, 1, 0],
        direction: 2,
        tu: 33
      }],
      items: [{
        id: 12,
        type: "STR_PISTOL",
        owner: 1000001,
        inventoryslot: "STR_RIGHT_HAND",
        inventoryX: 0,
        inventoryY: 0
      }],
      recoverGuaranteed: [{
        id: 13,
        type: "STR_PISTOL"
      }],
      recoverConditional: [{
        id: 14,
        type: "STR_PISTOL"
      }]
    }, mod, new SavedGame());
    assert(mod.getItem("STR_PISTOL_CLIP"), "Need STR_PISTOL_CLIP for SavedBattleGame ammo-link fixture");
    const ammoBattle = new SavedBattleGame();
    ammoBattle.load({
      width: 1,
      length: 1,
      height: 1,
      selectedUnit: -1,
      mapdatasets: [],
      units: [],
      items: [
        { id: 20, type: "STR_UNKNOWN_PORT_FIXTURE_ITEM" },
        { id: 21, type: "STR_PISTOL", ammoItem: 22 },
        { id: 22, type: "STR_PISTOL_CLIP" }
      ]
    }, mod, new SavedGame());
    assert(ammoBattle.getItems().length === 2, "SavedBattleGame.load should skip unknown item rules while preserving known items");
    assert(ammoBattle.getItems()[0].getId() === 21 && ammoBattle.getItems()[0].getAmmoItem()?.getId() === 22, "SavedBattleGame.load ammo pass did not mirror C++ item-index advancement after unknown item");
    assert(battleGraph.getUnits().length === 1, "SavedBattleGame.load did not restore generated battle unit");
    assert(battleGraph.getSelectedUnit()?.getId() === 1000001, "SavedBattleGame.load did not restore selected player unit");
    assert(battleGraph.getItems().length === 1 && battleGraph.getItems()[0].getOwner() === battleGraph.getUnits()[0], "SavedBattleGame.load did not restore item owner linkage");
    assert(battleGraph.getUnits()[0].getInventory().includes(battleGraph.getItems()[0]), "SavedBattleGame.load did not put owned item into unit inventory");
    assert(battleGraph.getModuleMap()[1]?.[1]?.[0] === 5 && battleGraph.getModuleMap()[1]?.[1]?.[1] === 8, "SavedBattleGame.load did not restore base-defense moduleMap");
    assert(battleGraph.getTUReserved() === BattleActionType.BA_AIMEDSHOT, "SavedBattleGame.load did not restore TU reservation");
    assert(battleGraph.getKneelReserved(), "SavedBattleGame.load did not restore kneel reservation");
    assert(battleGraph.getAmbientSound() === 7, "SavedBattleGame.load did not restore ambience");
    assert(Math.abs(battleGraph.getAmbientVolume() - 0.75) < 1e-9, "SavedBattleGame.load did not restore ambient volume");
    assert(battleGraph.getMusic() === "BATTLE.CAT", "SavedBattleGame.load did not restore music");
    assert(battleGraph.getTurnLimit() === 18, "SavedBattleGame.load did not restore turn limit");
    assert(battleGraph.getChronoTrigger() === ChronoTrigger.FORCE_ABORT, "SavedBattleGame.load did not restore chrono trigger");
    assert(battleGraph.getGuaranteedRecoveredItems().length === 1, "SavedBattleGame.load did not restore guaranteed recovery list");
    assert(battleGraph.getConditionalRecoveredItems().length === 1, "SavedBattleGame.load did not restore conditional recovery list");
    const westDoorObject = { isUFODoor: () => true };
    battleGraph.getTile({ x: 2, y: 2, z: 0 })?.setMapData(westDoorObject, 9, 2, TilePart.O_WESTWALL);
    const binaryNode = battleGraph.save();
    assert(binaryNode.moduleMap?.[0]?.[0]?.[0] === 3, "SavedBattleGame.save did not persist base-defense moduleMap");
    assert(binaryNode.cheatTurn === 40, "SavedBattleGame.save did not persist cheatTurn");
    assert(binaryNode.tileTotalBytesPer === 23 && binaryNode.totalTiles === 1 && typeof binaryNode.binTiles === "string", "SavedBattleGame.save did not emit C++ binary tile payload");
    assert(!binaryNode.tiles, "SavedBattleGame.save should emit binary tiles instead of old text tiles");
    const binaryReload = new SavedBattleGame();
    binaryReload.load(binaryNode, mod, new SavedGame());
    const binaryReloadTile = binaryReload.getTile({ x: 2, y: 2, z: 0 });
    assert(binaryReloadTile?._currentFrame?.[TilePart.O_WESTWALL] === 7, "SavedBattleGame binary tile reload did not restore west door frame");
    binaryReloadTile?.setMapData(westDoorObject, 9, 2, TilePart.O_WESTWALL);
    const binaryTile = binaryReloadTile?.save();
    assert(binaryTile?.smoke === 6 && binaryTile?.fire === 4, "SavedBattleGame binary tile reload did not preserve smoke/fire");
    assert(binaryTile.mapDataID?.[1] === 9 && binaryTile.mapDataSetID?.[1] === 2, "SavedBattleGame binary tile reload did not preserve map data ids");
    assert(binaryTile.discovered?.[0] === true && binaryTile.discovered?.[2] === true, "SavedBattleGame binary tile reload did not preserve discovered bits");
    assert(binaryTile.openDoorWest, "SavedBattleGame binary tile reload did not preserve west door bit");

    const campaign = new SavedGame();
    campaign.setName("battle-roundtrip");
    campaign.setSavedBattle(battleGraph);
    campaign.save("_verify_battle.sav");
    const campaignReloaded = new SavedGame();
    campaignReloaded.load("_verify_battle.sav", mod);
    const restoredBattle = campaignReloaded.getSavedBattle();
    assert(restoredBattle, "SavedGame.load did not restore battleGame payload");
    assert(restoredBattle.getMapSizeX() === 3 && restoredBattle.getMapSizeY() === 3 && restoredBattle.getMapSizeZ() === 1, "SavedGame battleGame map dimensions mismatch");
    assert(restoredBattle.getMissionType() === "STR_BASE_DEFENSE" && restoredBattle.getTurn() === 5, "SavedGame battleGame mission metadata mismatch");
    assert(restoredBattle.getUnits().length === 1 && restoredBattle.getItems().length === 1, "SavedGame battleGame unit/item graph mismatch");
    assert(restoredBattle.getModuleMap()[1]?.[1]?.[0] === 5 && restoredBattle.getModuleMap()[1]?.[1]?.[1] === 8, "SavedGame battleGame moduleMap round-trip mismatch");
    assert(restoredBattle.getTUReserved() === BattleActionType.BA_AIMEDSHOT && restoredBattle.getKneelReserved(), "SavedGame battleGame reservation round-trip mismatch");
    assert(restoredBattle.getAmbientSound() === 7 && Math.abs(restoredBattle.getAmbientVolume() - 0.75) < 1e-9, "SavedGame battleGame ambience round-trip mismatch");
    assert(restoredBattle.getMusic() === "BATTLE.CAT" && restoredBattle.getTurnLimit() === 18, "SavedGame battleGame music/turn-limit round-trip mismatch");
    assert(restoredBattle.getChronoTrigger() === ChronoTrigger.FORCE_ABORT && restoredBattle.save().cheatTurn === 40, "SavedGame battleGame chrono/cheat turn round-trip mismatch");
    assert(restoredBattle.getGuaranteedRecoveredItems().length === 1 && restoredBattle.getConditionalRecoveredItems().length === 1, "SavedGame battleGame recovery-list round-trip mismatch");
    const restoredTileObject = restoredBattle.getTile({ x: 2, y: 2, z: 0 });
    assert(restoredTileObject?._currentFrame?.[TilePart.O_WESTWALL] === 7, "SavedGame battleGame binary tile west-door frame mismatch");
    restoredTileObject?.setMapData(westDoorObject, 9, 2, TilePart.O_WESTWALL);
    const restoredTile = restoredTileObject?.save();
    assert(restoredTile?.smoke === 6 && restoredTile?.fire === 4, "SavedGame battleGame binary tile smoke/fire mismatch");
    assert(restoredTile.mapDataID?.[1] === 9 && restoredTile.mapDataSetID?.[1] === 2 && restoredTile.openDoorWest, "SavedGame battleGame binary tile map-data/door mismatch");

    const placementUnit = battleGraph.getUnits()[0];
    placementUnit._movementType = MovementType.MT_FLY;
    placementUnit._verticalDirection = 0;
    placementUnit._status = UnitStatus.STATUS_WALKING;
    placementUnit._floating = false;
    const airTile = battleGraph.getTile({ x: 0, y: 0, z: 0 });
    airTile.setUnit(placementUnit, null);
    assert(placementUnit.getStatus() === UnitStatus.STATUS_FLYING && placementUnit.isFloating(), "Tile.setUnit did not mirror C++ walking-to-flying transition over no-floor tile");
    const floorTile = battleGraph.getTile({ x: 1, y: 0, z: 0 });
    floorTile.setMapData({ isNoFloor: () => false }, 0, 0, TilePart.O_FLOOR);
    placementUnit._status = UnitStatus.STATUS_FLYING;
    placementUnit._floating = true;
    floorTile.setUnit(placementUnit, null);
    assert(placementUnit.getStatus() === UnitStatus.STATUS_WALKING && !placementUnit.isFloating(), "Tile.setUnit did not mirror C++ flying-to-walking transition on floor tile");
    placementUnit._status = UnitStatus.STATUS_UNCONSCIOUS;
    placementUnit._floating = false;
    airTile.setUnit(placementUnit, null);
    assert(placementUnit.isFloating(), "Tile.setUnit did not mirror C++ unconscious floating state over no-floor tile");

    const movementBattle = new SavedBattleGame();
    movementBattle.load({ width: 3, length: 1, height: 2, selectedUnit: -1, mapdatasets: [], units: [], items: [] }, mod, new SavedGame());
    const movementUnit = placementUnit;
    movementUnit.setPosition({ x: 0, y: 0, z: 1 });
    movementUnit.setPosition({ x: 1, y: 0, z: 1 });
    movementUnit._movementType = MovementType.MT_FLY;
    movementUnit._verticalDirection = 0;
    movementUnit._status = UnitStatus.STATUS_FLYING;
    movementUnit._floating = true;
    movementBattle.getTile({ x: 1, y: 0, z: 0 })?.setMapData({ isNoFloor: () => false, getTerrainLevel: () => -24 }, 0, 0, TilePart.O_FLOOR);
    const walkState = Object.create(UnitWalkBState.prototype);
    walkState._parent = { getSave: () => movementBattle };
    walkState.updateTileOccupancy(movementUnit, 0);
    assert(movementUnit.getStatus() === UnitStatus.STATUS_WALKING && !movementUnit.isFloating(), "UnitWalkBState.updateTileOccupancy did not pass tileBelow into Tile.setUnit");
    movementUnit._status = UnitStatus.STATUS_FLYING;
    movementUnit._floating = true;
    movementUnit.setPosition({ x: 0, y: 0, z: 1 });
    movementUnit.setPosition({ x: 1, y: 0, z: 1 });
    const fallState = Object.create(UnitFallBState.prototype);
    fallState._parent = { getSave: () => movementBattle };
    fallState.updateUnitTiles(movementUnit, new Position(0, 0, 1), 0);
    assert(movementUnit.getStatus() === UnitStatus.STATUS_WALKING && !movementUnit.isFloating(), "UnitFallBState.updateUnitTiles did not pass tileBelow into Tile.setUnit");

    const originalLightingMethods = {
      sun: TileEngine.prototype.calculateSunShading,
      terrain: TileEngine.prototype.calculateTerrainLighting,
      unit: TileEngine.prototype.calculateUnitLighting,
      fov: TileEngine.prototype.recalculateFOV
    };
    const lightingCalls = { sun: 0, terrain: 0, unit: 0, fov: 0 };
    try {
      TileEngine.prototype.calculateSunShading = function () { lightingCalls.sun += 1; };
      TileEngine.prototype.calculateTerrainLighting = function () { lightingCalls.terrain += 1; };
      TileEngine.prototype.calculateUnitLighting = function () { lightingCalls.unit += 1; };
      TileEngine.prototype.recalculateFOV = function () { lightingCalls.fov += 1; };
      const resourceBattle = new SavedBattleGame();
      resourceBattle.load({
        width: 1,
        length: 1,
        height: 1,
        selectedUnit: -1,
        mapdatasets: ["FAKESET"],
        tiles: [{
          position: [0, 0, 0],
          mapDataID: [-1, 0, -1, -1],
          mapDataSetID: [-1, 0, -1, -1]
        }],
        units: [],
        items: []
      }, null, new SavedGame());
      const fakeMapData = { isUFODoor: () => true };
      await resourceBattle.loadMapResources({
        loadMapDataSet: async name => ({
          getName: () => name,
          getObject: id => id === 0 ? fakeMapData : null
        }),
        getVoxelData: () => []
      });
      assert(lightingCalls.sun === 1 && lightingCalls.terrain === 1 && lightingCalls.unit === 1 && lightingCalls.fov === 1, "SavedBattleGame.loadMapResources did not run C++ lighting/FOV recalculation sequence");
      assert(resourceBattle.getTile({ x: 0, y: 0, z: 0 })?.getMapData(TilePart.O_WESTWALL) === fakeMapData, "SavedBattleGame.loadMapResources did not rebind tile map data");
    } finally {
      TileEngine.prototype.calculateSunShading = originalLightingMethods.sun;
      TileEngine.prototype.calculateTerrainLighting = originalLightingMethods.terrain;
      TileEngine.prototype.calculateUnitLighting = originalLightingMethods.unit;
      TileEngine.prototype.recalculateFOV = originalLightingMethods.fov;
    }

    const runtimeBattle = new SavedBattleGame();
    runtimeBattle.load({ width: 3, length: 1, height: 1, selectedUnit: -1, mapdatasets: [], units: [], items: [] }, mod, new SavedGame());
    runtimeBattle.initUtilities({ getVoxelData: () => [] });
    const runtimeEngine = runtimeBattle.getTileEngine();
    let terrainLightingCalls = 0;
    runtimeEngine.horizontalBlockage = () => 0;
    runtimeEngine.calculateTerrainLighting = () => { terrainLightingCalls += 1; };
    const burningTile = runtimeBattle.getTile({ x: 1, y: 0, z: 0 });
    burningTile.setFire(2);
    burningTile.setSmoke(8);
    runtimeBattle.prepareNewTurn();
    assert(burningTile.getFire() === 1, "SavedBattleGame.prepareNewTurn did not decrement active fire");
    assert(runtimeBattle.getTile({ x: 0, y: 0, z: 0 })?.getSmoke() === 3 && runtimeBattle.getTile({ x: 2, y: 0, z: 0 })?.getSmoke() === 3, "SavedBattleGame.prepareNewTurn did not spread fire smoke in cardinal directions");
    assert(terrainLightingCalls === 1, "SavedBattleGame.prepareNewTurn did not recalculate terrain lighting after fire/smoke changes");
    runtimeBattle.setDebugMode();
    runtimeBattle.setDebugMode();
    assert(runtimeBattle.getDebugMode() && runtimeBattle.getTiles().every(tile => tile.isDiscovered(TilePart.O_NORTHWALL)), "SavedBattleGame.setDebugMode did not mirror C++ one-way full discovery");

    burningTile.setVisible(5);
    burningTile.setDiscovered(true, TilePart.O_FLOOR);
    burningTile.setDiscovered(true, TilePart.O_WESTWALL);
    burningTile.setDiscovered(true, TilePart.O_NORTHWALL);
    runtimeBattle.resetTiles();
    assert(burningTile.getVisible() === 5, "SavedBattleGame.resetTiles should not invert tile visibility");
    assert(!burningTile.save().discovered, "SavedBattleGame.resetTiles did not clear discovered flags");

    const storageBattle = new SavedBattleGame();
    storageBattle.load({ width: 2, length: 1, height: 1, selectedUnit: -1, mapdatasets: [], units: [], items: [] }, mod, new SavedGame());
    const storageSource = storageBattle.getTile({ x: 0, y: 0, z: 0 });
    const storageDest = storageBattle.getTile({ x: 1, y: 0, z: 0 });
    const groundSlot = mod.getInventory("STR_GROUND");
    const storageItem = new BattleItem(mod.getItem("STR_PISTOL"), 9000);
    storageSource.addItem(storageItem, groundSlot);
    storageBattle.getStorageSpace().push({ x: 1, y: 0, z: 0 });
    storageBattle.randomizeItemLocations(storageSource);
    assert(storageSource.getInventory().length === 0 && storageDest.getInventory().includes(storageItem), "SavedBattleGame.randomizeItemLocations did not move ground item into storage tile");

    const originalGetList = SaveConverter.getList;
    const originalLoadOriginal = SaveConverter.prototype.loadOriginal;
    let originalLoadMapResourcesCalled = false;
    try {
      const resumeSave = new SavedGame();
      const resumeBattle = new SavedBattleGame();
      resumeBattle.load({ width: 2, length: 2, height: 1, selectedUnit: -1, mapdatasets: [], units: [], items: [] }, mod, resumeSave);
      resumeBattle.loadMapResources = async () => {
        originalLoadMapResourcesCalled = true;
      };
      resumeSave.setSavedBattle(resumeBattle);
      SaveConverter.getList = () => Array.from({ length: 10 }, (_, index) => ({
        id: index === 0 ? 1 : 0,
        name: index === 0 ? "BATTLE_RESUME" : "",
        date: "",
        time: "",
        tactical: false
      }));
      SaveConverter.prototype.loadOriginal = function () {
        return resumeSave;
      };
      const state = new ListLoadOriginalState(OPT_GEOSCAPE);
      const slot = state._btnSlot[0];
      state.btnSlotClick({ getSender: () => slot });
      await new Promise(resolve => setTimeout(resolve, 0));
      assert(originalLoadMapResourcesCalled, "ListLoadOriginalState did not load map resources for restored battleGame");
      assert(resumeBattle.getBattleState(), "ListLoadOriginalState did not attach BattlescapeState to restored battleGame");
      assert(Options.baseXResolution === Options.baseXBattlescape && Options.baseYResolution === Options.baseYBattlescape, "ListLoadOriginalState did not switch to battlescape resolution");
    } finally {
      SaveConverter.getList = originalGetList;
      SaveConverter.prototype.loadOriginal = originalLoadOriginal;
    }

    return {
      ...converterData,
      convertedMonth: loaded.getTime().getMonth(),
      convertedFunds: loaded.getFunds(),
      convertedCountries: loaded.getCountries().length,
      convertedRegions: loaded.getRegions().length,
      convertedResearch: finishedEntry.name,
      convertedPoppedResearch: poppedEntry.name,
      convertedProject: projectEntry.name,
      convertedProduction: productionEntry.name,
      convertedUfopaedia: upEntry.name,
      restoredBattleUnits: restoredBattle.getUnits().length
    };
  });

  await page.evaluate(value => console.log("VERIFY_SAVECONVERTER_METADATA ok " + JSON.stringify(value)), result);
}`;

function line(message) {
  console.log(message);
}

function quoteForCmd(arg) {
  const value = String(arg);
  if (!/[ \t\r\n\"&|^<>\(\)]/.test(value)) {
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
  line("- browser VERIFY_SAVECONVERTER_METADATA");
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

    if (!runConsoleResult.stdout.includes("VERIFY_SAVECONVERTER_METADATA ok") || runConsoleResult.stdout.includes("[ERROR]")) {
      throw new Error(`Verifier marker missing or error present:\nrun-code:\n${runCodeResult.stdout}\nconsole:\n${runConsoleResult.stdout}`);
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
  line("VERIFY_SAVECONVERTER_METADATA");
  await run("build", process.execPath, [join(webRoot, "scripts", "build.mjs")]);
  await run("typecheck", npm, ["run", "typecheck"], webRoot);
  await runBrowserVerifier();
  line("VERIFY_SAVECONVERTER_METADATA ok");
}

await main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
