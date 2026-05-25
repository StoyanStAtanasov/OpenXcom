# OpenXcom TS Port Context Packet

Generated: 2026-05-25T23:17:24.549Z
Role: resume

This is the compact handoff surface for resumed turns and subagents. Regenerate it with `npm run context` instead of rereading long narrative docs.

## Snapshot

- Objective: Faithfully translate OpenXcom C++ source into the browser TypeScript port.
- Path parity: 336/336 (100%)
- Tracked slices: 28
- Integrated verified slices: 28
- Slice path warnings: 0
- Status rollup: integrated-verified=28
- Local Codex status: gpt-5.5 (xhigh); context 18.2% left (211355/258400 latest input tokens); credits not reported locally

## Active Slice

- Name: Adlib YM3812 music playback
- Area: Engine
- Status: integrated-verified
- Slice percent: 90%
- Next action: Replace the ScriptProcessor bridge with AudioWorklet only if latency/deprecation becomes observable, and add native-vs-browser PCM parity checks if a native OpenXcom/fmopl harness is available.
- Verification markers: none

Boundaries:
- The browser uses a WebAudio ScriptProcessor callback as the SDL_mixer hook adapter; the Adlib command interpreter and YM3812 mixer body are source-shaped, but callback scheduling is browser-native.
- No native PCM golden-output harness is currently wired, so verification proves real CAT loading and non-silent translated synthesis rather than sample-exact native parity.

Source files (10): src/Engine/AdlibMusic.cpp; src/Engine/AdlibMusic.h; src/Engine/Adlib/adlplayer.cpp; src/Engine/Adlib/adlplayer.h; src/Engine/Adlib/fmopl.cpp; src/Engine/Adlib/fmopl.h; src/Engine/Music.cpp; src/Engine/Music.h; src/Mod/Mod.cpp; src/Mod/Mod.h

Target files (8): web/src/Engine/AdlibMusic.ts; web/src/Engine/Adlib/adlplayer.ts; web/src/Engine/Adlib/fmopl.ts; web/src/Engine/Music.ts; web/src/Mod/Mod.ts; web/scripts/verify-adlib-music-player.mjs; web/scripts/verify-startup-browser.mjs; web/package.json

## Integration Queue

| Slice | Area | Status | % | Next action |
| --- | --- | --- | ---: | --- |

## Subagent Packet

For read-only sidecars, pass only this packet plus the exact file list. For workers, pass the exact source files, target files, forbidden files, and final format below.

Forbidden unless explicitly assigned:
- AGENTS.md
- web/PORTING.md
- web/translation-slices.json
- web/src/Geoscape/GeoscapeState.ts
- web/src/Basescape/BasescapeState.ts
- web/src/Savegame/SavedGame.ts
- shared model/rules files touched by an active integration slice

Worker final format:
- changed files or read-only files inspected
- build/typecheck/verifier result, if run
- pending source boundaries
- risks or integration notes

Prompt skeletons:

```text
Read-only sidecar for OpenXcom TS port slice "Adlib YM3812 music playback" (90%).
Do not edit files.
Inspect only the exact file list provided by the main agent plus this context packet.
Next action: Replace the ScriptProcessor bridge with AudioWorklet only if latency/deprecation becomes observable, and add native-vs-browser PCM parity checks if a native OpenXcom/fmopl harness is available..
Boundaries: The browser uses a WebAudio ScriptProcessor callback as the SDL_mixer hook adapter; the Adlib command interpreter and YM3812 mixer body are source-shaped, but callback scheduling is browser-native.; No native PCM golden-output harness is currently wired, so verification proves real CAT loading and non-silent translated synthesis rather than sample-exact native parity..
Return summary-first: files inspected, source facts, risks, recommended integration/verifier checks.
```

## Commands

- context: `cd web; npm run context`
- contextReadonly: `cd web; npm run context:readonly`
- contextWorker: `cd web; npm run context:worker`
- status: `cd web; npm run status`
- statusJson: `cd web; npm run status -- --json`
- build: `cd web; npm run build`
- typecheck: `cd web; npm run typecheck`
- codexStatus: `cd web; npm run codex:status`
- orchestrator: `cd web; npm run orchestrator`
- agentLedger: `cd web; npm run agents`
- agentPrompt: `cd web; npm run agents:prompt -- --role readonly --task "..." --scope "src/Foo.cpp; web/src/Foo.ts"`
- codexStatusRepoRoot: `node tools/codex-status.mjs`

