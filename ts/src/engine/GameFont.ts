export interface Glyph {
  width: number;
  height: number;
  mask: Uint8Array;
}

export interface GameFont {
  readonly glyphHeight: number;
  readonly spacing: number;
  readonly glyphs: Map<string, Glyph>;
  readonly fallback: Glyph;
  readonly spaceAdvance: number;
}

const GEO_SMALL_CHARSET = "?-.0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const CELL_WIDTH = 5;
const CELL_HEIGHT = 7;
const SPACING = 1;
const EXTRA_GLYPHS: Record<string, string[]> = {
  ":": ["00000", "00100", "00100", "00000", "00100", "00100", "00000"],
  ",": ["00000", "00000", "00000", "00000", "00100", "00100", "01000"],
  "/": ["00001", "00010", "00100", "00100", "01000", "10000", "00000"],
  "(": ["00010", "00100", "01000", "01000", "01000", "00100", "00010"],
  ")": ["01000", "00100", "00010", "00010", "00010", "00100", "01000"],
  "+": ["00000", "00100", "00100", "11111", "00100", "00100", "00000"],
  "*": ["00000", "10001", "01010", "00100", "01010", "10001", "00000"],
  "_": ["00000", "00000", "00000", "00000", "00000", "00000", "11111"],
  "$": ["00100", "01111", "10100", "01110", "00101", "11110", "00100"],
  "'": ["00100", "00100", "00000", "00000", "00000", "00000", "00000"]
};

async function loadImage(path: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Failed to load ${path}`));
    image.src = path;
  });
}

function buildGlyph(data: Uint8ClampedArray, atlasWidth: number, x: number, y: number): Glyph {
  let left = CELL_WIDTH;
  let right = -1;

  for (let row = 0; row < CELL_HEIGHT; row += 1) {
    for (let col = 0; col < CELL_WIDTH; col += 1) {
      const px = x + col;
      const py = y + row;
      const i = (py * atlasWidth + px) * 4;
      const a = data[i + 3];
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      if (a > 0 && (r > 0 || g > 0 || b > 0)) {
        if (col < left) left = col;
        if (col > right) right = col;
      }
    }
  }

  if (right < left) {
    return { width: 2, height: CELL_HEIGHT, mask: new Uint8Array(2 * CELL_HEIGHT) };
  }

  const width = right - left + 1;
  const mask = new Uint8Array(width * CELL_HEIGHT);

  for (let row = 0; row < CELL_HEIGHT; row += 1) {
    for (let col = 0; col < width; col += 1) {
      const px = x + left + col;
      const py = y + row;
      const i = (py * atlasWidth + px) * 4;
      const a = data[i + 3];
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      if (a > 0 && (r > 0 || g > 0 || b > 0)) {
        mask[row * width + col] = 1;
      }
    }
  }

  return { width, height: CELL_HEIGHT, mask };
}

function glyphFromPattern(pattern: string[]): Glyph {
  const height = pattern.length;
  const width = pattern[0]?.length ?? 0;
  const mask = new Uint8Array(width * height);
  for (let row = 0; row < height; row += 1) {
    const line = pattern[row];
    for (let col = 0; col < width; col += 1) {
      mask[row * width + col] = line[col] === "1" ? 1 : 0;
    }
  }
  return { width, height, mask };
}

export async function loadSmallGameFont(): Promise<GameFont> {
  const image = await loadImage("/fonts/FontGeoSmall.png");
  const canvas = document.createElement("canvas");
  canvas.width = image.width;
  canvas.height = image.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Unable to create font canvas context");
  }

  ctx.drawImage(image, 0, 0);
  const { data } = ctx.getImageData(0, 0, image.width, image.height);
  const columns = Math.floor(image.width / CELL_WIDTH);

  const glyphs = new Map<string, Glyph>();
  for (let index = 0; index < GEO_SMALL_CHARSET.length; index += 1) {
    const char = GEO_SMALL_CHARSET[index];
    const startX = (index % columns) * CELL_WIDTH;
    const startY = Math.floor(index / columns) * CELL_HEIGHT;
    glyphs.set(char, buildGlyph(data, image.width, startX, startY));
  }
  for (const [char, pattern] of Object.entries(EXTRA_GLYPHS)) {
    glyphs.set(char, glyphFromPattern(pattern));
  }

  const fallback = glyphs.get("?");
  if (!fallback) {
    throw new Error("Font atlas missing fallback glyph");
  }

  return {
    glyphHeight: CELL_HEIGHT,
    spacing: SPACING,
    glyphs,
    fallback,
    spaceAdvance: 3
  };
}

export function glyphIndexForChar(char: string): string {
  if (char === " ") return " ";
  return char.toUpperCase();
}
