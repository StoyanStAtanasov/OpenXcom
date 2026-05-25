import { Options } from "./Options.ts";

type MidiNote = {
  startTick: number;
  endTick: number;
  note: number;
  velocity: number;
  channel: number;
};

type MidiSequence = {
  duration: number;
  notes: Array<{ start: number; duration: number; note: number; velocity: number; channel: number }>;
};

type MidiPlaybackHandle = {
  stop?: () => void;
  pause?: () => void;
  resume?: () => void;
  setVolume?: (volume: number) => void;
};

export type BrowserMidiBackend = {
  play: (data: Uint8Array, options: { loop: boolean; volume: number }) => MidiPlaybackHandle | void | null;
};

export class Music {
  protected _music: Uint8Array | null = null;
  private _streamUrl: string | null = null;
  private _streamMime = "";
  private _midiSequence: MidiSequence | null = null;
  private _playCount = 0;
  private _lastLoop = -1;
  private _lastError = "";
  private static _playing = false;
  private static _paused = false;
  private static _currentAudio: HTMLAudioElement | null = null;
  private static _currentUrl: string | null = null;
  private static _context: AudioContext | null = null;
  private static _masterGain: GainNode | null = null;
  private static _currentSynth: { sources: AudioScheduledSourceNode[]; timers: number[] } | null = null;
  private static _currentMidiPlayback: MidiPlaybackHandle | null = null;
  private static _midiBackend: BrowserMidiBackend | null = null;
  private static _pendingPlayback: { music: Music; loop: number } | null = null;
  private static _userActivated = false;
  private static _unlockInstalled = false;
  private static _experimentalOscillatorMidi = false;
  private static _volume = 1.0;

  load(filename: string): void;
  load(data: ArrayBuffer | Uint8Array | number[], size?: number): void;
  load(data: string | ArrayBuffer | Uint8Array | number[], size?: number): void {
    if (typeof data === "string") {
      this._music = this.loadBinary(data);
      this._streamUrl = null;
      this._streamMime = "";
      this._lastError = "";
      return;
    }

    const bytes = data instanceof Uint8Array
      ? data.slice(0, size ?? data.length)
      : data instanceof ArrayBuffer
        ? new Uint8Array(data).slice(0, size ?? data.byteLength)
        : Uint8Array.from(data).slice(0, size ?? data.length);
    this._music = bytes;
    this._streamUrl = null;
    this._streamMime = "";
    this._midiSequence = null;
    this._lastError = "";
  }

  loadStream(url: string, mime: string): void {
    this._music = null;
    this._streamUrl = url;
    this._streamMime = mime;
    this._midiSequence = null;
    this._lastError = "";
  }

  play(loop = -1): boolean {
    if (Options.mute || (!this._music && !this._streamUrl)) {
      return false;
    }
    ++this._playCount;
    this._lastLoop = loop;
    Music._playing = true;
    Music._paused = false;
    Music.stopCurrentAudio();
    const started = this.startPlayback(loop);
    if (!started) {
      Music._playing = false;
    }
    return started;
  }

  private startPlayback(loop: number): boolean {
    if (!this._music && !this._streamUrl) {
      return false;
    }
    const mime = this.detectMimeType();
    if (mime === "audio/midi" && !Music.hasMidiPlaybackPath()) {
      this._lastError = "MIDI playback requires a browser MIDI backend or streamable digital music";
      return false;
    }
    if (!Music.hasUserActivation()) {
      Music.deferPlayback(this, loop);
      return true;
    }
    if (mime === "audio/midi") {
      if (this.playNativeAudio(mime, loop)) {
        return true;
      }
      if (this.playMidiBackend(loop)) {
        return true;
      }
      if (Music._experimentalOscillatorMidi && this.playMidiSynth(loop)) {
        return true;
      }
      this._lastError = "MIDI playback requires a browser MIDI backend or streamable digital music";
      return false;
    }
    if (this.playNativeAudio(mime, loop)) {
      return true;
    }
    this._lastError = `unsupported ${mime}`;
    return false;
  }

  private playNativeAudio(mime: string, loop: number): boolean {
    if (!this._music && !this._streamUrl) {
      return false;
    }
    if (typeof Audio === "undefined" || typeof URL === "undefined") {
      return false;
    }
    const audio = new Audio();
    const canPlay = !audio.canPlayType || audio.canPlayType(mime) !== "";
    if (!canPlay) {
      return false;
    }
    const url = this._streamUrl || URL.createObjectURL(new Blob([this._music?.slice() || new Uint8Array()], { type: mime }));
    audio.src = url;
    audio.loop = loop !== 0;
    audio.volume = Music._volume;
    Music._currentAudio = audio;
    Music._currentUrl = this._streamUrl ? null : url;
    void audio.play().catch(error => {
      this._lastError = error instanceof Error ? error.message : "playback failed";
      if (error instanceof DOMException && error.name === "NotAllowedError") {
        Music.deferPlayback(this, loop);
      } else if (Music._currentAudio === audio) {
        Music._playing = false;
      }
    });
    return true;
  }

  private playMidiBackend(loop: number): boolean {
    if (!this._music) {
      return false;
    }
    const backend = Music.currentMidiBackend();
    if (!backend) {
      return false;
    }
    try {
      const handle = backend.play(this._music.slice(), { loop: loop !== 0, volume: Music._volume }) || null;
      Music._currentMidiPlayback = handle;
      return true;
    } catch (error) {
      this._lastError = error instanceof Error ? error.message : "MIDI backend failed";
      Music._currentMidiPlayback = null;
      return false;
    }
  }

  private playMidiSynth(loop: number): boolean {
    const context = Music.audioContext();
    if (!context || !this._music) {
      Music.deferPlayback(this, loop);
      return true;
    }
    const sequence = this.parseMidiSequence();
    if (!sequence || sequence.notes.length === 0) {
      this._lastError = "MIDI contains no note events";
      return false;
    }
    Music.stopCurrentSynth();
    if (!Music._masterGain) {
      Music._masterGain = context.createGain();
      Music._masterGain.connect(context.destination);
    }
    Music._masterGain.gain.setValueAtTime(Music._paused ? 0 : Music._volume, context.currentTime);

    const sources: AudioScheduledSourceNode[] = [];
    const timers: number[] = [];
    const baseTime = context.currentTime + 0.05;
    const maxDuration = Math.min(sequence.duration, 360);
    for (const note of sequence.notes) {
      if (note.start > maxDuration) {
        continue;
      }
      const start = baseTime + note.start;
      const duration = Math.max(0.05, Math.min(note.duration, maxDuration - note.start));
      const end = start + duration;
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = note.channel === 9 ? "triangle" : "sine";
      oscillator.frequency.setValueAtTime(440 * Math.pow(2, (note.note - 69) / 12), start);
      const level = (note.velocity / 127) * (note.channel === 9 ? 0.05 : 0.08);
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(level, start + 0.01);
      gain.gain.setValueAtTime(level, Math.max(start + 0.01, end - 0.03));
      gain.gain.linearRampToValueAtTime(0, end);
      oscillator.connect(gain);
      gain.connect(Music._masterGain);
      oscillator.start(start);
      oscillator.stop(end + 0.02);
      sources.push(oscillator);
    }

    const delay = Math.max(100, Math.trunc(maxDuration * 1000));
    if (loop !== 0) {
      timers.push(window.setTimeout(() => {
        if (Music._playing && !Music._paused) {
          this.startPlayback(loop);
        }
      }, delay));
    } else {
      timers.push(window.setTimeout(() => {
        if (Music._currentSynth?.sources === sources) {
          Music._currentSynth = null;
          Music._playing = false;
        }
      }, delay + 100));
    }
    Music._currentSynth = { sources, timers };
    return true;
  }

  static stop(): void {
    Music._pendingPlayback = null;
    Music.stopCurrentAudio();
    Music._playing = false;
    Music._paused = false;
  }

  static pause(): void {
    if (Music._playing) {
      Music._paused = true;
      Music._currentAudio?.pause();
      Music._currentMidiPlayback?.pause?.();
      if (Music._masterGain) {
        Music._masterGain.gain.value = 0;
      }
    }
  }

  static resume(): void {
    if (Music._playing) {
      Music._paused = false;
      void Music._currentAudio?.play().catch(() => undefined);
      Music._currentMidiPlayback?.resume?.();
      if (Music._masterGain) {
        Music._masterGain.gain.value = Music._volume;
      }
    }
  }

  static isPlaying(): boolean {
    return Music._playing && !Music._paused;
  }

  static setVolume(volume: number): void {
    Music._volume = Math.max(0, Math.min(1, volume));
    if (Music._currentAudio) {
      Music._currentAudio.volume = Music._volume;
    }
    Music._currentMidiPlayback?.setVolume?.(Music._volume);
    if (Music._masterGain) {
      Music._masterGain.gain.value = Music._paused ? 0 : Music._volume;
    }
  }

  static setMidiBackend(backend: BrowserMidiBackend | null): void {
    Music._midiBackend = backend;
  }

  static setExperimentalOscillatorMidi(enabled: boolean): void {
    Music._experimentalOscillatorMidi = enabled;
  }

  private static currentMidiBackend(): BrowserMidiBackend | null {
    return Music._midiBackend || (globalThis as typeof globalThis & { openxcomMidiBackend?: BrowserMidiBackend }).openxcomMidiBackend || null;
  }

  private static hasMidiPlaybackPath(): boolean {
    return Music.canPlayMimeType("audio/midi") || Music.currentMidiBackend() != null || Music._experimentalOscillatorMidi;
  }

  static getVolume(): number {
    return Music._volume;
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

  getSourceKind(): "empty" | "stream" | "buffer" {
    if (this._streamUrl) {
      return "stream";
    }
    if (this._music) {
      return "buffer";
    }
    return "empty";
  }

  getMimeType(): string {
    return this.detectMimeType();
  }

  static canPlayMimeType(mime: string): boolean {
    if (typeof Audio === "undefined") {
      return false;
    }
    const audio = new Audio();
    return !audio.canPlayType || audio.canPlayType(mime) !== "";
  }

  private static stopCurrentAudio(): void {
    Music.stopCurrentSynth();
    Music.stopCurrentMidiPlayback();
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

  private static stopCurrentMidiPlayback(): void {
    try {
      Music._currentMidiPlayback?.stop?.();
    } catch {
      // Match SDL_mixer tolerance for stopping an already-finished stream.
    }
    Music._currentMidiPlayback = null;
  }

  private static stopCurrentSynth(): void {
    if (!Music._currentSynth) {
      return;
    }
    for (const timer of Music._currentSynth.timers) {
      if (typeof window !== "undefined") {
        window.clearTimeout(timer);
      }
    }
    for (const source of Music._currentSynth.sources) {
      try {
        source.stop();
      } catch {
        // SDL_mixer stop is forgiving; keep browser synthesized MIDI equally tolerant.
      }
    }
    Music._currentSynth = null;
  }

  private static audioContext(): AudioContext | null {
    if (typeof window === "undefined") {
      return null;
    }
    Music.installUnlockListeners();
    if (!Music.hasUserActivation()) {
      return null;
    }
    if (!Music._context) {
      const AudioCtor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtor) {
        return null;
      }
      try {
        Music._context = new AudioCtor();
      } catch {
        return null;
      }
    }
    if (Music._context.state === "suspended") {
      void Music._context.resume().catch(() => undefined);
    }
    return Music._context;
  }

  private static hasUserActivation(): boolean {
    Music.installUnlockListeners();
    const activation = typeof navigator !== "undefined"
      ? (navigator as unknown as { userActivation?: { hasBeenActive?: boolean; isActive?: boolean } }).userActivation
      : undefined;
    return Music._userActivated || Boolean(activation?.hasBeenActive || activation?.isActive);
  }

  private static deferPlayback(music: Music, loop: number): void {
    Music._pendingPlayback = { music, loop };
    Music.installUnlockListeners();
  }

  private static installUnlockListeners(): void {
    if (Music._unlockInstalled || typeof window === "undefined") {
      return;
    }
    Music._unlockInstalled = true;
    const unlock = () => {
      Music._userActivated = true;
      if (Music._context?.state === "suspended") {
        void Music._context.resume().catch(() => undefined);
      }
      const pending = Music._pendingPlayback;
      Music._pendingPlayback = null;
      if (pending && !Options.mute) {
        if (!pending.music.startPlayback(pending.loop)) {
          Music._playing = false;
        }
      }
    };
    window.addEventListener("pointerdown", unlock, { once: true, capture: true });
    window.addEventListener("keydown", unlock, { once: true, capture: true });
    window.addEventListener("touchstart", unlock, { once: true, capture: true, passive: true });
  }

  private detectMimeType(): string {
    if (this._streamMime) {
      return this._streamMime;
    }
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

  private parseMidiSequence(): MidiSequence | null {
    if (this._midiSequence) {
      return this._midiSequence;
    }
    if (!this._music || this._music.length < 14 || this.detectMimeType() !== "audio/midi") {
      return null;
    }
    const data = this._music;
    let offset = 0;
    const readU16 = (pos: number) => ((data[pos] || 0) << 8) | (data[pos + 1] || 0);
    const readU32 = (pos: number) => ((data[pos] || 0) * 0x1000000) + ((data[pos + 1] || 0) << 16) + ((data[pos + 2] || 0) << 8) + (data[pos + 3] || 0);
    const readString = (pos: number, length: number) => String.fromCharCode(...data.subarray(pos, pos + length));
    const readVariable = (cursor: { offset: number }, end: number) => {
      let value = 0;
      for (let i = 0; i < 4 && cursor.offset < end; ++i) {
        const byte = data[cursor.offset++] || 0;
        value = (value << 7) | (byte & 0x7f);
        if ((byte & 0x80) === 0) {
          break;
        }
      }
      return value;
    };

    if (readString(offset, 4) !== "MThd") {
      return null;
    }
    offset += 4;
    const headerLength = readU32(offset);
    offset += 4;
    if (headerLength < 6 || offset + headerLength > data.length) {
      return null;
    }
    offset += 2;
    const trackCount = readU16(offset);
    offset += 2;
    const division = readU16(offset);
    offset += headerLength - 4;
    const ticksPerQuarter = (division & 0x8000) === 0 ? division : 96;
    const notes: MidiNote[] = [];
    const tempos = [{ tick: 0, tempo: 500000 }];

    for (let track = 0; track < trackCount && offset + 8 <= data.length; ++track) {
      if (readString(offset, 4) !== "MTrk") {
        break;
      }
      offset += 4;
      const trackLength = readU32(offset);
      offset += 4;
      const end = Math.min(data.length, offset + trackLength);
      const cursor = { offset };
      let tick = 0;
      let runningStatus = 0;
      const active = new Map<string, Array<{ tick: number; velocity: number }>>();
      while (cursor.offset < end) {
        tick += readVariable(cursor, end);
        let status = data[cursor.offset++] || 0;
        if (status < 0x80) {
          cursor.offset--;
          status = runningStatus;
        } else {
          runningStatus = status;
        }
        if (status === 0xff) {
          const type = data[cursor.offset++] || 0;
          const length = readVariable(cursor, end);
          if (type === 0x51 && length === 3 && cursor.offset + 3 <= end) {
            tempos.push({
              tick,
              tempo: ((data[cursor.offset] || 0) << 16) | ((data[cursor.offset + 1] || 0) << 8) | (data[cursor.offset + 2] || 0)
            });
          }
          cursor.offset = Math.min(end, cursor.offset + length);
          if (type === 0x2f) {
            break;
          }
          continue;
        }
        if (status === 0xf0 || status === 0xf7) {
          cursor.offset = Math.min(end, cursor.offset + readVariable(cursor, end));
          continue;
        }
        const command = status & 0xf0;
        const channel = status & 0x0f;
        const oneByte = command === 0xc0 || command === 0xd0;
        const data1 = data[cursor.offset++] || 0;
        const data2 = oneByte ? 0 : (data[cursor.offset++] || 0);
        if (command === 0x90 && data2 > 0) {
          const key = `${channel}:${data1}`;
          const stack = active.get(key) || [];
          stack.push({ tick, velocity: data2 });
          active.set(key, stack);
        } else if (command === 0x80 || (command === 0x90 && data2 === 0)) {
          const key = `${channel}:${data1}`;
          const stack = active.get(key);
          const start = stack?.shift();
          if (start && tick > start.tick) {
            notes.push({ startTick: start.tick, endTick: tick, note: data1, velocity: start.velocity, channel });
          }
          if (stack && stack.length === 0) {
            active.delete(key);
          }
        }
      }
      offset = end;
    }

    tempos.sort((a, b) => a.tick - b.tick);
    const tickToSeconds = (target: number) => {
      let seconds = 0;
      let lastTick = 0;
      let tempo = 500000;
      for (const event of tempos) {
        if (event.tick > target) {
          break;
        }
        seconds += ((event.tick - lastTick) * tempo) / ticksPerQuarter / 1000000;
        tempo = event.tempo;
        lastTick = event.tick;
      }
      seconds += ((target - lastTick) * tempo) / ticksPerQuarter / 1000000;
      return seconds;
    };
    const sequenceNotes = notes.map(note => {
      const start = tickToSeconds(note.startTick);
      const end = tickToSeconds(note.endTick);
      return { start, duration: Math.max(0.05, end - start), note: note.note, velocity: note.velocity, channel: note.channel };
    }).sort((a, b) => a.start - b.start);
    const duration = sequenceNotes.reduce((max, note) => Math.max(max, note.start + note.duration), 0);
    this._midiSequence = { duration, notes: sequenceNotes };
    return this._midiSequence;
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
