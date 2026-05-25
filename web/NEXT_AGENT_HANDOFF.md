# Next Agent Handoff - 2026-05-26

This file is the standalone resume point for a new Codex agent that does not have access to the prior session.

## Mission

Translate OpenXcom C++ into the browser TypeScript port under `web/`.

The C++ source in `src/` is the authority. This is a direct rewrite/translation, not game-design work. Preserve class names, method names, source control flow, ruleset ids, UI ids, coordinates, save keys, algorithms, and state-stack behavior. Browser code should only adapt platform boundaries such as rendering, audio, input, storage, file manifests, and async loading.

Local original data is present in repo-root `XCOM/` and `TFD/`.

## Stop Checkpoint

The previous agent stopped intentionally before using the remaining token budget on another code slice.

Last code checkpoint before this handoff:

- Commit: `f77e76305 Translate commendation rules and add handoff docs`
- Latest focused slice: `Soldier diary screens`, advanced from `90%` to `96%`
- No production TypeScript work was started after that commit during the stop request
- This handoff pass only updates project memory/status documents and generated status/context files

Current dashboard state at stop:

- Path parity: `336/336` tracked C++ source paths have TypeScript counterparts (`100%`)
- Tracked slices: `28/28` are `integrated-verified`
- Active agent ledger: `0` active agents from `npm run agents`
- Whole browser port is not done. The tracked dashboard is green, but `PORTING.md`, verifier gaps, and runtime boundaries still name deeper parity work.

## Latest Completed Slice

Source-backed commendation rules are wired into the browser runtime:

- `web/src/Mod/RuleCommendations.ts`
  - Adds source-shaped `RuleCommendationsNode`
  - Parses top-level `commendations:` ruleset blocks
  - Parses `description`, sorted `criteria`, `sprite`, and nested OR/AND `killCriteria`
  - Keeps criteria order aligned with C++ `std::map` behavior

- `web/src/Mod/Mod.ts`
  - Imports and loads `RuleCommendations`
  - Adds `getCommendation()` and `getCommendationsList()`
  - Scans active ruleset files for `commendations:` blocks, matching C++ `Mod::load`
  - Restores the C++ starting-soldier original-eight award path when `STR_MEDAL_ORIGINAL8_NAME` exists, then marks that award old

- `web/scripts/verify-soldier-diary-commendations.mjs`
  - Builds and typechecks
  - Verifies parsing, sorted map ordering, no-noun awards, modular noun awards, and career `killCriteria` awards through real translated `SoldierDiary.manageCommendations()`

- `web/package.json`
  - Adds `npm run verify:soldier-diary-commendations`

## Verified Commands

These passed after the commendation-rule slice:

```powershell
cd web
npm run verify:soldier-diary-commendations
npm run verify:startup-browser
npm run verify:active-mod-runtime
npm run status
npm run orchestrator
git diff --check
```

Expected markers from the focused verifiers:

```text
VERIFY_SOLDIER_DIARY_COMMENDATIONS ok
VERIFY_STARTUP_BROWSER ok
VERIFY_ACTIVE_MOD_RUNTIME ok
```

For this stop checkpoint, run the lightweight status commands again before committing:

```powershell
cd web
npm run status
npm run context
npm run orchestrator
npm run agents
```

## Next Best Candidate

A completed read-only sidecar recommended this as the next small, source-backed runtime slice:

- C++ source: `src/Battlescape/DebriefingState.cpp`, method `DebriefingState::reequipCraft()` around line `1552`
- TS target: `web/src/Battlescape/DebriefingState.ts`, existing method around line `1254`
- Verifier target: extend `web/scripts/verify-battle-runtime.mjs`
- Why it matters: post-mission recovery/reequip behavior affects ammo recovery, craft weapons, and vehicle item handling after battlescape resolution

Do not trust the sidecar as source proof. Re-open `DebriefingState.cpp/.h`, the existing TS method, and the relevant save/model helpers before editing.

The local main-agent investigation also identified another good candidate, but it is more visual than gameplay:

- C++ source: `src/Geoscape/Globe.cpp` methods `draw()`, `drawRadars()`, `drawGlobeCircle()`, `drawFlights()`, `drawMarkers()`
- TS target: `web/src/Geoscape/Globe.ts`
- Verifier target: extend `web/scripts/verify-globe-source-parity.mjs`
- Boundary: core planet texture/shadow already has `diffPixels: 0`; remaining work is radar range rings, craft range, flight paths, target markers, and marker blink overlays

Pick one slice, not both. If the user is pushing playability, start with `DebriefingState::reequipCraft()`.

## Important Lessons To Keep

- The user expects translation, not invented behavior. If C++ has a body, translate it.
- When a source-shaped class exists but behavior is missing, inspect the owning loader/registry too. The commendation gap was in `Mod.ts`, not mainly in `SoldierDiary`.
- Generated dashboards are not completion proof. If `PORTING.md` or boundaries still name runtime gaps, keep the overall project open.
- Run npm automation from `web/`, not repo root.
- Do not run build-owning verifiers in parallel on Windows because they share and delete `web/dist`.
- Treat `/status` model buckets as advisory. If a Spark spawn fails, record it and continue locally or with a smaller model instead of retrying stale capacity.
- Use sidecars to shortlist exact files and verifier ideas; the main integrator still verifies control flow against the C++ body.
- Keep context small. Prefer `npm run context`, `npm run orchestrator`, `npm run agents:prompt`, and focused scripts over repeated manual `Get-Content` scans.
- When stopping, commit a docs/status checkpoint rather than leaving half-started translation work.

## Where Knowledge Lives

- Project operating memory: `AGENTS.md`
- Port workflow skill: `C:\Users\stoia\.codex\skills\openxcom-ts-port\SKILL.md`
- User-facing browser package notes: `web/README.md`
- Porting narrative and explicit remaining boundaries: `web/PORTING.md`
- Machine-readable slice state: `web/translation-slices.json`
- Generated progress dashboard: `web/TRANSLATION_STATUS.md` and `web/translation-status.json`
- Compact resume packet: `web/CONTEXT_PACKET.md` and `web/context-packet.json`
- Local agent ledger: `web/agent-ledger.json`

## Resume Checklist

Start from the repo files, not chat memory:

```powershell
git status --short
cd web
npm run orchestrator
npm run context
npm run agents
```

Then:

1. Choose exactly one source-backed boundary.
2. Read the C++ `.cpp/.h` and nearby TS first.
3. Translate the source body directly, preserving names and control flow.
4. Add or extend one focused verifier.
5. Run build/typecheck plus the focused verifier.
6. Update `PORTING.md`, `translation-slices.json`, generated status/context, and `AGENTS.md` for any lesson.
7. Commit the verified slice.

Do not mark the overall goal complete until the full browser TypeScript game translation is actually playable and verified against the original scope.
