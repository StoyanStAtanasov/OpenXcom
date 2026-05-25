import { mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { dirname, extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { stripTypeScriptTypes } from "node:module";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = join(root, "..");
const src = join(root, "src");
const dist = join(root, "dist");

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await walk(path));
    } else if (extname(entry.name) === ".ts") {
      files.push(path);
    }
  }
  return files;
}

function rewriteImports(source) {
  return source
    .replace(/(from\s+["'][^"']+)\.ts(["'])/g, "$1.js$2")
    .replace(/(import\s+["'][^"']+)\.ts(["'])/g, "$1.js$2");
}

async function exists(path) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function findOriginalFile(roots, ...segments) {
  for (const originalRoot of roots) {
    const path = join(repoRoot, originalRoot, ...segments);
    if (await exists(path)) {
      return relative(repoRoot, path).replaceAll("\\", "/");
    }
  }
  return null;
}

async function findOriginalDir(roots, ...segments) {
  for (const originalRoot of roots) {
    const path = join(repoRoot, originalRoot, ...segments);
    try {
      const info = await stat(path);
      if (info.isDirectory()) {
        return relative(repoRoot, path).replaceAll("\\", "/");
      }
    } catch {
      // Keep probing alternate original-data roots.
    }
  }
  return null;
}

async function findOriginalFiles(roots, ...segments) {
  const files = [];
  for (const originalRoot of roots) {
    const dir = join(repoRoot, originalRoot, ...segments);
    if (!(await exists(dir))) {
      continue;
    }
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile()) {
        files.push(relative(repoRoot, join(dir, entry.name)).replaceAll("\\", "/"));
      }
    }
  }
  return files.sort((a, b) => a.localeCompare(b));
}

const ufoRoots = ["XCOM", join("bin", "UFO")];
const tftdRoots = ["TFD", "TFTD", join("bin", "TFTD")];
const commonRoots = [join("bin", "common")];

await rm(dist, { recursive: true, force: true });
for (const file of await walk(src)) {
  const rel = relative(src, file).replace(/\.ts$/, ".js");
  const out = join(dist, rel);
  const ts = await readFile(file, "utf8");
  const js = rewriteImports(stripTypeScriptTypes(ts, { mode: "transform" }));
  await mkdir(dirname(out), { recursive: true });
  await writeFile(out, js, "utf8");
}

await writeFile(join(dist, "resource-manifest.json"), JSON.stringify({
  ufoPalettesDat: await findOriginalFile(ufoRoots, "GEODATA", "PALETTES.DAT"),
  ufoBackPalsDat: await findOriginalFile(ufoRoots, "GEODATA", "BACKPALS.DAT"),
  ufoBack01Scr: await findOriginalFile(ufoRoots, "GEOGRAPH", "BACK01.SCR"),
  ufoBack02Scr: await findOriginalFile(ufoRoots, "GEOGRAPH", "BACK02.SCR"),
  ufoBack05Scr: await findOriginalFile(ufoRoots, "GEOGRAPH", "BACK05.SCR"),
  ufoBack06Scr: await findOriginalFile(ufoRoots, "GEOGRAPH", "BACK06.SCR"),
  ufoBack07Scr: await findOriginalFile(ufoRoots, "GEOGRAPH", "BACK07.SCR"),
  ufoBack12Scr: await findOriginalFile(ufoRoots, "GEOGRAPH", "BACK12.SCR"),
  ufoBack13Scr: await findOriginalFile(ufoRoots, "GEOGRAPH", "BACK13.SCR"),
  ufoBack14Scr: await findOriginalFile(ufoRoots, "GEOGRAPH", "BACK14.SCR"),
  ufoBack15Scr: await findOriginalFile(ufoRoots, "GEOGRAPH", "BACK15.SCR"),
  ufoBack17Scr: await findOriginalFile(ufoRoots, "GEOGRAPH", "BACK17.SCR"),
  ufoGeobordScr: await findOriginalFile(ufoRoots, "GEOGRAPH", "GEOBORD.SCR"),
  ufoAltGeobordScr: await findOriginalFile(ufoRoots, "GEOGRAPH", "ALTGEOBORD.SCR"),
  ufoGraphBdy: await findOriginalFile(ufoRoots, "GEOGRAPH", "GRAPH.BDY"),
  ufoGraphsSpk: await findOriginalFile(ufoRoots, "GEOGRAPH", "GRAPHS.SPK"),
  ufoWorldDat: await findOriginalFile(ufoRoots, "GEODATA", "WORLD.DAT"),
  ufoTextureDat: await findOriginalFile(ufoRoots, "GEOGRAPH", "TEXTURE.DAT"),
  ufoSoundDir: await findOriginalDir(ufoRoots, "SOUND"),
  ufoSoundFiles: await findOriginalFiles(ufoRoots, "SOUND"),
  ufoTerrainDir: await findOriginalDir(ufoRoots, "TERRAIN"),
  ufoMapsDir: await findOriginalDir(ufoRoots, "MAPS"),
  ufoRoutesDir: await findOriginalDir(ufoRoots, "ROUTES"),
  ufoUfographFiles: await findOriginalFiles(ufoRoots, "UFOGRAPH"),
  ufoUnitFiles: await findOriginalFiles(ufoRoots, "UNITS"),
  ufoLoftempsDat: await findOriginalFile(ufoRoots, "TERRAIN", "LOFTEMPS.DAT") || await findOriginalFile(ufoRoots, "GEODATA", "LOFTEMPS.DAT"),
  ufoBasebitsPck: await findOriginalFile(ufoRoots, "GEOGRAPH", "BASEBITS.PCK"),
  ufoBasebitsTab: await findOriginalFile(ufoRoots, "GEOGRAPH", "BASEBITS.TAB"),
  ufoFloorobPck: await findOriginalFile(ufoRoots, "UNITS", "FLOOROB.PCK"),
  ufoFloorobTab: await findOriginalFile(ufoRoots, "UNITS", "FLOOROB.TAB"),
  ufoScangDat: await findOriginalFile(ufoRoots, "GEODATA", "SCANG.DAT"),
  ufoScanbordPck: await findOriginalFile(ufoRoots, "UFOGRAPH", "SCANBORD.PCK"),
  ufoDetbordPck: await findOriginalFile(ufoRoots, "UFOGRAPH", "DETBORD.PCK"),
  ufoDetbord2Pck: await findOriginalFile(ufoRoots, "UFOGRAPH", "DETBORD2.PCK"),
  ufoDetblobDat: await findOriginalFile(ufoRoots, "UFOGRAPH", "DETBLOB.DAT"),
  ufoMedibordPck: await findOriginalFile(ufoRoots, "UFOGRAPH", "MEDIBORD.PCK"),
  ufoMedibitsDat: await findOriginalFile(ufoRoots, "UFOGRAPH", "MEDIBITS.DAT"),
  ufoUnibordPck: await findOriginalFile(ufoRoots, "UFOGRAPH", "UNIBORD.PCK"),
  tftdPalettesDat: await findOriginalFile(tftdRoots, "GEODATA", "PALETTES.DAT"),
  tftdBackPalsDat: await findOriginalFile(tftdRoots, "GEODATA", "BACKPALS.DAT"),
  tftdBack01Scr: await findOriginalFile(tftdRoots, "GEOGRAPH", "BACK01.SCR"),
  tftdBack12Scr: await findOriginalFile(tftdRoots, "GEOGRAPH", "BACK12.SCR"),
  tftdBack15Scr: await findOriginalFile(tftdRoots, "GEOGRAPH", "BACK15.SCR"),
  tftdBack17Scr: await findOriginalFile(tftdRoots, "GEOGRAPH", "BACK17.SCR"),
  tftdGeobordScr: await findOriginalFile(tftdRoots, "GEOGRAPH", "GEOBORD.SCR"),
  tftdAltGeobordScr: await findOriginalFile(tftdRoots, "GEOGRAPH", "ALTGEOBORD.SCR"),
  tftdGraphBdy: await findOriginalFile(tftdRoots, "GEOGRAPH", "GRAPH.BDY"),
  tftdGraphsSpk: await findOriginalFile(tftdRoots, "GEOGRAPH", "GRAPHS.SPK"),
  tftdWorldDat: await findOriginalFile(tftdRoots, "GEODATA", "WORLD.DAT"),
  tftdTextureDat: await findOriginalFile(tftdRoots, "GEOGRAPH", "TEXTURE.DAT"),
  tftdSoundDir: await findOriginalDir(tftdRoots, "SOUND"),
  tftdSoundFiles: await findOriginalFiles(tftdRoots, "SOUND"),
  tftdTerrainDir: await findOriginalDir(tftdRoots, "TERRAIN"),
  tftdMapsDir: await findOriginalDir(tftdRoots, "MAPS"),
  tftdRoutesDir: await findOriginalDir(tftdRoots, "ROUTES"),
  tftdUfographFiles: await findOriginalFiles(tftdRoots, "UFOGRAPH"),
  tftdUnitFiles: await findOriginalFiles(tftdRoots, "UNITS"),
  tftdLoftempsDat: await findOriginalFile(tftdRoots, "TERRAIN", "LOFTEMPS.DAT") || await findOriginalFile(tftdRoots, "GEODATA", "LOFTEMPS.DAT"),
  tftdBasebitsPck: await findOriginalFile(tftdRoots, "GEOGRAPH", "BASEBITS.PCK"),
  tftdBasebitsTab: await findOriginalFile(tftdRoots, "GEOGRAPH", "BASEBITS.TAB"),
  tftdFloorobPck: await findOriginalFile(tftdRoots, "UNITS", "FLOOROB.PCK"),
  tftdFloorobTab: await findOriginalFile(tftdRoots, "UNITS", "FLOOROB.TAB"),
  commonSoldierNameFiles: (await findOriginalFiles(commonRoots, "SoldierName")).filter(file => file.toLowerCase().endsWith(".nam"))
}, null, 2), "utf8");

console.log(`Built ${relative(root, dist)}`);
