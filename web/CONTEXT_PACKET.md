# OpenXcom TS Port Context Packet

Generated: 2026-05-24T21:51:15.021Z
Role: resume

This is the compact handoff surface for resumed turns and subagents. Regenerate it with `npm run context` instead of rereading long narrative docs.

## Snapshot

- Objective: Faithfully translate OpenXcom C++ source into the browser TypeScript port.
- Path parity: 210/336 (62.5%)
- Tracked slices: 13
- Integrated verified slices: 12
- Slice path warnings: 0
- Status rollup: integrated-verified=12, worker-build=1

## Active Slice

- Name: Geoscape confirmations dogfight base defense
- Area: Geoscape
- Status: worker-build
- Slice percent: 70%
- Next action: Geoscape integration wiring pending
- Verification markers: none

Boundaries:
- Geoscape integration wiring pending
- Craft destination/return-to-base and waypoint storage helpers pending
- BriefingState and full mission generation boundaries pending
- Dogfight sound/blob/runtime fidelity pending

Source files (5): src/Geoscape/ConfirmLandingState.cpp; src/Geoscape/ConfirmDestinationState.cpp; src/Geoscape/ConfirmCydoniaState.cpp; src/Geoscape/DogfightState.cpp; src/Geoscape/BaseDefenseState.cpp

Target files (5): web/src/Geoscape/ConfirmLandingState.ts; web/src/Geoscape/ConfirmDestinationState.ts; web/src/Geoscape/ConfirmCydoniaState.ts; web/src/Geoscape/DogfightState.ts; web/src/Geoscape/BaseDefenseState.ts

## Integration Queue

| Slice | Area | Status | % | Next action |
| --- | --- | --- | ---: | --- |
| Geoscape confirmations dogfight base defense | Geoscape | worker-build | 70% | Geoscape integration wiring pending |

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
Read-only sidecar for OpenXcom TS port slice "Geoscape confirmations dogfight base defense" (70%).
Do not edit files.
Inspect only the exact file list provided by the main agent plus this context packet.
Next action: Geoscape integration wiring pending.
Boundaries: Geoscape integration wiring pending; Craft destination/return-to-base and waypoint storage helpers pending; BriefingState and full mission generation boundaries pending; Dogfight sound/blob/runtime fidelity pending.
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
- agentLedger: `cd web; npm run agents`
- agentPrompt: `cd web; npm run agents:prompt -- --role readonly --task "..." --scope "src/Foo.cpp; web/src/Foo.ts"`
- codexStatus: `node tools/codex-status.mjs`

