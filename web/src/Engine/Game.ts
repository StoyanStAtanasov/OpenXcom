import { Action } from "./Action.ts";
import { Language } from "./Language.ts";
import { Logger, LOG_INFO, LOG_WARNING } from "./Logger.ts";
import { Music } from "./Music.ts";
import { Options } from "./Options.ts";
import { Screen } from "./Screen.ts";
import { Sound } from "./Sound.ts";
import { State } from "./State.ts";
import { Mod } from "../Mod/Mod.ts";
import type { SavedGame } from "../Savegame/SavedGame.ts";
import { Cursor } from "../Interface/Cursor.ts";
import { FpsCounter } from "../Interface/FpsCounter.ts";
import { SDL_KEYDOWN, SDL_KEYUP, SDL_MOUSEBUTTONDOWN, SDL_MOUSEBUTTONUP, SDL_MOUSEMOTION, SDL_QUIT, SDL_BUTTON_LEFT, SDL_BUTTON_MIDDLE, SDL_BUTTON_RIGHT, KMOD_ALT, KMOD_CTRL, KMOD_SHIFT, type SdlEvent } from "../types.ts";

export class Game {
  private _screen: Screen;
  private _cursor: Cursor;
  private _lang = new Language();
  private _states: State[] = [];
  private _deleted: State[] = [];
  private _save: SavedGame | null = null;
  private _mod: Mod | null = new Mod();
  private _quit = false;
  private _init = false;
  private _fpsCounter: FpsCounter;
  private _mouseActive = true;
  private _timeOfLastFrame = 0;
  private _timeUntilNextFrame = 0;
  private _events: SdlEvent[] = [];
  private _animation = 0;
  static VOLUME_GRADIENT = 10.0;

  constructor(private title: string, canvas: HTMLCanvasElement) {
    document.title = title;
    this._screen = new Screen(canvas);
    this._cursor = new Cursor(9, 13);
    this._fpsCounter = new FpsCounter(30, 12, 15, 5);
    this.installEventHandlers(canvas);
    this.initAudio();
    Logger.log(LOG_INFO, "Browser canvas initialized successfully.");
  }

  run(): void {
    const tick = () => {
      if (this._quit) {
        Options.save();
        cancelAnimationFrame(this._animation);
        return;
      }
      this.cycle();
      this._animation = requestAnimationFrame(tick);
    };
    this._animation = requestAnimationFrame(tick);
  }

  quit(): void {
    this._quit = true;
  }

  setVolume(sound: number, music: number, ui: number): void {
    if (!Options.mute) {
      if (sound >= 0) {
        const soundVolume = Game.volumeExponent(sound);
        Sound.setVolume(-1, soundVolume);
        const savedBattle = this._save?.getSavedBattle?.() || null;
        if (savedBattle) {
          Sound.setVolume(3, soundVolume * savedBattle.getAmbientVolume());
        } else {
          Sound.setVolume(3, soundVolume / 2);
        }
      }
      if (music >= 0) {
        Music.setVolume(Game.volumeExponent(music));
      }
      if (ui >= 0) {
        const uiVolume = Game.volumeExponent(ui);
        Sound.setVolume(1, uiVolume);
        Sound.setVolume(2, uiVolume);
      }
    }
  }

  static volumeExponent(volume: number): number {
    return (Math.exp(Math.log(Game.VOLUME_GRADIENT + 1.0) * volume / 128.0) - 1.0) / Game.VOLUME_GRADIENT;
  }

  getScreen(): Screen {
    return this._screen;
  }

  getCursor(): Cursor {
    return this._cursor;
  }

  getFpsCounter(): FpsCounter {
    return this._fpsCounter;
  }

  setState(state: State): void {
    while (this._states.length > 0) {
      this.popState();
    }
    this.pushState(state);
    this._init = false;
  }

  pushState(state: State): void {
    this._states.push(state);
    this._init = false;
  }

  popState(): void {
    const state = this._states.pop();
    if (state) {
      this._deleted.push(state);
    }
    this._init = false;
  }

  getLanguage(): Language {
    return this._lang;
  }

  getSavedGame(): SavedGame | null {
    return this._save;
  }

  setSavedGame(save: SavedGame | null): void {
    this._save = save;
  }

  getMod(): Mod | null {
    return this._mod;
  }

  async loadMods(): Promise<void> {
    this._mod = new Mod();
    await this._mod.loadAll();
  }

  setMouseActive(active: boolean): void {
    this._mouseActive = active;
    this._cursor.setVisible(active);
  }

  isState(state: State): boolean {
    return this._states.length > 0 && this._states[this._states.length - 1] === state;
  }

  isQuitting(): boolean {
    return this._quit;
  }

  async loadLanguages(): Promise<void> {
    const defaultLang = "en-US";
    const currentLang = Options.language || defaultLang;
    Options.language = currentLang;
    this._lang = new Language();
    await this._lang.loadFile(`bin/common/Language/${defaultLang}.yml`);
    await this._lang.loadFile(`bin/standard/xcom1/Language/${defaultLang}.yml`);
    if (currentLang !== defaultLang) {
      await this._lang.loadFile(`bin/common/Language/${currentLang}.yml`);
      await this._lang.loadFile(`bin/standard/xcom1/Language/${currentLang}.yml`);
    }
  }

  initAudio(): void {
    Logger.log(LOG_WARNING, "Browser audio starts on first playback after user activation.");
    Options.mute = false;
    this.setVolume(Options.soundVolume, Options.musicVolume, Options.uiVolume);
  }

  enqueue(event: SdlEvent): void {
    this._events.push(event);
  }

  private cycle(): void {
    while (this._deleted.length > 0) {
      this._deleted.pop();
    }
    const active = this._states[this._states.length - 1];
    if (!active) {
      return;
    }
    if (!this._init) {
      this._init = true;
      active.init();
      active.resetAll();
    }
    while (this._events.length > 0) {
      const event = this._events.shift()!;
      if (event.type === SDL_QUIT) {
        this.quit();
        break;
      }
      if ((event.type === SDL_MOUSEMOTION || event.type === SDL_MOUSEBUTTONDOWN || event.type === SDL_MOUSEBUTTONUP) && !this._mouseActive) {
        continue;
      }
      const action = new Action(
        event,
        this._screen.getXScale(),
        this._screen.getYScale(),
        this._screen.getCursorTopBlackBand(),
        this._screen.getCursorLeftBlackBand()
      );
      this._screen.handle(action);
      this._cursor.handle(action);
      this._fpsCounter.handle(action);
      active.handle(action);
      if (!this._init) {
        break;
      }
    }
    active.think();
    this._fpsCounter.think();
    if (Options.FPS > 0) {
      this._timeUntilNextFrame = (1000.0 / Options.FPS) - (performance.now() - this._timeOfLastFrame);
    } else {
      this._timeUntilNextFrame = 0;
    }
    if (this._init && this._timeUntilNextFrame <= 0) {
      this._timeOfLastFrame = performance.now();
      this._fpsCounter.addFrame();
      this._screen.clear();
      let i = this._states.length - 1;
      while (i > 0 && !this._states[i].isScreen()) {
        --i;
      }
      for (; i < this._states.length; ++i) {
        this._states[i].blit();
      }
      if (Options.fpsCounter) {
        this._fpsCounter.blit(this._screen.getSurface());
      }
      this._cursor.blit(this._screen.getSurface());
      this._screen.flip();
    }
  }

  private installEventHandlers(canvas: HTMLCanvasElement): void {
    const toCanvasPoint = (event: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      return {
        x: Math.trunc((event.clientX - rect.left) * (canvas.width / rect.width)),
        y: Math.trunc((event.clientY - rect.top) * (canvas.height / rect.height))
      };
    };
    const button = (event: MouseEvent) => {
      if (event.button === 0) return SDL_BUTTON_LEFT;
      if (event.button === 1) return SDL_BUTTON_MIDDLE;
      if (event.button === 2) return SDL_BUTTON_RIGHT;
      return SDL_BUTTON_LEFT;
    };
    const mod = (event: KeyboardEvent | MouseEvent) =>
      (event.ctrlKey ? KMOD_CTRL : 0) |
      (event.altKey ? KMOD_ALT : 0) |
      (event.shiftKey ? KMOD_SHIFT : 0);

    canvas.addEventListener("mousemove", event => {
      Options.setKeyModifiers(mod(event));
      const p = toCanvasPoint(event);
      this.enqueue({ type: SDL_MOUSEMOTION, motion: p });
    });
    canvas.addEventListener("mousedown", event => {
      event.preventDefault();
      Options.setKeyModifiers(mod(event));
      const p = toCanvasPoint(event);
      this.enqueue({ type: SDL_MOUSEBUTTONDOWN, button: { ...p, button: button(event) } });
    });
    canvas.addEventListener("mouseup", event => {
      event.preventDefault();
      Options.setKeyModifiers(mod(event));
      const p = toCanvasPoint(event);
      this.enqueue({ type: SDL_MOUSEBUTTONUP, button: { ...p, button: button(event) } });
    });
    canvas.addEventListener("contextmenu", event => event.preventDefault());
    window.addEventListener("keydown", event => {
      const modifiers = mod(event);
      Options.setKeyModifiers(modifiers);
      this.enqueue({ type: SDL_KEYDOWN, key: { keysym: { sym: event.key, mod: modifiers } } });
    });
    window.addEventListener("keyup", event => {
      const modifiers = mod(event);
      Options.setKeyModifiers(modifiers);
      this.enqueue({ type: SDL_KEYUP, key: { keysym: { sym: event.key, mod: modifiers } } });
    });
    window.addEventListener("beforeunload", () => this.enqueue({ type: SDL_QUIT }));
  }
}
