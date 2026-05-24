import type { PaletteColor } from "../types.ts";

export class Palette {
  static backPos = 224;

  static palOffset(palette: number): number {
    return palette * (768 + 6);
  }

  static loadDat(buffer: ArrayBuffer, ncolors: number, offset = 0): PaletteColor[] {
    const bytes = new Uint8Array(buffer);
    const colors: PaletteColor[] = [];
    for (let i = 0; i < ncolors; ++i) {
      const pos = offset + i * 3;
      if (pos + 2 >= bytes.length) {
        colors.push({ r: 0, g: 0, b: 0, a: i === 0 ? 0 : 255 });
        continue;
      }
      colors.push({
        r: bytes[pos] * 4,
        g: bytes[pos + 1] * 4,
        b: bytes[pos + 2] * 4,
        a: i === 0 ? 0 : 255
      });
    }
    if (colors.length > 0) {
      colors[0].a = 0;
    }
    return colors;
  }

  static clone(colors: PaletteColor[]): PaletteColor[] {
    return colors.map(color => ({ ...color }));
  }

  static createDefault(): PaletteColor[] {
    const colors: PaletteColor[] = [];
    const ramps: Array<[number, number, number]> = [
      [58, 36, 22],
      [88, 20, 38],
      [118, 42, 12],
      [106, 36, 94],
      [18, 88, 76],
      [120, 24, 24],
      [92, 58, 22],
      [46, 40, 108],
      [42, 166, 88],
      [44, 96, 170],
      [142, 72, 174],
      [160, 70, 84],
      [72, 72, 72],
      [210, 178, 74],
      [40, 200, 64],
      [220, 220, 220]
    ];
    for (let i = 0; i < 256; ++i) {
      const block = Math.floor(i / 16);
      const shade = i & 15;
      const t = shade / 15;
      const base = ramps[block] || [128, 128, 128];
      const lift = block === 8
        ? [255, 232, 120]
        : block === 14
          ? [190, 255, 120]
          : [255, 255, 255];
      colors.push({
        r: Math.round(base[0] * (1 - t) + lift[0] * t),
        g: Math.round(base[1] * (1 - t) + lift[1] * t),
        b: Math.round(base[2] * (1 - t) + lift[2] * t),
        a: i === 0 ? 0 : 255
      });
    }
    colors[0] = { r: 0, g: 0, b: 0, a: 0 };
    colors[1] = { r: 24, g: 84, b: 40, a: 255 };
    colors[2] = { r: 42, g: 132, b: 62, a: 255 };
    colors[3] = { r: 80, g: 196, b: 96, a: 255 };
    colors[4] = { r: 151, g: 240, b: 124, a: 255 };
    colors[5] = { r: 232, g: 255, b: 194, a: 255 };
    return colors;
  }

  static createDefaultBackPals(): PaletteColor[] {
    const colors: PaletteColor[] = [];
    const tints: Array<[number, number, number]> = [
      [46, 28, 18],
      [58, 14, 26],
      [72, 24, 8],
      [65, 24, 58],
      [12, 56, 48],
      [70, 16, 16],
      [54, 34, 12],
      [28, 24, 66]
    ];
    for (const tint of tints) {
      for (let shade = 0; shade < 16; ++shade) {
        colors.push({
          r: Math.min(255, tint[0] + shade * 7),
          g: Math.min(255, tint[1] + shade * 7),
          b: Math.min(255, tint[2] + shade * 7),
          a: 255
        });
      }
    }
    return colors;
  }

  static terminal(): PaletteColor[] {
    const colors = Palette.createDefault();
    colors[0] = { r: 0, g: 0, b: 0, a: 0 };
    colors[1] = { r: 185, g: 185, b: 185, a: 255 };
    return colors;
  }

  static blockOffset(block: number): number {
    return block * 16;
  }

  static css(colors: PaletteColor[], index: number, fallback = "#ffffff"): string {
    const color = colors[index];
    if (!color) {
      return fallback;
    }
    const a = color.a == null ? 255 : color.a;
    return `rgba(${color.r}, ${color.g}, ${color.b}, ${a / 255})`;
  }
}
