import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, rm, writeFile } from "node:fs/promises";
import http from "node:http";
import { dirname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const webRoot = normalize(join(dirname(fileURLToPath(import.meta.url)), ".."));
const repoRoot = normalize(join(webRoot, ".."));
const outputRoot = join(repoRoot, "output", "playwright");
const verifierPath = join(outputRoot, "verify-startup-browser.js");
const session = "openxcom-startup-browser";
const url = "http://127.0.0.1:4173/web/index.html";

const verifier = String.raw`async page => {
  await page.goto("http://127.0.0.1:4173/web/index.html");
  await page.waitForFunction(() => document.readyState === "complete");
  await page.waitForFunction(() => window.openxcomGame?.getCursor?.());

  const result = await page.evaluate(async () => {
    const [{ StartState }, { Options }] = await Promise.all([
      import("/web/dist/Menu/StartState.js"),
      import("/web/dist/Engine/Options.js")
    ]);

    const game = window.openxcomGame;
    const oldMute = Options.mute;
    const oldReload = Options.reload;
    const oldMusic = Options.preferredMusic;
    Options.mute = false;
    Options.reload = false;
    Options.preferredMusic = "digital";

    const state = new StartState();
    const cursorVisible = game.getCursor().getVisible();
    for (let i = 0; i < 10; ++i) {
      state.animate();
    }
    const output = state._output || "";

    Options.mute = oldMute;
    Options.reload = oldReload;
    Options.preferredMusic = oldMusic;

    if (!cursorVisible) {
      throw new Error("StartState should keep the translated cursor visible while the CSS native cursor is hidden");
    }
    for (const stale of ["DOS/4GW", "SoundBlaster", "Base Port 220", "Irq 7", "Dma 1"]) {
      if (output.includes(stale)) {
        throw new Error("Browser startup output still contains DOS-era loader text: " + stale);
      }
    }
    if (!output.includes("OpenXcom Browser Runtime") || !output.includes("WebAudio Sound Effects")) {
      throw new Error("Browser startup output did not use the browser-adapter loading text");
    }
    return {
      cursorVisible,
      hasBrowserRuntimeText: output.includes("OpenXcom Browser Runtime"),
      hasWebAudioText: output.includes("WebAudio Sound Effects")
    };
  });

  await page.evaluate(value => {
    console.log("VERIFY_STARTUP_BROWSER ok " + JSON.stringify(value));
  }, result);
}`;

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

async function main() {
  line("VERIFY_STARTUP_BROWSER");
  await run("build", process.execPath, [join(webRoot, "scripts", "build.mjs")]);
  await runNpm("typecheck", ["run", "typecheck"], webRoot);
  await mkdir(outputRoot, { recursive: true });
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
    if (!consoleResult.stdout.includes("VERIFY_STARTUP_BROWSER ok") ||
      consoleResult.stdout.includes("[ERROR]") ||
      consoleResult.stdout.includes("AudioContext was not allowed")) {
      throw new Error("Browser verifier marker missing or console error present\nRUN-CODE:\n" + runCodeResult.stdout + "\nCONSOLE:\n" + consoleResult.stdout);
    }
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
  line("VERIFY_STARTUP_BROWSER ok");
}

await main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
