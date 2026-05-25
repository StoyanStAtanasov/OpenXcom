import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const webRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = join(webRoot, "..");
const jsonOutput = process.argv.includes("--json");

async function loadJson(path, fallback) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch {
    return fallback;
  }
}

async function refreshTranslationStatus() {
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
    return JSON.parse(stdout);
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
}

function selectActiveSlice(slices) {
  return slices.find(slice => slice.status === "partial-integrated-verified")
    || slices.find(slice => slice.status !== "integrated-verified")
    || slices[0]
    || null;
}

function formatLimit(limit) {
  if (!limit) {
    return "unavailable";
  }
  const used = Number(limit.used_percent);
  const left = Number.isFinite(used) ? `${Math.max(0, Math.round((100 - used) * 10) / 10)}% left` : "unknown";
  const reset = limit.resets_at ? new Date(limit.resets_at * 1000).toLocaleString() : "unknown reset";
  const window = limit.window_minutes === 300 ? "5h" : limit.window_minutes === 10080 ? "weekly" : `${limit.window_minutes}m`;
  return `${left} (${window}, resets ${reset})`;
}

function formatContext(codex) {
  const input = codex.last_token_usage?.input_tokens;
  const window = codex.model_context_window;
  if (typeof input !== "number" || typeof window !== "number" || window <= 0) {
    return "unknown";
  }
  const left = Math.max(0, Math.round((100 - input / window * 100) * 10) / 10);
  return `${left}% left (${input}/${window} latest input tokens)`;
}

async function main() {
  await refreshTranslationStatus();
  const status = await loadJson(join(webRoot, "translation-status.json"), null);
  const slices = await loadJson(join(webRoot, "translation-slices.json"), []);
  const ledger = await loadJson(join(webRoot, "agent-ledger.json"), { agents: [] });
  const codex = await readCodexStatus();
  const activeSlice = selectActiveSlice(slices);
  const activeAgents = (ledger.agents || []).filter(agent => agent.status === "active");

  const snapshot = {
    generatedAt: new Date().toISOString(),
    translation: status?.summary || null,
    statusRollups: status?.statusRollups || {},
    activeSlice,
    activeAgents,
    codex
  };

  if (jsonOutput) {
    console.log(JSON.stringify(snapshot, null, 2));
    return;
  }

  console.log("OpenXcom TS orchestrator");
  if (status?.summary) {
    const summary = status.summary;
    console.log(`translation: ${summary.translatedUnits}/${summary.sourceUnits} path parity (${summary.percentByPathParity}%), ${summary.integratedVerifiedSlices}/${summary.trackedSlices} slices integrated-verified`);
    console.log(`status rollup: ${Object.entries(status.statusRollups || {}).map(([name, count]) => `${name}=${count}`).join(", ") || "none"}`);
  }
  if (activeSlice) {
    console.log(`active slice: ${activeSlice.name} (${activeSlice.status}, ${activeSlice.slicePercent}%)`);
    console.log(`next action: ${activeSlice.nextAction || activeSlice.boundaries?.[0] || "review and integrate"}`);
  }
  console.log(`active agents: ${activeAgents.length}`);
  for (const agent of activeAgents) {
    console.log(`- ${agent.id}${agent.nickname ? ` (${agent.nickname})` : ""}: ${agent.role}; ${agent.task || "assigned task"}`);
  }
  if (codex.error) {
    console.log(`codex local status: unavailable (${codex.error})`);
  } else {
    const model = `${codex.model || "unknown"}${codex.reasoning_effort ? ` (${codex.reasoning_effort})` : ""}`;
    console.log(`codex: ${model}; context ${formatContext(codex)}`);
    console.log(`primary: ${formatLimit(codex.rate_limits?.primary)}`);
    console.log(`weekly: ${formatLimit(codex.rate_limits?.secondary)}`);
    console.log(`credits: ${codex.rate_limits?.credits == null ? "not reported locally" : JSON.stringify(codex.rate_limits.credits)}`);
  }
  console.log("commands: npm run context | npm run context:readonly | npm run agents | npm run codex:status");
}

await main();
