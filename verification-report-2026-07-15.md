# v1 independent verification — findings report

**Date:** July 15, 2026
**Scope:** The creature-care v1 core (`creature-care-mvp/`), as the fixed first backlog item defined in [`workspace-changes-2026-07-15.md`](workspace-changes-2026-07-15.md).
**Method:** Five independent reviewers, one per area, each attempting to *refute* the implementation against the PRD and `creature-care-mvp/BRIEF.md` by reading the source and writing adversarial tests. No reviewer wrote the code under review, and each worked without seeing the others' work. Reviewer tests live in `creature-care-mvp/test/verify-*.test.mjs`.

## Result

**3 genuine defects found, all fixed and covered by regression tests. Full suite green: 164 tests pass** (63 original + 101 new adversarial), from `node --test test/` in `creature-care-mvp/`.

| Area | Verdict | Tests | Defects |
|---|---|---|---|
| Clock rules | HELD | 15 | 0 |
| Absence & gifts | HELD | 14 | 0 |
| Daily cap & CP | Defects found | 23 | 2 |
| Persistence & migration | Defect found | 19 | 1 |
| ISBN generator | HELD | 30 | 0 |

All three defects share a theme: **unvalidated input silently corrupting state rather than failing safe.** Two of them produce the identical end state — `cp` becomes `NaN`, which makes every future growth-threshold comparison false and permanently freezes the creature's growth with no error surfaced. This is exactly the class of latent fault the pass existed to find before Phase 1 builds on this core.

## Defects and fixes

### 1. Persistence `load()` accepted malformed saves (silent corruption)

`src/systems/persistence.js` `load()` guarded only on `data.state` being *truthy*, never on its shape. A save like `{state: {}}`, `{state: [1,2,3]}`, or `{state: "garbage"}` passed through to the reducer instead of being rejected as corrupt. The reviewer showed `{state: []}` then a single feed yields `cp: NaN` — silent, permanent growth freeze. Spec requires corrupt/foreign saves to load as `null` (fresh start); "no crash" held, but "fresh start" did not.

Beyond the edge case, this meant the code had **no migration boundary**: a state missing a required field (`stats`) was accepted as readily as a legitimate pre-generator save missing only optional fields — a real risk once Phase 1 evolves the save format.

**Fix:** added `looksLikeGameState()` — requires the core fields (`hatched`, `stats`, `stage`, `cp`, `actionsToday`, `dayKey`, `stickers`) with correct types, while leaving `creature`/`creatureHistory` optional so real pre-generator saves still load. Verified: rejects all five malformed shapes (`verify-persistence.test.mjs` B7–B11), still accepts a genuine pre-generator save (D1) and a fresh initial state.

### 2. `ResourceGranted` with a non-finite amount poisoned CP

`src/state.js` sanitized negative grants with `Math.max(0, event.cp)`, but `Math.max(0, NaN)` is `NaN`, so a malformed hook firing `ResourceGranted(NaN)` set `cp` to `NaN` permanently — and no later valid grant could recover it (`NaN + 5 = NaN`).

**Fix:** `const grant = Number.isFinite(event.cp) ? Math.max(0, event.cp) : 0;` — a non-finite grant is ignored, matching the existing "negative grants are ignored" intent. Covered by `verify-cap-cp.test.mjs`.

### 3. `ResourceGranted` before hatching skipped Stage 1

`ResourceGranted` was the only event path with no `hatched` guard (care, clock, and growth all no-op while unhatched). A grant firing before hatch accumulated CP on the egg; the instant the creature hatched, the post-event growth check saw `cp ≥ 12` and jumped straight to Stage 2 — with zero care actions ever performed.

**Fix:** `if (!state.hatched) return state;` in the `ResourceGranted` case — a pre-hatch grant is **dropped**, making the event consistent with every other path.

> **Product question (flagged, not blocking):** "drop" vs. "defer" is a design choice the reviewer declined to presume. Dropping is the conservative default and strictly better than the current stage-skip. If Phase 1's reading integration should let CP earned *before* a child hatches their first creature carry over, that is a deliberate feature to add later — revisit this fix then.

## Cross-reviewer interaction (surfaced only by the full suite)

The persistence fix (defect 1) broke one **clock**-reviewer test that used a `{marker: N}` stub as stand-in game state to isolate the `lastSeen`-monotonicity contract — the new guard correctly rejects that non-GameState shape as corrupt. The fix is right; the stub was unrealistic. The test's actual assertion (`lastSeen` is monotonic across saves) is unchanged and still passes; only its fixture was updated to a valid `initialState()`. This is why synthesis runs the whole suite together rather than trusting each file in isolation.

Separately, four `verify-cap-cp.test.mjs` tests that originally *documented* defects 2 and 3 (titled `DEFECT: …`) were reframed as `regression: …` tests asserting the fixed behavior, so a green suite doesn't read as if the defects are still live. One intermediate assertion (`cp === 15` after a pre-hatch grant) became `cp === 0` to match the "drop" fix.

## Non-defect observations (for future consideration)

- **ISBN label grammar** (from the ISBN reviewer): `"ISBN-13:"` and bare `"ISBN:"` are accepted on manual entry, but `"ISBN13:"` (no hyphen) is rejected as invalid input. Neither the PRD nor BRIEF commits to a label grammar. Since the audience is children and parents typing ISBNs by hand, whether to accept that variant is a product decision.
- **Creature-history dedup** (from the ISBN reviewer): applying ISBNs in an A→B→A sequence can leave the same identity both active and present in `creatureHistory`, since history isn't deduplicated against the incoming identity. BRIEF only promises identities are "retained," so this is not a violation — flagged for whenever the collection UI is designed.
- **Dead defensive branch** (from the absence reviewer): the "a stat already above 60 is left at its decayed value" branch of the absence floor is unreachable under current tuning (any ≥36h absence decays both Fullness and Spirit to ≤60 first). It is implemented correctly; it only becomes live if the decay rates, absence threshold, or floor change.

## Exit criteria — met

Per the backlog item's definition of done: every refutation attempt ended either as an invariant confirmed with evidence, or a defect found → fixed → covered by a new test; all five areas were reviewed; this report is committed; and the full suite is green (164 tests). **The independent baseline verification item is closed.**
