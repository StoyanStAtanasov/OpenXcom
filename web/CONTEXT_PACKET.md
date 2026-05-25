# OpenXcom TS Port Context Packet

Generated: 2026-05-25T18:32:42.228Z
Role: resume

This is the compact handoff surface for resumed turns and subagents. Regenerate it with `npm run context` instead of rereading long narrative docs.

## Snapshot

- Objective: Faithfully translate OpenXcom C++ source into the browser TypeScript port.
- Path parity: 336/336 (100%)
- Tracked slices: 20
- Integrated verified slices: 19
- Slice path warnings: 0
- Status rollup: integrated-verified=19, partial-integrated-verified=1
- Local Codex status: gpt-5.5 (xhigh); context 7.5% left (239140/258400 latest input tokens); credits not reported locally

## Active Slice

- Name: Battlescape next-stage transition
- Area: Battlescape
- Status: integrated-verified
- Slice percent: 100%
- Next action: Broaden mission-end verification from direct route fixtures to generated multi-stage mission playthroughs.
- Verification markers: none

Boundaries:
- The verifier drives nextStage directly with source-shaped fake fixtures; a later playthrough verifier should reach it through real generated multi-stage mission completion.
- Deeper generated map content fidelity remains owned by the broader BattlescapeGenerator map/script/deployment slices.

Source files (6): src/Battlescape/BattlescapeGenerator.cpp; src/Battlescape/BattlescapeGenerator.h; src/Savegame/SavedBattleGame.cpp; src/Savegame/SavedBattleGame.h; src/Savegame/BattleUnit.cpp; src/Savegame/BattleUnit.h

Target files (5): web/src/Battlescape/BattlescapeGenerator.ts; web/src/Battlescape/BattlescapeState.ts; web/src/Savegame/SavedBattleGame.ts; web/src/Savegame/BattleUnit.ts; web/scripts/verify-battle-runtime.mjs

## Integration Queue

| Slice | Area | Status | % | Next action |
| --- | --- | --- | ---: | --- |
| Original save conversion folder ingestion data | Savegame | partial-integrated-verified | 99.9998% | Continue broader playability/debriefing/runtime parity; the latest Menu/Geoscape source-route marker scan is clean and save/load persistence remains verified browser storage behavior. |

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
Read-only sidecar for OpenXcom TS port slice "Battlescape next-stage transition" (100%).
Do not edit files.
Inspect only the exact file list provided by the main agent plus this context packet.
Next action: Broaden mission-end verification from direct route fixtures to generated multi-stage mission playthroughs..
Boundaries: The verifier drives nextStage directly with source-shaped fake fixtures; a later playthrough verifier should reach it through real generated multi-stage mission completion.; Deeper generated map content fidelity remains owned by the broader BattlescapeGenerator map/script/deployment slices..
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

