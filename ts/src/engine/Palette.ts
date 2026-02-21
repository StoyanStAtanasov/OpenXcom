export interface PaletteColor {
  readonly r: number;
  readonly g: number;
  readonly b: number;
}

export interface PaletteTint {
  readonly r: number;
  readonly g: number;
  readonly b: number;
  readonly strength64?: number;
}

const DEFAULT_COLOR: PaletteColor = { r: 240, g: 240, b: 240 };

function clampByte(value: number): number {
  return Math.max(0, Math.min(255, Math.floor(value)));
}

export class Palette {
  private readonly entries: PaletteColor[];
  private readonly cssCache = new Map<number, string>();
  private readonly nearestCache = new Map<string, number>();

  constructor(entries: PaletteColor[]) {
    if (entries.length === 0) {
      throw new Error("Palette requires at least one color");
    }
    this.entries = entries.map((entry) => ({
      r: clampByte(entry.r),
      g: clampByte(entry.g),
      b: clampByte(entry.b)
    }));
  }

  static fromHexColors(hexColors: readonly string[]): Palette {
    const parsed = hexColors.map((hex) => Palette.parseCssColor(hex));
    return new Palette(parsed);
  }

  static parseCssColor(value: string): PaletteColor {
    const raw = value.trim();
    if (raw.startsWith("#")) {
      const hex = raw.slice(1);
      if (hex.length === 3) {
        return {
          r: parseInt(hex[0] + hex[0], 16),
          g: parseInt(hex[1] + hex[1], 16),
          b: parseInt(hex[2] + hex[2], 16)
        };
      }
      if (hex.length === 6) {
        return {
          r: parseInt(hex.slice(0, 2), 16),
          g: parseInt(hex.slice(2, 4), 16),
          b: parseInt(hex.slice(4, 6), 16)
        };
      }
    }
    return DEFAULT_COLOR;
  }

  static defaultUiPalette(): Palette {
    return Palette.fromHexColors([
      "#000000",
      "#06101d",
      "#102846",
      "#0e2238",
      "#74a0c8",
      "#9fd8ff",
      "#f4f7fb",
      "#9cb3c9",
      "#8dd19a",
      "#d1a28d",
      "#a6bfd5",
      "#7d93a8",
      "#f2f2f2"
    ]);
  }

  static palOffset(palette: number): number {
    return Math.max(0, Math.floor(palette)) * (768 + 6);
  }

  static async fromDatUrl(url: string, ncolors = 256, palette = 0): Promise<Palette> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to load palette data from ${url}`);
    }
    const bytes = new Uint8Array(await response.arrayBuffer());
    const offset = Palette.palOffset(palette);
    const needed = offset + ncolors * 3;
    if (bytes.length < needed) {
      throw new Error(`Palette file too short: expected at least ${needed} bytes`);
    }

    const entries: PaletteColor[] = [];
    for (let i = 0; i < ncolors; i += 1) {
      const j = offset + i * 3;
      entries.push({
        r: clampByte(bytes[j] * 4),
        g: clampByte(bytes[j + 1] * 4),
        b: clampByte(bytes[j + 2] * 4)
      });
    }
    return new Palette(entries);
  }

  size(): number {
    return this.entries.length;
  }

  getColor(index: number): PaletteColor {
    return this.entries[index] ?? DEFAULT_COLOR;
  }

  getCss(index: number): string {
    const cached = this.cssCache.get(index);
    if (cached) {
      return cached;
    }
    const color = this.getColor(index);
    const css = `rgb(${color.r}, ${color.g}, ${color.b})`;
    this.cssCache.set(index, css);
    return css;
  }

  findClosestIndex(color: PaletteColor): number {
    const key = `${color.r},${color.g},${color.b}`;
    const cached = this.nearestCache.get(key);
    if (cached !== undefined) {
      return cached;
    }

    let bestIndex = 0;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (let i = 0; i < this.entries.length; i += 1) {
      const entry = this.entries[i];
      const dr = entry.r - color.r;
      const dg = entry.g - color.g;
      const db = entry.b - color.b;
      const distance = dr * dr + dg * dg + db * db;
      if (distance < bestDistance) {
        bestDistance = distance;
        bestIndex = i;
      }
    }

    this.nearestCache.set(key, bestIndex);
    return bestIndex;
  }

  buildTransparencyLuts(tints: readonly PaletteTint[], opacityMax = 4): Uint8Array[] {
    const luts: Uint8Array[] = [];
    const safeOpacityMax = Math.max(1, Math.floor(opacityMax));

    for (const tint of tints) {
      const tintStrength = clampByte(tint.strength64 ?? 16);
      for (let opacity = 1; opacity <= safeOpacityMax; opacity += 1) {
        const op = Math.max(0, Math.min(64, opacity * tintStrength));
        const colorBlend = 1 - (op / 64) * (op / 64);
        const tintBlend = op;
        const lut = new Uint8Array(256);

        for (let i = 0; i < 256; i += 1) {
          if (i === 0 || op === 0) {
            lut[i] = i;
            continue;
          }
          const base = this.getColor(i);
          const desired: PaletteColor = {
            r: clampByte(base.r * colorBlend + tint.r * tintBlend),
            g: clampByte(base.g * colorBlend + tint.g * tintBlend),
            b: clampByte(base.b * colorBlend + tint.b * tintBlend)
          };
          lut[i] = this.findClosestIndex(desired);
        }

        luts.push(lut);
      }
    }

    return luts;
  }
}
