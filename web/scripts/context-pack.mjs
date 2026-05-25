import { execFile } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const webRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = join(webRoot, "..");

const args = new Map();
for (let i = 2; i < process.argv.length; ++i) {
  const arg = process.argv[i];
  if (arg.startsWith("--")) {
    const next = process.argv[i + 1];
    if (next && !next.startsWith("--")) {
      args.set(arg, next);
      ++i;
    } else {
      args.set(arg, true);
    }
  }
}

const requestedRole = String(args.get("--role") || "resume").toLowerCase();
const role = requestedRole === "read-only" ? "readonly" : requestedRole;
const verbose = args.has("--verbose");

function slash(path) {
  return path.replaceAll("\\", "/");
}

function bulletList(items, empty = "none") {
  return items.length === 0 ? empty : items.map(item => `- ${item}`).join("\n");
}

function tableCell(value) {
  return String(value ?? "")
    .replaceAll("|", "\\|")
    .replace(/\r?\n/g, " ")
    .trim();
}

function verificationMarkers(text) {
  return [...new Set((text || "").match(/\bVERIFY_[A-Z0-9_]+\b/g) || [])];
}

function fileSummary(files, limit) {
  if (files.length === 0) {
    return "none";
  }
  if (files.length <= limit) {
    return files.join("; ");
  }
  return `${files.slice(0, limit).join("; ")}; ... (${files.length - limit} more in web/context-packet.json)`;
}

function roleConfig() {
  switch (role) {
    case "readonly":
      return {
        name: "readonly",
        fileLimit: 8,
        includeActiveFiles: false,
        includeQueue: true,
        promptPurpose: "read-only sidecar"
      };
    case "worker":
      return {
        name: "worker",
        fileLimit: 1000,
        includeActiveFiles: true,
        includeQueue: false,
        promptPurpose: "bounded worker"
      };
    case "resume":
    default:
      return {
        name: "resume",
        fileLimit: 14,
        includeActiveFiles: true,
        includeQueue: true,
        promptPurpose: "resume"
      };
  }
}

function compactSlice(slice) {
  if (!slice) {
    return null;
  }
  const verification = slice.verification || "";
  return {
    name: slice.name,
    area: slice.area,
    status: slice.status,
    slicePercent: slice.slicePercent,
    nextAction: slice.nextAction || slice.boundaries?.[0] || "review and integrate",
    sourceFiles: slice.sourceFiles || [],
    targetFiles: slice.targetFiles || [],
    verification,
    verificationMarkers: verificationMarkers(verification),
    boundaries: slice.boundaries || []
  };
}

async function refreshStatus() {
  if (args.has("--no-refresh")) {
    return;
  }
  await execFileAsync(process.execPath, [join(webRoot, "scripts", "translation-status.mjs")], {
    cwd: webRoot,
    windowsHide: true,
    maxBuffer: 1024 * 1024
  });
}

async function readCodexStatus() {
  try {
    const { stdout } = await execFileAsync(process.execPath, [join(repoRoot, "tools", "codex-status.mjs"), "--json"], {
      cwd: repoRoot,
      windowsHide: true,
      maxBuffer: 1024 * 1024
    });
    const status = JSON.parse(stdout);
    const inputTokens = status.last_token_usage?.input_tokens ?? null;
    const contextWindow = status.model_context_window ?? null;
    const contextLeftPercent = typeof inputTokens === "number" && typeof contextWindow === "number" && contextWindow > 0
      ? Math.max(0, Math.round((100 - inputTokens / contextWindow * 100) * 10) / 10)
      : null;
    return {
      available: true,
      sessionId: status.session_id || null,
      model: status.model || null,
      reasoningEffort: status.reasoning_effort || null,
      lastEventAt: status.last_event_at || null,
      latestInputTokens: inputTokens,
      contextWindow,
      contextLeftPercent,
      primaryLimit: status.rate_limits?.primary || null,
      weeklyLimit: status.rate_limits?.secondary || null,
      creditsReported: status.rate_limits?.credits != null
    };
  } catch (error) {
    return {
      available: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

function selectActiveSlice(slices) {
  const requested = args.get("--slice");
  if (requested) {
    const found = slices.find(slice => slice.name.toLowerCase() === requested.toLowerCase());
    if (found) {
      return found;
    }
    const names = slices.map(slice => slice.name).sort((a, b) => a.localeCompare(b));
    throw new Error(`Unknown slice "${requested}". Available slices: ${names.join("; ")}`);
  }
  return slices.find(slice => slice.status === "partial-integrated-verified")
    || slices.find(slice => slice.status !== "integrated-verified")
    || slices[0]
    || null;
}

function buildReadonlyPrompt(active) {
  if (!active) {
    return "Read-only sidecar: inspect only the exact files assigned by the main agent. Return summary-first findings, risks, and recommended next checks. Do not edit files.";
  }
  return [
    `Read-only sidecar for OpenXcom TS port slice "${active.name}" (${active.slicePercent}%).`,
    "Do not edit files.",
    "Inspect only the exact file list provided by the main agent plus this context packet.",
    `Next action: ${active.nextAction}.`,
    `Boundaries: ${active.boundaries.join("; ") || "none"}.`,
    "Return summary-first: files inspected, source facts, risks, recommended integration/verifier checks."
  ].join("\n");
}

function buildWorkerPrompt(active) {
  if (!active) {
    return "Worker: translate the explicitly assigned C++ files into the explicitly assigned TypeScript files. Do not touch unassigned files. Preserve source ids/control flow and return changed files, verification, and boundaries.";
  }
  return [
    `Worker for OpenXcom TS port slice "${active.name}" (${active.slicePercent}%).`,
    "You are not alone in the codebase; do not revert edits by others.",
    `Source files: ${active.sourceFiles.join("; ") || "assigned separately"}.`,
    `Target files/write scope: ${active.targetFiles.join("; ") || "assigned separately"}.`,
    "Forbidden unless explicitly assigned: AGENTS.md, web/PORTING.md, web/translation-slices.json, hot shared integration files.",
    "Translate directly from C++: preserve class names, ids, coordinates, resource names, algorithms, and state-stack behavior.",
    `Next action: ${active.nextAction}.`,
    `Boundaries to keep explicit: ${active.boundaries.join("; ") || "none"}.`,
    "Final format: changed files; build/typecheck/verifier result; pending source boundaries; risks/integration notes."
  ].join("\n");
}

async function main() {
  await refreshStatus();

  const config = roleConfig();
  const status = JSON.parse(await readFile(join(webRoot, "translation-status.json"), "utf8"));
  const slices = JSON.parse(await readFile(join(webRoot, "translation-slices.json"), "utf8"));
  const activeSlice = selectActiveSlice(slices);
  const activeSlices = slices.filter(slice => slice.status !== "integrated-verified");
  const codexStatus = await readCodexStatus();

  const packet = {
    generatedAt: new Date().toISOString(),
    role: config.name,
    objective: "Faithfully translate OpenXcom C++ source into the browser TypeScript port.",
    sourceOfTruth: {
      cpp: "src/**/*.cpp and src/**/*.h",
      typescript: "web/src/**/*.ts",
      policy: "AGENTS.md",
      skill: "C:/Users/stoia/.codex/skills/openxcom-ts-port/SKILL.md",
      structuredSlices: "web/translation-slices.json",
      generatedStatus: "web/translation-status.json and web/TRANSLATION_STATUS.md"
    },
    progress: {
      pathParity: `${status.summary.translatedUnits}/${status.summary.sourceUnits} (${status.summary.percentByPathParity}%)`,
      sourceCodeFiles: status.summary.sourceCodeFiles,
      targetTsFiles: status.summary.targetTsFiles,
      trackedSlices: status.summary.trackedSlices,
      integratedVerifiedSlices: status.summary.integratedVerifiedSlices,
      slicePathWarnings: status.summary.slicePathWarnings,
      statusRollups: status.statusRollups
    },
    observability: {
      codexStatus
    },
    activeSlice: compactSlice(activeSlice),
    integrationQueue: activeSlices.map(compactSlice),
    hotFilesRequireExplicitOwnership: [
      "AGENTS.md",
      "web/PORTING.md",
      "web/translation-slices.json",
      "web/src/Geoscape/GeoscapeState.ts",
      "web/src/Basescape/BasescapeState.ts",
      "web/src/Savegame/SavedGame.ts",
      "shared model/rules files touched by an active integration slice"
    ],
    recommendedCommands: {
      context: "cd web; npm run context",
      contextReadonly: "cd web; npm run context:readonly",
      contextWorker: "cd web; npm run context:worker",
      status: "cd web; npm run status",
      statusJson: "cd web; npm run status -- --json",
      build: "cd web; npm run build",
      typecheck: "cd web; npm run typecheck",
      codexStatus: "cd web; npm run codex:status",
      orchestrator: "cd web; npm run orchestrator",
      agentLedger: "cd web; npm run agents",
      agentPrompt: "cd web; npm run agents:prompt -- --role readonly --task \"...\" --scope \"src/Foo.cpp; web/src/Foo.ts\"",
      codexStatusRepoRoot: "node tools/codex-status.mjs"
    },
    subagentHandoffSchema: {
      include: [
        "objective",
        "slice name/status/percent",
        "exact source files",
        "exact target files or read-only file list",
        "forbidden files",
        "nextAction and boundaries",
        "verification command or expected VERIFY_* marker",
        "summary-first final format"
      ],
      finalFormat: [
        "changed files or read-only files inspected",
        "build/typecheck/verifier result, if run",
        "pending source boundaries",
        "risks or integration notes"
      ]
    },
    mainAgentRules: [
      "Read this packet before long docs after compaction or resume.",
      "Give subagents only the slice packet plus exact scope; avoid forking full context unless truly needed.",
      "Record active subagent scopes with npm run agents:start before spawning and npm run agents:close after completion.",
      "Keep integration, merge, and shared model decisions local to the main agent.",
      "Regenerate this packet after changing translation-slices.json or finishing a verified micro-path."
    ],
    promptSkeletons: {
      readonly: buildReadonlyPrompt(compactSlice(activeSlice)),
      worker: buildWorkerPrompt(compactSlice(activeSlice))
    }
  };

  await writeFile(join(webRoot, "context-packet.json"), `${JSON.stringify(packet, null, 2)}\n`, "utf8");

  const active = packet.activeSlice;
  const md = [];
  md.push("# OpenXcom TS Port Context Packet");
  md.push("");
  md.push(`Generated: ${packet.generatedAt}`);
  md.push(`Role: ${packet.role}`);
  md.push("");
  md.push("This is the compact handoff surface for resumed turns and subagents. Regenerate it with `npm run context` instead of rereading long narrative docs.");
  md.push("");
  md.push("## Snapshot");
  md.push("");
  md.push(`- Objective: ${packet.objective}`);
  md.push(`- Path parity: ${packet.progress.pathParity}`);
  md.push(`- Tracked slices: ${packet.progress.trackedSlices}`);
  md.push(`- Integrated verified slices: ${packet.progress.integratedVerifiedSlices}`);
  md.push(`- Slice path warnings: ${packet.progress.slicePathWarnings}`);
  md.push(`- Status rollup: ${Object.entries(packet.progress.statusRollups).map(([statusName, count]) => `${statusName}=${count}`).join(", ")}`);
  if (packet.observability.codexStatus.available) {
    const localStatus = packet.observability.codexStatus;
    const modelText = `${localStatus.model || "unknown"}${localStatus.reasoningEffort ? ` (${localStatus.reasoningEffort})` : ""}`;
    const contextText = localStatus.contextLeftPercent == null
      ? "unknown"
      : `${localStatus.contextLeftPercent}% left (${localStatus.latestInputTokens}/${localStatus.contextWindow} latest input tokens)`;
    md.push(`- Local Codex status: ${modelText}; context ${contextText}; credits ${localStatus.creditsReported ? "reported" : "not reported locally"}`);
  } else {
    md.push(`- Local Codex status: unavailable (${packet.observability.codexStatus.error})`);
  }
  md.push("");
  md.push("## Active Slice");
  md.push("");
  if (active) {
    md.push(`- Name: ${active.name}`);
    md.push(`- Area: ${active.area}`);
    md.push(`- Status: ${active.status}`);
    md.push(`- Slice percent: ${active.slicePercent}%`);
    md.push(`- Next action: ${active.nextAction}`);
    const markerText = active.verificationMarkers.length ? active.verificationMarkers.join(", ") : "none";
    md.push(`- Verification markers: ${markerText}`);
    if (verbose) {
      md.push(`- Verification details: ${active.verification}`);
    }
    md.push("");
    md.push("Boundaries:");
    md.push(bulletList(active.boundaries));
    md.push("");
    if (config.includeActiveFiles) {
      md.push(`Source files (${active.sourceFiles.length}): ${fileSummary(active.sourceFiles, config.fileLimit)}`);
      md.push("");
      md.push(`Target files (${active.targetFiles.length}): ${fileSummary(active.targetFiles, config.fileLimit)}`);
    } else {
      md.push("Source/target file lists are omitted from Markdown in readonly mode; use `web/context-packet.json` or pass an exact file list in the sidecar prompt.");
    }
  } else {
    md.push("- No active slice found.");
  }
  md.push("");
  if (config.includeQueue) {
    md.push("## Integration Queue");
    md.push("");
    md.push("| Slice | Area | Status | % | Next action |");
    md.push("| --- | --- | --- | ---: | --- |");
    for (const item of packet.integrationQueue) {
      md.push(`| ${tableCell(item.name)} | ${tableCell(item.area)} | ${tableCell(item.status)} | ${item.slicePercent}% | ${tableCell(item.nextAction)} |`);
    }
    md.push("");
  }
  md.push("## Subagent Packet");
  md.push("");
  md.push("For read-only sidecars, pass only this packet plus the exact file list. For workers, pass the exact source files, target files, forbidden files, and final format below.");
  md.push("");
  md.push("Forbidden unless explicitly assigned:");
  md.push(bulletList(packet.hotFilesRequireExplicitOwnership));
  md.push("");
  md.push("Worker final format:");
  md.push(bulletList(packet.subagentHandoffSchema.finalFormat));
  md.push("");
  md.push("Prompt skeletons:");
  md.push("");
  md.push("```text");
  md.push(config.name === "worker" ? packet.promptSkeletons.worker : packet.promptSkeletons.readonly);
  md.push("```");
  md.push("");
  md.push("## Commands");
  md.push("");
  for (const [name, command] of Object.entries(packet.recommendedCommands)) {
    md.push(`- ${name}: \`${command}\``);
  }
  md.push("");

  await writeFile(join(webRoot, "CONTEXT_PACKET.md"), `${md.join("\n")}\n`, "utf8");

  if (args.has("--json")) {
    console.log(JSON.stringify(packet, null, 2));
    return;
  }

  console.log(`Context packet active slice: ${active?.name || "none"} (${active?.slicePercent ?? 0}%, role ${config.name})`);
  console.log(`Wrote ${slash(relative(repoRoot, join(webRoot, "CONTEXT_PACKET.md")))}`);
  console.log(`Wrote ${slash(relative(repoRoot, join(webRoot, "context-packet.json")))}`);
}

await main();
