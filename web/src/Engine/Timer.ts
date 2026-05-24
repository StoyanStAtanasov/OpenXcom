import type { State } from "./State.ts";
import type { Surface } from "./Surface.ts";
import { Options } from "./Options.ts";

type StateHandler = () => void;
type SurfaceHandler = () => void;

export class Timer {
  static maxFrameSkip = 8;
  static gameSlowSpeed = 1;

  private _start = 0;
  private _frameSkipStart = 0;
  private _running = false;
  private _state: StateHandler | null = null;
  private _surface: SurfaceHandler | null = null;

  constructor(private _interval: number, private _frameSkipping = false) {
    Timer.maxFrameSkip = Options.maxFrameSkip;
  }

  start(): void {
    this._frameSkipStart = this._start = this.slowTick();
    this._running = true;
  }

  stop(): void {
    this._start = 0;
    this._running = false;
  }

  getTime(): number {
    if (this._running) {
      return this.slowTick() - this._start;
    }
    return 0;
  }

  isRunning(): boolean {
    return this._running;
  }

  think(state: State | null, surface: Surface | null): void {
    const now = this.slowTick();
    if (!this._running) {
      return;
    }
    if ((now - this._frameSkipStart) >= this._interval) {
      for (let i = 0; i <= Timer.maxFrameSkip && this.isRunning() && (now - this._frameSkipStart) >= this._interval; ++i) {
        if (state && this._state) {
          this._state.call(state);
        }
        this._frameSkipStart += this._interval;
        if (!this._frameSkipping) {
          break;
        }
      }
      if (this._running && surface && this._surface) {
        this._surface.call(surface);
      }
      this._start = this.slowTick();
      if (this._start > this._frameSkipStart) {
        this._frameSkipStart = this._start;
      }
    }
  }

  setInterval(interval: number): void {
    this._interval = interval;
  }

  onTimer(handler: StateHandler | SurfaceHandler): void {
    this._state = handler as StateHandler;
  }

  onSurfaceTimer(handler: SurfaceHandler): void {
    this._surface = handler;
  }

  private slowTick(): number {
    return performance.now() / Timer.gameSlowSpeed;
  }
}
