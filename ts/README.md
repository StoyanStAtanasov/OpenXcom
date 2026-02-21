# OpenXcom Web TypeScript Port

Browser-first TypeScript rewrite of the OpenXcom gameplay loop and campaign systems.

## Current status

- Last updated: 2026-02-20
- Overall faithful rewrite completeness vs original OpenXcom codebase: **7%**
- Improvement in latest pass: **+1%** (from 6% to 7%)
- Playability status: **Prototype only, not game-faithful and not yet playable as OpenXcom**

### Reality check

- The current `ts/` app is a simplified simulation and UI prototype.
- It does not yet implement the original rendering/resource pipeline, interface widget system, savegame model, or full tactical rules.
- Asset presence (`UFO/`, `TFTD/`) alone is not enough to play the original game in this rewrite yet.

### Rewrite governance

- Master session document: `ts/docs/REWRITE_MASTER.md`
- Gap analysis and parity plan: `ts/docs/REWRITE_GAP_ANALYSIS.md`
- File/module tracker: `ts/docs/REWRITE_TRACKER.md`
- Progress percentages in this README now track **faithful parity**, not prototype feature count.

### Latest pass (this update)

- Implemented engine parity foundation slice:
  - added `Surface` indexed buffer abstraction (`ts/src/engine/Surface.ts`)
  - added `Palette` index/color translation (`ts/src/engine/Palette.ts`)
  - added `FontAtlas` draw path split from renderer (`ts/src/engine/FontAtlas.ts`)
  - refactored `Renderer` to consume the new engine primitives
- Implemented interface parity foundation slice:
  - added `Text` and `TextButton` widgets (`ts/src/interface/*`)
  - migrated `StartState` to widget-driven rendering and hit-testing
- Added staged mod-loader shell:
  - created `ts/src/mod/ModLoader.ts` with `loadAll` phase boundaries
  - refactored `RulesetLoader` into raw/parse/name-pool stages
  - boot `LoadingState` now routes ruleset startup through `ModLoader`
- Hardened endgame lock behavior:
  - campaign simulation stops advancing after strategic victory/defeat
  - geoscape operational actions are blocked when campaign is locked
  - lock state is persisted in saves
- Improved strategic UX:
  - geoscape now shows explicit strategic pressure (`deficit months`, `pact count`)
  - strategic outcome screen is interactive (`CONTINUE`/`QUIT`) instead of auto-quitting
- Added campaign statistics screen:
  - new `STATS` button in Geoscape
  - persistent counters for air war, ground war, losses, promotions, and recovered loot
  - strategic diagnostics (final assault readiness, deficits, pacts, lock status)
- Added morale/bravery tactical mechanics:
  - soldiers now carry persistent `bravery` and `morale` values in campaign data
  - tactical turns now apply panic checks from morale/bravery thresholds
  - panic status blocks command actions for affected units in that turn
  - combat losses apply morale shock; successful actions contribute to morale recovery
- Added dual-ruleset startup support:
  - start screen now supports both `UFO (xcom1)` and `TFTD (xcom2)`
  - loader now initializes both rulesets at boot
  - save slots are partitioned by ruleset, so UFO/TFTD campaigns do not collide
- Added original-asset ingestion pipeline:
  - `npm run sync:assets` mirrors `../UFO` and `../TFTD` into `public/game-assets`
  - sync generates `public/game-assets/manifest.json` with pack/file summaries
  - start screen now shows per-ruleset asset-pack sync status

### Subsystem progress

- Engine/runtime parity: **10%**
- Resource/asset pipeline parity: **3%**
- Interface/UI parity: **12%**
- Geoscape parity: **8%**
- Basescape parity: **7%**
- Battlescape parity: **4%**
- Savegame/mod/config parity: **3%**

## What this project is

The `ts/` folder contains a canvas-based web implementation of OpenXcom concepts:

- explicit game state machine (`Loading`, `Start`, `Geoscape`, `Basescape`, `Battlescape`, reports)
- YAML ruleset loading from OpenXcom assets
- campaign simulation with time, economy, R&D, manufacturing, missions, transfers
- tactical combat simulation connected back to strategic outcomes

## Run and build

```bash
cd ts
npm install
npm run sync:assets
npm run dev
```

Production build:

```bash
npm run build
npm run preview
```

## Controls and flow

### Start menu

- `UFO` / `TFTD`: choose active ruleset
- `NEW GAME ...`: start a fresh campaign for active ruleset
- `CONTINUE LATEST`: load latest slot for active ruleset (including autosave)
- `S1/S2/S3`: load specific slots for active ruleset

### Geoscape

- `TIME x1/x6/x60`: campaign time compression
- `INTERCEPT`, `RECALL`: air-combat control
- `LAUNCH`, `IGN`: mission response
- `FINAL`: launch final assault when unlocked and launchable
- `STATS`: open campaign statistics dashboard
- strategic footer shows final-assault readiness and loss pressure

### Basescape

- `BASE VIEW`: roster, assignment, facilities, construction queue
- `R&D VIEW`: research + manufacture queueing and staffing
- `LOGI VIEW`: market, hiring, transfers, craft loadout transfer
- `SAVE`, `SLOT-`, `SLOT+`: save control

### Battlescape

- action modes: `MOVE`, `SMOKE`, `SNAP`, `AUTO`
- squad control: `NEXT UNIT`, `KNEEL/STAND`, `END TURN`
- mission exits: `ABORT`, `EXIT`
- mission auto-transitions to debrief on completion

## Implemented systems

### Ruleset/data loading

- supports `xcom1` and `xcom2` ruleset paths
- countries, regions, starting base/facilities
- crafts, items, soldiers, name pools
- research and manufacture definitions
- language translation lookups
- optional original binary asset mirror under `public/game-assets` for renderer migration work

### Campaign/economy

- in-game clock, monthly transitions, autosave
- country funding drift, satisfaction, pact pressure
- monthly council reports with rating and per-country deltas
- maintenance, salaries, score bonuses, net projection

### Base management

- dynamic facility construction + cancel/refund
- capacity/usage recomputation from facility layout
- staff hiring and transfer queue
- store market buy/sell operations

### R&D and manufacture

- start/cancel projects
- assign/unassign scientists and engineers
- requirement checks and locked previews
- manufacture reservations for required items
- blocked states for missing funds/items

### Craft and deployment

- soldier craft assignment with slot limits
- wound-aware deployment filtering
- craft operation lifecycle:
  - `READY` -> `OUTBOUND` -> `ON_MISSION` -> `RETURNING` -> `REARMING` -> `READY`
- craft inventory transfer (base stores <-> craft)

### Geoscape mission layer

- UFO/contact spawn and motion
- interceptor interception outcomes
- mission lifecycle and expiry
- mission launch into Battlescape

### Battlescape + outcome integration

- TU-based turn simulation with basic AI
- LOS/smoke/wall effects, movement/pathing
- morale/panic behavior influenced by soldier bravery
- battle results applied to campaign:
  - KIA, wounds, stat gains, rank changes, kill/mission tracking, bravery/morale updates
- debriefing state with soldier-level post-mission report

### Endgame

- final assault unlock via endgame research markers
- final assault launch gating (ready craft + assigned healthy soldiers)
- strategic victory/defeat alerts
- strategic outcome state (continue or quit)
- campaign lock after strategic outcome (prevents further strategic simulation/actions)

## Save model

- localStorage persistence with versioned payload
- slot-based save system (`S1..S3`) + autosave (`A`)
- persisted major entities:
  - countries/funding/satisfaction/pacts
  - base roster, craft loadouts, stores, facilities, build queue
  - active research/manufacture
  - geoscape missions/contacts/interceptors/events
  - pending mission and strategic flags
  - campaign statistics counters and lock status
- save namespace is separated by game ID (`xcom1` vs `xcom2`)

## Known gaps

- visual fidelity is intentionally placeholder-style (no full original asset rendering yet)
- tactical simulation is simplified versus full OpenXcom mechanics
- some endgame content is represented by systems flow rather than exact original mission scripting

## Roadmap

1. Replace placeholder rendering with sprite/tile/UX parity assets.
2. Deepen tactical rules parity (projectiles, armor/damage model, morale, inventory weight).
3. Expand geoscape content generation and mission archetype variety.
4. Add more exact endgame and narrative progression mapping.
