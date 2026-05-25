# OpenXcom TS Port Context Packet

Generated: 2026-05-25T15:16:12.497Z
Role: resume

This is the compact handoff surface for resumed turns and subagents. Regenerate it with `npm run context` instead of rereading long narrative docs.

## Snapshot

- Objective: Faithfully translate OpenXcom C++ source into the browser TypeScript port.
- Path parity: 336/336 (100%)
- Tracked slices: 16
- Integrated verified slices: 15
- Slice path warnings: 0
- Status rollup: integrated-verified=15, partial-integrated-verified=1
- Local Codex status: gpt-5.5 (xhigh); context 46.6% left (137966/258400 latest input tokens); credits not reported locally

## Active Slice

- Name: Original save conversion folder ingestion data
- Area: Savegame
- Status: partial-integrated-verified
- Slice percent: 99.93%
- Next action: Continue tactical battle runtime restoration beyond the verified saved-battle/path/line/spotting/casualty/hit/projectile-drop/shotgun baseline: next source-backed target is remaining ProjectileFlyBState reaction-fire aftermath and complete projectile handoff resolution, plus ExplosionBState audio/cosmetic camera polish.
- Verification markers: none

Boundaries:
- SaveConverter DAT reader parity now includes the TFTD SITE.DAT artifact-site counter branch; original tactical GAME_# slots still show the source-matching unsupported-battlescape-save error rather than inventing tactical DAT conversion.
- SavedGame now persists and restores battleGame payloads when SavedBattleGame is registered; ListLoadOriginalState mirrors the C++ post-load saved-battle resume branch; SavedBattleGame binary tile/moduleMap/loadMapResources/prepareNewTurn/randomizeItemLocations/resetTiles/setDebugMode paths, ammo link rule-skip behavior, Tile/BattleUnit tileBelow placement transitions, UnitWalkBState/UnitFallBState movement occupancy tileBelow handoffs, Pathfinding Bresenham/A* and vertical movement, TileEngine::calculateLine, TileEngine::canTargetUnit potential-unit targeting, AIModule::getSpottingUnits source parity, BattlescapeGame::checkForCasualties kill/death accounting, TileEngine::hit fatal-wound/morale/explode-on-death aftermath, TileEngine::explode fatal-wound killedBy credit, ExplosionBState chained terrain explosion ordering, ProjectileFlyBState lift-off/drop sounds/cache/bullet side effects, hostile grenade danger-zone marking, shotgun secondary pellet cascades, and terminal out-of-bounds weapon-lowering/cache side effects are covered by browser verification or scoped source audit. Remaining battle restoration is deeper projectile runtime behavior, especially reaction-fire aftermath, complete projectile handoff resolution, and ExplosionBState audio/cosmetic camera polish, not core saved-battle/original-save ingestion.
- Browser original-save ingestion now imports selected GAME_# folder files into localStorage, rejects no-op selections, missing SAVEINFO.DAT, and invalid SAVEINFO.DAT with explicit errors, and displays corrupt-slot errors in ListLoadOriginalState. Remaining UX polish is drag/drop/detail presentation rather than core ingestion diagnostics.

Source files (39): src/Mod/RuleConverter.cpp; src/Mod/RuleConverter.h; src/Mod/Mod.cpp; src/Mod/Mod.h; src/Savegame/SaveConverter.cpp; src/Savegame/SaveConverter.h; src/Savegame/Base.cpp; src/Savegame/BaseFacility.cpp; src/Savegame/ItemContainer.cpp; src/Savegame/Ufo.cpp; src/Savegame/Craft.cpp; src/Savegame/AlienBase.cpp; src/Savegame/Waypoint.cpp; src/Savegame/MissionSite.cpp; ... (25 more in web/context-packet.json)

Target files (38): web/src/Mod/RuleConverter.ts; web/src/Mod/Mod.ts; web/src/Savegame/SaveConverter.ts; web/src/Savegame/Base.ts; web/src/Savegame/BaseFacility.ts; web/src/Savegame/ItemContainer.ts; web/src/Savegame/Ufo.ts; web/src/Savegame/Craft.ts; web/src/Savegame/AlienBase.ts; web/src/Savegame/Waypoint.ts; web/src/Savegame/MissionSite.ts; web/src/Savegame/CraftWeapon.ts; web/src/Savegame/Vehicle.ts; web/src/Savegame/AlienMission.ts; ... (24 more in web/context-packet.json)

## Integration Queue

| Slice | Area | Status | % | Next action |
| --- | --- | --- | ---: | --- |
| Original save conversion folder ingestion data | Savegame | partial-integrated-verified | 99.93% | Continue tactical battle runtime restoration beyond the verified saved-battle/path/line/spotting/casualty/hit/projectile-drop/shotgun baseline: next source-backed target is remaining ProjectileFlyBState reaction-fire aftermath and complete projectile handoff resolution, plus ExplosionBState audio/cosmetic camera polish. |

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
Read-only sidecar for OpenXcom TS port slice "Original save conversion folder ingestion data" (99.93%).
Do not edit files.
Inspect only the exact file list provided by the main agent plus this context packet.
Next action: Continue tactical battle runtime restoration beyond the verified saved-battle/path/line/spotting/casualty/hit/projectile-drop/shotgun baseline: next source-backed target is remaining ProjectileFlyBState reaction-fire aftermath and complete projectile handoff resolution, plus ExplosionBState audio/cosmetic camera polish..
Boundaries: SaveConverter DAT reader parity now includes the TFTD SITE.DAT artifact-site counter branch; original tactical GAME_# slots still show the source-matching unsupported-battlescape-save error rather than inventing tactical DAT conversion.; SavedGame now persists and restores battleGame payloads when SavedBattleGame is registered; ListLoadOriginalState mirrors the C++ post-load saved-battle resume branch; SavedBattleGame binary tile/moduleMap/loadMapResources/prepareNewTurn/randomizeItemLocations/resetTiles/setDebugMode paths, ammo link rule-skip behavior, Tile/BattleUnit tileBelow placement transitions, UnitWalkBState/UnitFallBState movement occupancy tileBelow handoffs, Pathfinding Bresenham/A* and vertical movement, TileEngine::calculateLine, TileEngine::canTargetUnit potential-unit targeting, AIModule::getSpottingUnits source parity, BattlescapeGame::checkForCasualties kill/death accounting, TileEngine::hit fatal-wound/morale/explode-on-death aftermath, TileEngine::explode fatal-wound killedBy credit, ExplosionBState chained terrain explosion ordering, ProjectileFlyBState lift-off/drop sounds/cache/bullet side effects, hostile grenade danger-zone marking, shotgun secondary pellet cascades, and terminal out-of-bounds weapon-lowering/cache side effects are covered by browser verification or scoped source audit. Remaining battle restoration is deeper projectile runtime behavior, especially reaction-fire aftermath, complete projectile handoff resolution, and ExplosionBState audio/cosmetic camera polish, not core saved-battle/original-save ingestion.; Browser original-save ingestion now imports selected GAME_# folder files into localStorage, rejects no-op selections, missing SAVEINFO.DAT, and invalid SAVEINFO.DAT with explicit errors, and displays corrupt-slot errors in ListLoadOriginalState. Remaining UX polish is drag/drop/detail presentation rather than core ingestion diagnostics..
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

