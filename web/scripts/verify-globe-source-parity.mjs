import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { mkdir, rm, writeFile } from "node:fs/promises";
import http from "node:http";
import { dirname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import zlib from "node:zlib";

const webRoot = normalize(join(dirname(fileURLToPath(import.meta.url)), ".."));
const repoRoot = normalize(join(webRoot, ".."));
const outputRoot = join(repoRoot, "output", "globe-parity");
const verifierRoot = join(repoRoot, "output", "playwright");
const verifierPath = join(verifierRoot, "verify-globe-source-parity.js");
const session = "openxcom-globe-source-parity";
const url = "http://127.0.0.1:4173/web/index.html";
const width = 256;
const height = 200;
const centerX = 128;
const centerY = 100;
const zoom = 1;
const lon = 0;
const lat = 0;
const worldDatPath = join(repoRoot, "XCOM", "GEODATA", "WORLD.DAT");
const textureDatPath = join(repoRoot, "XCOM", "GEOGRAPH", "TEXTURE.DAT");
const globeRulePath = join(repoRoot, "bin", "standard", "xcom1", "globe.rul");

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

function int16le(bytes, offset) {
  const value = bytes[offset] | (bytes[offset + 1] << 8);
  return value & 0x8000 ? value - 0x10000 : value;
}

function xcom2Rad(deg) {
  return deg * 0.125 * Math.PI / 180.0;
}

function deg2Rad(deg) {
  return deg * Math.PI / 180.0;
}

function parseWorldDat(path) {
  const bytes = readFileSync(path);
  const polygons = [];
  for (let offset = 0; offset + 19 < bytes.length; offset += 20) {
    const value = [];
    for (let i = 0; i < 10; ++i) {
      value.push(int16le(bytes, offset + i * 2));
    }
    const points = value[6] !== -1 ? 4 : 3;
    const polygon = { lon: [], lat: [], x: new Array(points).fill(0), y: new Array(points).fill(0), texture: value[8], points };
    for (let i = 0, j = 0; i < points; ++i) {
      polygon.lon[i] = xcom2Rad(value[j++]);
      polygon.lat[i] = xcom2Rad(value[j++]);
    }
    polygons.push(polygon);
  }
  return polygons;
}

function parseNumberList(value) {
  const body = value.trim().replace(/^\[/, "").replace(/\]$/, "");
  if (!body.trim()) {
    return [];
  }
  return body.split(",").map(part => Number(part.trim())).filter(Number.isFinite);
}

function stripComment(line) {
  let quoted = false;
  let quote = "";
  for (let i = 0; i < line.length; ++i) {
    const ch = line[i];
    if ((ch === "\"" || ch === "'") && (i === 0 || line[i - 1] !== "\\")) {
      if (!quoted) {
        quoted = true;
        quote = ch;
      } else if (quote === ch) {
        quoted = false;
      }
    } else if (ch === "#" && !quoted) {
      return line.slice(0, i);
    }
  }
  return line;
}

function parseGlobeRule(path) {
  const source = readFileSync(path, "utf8");
  const rule = { oceanColor: 12 * 16, oceanShading: true, lineColor: 162, polylines: [] };
  let section = "";
  for (const raw of source.split(/\r?\n/)) {
    const line = stripComment(raw);
    if (!line.trim()) {
      continue;
    }
    const indent = line.search(/\S|$/);
    const trimmed = line.trim();
    if (indent === 2) {
      const scalar = /^([A-Za-z0-9_]+):\s*(.+?)\s*$/.exec(trimmed);
      if (scalar) {
        if (scalar[1] === "oceanPalette") {
          rule.oceanColor = Number(scalar[2]) * 16;
        } else if (scalar[1] === "lineColor") {
          rule.lineColor = Number(scalar[2]);
        } else if (scalar[1] === "oceanShading") {
          rule.oceanShading = !/^(false|no|off|0)$/i.test(scalar[2].trim());
        }
      }
      const sectionHeader = /^([A-Za-z0-9_]+):\s*$/.exec(trimmed);
      section = sectionHeader ? sectionHeader[1] : "";
      continue;
    }
    if (indent === 4 && section === "polylines") {
      const list = /^-\s*(\[.*\])\s*$/.exec(trimmed);
      if (!list) {
        continue;
      }
      const numbers = parseNumberList(list[1]);
      const polyline = { lon: [], lat: [], points: Math.trunc(numbers.length / 2) };
      for (let i = 0; i + 1 < numbers.length; i += 2) {
        const point = Math.trunc(i / 2);
        polyline.lon[point] = deg2Rad(numbers[i]);
        polyline.lat[point] = deg2Rad(numbers[i + 1]);
      }
      rule.polylines.push(polyline);
    }
  }
  return rule;
}

function loadDatFrames(path, frameWidth, frameHeight) {
  const bytes = readFileSync(path);
  const frameSize = frameWidth * frameHeight;
  const frames = [];
  for (let frame = 0; frame * frameSize < bytes.length; ++frame) {
    frames.push(Uint8Array.from(bytes.subarray(frame * frameSize, (frame + 1) * frameSize)));
  }
  return { width: frameWidth, height: frameHeight, frames };
}

function setupRadii(surfaceHeight) {
  return [
    0.45 * surfaceHeight,
    0.60 * surfaceHeight,
    0.90 * surfaceHeight,
    1.40 * surfaceHeight,
    2.25 * surfaceHeight,
    3.60 * surfaceHeight
  ];
}

function positiveModulo(value, divisor) {
  return ((value % divisor) + divisor) % divisor;
}

function shadeGradient(index) {
  let j = index - 120;
  if (j < -66) j = -16;
  else if (j < -48) j = -15;
  else if (j < -33) j = -14;
  else if (j < -22) j = -13;
  else if (j < -15) j = -12;
  else if (j < -11) j = -11;
  else if (j < -9) j = -10;

  if (j > 120) j = 19;
  else if (j > 98) j = 18;
  else if (j > 86) j = 17;
  else if (j > 74) j = 16;
  else if (j > 54) j = 15;
  else if (j > 38) j = 14;
  else if (j > 26) j = 13;
  else if (j > 18) j = 12;
  else if (j > 13) j = 11;
  else if (j > 10) j = 10;
  else if (j > 8) j = 9;
  return j + 16;
}

function getShadowValue(earth, sun, noise) {
  let value = (earth.x - sun.x) * (earth.x - sun.x) +
    (earth.y - sun.y) * (earth.y - sun.y) +
    (earth.z - sun.z) * (earth.z - sun.z);
  value -= 2.0;
  value *= 125.0;
  if (value < -110) {
    value = -31;
  } else if (value > 120) {
    value = 50;
  } else {
    value = shadeGradient(Math.trunc(value) + 120);
  }
  value -= noise;
  return Math.max(0, Math.min(31, Math.trunc(value)));
}

function getSunDirection(centerLon, centerLat) {
  const curTime = 0.25;
  const rot = curTime * 2 * Math.PI;
  const sun = 0;
  const direction = {
    x: Math.cos(rot + centerLon),
    y: Math.sin(rot + centerLon) * -Math.sin(centerLat),
    z: Math.sin(rot + centerLon) * Math.cos(centerLat)
  };
  const norm = Math.sqrt(direction.x * direction.x + direction.y * direction.y + direction.z * direction.z);
  return { x: direction.x / norm, y: direction.y / norm, z: direction.z / norm };
}

function circleNorm(ox, oy, radius, x, y) {
  const limit = radius * radius;
  const norm = 1.0 / radius;
  const retX = x - ox;
  const retY = y - oy;
  const temp = retX * retX + retY * retY;
  if (limit > temp) {
    return { x: retX * norm, y: retY * norm, z: Math.sqrt(limit - temp) * norm };
  }
  return { x: 0, y: 0, z: 0 };
}

function renderSourceGlobe({ polygons, textures, rule }) {
  const pixels = new Uint8Array(width * height);
  const zoomRadius = setupRadii(height);
  const radius = zoomRadius[zoom];
  const zoomTexture = (2 - Math.floor(zoom / 2.0)) * Math.trunc(textures.frames.length / 3);
  const noise = new Int16Array(60 * 60);
  for (let i = 0; i < noise.length; ++i) {
    noise[i] = ((i * 1103515245 + 12345) >>> 16) & 3;
  }
  const setPixel = (x, y, pixel) => {
    if (x >= 0 && x < width && y >= 0 && y < height) {
      pixels[y * width + x] = pixel & 0xff;
    }
  };
  const getPixel = (x, y) => x >= 0 && x < width && y >= 0 && y < height ? pixels[y * width + x] : 0;
  const polarToCart = (pointLon, pointLat) => ({
    x: centerX + Math.floor(radius * Math.cos(pointLat) * Math.sin(pointLon - lon)),
    y: centerY + Math.floor(radius * (Math.cos(lat) * Math.sin(pointLat) - Math.sin(lat) * Math.cos(pointLat) * Math.cos(pointLon - lon)))
  });
  const pointBack = (pointLon, pointLat) => {
    const c = Math.cos(lat) * Math.cos(pointLat) * Math.cos(pointLon - lon) + Math.sin(lat) * Math.sin(pointLat);
    return c < 0.0;
  };

  for (let y = Math.trunc(-(radius + 20)); y <= Math.trunc(radius + 20); ++y) {
    for (let x = Math.trunc(-(radius + 20)); x <= Math.trunc(radius + 20); ++x) {
      if (x * x + y * y <= (radius + 20) * (radius + 20)) {
        setPixel(centerX + 1 + x, centerY + y, rule.oceanColor);
      }
    }
  }

  const cacheLand = [];
  for (const polygon of polygons) {
    let closest = 0.0;
    let furthest = 0.0;
    for (let j = 0; j < polygon.points; ++j) {
      const z = Math.cos(lat) * Math.cos(polygon.lat[j]) * Math.cos(polygon.lon[j] - lon) + Math.sin(lat) * Math.sin(polygon.lat[j]);
      if (z > closest) {
        closest = z;
      } else if (z < furthest) {
        furthest = z;
      }
    }
    if (-furthest > closest) {
      continue;
    }
    const cached = { ...polygon, lon: [...polygon.lon], lat: [...polygon.lat], x: [], y: [] };
    for (let j = 0; j < polygon.points; ++j) {
      const p = polarToCart(polygon.lon[j], polygon.lat[j]);
      cached.x[j] = p.x;
      cached.y[j] = p.y;
    }
    cacheLand.push(cached);
  }

  const drawTexturedPolygon = (x, y, n, texture) => {
    const minY = Math.max(0, Math.min(...y.slice(0, n)));
    const maxY = Math.min(height - 1, Math.max(...y.slice(0, n)));
    for (let py = minY; py <= maxY; ++py) {
      const nodes = [];
      for (let i = 0, j = n - 1; i < n; j = i++) {
        if ((y[i] < py && y[j] >= py) || (y[j] < py && y[i] >= py)) {
          nodes.push(Math.trunc(x[i] + ((py - y[i]) / (y[j] - y[i])) * (x[j] - x[i])));
        }
      }
      nodes.sort((a, b) => a - b);
      for (let i = 0; i + 1 < nodes.length; i += 2) {
        const startX = Math.max(0, nodes[i]);
        const endX = Math.min(width, nodes[i + 1]);
        for (let px = startX; px < endX; ++px) {
          const tx = positiveModulo(px, textures.width);
          const ty = positiveModulo(py, textures.height);
          setPixel(px, py, texture[ty * textures.width + tx]);
        }
      }
    }
  };

  for (const polygon of cacheLand) {
    const texture = textures.frames[polygon.texture + zoomTexture];
    drawTexturedPolygon(polygon.x, polygon.y, polygon.points, texture);
  }

  const sun = getSunDirection(lon, lat);
  for (let y = 0; y < height; ++y) {
    for (let x = 0; x < width; ++x) {
      const dest = getPixel(x, y);
      const earth = circleNorm(centerX, centerY, radius, x + 0.5, y + 0.5);
      if (dest && earth.z) {
        const shadow = getShadowValue(earth, sun, noise[positiveModulo(y, 60) * 60 + positiveModulo(x, 60)]);
        if (rule.oceanShading && dest >= rule.oceanColor && dest < rule.oceanColor + 32) {
          setPixel(x, y, rule.oceanColor + shadow);
        } else {
          const shaded = Math.trunc(shadow / 3);
          const candidate = dest + shaded;
          const group = dest & (15 << 4);
          setPixel(x, y, candidate > group + 15 ? group + 15 : candidate);
        }
      } else {
        setPixel(x, y, 0);
      }
    }
  }

  if (zoom >= 1) {
    for (const polyline of rule.polylines) {
      for (let j = 0; j < polyline.points - 1; ++j) {
        if (pointBack(polyline.lon[j], polyline.lat[j]) || pointBack(polyline.lon[j + 1], polyline.lat[j + 1])) {
          continue;
        }
        const start = polarToCart(polyline.lon[j], polyline.lat[j]);
        const end = polarToCart(polyline.lon[j + 1], polyline.lat[j + 1]);
        drawLine(pixels, width, height, start.x, start.y, end.x, end.y, rule.lineColor);
      }
    }
  }

  return { width, height, pixels: Array.from(pixels) };
}

function drawLine(pixels, w, h, x1, y1, x2, y2, color) {
  const setPixel = (x, y) => {
    if (x >= 0 && x < w && y >= 0 && y < h) {
      pixels[y * w + x] = color & 0xff;
    }
  };
  let dx = Math.abs(x2 - x1);
  const sx = x1 < x2 ? 1 : -1;
  let dy = -Math.abs(y2 - y1);
  const sy = y1 < y2 ? 1 : -1;
  let err = dx + dy;
  while (true) {
    setPixel(x1, y1);
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

function encodeRgbaPng(imageWidth, imageHeight, rgba) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(imageWidth, 0);
  header.writeUInt32BE(imageHeight, 4);
  header[8] = 8;
  header[9] = 6;
  const rows = Buffer.alloc((imageWidth * 4 + 1) * imageHeight);
  for (let y = 0; y < imageHeight; ++y) {
    const row = y * (imageWidth * 4 + 1);
    rows[row] = 0;
    Buffer.from(rgba.buffer, rgba.byteOffset + y * imageWidth * 4, imageWidth * 4).copy(rows, row + 1);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", header),
    pngChunk("IDAT", zlib.deflateSync(rows)),
    pngChunk("IEND", Buffer.alloc(0))
  ]);
}

function createSnapshotPalette() {
  const colors = [];
  const ramps = [
    [58, 36, 22], [88, 20, 38], [118, 42, 12], [106, 36, 94],
    [18, 88, 76], [120, 24, 24], [92, 58, 22], [46, 40, 108],
    [42, 166, 88], [44, 96, 170], [142, 72, 174], [160, 70, 84],
    [72, 72, 72], [210, 178, 74], [40, 200, 64], [220, 220, 220]
  ];
  for (let i = 0; i < 256; ++i) {
    const block = Math.floor(i / 16);
    const shade = i & 15;
    const t = shade / 15;
    const base = ramps[block] || [128, 128, 128];
    const lift = block === 8 ? [255, 232, 120] : block === 14 ? [190, 255, 120] : [255, 255, 255];
    colors.push({
      r: Math.round(base[0] * (1 - t) + lift[0] * t),
      g: Math.round(base[1] * (1 - t) + lift[1] * t),
      b: Math.round(base[2] * (1 - t) + lift[2] * t),
      a: i === 0 ? 255 : 255
    });
  }
  return colors;
}

function colorizeIndexed(indexed, palette, scale = 2) {
  const imageWidth = indexed.width * scale;
  const imageHeight = indexed.height * scale;
  const rgba = new Uint8Array(imageWidth * imageHeight * 4);
  for (let y = 0; y < imageHeight; ++y) {
    for (let x = 0; x < imageWidth; ++x) {
      const pixel = indexed.pixels[Math.floor(y / scale) * indexed.width + Math.floor(x / scale)];
      const color = pixel === 0 ? { r: 0, g: 0, b: 0, a: 255 } : palette[pixel] || { r: 255, g: 0, b: 255, a: 255 };
      const p = (y * imageWidth + x) * 4;
      rgba[p] = color.r;
      rgba[p + 1] = color.g;
      rgba[p + 2] = color.b;
      rgba[p + 3] = color.a == null ? 255 : color.a;
    }
  }
  return encodeRgbaPng(imageWidth, imageHeight, rgba);
}

function diffPixels(source, browser) {
  let count = 0;
  const samples = [];
  if (source.width !== browser.width || source.height !== browser.height) {
    return { count: 1, samples: [{ reason: "dimensions", source: { width: source.width, height: source.height }, browser: { width: browser.width, height: browser.height } }] };
  }
  for (let i = 0; i < source.pixels.length; ++i) {
    if (source.pixels[i] !== browser.pixels[i]) {
      count++;
      if (samples.length < 20) {
        samples.push({ x: i % source.width, y: Math.floor(i / source.width), source: source.pixels[i], browser: browser.pixels[i] });
      }
    }
  }
  return { count, samples };
}

async function main() {
  line("VERIFY_GLOBE_SOURCE_PARITY");
  const polygons = parseWorldDat(worldDatPath);
  const textures = loadDatFrames(textureDatPath, 32, 32);
  const rule = parseGlobeRule(globeRulePath);
  const reference = renderSourceGlobe({ polygons, textures, rule });

  await mkdir(outputRoot, { recursive: true });
  await mkdir(verifierRoot, { recursive: true });
  await run("build", process.execPath, [join(webRoot, "scripts", "build.mjs")]);

  const verifier = `async page => {
  await page.goto(${JSON.stringify(url)});
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForFunction(() => window.openxcomGame?.getMod?.()?.getGlobe?.()?.getPolygons?.()?.length > 0, null, { timeout: 20000 });
  await page.waitForFunction(() => window.openxcomGame?.getMod?.()?.getSurfaceSet?.("TEXTURE.DAT")?.getTotalFrames?.() === ${textures.frames.length}, null, { timeout: 20000 });
  const rendered = await page.evaluate(async config => {
    const game = window.openxcomGame;
    const mod = game.getMod();
    const save = mod.newSave();
    save.setGlobeLongitude(config.lon);
    save.setGlobeLatitude(config.lat);
    save.setGlobeZoom(config.zoom);
    game.setSavedGame(save);
    const { Globe } = await import("/web/dist/Geoscape/Globe.js");
    const globe = new Globe(game, config.centerX, config.centerY, config.width, config.height, 0, 0);
    globe.draw();
    const pixels = [];
    for (let y = 0; y < config.height; ++y) {
      for (let x = 0; x < config.width; ++x) {
        pixels.push(globe.getPixel(x, y));
      }
    }
    return {
      width: config.width,
      height: config.height,
      pixels,
      polygons: mod.getGlobe().getPolygons().length,
      polylines: mod.getGlobe().getPolylines().length,
      textureFrames: mod.getSurfaceSet("TEXTURE.DAT").getTotalFrames(),
      zoom: globe.getZoom()
    };
  }, ${JSON.stringify({ width, height, centerX, centerY, zoom, lon, lat })});
  await page.evaluate(value => console.log("VERIFY_GLOBE_SOURCE_PARITY ok " + JSON.stringify(value)), rendered);
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

  let rendered;
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
    const markerLine = consoleResult.stdout.split(/\r?\n/).find(entry => entry.includes("VERIFY_GLOBE_SOURCE_PARITY ok "));
    if (!markerLine) {
      throw new Error("Browser verifier marker missing\nRUN-CODE:\n" + runCodeResult.stdout + "\nCONSOLE:\n" + consoleResult.stdout);
    }
    const markerJson = markerLine.slice(markerLine.indexOf("VERIFY_GLOBE_SOURCE_PARITY ok ") + "VERIFY_GLOBE_SOURCE_PARITY ok ".length);
    rendered = JSON.parse(markerJson.slice(markerJson.indexOf("{"), markerJson.lastIndexOf("}") + 1));
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

  const diff = diffPixels(reference, rendered);
  const palette = createSnapshotPalette();
  const sourceSnapshot = join(outputRoot, "source-reference-globe.png");
  const tsSnapshot = join(outputRoot, "ts-rendered-globe.png");
  await writeFile(sourceSnapshot, colorizeIndexed(reference, palette));
  await writeFile(tsSnapshot, colorizeIndexed(rendered, palette));

  if (diff.count > 0) {
    throw new Error("TS globe render differs from C++ source-reference path: " + JSON.stringify(diff));
  }

  line("VERIFY_GLOBE_SOURCE_PARITY ok " + JSON.stringify({
    scene: { width, height, centerX, centerY, zoom, lon, lat },
    source: { polygons: polygons.length, polylines: rule.polylines.length, textureFrames: textures.frames.length },
    browser: { polygons: rendered.polygons, polylines: rendered.polylines, textureFrames: rendered.textureFrames, zoom: rendered.zoom },
    diffPixels: diff.count,
    snapshots: [normalize(sourceSnapshot), normalize(tsSnapshot)]
  }));
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
