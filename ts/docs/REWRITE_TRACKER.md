# OpenXcom TS Rewrite Tracker

Last updated: 2026-02-20

Master rewrite document: `ts/docs/REWRITE_MASTER.md`

## Coverage baseline

- C++: `646` files / `160,335` LOC
- TS: `26` files / `5,731` LOC
- Faithful parity estimate: **7%**

## Module tracker

| Original module (`src/`) | C++ files | C++ LOC | TS target status | Current TS mapping | Parity |
|---|---:|---:|---|---|---:|
| `Engine` | 88 | 33,315 | Early parity foundation | `ts/src/engine/*` | 10% |
| `Interface` | 34 | 6,767 | Early parity foundation | `ts/src/interface/*`, `ts/src/states/StartState.ts` | 12% |
| `Mod` | 86 | 16,472 | Loader staging shell started | `ts/src/mod/ModLoader.ts`, `ts/src/ruleset/*` | 6% |
| `Geoscape` | 71 | 14,148 | Early prototype | `ts/src/states/GeoscapeState.ts`, `CampaignModel.ts` | 8% |
| `Basescape` | 80 | 13,213 | Early prototype | `ts/src/states/BasescapeState.ts`, `CampaignModel.ts` | 7% |
| `Battlescape` | 99 | 32,078 | Early prototype | `ts/src/battlescape/TacticalSimulation.ts`, `BattlescapeState.ts` | 4% |
| `Savegame` | 70 | 24,037 | Not started | `ts/src/campaign/CampaignModel.ts` (custom schema) | 2% |
| `Menu` | 68 | 9,093 | Partial prototype | `ts/src/states/*` | 10% |
| `Ufopaedia` | 42 | 3,232 | Not started | none | 0% |
| `apple` | 1 | 11 | N/A for web target | none | n/a |

## Priority port order

1. Engine + Interface parity foundation
2. Mod/ruleset/resource loader parity
3. Geoscape and Basescape parity
4. Battlescape parity
5. Savegame parity
6. Ufopaedia and long-tail systems

## Next session backlog

1. Continue engine parity slice:
- add palette-aware blended/tinted draw ops to match C++ transparency LUT usage
- validate color-0 alpha behavior against intended opaque/transparent usage per screen class

2. Expand interface parity slice:
- migrate next menu state from immediate drawing to widget composition
- migrate geoscape/basescape/battlescape non-command data panes from immediate drawing to widget composition

3. Deepen mod loader staging:
- wire merged ruleset layer metadata into downstream systems that consume rule ordering
- stage mod resource manifests (sprites/sounds/palettes) beyond current metadata-only pass

See detailed handoff: `ts/docs/NEXT_SESSION_PREP.md`

## File-level tracking protocol

For each ported unit, add entries here:

| Source file(s) | Target TS file(s) | Status | Notes |
|---|---|---|---|
| `src/Engine/Surface.cpp`, `src/Engine/Surface.h` | `ts/src/engine/Surface.ts`, `ts/src/engine/Renderer.ts`, `ts/src/engine/Game.ts` | In progress | Indexed surface now blits once per frame with color-0 transparency semantics and transparent-source blit support; advanced blend/LUT parity still pending |
| `src/Engine/Palette.cpp`, `src/Engine/Palette.h` | `ts/src/engine/Palette.ts`, `ts/src/engine/Surface.ts`, `ts/src/engine/Renderer.ts`, `ts/src/states/StartState.ts`, `ts/src/states/GeoscapeState.ts`, `ts/src/states/BasescapeState.ts`, `ts/src/states/BattlescapeState.ts`, `ts/src/states/StatisticsState.ts`, `ts/src/campaign/CampaignModel.ts` | In progress | Palette loader now reads `BACKPALS.DAT`; pack selection is gameId-driven across major states; transparency LUT generation and LUT-based indexed blit primitives were added as groundwork for C++ tint/blend behavior |
| `src/Engine/Font.cpp`, `src/Engine/Font.h` | `ts/src/engine/GameFont.ts`, `ts/src/engine/FontAtlas.ts`, `ts/src/engine/Renderer.ts` | In progress | Font atlas draw path separated from renderer; Font.dat parity mapping still pending |
| `src/Interface/Text.cpp`, `src/Interface/Text.h` | `ts/src/interface/Text.ts`, `ts/src/interface/UiPrimitives.ts`, `ts/src/states/StartState.ts`, `ts/src/states/StrategicOutcomeState.ts`, `ts/src/states/CouncilReportState.ts`, `ts/src/states/DebriefingState.ts`, `ts/src/states/StatisticsState.ts` | In progress | Start + StrategicOutcome + CouncilReport + Debriefing + Statistics report layouts are now fully composed through UI widgets (including data rows), replacing immediate-mode text/frame rendering in those screens |
| `src/Interface/TextButton.cpp`, `src/Interface/TextButton.h` | `ts/src/interface/TextButton.ts`, `ts/src/states/StartState.ts`, `ts/src/states/GeoscapeState.ts`, `ts/src/states/BasescapeState.ts`, `ts/src/states/BattlescapeState.ts` | In progress | Start + Geoscape + Basescape + Battlescape command buttons are widgetized with container focus/navigation and action dispatch; TextButton now supports dynamic style resolvers for active-mode highlighting |
| `src/Engine/State.cpp`, `src/Interface/InteractiveSurface.cpp` | `ts/src/interface/UiState.ts`, `ts/src/interface/UiPrimitives.ts`, `ts/src/states/StartState.ts`, `ts/src/states/GeoscapeState.ts`, `ts/src/states/BasescapeState.ts`, `ts/src/states/BattlescapeState.ts`, `ts/src/states/CouncilReportState.ts`, `ts/src/states/DebriefingState.ts`, `ts/src/states/StatisticsState.ts`, `ts/src/states/StrategicOutcomeState.ts`, `ts/src/engine/Game.ts`, `ts/src/engine/State.ts` | In progress | Ordered UI container with pointer/keyboard focus now drives Start, report/menu states, and Geoscape/Basescape/Battlescape command chrome; non-interactive widget hit handling fixed and report UIs rendered via composed widget trees |
| `src/Mod/Mod.cpp`, `src/Mod/Mod.h` | `ts/src/mod/ModLoader.ts`, `ts/src/ruleset/RulesetLoader.ts`, `ts/src/ruleset/types.ts`, `ts/src/states/StartState.ts`, `ts/src/campaign/CampaignModel.ts` | In progress | Added deterministic layered merge flow with per-layer offsets, keyed replacement/delete semantics, preserved table index ordering, staged vanilla/extra resource phase metadata, concrete vanilla palette file presence checks, and downstream metadata consumption in Start UI + CampaignModel rule ordering |
| `src/Geoscape/GeoscapeState.cpp` | `ts/src/states/GeoscapeState.ts` | Prototype | Functional placeholder, not parity implementation |
| `src/Basescape/*` | `ts/src/states/BasescapeState.ts`, `ts/src/campaign/CampaignModel.ts` | Prototype | Single-screen compressed implementation |
| `src/Battlescape/*` | `ts/src/battlescape/TacticalSimulation.ts`, `ts/src/states/BattlescapeState.ts` | Prototype | Simplified tactical loop |
| `src/Savegame/*` | `ts/src/campaign/CampaignModel.ts` | Not started | Incompatible data model, lacks original save semantics |

## Definition of done for "playable faithful"

- UI layout/font/palette fidelity is close to original across core screens.
- Core geoscape, basescape, and battlescape loops behave like original rules.
- Campaign can be played end-to-end without prototype-only shortcuts.
- Save/load stability is validated across multi-month campaigns.
