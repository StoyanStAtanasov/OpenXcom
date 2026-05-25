import { Game } from "./Game.ts";
import { Logger, LOG_ERROR, LOG_INFO, LOG_WARNING } from "./Logger.ts";
import { Options } from "./Options.ts";
import { Screen } from "./Screen.ts";
import { Surface } from "./Surface.ts";

enum PlayingState {
  PLAYING,
  FINISHED,
  SKIPPED
}

export class FlcPlayer {
  private _fileBuf: Uint8Array | null = null;
  private _fileSize = 0;
  private _videoFrameData = 0;
  private _chunkData = 0;
  private _audioFrameData = 0;
  private _frameCount = 0;
  private _headerSize = 0;
  private _headerType = 0;
  private _headerFrames = 0;
  private _headerWidth = 0;
  private _headerHeight = 0;
  private _headerDepth = 0;
  private _headerSpeed = 0;
  private _videoFrameSize = 0;
  private _videoFrameType = 0;
  private _frameChunks = 0;
  private _chunkSize = 0;
  private _chunkType = 0;
  private _delayOverride = 0;
  private _audioFrameSize = 0;
  private _audioFrameType = 0;
  private _frameCallBack: (() => void) | null = null;
  private _mainScreen: Surface | null = null;
  private _realScreen: Screen | null = null;
  private _colors: Array<{ r: number; g: number; b: number; a?: number }> = Array.from({ length: 256 }, () => ({ r: 0, g: 0, b: 0, a: 255 }));
  private _screenWidth = 0;
  private _screenHeight = 0;
  private _screenDepth = 0;
  private _dx = 0;
  private _dy = 0;
  private _offset = 0;
  private _playingState = PlayingState.FINISHED;
  private _hasAudio = false;
  private _useInternalAudio = false;
  private _videoDelay = 0;
  private _volume = Game.volumeExponent(Options.musicVolume);
  private _game: Game | null = null;

  init(filename: string, frameCallBack: () => void, game: Game, useInternalAudio: boolean, dx: number, dy: number): boolean {
    if (this._fileBuf) {
      Logger.log(LOG_ERROR, "Trying to init a video player that is already initialized");
      return false;
    }

    this._frameCallBack = frameCallBack;
    this._realScreen = game.getScreen();
    this._realScreen.clear();
    this._game = game;
    this._useInternalAudio = useInternalAudio;
    this._dx = dx;
    this._dy = dy;

    this._fileSize = 0;
    this._frameCount = 0;
    this._audioFrameData = 0;
    this._hasAudio = false;

    const bytes = this.loadBinary(filename);
    if (!bytes) {
      Logger.log(LOG_ERROR, `Could not open FLI/FLC file: ${filename}`);
      return false;
    }

    this._fileBuf = bytes;
    this._fileSize = bytes.length;
    this._audioFrameData = 128;
    this.readFileHeader();

    if (this._headerType === 0xAF11 || this._headerType === 0xAF12) {
      this._screenWidth = this._headerWidth;
      this._screenHeight = this._headerHeight;
      this._screenDepth = 8;
      Logger.log(LOG_INFO, `Playing flx, ${this._screenWidth}x${this._screenHeight}, ${this._headerFrames} frames`);
    } else {
      Logger.log(LOG_ERROR, "Flx file failed header check.");
      return false;
    }

    this._mainScreen = this._realScreen.getSurface();
    return true;
  }

  play(skipLastFrame: boolean): void {
    void skipLastFrame;
    this._playingState = PlayingState.PLAYING;
    Logger.log(LOG_WARNING, "FlcPlayer browser boundary: FLI/FLC playback is not implemented in the browser port yet.");
    this._playingState = PlayingState.FINISHED;
  }

  deInit(): void {
    this._mainScreen = null;
    this._fileBuf = null;
    this.deInitAudio();
  }

  stop(): void {
    this._playingState = PlayingState.FINISHED;
  }

  delay(_milliseconds: number): void {}

  setHeaderSpeed(speed: number): void {
    this._headerSpeed = speed;
  }

  getFrameCount(): number {
    return this._frameCount;
  }

  wasSkipped(): boolean {
    return this._playingState === PlayingState.SKIPPED;
  }

  private readU16(src: number): number {
    return this._fileBuf ? ((this._fileBuf[src + 1] << 8) | this._fileBuf[src]) : 0;
  }

  private readU32(src: number): number {
    return this._fileBuf
      ? ((this._fileBuf[src + 3] << 24) | (this._fileBuf[src + 2] << 16) | (this._fileBuf[src + 1] << 8) | this._fileBuf[src])
      : 0;
  }

  private readS16(src: number): number {
    const value = this.readU16(src);
    return value & 0x8000 ? value - 0x10000 : value;
  }

  private readS32(src: number): number {
    const value = this.readU32(src);
    return value | 0;
  }

  private readFileHeader(): void {
    if (!this._fileBuf) {
      return;
    }
    this._headerSize = this.readU32(0);
    this._headerType = this.readU16(4);
    this._headerFrames = this.readU16(6);
    this._headerWidth = this.readU16(8);
    this._headerHeight = this.readU16(10);
    this._headerDepth = this.readU16(12);
    this._headerSpeed = this.readU16(16);
  }

  private isValidFrame(frameHeader: number): boolean {
    if (!this._fileBuf) {
      return false;
    }
    this._videoFrameSize = this.readU32(frameHeader);
    this._videoFrameType = this.readU16(frameHeader + 4);
    return this._videoFrameType === 0xF1FA || this._videoFrameType === 0xAAAA || this._videoFrameType === 0xF100;
  }

  private decodeVideo(_skipLastFrame: boolean): void {}
  private decodeAudio(_frames: number): void {}
  private waitForNextFrame(_delay: number): void {}
  private shouldQuit(): boolean {
    return this._playingState === PlayingState.FINISHED || this._playingState === PlayingState.SKIPPED;
  }
  private playVideoFrame(): void {}
  private color256(): void {}
  private fliBRun(): void {}
  private fliCopy(): void {}
  private fliSS2(): void {}
  private fliLC(): void {}
  private color64(): void {}
  private black(): void {}
  private playAudioFrame(_sampleRate: number): void {}
  private initAudio(_format: number, _channels: number): void {}
  private deInitAudio(): void {}
  private isEndOfFile(pos: number): boolean {
    return pos >= this._fileSize;
  }
  private static audioCallback(_userData: unknown, _stream: Uint8Array, _len: number): void {}

  private loadBinary(path: string): Uint8Array | null {
    const request = new XMLHttpRequest();
    request.open("GET", path, false);
    request.responseType = "arraybuffer";
    try {
      request.send();
    } catch (error) {
      Logger.log(LOG_ERROR, `Could not open FLI/FLC file: ${path}`);
      return null;
    }
    if (request.status !== 200 && request.status !== 0) {
      Logger.log(LOG_ERROR, `Could not open FLI/FLC file: ${path}`);
      return null;
    }
    const response = request.response;
    if (!(response instanceof ArrayBuffer)) {
      return null;
    }
    return new Uint8Array(response);
  }
}
