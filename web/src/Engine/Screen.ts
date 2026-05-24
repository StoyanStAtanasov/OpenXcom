import { Surface } from "./Surface.ts";
import { Options, SCALE_15X, SCALE_2X, SCALE_ORIGINAL, SCALE_SCREEN, SCALE_SCREEN_DIV_2, SCALE_SCREEN_DIV_3 } from "./Options.ts";
import type { PaletteColor } from "../types.ts";

export class Screen {
  static ORIGINAL_WIDTH = 320;
  static ORIGINAL_HEIGHT = 200;

  private _surface: Surface;
  private _scaleX = 1.0;
  private _scaleY = 1.0;
  private _topBlackBand = 0;
  private _bottomBlackBand = 0;
  private _leftBlackBand = 0;
  private _rightBlackBand = 0;
  private _cursorTopBlackBand = 0;
  private _cursorLeftBlackBand = 0;

  constructor(private canvas: HTMLCanvasElement) {
    this._surface = new Surface(Options.baseXResolution, Options.baseYResolution);
    this.resetDisplay();
  }

  getDX(): number {
    return Math.trunc((Options.baseXResolution - Screen.ORIGINAL_WIDTH) / 2);
  }

  getDY(): number {
    return Math.trunc((Options.baseYResolution - Screen.ORIGINAL_HEIGHT) / 2);
  }

  getSurface(): Surface {
    return this._surface;
  }

  handle(_action?: unknown): void {}

  flip(): void {
    const ctx = this.canvas.getContext("2d");
    if (!ctx) {
      return;
    }
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    const targetWidth = this.canvas.width - this._leftBlackBand - this._rightBlackBand;
    const targetHeight = this.canvas.height - this._topBlackBand - this._bottomBlackBand;
    ctx.drawImage(this._surface.getCanvas(), this._leftBlackBand, this._topBlackBand, targetWidth, targetHeight);
  }

  clear(): void {
    this._surface.clear();
  }

  setPalette(colors: PaletteColor[], firstcolor = 0, ncolors = 256): void {
    this._surface.setPalette(colors, firstcolor, ncolors);
  }

  getPalette(): PaletteColor[] {
    return this._surface.getPalette();
  }

  getWidth(): number {
    return this.canvas.width;
  }

  getHeight(): number {
    return this.canvas.height;
  }

  resetDisplay(): void {
    const width = Options.displayWidth;
    const height = Options.displayHeight;
    this.canvas.width = width;
    this.canvas.height = height;
    if (this._surface.getWidth() !== Options.baseXResolution || this._surface.getHeight() !== Options.baseYResolution) {
      this._surface = new Surface(Options.baseXResolution, Options.baseYResolution);
    }
    this._scaleX = width / Options.baseXResolution;
    this._scaleY = height / Options.baseYResolution;

    const pixelRatioY = Options.nonSquarePixelRatio && !Options.allowResize ? 1.2 : 1.0;
    const cursorInBlackBands = Options.fullscreen
      ? Options.cursorInBlackBandsInFullscreen
      : Options.borderless
        ? Options.cursorInBlackBandsInBorderlessWindow
        : Options.cursorInBlackBandsInWindow;

    if (this._scaleX > this._scaleY && Options.keepAspectRatio) {
      const targetWidth = Math.floor(this._scaleY * Options.baseXResolution);
      this._topBlackBand = this._bottomBlackBand = 0;
      this._leftBlackBand = Math.max(0, Math.trunc((width - targetWidth) / 2));
      this._rightBlackBand = width - targetWidth - this._leftBlackBand;
      this._cursorTopBlackBand = 0;
      if (cursorInBlackBands) {
        this._scaleX = this._scaleY;
        this._cursorLeftBlackBand = this._leftBlackBand;
      } else {
        this._cursorLeftBlackBand = 0;
      }
    } else if (this._scaleY > this._scaleX && Options.keepAspectRatio) {
      const targetHeight = Math.floor(this._scaleX * Options.baseYResolution * pixelRatioY);
      this._topBlackBand = Math.max(0, Math.trunc((height - targetHeight) / 2));
      this._bottomBlackBand = Math.max(0, height - targetHeight - this._topBlackBand);
      this._leftBlackBand = this._rightBlackBand = 0;
      this._cursorLeftBlackBand = 0;
      if (cursorInBlackBands) {
        this._scaleY = this._scaleX;
        this._cursorTopBlackBand = this._topBlackBand;
      } else {
        this._cursorTopBlackBand = 0;
      }
    } else {
      this._topBlackBand = this._bottomBlackBand = this._leftBlackBand = this._rightBlackBand = 0;
      this._cursorTopBlackBand = this._cursorLeftBlackBand = 0;
    }
  }

  getXScale(): number {
    return this._scaleX;
  }

  getYScale(): number {
    return this._scaleY;
  }

  getCursorTopBlackBand(): number {
    return this._cursorTopBlackBand;
  }

  getCursorLeftBlackBand(): number {
    return this._cursorLeftBlackBand;
  }

  static use32bitScaler(): boolean {
    return false;
  }

  static useOpenGL(): boolean {
    return false;
  }

  static updateScale(type: number, widthRef: { value: number }, heightRef: { value: number }, change: boolean): void {
    let width: number;
    let height: number;
    const pixelRatioY = Options.nonSquarePixelRatio ? 1.2 : 1.0;
    switch (type) {
      case SCALE_15X:
        width = Screen.ORIGINAL_WIDTH * 1.5;
        height = Screen.ORIGINAL_HEIGHT * 1.5;
        break;
      case SCALE_2X:
        width = Screen.ORIGINAL_WIDTH * 2;
        height = Screen.ORIGINAL_HEIGHT * 2;
        break;
      case SCALE_SCREEN_DIV_3:
        width = Options.displayWidth / 3.0;
        height = Options.displayHeight / pixelRatioY / 3.0;
        break;
      case SCALE_SCREEN_DIV_2:
        width = Options.displayWidth / 2.0;
        height = Options.displayHeight / pixelRatioY / 2.0;
        break;
      case SCALE_SCREEN:
        width = Options.displayWidth;
        height = Options.displayHeight / pixelRatioY;
        break;
      case SCALE_ORIGINAL:
      default:
        width = Screen.ORIGINAL_WIDTH;
        height = Screen.ORIGINAL_HEIGHT;
        break;
    }
    widthRef.value = Math.max(Screen.ORIGINAL_WIDTH, Math.trunc(width));
    heightRef.value = Math.max(Screen.ORIGINAL_HEIGHT, Math.trunc(height));
    if (change && (Options.baseXResolution !== widthRef.value || Options.baseYResolution !== heightRef.value)) {
      Options.baseXResolution = widthRef.value;
      Options.baseYResolution = heightRef.value;
    }
  }
}
