import { Logger, LOG_WARNING } from "./Logger.ts";
import type { BrowserMidiBackend } from "./Music.ts";

type LibTimidityModule = {
  FS: {
    writeFile: (path: string, data: string | Uint8Array, options?: { encoding?: string }) => void;
    mkdir: (path: string) => void;
  };
  HEAP16: Int16Array;
  HEAPU8: Uint8Array;
  UTF8ToString: (ptr: number) => string;
  _malloc: (size: number) => number;
  _free: (ptr: number) => void;
  _mid_init: (path: string) => number;
  _mid_alloc_options: (sampleRate: number, audioFormat: number, channels: number, bufferSize: number) => number;
  _mid_istream_open_mem: (ptr: number, length: number) => number;
  _mid_istream_close: (ptr: number) => void;
  _mid_song_load: (streamPtr: number, optionsPtr: number) => number;
  _mid_song_free: (songPtr: number) => void;
  _mid_song_start: (songPtr: number) => void;
  _mid_song_seek: (songPtr: number, milliseconds: number) => void;
  _mid_song_read_wave: (songPtr: number, bufferPtr: number, bytes: number) => number;
  _mid_get_load_request_count: (songPtr: number) => number;
  _mid_get_load_request: (songPtr: number, index: number) => number;
};

type LibTimidityFactory = (options?: { locateFile?: (file: string) => string }) => Promise<LibTimidityModule>;

declare global {
  interface Window {
    LibTimidity?: LibTimidityFactory;
  }
}

const SAMPLE_RATE = 44100;
const AUDIO_FORMAT_S16 = 0x8010;
const CHANNELS = 2;
const BYTES_PER_SAMPLE = 2 * CHANNELS;
const BUFFER_SIZE = 16384;

let scriptPromise: Promise<void> | null = null;

function ensureSlash(value: string): string {
  return value.endsWith("/") ? value : `${value}/`;
}

function baseUrlHref(baseUrl: string): string {
  if (typeof document !== "undefined") {
    return new URL(ensureSlash(baseUrl), document.baseURI).href;
  }
  return ensureSlash(baseUrl);
}

function audioContext(): AudioContext | null {
  if (typeof window === "undefined") {
    return null;
  }
  const AudioCtor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtor) {
    return null;
  }
  try {
    return new AudioCtor({ sampleRate: SAMPLE_RATE });
  } catch {
    try {
      return new AudioCtor();
    } catch {
      return null;
    }
  }
}

async function loadScript(src: string): Promise<void> {
  if (typeof window === "undefined") {
    throw new Error("browser window is not available");
  }
  if (window.LibTimidity) {
    return;
  }
  scriptPromise ??= new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`failed to load ${src}`));
    document.head.appendChild(script);
  });
  await scriptPromise;
  if (!window.LibTimidity) {
    throw new Error("LibTimidity did not register");
  }
}

export class TimidityMidiBackend implements BrowserMidiBackend {
  private readonly _baseUrl: string;
  private _module: Promise<LibTimidityModule> | null = null;
  private _initialized = false;
  private readonly _instrumentLoads = new Map<string, Promise<void>>();

  constructor(baseUrl = "vendor/timidity/") {
    this._baseUrl = baseUrlHref(baseUrl);
  }

  play(data: Uint8Array, options: { loop: boolean; volume: number }): TimidityMidiPlayback {
    return new TimidityMidiPlayback(this, data, options.loop, options.volume);
  }

  async module(): Promise<LibTimidityModule> {
    if (!this._module) {
      this._module = this.loadModule();
    }
    return this._module;
  }

  async fetchInstrument(module: LibTimidityModule, instrument: string): Promise<void> {
    let pending = this._instrumentLoads.get(instrument);
    if (!pending) {
      pending = this.fetchInstrumentFile(module, instrument);
      this._instrumentLoads.set(instrument, pending);
    }
    await pending;
  }

  private async loadModule(): Promise<LibTimidityModule> {
    await loadScript(new URL("libtimidity.js", this._baseUrl).href);
    const factory = window.LibTimidity;
    if (!factory) {
      throw new Error("LibTimidity factory is unavailable");
    }
    const module = await factory({ locateFile: file => new URL(file, this._baseUrl).href });
    if (!this._initialized) {
      const response = await fetch(new URL("freepats.cfg", this._baseUrl).href);
      if (!response.ok) {
        throw new Error(`freepats.cfg: HTTP ${response.status}`);
      }
      module.FS.writeFile("/timidity.cfg", await response.text());
      const result = module._mid_init("/timidity.cfg");
      if (result !== 0) {
        throw new Error("libtimidity initialization failed");
      }
      this._initialized = true;
    }
    return module;
  }

  private async fetchInstrumentFile(module: LibTimidityModule, instrument: string): Promise<void> {
    const response = await fetch(new URL(instrument, this._baseUrl).href);
    if (!response.ok) {
      throw new Error(`${instrument}: HTTP ${response.status}`);
    }
    this.mkdirp(module, instrument.split("/").slice(0, -1));
    module.FS.writeFile(instrument, new Uint8Array(await response.arrayBuffer()), { encoding: "binary" });
  }

  private mkdirp(module: LibTimidityModule, parts: string[]): void {
    let path = "";
    for (const part of parts) {
      if (!part) {
        continue;
      }
      path += `/${part}`;
      try {
        module.FS.mkdir(path);
      } catch {
        // Directory already exists in the in-memory libtimidity filesystem.
      }
    }
  }
}

export class TimidityMidiPlayback {
  private readonly _owner: TimidityMidiBackend;
  private readonly _data: Uint8Array;
  private readonly _loop: boolean;
  private _volume: number;
  private _context: AudioContext | null = null;
  private _gain: GainNode | null = null;
  private _node: ScriptProcessorNode | null = null;
  private _module: LibTimidityModule | null = null;
  private _songPtr = 0;
  private _bufferPtr = 0;
  private _array = new Int16Array(BUFFER_SIZE * CHANNELS);
  private _stopped = false;
  private _paused = false;
  private _ready = false;
  private _lastError = "";

  constructor(owner: TimidityMidiBackend, data: Uint8Array, loop: boolean, volume: number) {
    this._owner = owner;
    this._data = data.slice();
    this._loop = loop;
    this._volume = volume;
    void this.start().catch(error => {
      this._lastError = error instanceof Error ? error.message : "MIDI playback failed";
      Logger.log(LOG_WARNING, `MIDI playback failed: ${this._lastError}`);
      this.stop();
    });
  }

  stop(): void {
    this._stopped = true;
    this._paused = false;
    if (this._node) {
      this._node.disconnect();
      this._node.onaudioprocess = null;
      this._node = null;
    }
    this._gain?.disconnect();
    this._gain = null;
    if (this._module && this._songPtr) {
      this._module._mid_song_free(this._songPtr);
      this._songPtr = 0;
    }
    if (this._module && this._bufferPtr) {
      this._module._free(this._bufferPtr);
      this._bufferPtr = 0;
    }
    void this._context?.close().catch(() => undefined);
    this._context = null;
    this._ready = false;
  }

  pause(): void {
    this._paused = true;
  }

  resume(): void {
    this._paused = false;
    void this._context?.resume().catch(() => undefined);
  }

  setVolume(volume: number): void {
    this._volume = Math.max(0, Math.min(1, volume));
    if (this._gain) {
      this._gain.gain.value = this._volume;
    }
  }

  getState(): { ready: boolean; stopped: boolean; paused: boolean; lastError: string; source: string } {
    return {
      ready: this._ready,
      stopped: this._stopped,
      paused: this._paused,
      lastError: this._lastError,
      source: "libtimidity"
    };
  }

  private async start(): Promise<void> {
    this._context = audioContext();
    if (!this._context) {
      throw new Error("AudioContext is unavailable");
    }
    await this._context.resume().catch(() => undefined);
    if (this._stopped) {
      return;
    }

    this._gain = this._context.createGain();
    this._gain.gain.value = this._volume;
    this._gain.connect(this._context.destination);
    this._node = this._context.createScriptProcessor(BUFFER_SIZE, 0, CHANNELS);
    this._node.onaudioprocess = event => this.onAudioProcess(event);
    this._node.connect(this._gain);

    this._module = await this._owner.module();
    this._bufferPtr = this._module._malloc(BUFFER_SIZE * BYTES_PER_SAMPLE);
    this._songPtr = await this.loadSongWithInstruments(this._module, this._data);
    if (this._stopped) {
      this.stop();
      return;
    }
    this._module._mid_song_start(this._songPtr);
    this._ready = true;
  }

  private async loadSongWithInstruments(module: LibTimidityModule, data: Uint8Array): Promise<number> {
    let songPtr = this.loadSong(module, data);
    let missingCount = module._mid_get_load_request_count(songPtr);
    if (missingCount > 0) {
      const missing = this.missingInstruments(module, songPtr, missingCount);
      await Promise.all(missing.map(instrument => this._owner.fetchInstrument(module, instrument)));
      module._mid_song_free(songPtr);
      songPtr = this.loadSong(module, data);
      missingCount = module._mid_get_load_request_count(songPtr);
      if (missingCount > 0) {
        const stillMissing = this.missingInstruments(module, songPtr, missingCount).join(", ");
        Logger.log(LOG_WARNING, `MIDI playing with missing instruments: ${stillMissing}`);
      }
    }
    return songPtr;
  }

  private loadSong(module: LibTimidityModule, data: Uint8Array): number {
    const optionsPtr = module._mid_alloc_options(SAMPLE_RATE, AUDIO_FORMAT_S16, CHANNELS, BUFFER_SIZE);
    const dataPtr = module._malloc(data.byteLength);
    module.HEAPU8.set(data, dataPtr);
    const streamPtr = module._mid_istream_open_mem(dataPtr, data.byteLength);
    const songPtr = module._mid_song_load(streamPtr, optionsPtr);
    module._mid_istream_close(streamPtr);
    module._free(optionsPtr);
    module._free(dataPtr);
    if (!songPtr) {
      throw new Error("failed to load MIDI data");
    }
    return songPtr;
  }

  private missingInstruments(module: LibTimidityModule, songPtr: number, count: number): string[] {
    const instruments: string[] = [];
    for (let i = 0; i < count; ++i) {
      const ptr = module._mid_get_load_request(songPtr, i);
      const instrument = module.UTF8ToString(ptr);
      if (instrument) {
        instruments.push(instrument);
      }
    }
    return instruments;
  }

  private onAudioProcess(event: AudioProcessingEvent): void {
    const output0 = event.outputBuffer.getChannelData(0);
    const output1 = event.outputBuffer.getChannelData(1);
    if (this._stopped || this._paused || !this._ready || !this._module || !this._songPtr) {
      output0.fill(0);
      output1.fill(0);
      return;
    }

    const byteCount = this._module._mid_song_read_wave(this._songPtr, this._bufferPtr, BUFFER_SIZE * BYTES_PER_SAMPLE);
    const sampleCount = Math.trunc(byteCount / BYTES_PER_SAMPLE);
    if (sampleCount > 0) {
      this._array.set(this._module.HEAP16.subarray(this._bufferPtr / 2, (this._bufferPtr + byteCount) / 2));
    } else if (this._loop) {
      this._module._mid_song_seek(this._songPtr, 0);
      this._module._mid_song_start(this._songPtr);
    } else {
      this._paused = true;
    }

    for (let i = 0; i < sampleCount; ++i) {
      output0[i] = this._array[i * 2] / 0x7fff;
      output1[i] = this._array[i * 2 + 1] / 0x7fff;
    }
    for (let i = sampleCount; i < BUFFER_SIZE; ++i) {
      output0[i] = 0;
      output1[i] = 0;
    }
  }
}
