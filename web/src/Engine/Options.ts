import { SDL_KEYDOWN } from "../types.ts";

export const SCALE_ORIGINAL = 0;
export const SCALE_15X = 1;
export const SCALE_2X = 2;
export const SCALE_SCREEN_DIV_3 = 3;
export const SCALE_SCREEN_DIV_2 = 4;
export const SCALE_SCREEN = 5;

export const MUSIC_MIDI = "MUSIC_MIDI";
export const KEYBOARD_OFF = 0;
export const KEYBOARD_ON = 1;
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
  static allowResize = true;
  static fullscreen = false;
  static borderless = false;
  static keepAspectRatio = true;
  static nonSquarePixelRatio = false;
  static cursorInBlackBandsInFullscreen = true;
  static cursorInBlackBandsInWindow = true;
  static cursorInBlackBandsInBorderlessWindow = true;
  static useOpenGL = false;
  static vSyncForOpenGL = true;
  static useHQXFilter = false;
  static useXBRZFilter = false;
  static useOpenGLSmoothing = false;
  static checkOpenGLErrors = false;
  static useOpenGLShader = "";
  static asyncBlit = false;
  static pauseMode = 0;
  static preferredMusic = MUSIC_MIDI;
  static soundVolume = 96;
  static musicVolume = 96;
  static uiVolume = 96;
  static audioBitDepth = 16;
  static audioSampleRate = 44100;
  static audioChunkSize = 2048;
  static maxFrameSkip = 8;
  static FPS = 60;
  static FPSInactive = 10;
  static geoClockSpeed = 250;
  static dogfightSpeed = 25;
  static battleFireSpeed = 4;
  static battleXcomSpeed = 30;
  static battleAlienSpeed = 30;
  static battleExplosionHeight = 0;
  static battleInstantGrenade = false;
  static battleNewPreviewPath = PATH_NONE;
  static battleDragScrollButton = 3;
  static battleDragScrollInvert = false;
  static dragScrollTimeTolerance = 100;
  static dragScrollPixelTolerance = 10;
  static battleUFOExtenderAccuracy = false;
  static battleNotifyDeath = false;
  static allowPsiStrengthImprovement = false;
  static allowPsionicCapture = false;
  static psiStrengthEval = false;
  static skipNextTurnScreen = false;
  static autosaveFrequency = 5;
  static noAlienPanicMessages = false;
  static maximizeInfoScreens = false;
  static globeRadarLines = false;
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

  static init(): boolean {
    Options.baseXResolution = Options.displayWidth;
    Options.baseYResolution = Options.displayHeight;
    return true;
  }

  static save(): void {
    localStorage.setItem("openxcom.options", JSON.stringify({ language: Options.language }));
  }

  static updateMods(): void {
    // Browser port stub: ruleset loading is translated incrementally.
  }

  static getActiveMaster(): string {
    return "xcom1";
  }

  static backupDisplay(): void {
    Options.newDisplayWidth = Options.displayWidth;
    Options.newDisplayHeight = Options.displayHeight;
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
