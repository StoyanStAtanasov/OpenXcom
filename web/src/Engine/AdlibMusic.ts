import { Game } from "./Game.ts";
import { Logger, LOG_WARNING } from "./Logger.ts";
import { Music } from "./Music.ts";
import { Options } from "./Options.ts";

declare const opl: Array<unknown | null>;

export class AdlibMusic extends Music {
  private _data: Uint8Array | null = null;
  private _size = 0;
  private _volume: number;
  private static delay = 0;
  private static rate = 0;
  private static delayRates = new Map<number, number>();

  constructor(volume = 1.0) {
    super();
    this._volume = volume;
    AdlibMusic.rate = Options.audioSampleRate;
    if (AdlibMusic.delayRates.size === 0) {
      AdlibMusic.delayRates.set(8000, 114 * 4);
      AdlibMusic.delayRates.set(11025, 157 * 4);
      AdlibMusic.delayRates.set(16000, 228 * 4);
      AdlibMusic.delayRates.set(22050, 314 * 4);
      AdlibMusic.delayRates.set(32000, 456 * 4);
      AdlibMusic.delayRates.set(44100, 629 * 4);
      AdlibMusic.delayRates.set(48000, 685 * 4);
    }
  }

  override load(filename: string): void;
  override load(data: ArrayBuffer | Uint8Array | number[], size?: number): void;
  override load(data: string | ArrayBuffer | Uint8Array | number[], size?: number): void {
    if (typeof data === "string") {
      this._data = this.loadBinary(data);
      this._size = this._data.length;
      return;
    }

    const bytes = data instanceof Uint8Array
      ? data
      : data instanceof ArrayBuffer
        ? new Uint8Array(data)
        : Uint8Array.from(data);
    this._data = bytes;
    const first = bytes[0] || 0;
    this._size = size ?? bytes.length;
    if (first <= 56) {
      this._size += first;
    }
  }

  override play(loop = -1): boolean {
    void loop;
    if (Options.mute) {
      return false;
    }
    if (!this._data) {
      Logger.log(LOG_WARNING, "AdlibMusic browser boundary: no data loaded.");
      return false;
    }
    Music.stop();
    Logger.log(LOG_WARNING, "AdlibMusic browser boundary: custom YM3812 playback is not implemented yet.");
    return false;
  }

  static player(_udata: void, _stream: Uint8Array, _len: number): void {}

  isPlaying(): boolean {
    return Music.isPlaying();
  }

  protected override loadBinary(path: string): Uint8Array {
    const bytes = super.loadBinary(path);
    return bytes;
  }
}
