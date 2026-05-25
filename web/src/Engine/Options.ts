import { SDL_KEYDOWN } from "../types.ts";
import { ModInfo } from "./ModInfo.ts";
import { OptionInfo } from "./OptionInfo.ts";

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
  private static _modInfos = new Map<string, ModInfo>([
    ["xcom1", new ModInfo("xcom1", "X-COM: UFO Defense", true, true)]
  ]);

  static init(): boolean {
    Options.baseXResolution = Options.displayWidth;
    Options.baseYResolution = Options.displayHeight;
    Options.backupDisplay();
    return true;
  }

  static save(_backup = false): void {
    localStorage.setItem("openxcom.options", JSON.stringify({ language: Options.language }));
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
    } catch {
      // Keep source behavior forgiving: a bad options file falls back to current defaults.
    }
  }

  static resetDefault(_includeMods = false): void {
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
    // Browser port stub: ruleset loading is translated incrementally.
  }

  static getActiveMaster(): string {
    const active = Options.mods.find(([id, enabled]) => enabled && Options.getModInfo(id).isMaster());
    return active?.[0] || "xcom1";
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

  static mapResources(): void {
    Options.updateMods();
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
    if (Options.mods.length === 0) {
      Options.mods.push(["xcom1", true]);
    }
    if (!Options._modInfos.has("xcom1")) {
      Options._modInfos.set("xcom1", new ModInfo("xcom1", "X-COM: UFO Defense", true, true));
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
