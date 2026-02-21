# OpenXcom TS Faithful Rewrite Master Document

Last updated: 2026-02-20
Owner: Rewrite session operator
Canonical entry point for all rewrite sessions.

## Mission

Rewrite OpenXcom to web TypeScript with close technological parity to the original C++ architecture and behavior.

This is not a prototype roadmap.  
This is a faithful-port roadmap.

## Current baseline

- C++ source baseline: `src/` -> `646` files, `160,335` LOC.
- TS rewrite baseline: `ts/src/` -> `19` files, `5,458` LOC.
- Current faithful parity estimate: `6%`.
- Current state: not yet playable as a faithful OpenXcom port.

## Non-negotiable rewrite rules

1. Parity over invention.
- Do not add synthetic mechanics unless they exist in original behavior.

2. Architecture-first porting.
- Port subsystem boundaries close to C++ structure before expanding features.

3. Deterministic behavior.
- Prefer fixed-step simulation and explicit state transitions.

4. Traceability.
- Every major TS change must map to source C++ files in tracker docs.

5. Honest progress accounting.
- Percentages represent faithful parity, not “feature count.”

## Canonical supporting docs

- Gap analysis: `ts/docs/REWRITE_GAP_ANALYSIS.md`
- File/module tracker: `ts/docs/REWRITE_TRACKER.md`
- Next session prep: `ts/docs/NEXT_SESSION_PREP.md`
- Progress summary: `ts/README.md`

If these documents conflict, this master doc takes precedence.

## Rewrite target architecture

Target module layering in TS:

1. Engine layer
- `Game`, `State` stack semantics, timing, event routing.
- Palette-aware surfaces and rendering primitives.

2. Interface layer
- Text widgets, buttons, lists, dialogs, container ordering.
- Font metrics and layout parity.

3. Resource + mod layer
- Resource config load order.
- Vanilla + mod merge behavior.
- Ruleset index/order handling.

4. Domain gameplay layers
- Geoscape
- Basescape
- Battlescape
- Savegame
- Ufopaedia

## Priority execution order

Phase A: Engine + Interface parity foundation.
Phase B: Resource/mod/ruleset loading parity.
Phase C: Geoscape + Basescape parity.
Phase D: Battlescape parity.
Phase E: Savegame parity.
Phase F: Ufopaedia and remaining long-tail systems.

Do not skip forward unless the current phase has explicit acceptance sign-off.

## Phase acceptance gates

### Phase A gate

- Font rendering uses original atlas/mapping pipeline behavior.
- UI layout is stable in `320x200` logical space at integer scales.
- No clipping/ghosting/transparency artifacts in core menus.
- State transitions follow deterministic stack behavior.

### Phase B gate

- Loader flow mirrors original high-level order:
  - resource config
  - vanilla resources
  - rulesets/mod merge
  - extra resources
- Core rule indexes and ordering are deterministic.

### Phase C gate

- Geoscape/Basescape loops are behaviorally aligned for key scenarios.
- R&D/manufacture/funding/monthly progression parity tests pass.

### Phase D gate

- Tactical turn loop, LOS/attack/morale essentials are parity-aligned for baseline scenarios.
- Mission launch/debrief/carry-over integrates with campaign state correctly.

### Phase E gate

- Save/load flow preserves campaign integrity across long runs.
- Major campaign entities serialize/deserialize with parity semantics.

## Required session output format

Each rewrite session must produce:

1. What was ported
- TS files changed
- C++ source references used

2. What parity improved
- explicit subsystem percentages updated
- concrete behaviors now matching original

3. What remains blocked
- high-risk gaps with next action

4. Tracker updates
- update `ts/docs/REWRITE_TRACKER.md`
- update `ts/README.md` percentages if changed

## Progress metric policy

Use weighted subsystem parity:

- Engine/runtime: 20%
- Interface/UI: 15%
- Resource/mod loader: 15%
- Geoscape: 15%
- Basescape: 10%
- Battlescape: 15%
- Savegame: 8%
- Ufopaedia/other: 2%

Overall parity = weighted sum of subsystem parity values.

## First-session restart checklist

When beginning any new rewrite session:

1. Read this file first.
2. Read `ts/docs/REWRITE_TRACKER.md`.
3. Confirm current parity percentages from `ts/README.md`.
4. Pick one phase-aligned backlog slice only.
5. Implement + verify.
6. Update tracker and percentages.

## Immediate backlog anchor

Current recommended starting slice:

- Build engine parity slice with dedicated TS modules:
  - `ts/src/engine/Surface.ts`
  - `ts/src/engine/Palette.ts`
  - `ts/src/engine/FontAtlas.ts`
  - refactor `ts/src/engine/Renderer.ts` to consume them
- Then migrate `StartState` to widget-oriented interface primitives.

## Definition of “playable faithful rewrite”

The rewrite is considered playable-faithful only when:

- Core campaign loop (start -> geoscape -> base -> mission -> debrief -> monthly cycle) runs end-to-end.
- Rendering/UI/controls are close to original behavior and readability.
- Tactical missions are playable with parity-consistent rules.
- Save/load supports continued campaigns without corruption.

Until these are met, status remains: `prototype / non-faithful`.
