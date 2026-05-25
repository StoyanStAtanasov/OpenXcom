import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, rm, writeFile } from "node:fs/promises";
import http from "node:http";
import { dirname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const webRoot = normalize(join(dirname(fileURLToPath(import.meta.url)), ".."));
const repoRoot = normalize(join(webRoot, ".."));
const outputRoot = join(repoRoot, "output", "playwright");
const verifierPath = join(outputRoot, "verify-adlib-music-player.js");
const session = "openxcom-adlib-music-player";
const url = "http://127.0.0.1:4173/web/index.html";

const verifier = String.raw`async page => {
  await page.goto("http://127.0.0.1:4173/web/index.html");
  await page.waitForFunction(() => document.readyState === "complete");
  await page.mouse.click(8, 8);

  const result = await page.evaluate(async () => {
    const [
      { Mod },
      { RuleMusic },
      { CatFile },
      { AdlibMusic },
      { Music },
      optionsModule
    ] = await Promise.all([
      import("/web/dist/Mod/Mod.js"),
      import("/web/dist/Mod/RuleMusic.js"),
      import("/web/dist/Engine/CatFile.js"),
      import("/web/dist/Engine/AdlibMusic.js"),
      import("/web/dist/Engine/Music.js"),
      import("/web/dist/Engine/Options.js")
    ]);
    const { Options, MUSIC_ADLIB } = optionsModule;
    const oldPreferred = Options.preferredMusic;
    const oldMute = Options.mute;
    const oldVolume = Options.musicVolume;
    const oldLoop = Options.musicAlwaysLoop;
    try {
      Options.preferredMusic = MUSIC_ADLIB;
      Options.mute = false;
      Options.musicVolume = 96;
      Options.musicAlwaysLoop = false;

      const mod = new Mod();
      const rule = new RuleMusic("ADLIBTEST");
      rule.load({ type: "ADLIBTEST", catPos: 0, normalization: 0.76 });
      mod.manifest = {
        ufoSoundDir: "XCOM/SOUND",
        ufoSoundFiles: ["XCOM/SOUND/ADLIB.CAT"]
      };
      mod.musicDefs.set("ADLIBTEST", rule);
      await mod.loadMusicResources();
      const loaded = mod.musics.get("ADLIBTEST");
      if (!(loaded instanceof AdlibMusic)) {
        throw new Error("MUSIC_ADLIB did not load an AdlibMusic instance");
      }
      if (!loaded.play(0)) {
        throw new Error("AdlibMusic.play() did not install the translated player");
      }

      let nonZero = 0;
      let peak = 0;
      for (let chunk = 0; chunk < 80 && nonZero === 0; ++chunk) {
        const stream = new Int16Array(2048 * 2);
        AdlibMusic.player(loaded, stream, stream.length * 2);
        for (const sample of stream) {
          const abs = Math.abs(sample);
          if (abs) {
            nonZero += 1;
            if (abs > peak) {
              peak = abs;
            }
          }
        }
      }
      Music.stop();
      if (nonZero === 0 || peak === 0) {
        throw new Error("Translated YM3812 mixer produced only silence");
      }

      const cat = new CatFile("../XCOM/SOUND/ADLIB.CAT");
      return {
        catTracks: cat.getAmount(),
        loadedClass: loaded.constructor.name,
        nonZero,
        peak
      };
    } finally {
      Music.stop();
      Options.preferredMusic = oldPreferred;
      Options.mute = oldMute;
      Options.musicVolume = oldVolume;
      Options.musicAlwaysLoop = oldLoop;
    }
  });

  await page.evaluate(value => {
    console.log("VERIFY_ADLIB_MUSIC_PLAYER ok " + JSON.stringify(value));
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
  line("VERIFY_ADLIB_MUSIC_PLAYER");
  await run("build", process.execPath, [join(webRoot, "scripts", "build.mjs")]);
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
    if (!consoleResult.stdout.includes("VERIFY_ADLIB_MUSIC_PLAYER ok") ||
      consoleResult.stdout.includes("AdlibMusic browser boundary") ||
      consoleResult.stdout.includes("[ERROR]")) {
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
  line("VERIFY_ADLIB_MUSIC_PLAYER ok");
}

await main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
