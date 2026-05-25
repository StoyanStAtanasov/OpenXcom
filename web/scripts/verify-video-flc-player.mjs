import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { mkdir, rm, writeFile } from "node:fs/promises";
import http from "node:http";
import { dirname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const webRoot = normalize(join(dirname(fileURLToPath(import.meta.url)), ".."));
const repoRoot = normalize(join(webRoot, ".."));
const outputRoot = join(repoRoot, "output", "playwright");
const verifierPath = join(outputRoot, "verify-video-flc-player.js");
const session = "openxcom-video-flc-player";
const url = "http://127.0.0.1:4173/web/index.html";

const verifier = String.raw`async page => {
  await page.goto("http://127.0.0.1:4173/web/index.html");
  await page.waitForFunction(() => document.readyState === "complete");
  await page.waitForFunction(async () => {
    if (!window.openxcomGame?.getMod?.()) {
      return false;
    }
    const { getFilePath } = await import("/web/dist/Engine/FileMap.js");
    return getFilePath("UFOINTRO/UFOINT.FLI") !== "UFOINTRO/UFOINT.FLI";
  });

  const result = await page.evaluate(async () => {
    const [{ FlcPlayer }, { getFilePath }, { Options }] = await Promise.all([
      import("/web/dist/Engine/FlcPlayer.js"),
      import("/web/dist/Engine/FileMap.js"),
      import("/web/dist/Engine/Options.js")
    ]);

    const game = window.openxcomGame;
    const oldMute = Options.mute;
    Options.mute = true;
    const filename = getFilePath("UFOINTRO/UFOINT.FLI");
    if (filename === "UFOINTRO/UFOINT.FLI") {
      throw new Error("FileMap did not resolve the original UFOINT.FLI resource");
    }

    const player = new FlcPlayer();
    const initialized = player.init(filename, null, game, false, 0, 0);
    if (!initialized) {
      throw new Error("FlcPlayer did not initialize the source UFOINT.FLI file");
    }
    player.play(false);

    let ticks = 0;
    while (player.isPlaying() && player.getFrameCount() < 5 && ticks < 120) {
      player.tick(8);
      await new Promise(resolve => setTimeout(resolve, 16));
      ++ticks;
    }

    const mainScreen = player._mainScreen;
    if (!mainScreen) {
      throw new Error("FlcPlayer did not allocate its indexed playback surface");
    }
    const pixels = mainScreen.getPixels();
    let nonzero = 0;
    for (const pixel of pixels) {
      if (pixel !== 0) {
        ++nonzero;
      }
    }
    const palette = mainScreen.getPalette();
    const paletteChanged = palette.some(color => color.r !== 0 || color.g !== 0 || color.b !== 0);
    const frameCount = player.getFrameCount();
    player.deInit();
    Options.mute = oldMute;

    if (frameCount < 5) {
      throw new Error("FlcPlayer did not decode multiple source FLI frames; decoded " + frameCount);
    }
    if (nonzero < 1000) {
      throw new Error("FlcPlayer decoded too few indexed pixels from source FLI: " + nonzero);
    }
    if (!paletteChanged) {
      throw new Error("FlcPlayer did not apply source FLI palette chunks");
    }

    return { filename, frameCount, nonzero, paletteChanged };
  });

  await page.evaluate(value => {
    console.log("VERIFY_VIDEO_FLC_PLAYER ok " + JSON.stringify(value));
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
  line("VERIFY_VIDEO_FLC_PLAYER");
  const videoStateSource = readFileSync(join(webRoot, "src", "Menu", "VideoState.ts"), "utf8");
  const flcSource = readFileSync(join(webRoot, "src", "Engine", "FlcPlayer.ts"), "utf8");
  if (videoStateSource.includes("FlcPlayer browser boundary") || flcSource.includes("FLI/FLC playback is not implemented")) {
    throw new Error("Video/FLC source still contains the old browser-boundary marker");
  }

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
    if (!consoleResult.stdout.includes("VERIFY_VIDEO_FLC_PLAYER ok") ||
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
  line("VERIFY_VIDEO_FLC_PLAYER ok");
}

await main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
