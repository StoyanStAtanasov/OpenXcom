import { Surface } from "./Surface.ts";
import { Palette } from "./Palette.ts";
import type { PaletteColor, Rect } from "../types.ts";
import { convUtf8ToUtf32, isPrintable, TOK_NBSP, type UCode, type UString } from "./Unicode.ts";

export type FontImage = {
  width: number;
  height: number;
  spacing: number;
  surface: Surface;
};

export type FontImageDefinition = {
  file: string;
  width?: number;
  height?: number;
  spacing?: number;
  chars: string;
};

export type FontDefinition = {
  id: string;
  width: number;
  height: number;
  spacing: number;
  monospace?: boolean;
  images: FontImageDefinition[];
};

type CharRef = { index: number; rect: Rect };

export class Font {
  private _images: FontImage[] = [];
  private _chars = new Map<UCode, CharRef>();
  private _monospace = false;

  async load(definition: FontDefinition, basePath: string): Promise<void> {
    this._monospace = definition.monospace ?? this._monospace;
    for (const entry of definition.images) {
      const image: FontImage = {
        width: entry.width ?? definition.width,
        height: entry.height ?? definition.height,
        spacing: entry.spacing ?? definition.spacing,
        surface: new Surface(entry.width ?? definition.width, entry.height ?? definition.height)
      };
      await image.surface.loadImage(`${basePath}/${entry.file}`);
      this._images.push(image);
      this.init(this._images.length - 1, convUtf8ToUtf32(entry.chars));
    }
  }

  loadTerminal(): void {
    const image: FontImage = {
      width: 9,
      height: 16,
      spacing: 0,
      surface: new Surface(9 * 32, 16 * 3)
    };
    this._monospace = true;
    image.surface.setPalette([{ r: 0, g: 0, b: 0, a: 0 }, { r: 185, g: 185, b: 185, a: 255 }], 0, 2);
    const chars = " !\"#$%&'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~";

    const dosFont = this.loadDosFontHeader();
    if (!dosFont || !this.loadMonochromeBmp(image.surface, dosFont)) {
      const ctx = image.surface.getContext();
      ctx.clearRect(0, 0, image.surface.getWidth(), image.surface.getHeight());
      ctx.font = "16px 'Lucida Console', Consolas, monospace";
      ctx.textBaseline = "top";
      ctx.fillStyle = "#ffffff";
      for (let i = 0; i < chars.length; ++i) {
        const x = (i % 32) * image.width;
        const y = Math.floor(i / 32) * image.height;
        ctx.fillText(chars[i], x, y);
      }
      image.surface.loadIndexedFromCanvas(1);
    }
    this._images.push(image);
    this.init(this._images.length - 1, convUtf8ToUtf32(chars));
  }

  getChar(c: UCode): Surface {
    if (!this._chars.has(c)) {
      c = "?".codePointAt(0)!;
    }
    const ref = this._chars.get(c);
    if (!ref) {
      return this._images[0].surface;
    }
    const surface = this._images[ref.index].surface;
    const crop = surface.getCrop();
    crop.x = ref.rect.x;
    crop.y = ref.rect.y;
    crop.w = ref.rect.w;
    crop.h = ref.rect.h;
    return surface;
  }

  getWidth(): number {
    return this._images[0]?.width ?? 0;
  }

  getHeight(): number {
    return this._images[0]?.height ?? 0;
  }

  getSpacing(): number {
    return this._images[0]?.spacing ?? 0;
  }

  getCharSize(c: UCode): Rect {
    const size = { x: 0, y: 0, w: 0, h: 0 };
    if (isPrintable(c)) {
      if (!this._chars.has(c)) {
        c = "?".codePointAt(0)!;
      }
      const ref = this._chars.get(c);
      if (!ref) {
        return size;
      }
      const image = this._images[ref.index];
      size.w = ref.rect.w + image.spacing;
      size.h = ref.rect.h + image.spacing;
    } else {
      if (this._monospace) {
        size.w = this.getWidth() + this.getSpacing();
      } else if (c === TOK_NBSP) {
        size.w = Math.trunc(this.getWidth() / 4);
      } else if (c === "\t".codePointAt(0)) {
        size.w = Math.trunc(this.getWidth() * 3 / 4);
      } else {
        size.w = Math.trunc(this.getWidth() / 2);
      }
      size.h = this.getHeight() + this.getSpacing();
    }
    size.x = size.w;
    size.y = size.h;
    return size;
  }

  getPalette(): PaletteColor[] {
    return this._images[0]?.surface.getPalette() ?? Palette.createDefault();
  }

  setPalette(colors: PaletteColor[], firstcolor: number, ncolors: number): void {
    for (const image of this._images) {
      image.surface.setPalette(colors, firstcolor, ncolors);
    }
  }

  private init(index: number, str: UString): void {
    const image = this._images[index];
    const surface = image.surface;
    const length = Math.trunc(surface.getWidth() / image.width);
    if (this._monospace) {
      for (let i = 0; i < str.length; ++i) {
        const startX = (i % length) * image.width;
        const startY = Math.floor(i / length) * image.height;
        this._chars.set(str[i], { index, rect: { x: startX, y: startY, w: image.width, h: image.height } });
      }
      return;
    }
    for (let i = 0; i < str.length; ++i) {
      let left = -1;
      let right = -1;
      const startX = (i % length) * image.width;
      const startY = Math.floor(i / length) * image.height;
      for (let x = startX; x < startX + image.width; ++x) {
        for (let y = startY; y < startY + image.height && left === -1; ++y) {
          if (surface.getPixel(x, y) !== 0) {
            left = x;
          }
        }
      }
      for (let x = startX + image.width - 1; x >= startX; --x) {
        for (let y = startY + image.height - 1; y >= startY && right === -1; --y) {
          if (surface.getPixel(x, y) !== 0) {
            right = x;
          }
        }
      }
      if (left === -1 || right === -1) {
        left = startX;
        right = startX;
      }
      this._chars.set(str[i], { index, rect: { x: left, y: startY, w: right - left + 1, h: image.height } });
    }
  }

  private loadDosFontHeader(): Uint8Array | null {
    if (typeof XMLHttpRequest === "undefined") {
      return null;
    }
    for (const path of ["/src/Engine/DosFont.h", "../src/Engine/DosFont.h"]) {
      const request = new XMLHttpRequest();
      request.open("GET", path, false);
      request.overrideMimeType("text/plain; charset=x-user-defined");
      try {
        request.send();
      } catch {
        continue;
      }
      if (request.status !== 200 && request.status !== 0) {
        continue;
      }
      const values: number[] = [];
      for (const match of request.responseText.matchAll(/0x([0-9a-fA-F]{2})/g)) {
        values.push(Number.parseInt(match[1], 16));
      }
      if (values.length > 0) {
        return Uint8Array.from(values);
      }
    }
    return null;
  }

  private loadMonochromeBmp(surface: Surface, bytes: Uint8Array): boolean {
    if (bytes.length < 62 || bytes[0] !== 0x42 || bytes[1] !== 0x4d) {
      return false;
    }
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const dataOffset = view.getUint32(10, true);
    const width = view.getInt32(18, true);
    const height = Math.abs(view.getInt32(22, true));
    const bitsPerPixel = view.getUint16(28, true);
    if (width <= 0 || height <= 0 || bitsPerPixel !== 1) {
      return false;
    }
    surface.setWidth(width);
    surface.setHeight(height);
    const rowStride = Math.trunc((width * bitsPerPixel + 31) / 32) * 4;
    const bottomUp = view.getInt32(22, true) > 0;
    for (let y = 0; y < height; ++y) {
      const sourceY = bottomUp ? height - 1 - y : y;
      const row = dataOffset + sourceY * rowStride;
      for (let x = 0; x < width; ++x) {
        const value = bytes[row + Math.trunc(x / 8)] || 0;
        surface.setPixel(x, y, (value & (0x80 >> (x % 8))) ? 1 : 0);
      }
    }
    return true;
  }
}

export function parseFontDat(source: string): FontDefinition[] {
  const fonts: FontDefinition[] = [];
  let font: FontDefinition | null = null;
  let image: FontImageDefinition | null = null;
  let readingChars = false;
  let charsIndent = 0;
  let chars: string[] = [];

  const finishChars = () => {
    if (readingChars && image) {
      image.chars = chars.join("");
    }
    readingChars = false;
    chars = [];
  };

  for (const raw of source.split(/\r?\n/)) {
    const indent = raw.search(/\S|$/);
    const trimmed = raw.trim();
    if (readingChars) {
      if (trimmed === "" || indent > charsIndent) {
        chars.push(trimmed);
        continue;
      }
      finishChars();
    }
    if (trimmed === "" || trimmed === "fonts:") {
      continue;
    }
    const fontStart = /^-\s+id:\s*(\S+)/.exec(trimmed);
    if (indent === 2 && fontStart) {
      font = { id: fontStart[1], width: 0, height: 0, spacing: 0, images: [] };
      fonts.push(font);
      image = null;
      continue;
    }
    if (!font) {
      continue;
    }
    const imageStart = /^-\s+file:\s*(.+)$/.exec(trimmed);
    if (indent === 6 && imageStart) {
      image = { file: imageStart[1], chars: "" };
      font.images.push(image);
      continue;
    }
    const prop = /^([A-Za-z]+):\s*(.*)$/.exec(trimmed);
    if (!prop) {
      continue;
    }
    const key = prop[1];
    const value = prop[2];
    if (key === "chars" && image) {
      readingChars = true;
      charsIndent = indent;
      chars = [];
      continue;
    }
    const target = image && indent >= 8 ? image as Record<string, unknown> : font as unknown as Record<string, unknown>;
    if (key === "width" || key === "height" || key === "spacing") {
      target[key] = Number(value);
    } else if (key === "monospace") {
      target[key] = value === "true";
    } else if (key === "file" && image) {
      image.file = value;
    }
  }
  finishChars();
  return fonts;
}
