import type { Language } from "../Engine/Language.ts";
import { Options } from "../Engine/Options.ts";
import { RNG } from "../Engine/RNG.ts";
import type { Mod } from "../Mod/Mod.ts";
import { MissionObjective } from "../Mod/RuleAlienMission.ts";
import type { RuleConverter } from "../Mod/RuleConverter.ts";
import { DIFFICULTY_COEFFICIENT } from "../Mod/ModStatics.ts";
import { UfoTrajectory } from "../Mod/UfoTrajectory.ts";
import { Xcom2Rad } from "../fmath.ts";
import { AlienBase } from "./AlienBase.ts";
import { AlienMission } from "./AlienMission.ts";
import { Base } from "./Base.ts";
import { BaseFacility } from "./BaseFacility.ts";
import { Craft, type CraftSaveNode } from "./Craft.ts";
import { Country } from "./Country.ts";
import { GameTime } from "./GameTime.ts";
import { MissionSite } from "./MissionSite.ts";
import { Production } from "./Production.ts";
import { Region } from "./Region.ts";
import { ResearchProject } from "./ResearchProject.ts";
import { GameDifficulty, SavedGame } from "./SavedGame.ts";
import { Soldier, type SoldierSaveNode } from "./Soldier.ts";
import { Transfer, TransferType } from "./Transfer.ts";
import { Ufo, UfoStatus, type UfoSaveNode } from "./Ufo.ts";
import { Vehicle } from "./Vehicle.ts";
import { Waypoint } from "./Waypoint.ts";

enum TargetType {
  TARGET_NONE = 0,
  TARGET_UFO = 1,
  TARGET_CRAFT = 2,
  TARGET_XBASE = 3,
  TARGET_ABASE = 4,
  TARGET_CRASH = 5,
  TARGET_LANDED = 6,
  TARGET_WAYPOINT = 7,
  TARGET_TERROR = 8,
  TARGET_PORT = 0x51,
  TARGET_ISLAND = 0x52,
  TARGET_SHIP = 0x53,
  TARGET_ARTEFACT = 0x54
}

type ConvertedTarget = Ufo | Craft | Base | AlienBase | Waypoint | MissionSite;

const XCOM_ALTITUDES = ["STR_GROUND", "STR_VERY_LOW", "STR_LOW_UC", "STR_HIGH_UC", "STR_VERY_HIGH"];
const XCOM_STATUS = ["STR_READY", "STR_OUT", "STR_REPAIRS", "STR_REFUELLING", "STR_REARMING"];
const UFOPAEDIA_NOT_AVAILABLE = "STR_NOT_AVAILABLE";

export type SaveOriginal = {
  id: number;
  name: string;
  date: string;
  time: string;
  tactical: boolean;
  error?: string;
};

export class SaveConverter {
  static NUM_SAVES = 10;
  private _saveName: string;
  private _savePath: string;
  private _save: SavedGame | null = null;
  private _rules: RuleConverter | null = null;
  private _year = 0;
  private _funds = 0;
  private _targets: Array<ConvertedTarget | null> = [];
  private _targetDat: number[] = [];
  private _aliens: string[] = [];
  private _soldiers: Array<Soldier | null> = [];
  private _missions = new Map<string, AlienMission>();

  constructor(save: number, private _mod: Mod | null) {
    this._saveName = `GAME_${save}`;
    this._savePath = `${Options.getMasterUserFolder()}${this._saveName}`;
    this._rules = this._mod?.getConverter() || null;
  }

  private static saveFolder(id: number): string {
    return `${Options.getMasterUserFolder()}GAME_${id}/`;
  }

  private static bytesToBase64(bytes: Uint8Array): string {
    let binary = "";
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
    }
    return btoa(binary);
  }

  private static base64ToBytes(raw: string): Uint8Array {
    return Uint8Array.from(atob(raw), c => c.charCodeAt(0));
  }

  private static saveInfoFromBytes(id: number, data: Uint8Array, lang: Language | null): SaveOriginal {
    if (data.length <= 0x26) {
      throw new Error(`GAME_${id}/SAVEINFO.DAT is invalid`);
    }
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    const readU16 = (offset: number) => offset + 2 <= data.length ? view.getUint16(offset, true) : 0;
    let end = 0x02;
    while (end < data.length && data[end] !== 0) {
      ++end;
    }
    let name = "";
    for (let i = 0x02; i < end; ++i) {
      name += String.fromCharCode(data[i]);
    }
    const year = readU16(0x1c);
    const month = readU16(0x1e);
    const day = readU16(0x20);
    const hour = readU16(0x22);
    const minute = readU16(0x24);
    const tactical = (data[0x26] || 0) !== 0;
    const gameTime = new GameTime(0, day, month + 1, year, hour, minute, 0);
    const dayText = lang ? gameTime.getDayString(lang) : String(gameTime.getDay());
    const monthText = lang ? String(lang.getString(gameTime.getMonthString())) : gameTime.getMonthString();
    return {
      id,
      name,
      date: `${dayText}  ${monthText}  ${gameTime.getYear()}`,
      time: `${gameTime.getHour()}:${String(gameTime.getMinute()).padStart(2, "0")}`,
      tactical
    };
  }

  static getList(lang: Language | null): SaveOriginal[] {
    const info: SaveOriginal[] = [];
    for (let i = 0; i < SaveConverter.NUM_SAVES; ++i) {
      const id = i + 1;
      let save: SaveOriginal = { id: 0, name: "", date: "", time: "", tactical: false };
      const raw = localStorage.getItem(`${SaveConverter.saveFolder(id)}SAVEINFO.DAT`);
      if (raw) {
        try {
          save = SaveConverter.saveInfoFromBytes(id, SaveConverter.base64ToBytes(raw), lang);
        } catch (error) {
          save = { id, name: `GAME_${id}`, date: "", time: "", tactical: false, error: error instanceof Error ? error.message : `GAME_${id}/SAVEINFO.DAT is invalid` };
        }
      } else {
        const legacy = localStorage.getItem(`openxcom.original.GAME_${id}.SAVEINFO.DAT`);
        if (legacy) {
          try {
            save = { ...save, ...JSON.parse(legacy), id };
          } catch {
            save = { id, name: `GAME_${id}`, date: "", time: "", tactical: false };
          }
        }
      }
      info.push(save);
    }
    return info;
  }

  static async importOriginalFiles(files: Iterable<File>, lang: Language | null = null): Promise<SaveOriginal[]> {
    const clearedSlots = new Set<number>();
    const importedSlots = new Set<number>();
    let matchedFiles = 0;
    for (const file of files) {
      const relativePath = ((file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name).replaceAll("\\", "/");
      const match = /(?:^|\/)GAME_(\d+)(?:\/|$)/i.exec(relativePath);
      if (!match) {
        continue;
      }
      const id = Number(match[1]);
      if (id < 1 || id > SaveConverter.NUM_SAVES) {
        continue;
      }
      matchedFiles++;
      const filename = relativePath.split("/").pop()?.toUpperCase();
      if (!filename) {
        continue;
      }
      const folder = SaveConverter.saveFolder(id);
      if (!clearedSlots.has(id)) {
        const remove: string[] = [];
        for (let i = 0; i < localStorage.length; ++i) {
          const key = localStorage.key(i);
          if (key?.startsWith(folder)) {
            remove.push(key);
          }
        }
        for (const key of remove) {
          localStorage.removeItem(key);
        }
        clearedSlots.add(id);
      }
      const bytes = new Uint8Array(await file.arrayBuffer());
      localStorage.setItem(`${folder}${filename}`, SaveConverter.bytesToBase64(bytes));
      importedSlots.add(id);
    }
    if (matchedFiles === 0) {
      throw new Error("No GAME_# original save files found");
    }
    for (const id of importedSlots) {
      if (!localStorage.getItem(`${SaveConverter.saveFolder(id)}SAVEINFO.DAT`)) {
        throw new Error(`GAME_${id}/SAVEINFO.DAT not found`);
      }
    }
    const list = SaveConverter.getList(lang);
    for (const id of importedSlots) {
      const save = list[id - 1];
      if (save?.error) {
        throw new Error(save.error);
      }
    }
    return list;
  }

  loadOriginal(): SavedGame {
    this._save = new SavedGame();
    this._save.setName(this._saveName);
    this._save.getBases().length = 0;
    this._save.getIncomes().length = 0;
    const mod = this.requireMod();
    const rules = this.requireRules();

    for (const countryName of rules.getCountries()) {
      const rule = mod.getCountry(countryName, true);
      if (!rule) {
        continue;
      }
      const country = new Country(rule, false);
      country.getActivityAlien().length = 0;
      country.getActivityXcom().length = 0;
      country.getFunding().length = 0;
      this._save.getCountries().push(country);
    }
    for (const regionName of rules.getRegions()) {
      const rule = mod.getRegion(regionName);
      if (!rule) {
        throw new Error(`Region rule ${regionName} not found.`);
      }
      const region = new Region(rule);
      region.getActivityAlien().length = 0;
      region.getActivityXcom().length = 0;
      this._save.getRegions().push(region);
    }
    this.loadDatXcom();
    this.loadDatAlien();
    this.loadDatDiplom();
    this.loadDatLease();

    this._save.getExpenditures().length = 0;
    this._save.getMaintenances().length = 0;
    this._save.getFundsList().length = 0;
    this._save.getResearchScores().length = 0;
    this.loadDatLIGlob();
    this.loadDatUIGlob();
    this.loadDatIGlob();

    this.loadDatZonal();
    this.loadDatActs();
    this.loadDatMissions();

    this.loadDatLoc();
    this.loadDatBase();
    this.loadDatAStore();
    this.loadDatCraft();
    this.loadDatSoldier();
    this.loadDatTransfer();
    this.loadDatResearch();
    this.loadDatUp();
    this.loadDatProject();
    this.loadDatBProd();
    this.loadDatXBases();
    return this._save;
  }

  binaryBuffer(filename: string): Uint8Array {
    const raw = localStorage.getItem(`${this._savePath}/${filename}`);
    if (!raw) {
      throw new Error(`${filename} not found`);
    }
    return Uint8Array.from(atob(raw), c => c.charCodeAt(0));
  }

  graphVector<T>(vector: T[], month: number, year: boolean): T[] {
    if (year) {
      const result: T[] = [];
      let i = month;
      do {
        result.push(vector[i]);
        i = (i + 1) % vector.length;
      } while (i !== month);
      vector.splice(0, vector.length, ...result);
      return vector;
    }
    while (vector.length > month) {
      vector.pop();
    }
    while (vector.length < month) {
      vector.push(0 as T);
    }
    return vector;
  }

  private requireSave(): SavedGame {
    if (!this._save) {
      throw new Error("SaveConverter has no active save.");
    }
    return this._save;
  }

  private requireMod(): Mod {
    if (!this._mod) {
      throw new Error("SaveConverter requires a Mod.");
    }
    return this._mod;
  }

  private requireRules(): RuleConverter {
    if (!this._rules) {
      throw new Error("SaveConverter requires RuleConverter metadata.");
    }
    return this._rules;
  }

  private hasBinary(filename: string): boolean {
    return localStorage.getItem(`${this._savePath}/${filename}`) != null;
  }

  private u8(data: Uint8Array, offset: number): number {
    return data[offset] || 0;
  }

  private u16(data: Uint8Array, offset: number): number {
    return new DataView(data.buffer, data.byteOffset, data.byteLength).getUint16(offset, true);
  }

  private s16(data: Uint8Array, offset: number): number {
    return new DataView(data.buffer, data.byteOffset, data.byteLength).getInt16(offset, true);
  }

  private i32(data: Uint8Array, offset: number): number {
    return new DataView(data.buffer, data.byteOffset, data.byteLength).getInt32(offset, true);
  }

  private cString(data: Uint8Array, offset: number): string {
    let end = offset;
    while (end < data.length && data[end] !== 0) {
      ++end;
    }
    let text = "";
    for (let i = offset; i < end; ++i) {
      text += String.fromCharCode(data[i]);
    }
    return text;
  }

  private requireBaseFacility(type: string) {
    const rule = this.requireMod().getBaseFacility(type);
    if (!rule) {
      throw new Error(`Base facility rule ${type} not found.`);
    }
    return rule;
  }

  private requireCraftRule(type: string) {
    const rule = this.requireMod().getCraft(type);
    if (!rule) {
      throw new Error(`Craft rule ${type} not found.`);
    }
    return rule;
  }

  private requireItemRule(type: string) {
    const rule = this.requireMod().getItem(type, true);
    if (!rule) {
      throw new Error(`Item rule ${type} not found.`);
    }
    return rule;
  }

  private missionKey(mission: number, region: number): string {
    return `${mission}:${region}`;
  }

  private requireSoldierRule() {
    const type = this.requireMod().getSoldiersList()[0];
    const rule = this.requireMod().getSoldier(type);
    if (!rule) {
      throw new Error(`Soldier rule ${type} not found.`);
    }
    return rule;
  }

  private applyGraphVector<T>(vector: T[], month: number, year: boolean): void {
    this.graphVector(vector, month, year);
  }

  private loadDatXcom(): void {
    const save = this.requireSave();
    const rules = this.requireRules();
    const data = this.binaryBuffer("XCOM.DAT");
    const entries = rules.getCountries().length + rules.getRegions().length;
    const months = 12;
    for (let i = 0; i < entries * months; ++i) {
      const score = this.i32(data, i * 4);
      let index = i % entries;
      if (index < rules.getCountries().length) {
        save.getCountries()[index]?.getActivityXcom().push(score);
      } else {
        index -= rules.getCountries().length;
        save.getRegions()[index]?.getActivityXcom().push(score);
      }
    }
  }

  private loadDatAlien(): void {
    const save = this.requireSave();
    const rules = this.requireRules();
    const data = this.binaryBuffer("ALIEN.DAT");
    const entries = rules.getCountries().length + rules.getRegions().length;
    const months = 12;
    for (let i = 0; i < entries * months; ++i) {
      const score = this.i32(data, i * 4);
      let index = i % entries;
      if (index < rules.getCountries().length) {
        save.getCountries()[index]?.getActivityAlien().push(score);
      } else {
        index -= rules.getCountries().length;
        save.getRegions()[index]?.getActivityAlien().push(score);
      }
    }
  }

  private loadDatDiplom(): void {
    const save = this.requireSave();
    const rules = this.requireRules();
    const data = this.binaryBuffer("DIPLOM.DAT");
    const months = 12;
    const income = Array.from({ length: months }, () => 0);
    const entrySize = 36;
    for (let i = 0; i < rules.getCountries().length; ++i) {
      const offset = i * entrySize;
      const country = save.getCountries()[i];
      if (!country) {
        continue;
      }
      const satisfaction = this.s16(data, offset + 0x02);
      for (let month = 0; month < months; ++month) {
        const funding = this.s16(data, offset + 0x04 + month * 2) * 1000;
        income[month] += funding;
        country.getFunding().push(funding);
      }
      if (satisfaction === 0) {
        country.setPact();
      }
      if (this.s16(data, offset + 0x1e) !== 0) {
        country.setNewPact();
      }
    }
    save.getIncomes().splice(0, save.getIncomes().length, ...income);
  }

  private loadDatLease(): void {
    const save = this.requireSave();
    const data = this.binaryBuffer("LEASE.DAT");
    save.setGlobeLatitude(-Xcom2Rad(this.s16(data, 0x00)));
    save.setGlobeLongitude(-Xcom2Rad(this.s16(data, 0x06)));
    const zoom = this.s16(data, 0x0c);
    const distance = [90, 120, 180, 360, 450, 720];
    const index = distance.indexOf(zoom);
    if (index !== -1) {
      save.setGlobeZoom(index);
    }
  }

  private loadDatLIGlob(): void {
    const save = this.requireSave();
    const data = this.binaryBuffer("LIGLOB.DAT");
    const months = 12;
    for (let i = 0; i < months; ++i) {
      save.getExpenditures().push(this.i32(data, 0x04 + i * 4));
      save.getMaintenances().push(this.i32(data, 0x34 + i * 4));
      save.getFundsList().push(this.i32(data, 0x64 + i * 4));
    }
    this._funds = this.i32(data, 0);
  }

  private loadDatUIGlob(): void {
    const save = this.requireSave();
    const rules = this.requireRules();
    const data = this.binaryBuffer("UIGLOB.DAT");
    const ids = new Map<string, number>();
    for (let i = 0; i < rules.getMarkers().length; ++i) {
      ids.set(rules.getMarkers()[i], this.u16(data, i * 2));
    }
    const ufoId = ids.get("STR_UFO") || 0;
    ids.set("STR_CRASH_SITE", ufoId);
    ids.set("STR_LANDING_SITE", ufoId);
    this._year = this.u16(data, 0x16);
    const months = 12;
    for (let i = 0; i < months; ++i) {
      save.getResearchScores().push(this.s16(data, 0x18 + i * 2));
    }
    if (this.hasBinary("SITE.DAT")) {
      const siteData = this.binaryBuffer("SITE.DAT");
      const generatedArtifactSiteMissions = this.u16(siteData, 0x24);
      if (generatedArtifactSiteMissions > 0) {
        save.getAlienStrategy().addMissionRun("artifacts", generatedArtifactSiteMissions);
        let spawnedArtifactSites = generatedArtifactSiteMissions;
        if (this.u8(siteData, 0x26) === "T".charCodeAt(0)) {
          spawnedArtifactSites--;
        }
        ids.set("STR_ARTIFACT_SITE", spawnedArtifactSites + 1);
      }
    }
    save.setAllIds(ids);
  }

  private loadDatIGlob(): void {
    const save = this.requireSave();
    const mod = this.requireMod();
    const rules = this.requireRules();
    const data = this.binaryBuffer("IGLOB.DAT");
    const month = this.i32(data, 0x00) + 1;
    const weekday = this.i32(data, 0x04) + 1;
    const day = this.i32(data, 0x08);
    const hour = this.i32(data, 0x0c);
    const minute = this.i32(data, 0x10);
    const second = this.i32(data, 0x14);
    save.setTime(new GameTime(weekday, day, month, this._year, hour, minute, second));

    if (data.length > 0x3c) {
      const coefficient = this.i32(data, 0x3c);
      const difficulty = DIFFICULTY_COEFFICIENT.findIndex(value => value === coefficient);
      if (difficulty !== -1) {
        save.setDifficulty(difficulty as GameDifficulty);
      }
    }

    const startingYear = mod.getStartingTime().getYear();
    const monthsPassed = month + (this._year - startingYear) * 12;
    for (let i = 0; i < monthsPassed; ++i) {
      save.addMonth();
    }
    const year = this._year !== startingYear;
    this.applyGraphVector(save.getIncomes(), month, year);
    this.applyGraphVector(save.getExpenditures(), month, year);
    this.applyGraphVector(save.getMaintenances(), month, year);
    this.applyGraphVector(save.getFundsList(), month, year);
    this.applyGraphVector(save.getResearchScores(), month, year);
    for (let i = 0; i < rules.getCountries().length; ++i) {
      const country = save.getCountries()[i];
      if (!country) {
        continue;
      }
      this.applyGraphVector(country.getActivityAlien(), month, year);
      this.applyGraphVector(country.getActivityXcom(), month, year);
      this.applyGraphVector(country.getFunding(), month, year);
    }
    for (let i = 0; i < rules.getRegions().length; ++i) {
      const region = save.getRegions()[i];
      if (!region) {
        continue;
      }
      this.applyGraphVector(region.getActivityAlien(), month, year);
      this.applyGraphVector(region.getActivityXcom(), month, year);
    }
    if (save.getFundsList().length > 0) {
      save.getFundsList()[save.getFundsList().length - 1] = this._funds;
    }
  }

  private loadDatLoc(): void {
    const save = this.requireSave();
    const mod = this.requireMod();
    const rules = this.requireRules();
    const data = this.binaryBuffer("LOC.DAT");
    const entries = 50;
    const entrySize = Math.trunc(data.length / entries);
    this._targets = [];
    this._targetDat = [];
    for (let i = 0; i < entries; ++i) {
      const offset = i * entrySize;
      const type = this.u8(data, offset) as TargetType;
      const dat = this.u8(data, offset + 0x01);
      const lon = Xcom2Rad(this.s16(data, offset + 0x02));
      const lat = Xcom2Rad(this.s16(data, offset + 0x04));
      const timer = this.s16(data, offset + 0x06);
      const id = this.s16(data, offset + 0x0a);
      const detected = (this.i32(data, offset + 0x10) & 1) === 0;
      let target: ConvertedTarget | null = null;
      let mission: MissionSite | null = null;

      switch (type) {
        case TargetType.TARGET_NONE:
          break;
        case TargetType.TARGET_UFO:
        case TargetType.TARGET_CRASH:
        case TargetType.TARGET_LANDED: {
          const rule = mod.getUfo(rules.getUfos()[0], true);
          const ufo = new Ufo(rule!);
          ufo.setId(id);
          ufo.setCrashId(id);
          ufo.setLandId(id);
          ufo.setSecondsRemaining(timer);
          ufo.setDetected(detected);
          target = ufo;
          break;
        }
        case TargetType.TARGET_CRAFT:
          target = new Craft(this.requireCraftRule(rules.getCrafts()[0]), null, id);
          break;
        case TargetType.TARGET_XBASE:
          target = new Base(mod);
          break;
        case TargetType.TARGET_ABASE: {
          const deployment = mod.getDeployment("STR_ALIEN_BASE_ASSAULT", true);
          const alienBase = new AlienBase(deployment!);
          alienBase.setId(id);
          alienBase.setAlienRace(rules.getCrews()[dat] || "");
          alienBase.setDiscovered(detected);
          save.getAlienBases().push(alienBase);
          target = alienBase;
          break;
        }
        case TargetType.TARGET_WAYPOINT: {
          const waypoint = new Waypoint();
          waypoint.setId(id);
          save.getWaypoints().push(waypoint);
          target = waypoint;
          break;
        }
        case TargetType.TARGET_TERROR:
          mission = new MissionSite(mod.getAlienMission("STR_ALIEN_TERROR", true)!, mod.getDeployment("STR_TERROR_MISSION", true)!);
          break;
        case TargetType.TARGET_PORT:
          mission = new MissionSite(mod.getAlienMission("STR_ALIEN_SURFACE_ATTACK", true)!, mod.getDeployment("STR_PORT_TERROR", true)!);
          break;
        case TargetType.TARGET_ISLAND:
          mission = new MissionSite(mod.getAlienMission("STR_ALIEN_SURFACE_ATTACK", true)!, mod.getDeployment("STR_ISLAND_TERROR", true)!);
          break;
        case TargetType.TARGET_SHIP:
          mission = new MissionSite(mod.getAlienMission("STR_ALIEN_SHIP_ATTACK", true)!, mod.getDeployment("STR_CARGO_SHIP_P1", true)!);
          break;
        case TargetType.TARGET_ARTEFACT:
          mission = new MissionSite(mod.getAlienMission("STR_ALIEN_ARTIFACT", true)!, mod.getDeployment("STR_ARTIFACT_SITE_P1", true)!);
          break;
      }

      if (mission) {
        mission.setId(id);
        mission.setAlienRace(rules.getCrews()[dat] || "");
        mission.setSecondsRemaining(timer * 3600);
        mission.setDetected(detected);
        save.getMissionSites().push(mission);
        target = mission;
      }
      if (target) {
        target.setLongitude(lon);
        target.setLatitude(lat);
      }
      this._targets.push(target);
      this._targetDat.push(dat);
    }
  }

  private loadDatBase(): void {
    const save = this.requireSave();
    const rules = this.requireRules();
    const data = this.binaryBuffer("BASE.DAT");
    const bases = 8;
    const baseSize = 6;
    const facilities = baseSize * baseSize;
    const entrySize = Math.trunc(data.length / bases);
    const orderedBases: Array<Base | null> = Array.from({ length: bases }, () => null);
    for (let i = 0; i < this._targets.length; ++i) {
      const base = this._targets[i];
      if (!(base instanceof Base)) {
        continue;
      }
      const baseIndex = this._targetDat[i];
      const offset = baseIndex * entrySize;
      const facilityOffset = rules.getOffset("BASE.DAT_FACILITIES");
      base.setName(this.cString(data, offset));
      for (let k = 0; k < facilities; ++k) {
        const facilityType = this.u8(data, offset + facilityOffset + k);
        if (facilityType < rules.getFacilities().length) {
          const facility = new BaseFacility(this.requireBaseFacility(rules.getFacilities()[facilityType]), base);
          facility.setX(k % baseSize);
          facility.setY(Math.trunc(k / baseSize));
          facility.setBuildTime(this.u8(data, offset + facilityOffset + facilities + k));
          base.getFacilities().push(facility);
        }
      }
      base.setEngineers(this.u8(data, offset + rules.getOffset("BASE.DAT_ENGINEERS")));
      base.setScientists(this.u8(data, offset + rules.getOffset("BASE.DAT_SCIENTISTS")));
      const itemsOffset = rules.getOffset("BASE.DAT_ITEMS");
      for (let k = 0; k < rules.getItems().length; ++k) {
        const item = rules.getItems()[k];
        const qty = this.u16(data, offset + itemsOffset + k * 2);
        if (qty !== 0 && item.length > 0) {
          base.getStorageItems().addItem(item, qty);
        }
      }
      orderedBases[baseIndex] = base;
    }
    for (const base of orderedBases) {
      if (base) {
        save.getBases().push(base);
      }
    }
  }

  private loadDatAStore(): void {
    const rules = this.requireRules();
    const data = this.binaryBuffer("ASTORE.DAT");
    const entrySize = 12;
    const entries = Math.trunc(data.length / entrySize);
    this._aliens = [];
    for (let i = 0; i < entries; ++i) {
      const offset = i * entrySize;
      const race = this.u8(data, offset);
      let liveAlien = "";
      if (race !== 0) {
        const rank = this.u8(data, offset + 0x01);
        const baseIndex = this.u8(data, offset + 0x02);
        liveAlien = `${rules.getAlienRaces()[race] || ""}${rules.getAlienRanks()[rank] || ""}`;
        if (baseIndex !== 0xff) {
          const base = this._targets[baseIndex];
          if (base instanceof Base) {
            base.getStorageItems().addItem(liveAlien);
          }
        }
      }
      this._aliens.push(liveAlien);
    }
  }

  private loadDatCraft(): void {
    const save = this.requireSave();
    const mod = this.requireMod();
    const rules = this.requireRules();
    const data = this.binaryBuffer("CRAFT.DAT");
    const entrySize = Math.trunc(data.length / this._targets.length);
    for (let i = 0; i < this._targets.length; ++i) {
      const recordIndex = this._targetDat[i];
      const offset = recordIndex * entrySize;
      const type = this.u8(data, offset);
      if (type === 0xff) {
        continue;
      }
      const target = this._targets[i];
      if (target instanceof Craft) {
        const craft = target;
        craft.changeRules(this.requireCraftRule(rules.getCrafts()[type]));
        const weapons: Array<{ type: string; ammo?: number }> = [];
        const leftWeapon = this.u8(data, offset + rules.getOffset("CRAFT.DAT_LEFT_WEAPON"));
        const leftAmmo = this.u16(data, offset + rules.getOffset("CRAFT.DAT_LEFT_AMMO"));
        weapons.push(leftWeapon !== 0xff ? { type: rules.getCraftWeapons()[leftWeapon], ammo: leftAmmo } : { type: "0" });
        const flight = this.u8(data, offset + rules.getOffset("CRAFT.DAT_FLIGHT"));
        const rightWeapon = this.u8(data, offset + rules.getOffset("CRAFT.DAT_RIGHT_WEAPON"));
        const rightAmmo = this.u8(data, offset + rules.getOffset("CRAFT.DAT_RIGHT_AMMO"));
        weapons.push(rightWeapon !== 0xff ? { type: rules.getCraftWeapons()[rightWeapon], ammo: rightAmmo } : { type: "0" });

        const dest = this.u16(data, offset + rules.getOffset("CRAFT.DAT_DESTINATION"));
        const baseIndex = this.u16(data, offset + rules.getOffset("CRAFT.DAT_BASE"));
        const items: Record<string, number> = {};
        const vehicles: Array<{ type: string; ammo?: number; size?: number }> = [];
        const itemOffset = rules.getOffset("CRAFT.DAT_ITEMS");
        const vehicleCount = 5;
        for (let k = 0; k < vehicleCount; ++k) {
          const qty = this.u8(data, offset + itemOffset + k);
          const item = rules.getItems()[k + 10];
          for (let v = 0; v < qty; ++v) {
            const rule = this.requireItemRule(item);
            const vehicle = new Vehicle(rule, rule.getClipSize(), 4);
            vehicles.push({ type: vehicle.getRules().getType(), ammo: vehicle.getAmmo(), size: vehicle.getSize() });
          }
        }
        const itemCount = 50;
        for (let k = vehicleCount; k < vehicleCount + itemCount; ++k) {
          const qty = this.u8(data, offset + itemOffset + k);
          const item = rules.getItems()[k + 10];
          if (qty !== 0 && item.length > 0) {
            items[item] = (items[item] || 0) + qty;
          }
        }
        const state = this.i32(data, offset + rules.getOffset("CRAFT.DAT_STATE"));
        const node: CraftSaveNode = {
          type: craft.getType(),
          damage: this.u16(data, offset + rules.getOffset("CRAFT.DAT_DAMAGE")),
          speed: this.u16(data, offset + rules.getOffset("CRAFT.DAT_SPEED")),
          fuel: this.u16(data, offset + rules.getOffset("CRAFT.DAT_FUEL")),
          status: XCOM_STATUS[this.u16(data, offset + rules.getOffset("CRAFT.DAT_STATUS"))] || XCOM_STATUS[0],
          lowFuel: (state & (1 << 1)) !== 0,
          items,
          weapons,
          vehicles
        };
        craft.load(
          node,
          weaponType => mod.getCraftWeapon(weaponType),
          itemType => mod.getItem(itemType, true)
        );
        if (flight !== 0 && dest !== 0xffff) {
          const destination = this._targets[dest];
          if (destination) {
            craft.setDestination(destination);
          }
        }
        if (baseIndex !== 0xffff) {
          const base = this._targets[baseIndex];
          if (base instanceof Base) {
            craft.setBase(base, false);
            base.getCrafts().push(craft);
          }
        }
      }
      if (target instanceof Ufo) {
        const ufo = target;
        const ufoRule = mod.getUfo(rules.getUfos()[type - 5], true);
        ufo.changeRules(ufoRule!);
        const mission = this.u16(data, offset + rules.getOffset("CRAFT.DAT_MISSION"));
        const region = this.u16(data, offset + rules.getOffset("CRAFT.DAT_REGION"));
        const key = this.missionKey(mission, region);
        let alienMission = this._missions.get(key) || null;
        let trajectory = "";
        if (!alienMission) {
          const missionRule = mod.getAlienMission(rules.getMissions()[mission], true);
          alienMission = new AlienMission(missionRule!);
          alienMission.load({
            region: rules.getRegions()[region],
            race: rules.getCrews()[this.u16(data, offset + rules.getOffset("CRAFT.DAT_RACE"))],
            nextWave: 1,
            nextUfoCounter: 0,
            spawnCountdown: 1000,
            uniqueID: save.getId("ALIEN_MISSIONS")
          }, save);
          save.getAlienMissions().push(alienMission);
          this._missions.set(key, alienMission);
          if (mission === 6) {
            trajectory = UfoTrajectory.RETALIATION_ASSAULT_RUN;
          }
        }
        alienMission.increaseLiveUfos();
        if (trajectory.length === 0) {
          trajectory = `P${this.u16(data, offset + rules.getOffset("CRAFT.DAT_TRAJECTORY"))}`;
        }
        const state = this.i32(data, offset + rules.getOffset("CRAFT.DAT_STATE"));
        const node: UfoSaveNode = {
          damage: this.u16(data, offset + rules.getOffset("CRAFT.DAT_DAMAGE")),
          altitude: XCOM_ALTITUDES[this.u16(data, offset + rules.getOffset("CRAFT.DAT_ALTITUDE"))] || XCOM_ALTITUDES[0],
          speed: this.u16(data, offset + rules.getOffset("CRAFT.DAT_SPEED")),
          dest: {
            lon: Xcom2Rad(this.s16(data, offset + rules.getOffset("CRAFT.DAT_DEST_LON"))),
            lat: Xcom2Rad(this.s16(data, offset + rules.getOffset("CRAFT.DAT_DEST_LAT")))
          },
          mission: alienMission.getId(),
          trajectory,
          trajectoryPoint: this.u16(data, offset + rules.getOffset("CRAFT.DAT_TRAJECTORY_POINT")),
          hyperDetected: (state & (1 << 6)) !== 0
        };
        ufo.load(node, mod, save);
        ufo.setSpeed(ufo.getSpeed());
        if (ufo.getStatus() === UfoStatus.CRASHED) {
          ufo.setSecondsRemaining(ufo.getSecondsRemaining() * 3600);
        } else if (ufo.getStatus() === UfoStatus.LANDED) {
          ufo.setSecondsRemaining(ufo.getSecondsRemaining() * 5);
        } else {
          ufo.setSecondsRemaining(0);
        }
        save.getUfos().push(ufo);
      }
    }
  }

  private loadDatSoldier(): void {
    const save = this.requireSave();
    const mod = this.requireMod();
    const rules = this.requireRules();
    const data = this.binaryBuffer("SOLDIER.DAT");
    const soldiers = 250;
    const entrySize = Math.trunc(data.length / soldiers);
    this._soldiers = [];
    for (let i = 0; i < soldiers; ++i) {
      const offset = i * entrySize;
      const rank = this.u16(data, offset + rules.getOffset("SOLDIER.DAT_RANK"));
      if (rank === 0xffff) {
        this._soldiers.push(null);
        continue;
      }
      const baseIndex = this.u16(data, offset + rules.getOffset("SOLDIER.DAT_BASE"));
      const craftIndex = this.u16(data, offset + rules.getOffset("SOLDIER.DAT_CRAFT"));
      const initialStats = {
        tu: this.u8(data, offset + rules.getOffset("SOLDIER.DAT_INITIAL_TU")),
        health: this.u8(data, offset + rules.getOffset("SOLDIER.DAT_INITIAL_HE")),
        stamina: this.u8(data, offset + rules.getOffset("SOLDIER.DAT_INITIAL_STA")),
        reactions: this.u8(data, offset + rules.getOffset("SOLDIER.DAT_INITIAL_RE")),
        strength: this.u8(data, offset + rules.getOffset("SOLDIER.DAT_INITIAL_STR")),
        firing: this.u8(data, offset + rules.getOffset("SOLDIER.DAT_INITIAL_FA")),
        throwing: this.u8(data, offset + rules.getOffset("SOLDIER.DAT_INITIAL_TA")),
        melee: this.u8(data, offset + rules.getOffset("SOLDIER.DAT_INITIAL_ME")),
        psiStrength: this.u8(data, offset + rules.getOffset("SOLDIER.DAT_INITIAL_PST")),
        psiSkill: this.u8(data, offset + rules.getOffset("SOLDIER.DAT_INITIAL_PSK")),
        bravery: 110 - 10 * this.u8(data, offset + rules.getOffset("SOLDIER.DAT_INITIAL_BR"))
      };
      const currentStats = {
        tu: initialStats.tu + this.u8(data, offset + rules.getOffset("SOLDIER.DAT_IMPROVED_TU")),
        health: initialStats.health + this.u8(data, offset + rules.getOffset("SOLDIER.DAT_IMPROVED_HE")),
        stamina: initialStats.stamina + this.u8(data, offset + rules.getOffset("SOLDIER.DAT_IMPROVED_STA")),
        reactions: initialStats.reactions + this.u8(data, offset + rules.getOffset("SOLDIER.DAT_IMPROVED_RE")),
        strength: initialStats.strength + this.u8(data, offset + rules.getOffset("SOLDIER.DAT_IMPROVED_STR")),
        firing: initialStats.firing + this.u8(data, offset + rules.getOffset("SOLDIER.DAT_IMPROVED_FA")),
        throwing: initialStats.throwing + this.u8(data, offset + rules.getOffset("SOLDIER.DAT_IMPROVED_TA")),
        melee: initialStats.melee + this.u8(data, offset + rules.getOffset("SOLDIER.DAT_IMPROVED_ME")),
        psiStrength: initialStats.psiStrength,
        psiSkill: initialStats.psiSkill,
        bravery: initialStats.bravery + 10 * this.u8(data, offset + rules.getOffset("SOLDIER.DAT_IMPROVED_BR"))
      };
      const armor = this.u8(data, offset + rules.getOffset("SOLDIER.DAT_ARMOR"));
      const node: SoldierSaveNode = {
        missions: this.s16(data, offset + rules.getOffset("SOLDIER.DAT_MISSIONS")),
        kills: this.s16(data, offset + rules.getOffset("SOLDIER.DAT_KILLS")),
        recovery: this.s16(data, offset + rules.getOffset("SOLDIER.DAT_RECOVERY")),
        name: this.cString(data, offset + rules.getOffset("SOLDIER.DAT_NAME")),
        rank,
        initialStats,
        currentStats,
        armor: rules.getArmor()[armor],
        improvement: this.u8(data, offset + rules.getOffset("SOLDIER.DAT_PSI")),
        psiTraining: this.u8(data, offset + rules.getOffset("SOLDIER.DAT_PSILAB")) !== 0,
        gender: this.u8(data, offset + rules.getOffset("SOLDIER.DAT_GENDER")),
        look: this.u8(data, offset + rules.getOffset("SOLDIER.DAT_LOOK")),
        id: save.getId("STR_SOLDIER")
      };
      const soldier = new Soldier(this.requireSoldierRule(), null);
      soldier.load(node, mod, save);
      if (baseIndex !== 0xffff) {
        const base = this._targets[baseIndex];
        if (base instanceof Base) {
          base.getSoldiers().push(soldier);
        }
      }
      if (craftIndex !== 0xffff) {
        const craft = this._targets[craftIndex];
        if (craft instanceof Craft) {
          soldier.setCraft(craft);
        }
      }
      this._soldiers.push(soldier);
    }
  }

  private loadDatTransfer(): void {
    const rules = this.requireRules();
    const save = this.requireSave();
    const data = this.binaryBuffer("TRANSFER.DAT");
    const entrySize = 8;
    const entries = Math.trunc(data.length / entrySize);
    for (let i = 0; i < entries; ++i) {
      const offset = i * entrySize;
      const qty = this.u8(data, offset + 0x06);
      if (qty === 0) {
        continue;
      }
      const baseSrc = this.u8(data, offset + 0x00);
      const baseDest = this.u8(data, offset + 0x01);
      const base = this._targets[baseDest];
      if (!(base instanceof Base)) {
        continue;
      }
      const hours = this.u8(data, offset + 0x02);
      const type = this.u8(data, offset + 0x03) as TransferType;
      const dat = this.u8(data, offset + 0x04);
      const transfer = new Transfer(hours);
      switch (type) {
        case TransferType.TRANSFER_CRAFT:
          if (baseSrc === 0xff) {
            const newCraft = rules.getCrafts()[dat];
            transfer.setCraft(new Craft(this.requireCraftRule(newCraft), base, save.getId(newCraft)));
          } else {
            const craft = this._targets[dat];
            transfer.setCraft(craft instanceof Craft ? craft : null);
          }
          break;
        case TransferType.TRANSFER_SOLDIER:
          transfer.setSoldier(this._soldiers[dat] || null);
          break;
        case TransferType.TRANSFER_SCIENTIST:
          transfer.setScientists(qty);
          break;
        case TransferType.TRANSFER_ENGINEER:
          transfer.setEngineers(qty);
          break;
        default:
          if (type === TransferType.TRANSFER_ITEM) {
            transfer.setItems(rules.getItems()[dat], qty);
          } else {
            transfer.setItems(this._aliens[dat]);
          }
          break;
      }
      base.getTransfers().push(transfer);
    }
  }

  private loadDatResearch(): void {
    const rules = this.requireRules();
    const mod = this.requireMod();
    const save = this.requireSave();
    const data = this.binaryBuffer("RESEARCH.DAT");
    const researchList = rules.getResearch();
    const entrySize = Math.trunc(data.length / researchList.length);
    for (let i = 0; i < researchList.length; ++i) {
      const researchName = researchList[i];
      if (!researchName) {
        continue;
      }
      const research = mod.getResearch(researchName);
      if (!research || research.getCost() === 0) {
        continue;
      }
      const offset = i * entrySize;
      const discovered = this.u8(data, offset + 0x0a) !== 0;
      const popped = this.u8(data, offset + 0x12) !== 0;
      if (discovered) {
        save.addFinishedResearch(research, mod, null, false);
      } else if (popped) {
        save.addPoppedResearch(research);
      }
    }
  }

  private loadDatUp(): void {
    const rules = this.requireRules();
    const mod = this.requireMod();
    const save = this.requireSave();
    const data = this.binaryBuffer("UP.DAT");
    const ufopaediaList = rules.getUfopaedia();
    const entrySize = Math.trunc(data.length / ufopaediaList.length);
    for (let i = 0; i < ufopaediaList.length; ++i) {
      const article = mod.getUfopaediaArticle(ufopaediaList[i]);
      if (!article || article.section === UFOPAEDIA_NOT_AVAILABLE) {
        continue;
      }
      const offset = i * entrySize;
      const discovered = this.u8(data, offset + 0x08) === 2;
      if (!discovered) {
        continue;
      }
      for (const requirement of article._requires) {
        const research = mod.getResearch(requirement);
        if (research && research.getCost() === 0) {
          save.addFinishedResearch(research, mod, null, false);
        }
      }
    }
  }

  private loadDatProject(): void {
    const rules = this.requireRules();
    const mod = this.requireMod();
    const save = this.requireSave();
    const data = this.binaryBuffer("PROJECT.DAT");
    const researchList = rules.getResearch();
    const entries = researchList.length;
    const entrySize = entries * 3;
    for (let i = 0; i < save.getBases().length; ++i) {
      const base = save.getBases()[i];
      const baseOffset = i * entrySize;
      for (let j = 0; j < entries; ++j) {
        const remaining = this.u16(data, baseOffset + j * 2);
        const scientists = this.u8(data, baseOffset + entries * 2 + j);
        const researchName = researchList[j];
        if (remaining === 0 || !researchName) {
          continue;
        }
        const research = mod.getResearch(researchName);
        if (!research || research.getCost() === 0) {
          continue;
        }
        const project = new ResearchProject(research, research.getCost());
        project.setAssigned(scientists);
        project.setSpent(project.getCost() - remaining);
        base.addResearch(project);
        base.setScientists(base.getScientists() - scientists);
      }
    }
  }

  private loadDatBProd(): void {
    const rules = this.requireRules();
    const mod = this.requireMod();
    const save = this.requireSave();
    const data = this.binaryBuffer("BPROD.DAT");
    const manufactureList = rules.getManufacture();
    const entries = manufactureList.length;
    const entrySize = entries * 10;
    for (let i = 0; i < save.getBases().length; ++i) {
      const base = save.getBases()[i];
      const baseOffset = i * entrySize;
      for (let j = 0; j < entries; ++j) {
        const remaining = this.i32(data, baseOffset + j * 4);
        const engineers = this.u16(data, baseOffset + entries * 4 + j * 2);
        const total = this.u16(data, baseOffset + entries * 6 + j * 2);
        const produced = this.u16(data, baseOffset + entries * 8 + j * 2);
        const manufactureName = manufactureList[j];
        if (remaining === 0 || !manufactureName) {
          continue;
        }
        const manufacture = mod.getManufacture(manufactureName);
        if (!manufacture) {
          continue;
        }
        const project = new Production(manufacture, total);
        project.setAssignedEngineers(engineers);
        project.setTimeSpent(produced * manufacture.getManufactureTime() + manufacture.getManufactureTime() - remaining);
        base.addProduction(project);
        base.setEngineers(base.getEngineers() - engineers);
      }
    }
  }

  private loadDatXBases(): void {
    const data = this.binaryBuffer("XBASES.DAT");
    const regions = 12;
    for (let i = 0; i < regions; ++i) {
      const offset = i * 4;
      const detected = this.u16(data, offset + 0x00) !== 0;
      if (!detected) {
        continue;
      }
      const loc = this.u16(data, offset + 0x02);
      const base = this._targets[loc];
      if (base instanceof Base) {
        base.setRetaliationTarget(true);
      }
    }
  }

  private loadDatZonal(): void {
    const rules = this.requireRules();
    const save = this.requireSave();
    const data = this.binaryBuffer("ZONAL.DAT");
    const chances: Record<string, number> = {};
    const regions = 12;
    for (let i = 0; i < regions; ++i) {
      chances[rules.getRegions()[i]] = this.u8(data, i);
    }
    save.getAlienStrategy().load({ regions: chances });
  }

  private loadDatActs(): void {
    const rules = this.requireRules();
    const save = this.requireSave();
    const data = this.binaryBuffer("ACTS.DAT");
    const regions = 12;
    const missions = 7;
    const chances = new Map<string, Record<string, number>>();
    for (let i = 0; i < regions * missions; ++i) {
      const mission = i % missions;
      const region = Math.trunc(i / missions);
      const regionName = rules.getRegions()[region];
      let regionChances = chances.get(regionName);
      if (!regionChances) {
        regionChances = {};
        chances.set(regionName, regionChances);
      }
      regionChances[rules.getMissions()[mission]] = this.u8(data, i);
    }
    save.getAlienStrategy().load({
      possibleMissions: [...chances.entries()].map(([region, regionMissions]) => ({ region, missions: regionMissions }))
    });
  }

  private loadDatMissions(): void {
    const rules = this.requireRules();
    const mod = this.requireMod();
    const save = this.requireSave();
    const data = this.binaryBuffer("MISSIONS.DAT");
    const regions = 12;
    const missions = 7;
    const entrySize = 8;
    for (let i = 0; i < regions * missions; ++i) {
      const offset = i * entrySize;
      const wave = this.u16(data, offset + 0x00);
      if (wave === 0xffff) {
        continue;
      }
      const ufoCounter = this.u16(data, offset + 0x02);
      const spawn = this.u16(data, offset + 0x04);
      const race = this.u16(data, offset + 0x06);
      const mission = i % missions;
      const region = Math.trunc(i / missions);
      const missionName = rules.getMissions()[mission];
      const regionName = rules.getRegions()[region];
      const alienMission = new AlienMission(mod.getAlienMission(missionName, true)!);
      const node = {
        region: regionName,
        race: rules.getCrews()[race],
        nextWave: wave,
        nextUfoCounter: ufoCounter,
        spawnCountdown: spawn * 30,
        uniqueID: save.getId("ALIEN_MISSIONS"),
        missionSiteZone: undefined as number | undefined
      };
      if (alienMission.getRules().getObjective() === MissionObjective.OBJECTIVE_SITE) {
        let missionZone = 3;
        const rule = mod.getRegion(regionName);
        if (!rule) {
          throw new Error(`Region rule ${regionName} not found.`);
        }
        const zones = rule?.getMissionZones() || [];
        if (zones.length <= 3) {
          missionZone = 0;
        }
        const zone = zones[missionZone];
        if (zone) {
          node.missionSiteZone = RNG.generate(0, zone.areas.length - 1);
        }
      }
      alienMission.load(node, save);
      save.getAlienMissions().push(alienMission);
      this._missions.set(this.missionKey(mission, region), alienMission);
    }
  }
}
