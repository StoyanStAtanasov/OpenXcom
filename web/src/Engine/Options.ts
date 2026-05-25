import { SDL_KEYDOWN } from "../types.ts";
import { FileMap } from "./FileMap.ts";
import { Logger, LOG_INFO, LOG_VERBOSE, LOG_WARNING } from "./Logger.ts";
import { ModInfo } from "./ModInfo.ts";
import { OptionInfo } from "./OptionInfo.ts";

type ResourceManifest = {
  xcom1RulesetFiles?: string[];
  xcom2RulesetFiles?: string[];
  ufoPalettesDat?: string | null;
  ufoTerrainDir?: string | null;
  ufoMapsDir?: string | null;
  ufoRoutesDir?: string | null;
  ufoSoundDir?: string | null;
  tftdPalettesDat?: string | null;
  tftdTerrainDir?: string | null;
  tftdMapsDir?: string | null;
  tftdRoutesDir?: string | null;
  tftdSoundDir?: string | null;
  commonSoldierNameFiles?: string[];
  [key: string]: string | string[] | null | undefined;
};

export const SCALE_ORIGINAL = 0;
export const SCALE_15X = 1;
export const SCALE_2X = 2;
export const SCALE_SCREEN_DIV_3 = 3;
export const SCALE_SCREEN_DIV_2 = 4;
export const SCALE_SCREEN = 5;

export const MUSIC_MIDI = "MUSIC_MIDI";
export const KEYBOARD_OFF = 0;
export const KEYBOARD_ON = 1;
export const SCROLL_NONE = 0;
export const SCROLL_TRIGGER = 1;
export const SCROLL_AUTO = 2;
export const PATH_NONE = 0x00;
export const PATH_ARROWS = 0x01;
export const PATH_TU_COST = 0x02;
export const PATH_FULL = 0x03;

export class Options {
  static reload = false;
  static mute = false;
  static verboseLogging = false;
  static debug = false;
  static traceAI = false;
  static debugUi = false;
  static fpsCounter = false;
  static playIntro = false;
  static captureMouse = false;
  static backgroundMute = false;
  static touchEnabled = false;
  static rootWindowedMode = false;
  static newRootWindowedMode = false;
  static windowedModePositionX = 0;
  static windowedModePositionY = 0;
  static newWindowedModePositionX = 0;
  static newWindowedModePositionY = 0;
  static allowResize = true;
  static newAllowResize = true;
  static fullscreen = false;
  static newFullscreen = false;
  static borderless = false;
  static newBorderless = false;
  static keepAspectRatio = true;
  static nonSquarePixelRatio = false;
  static cursorInBlackBandsInFullscreen = true;
  static cursorInBlackBandsInWindow = true;
  static cursorInBlackBandsInBorderlessWindow = true;
  static useOpenGL = false;
  static newOpenGL = false;
  static vSyncForOpenGL = true;
  static useScaleFilter = false;
  static newScaleFilter = false;
  static useHQXFilter = false;
  static newHQXFilter = false;
  static useXBRZFilter = false;
  static newXBRZFilter = false;
  static useOpenGLSmoothing = false;
  static checkOpenGLErrors = false;
  static useOpenGLShader = "";
  static newOpenGLShader = "";
  static asyncBlit = false;
  static pauseMode = 0;
  static preferredMusic = MUSIC_MIDI;
  static preferredSound = 0;
  static preferredVideo = 0;
  static currentSound = 0;
  static soundVolume = 96;
  static musicVolume = 96;
  static uiVolume = 96;
  static musicAlwaysLoop = false;
  static audioBitDepth = 16;
  static audioSampleRate = 44100;
  static audioChunkSize = 2048;
  static maxFrameSkip = 8;
  static FPS = 60;
  static FPSInactive = 10;
  static geoClockSpeed = 250;
  static geoScrollSpeed = 20;
  static geoDragScrollButton = 2;
  static dogfightSpeed = 25;
  static battleScrollSpeed = 8;
  static battleEdgeScroll = 2;
  static battleFireSpeed = 4;
  static battleXcomSpeed = 30;
  static battleAlienSpeed = 30;
  static battleExplosionHeight = 0;
  static battleInstantGrenade = false;
  static battleNewPreviewPath = PATH_NONE;
  static battleDragScrollButton = 2;
  static battleDragScrollInvert = false;
  static dragScrollTimeTolerance = 100;
  static dragScrollPixelTolerance = 10;
  static battleSmoothCamera = false;
  static battleUFOExtenderAccuracy = false;
  static battleTooltips = true;
  static battleNotifyDeath = false;
  static allowPsiStrengthImprovement = false;
  static allowPsionicCapture = false;
  static psiStrengthEval = false;
  static fieldPromotions = false;
  static soldierDiaries = true;
  static skipNextTurnScreen = false;
  static autosave = true;
  static autosaveFrequency = 5;
  static noAlienPanicMessages = false;
  static maximizeInfoScreens = false;
  static globeDetail = true;
  static globeSeasons = false;
  static globeRadarLines = false;
  static globeFlightPaths = true;
  static showFundsOnGeoscape = false;
  static meetingPoint = false;
  static retainCorpses = false;
  static displayWidth = 640;
  static displayHeight = 400;
  static newDisplayWidth = 640;
  static newDisplayHeight = 400;
  static baseXResolution = 640;
  static baseYResolution = 400;
  static geoscapeScale = SCALE_2X;
  static battlescapeScale = SCALE_2X;
  static newGeoscapeScale = SCALE_2X;
  static newBattlescapeScale = SCALE_2X;
  static baseXGeoscape = 640;
  static baseYGeoscape = 400;
  static baseXBattlescape = 640;
  static baseYBattlescape = 400;
  static language = "";
  static assetBase = "..";
  static keyScreenshot = "F12";
  static keyOk = "Enter";
  static keyCancel = "Escape";
  static keyGeoLeft = "ArrowLeft";
  static keyGeoRight = "ArrowRight";
  static keyGeoUp = "ArrowUp";
  static keyGeoDown = "ArrowDown";
  static keyGeoZoomIn = "+";
  static keyGeoZoomOut = "-";
  static keyGeoIntercept = "i";
  static keyGeoBases = "b";
  static keyGeoGraphs = "g";
  static keyGeoUfopedia = "u";
  static keyGeoOptions = "o";
  static keyGeoFunding = "f";
  static keyGeoSpeed1 = "1";
  static keyGeoSpeed2 = "2";
  static keyGeoSpeed3 = "3";
  static keyGeoSpeed4 = "4";
  static keyGeoSpeed5 = "5";
  static keyGeoSpeed6 = "6";
  static keyBaseSelect1 = "1";
  static keyBaseSelect2 = "2";
  static keyBaseSelect3 = "3";
  static keyBaseSelect4 = "4";
  static keyBaseSelect5 = "5";
  static keyBaseSelect6 = "6";
  static keyBaseSelect7 = "7";
  static keyBaseSelect8 = "8";
  static keyBattleUseLeftHand = "q";
  static keyBattleUseRightHand = "e";
  static keyBattleLeft = "ArrowLeft";
  static keyBattleRight = "ArrowRight";
  static keyBattleUp = "ArrowUp";
  static keyBattleDown = "ArrowDown";
  static keyBattleLevelUp = "PageUp";
  static keyBattleLevelDown = "PageDown";
  static keyBattleCenterUnit = "Home";
  static keyBattlePrevUnit = "Shift";
  static keyBattleNextUnit = "Tab";
  static keyBattleStats = "s";
  static keyBattleMap = "m";
  static keyBattleReload = "r";
  static keyBattlePersonalLighting = "l";
  static keyBattleAbort = "a";
  static keyboardMode = KEYBOARD_ON;
  static customInitialBase = false;
  static allowBuildingQueue = false;
  static storageLimitsEnforced = false;
  static canSellLiveAliens = false;
  static canTransferCraftsWhileAirborne = false;
  static changeValueByMouseWheel = 0;
  static anytimePsiTraining = false;
  static sneakyAI = false;
  static strafe = false;
  static forceFire = false;
  static battleConfirmFireMode = false;
  static keyModifiers = 0;
  static mods: Array<[string, boolean]> = [["xcom1", true]];
  private static _masterMod = "";
  private static _resourceManifest: ResourceManifest | null = null;
  private static _refreshingMods = false;
  private static _modInfos = new Map<string, ModInfo>([
    ["xcom1", new ModInfo("xcom1", "X-COM: UFO Defense", true, true, "1.0", "OpenXcom", "X-COM: UFO Defense", "", "", "bin/standard/xcom1")]
  ]);

  static init(): boolean {
    Options.baseXResolution = Options.displayWidth;
    Options.baseYResolution = Options.displayHeight;
    Options.backupDisplay();
    return true;
  }

  static save(_backup = false): void {
    localStorage.setItem("openxcom.options", JSON.stringify({
      language: Options.language,
      mods: Options.mods.map(([id, enabled]) => [id, enabled])
    }));
  }

  static load(): void {
    const saved = localStorage.getItem("openxcom.options");
    if (!saved) {
      return;
    }
    try {
      const parsed = JSON.parse(saved);
      if (typeof parsed.language === "string") {
        Options.language = parsed.language;
      }
      if (Array.isArray(parsed.mods)) {
        Options.mods = parsed.mods
          .filter((entry: unknown): entry is [string, boolean] => Array.isArray(entry) && typeof entry[0] === "string" && typeof entry[1] === "boolean")
          .map((entry: [string, boolean]): [string, boolean] => [entry[0], entry[1]]);
        Options._masterMod = "";
      }
    } catch {
      // Keep source behavior forgiving: a bad options file falls back to current defaults.
    }
  }

  static resetDefault(includeMods = false): void {
    Options.reload = false;
    Options.mute = false;
    Options.backgroundMute = false;
    Options.captureMouse = false;
    Options.keepAspectRatio = true;
    Options.fullscreen = false;
    Options.borderless = false;
    Options.allowResize = true;
    Options.displayWidth = 640;
    Options.displayHeight = 400;
    Options.soundVolume = 96;
    Options.musicVolume = 96;
    Options.uiVolume = 96;
    Options.musicAlwaysLoop = false;
    Options.geoscapeScale = SCALE_2X;
    Options.battlescapeScale = SCALE_2X;
    Options.geoClockSpeed = 250;
    Options.geoScrollSpeed = 20;
    Options.dogfightSpeed = 25;
    Options.battleScrollSpeed = 8;
    Options.battleEdgeScroll = SCROLL_AUTO;
    Options.battleFireSpeed = 4;
    Options.battleXcomSpeed = 30;
    Options.battleAlienSpeed = 30;
    Options.battleDragScrollButton = 2;
    Options.battleSmoothCamera = false;
    Options.fieldPromotions = false;
    Options.backupDisplay();
    if (includeMods) {
      Options.mods = [];
      Options._masterMod = "";
      Options.setDefaultMods();
    }
  }

  static switchDisplay(): void {
    Options.displayWidth = Options.newDisplayWidth;
    Options.displayHeight = Options.newDisplayHeight;
    Options.fullscreen = Options.newFullscreen;
    Options.borderless = Options.newBorderless;
    Options.allowResize = Options.newAllowResize;
    Options.useOpenGL = Options.newOpenGL;
    Options.useScaleFilter = Options.newScaleFilter;
    Options.useHQXFilter = Options.newHQXFilter;
    Options.useXBRZFilter = Options.newXBRZFilter;
    Options.useOpenGLShader = Options.newOpenGLShader;
    Options.geoscapeScale = Options.newGeoscapeScale;
    Options.battlescapeScale = Options.newBattlescapeScale;
    Options.rootWindowedMode = Options.newRootWindowedMode;
  }

  static updateMods(): void {
    FileMap.load("common", "bin/common", true);
    Options.refreshMods();
    Options.mapResources();

    Logger.log(LOG_INFO, "Active mods:");
    for (const mod of Options.getActiveMods()) {
      Logger.log(LOG_INFO, `- ${mod.getId()} v${mod.getVersion()}`);
    }
  }

  static getActiveMaster(): string {
    Options.refreshMods();
    return Options._masterMod || "xcom1";
  }

  static backupDisplay(): void {
    Options.newDisplayWidth = Options.displayWidth;
    Options.newDisplayHeight = Options.displayHeight;
    Options.newFullscreen = Options.fullscreen;
    Options.newBorderless = Options.borderless;
    Options.newAllowResize = Options.allowResize;
    Options.newOpenGL = Options.useOpenGL;
    Options.newScaleFilter = Options.useScaleFilter;
    Options.newHQXFilter = Options.useHQXFilter;
    Options.newXBRZFilter = Options.useXBRZFilter;
    Options.newOpenGLShader = Options.useOpenGLShader;
    Options.newGeoscapeScale = Options.geoscapeScale;
    Options.newBattlescapeScale = Options.battlescapeScale;
    Options.newRootWindowedMode = Options.rootWindowedMode;
  }

  static getDataFolder(): string {
    return Options.assetBase;
  }

  static getUserFolder(): string {
    return "browser://localStorage/openxcom/";
  }

  static getMasterUserFolder(): string {
    return "browser://localStorage/openxcom/saves/";
  }

  static getConfigFolder(): string {
    return "browser://localStorage/openxcom/options/";
  }

  static getOptionInfo(): OptionInfo[] {
    return [
      new OptionInfo("playIntro", Options, "playIntro", true, "STR_PLAYINTRO", "STR_GENERAL"),
      new OptionInfo("autosave", Options, "autosave", true, "STR_AUTOSAVE", "STR_GENERAL"),
      new OptionInfo("autosaveFrequency", Options, "autosaveFrequency", 5, "STR_AUTOSAVE_FREQUENCY", "STR_GENERAL"),
      new OptionInfo("changeValueByMouseWheel", Options, "changeValueByMouseWheel", 0, "STR_CHANGEVALUEBYMOUSEWHEEL", "STR_GENERAL"),
      new OptionInfo("maximizeInfoScreens", Options, "maximizeInfoScreens", false, "STR_MAXIMIZE_INFO_SCREENS", "STR_GENERAL"),
      new OptionInfo("customInitialBase", Options, "customInitialBase", false, "STR_CUSTOMINITIALBASE", "STR_GEOSCAPE"),
      new OptionInfo("allowBuildingQueue", Options, "allowBuildingQueue", false, "STR_ALLOWBUILDINGQUEUE", "STR_GEOSCAPE"),
      new OptionInfo("storageLimitsEnforced", Options, "storageLimitsEnforced", false, "STR_STORAGELIMITSENFORCED", "STR_GEOSCAPE"),
      new OptionInfo("canSellLiveAliens", Options, "canSellLiveAliens", false, "STR_CANSELLLIVEALIENS", "STR_GEOSCAPE"),
      new OptionInfo("anytimePsiTraining", Options, "anytimePsiTraining", false, "STR_ANYTIMEPSITRAINING", "STR_GEOSCAPE"),
      new OptionInfo("psiStrengthEval", Options, "psiStrengthEval", false, "STR_PSISTRENGTHEVAL", "STR_GEOSCAPE"),
      new OptionInfo("fieldPromotions", Options, "fieldPromotions", false, "STR_FIELDPROMOTIONS", "STR_GEOSCAPE"),
      new OptionInfo("canTransferCraftsWhileAirborne", Options, "canTransferCraftsWhileAirborne", false, "STR_CANTRANSFERCRAFTSWHILEAIRBORNE", "STR_GEOSCAPE"),
      new OptionInfo("retainCorpses", Options, "retainCorpses", false, "STR_RETAINCORPSES", "STR_GEOSCAPE"),
      new OptionInfo("meetingPoint", Options, "meetingPoint", false, "STR_MEETINGPOINT", "STR_GEOSCAPE"),
      new OptionInfo("battleDragScrollInvert", Options, "battleDragScrollInvert", false, "STR_DRAGSCROLLINVERT", "STR_BATTLESCAPE"),
      new OptionInfo("sneakyAI", Options, "sneakyAI", false, "STR_SNEAKYAI", "STR_BATTLESCAPE"),
      new OptionInfo("battleUFOExtenderAccuracy", Options, "battleUFOExtenderAccuracy", false, "STR_BATTLEUFOEXTENDERACCURACY", "STR_BATTLESCAPE"),
      new OptionInfo("battleInstantGrenade", Options, "battleInstantGrenade", false, "STR_BATTLEINSTANTGRENADE", "STR_BATTLESCAPE"),
      new OptionInfo("battleExplosionHeight", Options, "battleExplosionHeight", 0, "STR_BATTLEEXPLOSIONHEIGHT", "STR_BATTLESCAPE"),
      new OptionInfo("battleConfirmFireMode", Options, "battleConfirmFireMode", false, "STR_BATTLECONFIRMFIREMODE", "STR_BATTLESCAPE"),
      new OptionInfo("allowPsionicCapture", Options, "allowPsionicCapture", false, "STR_ALLOWPSIONICCAPTURE", "STR_BATTLESCAPE"),
      new OptionInfo("allowPsiStrengthImprovement", Options, "allowPsiStrengthImprovement", false, "STR_ALLOWPSISTRENGTHIMPROVEMENT", "STR_BATTLESCAPE"),
      new OptionInfo("strafe", Options, "strafe", false, "STR_STRAFE", "STR_BATTLESCAPE"),
      new OptionInfo("forceFire", Options, "forceFire", true, "STR_FORCE_FIRE", "STR_BATTLESCAPE"),
      new OptionInfo("skipNextTurnScreen", Options, "skipNextTurnScreen", false, "STR_SKIPNEXTTURNSCREEN", "STR_BATTLESCAPE"),
      new OptionInfo("noAlienPanicMessages", Options, "noAlienPanicMessages", false, "STR_NOALIENPANICMESSAGES", "STR_BATTLESCAPE"),
      new OptionInfo("keyOk", Options, "keyOk", "Enter", "STR_OK", "STR_GENERAL"),
      new OptionInfo("keyCancel", Options, "keyCancel", "Escape", "STR_CANCEL", "STR_GENERAL"),
      new OptionInfo("keyGeoLeft", Options, "keyGeoLeft", "ArrowLeft", "STR_ROTATE_LEFT", "STR_GEOSCAPE"),
      new OptionInfo("keyGeoRight", Options, "keyGeoRight", "ArrowRight", "STR_ROTATE_RIGHT", "STR_GEOSCAPE"),
      new OptionInfo("keyGeoUp", Options, "keyGeoUp", "ArrowUp", "STR_ROTATE_UP", "STR_GEOSCAPE"),
      new OptionInfo("keyGeoDown", Options, "keyGeoDown", "ArrowDown", "STR_ROTATE_DOWN", "STR_GEOSCAPE"),
      new OptionInfo("keyBattleUseLeftHand", Options, "keyBattleUseLeftHand", "q", "STR_USE_LEFT_HAND", "STR_BATTLESCAPE"),
      new OptionInfo("keyBattleUseRightHand", Options, "keyBattleUseRightHand", "e", "STR_USE_RIGHT_HAND", "STR_BATTLESCAPE"),
      new OptionInfo("keyBattleNextUnit", Options, "keyBattleNextUnit", "Tab", "STR_NEXT_UNIT", "STR_BATTLESCAPE"),
      new OptionInfo("keyBattleStats", Options, "keyBattleStats", "s", "STR_UNIT_STATS", "STR_BATTLESCAPE"),
      new OptionInfo("keyBattleMap", Options, "keyBattleMap", "m", "STR_MINIMAP", "STR_BATTLESCAPE"),
      new OptionInfo("keyBattleReload", Options, "keyBattleReload", "r", "STR_RELOAD", "STR_BATTLESCAPE"),
      new OptionInfo("keyBattleAbort", Options, "keyBattleAbort", "a", "STR_ABORT_MISSION", "STR_BATTLESCAPE")
    ];
  }

  static refreshMods(): void {
    if (Options._refreshingMods) {
      return;
    }

    Options._refreshingMods = true;
    try {
      if (Options.reload) {
        Options._masterMod = "";
      }

      Options._modInfos.clear();
      const manifest = Options.getResourceManifest();
      const haveUfo = Options.ufoIsInstalled(manifest);
      const haveTftd = Options.tftdIsInstalled(manifest);

      if (haveUfo || !haveTftd) {
        Options._modInfos.set("xcom1", new ModInfo("xcom1", "X-COM: UFO Defense", true, true, "1.0", "OpenXcom", "X-COM: UFO Defense", "", "", "bin/standard/xcom1"));
      }
      if (haveTftd) {
        Options._modInfos.set("xcom2", new ModInfo("xcom2", "X-COM: Terror from the Deep", true, true, "1.0", "OpenXcom", "X-COM: Terror from the Deep", "", "", "bin/standard/xcom2"));
      }

      Options.mods = Options.mods.filter(([id]) => {
        const keep = Options._modInfos.has(id);
        if (!keep) {
          Logger.log(LOG_VERBOSE, `removing references to missing mod: ${id}`);
        }
        return keep;
      });

      if (Options.mods.length === 0) {
        Options.setDefaultMods();
      }

      let activeMaster = "";
      let inactiveMaster = "";
      for (const [modId, modInfo] of Options._modInfos) {
        let pair = Options.mods.find(([id]) => id === modId);
        if (pair) {
          if (modInfo.isMaster()) {
            if (Options._masterMod) {
              pair[1] = Options._masterMod === modId;
            }
            if (pair[1]) {
              if (activeMaster) {
                Logger.log(LOG_WARNING, `too many active masters detected; turning off ${modId}`);
                pair[1] = false;
              } else {
                activeMaster = modId;
              }
            } else if (!inactiveMaster || modId === "xcom1" || modId === "xcom2") {
              inactiveMaster = modId;
            }
          }
          continue;
        }

        pair = [modId, false];
        if (modInfo.isMaster()) {
          Options.mods.unshift(pair);
          if (!inactiveMaster) {
            inactiveMaster = modId;
          }
        } else {
          Options.mods.push(pair);
        }
      }

      if (!activeMaster) {
        if (!inactiveMaster) {
          throw new Error("No X-COM installations found");
        }
        Logger.log(LOG_INFO, `no master already active; activating ${inactiveMaster}`);
        const pair = Options.mods.find(([id, enabled]) => id === inactiveMaster && !enabled);
        if (pair) {
          pair[1] = true;
        }
        Options._masterMod = inactiveMaster;
      } else {
        Options._masterMod = activeMaster;
      }

      Options.save();
    } finally {
      Options._refreshingMods = false;
    }
  }

  static getModInfos(): Map<string, ModInfo> {
    Options.refreshMods();
    return Options._modInfos;
  }

  static getModInfo(id: string): ModInfo {
    Options.refreshMods();
    let info = Options._modInfos.get(id);
    if (!info) {
      info = new ModInfo(id, id, false, true);
      Options._modInfos.set(id, info);
    }
    return info;
  }

  static getActiveMods(): ModInfo[] {
    Options.refreshMods();
    const activeMods: ModInfo[] = [];
    for (const [id, enabled] of Options.mods) {
      if (!enabled) {
        continue;
      }
      const info = Options._modInfos.get(id);
      if (info?.canActivate(Options._masterMod)) {
        activeMods.push(info);
      }
    }
    return activeMods;
  }

  static mapResources(): void {
    Logger.log(LOG_INFO, "Mapping resource files...");
    FileMap.clear();
    for (let i = Options.mods.length - 1; i >= 0; --i) {
      const [id, enabled] = Options.mods[i];
      if (!enabled) {
        Logger.log(LOG_VERBOSE, `skipping inactive mod: ${id}`);
        continue;
      }
      const modInfo = Options._modInfos.get(id);
      if (!modInfo) {
        continue;
      }
      if (!modInfo.canActivate(Options._masterMod)) {
        Logger.log(LOG_VERBOSE, `skipping mod for non-current master: ${id}(${modInfo.getMaster()} != ${Options._masterMod})`);
        continue;
      }
      Options.loadMod(modInfo, new Set<string>());
    }
    FileMap.loadManifest("common", { commonSoldierNameFiles: Options.getResourceManifest().commonSoldierNameFiles }, true);
    Logger.log(LOG_INFO, "Resources files mapped successfully.");
  }

  static setResourceManifestForTests(manifest: ResourceManifest | null): void {
    Options._resourceManifest = manifest;
    Options._masterMod = "";
    Options._modInfos.clear();
  }

  private static setDefaultMods(): void {
    const manifest = Options.getResourceManifest();
    const haveUfo = Options.ufoIsInstalled(manifest);
    if (haveUfo || !Options.tftdIsInstalled(manifest)) {
      Options.mods.push(["xcom1", true]);
    }
    if (Options.tftdIsInstalled(manifest)) {
      Options.mods.push(["xcom2", !haveUfo]);
    }
  }

  private static loadMod(modInfo: ModInfo, circDepCheck: Set<string>): void {
    if (circDepCheck.has(modInfo.getId())) {
      Logger.log(LOG_WARNING, `circular dependency found in master chain: ${modInfo.getId()}`);
      return;
    }
    const manifest = Options.getResourceManifest();
    FileMap.loadManifest(modInfo.getId(), Options.manifestForMod(modInfo.getId(), manifest), true);
    FileMap.recordRulesets(modInfo.getId(), Options.rulesetsForMod(modInfo.getId(), manifest));

    if (modInfo.isMaster() && modInfo.getMaster()) {
      circDepCheck.add(modInfo.getId());
      const masterInfo = Options._modInfos.get(modInfo.getMaster());
      if (!masterInfo) {
        throw new Error(`${modInfo.getId()} mod requires ${modInfo.getMaster()} master`);
      }
      Options.loadMod(masterInfo, circDepCheck);
    }
  }

  private static manifestForMod(id: string, manifest: ResourceManifest): ResourceManifest {
    if (id === "xcom2") {
      return {
        xcom2RulesetFiles: manifest.xcom2RulesetFiles,
        tftdPalettesDat: manifest.tftdPalettesDat,
        tftdTerrainDir: manifest.tftdTerrainDir,
        tftdMapsDir: manifest.tftdMapsDir,
        tftdRoutesDir: manifest.tftdRoutesDir,
        tftdSoundDir: manifest.tftdSoundDir
      };
    }
    return {
      xcom1RulesetFiles: manifest.xcom1RulesetFiles,
      ufoPalettesDat: manifest.ufoPalettesDat,
      ufoTerrainDir: manifest.ufoTerrainDir,
      ufoMapsDir: manifest.ufoMapsDir,
      ufoRoutesDir: manifest.ufoRoutesDir,
      ufoSoundDir: manifest.ufoSoundDir
    };
  }

  private static rulesetsForMod(id: string, manifest: ResourceManifest): string[] {
    return id === "xcom2" ? [...(manifest.xcom2RulesetFiles || [])] : [...(manifest.xcom1RulesetFiles || [])];
  }

  private static getResourceManifest(): ResourceManifest {
    if (Options._resourceManifest) {
      return Options._resourceManifest;
    }
    if (typeof XMLHttpRequest === "undefined") {
      Options._resourceManifest = {};
      return Options._resourceManifest;
    }
    const request = new XMLHttpRequest();
    request.open("GET", "dist/resource-manifest.json", false);
    request.overrideMimeType("application/json");
    try {
      request.send();
      if (request.status === 200 || request.status === 0) {
        Options._resourceManifest = JSON.parse(request.responseText || "{}") as ResourceManifest;
      } else {
        Options._resourceManifest = {};
      }
    } catch {
      Options._resourceManifest = {};
    }
    return Options._resourceManifest;
  }

  private static ufoIsInstalled(manifest: ResourceManifest): boolean {
    return Boolean(manifest.ufoPalettesDat || manifest.ufoTerrainDir || manifest.ufoMapsDir || manifest.ufoRoutesDir || manifest.ufoSoundDir);
  }

  private static tftdIsInstalled(manifest: ResourceManifest): boolean {
    return Boolean(manifest.tftdPalettesDat || manifest.tftdTerrainDir || manifest.tftdMapsDir || manifest.tftdRoutesDir || manifest.tftdSoundDir);
  }

  static setKeyModifiers(modifiers: number): void {
    Options.keyModifiers = modifiers;
  }

  static getKeyModifiers(): number {
    return Options.keyModifiers;
  }
}

export function browserKeyEvent(sym: string, mod: number) {
  return { type: SDL_KEYDOWN, key: { keysym: { sym, mod } } };
}
