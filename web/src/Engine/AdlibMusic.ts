import { Game } from "./Game.ts";
import { Music } from "./Music.ts";
import { Options } from "./Options.ts";
import {
  func_is_music_playing,
  func_mute,
  func_play_tick,
  func_set_music_volume,
  func_setup_music,
  opl,
} from "./Adlib/adlplayer.ts";
import {
  OPLCreate,
  OPLDestroy,
  OPL_TYPE_YM3812,
  YM3812UpdateOne,
} from "./Adlib/fmopl.ts";

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
    AdlibMusic.ensureOpl(AdlibMusic.rate);
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
      return false;
    }
    Music.stop();
    AdlibMusic.ensureOpl(AdlibMusic.rate);
    func_setup_music(this._data, this._size);
    func_set_music_volume(127 * this._volume);
    AdlibMusic.delay = 0;
    this.beginPlayback(loop);
    const started = this.startPlayback(loop);
    if (!started) {
      Music.stop();
    }
    return started;
  }

  protected override startPlayback(loop: number): boolean {
    void loop;
    if (!this._data) {
      return false;
    }
    const context = AdlibMusic.audioContext();
    if (!context) {
      AdlibMusic.deferPlayback(this, loop);
      return true;
    }
    const createScriptProcessor = context.createScriptProcessor?.bind(context);
    if (!createScriptProcessor) {
      return false;
    }
    const processor = createScriptProcessor(2048, 0, 2);
    const gain = context.createGain();
    let stopped = false;
    gain.gain.value = Music.getVolume();
    processor.onaudioprocess = event => {
      const left = event.outputBuffer.getChannelData(0);
      const right = event.outputBuffer.getChannelData(1);
      if (stopped || Options.mute) {
        left.fill(0);
        right.fill(0);
        return;
      }
      const frames = left.length;
      const stream = new Int16Array(frames * 2);
      AdlibMusic.player(this, stream, stream.length * 2);
      for (let frame = 0; frame < frames; frame += 1) {
        left[frame] = Math.max(-1, Math.min(1, stream[frame * 2] / 32768));
        right[frame] = Math.max(-1, Math.min(1, stream[frame * 2 + 1] / 32768));
      }
    };
    processor.connect(gain);
    gain.connect(context.destination);
    AdlibMusic.installCustomPlayback({
      stop() {
        stopped = true;
        try {
          processor.disconnect();
        } catch {
          // SDL_mixer stop tolerates already-disconnected streams.
        }
        try {
          gain.disconnect();
        } catch {
          // Keep stop idempotent.
        }
        func_mute();
      },
      pause() {
        gain.gain.value = 0;
      },
      resume() {
        gain.gain.value = Music.getVolume();
      },
      setVolume(volume: number) {
        gain.gain.value = volume;
      },
    });
    return true;
  }

  static player(udata: AdlibMusic | null, stream: Int16Array, len: number): void {
    if (Options.musicVolume === 0 || Music.getVolume() === 0) {
      return;
    }
    if (Options.musicAlwaysLoop && !func_is_music_playing()) {
      udata?.restartSourceMusic();
      return;
    }
    let offset = 0;
    while (len !== 0) {
      if (!opl[0] || !opl[1]) {
        return;
      }
      const bytes = Math.min(AdlibMusic.delay, len);
      if (bytes) {
        const sampleLength = Math.trunc(bytes / 2);
        const volume = Game.volumeExponent(Options.musicVolume);
        YM3812UpdateOne(opl[0], stream.subarray(offset), sampleLength, 2, volume);
        YM3812UpdateOne(opl[1], stream.subarray(offset + 1), sampleLength, 2, volume);
        offset += sampleLength;
        AdlibMusic.delay -= bytes;
        len -= bytes;
      }
      if (!len) {
        return;
      }
      func_play_tick();
      AdlibMusic.delay = AdlibMusic.delayRates.get(AdlibMusic.rate) ?? 0;
    }
  }

  isPlaying(): boolean {
    if (!Options.mute) {
      return func_is_music_playing();
    }
    return false;
  }

  protected override loadBinary(path: string): Uint8Array {
    const bytes = super.loadBinary(path);
    return bytes;
  }

  private restartSourceMusic(): void {
    if (!this._data) {
      return;
    }
    func_setup_music(this._data, this._size);
    func_set_music_volume(127 * this._volume);
    AdlibMusic.delay = 0;
  }

  private static ensureOpl(rate: number): void {
    AdlibMusic.rate = rate;
    if (!opl[0] || opl[0].rate !== rate) {
      OPLDestroy(opl[0]);
      opl[0] = OPLCreate(OPL_TYPE_YM3812, 3579545, rate);
    }
    if (!opl[1] || opl[1].rate !== rate) {
      OPLDestroy(opl[1]);
      opl[1] = OPLCreate(OPL_TYPE_YM3812, 3579545, rate);
    }
  }
}
