# Translation Status

Generated: 2026-05-24T21:51:15.002Z

## Summary

- Source translation units: 336
- Units with same-path TypeScript file: 210 (62.5%)
- Source code files (.cpp/.h): 646
- TypeScript files: 212
- TypeScript helper/web-only files: 2
- Tracked slices: 13
- Integrated and browser/build verified slices: 12
- Slice path warnings: 0

Path parity is a progress signal, not proof of behavioral parity. Slice status and verifier notes carry the behavioral signal.

## Slice Status Rollup

| Status | Count |
| --- | ---: |
| integrated-verified | 12 |
| worker-build | 1 |

## Next Integration Queue

| Slice | Area | Status | Next action |
| --- | --- | --- | --- |
| Geoscape confirmations dogfight base defense | Geoscape | worker-build | Geoscape integration wiring pending |

## Area Coverage

| Area | Units | TS Path Matches | Coverage | Missing Examples |
| --- | ---: | ---: | ---: | --- |
| (root) | 6 | 2 | 33.3% | `dirent`, `fmath`, `lodepng`, `resource` |
| apple | 1 | 0 | 0% | `apple/SDLMain` |
| Basescape | 40 | 40 | 100% |  |
| Battlescape | 50 | 37 | 74% | `Battlescape/AliensCrashState`, `Battlescape/BattlescapeMessage`, `Battlescape/BriefingState`, `Battlescape/CannotReequipState`, `Battlescape/CommendationLateState`, `Battlescape/CommendationState`, ... |
| Engine | 52 | 16 | 30.8% | `Engine/Adlib/adlplayer`, `Engine/Adlib/fmopl`, `Engine/AdlibMusic`, `Engine/CatFile`, `Engine/CrossPlatform`, `Engine/DosFont`, ... |
| Geoscape | 36 | 35 | 97.2% | `Geoscape/Cord` |
| Interface | 17 | 13 | 76.5% | `Interface/ArrowButton`, `Interface/ImageButton`, `Interface/NumberText`, `Interface/ScrollBar` |
| Menu | 34 | 7 | 20.6% | `Menu/AbandonGameState`, `Menu/ConfirmLoadState`, `Menu/CutsceneState`, `Menu/DeleteGameState`, `Menu/ListGamesState`, `Menu/ListLoadOriginalState`, ... |
| Mod | 43 | 31 | 72.1% | `Mod/ArticleDefinition`, `Mod/City`, `Mod/ExtraSounds`, `Mod/ExtraSprites`, `Mod/ExtraStrings`, `Mod/Polyline`, ... |
| Savegame | 36 | 29 | 80.6% | `Savegame/AlienStrategy`, `Savegame/BattleUnitStatistics`, `Savegame/CraftWeaponProjectile`, `Savegame/EquipmentLayoutItem`, `Savegame/SaveConverter`, `Savegame/SerializationHelper`, ... |
| Ufopaedia | 21 | 0 | 0% | `Ufopaedia/ArticleState`, `Ufopaedia/ArticleStateArmor`, `Ufopaedia/ArticleStateBaseFacility`, `Ufopaedia/ArticleStateCraft`, `Ufopaedia/ArticleStateCraftWeapon`, `Ufopaedia/ArticleStateItem`, ... |

## Tracked Slices

| Slice | Area | Status | Slice % | Verification | Main Boundaries |
| --- | --- | --- | ---: | --- | --- |
| Basescape craft management | Basescape | integrated-verified | 88% | npm run build; Playwright VERIFY_BASESCAPE_MANAGEMENT passed | Vehicle/HWP storage and full craft-space helpers pending; Inventory equipment screen pending |
| Basescape research management | Basescape | integrated-verified | 84% | npm run build; Playwright VERIFY_BASESCAPE_MANAGEMENT passed for entry/new-list flow | Research project save/load persistence pending; Monthly research completion process pending |
| Basescape manufacture management | Basescape | integrated-verified | 84% | npm run build; Playwright VERIFY_BASESCAPE_MANAGEMENT passed for entry/new-list flow | Production save/load persistence pending; Full Craft.reuseItem behavior pending |
| Soldier armor and memorial | Basescape | integrated-verified | 92% | npm run build; focused browser verifiers passed | End-game/cutscene routes remain owned by the menu/statistics slice |
| Psi training UI | Geoscape/Basescape | integrated-verified | 90% | npm run build passed; Playwright VERIFY_PSI_TRAINING passed for base button listing, allocation transition, soldier row toggle, and OK return | Full monthly report follow-up route into PsiTrainingState and broader psi report edge cases pending |
| Stat strings | Mod | integrated-verified | 96% | npm run build passed; Playwright VERIFY_STAT_STRINGS passed for Mod.genSoldier and AllocatePsiTrainingState recalculation; tsc --noEmit now passes after source-backed SavedGame difficulty coefficient translation | Saved-game load and debriefing/monthly stat-string recalculation remain with their parent persistence/battlescape/geoscape slices |
| Starting-base custom facility placement | Basescape | integrated-verified | 98% | npm run build passed; Playwright VERIFY_BASE_NAME_PLACE_LIFT passed for BaseName hook, lift placement, selected-base update, and custom facility list | Full save/load persistence of selected base index pending |
| Soldier diary screens | Basescape/Savegame | integrated-verified | 90% | npm run build passed; Playwright VERIFY_SOLDIER_DIARY passed for SoldierInfo diary button, overview mission row, performance screen, and mission detail; tsc --noEmit now passes after source-backed SavedGame difficulty coefficient translation | Commendation rules pending; Full diary save/load/debriefing update integration remains with persistence and battlescape slices |
| Geoscape popup batches | Geoscape | integrated-verified | 100% | workers reported npm run build and node/module smoke checks passed; npm run build passed; npx --yes --package typescript tsc --noEmit passed; Playwright VERIFY_GEOSCAPE_INTERCEPT passed for GeoscapeState intercept button, InterceptState craft rows, ready craft transition to SelectDestinationState, cancel return, and BACK12 surface availability; Playwright VERIFY_GEOSCAPE_TARGET_CLICK passed for Globe.center/getTargets, GeoscapeState globeClick, single base target MultipleTargetsState routing, and base-scoped InterceptState; Playwright VERIFY_GEOSCAPE_DESTINATION passed for SelectDestinationState empty-point waypoint creation, MultipleTargetsState to ConfirmDestinationState routing, confirm/cancel waypoint persistence, Craft.returnToBase, Craft patrol destination clearing, and last-known waypoint redirect; Playwright VERIFY_GEOSCAPE_TIMERS passed for GeoscapeState time10Minutes low-fuel return-to-base popup queue and time5Seconds waypoint arrival CraftPatrolState queue/destination clearing/unused-waypoint cleanup; Playwright VERIFY_GEOSCAPE_UFO_ARRIVAL passed for lost-UFO last-known GeoscapeCraftState popup, crashed-UFO cargo ConfirmLandingState queue, and crashed-UFO no-payload return-to-base; Playwright VERIFY_GEOSCAPE_ALIEN_BASE_ARRIVAL passed for discovered alien-base payload ConfirmLandingState, no-payload return-to-base, and undiscovered-base no-popup/no-return behavior; Playwright VERIFY_GEOSCAPE_MISSION_SITE_ARRIVAL passed for mission-site payload ConfirmLandingState, ConfirmLanding yes mission-type setup, ConfirmLanding no return-to-base, and no-payload return-to-base; Playwright VERIFY_GEOSCAPE_DOGFIGHT_STARTUP passed for flying-UFO dogfight startup, four-dogfight cap, GMINTER music request, depth and airborne DogfightErrorState queues, minimized wait flags, and interception-processed reset; Playwright VERIFY_GEOSCAPE_TIME1HOUR passed for GameTime.advance/timeAdvance one-hour speed, ItemsArrivingState then ProductionCompleteState queue order, transfer removal, completed production removal, daily construction ProductionCompleteState, and monthly funding MonthlyReportState queue; Playwright VERIFY_GEOSCAPE_TIME30 passed for crashed-UFO expiry, refuel missing-item CraftErrorState, UFO detection UfoDetectedState, tracking-loss UfoLostState follower guard, and mission-site countdown/removal/follower guard; Playwright VERIFY_GEOSCAPE_TIME1DAY_RESEARCH passed for completed research discovery, Base.removeResearch scientist refund, ResearchCompleteState, NewPossibleResearchState, NewPossibleManufactureState, and STR_MOTION_SCANNER production unlock | CutsceneState research/end-game routes, SaveGameState autosave routes, alien-base supply missions, and full monthly alien mission determination pending; Full monthly psi training report flow and broader psionic training edge cases pending; Full moving-target save/load restoration and broader dogfight timer/fuel/runtime edge cases pending; Globe marker drawing/radar overlays and broader target visual fidelity pending |
| End-game statistics screen | Menu | integrated-verified | 88% | npm run build passed; npx --yes --package typescript tsc --noEmit passed; Playwright VERIFY_STATISTICS_STATE passed for memorial statistics button, 28-row statistics aggregation, END_NONE back navigation, and END_WIN main-menu return | End-game/cutscene/load-game routes still pending; Debriefing mission-stat population remains a battlescape/debriefing boundary; Full AlienBase save/load/target movement remains a geoscape persistence boundary |
| Geoscape funding monthly graphs | Geoscape | integrated-verified | 92% | worker reported npm run build and dist import smoke passed; npm run build passed; npx --yes --package typescript tsc --noEmit passed; Playwright VERIFY_GEOSCAPE_FUNDING_GRAPHS passed for GeoscapeState Funding/Graphs key wiring, SavedGame graph toggle roundtrip, GRAPH.BDY/GRAPHS.SPK resource availability, time1Month addMonth/monthly report queue, and popup push on think | CommendationState, CutsceneState, and SaveGameState child boundaries pending in MonthlyReportState follow-up routes; Full saved-game serialization for graph toggle strings and monthly history vectors pending; Full monthly alien mission determination remains with the broader GeoscapeState alien-strategy slice |
| Geoscape confirmations dogfight base defense | Geoscape | worker-build | 70% | worker reported npm run build, node --check, and ESM import smoke passed | Geoscape integration wiring pending; Craft destination/return-to-base and waypoint storage helpers pending; BriefingState and full mission generation boundaries pending; Dogfight sound/blob/runtime fidelity pending |
| Manage alien containment | Basescape | integrated-verified | 88% | npm run build passed; Playwright VERIFY_ALIEN_CONTAINMENT passed | Debriefing/other call-site integrations pending; Full live-alien sell/interrogation scenarios need broader save-game verification |

## Known Verification Signals

- `npm run build` is the fast runtime build gate.
- `npx --yes --package typescript tsc --noEmit` is the stricter type gate; it currently passes with no known unrelated boundary.
- Browser verifiers should be recorded by `VERIFY_*` marker and added to tracked slices after passing.

