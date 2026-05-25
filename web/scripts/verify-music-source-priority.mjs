import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, rm, writeFile } from "node:fs/promises";
import http from "node:http";
import { dirname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const webRoot = normalize(join(dirname(fileURLToPath(import.meta.url)), ".."));
const repoRoot = normalize(join(webRoot, ".."));
const outputRoot = join(repoRoot, "output", "playwright");
const verifierPath = join(outputRoot, "verify-music-source-priority.js");
const session = "openxcom-music-source-priority";
const url = "http://127.0.0.1:4173/web/index.html";

const verifier = String.raw`async page => {
  await page.goto("http://127.0.0.1:4173/web/index.html");
  await page.waitForFunction(() => document.readyState === "complete");
  await page.mouse.click(8, 8);

  const result = await page.evaluate(async () => {
    const [
      { Mod },
      { RuleMusic },
      optionsModule,
      { GMCatFile },
      { Music },
      { TimidityMidiBackend }
    ] = await Promise.all([
      import("/web/dist/Mod/Mod.js"),
      import("/web/dist/Mod/RuleMusic.js"),
      import("/web/dist/Engine/Options.js"),
      import("/web/dist/Engine/GMCat.js"),
      import("/web/dist/Engine/Music.js"),
      import("/web/dist/Engine/TimidityMidiBackend.js")
    ]);
    const { Options, MUSIC_AUTO, MUSIC_GM, MUSIC_MIDI } = optionsModule;
    const oldPreferred = Options.preferredMusic;
    Options.preferredMusic = MUSIC_AUTO;

    try {
      const mod = new Mod();
      const rule = new RuleMusic("GMSTORY");
      rule.load({ type: "GMSTORY", catPos: 12 });
      mod.manifest = {
        ufoSoundDir: "XCOM/SOUND",
        ufoSoundFiles: ["XCOM/SOUND/gmstory.ogg", "XCOM/SOUND/GMSTORY.MID", "XCOM/SOUND/GM.CAT"]
      };
      mod.musicDefs.set("GMSTORY", rule);
      await mod.loadMusicResources();

      const music = mod.musics.get("GMSTORY");
      if (!music) {
        throw new Error("No GMSTORY music loaded from source-priority fixture");
      }
      if (music.getSourceKind() !== "stream" || music.getMimeType() !== "audio/ogg") {
        throw new Error("Digital OGG should stream before GM/MIDI; got " + music.getSourceKind() + " " + music.getMimeType());
      }

      for (const preferred of [MUSIC_GM, MUSIC_MIDI]) {
        Options.preferredMusic = preferred;
        const preferredMod = new Mod();
        const preferredRule = new RuleMusic("GMSTORY");
        preferredRule.load({ type: "GMSTORY", catPos: 12 });
        preferredMod.manifest = {
          ufoSoundDir: "XCOM/SOUND",
          ufoSoundFiles: ["XCOM/SOUND/gmstory.ogg", "XCOM/SOUND/GMSTORY.MID", "XCOM/SOUND/GM.CAT"]
        };
        preferredMod.musicDefs.set("GMSTORY", preferredRule);
        await preferredMod.loadMusicResources();
        const preferredMusic = preferredMod.musics.get("GMSTORY");
        if (!preferredMusic || preferredMusic.getSourceKind() !== "stream" || preferredMusic.getMimeType() !== "audio/ogg") {
          throw new Error("Browser adapter should stream OGG before MIDI/GM fallback even for preferred " + preferred);
        }
      }

      const cat = new GMCatFile("../XCOM/SOUND/GM.CAT");
      const gmStory = cat.loadMIDI(12);
      const bytes = gmStory._music;
      if (!bytes || bytes.length < 64) {
        throw new Error("GM.CAT did not convert GMSTORY into MIDI bytes");
      }
      const u32 = pos => (bytes[pos] * 0x1000000) + (bytes[pos + 1] << 16) + (bytes[pos + 2] << 8) + bytes[pos + 3];
      const str = (pos, len) => String.fromCharCode(...bytes.subarray(pos, pos + len));
      let offset = 8 + u32(4);
      if (str(offset, 4) !== "MTrk") {
        throw new Error("Converted MIDI missing tempo track");
      }
      offset += 8 + u32(offset + 4);
      if (str(offset, 4) !== "MTrk") {
        throw new Error("Converted MIDI missing first data track");
      }
      const body = [...bytes.subarray(offset + 8, offset + 18)];
      const expected = [0, body[1], 0x78, 0, 0, 0x79, 0, 0, 0x7b, 0];
      if (body[0] !== 0 || (body[1] & 0xf0) !== 0xb0 ||
        body[2] !== 0x78 || body[3] !== 0 ||
        body[4] !== 0 || body[5] !== 0x79 || body[6] !== 0 ||
        body[7] !== 0 || body[8] !== 0x7b || body[9] !== 0) {
        throw new Error("GM.CAT track init does not match source bytes; got " + body.join(","));
      }

      Music.setMidiBackend(null);
      Music.setExperimentalOscillatorMidi(false);
      Music.stop();
      const defaultMidiPlayed = gmStory.play(0);
      if (defaultMidiPlayed || Music._currentSynth || Music._currentMidiPlayback) {
        throw new Error("MIDI fallback should not use the crude oscillator synth by default");
      }
      if (!gmStory.getLastError().includes("browser MIDI backend")) {
        throw new Error("MIDI fallback did not report the missing browser MIDI backend");
      }

      let backendStopped = false;
      let backendVolume = -1;
      let backendLoop = null;
      let backendLength = 0;
      Music.setMidiBackend({
        play(data, options) {
          backendLoop = options.loop;
          backendVolume = options.volume;
          backendLength = data.length;
          return {
            stop() { backendStopped = true; },
            setVolume(volume) { backendVolume = volume; }
          };
        }
      });
      const backendMidi = cat.loadMIDI(12);
      if (!backendMidi.play(-1)) {
        throw new Error("Installed MIDI backend was not used for GM.CAT fallback");
      }
      Music.setVolume(0.25);
      Music.stop();
      Music.setMidiBackend(null);
      if (!backendStopped || backendLoop !== true || backendLength !== bytes.length || backendVolume !== 0.25) {
        throw new Error("MIDI backend handle did not receive source bytes/loop/volume/stop semantics");
      }

      Music.stop();
      Music.setMidiBackend(new TimidityMidiBackend("/web/vendor/timidity/"));
      const libTimidityMidi = cat.loadMIDI(12);
      if (!libTimidityMidi.play(0)) {
        throw new Error("libtimidity MIDI backend did not accept GM.CAT MIDI data");
      }
      let timidityState = null;
      for (let i = 0; i < 150; ++i) {
        await new Promise(resolve => setTimeout(resolve, 100));
        timidityState = Music._currentMidiPlayback?.getState?.() || null;
        if (timidityState?.ready || timidityState?.lastError) {
          break;
        }
      }
      Music.stop();
      Music.setMidiBackend(null);
      if (!timidityState || timidityState.source !== "libtimidity" || !timidityState.ready || timidityState.lastError) {
        throw new Error("libtimidity backend did not become ready for GM.CAT MIDI: " + JSON.stringify(timidityState));
      }

      return {
        selectedKind: music.getSourceKind(),
        selectedMime: music.getMimeType(),
        gmCatTrackInit: expected,
        midiFallback: gmStory.getLastError(),
        backendLength,
        timidityState
      };
    } finally {
      Options.preferredMusic = oldPreferred;
    }
  });

  await page.evaluate(value => {
    console.log("VERIFY_MUSIC_SOURCE_PRIORITY ok " + JSON.stringify(value));
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
  line("VERIFY_MUSIC_SOURCE_PRIORITY");
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
    if (!consoleResult.stdout.includes("VERIFY_MUSIC_SOURCE_PRIORITY ok") || consoleResult.stdout.includes("[ERROR]")) {
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
  line("VERIFY_MUSIC_SOURCE_PRIORITY ok");
}

await main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
