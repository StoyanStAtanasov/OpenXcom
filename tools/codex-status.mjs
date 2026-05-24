import { createReadStream } from "node:fs";
import { readdir, readFile, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, join } from "node:path";
import { createInterface } from "node:readline";

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

const codexHome = args.get("--codex-home") || process.env.CODEX_HOME || join(homedir(), ".codex");
const jsonOutput = args.has("--json");

async function walk(dir) {
  const result = [];
  let entries = [];
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return result;
  }
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      result.push(...await walk(path));
    } else if (entry.isFile() && entry.name.endsWith(".jsonl")) {
      result.push(path);
    }
  }
  return result;
}

async function latestHistorySession() {
  const historyPath = join(codexHome, "history.jsonl");
  let text = "";
  try {
    text = await readFile(historyPath, "utf8");
  } catch {
    return null;
  }
  let sessionId = null;
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) {
      continue;
    }
    try {
      const event = JSON.parse(line);
      if (typeof event.session_id === "string") {
        sessionId = event.session_id;
      }
    } catch {
      // Ignore incomplete history lines.
    }
  }
  return sessionId;
}

async function selectSessionFile(sessionId) {
  const files = await walk(join(codexHome, "sessions"));
  const candidates = sessionId ? files.filter(file => basename(file).includes(sessionId)) : files;
  const stats = [];
  for (const file of candidates) {
    try {
      stats.push({ file, stat: await stat(file) });
    } catch {
      // The session writer may rotate files while we scan.
    }
  }
  stats.sort((a, b) => b.stat.mtimeMs - a.stat.mtimeMs);
  return stats[0]?.file || null;
}

async function parseSession(file) {
  const rl = createInterface({
    input: createReadStream(file, { encoding: "utf8" }),
    crlfDelay: Infinity
  });

  let sessionMeta = null;
  let turnContext = null;
  let tokenEvent = null;

  for await (const line of rl) {
    if (!line.trim()) {
      continue;
    }
    let event = null;
    try {
      event = JSON.parse(line);
    } catch {
      continue;
    }
    if (event.type === "session_meta") {
      sessionMeta = event.payload;
    } else if (event.type === "turn_context") {
      turnContext = event.payload;
    } else if (event.type === "event_msg" && event.payload?.type === "token_count") {
      tokenEvent = {
        timestamp: event.timestamp,
        info: event.payload.info,
        rate_limits: event.payload.rate_limits
      };
    }
  }

  return { file, sessionMeta, turnContext, tokenEvent };
}

function formatTimestamp(value) {
  if (value == null) {
    return "unknown";
  }
  const date = typeof value === "number" ? new Date(value * 1000) : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "unknown";
  }
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function formatTokens(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "unknown";
  }
  return new Intl.NumberFormat().format(value);
}

function formatLimit(label, limit) {
  if (!limit) {
    return `${label}: unavailable`;
  }
  const used = Number(limit.used_percent);
  const left = Number.isFinite(used) ? Math.max(0, Math.round((100 - used) * 10) / 10) : null;
  const windowText = limit.window_minutes === 300 ? "5h" : (limit.window_minutes === 10080 ? "weekly" : `${limit.window_minutes}m`);
  const leftText = left == null ? "unknown" : `${left}% left`;
  const usedText = Number.isFinite(used) ? `${used}% used` : "unknown used";
  return `${label} (${windowText}): ${leftText}, ${usedText}, resets ${formatTimestamp(limit.resets_at)}`;
}

async function main() {
  const requestedSession = args.get("--session");
  const sessionId = requestedSession || await latestHistorySession();
  const file = await selectSessionFile(sessionId);
  if (!file) {
    throw new Error(`No Codex session JSONL found under ${join(codexHome, "sessions")}`);
  }

  const parsed = await parseSession(file);
  const tokenEvent = parsed.tokenEvent;
  if (!tokenEvent) {
    throw new Error(`No token_count event found in ${file}`);
  }

  const output = {
    source: file,
    session_id: parsed.sessionMeta?.id || sessionId || null,
    cwd: parsed.turnContext?.cwd || parsed.sessionMeta?.cwd || null,
    model: parsed.turnContext?.model || null,
    reasoning_effort: parsed.turnContext?.effort || null,
    last_event_at: tokenEvent.timestamp,
    model_context_window: tokenEvent.info?.model_context_window || null,
    total_token_usage: tokenEvent.info?.total_token_usage || null,
    last_token_usage: tokenEvent.info?.last_token_usage || null,
    rate_limits: tokenEvent.rate_limits || null
  };

  if (jsonOutput) {
    console.log(JSON.stringify(output, null, 2));
    return;
  }

  console.log("Codex local status");
  console.log(`source: ${output.source}`);
  console.log(`session: ${output.session_id || "unknown"}`);
  console.log(`model: ${output.model || "unknown"}${output.reasoning_effort ? ` (${output.reasoning_effort})` : ""}`);
  console.log(`cwd: ${output.cwd || "unknown"}`);
  console.log(`last token event: ${formatTimestamp(output.last_event_at)}`);
  console.log(`context window: ${formatTokens(output.last_token_usage?.input_tokens)} latest input tokens / ${formatTokens(output.model_context_window)}`);
  console.log(`total session tokens: ${formatTokens(output.total_token_usage?.total_tokens)}`);
  console.log(formatLimit("primary limit", output.rate_limits?.primary));
  console.log(formatLimit("weekly limit", output.rate_limits?.secondary));
  if (output.rate_limits?.credits == null) {
    console.log("credits: not reported in local token_count event");
  } else {
    console.log(`credits: ${JSON.stringify(output.rate_limits.credits)}`);
  }
  if (output.rate_limits?.rate_limit_reached_type) {
    console.log(`limit reached: ${output.rate_limits.rate_limit_reached_type}`);
  }
}

main().catch(error => {
  console.error(error.message);
  process.exit(1);
});
