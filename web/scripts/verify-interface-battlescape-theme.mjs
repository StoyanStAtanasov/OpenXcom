import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, rm, writeFile } from "node:fs/promises";
import http from "node:http";
import { dirname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const webRoot = normalize(join(dirname(fileURLToPath(import.meta.url)), ".."));
const repoRoot = normalize(join(webRoot, ".."));
const outputRoot = join(repoRoot, "output", "playwright");
const verifierPath = join(outputRoot, "verify-interface-battlescape-theme.js");
const session = "openxcom-interface-battlescape-theme";
const url = "http://127.0.0.1:4173/web/index.html";

const verifier = String.raw`async page => {
  await page.goto("http://127.0.0.1:4173/web/index.html");
  await page.waitForFunction(() => document.readyState === "complete");
  await page.waitForFunction(() => window.openxcomGame);

  const result = await page.evaluate(async () => {
    const [
      { State },
      { Surface },
      { Palette },
      { Mod },
      { Window },
      { Text },
      { TextList },
      { ComboBox },
      { Action },
      { SDL_BUTTON_LEFT, SDL_MOUSEBUTTONDOWN, SDL_MOUSEBUTTONUP }
    ] = await Promise.all([
      import("/web/dist/Engine/State.js"),
      import("/web/dist/Engine/Surface.js"),
      import("/web/dist/Engine/Palette.js"),
      import("/web/dist/Mod/Mod.js"),
      import("/web/dist/Interface/Window.js"),
      import("/web/dist/Interface/Text.js"),
      import("/web/dist/Interface/TextList.js"),
      import("/web/dist/Interface/ComboBox.js"),
      import("/web/dist/Engine/Action.js"),
      import("/web/dist/types.js")
    ]);

    class TestState extends State {}

    const realGame = window.openxcomGame;
    const oldCycle = realGame.cycle;
    realGame.cycle = () => {};

    try {
      const tac = new Surface(16, 16);
      const sink = { setPalette: () => {}, setColor: () => {}, draw: () => {} };
      const element = { id: "battlescapeTheme", color: 42, color2: 0, border: 77, w: 0, h: 0, x: 0, y: 0, TFTDMode: false };
      const mainMenuInterface = {
        getElement: id => id === "battlescapeTheme" ? element : null,
        getParent: () => "",
        getPalette: () => "PAL_GEOSCAPE"
      };
      const fakeMod = {
        getInterface: id => id === "mainMenu" ? mainMenuInterface : null,
        getSurface: id => id === "TAC00.SCR" ? tac : null,
        getPalette: () => Palette.createDefault(),
        setPalette: () => {},
        getFont: () => null
      };
      State.setGamePtr({
        getMod: () => fakeMod,
        getCursor: () => sink,
        getFpsCounter: () => sink
      });

      const state = new TestState();
      const win = new Window(state, 20, 20);
      const txt = new Text(40, 9);
      const list = new TextList(60, 20);
      const combo = new ComboBox(state, 80, 16);
      const generic = new Surface(5, 5);
      state._surfaces = [win, txt, list, combo, generic];

      state.applyBattlescapeTheme();

      if (win.getColor() !== element.color || win._contrast !== true || win._bg !== tac) {
        throw new Error("Window did not receive battlescape theme color, contrast, and TAC00 background");
      }
      if (txt.getColor() !== element.color || txt._contrast !== true) {
        throw new Error("Text did not receive battlescape theme color and contrast");
      }
      if (list.getColor() !== element.color || list._contrast !== true || list._arrowColor !== element.border) {
        throw new Error("TextList did not receive battlescape theme color, contrast, and arrow color");
      }
      if (combo.getColor() !== element.color || combo._button?._contrast !== true || combo._arrowColor !== element.border) {
        throw new Error("ComboBox did not receive battlescape theme color, contrast, and arrow color");
      }

      const makeButtonAction = (type, x, y) => new Action({ type, button: { x, y, button: SDL_BUTTON_LEFT } }, 1, 1, 0, 0);
      const comboState = new TestState();
      let comboChanges = 0;
      const sourceCombo = new ComboBox(comboState, 80, 16, 10, 20);
      comboState._surfaces = [sourceCombo];
      sourceCombo.onChange(() => { comboChanges++; });
      sourceCombo.setOptions(["Alpha", "Bravo", "Charlie", "Delta"], false);
      sourceCombo.setSelected(2);
      sourceCombo.handle(makeButtonAction(SDL_MOUSEBUTTONDOWN, 12, 22), comboState);
      sourceCombo.handle(makeButtonAction(SDL_MOUSEBUTTONUP, 12, 22), comboState);
      if (!sourceCombo._window.getVisible() || !sourceCombo._list.getVisible() || comboState._modal !== sourceCombo) {
        throw new Error("ComboBox button press did not open the source-shaped modal popup list");
      }
      if (comboChanges !== 0) {
        throw new Error("ComboBox onChange fired while opening instead of after closing");
      }
      const listX = sourceCombo._list.getX() + 2;
      const listY = sourceCombo._list.getY() + 2;
      sourceCombo.handle(makeButtonAction(SDL_MOUSEBUTTONDOWN, listX, listY), comboState);
      sourceCombo.handle(makeButtonAction(SDL_MOUSEBUTTONUP, listX, listY), comboState);
      if (sourceCombo.getSelected() !== 0 || sourceCombo._button.getText() !== "Alpha") {
        throw new Error("ComboBox list click did not update the selected row and button text");
      }
      if (sourceCombo._window.getVisible() || sourceCombo._list.getVisible() || comboState._modal !== null || comboChanges !== 1) {
        throw new Error("ComboBox list click did not close the popup, clear modal state, and fire one change event");
      }
      sourceCombo.handle(makeButtonAction(SDL_MOUSEBUTTONDOWN, 12, 22), comboState);
      sourceCombo.handle(makeButtonAction(SDL_MOUSEBUTTONUP, 12, 22), comboState);
      sourceCombo.handle(makeButtonAction(SDL_MOUSEBUTTONDOWN, 250, 190), comboState);
      if (sourceCombo._window.getVisible() || comboState._modal !== null || comboChanges !== 2) {
        throw new Error("ComboBox outside click did not close the modal popup with source onChange behavior");
      }
      const comboAbove = new ComboBox(comboState, 80, 16, 30, 100, true);
      comboAbove.setOptions(["One", "Two", "Three"], false);
      if (comboAbove._window.getY() >= comboAbove.getY()) {
        throw new Error("ComboBox popupAboveButton did not place the popup above the button");
      }

      const depthState = new TestState();
      let depthPaletteCalled = false;
      depthState.setInterface("saveMenus", false, {
        setPaletteByDepth: stateArg => {
          depthPaletteCalled = stateArg === depthState;
          stateArg.setPaletteByName("PAL_BATTLESCAPE");
        }
      });
      if (!depthPaletteCalled) {
        throw new Error("State.setInterface did not delegate palette selection to battleGame.setPaletteByDepth");
      }
      if (depthState._cursorColor !== Mod.BATTLESCAPE_CURSOR) {
        throw new Error("setPaletteByName did not update the battlescape cursor color");
      }

      return {
        themeColor: element.color,
        arrowColor: element.border,
        comboSelection: sourceCombo.getSelected(),
        comboChanges,
        windowBackground: win._bg === tac,
        depthPaletteCalled,
        cursorColor: depthState._cursorColor
      };
    } finally {
      State.setGamePtr(realGame);
      realGame.cycle = oldCycle;
    }
  });

  await page.evaluate(value => {
    console.log("VERIFY_INTERFACE_BATTLESCAPE_THEME ok " + JSON.stringify(value));
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
  line("VERIFY_INTERFACE_BATTLESCAPE_THEME");
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
    if (!consoleResult.stdout.includes("VERIFY_INTERFACE_BATTLESCAPE_THEME ok") || consoleResult.stdout.includes("[ERROR]")) {
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
  line("VERIFY_INTERFACE_BATTLESCAPE_THEME ok");
}

await main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
