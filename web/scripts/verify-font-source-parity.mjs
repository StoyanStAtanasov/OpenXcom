import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { mkdir, rm, writeFile } from "node:fs/promises";
import http from "node:http";
import { dirname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import zlib from "node:zlib";

const webRoot = normalize(join(dirname(fileURLToPath(import.meta.url)), ".."));
const repoRoot = normalize(join(webRoot, ".."));
const outputRoot = join(repoRoot, "output", "font-parity");
const verifierRoot = join(repoRoot, "output", "playwright");
const verifierPath = join(verifierRoot, "verify-font-source-parity.js");
const session = "openxcom-font-source-parity";
const url = "http://127.0.0.1:4173/web/index.html";
const sampleText = "NEW GAME";
const sampleColor = 133;
const fontPath = join(repoRoot, "bin", "common", "Language", "FontSmall.png");
const fontDatPath = join(repoRoot, "bin", "common", "Language", "Font.dat");

function line(message) {
  console.log(message);
}

function run(label, command, args, cwd = webRoot) {
  line("- " + label);
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", chunk => { stdout += chunk; });
    child.stderr.on("data", chunk => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", code => {
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        process.stdout.write(stdout);
        process.stderr.write(stderr);
        reject(new Error(label + " failed with status " + code));
      }
    });
  });
}

function runNpm(label, args, cwd = webRoot) {
  if (process.platform === "win32") {
    return run(label, "cmd.exe", ["/d", "/s", "/c", "npm.cmd", ...args], cwd);
  }
  return run(label, "npm", args, cwd);
}

function serverReady() {
  return new Promise(resolve => {
    const req = http.get(url, res => {
      res.resume();
      resolve(res.statusCode === 200);
    });
    req.setTimeout(1000, () => {
      req.destroy();
      resolve(false);
    });
    req.on("error", () => resolve(false));
  });
}

async function waitForServer() {
  for (let i = 0; i < 40; ++i) {
    if (await serverReady()) {
      return;
    }
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error("Local web server did not become ready");
}

function parseIndexedPng(path) {
  const bytes = readFileSync(path);
  if (bytes.toString("ascii", 1, 4) !== "PNG") {
    throw new Error(path + " is not a PNG");
  }

  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  const palette = [];
  const transparency = [];
  const idats = [];

  while (offset < bytes.length) {
    const length = bytes.readUInt32BE(offset);
    offset += 4;
    const type = bytes.toString("ascii", offset, offset + 4);
    offset += 4;
    const data = bytes.subarray(offset, offset + length);
    offset += length + 4;

    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
    } else if (type === "PLTE") {
      for (let i = 0; i < data.length; i += 3) {
        palette.push({ r: data[i], g: data[i + 1], b: data[i + 2], a: 255 });
      }
    } else if (type === "tRNS") {
      for (let i = 0; i < data.length; ++i) {
        transparency[i] = data[i];
      }
    } else if (type === "IDAT") {
      idats.push(data);
    }
  }

  if (bitDepth !== 8 || colorType !== 3) {
    throw new Error(`Unsupported PNG format for source-index parity: bitDepth=${bitDepth}, colorType=${colorType}`);
  }

  for (let i = 0; i < transparency.length; ++i) {
    if (palette[i]) {
      palette[i].a = transparency[i];
    }
  }

  const raw = zlib.inflateSync(Buffer.concat(idats));
  const rowBytes = width;
  const pixels = new Uint8Array(width * height);
  let p = 0;
  let previous = Buffer.alloc(rowBytes);
  for (let y = 0; y < height; ++y) {
    const filter = raw[p++];
    const row = Buffer.from(raw.subarray(p, p + rowBytes));
    p += rowBytes;
    for (let x = 0; x < rowBytes; ++x) {
      const left = x > 0 ? row[x - 1] : 0;
      const up = previous[x] || 0;
      const upperLeft = x > 0 ? previous[x - 1] : 0;
      if (filter === 1) {
        row[x] = (row[x] + left) & 0xff;
      } else if (filter === 2) {
        row[x] = (row[x] + up) & 0xff;
      } else if (filter === 3) {
        row[x] = (row[x] + Math.floor((left + up) / 2)) & 0xff;
      } else if (filter === 4) {
        const paeth = left + up - upperLeft;
        const pa = Math.abs(paeth - left);
        const pb = Math.abs(paeth - up);
        const pc = Math.abs(paeth - upperLeft);
        const predictor = pa <= pb && pa <= pc ? left : pb <= pc ? up : upperLeft;
        row[x] = (row[x] + predictor) & 0xff;
      } else if (filter !== 0) {
        throw new Error("Unsupported PNG filter " + filter);
      }
    }
    pixels.set(row.subarray(0, width), y * width);
    previous = row;
  }

  return { width, height, palette, pixels };
}

function readSmallFontAsciiChars() {
  const text = readFileSync(fontDatPath, "utf8");
  const small = text.indexOf("  - id: FONT_SMALL");
  const file = text.indexOf("      - file: FontSmall.png", small);
  const marker = text.indexOf("        chars: >", file);
  const after = text.slice(marker).split(/\r?\n/);
  const line = after.find((entry, index) => index > 0 && entry.trim().length > 0);
  if (!line) {
    throw new Error("Could not read FontSmall.png chars from Font.dat");
  }
  return line.trim().slice(0, 94);
}

function buildFontIndex(source, chars) {
  const image = { width: 8, height: 9, spacing: -1, surface: source };
  const charsByCode = new Map();
  const length = Math.trunc(source.width / image.width);
  for (let i = 0; i < chars.length; ++i) {
    let left = -1;
    let right = -1;
    const startX = (i % length) * image.width;
    const startY = Math.floor(i / length) * image.height;
    for (let x = startX; x < startX + image.width; ++x) {
      for (let y = startY; y < startY + image.height && left === -1; ++y) {
        if (source.pixels[y * source.width + x] !== 0) {
          left = x;
        }
      }
    }
    for (let x = startX + image.width - 1; x >= startX; --x) {
      for (let y = startY + image.height - 1; y >= startY && right === -1; --y) {
        if (source.pixels[y * source.width + x] !== 0) {
          right = x;
        }
      }
    }
    if (left === -1 || right === -1) {
      left = startX;
      right = startX;
    }
    charsByCode.set(chars.codePointAt(i), { x: left, y: startY, w: right - left + 1, h: image.height });
  }
  return { image, charsByCode };
}

function charSize(font, code) {
  const rect = font.charsByCode.get(code);
  if (rect) {
    return { w: rect.w + font.image.spacing, h: rect.h + font.image.spacing };
  }
  if (code === 9) {
    return { w: Math.trunc(font.image.width * 3 / 4), h: font.image.height + font.image.spacing };
  }
  return { w: Math.trunc(font.image.width / 2), h: font.image.height + font.image.spacing };
}

function renderReferenceText(font, text, color) {
  let width = 0;
  for (const char of text) {
    width += charSize(font, char.codePointAt(0)).w;
  }
  const height = font.image.height;
  const pixels = new Uint8Array(width * height);
  let x = 0;
  for (const char of text) {
    const code = char.codePointAt(0);
    const size = charSize(font, code);
    const rect = font.charsByCode.get(code);
    if (rect) {
      for (let yy = 0; yy < rect.h; ++yy) {
        for (let xx = 0; xx < rect.w; ++xx) {
          const src = font.image.surface.pixels[(rect.y + yy) * font.image.surface.width + rect.x + xx];
          const destX = x + xx;
          if (src && destX >= 0 && destX < width && yy >= 0 && yy < height) {
            pixels[yy * width + destX] = color + src;
          }
        }
      }
    }
    x += size.w;
  }
  return { width, height, pixels: Array.from(pixels) };
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let i = 0; i < 8; ++i) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const typeBytes = Buffer.from(type, "ascii");
  const chunk = Buffer.alloc(8 + data.length + 4);
  chunk.writeUInt32BE(data.length, 0);
  typeBytes.copy(chunk, 4);
  data.copy(chunk, 8);
  chunk.writeUInt32BE(crc32(Buffer.concat([typeBytes, data])), 8 + data.length);
  return chunk;
}

function encodeRgbaPng(width, height, rgba) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  header[10] = 0;
  header[11] = 0;
  header[12] = 0;

  const rows = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; ++y) {
    const row = y * (width * 4 + 1);
    rows[row] = 0;
    Buffer.from(rgba.buffer, rgba.byteOffset + y * width * 4, width * 4).copy(rows, row + 1);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", header),
    pngChunk("IDAT", zlib.deflateSync(rows)),
    pngChunk("IEND", Buffer.alloc(0))
  ]);
}

function colorizeIndexed(indexed, palette, scale = 4) {
  const width = indexed.width * scale;
  const height = indexed.height * scale;
  const rgba = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; ++y) {
    for (let x = 0; x < width; ++x) {
      const pixel = indexed.pixels[Math.floor(y / scale) * indexed.width + Math.floor(x / scale)];
      const color = pixel === 0 ? { r: 0, g: 0, b: 0, a: 255 } : palette[pixel] || { r: 255, g: 0, b: 255, a: 255 };
      const p = (y * width + x) * 4;
      rgba[p] = color.r;
      rgba[p + 1] = color.g;
      rgba[p + 2] = color.b;
      rgba[p + 3] = color.a == null ? 255 : color.a;
    }
  }
  return encodeRgbaPng(width, height, rgba);
}

function createSnapshotPalette() {
  const colors = [];
  const ramps = [
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
  colors[0] = { r: 0, g: 0, b: 0, a: 255 };
  colors[1] = { r: 24, g: 84, b: 40, a: 255 };
  colors[2] = { r: 42, g: 132, b: 62, a: 255 };
  colors[3] = { r: 80, g: 196, b: 96, a: 255 };
  colors[4] = { r: 151, g: 240, b: 124, a: 255 };
  colors[5] = { r: 232, g: 255, b: 194, a: 255 };
  return colors;
}

function diffPixels(source, browser) {
  const mismatches = [];
  if (source.width !== browser.width || source.height !== browser.height) {
    mismatches.push({ reason: "dimensions", source: { width: source.width, height: source.height }, browser: { width: browser.width, height: browser.height } });
    return mismatches;
  }
  for (let i = 0; i < source.pixels.length; ++i) {
    if (source.pixels[i] !== browser.pixels[i]) {
      mismatches.push({
        x: i % source.width,
        y: Math.floor(i / source.width),
        source: source.pixels[i],
        browser: browser.pixels[i]
      });
      if (mismatches.length === 20) {
        break;
      }
    }
  }
  return mismatches;
}

async function main() {
  line("VERIFY_FONT_SOURCE_PARITY");
  const indexedFont = parseIndexedPng(fontPath);
  const chars = readSmallFontAsciiChars();
  const font = buildFontIndex(indexedFont, chars);
  const reference = renderReferenceText(font, sampleText, sampleColor);

  await mkdir(outputRoot, { recursive: true });
  await mkdir(verifierRoot, { recursive: true });
  await run("build", process.execPath, [join(webRoot, "scripts", "build.mjs")]);

  const verifier = `async page => {
  await page.goto(${JSON.stringify(url)});
  await page.waitForFunction(() => document.readyState === "complete");
  await page.waitForFunction(() => window.openxcomGame?.getScreen?.()?.getSurface?.()?.getPalette?.()?.length >= 256, null, { timeout: 15000 });
  const isolated = await page.evaluate(async ({ text, color, width, height, sourceFont }) => {
    const [{ Font }, { Text }, { Language }] = await Promise.all([
      import("/web/dist/Engine/Font.js"),
      import("/web/dist/Interface/Text.js"),
      import("/web/dist/Engine/Language.js")
    ]);
    const font = new Font();
    await font.load({
      id: "FONT_SMALL",
      width: 8,
      height: 9,
      spacing: -1,
      images: [{ file: "FontSmall.png", chars: sourceFont.chars }]
    }, "bin/common/Language");

    const surface = font._images?.[0]?.surface;
    const fontMismatches = [];
    for (let i = 0; i < sourceFont.pixels.length; ++i) {
      const actual = surface.getPixel(i % sourceFont.width, Math.floor(i / sourceFont.width));
      if (actual !== sourceFont.pixels[i]) {
        fontMismatches.push({ x: i % sourceFont.width, y: Math.floor(i / sourceFont.width), source: sourceFont.pixels[i], browser: actual });
        if (fontMismatches.length === 20) {
          break;
        }
      }
    }

    const language = new Language();
    const textSurface = new Text(width, height);
    textSurface.initText(font, font, language);
    textSurface.setSmall();
    textSurface.setColor(color);
    textSurface.setText(text);
    textSurface.draw();
    const pixels = [];
    for (let y = 0; y < height; ++y) {
      for (let x = 0; x < width; ++x) {
        pixels.push(textSurface.getPixel(x, y));
      }
    }
    return {
      fontMismatches,
      text: { width, height, pixels }
    };
  }, {
    text: ${JSON.stringify(sampleText)},
    color: ${sampleColor},
    width: ${reference.width},
    height: ${reference.height},
    sourceFont: {
      width: ${indexedFont.width},
      height: ${indexedFont.height},
      chars: ${JSON.stringify(chars)},
      pixels: ${JSON.stringify(Array.from(indexedFont.pixels))}
    }
  });
  await page.evaluate(value => console.log("VERIFY_FONT_SOURCE_PARITY ok " + JSON.stringify(value)), isolated);
}`;

  await writeFile(verifierPath, verifier, "utf8");

  let server = null;
  if (!(await serverReady())) {
    server = spawn(process.execPath, [join(webRoot, "scripts", "serve.mjs")], {
      cwd: repoRoot,
      windowsHide: true,
      stdio: "ignore"
    });
    await waitForServer();
  }

  let isolated;
  try {
    await runNpm("playwright open", [
      "exec", "--yes", "--package", "@playwright/cli", "--",
      "playwright-cli", "--session", session, "open", url
    ], repoRoot);
    const runCodeResult = await runNpm("playwright run-code", [
      "exec", "--yes", "--package", "@playwright/cli", "--",
      "playwright-cli", "--session", session, "run-code", "--filename", verifierPath
    ], repoRoot);
    const consoleResult = await runNpm("playwright console", [
      "exec", "--yes", "--package", "@playwright/cli", "--",
      "playwright-cli", "--session", session, "console"
    ], repoRoot);
    const markerLine = consoleResult.stdout.split(/\r?\n/).find(line => line.includes("VERIFY_FONT_SOURCE_PARITY ok "));
    if (!markerLine) {
      throw new Error("Browser verifier marker missing\nRUN-CODE:\n" + runCodeResult.stdout + "\nCONSOLE:\n" + consoleResult.stdout);
    }
    const markerJson = markerLine.slice(markerLine.indexOf("VERIFY_FONT_SOURCE_PARITY ok ") + "VERIFY_FONT_SOURCE_PARITY ok ".length);
    isolated = JSON.parse(markerJson.slice(markerJson.indexOf("{"), markerJson.lastIndexOf("}") + 1));
  } finally {
    await runNpm("playwright close", [
      "exec", "--yes", "--package", "@playwright/cli", "--",
      "playwright-cli", "--session", session, "close"
    ], repoRoot).catch(() => {});
    await rm(verifierPath, { force: true }).catch(() => {});
    const cliDir = join(repoRoot, ".playwright-cli");
    if (existsSync(cliDir) && normalize(cliDir).startsWith(repoRoot)) {
      await rm(cliDir, { recursive: true, force: true });
    }
    if (server) {
      server.kill();
    }
  }

  if (isolated.fontMismatches.length > 0) {
    throw new Error("Browser font PNG index decode differs from the C++ lodepng raw-index path: " + JSON.stringify(isolated.fontMismatches));
  }

  const mismatches = diffPixels(reference, isolated.text);
  const snapshotPalette = createSnapshotPalette();
  await writeFile(join(outputRoot, "source-reference-new-game.png"), colorizeIndexed(reference, snapshotPalette));
  await writeFile(join(outputRoot, "ts-rendered-new-game.png"), colorizeIndexed(isolated.text, snapshotPalette));

  if (mismatches.length > 0) {
    throw new Error("TS text render differs from C++ source-index reference: " + JSON.stringify(mismatches));
  }

  line("VERIFY_FONT_SOURCE_PARITY ok " + JSON.stringify({
    text: sampleText,
    color: sampleColor,
    size: { width: reference.width, height: reference.height },
    snapshots: [
      normalize(join(outputRoot, "source-reference-new-game.png")),
      normalize(join(outputRoot, "ts-rendered-new-game.png"))
    ]
  }));
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
