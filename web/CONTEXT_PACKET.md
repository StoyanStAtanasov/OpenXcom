# OpenXcom TS Port Context Packet

Generated: 2026-05-25T23:31:23.910Z
Role: resume

This is the compact handoff surface for resumed turns and subagents. Regenerate it with `npm run context` instead of rereading long narrative docs.

## Snapshot

- Objective: Faithfully translate OpenXcom C++ source into the browser TypeScript port.
- Path parity: 336/336 (100%)
- Tracked slices: 28
- Integrated verified slices: 28
- Slice path warnings: 0
- Status rollup: integrated-verified=28
- Local Codex status: gpt-5.5 (xhigh); context 29.9% left (181056/258400 latest input tokens); credits not reported locally

## Active Slice

- Name: Basescape craft management
- Area: Basescape
- Status: integrated-verified
- Slice percent: 100%
- Next action: Move to the next documented runtime boundary outside craft management, such as original-save conversion loading, saved-battle persistence, or remaining battlescape/geoscape runtime polish
- Verification markers: VERIFY_BASESCAPE_MANAGEMENT

Boundaries:
- Negative warning variants such as wrong ammo, already-loaded weapon, and not-enough-TU remain broader battlescape inventory QA rather than craft-management handoff coverage

Source files (15): src/Basescape/CraftsState.cpp; src/Basescape/CraftInfoState.cpp; src/Basescape/CraftWeaponsState.cpp; src/Basescape/CraftSoldiersState.cpp; src/Basescape/CraftEquipmentState.cpp; src/Basescape/CraftArmorState.cpp; src/Battlescape/BattlescapeGenerator.cpp; src/Battlescape/Inventory.cpp; src/Battlescape/InventoryState.cpp; src/Mod/Mod.cpp; src/Mod/Mod.h; src/Savegame/Base.cpp; src/Savegame/Craft.cpp; src/Savegame/Soldier.cpp; ... (1 more in web/context-packet.json)

Target files (15): web/src/Basescape/CraftsState.ts; web/src/Basescape/CraftInfoState.ts; web/src/Basescape/CraftWeaponsState.ts; web/src/Basescape/CraftSoldiersState.ts; web/src/Basescape/CraftEquipmentState.ts; web/src/Basescape/CraftArmorState.ts; web/src/Battlescape/BattlescapeGenerator.ts; web/src/Battlescape/Inventory.ts; web/src/Battlescape/InventoryState.ts; web/src/Mod/Mod.ts; web/src/Savegame/Base.ts; web/src/Savegame/Craft.ts; web/src/Savegame/Soldier.ts; web/src/Savegame/Vehicle.ts; ... (1 more in web/context-packet.json)

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
Read-only sidecar for OpenXcom TS port slice "Basescape craft management" (100%).
Do not edit files.
Inspect only the exact file list provided by the main agent plus this context packet.
Next action: Move to the next documented runtime boundary outside craft management, such as original-save conversion loading, saved-battle persistence, or remaining battlescape/geoscape runtime polish.
Boundaries: Negative warning variants such as wrong ammo, already-loaded weapon, and not-enough-TU remain broader battlescape inventory QA rather than craft-management handoff coverage.
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

