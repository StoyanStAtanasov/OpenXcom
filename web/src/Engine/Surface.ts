import { Palette } from "./Palette.ts";
import { GraphSubset } from "./GraphSubset.ts";
import type { PaletteColor, Rect } from "../types.ts";

export class Surface {
  protected _x: number;
  protected _y: number;
  protected _visible = true;
  protected _hidden = false;
  protected _redraw = false;
  protected _tftdMode = false;
  protected _tooltip = "";
  protected _crop: Rect = { x: 0, y: 0, w: 0, h: 0 };
  protected _clear: Rect;
  protected _pixels: Uint8Array;
  protected _palette: PaletteColor[] = Palette.createDefault();
  protected _canvas: HTMLCanvasElement;
  protected _ctx: CanvasRenderingContext2D;
  private _pixelsDirty = true;

  constructor(width: number, height: number, x = 0, y = 0, protected _bpp = 8) {
    this._x = x;
    this._y = y;
    this._clear = { x: 0, y: 0, w: width, h: height };
    this._pixels = new Uint8Array(width * height);
    this._canvas = document.createElement("canvas");
    this._canvas.width = width;
    this._canvas.height = height;
    const ctx = this._canvas.getContext("2d");
    if (!ctx) {
      throw new Error("2D canvas context unavailable");
    }
    this._ctx = ctx;
    this._ctx.imageSmoothingEnabled = false;
  }

  loadRaw(bytes: Uint8Array | number[] | string): void {
    const source = typeof bytes === "string"
      ? Uint8Array.from(bytes, c => c.charCodeAt(0) & 0xff)
      : bytes;
    this.rawCopy(source);
  }

  loadScr(bytes: ArrayBuffer | Uint8Array | number[] | string): void {
    const source = bytes instanceof ArrayBuffer ? new Uint8Array(bytes) : bytes;
    this.loadRaw(source);
  }

  loadSpk(bytes: ArrayBuffer | Uint8Array): void {
    const source = bytes instanceof ArrayBuffer ? new Uint8Array(bytes) : bytes;
    const pos = { x: 0, y: 0 };
    for (let offset = 0; offset + 1 < source.length;) {
      const flag = source[offset] | (source[offset + 1] << 8);
      offset += 2;
      if (flag !== 65535 && flag !== 65534) {
        continue;
      }
      if (offset + 1 >= source.length) {
        break;
      }
      const count = (source[offset] | (source[offset + 1] << 8)) * 2;
      offset += 2;
      if (flag === 65535) {
        for (let i = 0; i < count; ++i) {
          this.setPixelIterative(pos, 0);
        }
      } else {
        for (let i = 0; i < count && offset < source.length; ++i, ++offset) {
          this.setPixelIterative(pos, source[offset]);
        }
      }
    }
    this.invalidatePixels();
  }

  loadBdy(bytes: ArrayBuffer | Uint8Array): void {
    const source = bytes instanceof ArrayBuffer ? new Uint8Array(bytes) : bytes;
    const pos = { x: 0, y: 0 };
    for (let offset = 0; offset < source.length;) {
      let dataByte = source[offset++];
      let pixelCount = 0;
      const currentRow = pos.y;
      if (dataByte >= 129) {
        pixelCount = 257 - dataByte;
        if (offset >= source.length) {
          break;
        }
        dataByte = source[offset++];
        for (let i = 0; i < pixelCount; ++i) {
          this.setPixelIterative(pos, dataByte);
          if (currentRow !== pos.y) {
            break;
          }
        }
      } else {
        pixelCount = 1 + dataByte;
        for (let i = 0; i < pixelCount && offset < source.length; ++i) {
          dataByte = source[offset++];
          if (currentRow === pos.y) {
            this.setPixelIterative(pos, dataByte);
          }
        }
      }
    }
    this.invalidatePixels();
  }

  async loadImage(filename: string): Promise<void> {
    const response = await fetch(`../${filename}`.replaceAll("\\", "/"));
    if (!response.ok) {
      throw new Error(`${filename}: ${response.status} ${response.statusText}`);
    }
    const bitmap = await createImageBitmap(await response.blob());
    this.resize(bitmap.width, bitmap.height);
    this._ctx.clearRect(0, 0, bitmap.width, bitmap.height);
    this._ctx.drawImage(bitmap, 0, 0);
    this.loadIndexedFromCanvas();
  }

  loadIndexedFromCanvas(forcedColor?: number): void {
    const image = this._ctx.getImageData(0, 0, this.getWidth(), this.getHeight());
    for (let i = 0, p = 0; i < this._pixels.length; ++i, p += 4) {
      const alpha = image.data[p + 3];
      if (alpha === 0) {
        this._pixels[i] = 0;
        continue;
      }
      if (forcedColor != null) {
        this._pixels[i] = forcedColor;
        continue;
      }
      const red = image.data[p];
      const green = image.data[p + 1];
      const blue = image.data[p + 2];
      if (red === green && green === blue) {
        const exact = Surface.exactFontPaletteIndex(red);
        if (exact !== 0) {
          this._pixels[i] = exact;
          continue;
        }
      }
      const brightness = (red + green + blue) / 3;
      this._pixels[i] = Math.max(1, Math.min(5, Math.ceil(brightness / 51)));
    }
    this.invalidatePixels();
  }

  private static exactFontPaletteIndex(value: number): number {
    switch (value) {
      case 63:
        return 1;
      case 111:
        return 2;
      case 159:
        return 3;
      case 207:
        return 4;
      case 255:
        return 5;
      default:
        return 0;
    }
  }

  protected rawCopy(src: ArrayLike<number>): void {
    const end = Math.min(this._pixels.length, src.length);
    for (let i = 0; i < end; ++i) {
      this._pixels[i] = src[i] & 0xff;
    }
    this.invalidatePixels();
  }

  clear(color = 0): void {
    this._pixels.fill(color & 0xff);
    this._ctx.clearRect(0, 0, this.getWidth(), this.getHeight());
    if (color !== 0) {
      this._ctx.fillStyle = Palette.css(this._palette, color);
      this._ctx.fillRect(0, 0, this.getWidth(), this.getHeight());
    }
    this._pixelsDirty = color !== 0;
  }

  offset(off: number, min = -1, max = -1, mul = 1): void {
    if (off === 0) {
      return;
    }
    for (let i = 0; i < this._pixels.length; ++i) {
      const pixel = this._pixels[i];
      let p = off > 0 ? pixel * mul + off : Math.trunc((pixel + off) / mul);
      if (min !== -1 && p < min) {
        p = min;
      } else if (max !== -1 && p > max) {
        p = max;
      }
      this._pixels[i] = pixel > 0 ? p & 0xff : 0;
    }
    this.invalidatePixels();
  }

  offsetBlock(off: number, blk = 16, mul = 1): void {
    if (off === 0) {
      return;
    }
    for (let i = 0; i < this._pixels.length; ++i) {
      const pixel = this._pixels[i];
      const min = Math.trunc(pixel / blk) * blk;
      const max = min + blk;
      let p = off > 0 ? pixel * mul + off : Math.trunc((pixel + off) / mul);
      if (p < min) {
        p = min;
      } else if (p > max) {
        p = max;
      }
      this._pixels[i] = pixel > 0 ? p & 0xff : 0;
    }
    this.invalidatePixels();
  }

  invert(mid: number): void {
    for (let i = 0; i < this._pixels.length; ++i) {
      const pixel = this._pixels[i];
      this._pixels[i] = pixel > 0 ? (pixel + 2 * (mid - pixel)) & 0xff : 0;
    }
    this.invalidatePixels();
  }

  think(): void {}

  draw(): void {
    this._redraw = false;
    this.clear();
  }

  blit(surface: Surface): void {
    if (!this._visible || this._hidden) {
      return;
    }
    if (this._redraw) {
      this.draw();
    }
    this.commitPixels();
    surface.drawSurface(this);
  }

  initText(..._args: unknown[]): void {}

  copy(surface: Surface): void {
    const fromX = this.getX() - surface.getX();
    const fromY = this.getY() - surface.getY();
    for (let y = 0; y < this.getHeight(); ++y) {
      for (let x = 0; x < this.getWidth(); ++x) {
        this.setPixel(x, y, surface.getPixel(fromX + x, fromY + y));
      }
    }
  }

  drawRect(rect: Rect, color: number): void;
  drawRect(x: number, y: number, w: number, h: number, color: number): void;
  drawRect(a: Rect | number, b: number, c?: number, d?: number, e?: number): void {
    const rect = typeof a === "number" ? { x: a, y: b, w: c || 0, h: d || 0 } : a;
    const color = typeof a === "number" ? e || 0 : b;
    if (rect.w === 0 || rect.h === 0) {
      return;
    }
    for (let y = rect.y; y < rect.y + rect.h; ++y) {
      for (let x = rect.x; x < rect.x + rect.w; ++x) {
        this.setPixel(x, y, color);
      }
    }
  }

  drawLine(x1: number, y1: number, x2: number, y2: number, color: number): void {
    const dx = Math.abs(x2 - x1);
    const sx = x1 < x2 ? 1 : -1;
    const dy = -Math.abs(y2 - y1);
    const sy = y1 < y2 ? 1 : -1;
    let err = dx + dy;
    while (true) {
      this.setPixel(x1, y1, color);
      if (x1 === x2 && y1 === y2) {
        break;
      }
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x1 += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y1 += sy;
      }
    }
  }

  drawCircle(cx: number, cy: number, r: number, color: number): void {
    for (let y = -r; y <= r; ++y) {
      for (let x = -r; x <= r; ++x) {
        if (x * x + y * y <= r * r) {
          this.setPixel(cx + x, cy + y, color);
        }
      }
    }
  }

  drawPolygon(x: number[], y: number[], n: number, color: number): void {
    const minY = Math.min(...y.slice(0, n));
    const maxY = Math.max(...y.slice(0, n));
    for (let py = minY; py <= maxY; ++py) {
      const nodes: number[] = [];
      for (let i = 0, j = n - 1; i < n; j = i++) {
        if ((y[i] < py && y[j] >= py) || (y[j] < py && y[i] >= py)) {
          nodes.push(Math.trunc(x[i] + ((py - y[i]) / (y[j] - y[i])) * (x[j] - x[i])));
        }
      }
      nodes.sort((a, b) => a - b);
      for (let i = 0; i < nodes.length; i += 2) {
        for (let px = nodes[i]; px < nodes[i + 1]; ++px) {
          this.setPixel(px, py, color);
        }
      }
    }
  }

  blitNShade(surface: Surface, x: number, y: number, shade: number, half?: boolean, newBaseColor?: number): void;
  blitNShade(surface: Surface, x: number, y: number, shade: number, range: GraphSubset): void;
  blitNShade(surface: Surface, x: number, y: number, shade: number, halfOrRange: boolean | GraphSubset = false, newBaseColor = 0): void {
    const range = halfOrRange instanceof GraphSubset ? halfOrRange : null;
    const half = typeof halfOrRange === "boolean" ? halfOrRange : false;
    const startX = half ? Math.trunc(this.getWidth() / 2) : 0;
    const destBaseX = x - surface.getX();
    const destBaseY = y - surface.getY();
    const replacementBase = newBaseColor ? (newBaseColor - 1) << 4 : 0;

    for (let sy = 0; sy < this.getHeight(); ++sy) {
      for (let sx = startX; sx < this.getWidth(); ++sx) {
        const absoluteDestX = x + sx;
        const absoluteDestY = y + sy;
        if (range && (absoluteDestX < range.beg_x || absoluteDestX >= range.end_x || absoluteDestY < range.beg_y || absoluteDestY >= range.end_y)) {
          continue;
        }
        const src = this.getPixel(sx, sy);
        if (!src) {
          continue;
        }
        const newShade = (src & 15) + shade;
        const pixel = newShade > 15
          ? 15
          : newBaseColor
            ? replacementBase | newShade
            : (src & (15 << 4)) | newShade;
        surface.setPixel(destBaseX + sx, destBaseY + sy, pixel);
      }
    }
  }

  setPalette(colors: PaletteColor[], firstcolor = 0, ncolors = colors.length): void {
    for (let i = 0; i < ncolors; ++i) {
      this._palette[firstcolor + i] = colors[i];
    }
    this.invalidatePixels();
  }

  getPalette(): PaletteColor[] {
    return this._palette;
  }

  setX(x: number): void {
    this._x = x;
  }

  getX(): number {
    return this._x;
  }

  setY(y: number): void {
    this._y = y;
  }

  getY(): number {
    return this._y;
  }

  setVisible(visible: boolean): void {
    this._visible = visible;
  }

  getVisible(): boolean {
    return this._visible;
  }

  resetCrop(): void {
    this._crop = { x: 0, y: 0, w: 0, h: 0 };
  }

  getCrop(): Rect {
    return this._crop;
  }

  setPixel(x: number, y: number, pixel: number): void {
    if (x < 0 || x >= this.getWidth() || y < 0 || y >= this.getHeight()) {
      return;
    }
    this._pixels[y * this.getWidth() + x] = pixel & 0xff;
    this._pixelsDirty = true;
  }

  setPixelIterative(pos: { x: number; y: number }, pixel: number): void {
    this.setPixel(pos.x, pos.y, pixel);
    pos.x++;
    if (pos.x === this.getWidth()) {
      pos.y++;
      pos.x = 0;
    }
  }

  getPixel(x: number, y: number): number {
    if (x < 0 || x >= this.getWidth() || y < 0 || y >= this.getHeight()) {
      return 0;
    }
    return this._pixels[y * this.getWidth() + x];
  }

  getCanvas(): HTMLCanvasElement {
    this.commitPixels();
    return this._canvas;
  }

  getContext(): CanvasRenderingContext2D {
    return this._ctx;
  }

  getWidth(): number {
    return this._canvas.width;
  }

  setWidth(width: number): void {
    this.resize(width, this.getHeight());
    this._redraw = true;
  }

  getHeight(): number {
    return this._canvas.height;
  }

  setHeight(height: number): void {
    this.resize(this.getWidth(), height);
    this._redraw = true;
  }

  setHidden(hidden: boolean): void {
    this._hidden = hidden;
  }

  lock(): void {}

  unlock(): void {}

  invalidate(valid = true): void {
    this._redraw = valid;
  }

  getTooltip(): string {
    return this._tooltip;
  }

  setTooltip(tooltip: string): void {
    this._tooltip = tooltip;
  }

  setColor(_color: number): void {}
  setSecondaryColor(_color: number): void {}
  setBorderColor(_color: number): void {}
  setHighContrast(_contrast: boolean): void {}

  setTFTDMode(mode: boolean): void {
    this._tftdMode = mode;
  }

  isTFTDMode(): boolean {
    return this._tftdMode;
  }

  drawSurface(source: Surface): void {
    this.commitPixels();
    const crop = source.getCrop();
    const sx = crop.w === 0 && crop.h === 0 ? 0 : crop.x;
    const sy = crop.w === 0 && crop.h === 0 ? 0 : crop.y;
    const sw = crop.w === 0 && crop.h === 0 ? source.getWidth() : crop.w;
    const sh = crop.w === 0 && crop.h === 0 ? source.getHeight() : crop.h;
    this._ctx.drawImage(source.getCanvas(), sx, sy, sw, sh, source.getX(), source.getY(), sw, sh);
  }

  blitPaletteShift(source: Surface, x: number, y: number, off: number, mul: number, mid: number): void {
    const crop = source.getCrop();
    const sx = crop.w === 0 && crop.h === 0 ? 0 : crop.x;
    const sy = crop.w === 0 && crop.h === 0 ? 0 : crop.y;
    const sw = crop.w === 0 && crop.h === 0 ? source.getWidth() : crop.w;
    const sh = crop.w === 0 && crop.h === 0 ? source.getHeight() : crop.h;
    for (let yy = 0; yy < sh; ++yy) {
      for (let xx = 0; xx < sw; ++xx) {
        const src = source.getPixel(sx + xx, sy + yy);
        if (src) {
          const inverseOffset = mid ? 2 * (mid - src) : 0;
          this.setPixel(x + xx, y + yy, off + src * mul + inverseOffset);
        }
      }
    }
  }

  protected resize(width: number, height: number): void {
    const oldPixels = this._pixels;
    const oldWidth = this.getWidth();
    const oldHeight = this.getHeight();
    this._canvas.width = width;
    this._canvas.height = height;
    this._ctx.imageSmoothingEnabled = false;
    this._pixels = new Uint8Array(width * height);
    for (let y = 0; y < Math.min(height, oldHeight); ++y) {
      for (let x = 0; x < Math.min(width, oldWidth); ++x) {
        this._pixels[y * width + x] = oldPixels[y * oldWidth + x];
      }
    }
    this._clear = { x: 0, y: 0, w: width, h: height };
    this.invalidatePixels();
  }

  protected commitPixels(): void {
    if (!this._pixelsDirty) {
      return;
    }
    const image = this._ctx.createImageData(this.getWidth(), this.getHeight());
    for (let i = 0, p = 0; i < this._pixels.length; ++i, p += 4) {
      const color = this._palette[this._pixels[i]] || this._palette[0];
      image.data[p] = color.r;
      image.data[p + 1] = color.g;
      image.data[p + 2] = color.b;
      image.data[p + 3] = color.a == null ? 255 : color.a;
    }
    this._ctx.putImageData(image, 0, 0);
    this._pixelsDirty = false;
  }

  protected invalidatePixels(): void {
    this._pixelsDirty = true;
  }
}
