import { Game } from "./Game.ts";
import { Logger, LOG_ERROR, LOG_INFO, LOG_WARNING } from "./Logger.ts";
import { Options } from "./Options.ts";
import { Surface } from "./Surface.ts";
import type { Screen } from "./Screen.ts";
import type { PaletteColor } from "../types.ts";

const FLI_TYPE = 0xAF11;
const FLC_TYPE = 0xAF12;

const COLOR_256 = 0x04;
const FLI_SS2 = 0x07;
const COLOR_64 = 0x0B;
const FLI_LC = 0x0C;
const BLACK = 0x0D;
const FLI_BRUN = 0x0F;
const FLI_COPY = 0x10;

const AUDIO_CHUNK = 0xAAAA;
const PREFIX_CHUNK = 0xF100;
const FRAME_TYPE = 0xF1FA;

const PACKETS_COUNT = 0x0000;
const LAST_PIXEL = 0x8000;
const SKIP_LINES = 0xC000;
const MASK = SKIP_LINES;

enum PlayingState {
  PLAYING,
  FINISHED,
  SKIPPED
}

type FrameHeader = {
  size: number;
  type: number;
};

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
  private _colors: PaletteColor[] = Array.from({ length: 256 }, () => ({ r: 0, g: 0, b: 0, a: 255 }));
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
  private _skipLastFrame = false;
  private _oldTick = 0;
  private _audioSampleRate = 0;
  private _audioContext: AudioContext | null = null;
  private _audioNextTime = 0;

  init(filename: string, frameCallBack: (() => void) | null, game: Game, useInternalAudio: boolean, dx: number, dy: number): boolean {
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
    this._audioSampleRate = 0;
    this._audioNextTime = 0;

    const bytes = this.loadBinary(filename);
    if (!bytes) {
      Logger.log(LOG_ERROR, `Could not open FLI/FLC file: ${filename}`);
      return false;
    }

    this._fileBuf = bytes;
    this._fileSize = bytes.length;
    this._audioFrameData = 128;
    this.readFileHeader();

    if (this._headerType === FLI_TYPE || this._headerType === FLC_TYPE) {
      this._screenWidth = this._headerWidth;
      this._screenHeight = this._headerHeight;
      this._screenDepth = 8;
      Logger.log(LOG_INFO, `Playing flx, ${this._screenWidth}x${this._screenHeight}, ${this._headerFrames} frames`);
    } else {
      Logger.log(LOG_ERROR, "Flx file failed header check.");
      return false;
    }

    if (this._screenWidth > this._realScreen.getSurface().getWidth() && Options.displayWidth >= this._screenWidth) {
      Options.baseXResolution = this._screenWidth;
      Options.baseYResolution = this._screenHeight;
      this._realScreen.resetDisplay();
    }

    const realSurface = this._realScreen.getSurface();
    this._mainScreen = new Surface(realSurface.getWidth(), realSurface.getHeight());
    this._mainScreen.setPalette(this._realScreen.getPalette());
    return true;
  }

  play(skipLastFrame: boolean): void {
    if (!this._fileBuf || !this._mainScreen) {
      this._playingState = PlayingState.FINISHED;
      return;
    }
    this._playingState = PlayingState.PLAYING;
    this._skipLastFrame = skipLastFrame;
    this._dy = Math.trunc((this._mainScreen.getHeight() - this._headerHeight) / 2);
    this._offset = this._dy * this._mainScreen.getPitch() + this._dx;
    this._videoFrameData = 128;
    this._audioFrameData = this._videoFrameData;
    this._oldTick = 0;
  }

  tick(maxFrames = 4): boolean {
    let advancedFrames = 0;
    while (!this.shouldQuit() && advancedFrames < maxFrames) {
      if (this._frameCallBack) {
        this._frameCallBack();
      } else {
        this.decodeAudio(2);
      }

      if (this.shouldQuit()) {
        break;
      }

      const advanced = this.decodeVideo(this._skipLastFrame);
      if (!advanced) {
        break;
      }
      ++advancedFrames;
    }
    return !this.shouldQuit();
  }

  blit(surface: Surface): void {
    this._mainScreen?.blit(surface);
  }

  deInit(): void {
    this._mainScreen = null;
    this._fileBuf = null;
    this.deInitAudio();
  }

  stop(): void {
    this._playingState = PlayingState.FINISHED;
  }

  skip(): void {
    this._playingState = PlayingState.SKIPPED;
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

  isPlaying(): boolean {
    return this._playingState === PlayingState.PLAYING;
  }

  private readU16(src: number): number {
    return this._fileBuf ? ((this._fileBuf[src + 1] << 8) | this._fileBuf[src]) : 0;
  }

  private readU32(src: number): number {
    return this._fileBuf
      ? (((this._fileBuf[src + 3] << 24) | (this._fileBuf[src + 2] << 16) | (this._fileBuf[src + 1] << 8) | this._fileBuf[src]) >>> 0)
      : 0;
  }

  private readS8(src: number): number {
    const value = this._fileBuf?.[src] ?? 0;
    return value & 0x80 ? value - 0x100 : value;
  }

  private readS16(src: number): number {
    const value = this.readU16(src);
    return value & 0x8000 ? value - 0x10000 : value;
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

  private readFrameHeader(frameHeader: number): FrameHeader | null {
    if (!this._fileBuf || frameHeader + 6 > this._fileSize) {
      return null;
    }
    const size = this.readU32(frameHeader);
    const type = this.readU16(frameHeader + 4);
    if (type !== FRAME_TYPE && type !== AUDIO_CHUNK && type !== PREFIX_CHUNK) {
      return null;
    }
    return { size, type };
  }

  private decodeAudio(frames: number): void {
    let audioFramesFound = 0;

    while (audioFramesFound < frames && !this.isEndOfFile(this._audioFrameData)) {
      const frame = this.readFrameHeader(this._audioFrameData);
      if (!frame) {
        this._playingState = PlayingState.FINISHED;
        break;
      }

      this._audioFrameSize = frame.size;
      this._audioFrameType = frame.type;

      switch (this._audioFrameType) {
        case FRAME_TYPE:
        case PREFIX_CHUNK:
          this._audioFrameData += this._audioFrameSize;
          break;
        case AUDIO_CHUNK: {
          const sampleRate = this.readU16(this._audioFrameData + 8);
          this._chunkData = this._audioFrameData + 16;
          this.playAudioFrame(sampleRate);
          this._audioFrameData += this._audioFrameSize + 16;
          ++audioFramesFound;
          break;
        }
      }
    }
  }

  private decodeVideo(skipLastFrame: boolean): boolean {
    let videoFrameFound = false;

    while (!videoFrameFound) {
      const frame = this.readFrameHeader(this._videoFrameData);
      if (!frame) {
        this._playingState = PlayingState.FINISHED;
        break;
      }

      this._videoFrameSize = frame.size;
      this._videoFrameType = frame.type;

      switch (this._videoFrameType) {
        case FRAME_TYPE: {
          this._frameChunks = this.readU16(this._videoFrameData + 6);
          this._delayOverride = this.readU16(this._videoFrameData + 8);

          let delay: number;
          if (this._headerType === FLI_TYPE) {
            delay = this._delayOverride > 0 ? this._delayOverride : this._headerSpeed * (1000.0 / 70.0);
          } else if (this._useInternalAudio && !this._frameCallBack) {
            delay = this._videoDelay;
          } else {
            delay = this._headerSpeed;
          }

          if (this.waitForNextFrame(delay)) {
            return false;
          }

          this._chunkData = this._videoFrameData + 16;
          this._videoFrameData += this._videoFrameSize;
          if (this.isEndOfFile(this._videoFrameData)) {
            this._playingState = PlayingState.FINISHED;
          }

          if (!this.shouldQuit() || !skipLastFrame) {
            this.playVideoFrame();
          }

          videoFrameFound = true;
          break;
        }
        case AUDIO_CHUNK:
          this._videoFrameData += this._videoFrameSize + 16;
          break;
        case PREFIX_CHUNK:
          this._videoFrameData += this._videoFrameSize;
          break;
      }
    }

    return videoFrameFound;
  }

  private waitForNextFrame(delay: number): boolean {
    if (delay <= 0) {
      return false;
    }

    const now = performance.now();
    if (this._oldTick === 0) {
      this._oldTick = now;
      return false;
    }

    const newTick = this._oldTick + delay;
    if (now < newTick) {
      if (this._hasAudio) {
        let currentTick = now;
        while ((newTick - currentTick) > 10 && !this.isEndOfFile(this._audioFrameData)) {
          this.decodeAudio(1);
          currentTick = performance.now();
        }
      }
      return true;
    }

    this._oldTick = now;
    return false;
  }

  private shouldQuit(): boolean {
    return this._playingState === PlayingState.FINISHED || this._playingState === PlayingState.SKIPPED;
  }

  private playVideoFrame(): void {
    if (!this._mainScreen || !this._fileBuf) {
      return;
    }

    ++this._frameCount;
    const chunkCount = this._frameChunks;

    for (let i = 0; i < chunkCount; ++i) {
      this._chunkSize = this.readU32(this._chunkData);
      this._chunkType = this.readU16(this._chunkData + 4);

      switch (this._chunkType) {
        case COLOR_256:
          this.color256();
          break;
        case FLI_SS2:
          this.fliSS2();
          break;
        case COLOR_64:
          this.color64();
          break;
        case FLI_LC:
          this.fliLC();
          break;
        case BLACK:
          this.black();
          break;
        case FLI_BRUN:
          this.fliBRun();
          break;
        case FLI_COPY:
          this.fliCopy();
          break;
        case 18:
          break;
        default:
          Logger.log(LOG_WARNING, `Ieek an non implemented chunk type:${this._chunkType}`);
          break;
      }

      this._chunkData += this._chunkSize;
    }

    this._mainScreen.markPixelsDirty();
  }

  private color256(): void {
    if (!this._fileBuf) {
      return;
    }
    let pSrc = this._chunkData + 6;
    let numColorPackets = this.readU16(pSrc);
    let numColors = 0;
    pSrc += 2;

    while (numColorPackets-- > 0) {
      const numColorsSkip = this._fileBuf[pSrc++] + numColors;
      numColors = this._fileBuf[pSrc++];
      if (numColors === 0) {
        numColors = 256;
      }

      for (let i = 0; i < numColors; ++i) {
        this._colors[i] = {
          r: this._fileBuf[pSrc++],
          g: this._fileBuf[pSrc++],
          b: this._fileBuf[pSrc++],
          a: 255
        };
      }

      this._mainScreen?.setPalette(this._colors, numColorsSkip, numColors);
      this._realScreen?.setPalette(this._colors, numColorsSkip, numColors);

      if (numColorPackets >= 1) {
        ++numColors;
      }
    }
  }

  private fliSS2(): void {
    const target = this.mainScreenPixels();
    if (!target || !this._fileBuf) {
      return;
    }

    let pSrc = this._chunkData + 6;
    let pDst = this._offset;
    let lines = this.readU16(pSrc);
    pSrc += 2;

    while (lines-- > 0) {
      let count = this.readS16(pSrc);
      pSrc += 2;

      let setLastByte = false;
      let lastByte = 0;

      if ((count & MASK) === SKIP_LINES) {
        pDst += (-count) * target.pitch;
        ++lines;
        continue;
      } else if ((count & MASK) === LAST_PIXEL) {
        setLastByte = true;
        lastByte = count & 0x00FF;
        count = this.readS16(pSrc);
        pSrc += 2;
      }

      if ((count & MASK) === PACKETS_COUNT) {
        let pTmpDst = pDst;
        while (count-- > 0) {
          const columnSkip = this._fileBuf[pSrc++];
          pTmpDst += columnSkip;
          let countData = this.readS8(pSrc++);

          if (countData > 0) {
            target.pixels.set(this._fileBuf.subarray(pSrc, pSrc + 2 * countData), pTmpDst);
            pTmpDst += 2 * countData;
            pSrc += 2 * countData;
          } else if (countData < 0) {
            countData = -countData;
            const fill1 = this._fileBuf[pSrc++];
            const fill2 = this._fileBuf[pSrc++];
            while (countData-- > 0) {
              target.pixels[pTmpDst++] = fill1;
              target.pixels[pTmpDst++] = fill2;
            }
          }
        }

        if (setLastByte) {
          target.pixels[pDst + target.pitch - 1] = lastByte;
        }
        pDst += target.pitch;
      }
    }
  }

  private fliBRun(): void {
    const target = this.mainScreenPixels();
    if (!target || !this._fileBuf) {
      return;
    }

    let heightCount = this._headerHeight;
    let pSrc = this._chunkData + 6;
    let pDst = this._offset;

    while (heightCount-- > 0) {
      let pTmpDst = pDst;
      ++pSrc;

      let pixels = 0;
      while (pixels !== this._headerWidth) {
        let countData = this.readS8(pSrc++);
        if (countData > 0) {
          const fill = this._fileBuf[pSrc++];
          target.pixels.fill(fill, pTmpDst, pTmpDst + countData);
          pTmpDst += countData;
          pixels += countData;
        } else if (countData < 0) {
          countData = -countData;
          target.pixels.set(this._fileBuf.subarray(pSrc, pSrc + countData), pTmpDst);
          pTmpDst += countData;
          pSrc += countData;
          pixels += countData;
        } else {
          break;
        }
      }
      pDst += target.pitch;
    }
  }

  private fliLC(): void {
    const target = this.mainScreenPixels();
    if (!target || !this._fileBuf) {
      return;
    }

    let pSrc = this._chunkData + 6;
    let pDst = this._offset;
    const tmp = this.readU16(pSrc);
    pSrc += 2;
    pDst += tmp * target.pitch;
    let lines = this.readU16(pSrc);
    pSrc += 2;

    while (lines-- > 0) {
      let pTmpDst = pDst;
      let packetsCount = this._fileBuf[pSrc++];

      while (packetsCount-- > 0) {
        const countSkip = this._fileBuf[pSrc++];
        pTmpDst += countSkip;
        let countData = this.readS8(pSrc++);
        if (countData > 0) {
          while (countData-- > 0) {
            target.pixels[pTmpDst++] = this._fileBuf[pSrc++];
          }
        } else if (countData < 0) {
          countData = -countData;
          const fill = this._fileBuf[pSrc++];
          while (countData-- > 0) {
            target.pixels[pTmpDst++] = fill;
          }
        }
      }
      pDst += target.pitch;
    }
  }

  private color64(): void {
    if (!this._fileBuf) {
      return;
    }
    let pSrc = this._chunkData + 6;
    let numColorPackets = this.readU16(pSrc);
    pSrc += 2;

    while (numColorPackets-- > 0) {
      const numColorsSkip = this._fileBuf[pSrc++];
      let numColors = this._fileBuf[pSrc++];

      if (numColors === 0) {
        numColors = 256;
      }

      for (let i = 0; i < numColors; ++i) {
        this._colors[i] = {
          r: this._fileBuf[pSrc++] << 2,
          g: this._fileBuf[pSrc++] << 2,
          b: this._fileBuf[pSrc++] << 2,
          a: 255
        };
      }

      this._mainScreen?.setPalette(this._colors, numColorsSkip, numColors);
      this._realScreen?.setPalette(this._colors, numColorsSkip, numColors);
    }
  }

  private fliCopy(): void {
    const target = this.mainScreenPixels();
    if (!target || !this._fileBuf) {
      return;
    }

    let lines = this._screenHeight;
    let pSrc = this._chunkData + 6;
    let pDst = this._offset;

    while (lines-- > 0) {
      target.pixels.set(this._fileBuf.subarray(pSrc, pSrc + this._screenWidth), pDst);
      pSrc += this._screenWidth;
      pDst += target.pitch;
    }
  }

  private black(): void {
    const target = this.mainScreenPixels();
    if (!target) {
      return;
    }

    let lines = this._screenHeight;
    let pDst = this._offset;

    while (lines-- > 0) {
      target.pixels.fill(0, pDst, pDst + this._screenHeight);
      pDst += target.pitch;
    }
  }

  private playAudioFrame(sampleRate: number): void {
    if (this._useInternalAudio) {
      if (!this._hasAudio) {
        this._audioSampleRate = sampleRate;
        this._hasAudio = true;
        this.initAudio(1);
      } else if (sampleRate !== this._audioSampleRate) {
        Logger.log(LOG_WARNING, "Cannot change cutscene audio sample rate mid-video.");
      }

      const context = this.audioContext();
      if (!context || !this._fileBuf || this._audioFrameSize <= 0) {
        return;
      }

      const sampleCount = Math.min(this._audioFrameSize, Math.max(0, this._fileSize - this._chunkData));
      const buffer = context.createBuffer(1, sampleCount, sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < sampleCount; ++i) {
        data[i] = ((this._fileBuf[this._chunkData + i] - 128) * 240 * this._volume) / 32768;
      }

      const source = context.createBufferSource();
      source.buffer = buffer;
      source.connect(context.destination);
      const start = Math.max(context.currentTime, this._audioNextTime || context.currentTime);
      source.start(start);
      this._audioNextTime = start + sampleCount / sampleRate;
    } else {
      this._audioSampleRate = sampleRate;
    }
  }

  private initAudio(_channels: number): void {
    if (this._audioSampleRate > 0 && this._audioFrameSize > 0) {
      this._videoDelay = 1000 / (this._audioSampleRate / this._audioFrameSize);
    }
  }

  private deInitAudio(): void {
    this._hasAudio = false;
    this._audioNextTime = 0;
  }

  private isEndOfFile(pos: number): boolean {
    return pos >= this._fileSize;
  }

  private mainScreenPixels(): { pixels: Uint8Array; pitch: number } | null {
    if (!this._mainScreen) {
      return null;
    }
    return {
      pixels: this._mainScreen.getPixels(),
      pitch: this._mainScreen.getPitch()
    };
  }

  private audioContext(): AudioContext | null {
    if (Options.mute || typeof window === "undefined") {
      return null;
    }
    const nav = navigator as Navigator & { userActivation?: { hasBeenActive: boolean } };
    if (nav.userActivation && !nav.userActivation.hasBeenActive) {
      return null;
    }
    if (!this._audioContext) {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass) {
        return null;
      }
      this._audioContext = new AudioContextClass();
    }
    if (this._audioContext.state === "suspended") {
      void this._audioContext.resume().catch(() => undefined);
    }
    return this._audioContext;
  }

  private loadBinary(path: string): Uint8Array | null {
    const request = new XMLHttpRequest();
    const normalized = path.replaceAll("\\", "/");
    const url = normalized.startsWith("/") || normalized.includes("://") ? normalized : `../${normalized}`;
    request.open("GET", url, false);
    request.overrideMimeType("text/plain; charset=x-user-defined");
    try {
      request.send();
    } catch {
      Logger.log(LOG_ERROR, `Could not open FLI/FLC file: ${path}`);
      return null;
    }
    if (request.status !== 200 && request.status !== 0) {
      Logger.log(LOG_ERROR, `Could not open FLI/FLC file: ${path}`);
      return null;
    }
    const text = request.responseText;
    if (!text) {
      return null;
    }
    const bytes = new Uint8Array(text.length);
    for (let i = 0; i < text.length; ++i) {
      bytes[i] = text.charCodeAt(i) & 0xff;
    }
    return bytes;
  }
}
