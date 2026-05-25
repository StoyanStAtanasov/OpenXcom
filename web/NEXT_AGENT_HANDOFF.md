# Next Agent Handoff - 2026-05-26

This file is a self-contained resume point for a new Codex agent that does not have access to the previous session.

## Mission

Translate OpenXcom C++ into the browser TypeScript port under `web/`.

The C++ source in `src/` is the authority. This is a rewrite/translation, not a redesign. Preserve class names, method names, source control flow, ruleset ids, UI ids, coordinates, save keys, algorithms, and state-stack behavior. Browser code should only adapt platform boundaries such as rendering, audio, input, storage, file manifests, and async loading.

Local original data is present in repo-root `XCOM/` and `TFD/`.

## Current Status

- Path parity: `336/336` tracked C++ source paths have TypeScript counterparts (`100%`).
- Tracked slices: `28/28` are `integrated-verified`.
- Latest focused slice: `Soldier diary screens` advanced from `90%` to `96%`.
- Whole browser port is not done. The tracked dashboard is green, but `PORTING.md` and slice boundaries still contain runtime/deeper-parity work.
- Active agent ledger: `0` active agents from `npm run orchestrator`.
- Spark status is stale in this environment. A tiny Spark sidecar spawn failed with a usage-limit error saying retry after `2026-05-31 20:41`; do not spend time retrying Spark until status is empirically confirmed.

## Latest Completed Slice

Source-backed commendation rules are now wired into the browser runtime:

- `web/src/Mod/RuleCommendations.ts`
  - Added source-shaped `RuleCommendationsNode`.
  - Added `parseCommendationsRul()` for top-level `commendations:` ruleset blocks.
  - Parses `description`, sorted `criteria`, `sprite`, and nested OR/AND `killCriteria`.
  - Keeps criteria order aligned with C++ `std::map` behavior.

- `web/src/Mod/Mod.ts`
  - Imports and loads `RuleCommendations`.
  - Adds `getCommendation()` and `getCommendationsList()`.
  - Scans active ruleset files for `commendations:` blocks, matching the C++ `Mod::load` top-level ingestion behavior.
  - Restores the C++ starting-soldier original-eight award path when `STR_MEDAL_ORIGINAL8_NAME` exists, then immediately marks that award old.

- `web/scripts/verify-soldier-diary-commendations.mjs`
  - New focused verifier.
  - Builds and typechecks.
  - Verifies ruleset parsing, sorted map ordering, no-noun awards, modular noun awards, and career `killCriteria` awards through real translated `SoldierDiary.manageCommendations()`.

- `web/package.json`
  - Adds `npm run verify:soldier-diary-commendations`.

Docs updated:

- `web/PORTING.md`
- `web/translation-slices.json`
- generated status/context files should be refreshed before handoff commit.

## Verified Commands

These passed after the commendation-rule slice:

```powershell
cd web
npm run verify:soldier-diary-commendations
npm run verify:startup-browser
npm run verify:active-mod-runtime
npm run status
npm run orchestrator
```

The focused verifier output ended with:

```text
VERIFY_SOLDIER_DIARY_COMMENDATIONS ok
VERIFY_STARTUP_BROWSER ok
VERIFY_ACTIVE_MOD_RUNTIME ok
```

## Important Lessons To Keep

- Do not say or think "game logic design" for this repo. The job is direct source translation.
- When a source-shaped class exists but behavior is missing, inspect the owning loader too. In this slice, `SoldierDiary.manageCommendations()` was already mostly translated; the real gap was that `Mod.ts` never loaded `RuleCommendations` from active rulesets.
- Treat `/status` model buckets as advisory. If a Spark spawn fails, record it and continue locally or with a smaller non-Spark model; do not retry stale capacity.
- Generated dashboards are not completion proof. If `PORTING.md` or slice boundaries still name runtime gaps, keep the overall project open.
- Run npm commands from `web/`, not repo root.
- On Windows, do not run build-owning verifiers in parallel because they share `web/dist`.

## Next Safe Continuation

Start with compact project state instead of session memory:

```powershell
git status --short
cd web
npm run orchestrator
npm run context
npm run agents
```

Then choose the next source-backed boundary from `web/PORTING.md` and `web/translation-slices.json`. Good candidates from the current orchestrator/docs are:

- broader campaign save/load and debriefing edge coverage around diary and battlescape-mutated fields
- original-save conversion loading edges
- saved-battle persistence/resume parity
- remaining battlescape/geoscape runtime polish
- globe overlays and moving-target visual fidelity beyond the already verified planet texture/shadow core

For each slice:

1. Read the exact C++ `.cpp/.h` files and the existing TS files first.
2. Translate source-shaped behavior before inventing browser adapters.
3. Add or extend a focused verifier.
4. Run build/typecheck plus the focused verifier.
5. Update `PORTING.md`, `translation-slices.json`, generated status/context, and `AGENTS.md` if a lesson was learned.
6. Commit at the end of the verified slice.
