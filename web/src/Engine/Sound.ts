import { Options } from "./Options.ts";

export class Sound {
  private _sound: Uint8Array | null = null;
  private _decoded: Promise<AudioBuffer | null> | null = null;
  private _loopSource: AudioBufferSourceNode | null = null;
  private _playCount = 0;
  private _lastChannel = -1;
  private _lastAngle = 0;
  private _lastDistance = 0;
  private static _context: AudioContext | null = null;
  private static _defaultVolume = 1.0;
  private static _channelVolumes = new Map<number, number>();
  private static _loopingSounds = new Set<Sound>();
  private static _groupCursor = new Map<number, number>([[0, 1]]);

  load(filename: string): void;
  load(data: ArrayBuffer | Uint8Array | number[], size?: number): void;
  load(data: string | ArrayBuffer | Uint8Array | number[], size?: number): void {
    if (typeof data === "string") {
      this._sound = this.loadBinary(data);
      this._decoded = null;
      return;
    }

    this._sound = data instanceof Uint8Array
      ? data.slice(0, size ?? data.length)
      : data instanceof ArrayBuffer
        ? new Uint8Array(data).slice(0, size ?? data.byteLength)
        : Uint8Array.from(data).slice(0, size ?? data.length);
    this._decoded = null;
  }

  play(channel = -1, angle = 0, distance = 0): void {
    if (Options.mute || !this._sound) {
      return;
    }
    ++this._playCount;
    this._lastChannel = channel;
    this._lastAngle = angle;
    this._lastDistance = distance;
    const context = Sound.audioContext();
    if (!context) {
      return;
    }
    void this.decode(context).then(buffer => {
      if (!buffer) {
        return;
      }
      const source = context.createBufferSource();
      const gain = context.createGain();
      source.buffer = buffer;
      gain.gain.value = Sound.getVolume(channel);
      source.connect(gain);
      gain.connect(context.destination);
      source.start();
    });
  }

  static stop(): void {
    for (const sound of [...Sound._loopingSounds]) {
      sound.stopLoop();
    }
  }

  static setVolume(channel: number, volume: number): void {
    const clamped = Math.max(0, Math.min(1, volume));
    if (channel < 0) {
      Sound._defaultVolume = clamped;
      return;
    }
    Sound._channelVolumes.set(channel, clamped);
  }

  static getVolume(channel = -1): number {
    if (channel >= 0) {
      return Sound._channelVolumes.get(channel) ?? Sound._defaultVolume;
    }
    return Sound._defaultVolume;
  }

  static groupAvailable(group: number): number {
    if (group === 0) {
      const current = Sound._groupCursor.get(group) ?? 1;
      Sound._groupCursor.set(group, current === 1 ? 2 : 1);
      return current;
    }
    return -1;
  }

  loop(): void {
    if (Options.mute || !this._sound || this._loopSource) {
      return;
    }
    const context = Sound.audioContext();
    if (!context) {
      return;
    }
    void this.decode(context).then(buffer => {
      if (!buffer) {
        return;
      }
      this.stopLoop();
      const source = context.createBufferSource();
      const gain = context.createGain();
      source.buffer = buffer;
      source.loop = true;
      gain.gain.value = Sound.getVolume(3);
      source.connect(gain);
      gain.connect(context.destination);
      source.onended = () => {
        if (this._loopSource === source) {
          this._loopSource = null;
          Sound._loopingSounds.delete(this);
        }
      };
      source.start();
      this._loopSource = source;
      Sound._loopingSounds.add(this);
    });
  }

  stopLoop(): void {
    if (this._loopSource) {
      try {
        this._loopSource.stop();
      } catch {
        // SDL_mixer stop is forgiving; keep the browser path equally tolerant.
      }
      Sound._loopingSounds.delete(this);
      this._loopSource = null;
    }
  }

  getPlayCount(): number {
    return this._playCount;
  }

  getLastPlayback(): { channel: number; angle: number; distance: number } {
    return {
      channel: this._lastChannel,
      angle: this._lastAngle,
      distance: this._lastDistance
    };
  }

  private static audioContext(): AudioContext | null {
    if (typeof window === "undefined") {
      return null;
    }
    if (!Sound._context) {
      const AudioCtor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtor) {
        return null;
      }
      Sound._context = new AudioCtor();
    }
    if (Sound._context.state === "suspended") {
      void Sound._context.resume();
    }
    return Sound._context;
  }

  private decode(context: AudioContext): Promise<AudioBuffer | null> {
    if (!this._sound) {
      return Promise.resolve(null);
    }
    if (!this._decoded) {
      const data = this._sound.slice().buffer;
      this._decoded = context.decodeAudioData(data).catch(() => null);
    }
    return this._decoded;
  }

  private loadBinary(path: string): Uint8Array {
    const request = new XMLHttpRequest();
    request.open("GET", path, false);
    request.overrideMimeType("text/plain; charset=x-user-defined");
    try {
      request.send();
    } catch (error) {
      throw new Error(`Sound ${path}: ${error instanceof Error ? error.message : "failed to load"}`);
    }
    if (request.status !== 200 && request.status !== 0) {
      throw new Error(`Sound ${path}: HTTP ${request.status}`);
    }
    const response = request.responseText;
    if (typeof response !== "string") {
      throw new Error(`Sound ${path}: no data`);
    }
    const bytes = new Uint8Array(response.length);
    for (let i = 0; i < response.length; ++i) {
      bytes[i] = response.charCodeAt(i) & 0xff;
    }
    return bytes;
  }
}
