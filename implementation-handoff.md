# Stacklings MVP implementation handoff

Status date: July 15, 2026

Branch: `main`

Current commit: `0c174fa` (`feat: add distinct-day reading progress`)

Working tree at handoff: clean before this documentation-only handoff

Required test command: from `creature-care-mvp/`, run `node --test test/`

## Completed implementation

Phase 0 and Phase 1 packages 1–3 are complete:

1. Shared contracts, schema-v2 storage, deterministic v1 migration, feature flags, provider seams, and contract tests.
2. Work/edition records, ISBN and provider identities, metadata provenance, aliases, title-and-author search, repeated-capture handling, and late work reconciliation.
3. Explicit standalone challenge registration, reading records, atomic distinct-day progress, 0/10/20-day status, book statuses, optional timer, and interrupted-timer recovery.

The current suite is 270/270 passing. Package 3 was independently reviewed for reading semantics, migration/contracts, and care/clock isolation. Browser checks passed for challenge start, untimed reading, several books on one date, a later simulated date, timer start/stop/cancel, one-time interrupted-timer recovery, persistence, and timer-off behavior.

Completed commits, oldest to newest:

- `fa354ce` — `feat: freeze shared contracts and migrate v1 saves`
- `9867f69` — `feat: add book records and stable work identities`
- `0c174fa` — `feat: add distinct-day reading progress`

Nothing has been pushed.

## Approved product decisions now encoded

- Non-ISBN works use `stacklings:work:v1` with the stable provider work key and neutral ISBN-only trait defaults.
- If later metadata reconciles two already-owned creatures, both remain with unchanged identities and traits.
- Standalone participation begins through an explicit local “Start challenge” action, uses 20 distinct reading days with halfway at 10, and has no deadline.
- An interrupted timer discards duration. On reload, a work-only marker may show one neutral prompt asking whether to record ordinary untimed reading; Yes records without duration and No clears it.
- Reading events cannot grant CP, change care, trigger growth, or affect absence behavior. Growth checks are restricted to authorized CP-changing event chains.
- A save cannot contain reading records or formal days before challenge registration.

## Next dependency: Package 4

Package 4 is the next untouched work package: preview, first-reading reveal, collection, active selection, and repeated scans. A clean 270-test baseline was rerun immediately before handoff. No Package 4 source or test files were created, and no Package 4 changes were integrated.

Start by reading Package 4 in `ordered-development-backlog.md` and PRD section 6.5. Preserve these boundaries:

- Scanning or searching creates a deterministic preview, not an owned collection creature.
- The first accepted `ReadingRecorded` for the work reveals and adds its existing preview.
- Repeated captures open the existing preview or collection record and never reroll identity.
- One work normally has one creature; the validated late-reconciliation exception may retain both previously owned creatures.
- Several books read on one date may reveal several creatures while formal progress remains one day; present the reveals as one compact group.
- Keep one active creature, configurable visible IDs, and an unbounded archived collection.
- Selecting a migrated creature with `careState: {status: "uninitialized"}` must initialize a complete nonpunitive care state before it becomes active.
- Do not implement Package 5 relationship responses, treats, or any parking-lot mechanic while doing Package 4.

Recommended ownership split:

- One collection agent exclusively owns new `src/systems/collection.js` and `test/collection.test.mjs`.
- The integration owner alone edits `contracts.js`, `events.js`, `state.js`, `migration.js`, `app.js`, `ui.js`, shared styles/copy, and shared tests.
- Require read-only review from the reading consumer and care/clock consumer before committing shared contract changes.

Likely shared integration work to evaluate, not pre-decided here:

- Whether unrevealed previews need a separate persisted `collection.previews` map or another validated representation.
- Expanding `CreaturePreviewCreated` so replay contains enough validated preview data for the reducer.
- Event order for `BookAdded` → preview and `ReadingRecorded` → `CreatureRevealed` → optional `ActiveCreatureChanged`.
- How a first-ever reveal becomes active without changing preserved hatch/care behavior, and how later reveals avoid silently switching the active creature.

## Remaining later-package decisions

The unresolved questions for Package 5 and Package 9 remain recorded at the end of `ordered-development-backlog.md`: inactive-creature care scope, relationship response content/order, treat cadence/content, and library availability vocabulary/freshness.

## Verification before continuing

1. Confirm `git status --short` is empty.
2. Confirm `git rev-parse --short HEAD` is `0c174fa` or the documentation-only handoff commit that follows it.
3. Run `node --test test/` from `creature-care-mvp/` and expect 270 passing tests.
4. Do not start parallel feature edits until the Package 4 shared preview/reveal representation is frozen and its contract/migration tests are green.
