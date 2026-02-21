Goal: Create a faithful TypeScript web port of OpenXcom Extended with close technical fidelity to the original C++ architecture.

Execution policy:
1. Continue rewrite work autonomously without waiting for "continue" prompts.
2. In each turn, complete at least one concrete parity step (code + tracker update + build/test when possible).
3. After finishing one step, immediately move to the next highest-priority backlog item in `ts/docs/REWRITE_TRACKER.md`.
4. Do not pause for planning-only responses unless explicitly requested.
5. Do not stop at "partial done" status updates. Status updates must be followed by implementation in the same turn.

Stop conditions:
1. Stop only when:
   1. The entire rewrite is complete, or
   2. A hard blocker prevents further progress (missing required assets, failing environment/tooling, or ambiguous conflicting source behavior).
2. If blocked, state the blocker and provide the smallest unblocking action needed, then continue with any unblocked work in parallel.

Scope and fidelity rules:
1. Prioritize architectural parity over prototype convenience.
2. Work module-by-module in large, coherent slices, always referencing corresponding C++ source files.
3. Keep TS code modular and maintainable, but do not introduce architecture that diverges from C++ behavior without documenting the reason in `ts/docs/REWRITE_TRACKER.md`.
4. Every touched parity slice must include source-to-target mapping entries in `ts/docs/REWRITE_TRACKER.md`.

Quality gate per slice:
1. Implement code changes.
2. Run `npm run build` in `ts/` (and any relevant tests if present).
3. Update `ts/docs/REWRITE_TRACKER.md` with what was completed and what remains.
4. Proceed directly to the next slice.
