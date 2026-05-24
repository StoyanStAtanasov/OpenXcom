import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const webRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = join(webRoot, "..");
const sourceRoot = join(repoRoot, "src");
const targetRoot = join(webRoot, "src");
const args = new Set(process.argv.slice(2));

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await walk(path));
    } else {
      files.push(path);
    }
  }
  return files;
}

function slash(path) {
  return path.replaceAll("\\", "/");
}

function withoutExtension(path) {
  return path.slice(0, -extname(path).length);
}

function areaOf(rel) {
  return rel.includes("/") ? rel.split("/")[0] : "(root)";
}

function percent(done, total) {
  return total === 0 ? 100 : Math.round((done / total) * 1000) / 10;
}

async function lineCount(path) {
  const text = await readFile(path, "utf8");
  return text.split(/\r?\n/).length;
}

async function exists(path) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const sourceFiles = (await walk(sourceRoot)).map(path => ({
    abs: path,
    rel: slash(relative(sourceRoot, path)),
    ext: extname(path)
  }));
  const targetFiles = (await walk(targetRoot)).map(path => ({
    abs: path,
    rel: slash(relative(targetRoot, path)),
    ext: extname(path)
  }));

  const sourceCodeFiles = sourceFiles.filter(file => file.ext === ".cpp" || file.ext === ".h");
  const targetTsFiles = targetFiles.filter(file => file.ext === ".ts");
  const targetStemSet = new Set(targetTsFiles.map(file => withoutExtension(file.rel)));

  const units = new Map();
  for (const file of sourceCodeFiles) {
    const stem = withoutExtension(file.rel);
    const unit = units.get(stem) || {
      stem,
      area: areaOf(file.rel),
      hasCpp: false,
      hasHeader: false,
      sourceFiles: [],
      translated: targetStemSet.has(stem)
    };
    if (file.ext === ".cpp") {
      unit.hasCpp = true;
    }
    if (file.ext === ".h") {
      unit.hasHeader = true;
    }
    unit.sourceFiles.push(`src/${file.rel}`);
    unit.translated = targetStemSet.has(stem);
    units.set(stem, unit);
  }

  const unitList = [...units.values()].sort((a, b) => a.stem.localeCompare(b.stem));
  const sourceStemSet = new Set(unitList.map(unit => unit.stem));
  const webOnlyFiles = targetTsFiles
    .filter(file => !sourceStemSet.has(withoutExtension(file.rel)))
    .map(file => `web/src/${file.rel}`)
    .sort((a, b) => a.localeCompare(b));

  const areas = new Map();
  for (const unit of unitList) {
    const area = areas.get(unit.area) || {
      area: unit.area,
      sourceUnits: 0,
      translatedUnits: 0,
      cppUnits: 0,
      headerOnlyUnits: 0,
      missingUnits: []
    };
    area.sourceUnits += 1;
    if (unit.translated) {
      area.translatedUnits += 1;
    } else {
      area.missingUnits.push(unit.stem);
    }
    if (unit.hasCpp) {
      area.cppUnits += 1;
    } else {
      area.headerOnlyUnits += 1;
    }
    areas.set(unit.area, area);
  }

  const areaList = [...areas.values()]
    .map(area => ({
      ...area,
      percent: percent(area.translatedUnits, area.sourceUnits)
    }))
    .sort((a, b) => a.area.localeCompare(b.area));

  const slicesPath = join(webRoot, "translation-slices.json");
  let slices = [];
  try {
    slices = JSON.parse(await readFile(slicesPath, "utf8"));
  } catch {
    slices = [];
  }

  const slicePathWarnings = [];
  for (const slice of slices) {
    for (const sourceFile of slice.sourceFiles || []) {
      if (!(await exists(join(repoRoot, sourceFile)))) {
        slicePathWarnings.push(`${slice.name}: missing source ${sourceFile}`);
      }
    }
    for (const targetFile of slice.targetFiles || []) {
      if (!(await exists(join(repoRoot, targetFile)))) {
        slicePathWarnings.push(`${slice.name}: missing target ${targetFile}`);
      }
    }
  }

  const statusRollups = {};
  for (const slice of slices) {
    statusRollups[slice.status] = (statusRollups[slice.status] || 0) + 1;
  }

  const nextQueue = slices
    .filter(slice => slice.status !== "integrated-verified")
    .map(slice => ({
      name: slice.name,
      area: slice.area,
      status: slice.status,
      nextAction: slice.nextAction || slice.boundaries?.[0] || "review and integrate"
    }));

  const sourceLines = {};
  const targetLines = {};
  for (const file of sourceCodeFiles) {
    sourceLines[areaOf(file.rel)] = (sourceLines[areaOf(file.rel)] || 0) + await lineCount(file.abs);
  }
  for (const file of targetTsFiles) {
    targetLines[areaOf(file.rel)] = (targetLines[areaOf(file.rel)] || 0) + await lineCount(file.abs);
  }

  const summary = {
    generatedAt: new Date().toISOString(),
    sourceUnits: unitList.length,
    translatedUnits: unitList.filter(unit => unit.translated).length,
    percentByPathParity: percent(unitList.filter(unit => unit.translated).length, unitList.length),
    sourceCodeFiles: sourceCodeFiles.length,
    targetTsFiles: targetTsFiles.length,
    webOnlyTsFiles: webOnlyFiles.length,
    integratedVerifiedSlices: slices.filter(slice => slice.status === "integrated-verified").length,
    trackedSlices: slices.length,
    slicePathWarnings: slicePathWarnings.length
  };

  const snapshot = {
    summary,
    areas: areaList,
    statusRollups,
    nextQueue,
    slices,
    slicePathWarnings,
    webOnlyFiles,
    knownTypecheckBoundary: [],
    lines: {
      sourceByArea: sourceLines,
      targetByArea: targetLines
    }
  };

  await writeFile(join(webRoot, "translation-status.json"), `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");

  const md = [];
  md.push("# Translation Status");
  md.push("");
  md.push(`Generated: ${summary.generatedAt}`);
  md.push("");
  md.push("## Summary");
  md.push("");
  md.push(`- Source translation units: ${summary.sourceUnits}`);
  md.push(`- Units with same-path TypeScript file: ${summary.translatedUnits} (${summary.percentByPathParity}%)`);
  md.push(`- Source code files (.cpp/.h): ${summary.sourceCodeFiles}`);
  md.push(`- TypeScript files: ${summary.targetTsFiles}`);
  md.push(`- TypeScript helper/web-only files: ${summary.webOnlyTsFiles}`);
  md.push(`- Tracked slices: ${summary.trackedSlices}`);
  md.push(`- Integrated and browser/build verified slices: ${summary.integratedVerifiedSlices}`);
  md.push(`- Slice path warnings: ${summary.slicePathWarnings}`);
  md.push("");
  md.push("Path parity is a progress signal, not proof of behavioral parity. Slice status and verifier notes carry the behavioral signal.");
  md.push("");
  md.push("## Slice Status Rollup");
  md.push("");
  md.push("| Status | Count |");
  md.push("| --- | ---: |");
  for (const [status, count] of Object.entries(statusRollups).sort(([a], [b]) => a.localeCompare(b))) {
    md.push(`| ${status} | ${count} |`);
  }
  md.push("");
  md.push("## Next Integration Queue");
  md.push("");
  md.push("| Slice | Area | Status | Next action |");
  md.push("| --- | --- | --- | --- |");
  for (const item of nextQueue.slice(0, 12)) {
    md.push(`| ${item.name} | ${item.area} | ${item.status} | ${item.nextAction} |`);
  }
  md.push("");
  md.push("## Area Coverage");
  md.push("");
  md.push("| Area | Units | TS Path Matches | Coverage | Missing Examples |");
  md.push("| --- | ---: | ---: | ---: | --- |");
  for (const area of areaList) {
    const examples = area.missingUnits.slice(0, 6).map(unit => `\`${unit}\``).join(", ");
    md.push(`| ${area.area} | ${area.sourceUnits} | ${area.translatedUnits} | ${area.percent}% | ${examples}${area.missingUnits.length > 6 ? ", ..." : ""} |`);
  }
  md.push("");
  md.push("## Tracked Slices");
  md.push("");
  md.push("| Slice | Area | Status | Slice % | Verification | Main Boundaries |");
  md.push("| --- | --- | --- | ---: | --- | --- |");
  for (const slice of slices) {
    md.push(`| ${slice.name} | ${slice.area} | ${slice.status} | ${slice.slicePercent}% | ${slice.verification} | ${slice.boundaries.join("; ")} |`);
  }
  md.push("");
  md.push("## Known Verification Signals");
  md.push("");
  md.push("- `npm run build` is the fast runtime build gate.");
  md.push("- `npx --yes --package typescript tsc --noEmit` is the stricter type gate; it currently passes with no known unrelated boundary.");
  md.push("- Browser verifiers should be recorded by `VERIFY_*` marker and added to tracked slices after passing.");
  if (slicePathWarnings.length > 0) {
    md.push("");
    md.push("## Slice Path Warnings");
    md.push("");
    for (const warning of slicePathWarnings) {
      md.push(`- ${warning}`);
    }
  }
  md.push("");

  await writeFile(join(webRoot, "TRANSLATION_STATUS.md"), `${md.join("\n")}\n`, "utf8");
  if (args.has("--json")) {
    console.log(JSON.stringify({
      summary,
      statusRollups,
      nextQueue,
      areaCoverage: areaList.map(area => ({
        area: area.area,
        sourceUnits: area.sourceUnits,
        translatedUnits: area.translatedUnits,
        percent: area.percent
      })),
      slicePathWarnings
    }, null, 2));
    return;
  }
  console.log(`Translation units: ${summary.translatedUnits}/${summary.sourceUnits} (${summary.percentByPathParity}%)`);
  if (slicePathWarnings.length > 0) {
    console.log(`Slice path warnings: ${slicePathWarnings.length}`);
  }
  console.log(`Wrote ${slash(relative(repoRoot, join(webRoot, "TRANSLATION_STATUS.md")))}`);
  console.log(`Wrote ${slash(relative(repoRoot, join(webRoot, "translation-status.json")))}`);
}

await main();
