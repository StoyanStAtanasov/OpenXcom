import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const webRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = join(webRoot, "..");
const ledgerPath = join(webRoot, "agent-ledger.json");
const contextPacketPath = join(webRoot, "context-packet.json");

const hotFiles = [
  "AGENTS.md",
  "web/PORTING.md",
  "web/translation-slices.json",
  "web/src/Geoscape/GeoscapeState.ts",
  "web/src/Basescape/BasescapeState.ts",
  "web/src/Savegame/SavedGame.ts"
];

function parseArgs(argv) {
  const command = argv[0] || "list";
  const args = new Map();
  for (let i = 1; i < argv.length; ++i) {
    const arg = argv[i];
    if (!arg.startsWith("--")) {
      const rest = args.get("_") || [];
      rest.push(arg);
      args.set("_", rest);
      continue;
    }
    const next = argv[i + 1];
    const value = next && !next.startsWith("--") ? next : true;
    if (value !== true) {
      ++i;
    }
    const prior = args.get(arg);
    if (prior === undefined) {
      args.set(arg, value);
    } else if (Array.isArray(prior)) {
      prior.push(value);
    } else {
      args.set(arg, [prior, value]);
    }
  }
  return { command, args };
}

function arg(args, name, fallback = "") {
  const value = args.get(name);
  if (Array.isArray(value)) {
    return String(value.at(-1));
  }
  if (value === true || value === undefined) {
    return fallback;
  }
  return String(value);
}

function argList(args, name) {
  const value = args.get(name);
  const values = Array.isArray(value) ? value : value === undefined || value === true ? [] : [value];
  return values
    .flatMap(item => String(item).split(/[;,]/))
    .map(item => normalizeScope(item))
    .filter(Boolean);
}

function slash(path) {
  return path.replaceAll("\\", "/");
}

function normalizeScope(value) {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }
  const normalized = slash(trimmed).replace(/^\.\/+/, "").replace(/\/+$/, "");
  return process.platform === "win32" ? normalized.toLowerCase() : normalized;
}

function oneLine(value, fallback = "") {
  return String(value || fallback).replace(/\s+/g, " ").trim();
}

async function loadJson(path, fallback) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch {
    return fallback;
  }
}

async function loadLedger() {
  const ledger = await loadJson(ledgerPath, { agents: [] });
  return {
    agents: Array.isArray(ledger.agents) ? ledger.agents : []
  };
}

async function saveLedger(ledger) {
  await mkdir(dirname(ledgerPath), { recursive: true });
  await writeFile(ledgerPath, `${JSON.stringify(ledger, null, 2)}\n`, "utf8");
}

function activeAgents(ledger) {
  return ledger.agents.filter(agent => agent.status === "active");
}

function scopesOverlap(left, right) {
  if (!left || !right) {
    return false;
  }
  if (left === right) {
    return true;
  }
  return left.startsWith(`${right}/`) || right.startsWith(`${left}/`);
}

function findOverlaps(ledger, entry) {
  const overlaps = [];
  for (const agent of activeAgents(ledger)) {
    if (agent.id === entry.id) {
      continue;
    }
    for (const left of entry.scope) {
      for (const right of agent.scope || []) {
        if (scopesOverlap(left, right)) {
          overlaps.push({ agent, left, right });
        }
      }
    }
  }
  return overlaps;
}

function usage() {
  return [
    "Usage:",
    "  node scripts/agent-ledger.mjs list",
    "  node scripts/agent-ledger.mjs prompt --role readonly --task \"...\" --scope \"src/A.cpp; web/src/A.ts\"",
    "  node scripts/agent-ledger.mjs start --id <agent-id> --nickname <name> --role readonly --task \"...\" --scope \"path;path\"",
    "  node scripts/agent-ledger.mjs close --id <agent-id> --status completed --note \"...\"",
    "",
    "Use repeated --scope, --source, --target, or semicolon-separated values for compact prompts."
  ].join("\n");
}

function printAgents(ledger) {
  const agents = activeAgents(ledger);
  if (agents.length === 0) {
    console.log("Active agents: 0");
    return;
  }
  console.log(`Active agents: ${agents.length}`);
  for (const agent of agents) {
    const scope = (agent.scope || []).join("; ") || "none";
    console.log(`- ${agent.id}${agent.nickname ? ` (${agent.nickname})` : ""}: ${agent.role}; ${oneLine(agent.task, "no task")}; scope: ${scope}`);
  }
}

async function buildPrompt(args) {
  const packet = await loadJson(contextPacketPath, null);
  const active = packet?.activeSlice;
  const role = arg(args, "--role", "readonly").toLowerCase();
  const task = oneLine(arg(args, "--task", active?.nextAction || "inspect assigned files"));
  const scope = argList(args, "--scope");
  const sourceFiles = argList(args, "--source");
  const targetFiles = argList(args, "--target");
  const forbidden = [...new Set([...hotFiles, ...argList(args, "--forbidden")])];
  const sliceLine = active
    ? `Slice: ${active.name} (${active.status}, ${active.slicePercent}%).`
    : "Slice: assigned by main agent.";
  const boundaries = active?.boundaries?.length ? active.boundaries.join("; ") : "none";
  const markers = active?.verificationMarkers?.length ? active.verificationMarkers.join(", ") : "assigned by main agent";

  const lines = [
    `${role === "worker" ? "Worker" : "Read-only sidecar"} for OpenXcom TS port.`,
    "Use the C++ source as authority and do not revert edits by others.",
    "Context source: web/CONTEXT_PACKET.md and web/context-packet.json.",
    sliceLine,
    `Task: ${task}.`
  ];

  if (role === "worker") {
    lines.push(`Source files: ${(sourceFiles.length ? sourceFiles : scope).join("; ") || "assigned separately"}.`);
    lines.push(`Target/write scope: ${(targetFiles.length ? targetFiles : scope).join("; ") || "assigned separately"}.`);
    lines.push("Edit only the assigned target/write scope.");
  } else {
    lines.push("Do not edit files.");
    lines.push(`Inspect only: ${scope.join("; ") || "the exact file list assigned by the main agent"}.`);
  }

  lines.push(`Forbidden unless explicitly assigned: ${forbidden.join("; ")}.`);
  lines.push(`Boundaries to keep explicit: ${boundaries}.`);
  lines.push(`Expected verification marker or command: ${markers}.`);
  lines.push("Final format: files inspected/changed; build/typecheck/verifier result if run; pending source boundaries; risks or integration notes.");
  return lines.join("\n");
}

async function startAgent(ledger, args) {
  const id = oneLine(arg(args, "--id"));
  if (!id) {
    throw new Error("start requires --id <agent-id>");
  }
  const entry = {
    id,
    nickname: oneLine(arg(args, "--nickname")),
    role: oneLine(arg(args, "--role", "readonly")),
    model: oneLine(arg(args, "--model")),
    effort: oneLine(arg(args, "--effort")),
    task: oneLine(arg(args, "--task", "assigned task")),
    scope: argList(args, "--scope"),
    forbidden: [...new Set([...hotFiles, ...argList(args, "--forbidden")])],
    status: "active",
    startedAt: new Date().toISOString()
  };

  const overlaps = findOverlaps(ledger, entry);
  if (overlaps.length > 0 && !args.has("--allow-overlap")) {
    const lines = overlaps.map(overlap => `${overlap.left} overlaps ${overlap.agent.id}:${overlap.right}`);
    throw new Error(`Refusing overlapping active assignment. Use --allow-overlap only after review.\n${lines.join("\n")}`);
  }

  ledger.agents = ledger.agents.filter(agent => !(agent.id === entry.id && agent.status === "active"));
  ledger.agents.push(entry);
  await saveLedger(ledger);
  console.log(`Recorded active agent ${entry.id}${entry.nickname ? ` (${entry.nickname})` : ""}`);
  printAgents(ledger);
}

async function closeAgent(ledger, args) {
  const id = oneLine(arg(args, "--id"));
  if (!id) {
    throw new Error("close requires --id <agent-id>");
  }
  const agent = [...ledger.agents].reverse().find(item => item.id === id && item.status === "active");
  if (!agent) {
    throw new Error(`No active agent found for ${id}`);
  }
  agent.status = oneLine(arg(args, "--status", "completed"));
  agent.closedAt = new Date().toISOString();
  agent.note = oneLine(arg(args, "--note"));
  await saveLedger(ledger);
  console.log(`Closed agent ${id} as ${agent.status}`);
  printAgents(ledger);
}

async function main() {
  const { command, args } = parseArgs(process.argv.slice(2));
  if (args.has("--help") || command === "help") {
    console.log(usage());
    return;
  }

  const ledger = await loadLedger();
  if (command === "list") {
    printAgents(ledger);
  } else if (command === "prompt") {
    console.log(await buildPrompt(args));
  } else if (command === "start") {
    await startAgent(ledger, args);
  } else if (command === "close") {
    await closeAgent(ledger, args);
  } else if (command === "path") {
    console.log(slash(relative(repoRoot, ledgerPath)));
  } else {
    throw new Error(`${usage()}\n\nUnknown command: ${command}`);
  }
}

main().catch(error => {
  console.error(error.message);
  process.exit(1);
});
