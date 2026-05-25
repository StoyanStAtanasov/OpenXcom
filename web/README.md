# OpenXcom Browser TypeScript Port

This directory is the browser TypeScript translation target for the OpenXcom C++ source in `../src`.

The porting rule is direct translation: preserve source file names, ids, object names, algorithms, state routes, and save/rules structures wherever practical. Browser-only changes belong at resource, audio, graphics, input, storage, and file-dialog boundaries.

## Play

From `web`:

```powershell
npm run build
npm run serve
```

Open:

```text
http://127.0.0.1:4173/web/index.html
```

If a server is already running, just open the URL. The current verified playable path is XCOM1: startup, base/geoscape, new battle, battlescape runtime, debriefing, and browser save/load.

TFD/TFTD data is detected by the build manifest and `Options.updateMods()` now creates the `xcom2` master entry when data is present. Full TFTD runtime startup/ruleset loading is still a separate translation boundary.

## Common Commands

Run these from `web`:

```powershell
npm run build
npm run typecheck
npm run status
npm run orchestrator
```

Focused verifiers:

```powershell
npm run verify:new-battle-sandbox
npm run verify:battle-runtime
npm run verify:debriefing
npm run verify:save-menu
npm run verify:mod-selection
```

## Progress

`npm run status` writes:

- `web/TRANSLATION_STATUS.md`
- `web/translation-status.json`

`npm run orchestrator` prints the compact dashboard: path parity, slice counts, active slice, active agents, and local Codex status.

Current source path parity is `336/336`; behavioral completion is tracked by verifier-backed slices, not by path count alone.
