import { WeightedOptions } from "../Savegame/WeightedOptions.ts";

export type ItemSet = {
  items: string[];
};

export type DeploymentData = {
  alienRank: number;
  lowQty: number;
  highQty: number;
  dQty: number;
  extraQty: number;
  percentageOutsideUfo: number;
  itemSets: ItemSet[];
};

export type BriefingData = {
  palette: number;
  textOffset: number;
  title: string;
  desc: string;
  music: string;
  background: string;
  cutscene: string;
  showCraft: boolean;
  showTarget: boolean;
};

export enum ChronoTrigger {
  FORCE_LOSE = 0,
  FORCE_ABORT,
  FORCE_WIN
}

export enum EscapeType {
  ESCAPE_NONE = 0,
  ESCAPE_EXIT,
  ESCAPE_ENTRY,
  ESCAPE_EITHER
}

export type AlienDeploymentDefinition = {
  type: string;
  data: DeploymentData[];
  width?: number;
  length?: number;
  height?: number;
  civilians?: number;
  terrains?: string[];
  music?: string[];
  shade?: number;
  nextStage?: string;
  race?: string;
  script?: string;
  finalDestination?: boolean;
  alienBase?: boolean;
  winCutscene?: string;
  loseCutscene?: string;
  abortCutscene?: string;
  alert?: string;
  alertBackground?: string;
  briefing?: Partial<BriefingData>;
  markerName?: string;
  markerIcon?: number;
  duration?: number[];
  depth?: number[];
  objectiveType?: number;
  objectivesRequired?: number;
  objectivePopup?: string;
  objectiveComplete?: [string, number];
  objectiveFailed?: [string, number];
  despawnPenalty?: number;
  points?: number;
  turnLimit?: number;
  cheatTurn?: number;
  chronoTrigger?: number;
  escapeType?: number;
  genMission?: Record<string, number>;
  genMissionFreq?: number;
};

function createBriefingData(source: Partial<BriefingData> = {}): BriefingData {
  return {
    palette: source.palette ?? 0,
    textOffset: source.textOffset ?? 0,
    title: source.title ?? "",
    desc: source.desc ?? "",
    music: source.music ?? "GMDEFEND",
    background: source.background ?? "BACK16.SCR",
    cutscene: source.cutscene ?? "",
    showCraft: source.showCraft ?? true,
    showTarget: source.showTarget ?? true
  };
}

function createDeploymentData(): DeploymentData {
  return {
    alienRank: 0,
    lowQty: 0,
    highQty: 0,
    dQty: 0,
    extraQty: 0,
    percentageOutsideUfo: 0,
    itemSets: []
  };
}

function stripComment(line: string): string {
  let quoted = false;
  let quote = "";
  for (let i = 0; i < line.length; ++i) {
    const ch = line[i];
    if ((ch === "\"" || ch === "'") && (i === 0 || line[i - 1] !== "\\")) {
      if (!quoted) {
        quoted = true;
        quote = ch;
      } else if (quote === ch) {
        quoted = false;
      }
    }
    if (ch === "#" && !quoted) {
      return line.slice(0, i);
    }
  }
  return line;
}

function unquote(value: string): string {
  const trimmed = value.trim();
  if ((trimmed.startsWith("\"") && trimmed.endsWith("\"")) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function parseNumber(value: string): number | undefined {
  const n = Number(value.trim());
  return Number.isFinite(n) ? n : undefined;
}

function parseBool(value: string): boolean {
  return value.trim() === "true";
}

function parseInlineList(value: string): string[] {
  const match = /^\[\s*(.*)\s*\]$/.exec(value.trim());
  if (!match) {
    return [];
  }
  const inside = match[1].trim();
  if (!inside) {
    return [];
  }
  return inside.split(",").map(part => unquote(part.trim()));
}

function parseNumberList(value: string): number[] {
  const values: number[] = [];
  for (const part of parseInlineList(value)) {
    const n = parseNumber(part);
    if (n == null) {
      return [];
    }
    values.push(n);
  }
  return values;
}

function parseStringScore(value: string): [string, number] | undefined {
  const values = parseInlineList(value);
  if (values.length < 2) {
    return undefined;
  }
  const score = parseNumber(values[1]);
  if (score == null) {
    return undefined;
  }
  return [values[0], score];
}

function setNumericProp(target: Record<string, unknown>, key: string, value: string): void {
  const n = parseNumber(value);
  if (n != null) {
    target[key] = n;
  }
}

function setDeploymentProp(target: AlienDeploymentDefinition, key: string, value: string): void {
  switch (key) {
    case "type":
    case "nextStage":
    case "race":
    case "script":
    case "winCutscene":
    case "loseCutscene":
    case "abortCutscene":
    case "alert":
    case "alertBackground":
    case "markerName":
    case "objectivePopup":
      (target as Record<string, unknown>)[key] = unquote(value);
      break;
    case "width":
    case "length":
    case "height":
    case "civilians":
    case "shade":
    case "markerIcon":
    case "objectiveType":
    case "objectivesRequired":
    case "despawnPenalty":
    case "points":
    case "turnLimit":
    case "cheatTurn":
    case "chronoTrigger":
    case "escapeType":
    case "genMissionFreq":
      setNumericProp(target as Record<string, unknown>, key, value);
      break;
    case "finalDestination":
    case "alienBase":
      (target as Record<string, unknown>)[key] = parseBool(value);
      break;
    case "depth":
    case "duration":
      (target as Record<string, unknown>)[key] = parseNumberList(value);
      break;
    case "objectiveComplete": {
      const parsed = parseStringScore(value);
      if (parsed) {
        target.objectiveComplete = parsed;
      }
      break;
    }
    case "objectiveFailed": {
      const parsed = parseStringScore(value);
      if (parsed) {
        target.objectiveFailed = parsed;
      }
      break;
    }
    default:
      break;
  }
}

function setDataProp(target: DeploymentData, key: string, value: string): void {
  switch (key) {
    case "alienRank":
    case "lowQty":
    case "highQty":
    case "dQty":
    case "extraQty":
    case "percentageOutsideUfo":
      setNumericProp(target as unknown as Record<string, unknown>, key, value);
      break;
    default:
      break;
  }
}

function setBriefingProp(target: Partial<BriefingData>, key: string, value: string): void {
  switch (key) {
    case "title":
    case "desc":
    case "music":
    case "background":
    case "cutscene":
      (target as Record<string, unknown>)[key] = unquote(value);
      break;
    case "palette":
    case "textOffset":
      setNumericProp(target as Record<string, unknown>, key, value);
      break;
    case "showCraft":
    case "showTarget":
      (target as Record<string, unknown>)[key] = parseBool(value);
      break;
    default:
      break;
  }
}

export class AlienDeployment {
  private _data: DeploymentData[] = [];
  private _width = 0;
  private _length = 0;
  private _height = 0;
  private _civilians = 0;
  private _terrains: string[] = [];
  private _music: string[] = [];
  private _shade = -1;
  private _nextStage = "";
  private _race = "";
  private _script = "";
  private _finalDestination = false;
  private _isAlienBase = false;
  private _winCutscene = "";
  private _loseCutscene = "";
  private _abortCutscene = "";
  private _alert = "STR_ALIENS_TERRORISE";
  private _alertBackground = "BACK03.SCR";
  private _briefingData = createBriefingData();
  private _markerName = "STR_TERROR_SITE";
  private _objectivePopup = "";
  private _objectiveCompleteText = "";
  private _objectiveFailedText = "";
  private _genMission = new WeightedOptions();
  private _markerIcon = -1;
  private _durationMin = 0;
  private _durationMax = 0;
  private _minDepth = 0;
  private _maxDepth = 0;
  private _genMissionFrequency = 0;
  private _objectiveType = -1;
  private _objectivesRequired = 0;
  private _objectiveCompleteScore = 0;
  private _objectiveFailedScore = 0;
  private _despawnPenalty = 0;
  private _points = 0;
  private _turnLimit = 0;
  private _cheatTurn = 20;
  private _chronoTrigger = ChronoTrigger.FORCE_LOSE;
  private _escapeType = EscapeType.ESCAPE_NONE;

  constructor(private _type: string) {}

  load(node: AlienDeploymentDefinition): void {
    this._type = node.type || this._type;
    this._data = node.data.map(data => ({ ...data, itemSets: data.itemSets.map(itemSet => ({ items: [...itemSet.items] })) }));
    this._width = node.width ?? this._width;
    this._length = node.length ?? this._length;
    this._height = node.height ?? this._height;
    this._civilians = node.civilians ?? this._civilians;
    this._terrains = [...(node.terrains || this._terrains)];
    this._shade = node.shade ?? this._shade;
    this._nextStage = node.nextStage ?? this._nextStage;
    this._race = node.race ?? this._race;
    this._finalDestination = node.finalDestination ?? this._finalDestination;
    this._winCutscene = node.winCutscene ?? this._winCutscene;
    this._loseCutscene = node.loseCutscene ?? this._loseCutscene;
    this._abortCutscene = node.abortCutscene ?? this._abortCutscene;
    this._script = node.script ?? this._script;
    this._alert = node.alert ?? this._alert;
    this._alertBackground = node.alertBackground ?? this._alertBackground;
    this._briefingData = createBriefingData({ ...this._briefingData, ...(node.briefing || {}) });
    this._markerName = node.markerName ?? this._markerName;
    this._markerIcon = node.markerIcon ?? this._markerIcon;
    if (node.depth && node.depth.length >= 2) {
      this._minDepth = node.depth[0];
      this._maxDepth = node.depth[1];
    }
    if (node.duration && node.duration.length >= 2) {
      this._durationMin = node.duration[0];
      this._durationMax = node.duration[1];
    }
    this._music = [...(node.music || this._music)];
    this._objectiveType = node.objectiveType ?? this._objectiveType;
    this._objectivesRequired = node.objectivesRequired ?? this._objectivesRequired;
    this._objectivePopup = node.objectivePopup ?? this._objectivePopup;
    if (node.objectiveComplete) {
      this._objectiveCompleteText = node.objectiveComplete[0];
      this._objectiveCompleteScore = node.objectiveComplete[1];
    }
    if (node.objectiveFailed) {
      this._objectiveFailedText = node.objectiveFailed[0];
      this._objectiveFailedScore = node.objectiveFailed[1];
    }
    this._despawnPenalty = node.despawnPenalty ?? this._despawnPenalty;
    this._points = node.points ?? this._points;
    this._cheatTurn = node.cheatTurn ?? this._cheatTurn;
    this._turnLimit = node.turnLimit ?? this._turnLimit;
    this._chronoTrigger = node.chronoTrigger ?? this._chronoTrigger;
    this._isAlienBase = node.alienBase ?? this._isAlienBase;
    this._escapeType = node.escapeType ?? this._escapeType;
    this._genMission.clear();
    if (node.genMission) {
      this._genMission.load(node.genMission);
    }
    this._genMissionFrequency = node.genMissionFreq ?? this._genMissionFrequency;
  }

  getType(): string {
    return this._type;
  }

  getDeploymentData(): DeploymentData[] {
    return this._data;
  }

  getDimensions(): [number, number, number] {
    return [this._width, this._length, this._height];
  }

  getCivilians(): number {
    return this._civilians;
  }

  getTerrains(): string[] {
    return this._terrains;
  }

  getShade(): number {
    return this._shade;
  }

  getNextStage(): string {
    return this._nextStage;
  }

  getRace(): string {
    return this._race;
  }

  getScript(): string {
    return this._script;
  }

  isFinalDestination(): boolean {
    return this._finalDestination;
  }

  getWinCutscene(): string {
    return this._winCutscene;
  }

  getLoseCutscene(): string {
    return this._loseCutscene;
  }

  getAbortCutscene(): string {
    return this._abortCutscene;
  }

  getAlertMessage(): string {
    return this._alert;
  }

  getAlertBackground(): string {
    return this._alertBackground;
  }

  getBriefingData(): BriefingData {
    return this._briefingData;
  }

  getMarkerName(): string {
    return this._markerName;
  }

  getMarkerIcon(): number {
    return this._markerIcon;
  }

  getDurationMin(): number {
    return this._durationMin;
  }

  getDurationMax(): number {
    return this._durationMax;
  }

  getMusic(): string[] {
    return this._music;
  }

  getMinDepth(): number {
    return this._minDepth;
  }

  getMaxDepth(): number {
    return this._maxDepth;
  }

  getObjectiveType(): number {
    return this._objectiveType;
  }

  getObjectivesRequired(): number {
    return this._objectivesRequired;
  }

  getObjectivePopup(): string {
    return this._objectivePopup;
  }

  getObjectiveCompleteInfo(): { text: string; score: number; hasInfo: boolean } {
    return { text: this._objectiveCompleteText, score: this._objectiveCompleteScore, hasInfo: this._objectiveCompleteText.length > 0 };
  }

  getObjectiveFailedInfo(): { text: string; score: number; hasInfo: boolean } {
    return { text: this._objectiveFailedText, score: this._objectiveFailedScore, hasInfo: this._objectiveFailedText.length > 0 };
  }

  getDespawnPenalty(): number {
    return this._despawnPenalty;
  }

  getPoints(): number {
    return this._points;
  }

  getTurnLimit(): number {
    return this._turnLimit;
  }

  getChronoTrigger(): ChronoTrigger {
    return this._chronoTrigger;
  }

  getCheatTurn(): number {
    return this._cheatTurn;
  }

  isAlienBase(): boolean {
    return this._isAlienBase;
  }

  chooseGenMissionType(): string {
    return this._genMission.choose();
  }

  getGenMissionFrequency(): number {
    return this._genMissionFrequency;
  }

  getEscapeType(): EscapeType {
    return this._escapeType;
  }
}

export function parseAlienDeploymentsRul(source: string): AlienDeploymentDefinition[] {
  const definitions: AlienDeploymentDefinition[] = [];
  let current: AlienDeploymentDefinition | null = null;
  let currentData: DeploymentData | null = null;
  let currentItemSet: ItemSet | null = null;
  let section = "";
  let subSection = "";

  for (const raw of source.split(/\r?\n/)) {
    const line = stripComment(raw);
    if (!line.trim() || line.trim().startsWith("alienDeployments:")) {
      continue;
    }
    const indent = line.search(/\S|$/);
    const trimmed = line.trim();

    const start = /^-\s+type:\s*(.+)$/.exec(trimmed);
    if (indent === 2 && start) {
      current = { type: unquote(start[1]), data: [] };
      definitions.push(current);
      currentData = null;
      currentItemSet = null;
      section = "";
      subSection = "";
      continue;
    }

    if (!current) {
      continue;
    }

    const prop = /^([A-Za-z0-9_]+):\s*(.*)$/.exec(trimmed);
    if (indent === 4 && prop) {
      currentData = null;
      currentItemSet = null;
      subSection = "";
      if (prop[1] === "data" || prop[1] === "terrains" || prop[1] === "music" || prop[1] === "briefing" || prop[1] === "genMission") {
        section = prop[1];
        if (section === "terrains" || section === "music") {
          const list = parseInlineList(prop[2]);
          if (list.length > 0) {
            (current as Record<string, unknown>)[section] = list;
          } else {
            (current as Record<string, unknown>)[section] ||= [];
          }
        } else if (section === "briefing") {
          current.briefing ||= {};
        } else if (section === "genMission") {
          current.genMission ||= {};
        }
      } else {
        section = "";
        setDeploymentProp(current, prop[1], prop[2]);
      }
      continue;
    }

    if (section === "terrains" || section === "music") {
      if (indent === 6) {
        const entry = /^-\s+(.+)$/.exec(trimmed);
        if (entry) {
          const list = ((current as Record<string, unknown>)[section] ||= []) as string[];
          list.push(unquote(entry[1]));
        }
      }
      continue;
    }

    if (section === "briefing" && indent === 6 && prop) {
      current.briefing ||= {};
      setBriefingProp(current.briefing, prop[1], prop[2]);
      continue;
    }

    if (section === "genMission" && indent === 6) {
      const mission = /^([A-Za-z0-9_]+):\s*(.+)$/.exec(trimmed);
      if (mission) {
        const n = parseNumber(mission[2]);
        if (n != null) {
          current.genMission ||= {};
          current.genMission[mission[1]] = n;
        }
      }
      continue;
    }

    if (section !== "data") {
      continue;
    }

    const dataStart = /^-\s+alienRank:\s*(.+)$/.exec(trimmed);
    if (indent === 6 && dataStart) {
      currentData = createDeploymentData();
      setDataProp(currentData, "alienRank", dataStart[1]);
      current.data.push(currentData);
      currentItemSet = null;
      subSection = "";
      continue;
    }

    if (!currentData) {
      continue;
    }

    if (indent === 8 && prop) {
      currentItemSet = null;
      if (prop[1] === "itemSets") {
        subSection = "itemSets";
      } else {
        subSection = "";
        setDataProp(currentData, prop[1], prop[2]);
      }
      continue;
    }

    if (subSection === "itemSets" && indent === 10) {
      const emptyItemSet = /^-\s+\[\s*\]$/.exec(trimmed);
      if (emptyItemSet || trimmed === "-") {
        currentItemSet = { items: [] };
        currentData.itemSets.push(currentItemSet);
      }
      continue;
    }

    if (subSection === "itemSets" && indent === 12 && currentItemSet) {
      const item = /^-\s+(.+)$/.exec(trimmed);
      if (item) {
        currentItemSet.items.push(unquote(item[1]));
      }
    }
  }

  return definitions;
}
