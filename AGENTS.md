# OpenXcom Browser TypeScript Port - Agent Memory

This repo is being translated from OpenXcom C++ into a browser TypeScript port under `web/`. Treat this file as project-local operating memory for future agents.

## Mission

Translate the game faithfully into TypeScript for the browser.

The C++ source in `src/` is the authority. The TypeScript target in `web/src/` should preserve as much as practical:

- class names, method names, file grouping, enum names, constants
- UI ids, `setInterface()` categories, `add()` element ids
- coordinates, dimensions, list columns, row order, resource names
- control flow, algorithms, state-stack behavior, and save/model semantics

Do not invent a simpler game. Translate the game that is already written and debugged in C++.

## Reusable Skill

A local skill exists at:

`C:\Users\stoia\.codex\skills\openxcom-ts-port`

Use it for this project. Keep it updated when repeated lessons appear.

Every failure is a learning moment. After a failed build, verifier, merge, or assumption, ask what assumption was wrong and encode the improved rule in this file or the skill.

## Work Style

- Inspect the current worktree before trusting memory.
- Use `rg` / `rg --files` first.
- Read the C++ `.cpp` and `.h` before editing TypeScript.
- Read nearby translated TypeScript patterns before introducing a new style.
- Use `apply_patch` for manual edits.
- Do not revert unrelated user or agent changes.
- Keep generated `web/dist` as build output from `web/src`; regenerate with `npm run build`.
- Keep `web/PORTING.md` current after completed slices.

## Bulk Translation

Use subagents aggressively when the user asks for scale. Split by disjoint write scopes:

- One worker for one UI family, such as crafts, research, manufacture, diary, psi training.
- One worker for model/rules support, such as `StatString`, `ResearchProject`, `Production`, diary stats.
- One worker for verification or source analysis when integration can proceed locally.

Worker prompt requirements:

- Name exact C++ source files.
- Name exact TypeScript write scope.
- Tell workers they are not alone in the codebase and must not revert others.
- Require C++ ids/coordinates/algorithms to be preserved.
- Require final changed-file list, build result, and explicit pending source boundaries.

Reliable spawning lessons:

- Treat worker IDs as exact opaque values. Copy them from `spawn_agent` output or `agent_path`; do not retype from memory.
- Keep an active assignment ledger mentally or in notes. Before spawning, check active workers' owned files; do not assign a file just because it looks small.
- Close completed workers promptly to free slots, then spawn replacement work with a new disjoint write scope.
- Avoid giving workers hot integration files unless their slice owns that integration. Keep `BasescapeState.ts`, `GeoscapeState.ts`, shared model files, and `web/PORTING.md` under the main integrator unless explicitly assigned.
- Worker final answers must be summary-first: changed files, build/verifier result, pending boundaries. The main agent should not need to read the whole implementation before deciding the next integration target.
- A failed close, merge conflict, or unexpected worker edit is an assumption audit: check whether IDs, ownership, or prompt boundaries were too loose and tighten the next prompt.

Model-use experiments:

- Use Spark only for small, isolated translation shells or source scans with exact write scopes and forbidden hot files. Judge it by scope obedience, build cleanliness, source fidelity, and summary quality before scaling.
- Do not use Spark for shared model integration, cross-slice merge resolution, verifier diagnosis, or files already owned by active workers.
- Use higher-effort frontier reasoning for ambiguous source semantics, multi-file integration, and failure analysis. Simple wiring, docs updates, and mechanical verifier edits usually do not need extra-high effort.

Experiment log discipline:

- Record experiments as hypothesis -> result -> rule.
- Keep entries short and actionable; do not paste long transcripts.
- Promote repeated successful results into the main workflow; promote failures into guardrails.
- Track model/tool experiments separately from game translation progress so percentage reports stay about the port, not the process.
- Canonical learning entry schema: assumption -> observed result -> corrected rule -> location changed -> impact.
- Where to log: put experiment/journey details in `AGENTS.md`; put only durable generalized rules in the `openxcom-ts-port` skill to avoid drift.

Resource discipline:

- Prefer one focused verifier over broad repeated checks when credits are tight.
- Do not spawn new sidecars just to be busy; spawn only when their output will change the next integration decision.
- Reuse existing dashboard/build/typecheck signals instead of rerunning all gates after docs-only edits.
- Save high-effort reasoning for integration failures, source ambiguity, and cross-file model work.

Percentage definitions:

- File path parity: generated by `npm run status`; same-path source units with matching `web/src` TypeScript files divided by total source units.
- Slice percent: human estimate of source behavior translated for the named planned source files, after subtracting explicit pending boundaries.
- Area percent: human estimate for a gameplay/system area, informed by path parity plus integrated/verified slice status.
- Whole-port percent: conservative human estimate of playable browser parity, not just file count.

Integration is single-threaded. Review worker changes, resolve overlaps, run build, then run focused browser verification.

Context management rule: keep workers focused on translation details and the main agent focused on integration. Do not load every worker's full implementation into main context immediately. First read the worker's final summary and changed-file list, then inspect only the files for the slice currently being integrated.

## Context Packets

Use generated context packets to avoid rereading long narrative files after compaction or before spawning workers:

```powershell
cd web
npm run context
npm run context -- --slice "Geoscape popup batches"
npm run context:readonly
npm run context:worker
npm run agents
npm run agents:prompt -- --role readonly --task "audit time30Minutes support" --scope "src/Geoscape/GeoscapeState.cpp; web/src/Geoscape/GeoscapeState.ts"
```

This refreshes `web/translation-status.json`, then writes `web/CONTEXT_PACKET.md` and `web/context-packet.json`.

- Read `web/CONTEXT_PACKET.md` first after a resume or compaction.
- Use `--slice` when a sidecar or worker should focus on one named slice instead of the default active slice.
- Use `npm run context:readonly` for audit/source-scan sidecars and `npm run context:worker` for bounded code workers; both generate prompt skeletons and reduce hand-written prompt context.
- Use `npm run agents:start` before spawning an agent to record its exact id/scope, then `npm run agents:close` when it returns. The ledger refuses overlapping active scopes unless `--allow-overlap` is explicitly passed after review.
- Use `npm run agents:prompt` to generate compact handoff prompts from the current context packet instead of rewriting the full project rules by hand.
- For no-fork read-only sidecars, pass only the packet plus the exact file list to inspect.
- For worker agents, pass the packet's active slice fields, exact write scope, forbidden hot files, boundaries, and final-format requirements.
- Regenerate the packet after changing `web/translation-slices.json`, finishing a verified micro-path, or changing the active integration queue.
- Treat `web/TRANSLATION_STATUS.md` as generated dashboard output and `AGENTS.md` as policy/learning memory, not as the live numeric source.
- `web/agent-ledger.json` is ignored local coordination state; the durable rule is the script/workflow, not the session-specific agent list.

## Translation Pattern

For each slice:

1. Read source C++ and headers.
2. Identify existing translated dependencies.
3. Add only helpers required by the source path.
4. Preserve source-shaped boundaries for unported child states.
5. Wire call sites only after the translated state exists.
6. Build.
7. Verify behavior in browser when UI/runtime changed.
8. Clean temporary verifier artifacts.
9. Update `web/PORTING.md`.
10. Report translation percentages.

## Browser Verification

Use Playwright CLI verifiers for UI/runtime slices.

Temporary verifier file shape:

```js
async page => {
  await page.goto("http://127.0.0.1:4173/web/index.html");
  await page.waitForFunction(() => window.openxcomGame?.getMod());
  const result = await page.evaluate(async () => {
    // import from /web/dist, build source-shaped save/model state,
    // push translated states, drive handlers, assert model/text/list behavior.
    return { ok: true };
  });
  await page.evaluate(value => console.log(`VERIFY_SLICE ok ${JSON.stringify(value)}`), result);
}
```

Important learned verifier rules:

- Wait for the specific rules and language strings needed, not just `getMod()`.
- Console logs from Node-side `console.log` may not enter the browser log; emit `VERIFY_*` via `page.evaluate`.
- For large Playwright verifier bodies on Windows, store the script under `output/playwright`, load it from the page with `page.evaluate(fetch(...).text())`, and execute it through a short `run-code` wrapper.
- File-backed verifier text must be an expression when wrapped as `eval('(' + text + ')')`; omit the trailing semicolon after the top-level `async page => { ... }`.
- When checking queued geoscape popups, call the translated state `think()` after the timer method because C++/TS queue popups first and push them to the game stack in the next think cycle.
- Directly driving state handlers is often faster and more reliable than pixel clicking.
- Check model state, list text, row ordering, visibility flags, and source-specific side effects.

Cleanup after browser checks:

- close Playwright CLI browser
- delete the temporary `output/playwright/verify-*.js`
- remove `.playwright-cli`
- remove temporary `open-out.log` / `open-err.log`

Do not delete existing screenshot evidence in `output/playwright` unless it was created as a temporary artifact for the current check.

## Current Lessons

- The user values faithful source translation over new design.
- A passing build is not enough; Node's type stripping can hide type-only missing imports.
- When adding typed fields, inspect imports manually.
- Temporary reflective helpers such as `call()` / `callArray()` are allowed only as explicit boundaries; once the owning model slice lands, replace them with typed source-shaped methods.
- For an ephemeral TypeScript check, use `npx --yes --package typescript tsc --noEmit` or `tsc --version`; `npx --yes typescript ...` fails because the package name is not the executable name.
- When a screen uses `BACK*.SCR`, add manifest and `Mod.loadOptionalScrSurface()` support if missing.
- Memorial/dead-soldier screens reverse the dead-soldier list and pass null base into `SoldierInfoState`.
- Soldier armor and sack behavior must return old armor to stores exactly as the C++ does.
- PowerShell expands `$skill-name` inside double-quoted strings; quote or escape skill metadata carefully.
- Failed verifier waits usually mean the wait condition was too weak. Wait for the exact loaded rules/language needed by the screen.
- Browser load is staged; waiting for one rule family is not enough when the scenario needs later data such as `startingBase.rul`. Wait for the complete model scenario that the verifier will use.
- Verifiers must respect source click guards. Do not assume row 0 is actionable when C++ filters by state such as `craft.getStatus() != "STR_OUT"`; select a model row that satisfies the source condition.
- Direct-handler verifiers must use the translated source handler names exactly, including original casing such as `btnOKClick` versus `btnOkClick`.
- Every fix should trigger an assumption audit, then a durable rule update.
- Protect context: delegate detailed source reading to workers, then integrate one returned slice at a time from changed files and summaries.
- Reliable agent spawning depends on exact copied IDs, disjoint write scopes, explicit forbidden files, and summary-first worker output.
- For progress/doc audits, use no-fork read-only sidecars with a tight file list; the main agent should keep integration and verification decisions local.
- Treat model choice as an experiment with feedback: record which tasks Spark handles safely and where it should be avoided; do not spend extra-high reasoning on low-ambiguity mechanical work.

## Experiment Log

- Hypothesis: Spark can handle small isolated translation shells. Result: first Spark spawn was shut down because its files overlapped an active worker before edits landed. Rule: check active assignment ownership before every spawn, including small files.
- Hypothesis: `npx --yes typescript --version` can check the TypeScript version. Result: npm could not determine the executable. Rule: use `npx --yes --package typescript tsc ...`.
- Hypothesis: waiting for loaded craft rules is enough for basescape craft verifier setup. Result: `newSave()` could still lack starting craft data. Rule: wait for the complete scenario data the verifier will use.
- Hypothesis: an ephemeral `tsc --noEmit` can provide useful extra signal even though the project builds with Node type stripping. Result: TypeScript 6.0.3 found two local `StatisticsState` type issues and two broader `SavedGame.getDifficultyCoefficient()` battlescape boundaries. Rule: fix localized new slice errors; do not derail integration into unrelated model gaps.
- Assumption: the learning docs were clear enough after adding an experiment log. Observed result: self-improvement sidecar found duplication risk and undefined percentage metrics. Corrected rule: `AGENTS.md` is canonical for experiments; the skill stores durable rules; percentages use defined meanings. Location changed: `AGENTS.md` experiment discipline and percentage definitions. Impact: future progress reports should be comparable instead of vibes-based.
- Assumption: path-parity coverage alone would be a useful progress metric. Observed result: progress watcher found it internally consistent but easy to overread, especially `Basescape` at 100% path parity while behavior boundaries remain. Corrected rule: show status rollups, next integration queue, and slice path warnings beside path parity. Location changed: `web/scripts/translation-status.mjs`, `web/TRANSLATION_STATUS.md`, `web/translation-status.json`. Impact: dashboard now separates file inventory from integration/verification state.
- Assumption: more parallel checks are always better. Observed result: user warned credits are low. Corrected rule: when credits are tight, finish the current integration with the narrowest proof, avoid speculative sidecars, and defer broad checks unless code changed in that risk area. Location changed: `AGENTS.md` resource discipline. Impact: keep throughput while respecting reset/credit pressure.
- Assumption: a small manual JSON slice edit was too simple to need immediate structural inspection. Observed result: the first patch left a duplicate `status` key before it was caught by targeted review. Corrected rule: after hand-editing dashboard JSON, inspect the edited slice before generating status because duplicate JSON keys can parse silently. Location changed: `AGENTS.md` experiment log. Impact: prevents misleading progress data.
- Assumption: waiting for soldier rules was enough before a stat-string verifier called `newSave()`. Observed result: mod loading is staged and `newSave()` could run before starting-base soldiers were populated. Corrected rule: wait for the full scenario signal needed by the verifier, or test the direct source hook (`Mod.genSoldier()`) when that is the behavior under integration. Location changed: `AGENTS.md` experiment log. Impact: avoids false verifier failures from partially loaded browser mod state.
- Assumption: a psi-training verifier could assert a hard row count and literal `YES`/`NO` text. Observed result: starting soldiers can already exist and loaded language strings may differ in case/text. Corrected rule: map model rows back to the specific object under test and compare UI labels through `Language.getString()`. Location changed: `AGENTS.md` experiment log. Impact: focused UI verifiers stay source-shaped without being brittle to scenario population or localization.
- Assumption: adding `SoldierDiary` ownership to `Soldier` could use ordinary runtime imports. Observed result: the browser failed before game init with `Cannot access 'State' before initialization` because savegame startup pulled battlescape/UI runtime through diary dependencies. Corrected rule: when attaching model helpers to startup-owned types, keep heavy downstream modules type-only or mirror tiny numeric enums locally, then verify page startup. Location changed: `SoldierDiary.ts`, `Soldier.ts`, `SavedGame.ts`, and `AGENTS.md`. Impact: soldier diaries are owned by soldiers without creating import cycles.
- Assumption: `SavedGame.getDifficultyCoefficient()` could be closed with a local difficulty-number fallback. Observed result: C++ uses the mutable `Mod::DIFFICULTY_COEFFICIENT` table, which rulesets can override through `vars.rul`. Corrected rule: translate shared C++ statics as shared TS statics when multiple source owners need them, instead of hardcoding a caller-local fallback. Location changed: `ModStatics.ts`, `Mod.ts`, `SavedGame.ts`, and `AGENTS.md`. Impact: strict `tsc --noEmit` is clean and AI/dogfight/monthly code read the source-shaped coefficient table.
- Assumption: `/status` rate-limit data was unavailable to the agent because it was only visible in the TUI. Observed result: Codex writes machine-readable `token_count` events with `rate_limits` into `~/.codex/sessions/**/*.jsonl`, and the installed/open-source CLI can be inspected before assuming a feature is inaccessible. Corrected rule: check Codex source/install files and local session JSONL for tool-state data, then build small local readers when useful. Location changed: `tools/codex-status.mjs` and `AGENTS.md`. Impact: main-agent budget decisions can use `node tools/codex-status.mjs --session <id>` without waiting for pasted `/status`.
- Assumption: `playwright-cli run-code` could accept a whole verifier body or import a local verifier module. Observed result: Windows hit command-line length limits, CLI `run-code` lacked a dynamic import callback, and CLI-side `fetch` was unavailable. Corrected rule: keep large verifiers in temporary `output/playwright/verify-*.js` files, load the file text from the browser page, execute it with a short wrapper, and emit `VERIFY_*` from `page.evaluate`. Location changed: `AGENTS.md` and the temporary statistics verifier. Impact: future UI checks can stay compact in chat context while remaining reproducible.
- Assumption: doc/progress auditing needed the main agent's full context. Observed result: a no-fork Spark sidecar with a strict read-only file list produced a concise statistics-slice doc audit while the main agent continued verification. Corrected rule: use no-fork sidecars for bounded audits that save context, then let the main agent reconcile stale or conservative recommendations against local build/verifier evidence. Location changed: `AGENTS.md`. Impact: parallel work can improve throughput without flooding the main context.
- Assumption: a worker-built geoscape popup batch should wait until the entire batch can be integrated before status changes. Observed result: the source-backed `GeoscapeState::btnInterceptClick` path could be integrated and browser-verified independently, while timer/monthly/target popups remain broader boundaries. Corrected rule: for large worker batches, promote verified micro-paths to `partial-integrated-verified`, keep the full slice active, and document the next integration boundary explicitly. Location changed: `GeoscapeState.ts`, geoscape resource manifest loading, `translation-slices.json`, and `PORTING.md`. Impact: progress becomes measurable without pretending the whole batch is done.
- Assumption: a save/model class can stay a narrow shell until its direct methods are needed. Observed result: `Globe.getTargets()` exposed that `AlienBase` inherits `Target` in C++ and needs longitude, latitude, id, and name/default-name behavior before it can be used honestly as a globe target. Corrected rule: when a translated C++ class inherits a shared source base like `Target`, translate the inherited contract at the first real consumer instead of casting around missing methods. Location changed: `AlienBase.ts`, `SavedGame.ts`, `Globe.ts`, and `AGENTS.md`. Impact: geoscape target picking can use typed target methods and strict `tsc --noEmit` remains clean.
- Assumption: future agents could save context by manually skimming `AGENTS.md`, `PORTING.md`, and generated status docs. Observed result: the docs contain useful but duplicated narrative, while workers only need a compact active-slice packet with source files, target files, boundaries, forbidden hot files, and verification commands. Corrected rule: use `npm run context` to generate `web/CONTEXT_PACKET.md` and `web/context-packet.json`, then pass only the relevant packet fields to sidecars/workers. Location changed: `web/scripts/context-pack.mjs`, `web/package.json`, `AGENTS.md`, `web/PORTING.md`, and the `openxcom-ts-port` skill. Impact: resumed turns and subagents start from a small generated handoff instead of filling context with long status prose.
- Assumption: a local popup-only `Waypoint` class was enough until full geoscape runtime integration. Observed result: destination confirmation, saved waypoints, craft return/patrol, target lists, and later timers all need the same source `Target` / `MovingTarget` / `Waypoint` contract. Corrected rule: when a screen-local class is actually a C++ savegame/model class, promote it to the matching `web/src/Savegame` file before wiring more callers. Location changed: `Target.ts`, `MovingTarget.ts`, `Waypoint.ts`, `Craft.ts`, and geoscape destination popups. Impact: popup code now calls source-shaped craft/target methods instead of optional runtime shims.
- Assumption: `playwright-cli run-code` could be wrapped in PowerShell single quotes with an unparenthesized fetched verifier body. Observed result: the CLI produced JavaScript parse errors before running the verifier. Corrected rule: on PowerShell, pass a double-quoted `async (page) => { ... }` wrapper and evaluate fetched verifier text as `eval('(' + text + ')')`. Location changed: `AGENTS.md`; temporary verifier was cleaned after use. Impact: future file-backed browser verifiers avoid command-line length limits and PowerShell parse traps.
- Assumption: a read-only sidecar summary can be taken as source fact after a tight prompt. Observed result: the sidecar correctly identified the useful low-fuel/waypoint micro-path but misstated part of the C++ `time5Seconds()` guard, which local source inspection caught. Corrected rule: use sidecars to shortlist branches and verifier ideas, but reconcile any detailed control-flow claim against the exact C++ before editing integration files. Location changed: `AGENTS.md`. Impact: parallelism still saves context, while the main integrator remains responsible for source fidelity.
- Assumption: local agent-ledger mutations could be run in parallel like read-only shell inspections. Observed result: two simultaneous `npm run agents:start` calls raced on the same JSON ledger and each command only reported its own active record; the spawned read-only agents still completed, but ledger state was unreliable. Corrected rule: run ledger start/close mutations sequentially; only parallelize read-only inspections or independent build/status commands. Location changed: `AGENTS.md` and `openxcom-ts-port` skill. Impact: sidecar coordination stays trustworthy while still using agents for bounded source audits.
- Hypothesis: Spark can safely handle tight read-only source audits for context saving. Result: two Spark explorers produced useful summary-first audits for graph persistence and Geoscape wiring, but one verifier assumption about January-equivalent month labels required main-thread source reconciliation. Rule: Spark is useful for bounded read-only checklists; the integrator must still verify detailed source semantics before patching.
- Assumption: all craft-to-UFO arrival behavior had to wait for full dogfight scheduling. Observed result: several C++ `time5Seconds()` UFO branches are independent and verifiable now: lost UFO last-known waypoint, destroyed/crashed no-payload return, and payload landing confirmation. Corrected rule: split timer integration by source branch when a branch has a stable translated popup/model surface, and leave only the actually coupled branch as the boundary. Location changed: `GeoscapeState.ts`, `translation-slices.json`, `PORTING.md`, and `AGENTS.md`. Impact: Geoscape progress moves without forcing premature dogfight scheduler integration.
- Assumption: a geoscape popup verifier could assert the top game state immediately after calling `time5Seconds()`. Observed result: `GeoscapeState.popup()` queues the state and `GeoscapeState.think()` pushes it on the stack, matching the C++ deferred popup flow. Corrected rule: verifier setup for timer-driven geoscape popups must call the timer method, then the state's `think()`, then assert the game stack. Location changed: `AGENTS.md`; temporary alien-base verifier was corrected and cleaned. Impact: avoids false negatives while preserving the original queued-popup lifecycle.
- Assumption: the existing context packet was enough for all subagent roles. Observed result: a read-only tooling sidecar found the packet still exposed long verification prose, stale session-specific status commands, and hand-written prompt work. Corrected rule: generate role-specific context packets and prompt skeletons with short `VERIFY_*` markers, no hardcoded Codex session id, and documented `--slice` use. Location changed: `web/scripts/context-pack.mjs`, `web/package.json`, `AGENTS.md`, and `web/PORTING.md`. Impact: main-thread context is smaller and subagent prompts are more repeatable.
- Assumption: a file-backed Playwright verifier could keep the natural trailing semicolon after `async page => { ... }`. Observed result: `eval('(' + text + ')')` parsed `(async page => { ... };)` and failed before running the verifier. Corrected rule: temporary verifier files loaded as expressions must omit the top-level trailing semicolon. Location changed: `AGENTS.md` and `openxcom-ts-port` skill. Impact: future file-backed verifiers avoid a preventable parse failure.
- Assumption: a clean `npm run build` after timer integration was enough to proceed to browser verification. Observed result: build passed, but `tsc --noEmit` caught a missing `CraftErrorState` import that would have broken the `time1Hour` rearm-error branch. Corrected rule: after adding any geoscape popup branch, run strict typecheck before the browser verifier even if the build passes. Location changed: `GeoscapeState.ts` and `AGENTS.md`. Impact: keeps source-branch imports honest despite Node type stripping.
- Assumption: `timerReset()` should unpause the translated geoscape timer because many popup buttons use it before returning to geoscape. Observed result: C++ `timerReset()` only presses the 5-seconds speed button; `_gameTimer` still ticks once after popups and `timeAdvance()` clears `_pause`. Corrected rule: keep `timerReset()` speed-only and let geoscape `think()` run `_gameTimer.think()` even when `_pause` is true but no popup/dogfight is active. Location changed: `GeoscapeState.ts` and `AGENTS.md`. Impact: queued popup flows can resume without inventing pause semantics.
- Assumption: the current context packet alone was enough to coordinate parallel agents. Observed result: completed read-only sidecars were useful, but active ownership still depended on main-thread memory and copied chat IDs. Corrected rule: use `web/scripts/agent-ledger.mjs` to generate prompts and record active agent ids/scopes before spawning, then close them promptly. Location changed: `web/scripts/agent-ledger.mjs`, `web/package.json`, `web/scripts/context-pack.mjs`, and `AGENTS.md`. Impact: future bulk translation can use more agents with lower collision/context risk.
- Assumption: a Geoscape verifier could use `mod.newSave().getBases()[0]` once core rule lists were loaded. Observed result: the first browser run hit an empty/incomplete fixture before the populated starting-base scenario was ready. Corrected rule: wait for the exact `newSave()` scenario shape and select the base with the needed facilities/craft instead of assuming base index 0. Location changed: temporary `VERIFY_GEOSCAPE_TIME30` verifier and `AGENTS.md`. Impact: future timer verifiers should fail on translated behavior, not staged fixture setup.
- Assumption: `STR_LASER_WEAPONS` would directly unlock `STR_LASER_PISTOL` manufacture in a daily-research verifier. Observed result: the original xcom1 manufacture rule for `STR_LASER_PISTOL` requires `STR_LASER_PISTOL`, while `STR_LASER_WEAPONS` only unlocks that separate research topic. Corrected rule: for research/manufacture verifiers, inspect the parsed `manufacture.rul` requirements and pick a topic whose completed research name exactly satisfies the intended manufacture rule, such as `STR_MOTION_SCANNER`. Location changed: temporary `VERIFY_GEOSCAPE_TIME1DAY_RESEARCH` verifier and `AGENTS.md`. Impact: verifier fixtures now follow original rules instead of assumed tech-tree semantics.

## Reporting Progress

When finishing a slice, include:

- what source files were translated
- what TypeScript files changed
- verification commands/results
- explicit pending source boundaries
- translation percentage for the slice, the area, and the whole browser port

Do not mark the overall goal complete until the full browser TypeScript game translation is actually complete and verified against the original scope.
