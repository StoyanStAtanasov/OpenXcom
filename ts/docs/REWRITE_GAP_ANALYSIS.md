# OpenXcom TS Rewrite Gap Analysis

Last updated: 2026-02-20

## Executive summary

The current `ts/` project is a prototype inspired by OpenXcom concepts, not a faithful rewrite.

- C++ baseline: `646` files, `160,335` LOC (`src/**/*.cpp,*.h`)
- TS rewrite: `19` files, `5,458` LOC (`ts/src/**/*.ts`)
- LOC ratio: `~3.4%` (not a direct parity metric, but useful for scale)
- Faithful rewrite estimate: **6%**

This is why the game is currently unplayable as a true OpenXcom port.

## Major parity gaps

1. Engine and rendering pipeline gap
- Original has full surface/palette/blitting/font/UI stack in `src/Engine` + `src/Interface`.
- TS currently has minimal canvas primitives and custom text rendering.
- Missing: palette-correct rendering, PCK/TAB/SPK/SCR surface decoding path, original UI draw semantics, animation timing parity.

2. Resource and mod loading gap
- Original loads/modifies data via complex mod/ruleset merge system (`src/Mod`).
- TS currently loads a limited subset of `.rul` files directly.
- Missing: full mod inheritance/merge semantics, full ruleset coverage, resource pack bindings.

3. Geoscape/Basescape/Battlescape depth gap
- Original geoscape, base, and tactical logic spans hundreds of files.
- TS has single-file simplified simulations for each domain.
- Missing: exact mission generation, detection/interception behavior, manufacturing/research edge rules, tactical LOS/projectile/armor/psi/reaction-fire parity.

4. UI/state parity gap
- Original menu/state system uses many dedicated screens and widget compositions.
- TS has simplified canvas states and button rectangles.
- Missing: faithful state graph, interactions, screen transitions, and layout fidelity.

5. Savegame/config parity gap
- Original has extensive savegame structs and persistence logic (`src/Savegame`).
- TS uses a custom localStorage schema.
- Missing: parity with original data model semantics and long-campaign compatibility expectations.

## Why the current build looks wrong

- Font and layout issues are symptoms of the deeper pipeline mismatch.
- A faithful UI requires the original font/image assets plus the same character mapping, spacing, palette usage, and widget layout logic as C++.

## Close technological rewrite strategy

Use a module-by-module port strategy that mirrors original architecture instead of adding prototype features.

1. Freeze feature drift
- No new synthetic gameplay mechanics unless they exist in C++.
- Focus only on parity deltas.

2. Port by subsystem with strict boundaries
- Engine -> Interface -> Mod/Ruleset -> Geoscape -> Basescape -> Battlescape -> Savegame.
- Keep class names and data structures close to original where practical.

3. Build deterministic compatibility layers
- Fixed-step simulation loop.
- Asset decoding modules matching original formats.
- Palette-based renderer and atlas/font extraction consistent with original behavior.

4. Track parity by source module
- Every C++ directory mapped to TS target module(s).
- Each port task references source file(s) and status.

5. Validate with parity scenarios
- Golden-path scenario checks for start flow, base setup, interception, mission launch, tactical turn, debrief, monthly report.

## Estimated path to playable faithful port

Given current state (6%), a realistic sequence is:

1. Milestone A: engine/resource/interface parity baseline (non-final gameplay)
- target: can render authentic UI screens and assets with correct fonts/layout/palette
- effort: substantial

2. Milestone B: geoscape + basescape core parity loop
- target: stable campaign progression with faithful systems

3. Milestone C: battlescape core parity loop
- target: tactical missions playable with close original behavior

4. Milestone D: savegame/mod parity hardening
- target: long-run campaign stability and content compatibility

Practical expectation: not "a few fixes". It requires a sustained rewrite pass across most core modules.
