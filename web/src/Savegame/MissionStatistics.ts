import type { Language } from "../Engine/Language.ts";
import { TileEngine } from "../Battlescape/TileEngine.ts";
import { GameTime } from "./GameTime.ts";

export type GameTimeSave = {
  second?: number;
  minute?: number;
  hour?: number;
  weekday?: number;
  day?: number;
  month?: number;
  year?: number;
};

export type MissionStatisticsSave = {
  id?: number;
  markerName?: string;
  markerId?: number;
  time?: GameTimeSave;
  region?: string;
  country?: string;
  type?: string;
  ufo?: string;
  success?: boolean;
  score?: number;
  rating?: string;
  alienRace?: string;
  daylight?: number;
  injuryList?: Map<number, number> | Record<string, number> | Array<[number, number]>;
  valiantCrux?: boolean;
  lootValue?: number;
};

function intValue(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.trunc(value) : fallback;
}

function stringValue(value: unknown, fallback: string): string {
  return typeof value === "string" ? value : fallback;
}

function boolValue(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function loadGameTime(node: GameTimeSave | undefined, fallback: GameTime): GameTime {
  if (!node) {
    return fallback.clone();
  }
  return new GameTime(
    intValue(node.weekday, fallback.getWeekday()),
    intValue(node.day, fallback.getDay()),
    intValue(node.month, fallback.getMonth()),
    intValue(node.year, fallback.getYear()),
    intValue(node.hour, fallback.getHour()),
    intValue(node.minute, fallback.getMinute()),
    intValue(node.second, fallback.getSecond())
  );
}

function saveGameTime(time: GameTime): GameTimeSave {
  return {
    second: time.getSecond(),
    minute: time.getMinute(),
    hour: time.getHour(),
    weekday: time.getWeekday(),
    day: time.getDay(),
    month: time.getMonth(),
    year: time.getYear()
  };
}

function loadInjuryList(source: MissionStatisticsSave["injuryList"], fallback: Map<number, number>): Map<number, number> {
  if (!source) {
    return new Map(fallback);
  }
  if (source instanceof Map) {
    return new Map([...source.entries()].map(([key, value]) => [Math.trunc(Number(key)), Math.trunc(Number(value) || 0)]));
  }
  if (Array.isArray(source)) {
    return new Map(source.map(([key, value]) => [Math.trunc(Number(key)), Math.trunc(Number(value) || 0)]));
  }
  return new Map(Object.entries(source).map(([key, value]) => [Math.trunc(Number(key)), Math.trunc(Number(value) || 0)]));
}

/**
 * Container for mission statistics.
 */
export class MissionStatistics {
  id = 0;
  markerName = "";
  markerId = 0;
  time = new GameTime(0, 0, 0, 0, 0, 0, 0);
  region = "STR_REGION_UNKNOWN";
  country = "STR_UNKNOWN";
  type = "";
  ufo = "NO_UFO";
  success = false;
  rating = "";
  score = 0;
  alienRace = "STR_UNKNOWN";
  daylight = 0;
  injuryList = new Map<number, number>();
  valiantCrux = false;
  lootValue = 0;

  constructor(node?: MissionStatisticsSave) {
    if (node) {
      this.load(node);
    }
  }

  load(node: MissionStatisticsSave): void {
    this.id = intValue(node.id, this.id);
    this.markerName = stringValue(node.markerName, this.markerName);
    this.markerId = intValue(node.markerId, this.markerId);
    this.time = loadGameTime(node.time, this.time);
    this.region = stringValue(node.region, this.region);
    this.country = stringValue(node.country, this.country);
    this.type = stringValue(node.type, this.type);
    this.ufo = stringValue(node.ufo, this.ufo);
    this.success = boolValue(node.success, this.success);
    this.score = intValue(node.score, this.score);
    this.rating = stringValue(node.rating, this.rating);
    this.alienRace = stringValue(node.alienRace, this.alienRace);
    this.daylight = intValue(node.daylight, this.daylight);
    this.injuryList = loadInjuryList(node.injuryList, this.injuryList);
    this.valiantCrux = boolValue(node.valiantCrux, this.valiantCrux);
    this.lootValue = intValue(node.lootValue, this.lootValue);
  }

  save(): MissionStatisticsSave {
    const node: MissionStatisticsSave = {
      id: this.id,
      time: saveGameTime(this.time),
      region: this.region,
      country: this.country,
      type: this.type,
      ufo: this.ufo,
      success: this.success,
      score: this.score,
      rating: this.rating,
      alienRace: this.alienRace,
      daylight: this.daylight,
      injuryList: Object.fromEntries(this.injuryList)
    };
    if (this.markerName) {
      node.markerName = this.markerName;
      node.markerId = this.markerId;
    }
    if (this.valiantCrux) {
      node.valiantCrux = this.valiantCrux;
    }
    if (this.lootValue) {
      node.lootValue = this.lootValue;
    }
    return node;
  }

  getMissionName(lang: Language): string {
    if (this.markerName) {
      return String(lang.getString(this.markerName).arg(this.markerId));
    }
    return String(lang.getString(this.type));
  }

  getRatingString(lang: Language): string {
    const result = this.success ? String(lang.getString("STR_VICTORY")) : String(lang.getString("STR_DEFEAT"));
    return `${result} - ${String(lang.getString(this.rating))}`;
  }

  getLocationString(): string {
    return this.country === "STR_UNKNOWN" ? this.region : this.country;
  }

  isDarkness(): boolean {
    return this.daylight > TileEngine.MAX_DARKNESS_TO_SEE_UNITS;
  }

  getDaylightString(): string {
    return this.isDarkness() ? "STR_NIGHT" : "STR_DAY";
  }

  isAlienBase(): boolean {
    return this.type.includes("STR_ALIEN_BASE") || this.type.includes("STR_ALIEN_COLONY");
  }

  isBaseDefense(): boolean {
    return this.type === "STR_BASE_DEFENSE";
  }

  isUfoMission(): boolean {
    return this.ufo !== "NO_UFO";
  }
}
