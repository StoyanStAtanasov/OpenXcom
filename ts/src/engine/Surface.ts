import type { Palette } from "./Palette";

export class Surface {
  readonly width: number;
  readonly height: number;
  private readonly pixels: Uint8Array;

  constructor(width: number, height: number, fillIndex = 0) {
    if (width <= 0 || height <= 0) {
      throw new Error("Surface dimensions must be positive");
    }
    this.width = width;
    this.height = height;
    this.pixels = new Uint8Array(width * height);
    this.clear(fillIndex);
  }

  clear(index: number): void {
    this.pixels.fill(index & 0xff);
  }

  setPixel(x: number, y: number, index: number): void {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return;
    this.pixels[y * this.width + x] = index & 0xff;
  }

  getPixel(x: number, y: number): number {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return 0;
    return this.pixels[y * this.width + x];
  }

  fillRect(x: number, y: number, width: number, height: number, index: number): void {
    const startX = Math.max(0, Math.floor(x));
    const startY = Math.max(0, Math.floor(y));
    const endX = Math.min(this.width, Math.ceil(x + width));
    const endY = Math.min(this.height, Math.ceil(y + height));
    for (let py = startY; py < endY; py += 1) {
      const rowOffset = py * this.width;
      for (let px = startX; px < endX; px += 1) {
        this.pixels[rowOffset + px] = index & 0xff;
      }
    }
  }

  strokeRect(x: number, y: number, width: number, height: number, index: number): void {
    const startX = Math.floor(x);
    const startY = Math.floor(y);
    const endX = Math.floor(x + width - 1);
    const endY = Math.floor(y + height - 1);
    if (endX < startX || endY < startY) return;

    for (let px = startX; px <= endX; px += 1) {
      this.setPixel(px, startY, index);
      this.setPixel(px, endY, index);
    }
    for (let py = startY + 1; py < endY; py += 1) {
      this.setPixel(startX, py, index);
      this.setPixel(endX, py, index);
    }
  }

  blitFrom(source: Surface, dstX: number, dstY: number, transparentIndex = 0): void {
    const startX = Math.max(0, Math.floor(dstX));
    const startY = Math.max(0, Math.floor(dstY));
    const endX = Math.min(this.width, Math.floor(dstX + source.width));
    const endY = Math.min(this.height, Math.floor(dstY + source.height));
    if (endX <= startX || endY <= startY) {
      return;
    }

    for (let y = startY; y < endY; y += 1) {
      const srcY = y - Math.floor(dstY);
      for (let x = startX; x < endX; x += 1) {
        const srcX = x - Math.floor(dstX);
        const color = source.getPixel(srcX, srcY);
        if (color === (transparentIndex & 0xff)) {
          continue;
        }
        this.setPixel(x, y, color);
      }
    }
  }

  blitFromWithLut(source: Surface, dstX: number, dstY: number, lut: Uint8Array, transparentIndex = 0): void {
    const startX = Math.max(0, Math.floor(dstX));
    const startY = Math.max(0, Math.floor(dstY));
    const endX = Math.min(this.width, Math.floor(dstX + source.width));
    const endY = Math.min(this.height, Math.floor(dstY + source.height));
    if (endX <= startX || endY <= startY) {
      return;
    }

    for (let y = startY; y < endY; y += 1) {
      const srcY = y - Math.floor(dstY);
      for (let x = startX; x < endX; x += 1) {
        const srcX = x - Math.floor(dstX);
        const color = source.getPixel(srcX, srcY);
        if (color === (transparentIndex & 0xff)) {
          continue;
        }
        this.setPixel(x, y, lut[color] ?? color);
      }
    }
  }

  toImageData(palette: Palette): ImageData {
    const imageData = new ImageData(this.width, this.height);
    this.blitToImageData(palette, imageData);
    return imageData;
  }

  blitToImageData(palette: Palette, imageData: ImageData): void {
    if (imageData.width !== this.width || imageData.height !== this.height) {
      throw new Error("ImageData dimensions must match surface dimensions");
    }
    const out = imageData.data;
    for (let i = 0; i < this.pixels.length; i += 1) {
      const color = palette.getColor(this.pixels[i]);
      const j = i * 4;
      out[j] = color.r;
      out[j + 1] = color.g;
      out[j + 2] = color.b;
      out[j + 3] = this.pixels[i] === 0 ? 0 : 255;
    }
  }
}
