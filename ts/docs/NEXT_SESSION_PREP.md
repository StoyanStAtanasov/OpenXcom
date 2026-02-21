# Next Session Prep: Faithful Rewrite Track

Last updated: 2026-02-20

## Goal for next session

Start a close technological rewrite path, not feature-prototype work.

Primary objective:
- establish parity foundation for rendering/UI/resource loading based on original OpenXcom architecture.

## What was reviewed in this once-over

### Scale reality
- `src/` C++: `646` files, `160,335` LOC
- `ts/src/` TS: `26` files, `5,731` LOC
- Current parity estimate: `7%`

### C++ hotspots by module (largest files)

- Engine:
  - `src/Engine/Surface.cpp` (core surface/blit/palette path)
  - `src/Engine/Game.cpp`
  - `src/Engine/State.cpp`
  - `src/Engine/Palette.cpp`
  - `src/Engine/Screen.cpp`
- Interface:
  - `src/Interface/TextList.cpp`
  - `src/Interface/Text.cpp`
  - `src/Interface/TextEdit.cpp`
  - `src/Interface/TextButton.cpp`
- Mod:
  - `src/Mod/Mod.cpp` (main loader/merge/resource orchestration)
- Geoscape:
  - `src/Geoscape/GeoscapeState.cpp`
  - `src/Geoscape/DogfightState.cpp`
  - `src/Geoscape/Globe.cpp`
- Basescape:
  - multiple specialized states (`PurchaseState`, `SellState`, `TransferItemsState`, `CraftEquipmentState`, etc.)
- Battlescape:
  - `src/Battlescape/TileEngine.cpp`
  - `src/Battlescape/BattlescapeGenerator.cpp`
  - `src/Battlescape/BattlescapeGame.cpp`
  - `src/Battlescape/AIModule.cpp`
- Savegame:
  - `src/Savegame/SavedGame.cpp`
  - `src/Savegame/SavedBattleGame.cpp`
  - `src/Savegame/BattleUnit.cpp`

### Current TS concentration
- `ts/src/campaign/CampaignModel.ts` is monolithic and merges concerns that are separate in C++ (`SavedGame`, Geoscape systems, Basescape systems, research/manufacture, etc.).
- `ts/src/engine/Renderer.ts` and `ts/src/engine/GameFont.ts` are still a simplified rendering path.

## Architectural mismatch found

1. Engine/UI layering mismatch
- C++ separates `Game -> State -> Surface/InteractiveSurface -> Interface widgets`.
- TS currently renders directly in state classes with immediate-mode canvas draw calls.

2. Resource pipeline mismatch
- C++ `Mod` loads palettes, surfaces, sets, sounds, fonts, rulesets, and mod offsets in unified order.
- TS currently does subset YAML loading and ad-hoc font handling.

3. Save model mismatch
- C++ `SavedGame` is large, structured, and YAML-based with strict load/save ordering.
- TS localStorage schema is custom and not structurally equivalent.

## Concrete next-session execution plan

### Step 1: Engine parity foundation (status: started)

Implement TS equivalents for:
- `Surface` abstraction (indexed-like semantics where needed)
- palette-aware draw path and color index translation
- font atlas slicing based on `bin/common/Language/Font.dat`

Target files to create/update:
- `ts/src/engine/Surface.ts` (implemented skeleton)
- `ts/src/engine/Palette.ts` (implemented skeleton)
- `ts/src/engine/FontAtlas.ts` (implemented skeleton, not Font.dat-driven yet)
- `ts/src/engine/Renderer.ts` (refactored to consume above)

Reference sources:
- `src/Engine/Surface.h`
- `src/Engine/Surface.cpp`
- `src/Engine/Palette.h`
- `src/Engine/Palette.cpp`
- `src/Engine/Font.h`
- `src/Engine/Font.cpp`
- `bin/common/Language/Font.dat`

Exit criteria:
- Start screen text and button labels render with stable glyph widths/spacing and no transparency artifacts.
- all UI text stays inside `320x200` logical space with deterministic metrics.

### Step 2: Interface parity slice (status: started)

Port minimal widget model:
- text label
- text button
- container ordering

Target files:
- `ts/src/interface/Text.ts` (implemented)
- `ts/src/interface/TextButton.ts` (implemented)
- `ts/src/interface/UiState.ts` (new)
- migrated `StartState` to use widget primitives

Reference sources:
- `src/Interface/Text.cpp`
- `src/Interface/TextButton.cpp`
- `src/Engine/State.cpp`

Exit criteria:
- `StartState` no longer hardcodes pixel text placement for each element.

### Step 3: Ruleset/mod loader parity groundwork (status: started)

Create staged loader shell mirroring `Mod::loadAll` flow:
- load resource config
- load vanilla resources
- load rulesets
- load extra resources

Target files:
- `ts/src/mod/ModLoader.ts` (implemented shell with staged load flow)
- `ts/src/ruleset/RulesetLoader.ts` (refactored into staged raw/parse/name-pool functions)

Reference source:
- `src/Mod/Mod.cpp` (load order around `loadAll`, `loadMod`, `loadVanillaResources`, `loadExtraResources`)

## File audit notes for quick reopen

- C++ API anchors:
  - `src/Engine/Game.h`
  - `src/Engine/State.h`
  - `src/Engine/Surface.h`
  - `src/Mod/Mod.h`
  - `src/Savegame/SavedGame.h`
- TS files to refactor first:
  - `ts/src/engine/Renderer.ts`
  - `ts/src/engine/GameFont.ts`
  - `ts/src/states/StartState.ts`
  - `ts/src/campaign/CampaignModel.ts`

## Guardrails for next session

- Do not claim parity progress from prototype features.
- Keep progress percentages tied to source architecture coverage and behavior parity.
- Track every touched source/target pair in `ts/docs/REWRITE_TRACKER.md`.
