import { Options } from "./Options.ts";

export class Music {
  protected _music: Uint8Array | null = null;
  private _playCount = 0;
  private _lastLoop = -1;
  private _lastError = "";
  private static _playing = false;
  private static _paused = false;
  private static _currentAudio: HTMLAudioElement | null = null;
  private static _currentUrl: string | null = null;

  load(filename: string): void;
  load(data: ArrayBuffer | Uint8Array | number[], size?: number): void;
  load(data: string | ArrayBuffer | Uint8Array | number[], size?: number): void {
    if (typeof data === "string") {
      this._music = this.loadBinary(data);
      this._lastError = "";
      return;
    }

    const bytes = data instanceof Uint8Array
      ? data.slice(0, size ?? data.length)
      : data instanceof ArrayBuffer
        ? new Uint8Array(data).slice(0, size ?? data.byteLength)
        : Uint8Array.from(data).slice(0, size ?? data.length);
    this._music = bytes;
    this._lastError = "";
  }

  play(loop = -1): void {
    if (Options.mute || !this._music) {
      return;
    }
    ++this._playCount;
    this._lastLoop = loop;
    Music._playing = true;
    Music._paused = false;
    Music.stopCurrentAudio();
    if (typeof Audio === "undefined" || typeof URL === "undefined") {
      return;
    }
    const mime = this.detectMimeType();
    const audio = new Audio();
    const canPlay = !audio.canPlayType || audio.canPlayType(mime) !== "";
    if (!canPlay) {
      return;
    }
    const url = URL.createObjectURL(new Blob([this._music.slice()], { type: mime }));
    audio.src = url;
    audio.loop = loop !== 0;
    audio.volume = Math.max(0, Math.min(128, Options.musicVolume)) / 128;
    Music._currentAudio = audio;
    Music._currentUrl = url;
    void audio.play().catch(error => {
      this._lastError = error instanceof Error ? error.message : "playback failed";
    });
  }

  static stop(): void {
    Music.stopCurrentAudio();
    Music._playing = false;
    Music._paused = false;
  }

  static pause(): void {
    if (Music._playing) {
      Music._paused = true;
      Music._currentAudio?.pause();
    }
  }

  static resume(): void {
    if (Music._playing) {
      Music._paused = false;
      void Music._currentAudio?.play().catch(() => undefined);
    }
  }

  static isPlaying(): boolean {
    return Music._playing && !Music._paused;
  }

  getPlayCount(): number {
    return this._playCount;
  }

  getLastLoop(): number {
    return this._lastLoop;
  }

  getLastError(): string {
    return this._lastError;
  }

  private static stopCurrentAudio(): void {
    if (Music._currentAudio) {
      Music._currentAudio.pause();
      Music._currentAudio.removeAttribute("src");
      Music._currentAudio.load();
      Music._currentAudio = null;
    }
    if (Music._currentUrl) {
      URL.revokeObjectURL(Music._currentUrl);
      Music._currentUrl = null;
    }
  }

  private detectMimeType(): string {
    if (!this._music || this._music.length < 4) {
      return "audio/mpeg";
    }
    const signature = String.fromCharCode(this._music[0], this._music[1], this._music[2], this._music[3]);
    if (signature === "MThd") {
      return "audio/midi";
    }
    if (signature === "RIFF") {
      return "audio/wav";
    }
    if (signature === "OggS") {
      return "audio/ogg";
    }
    return "audio/mpeg";
  }

  protected loadBinary(path: string): Uint8Array {
    const request = new XMLHttpRequest();
    request.open("GET", path, false);
    request.overrideMimeType("text/plain; charset=x-user-defined");
    try {
      request.send();
    } catch (error) {
      throw new Error(`Music ${path}: ${error instanceof Error ? error.message : "failed to load"}`);
    }
    if (request.status !== 200 && request.status !== 0) {
      throw new Error(`Music ${path}: HTTP ${request.status}`);
    }
    const response = request.responseText;
    if (typeof response !== "string") {
      throw new Error(`Music ${path}: no data`);
    }
    const bytes = new Uint8Array(response.length);
    for (let i = 0; i < response.length; ++i) {
      bytes[i] = response.charCodeAt(i) & 0xff;
    }
    return bytes;
  }
}
