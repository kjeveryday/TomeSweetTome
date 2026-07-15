# v1 independent verification — findings report

**Date:** July 15, 2026
**Scope:** The creature-care v1 core (`creature-care-mvp/`), as the fixed first backlog item defined in [`workspace-changes-2026-07-15.md`](workspace-changes-2026-07-15.md).
**Method:** Five independent reviewers, one per area, each attempting to *refute* the implementation against the PRD and `creature-care-mvp/BRIEF.md` by reading the source and writing adversarial tests. No reviewer wrote the code under review, and each worked without seeing the others' work. Reviewer tests live in `creature-care-mvp/test/verify-*.test.mjs`.

## Initial result

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

Beyond the edge case, this meant the code had **no reliable validation boundary**: a state missing a required field (`stats`) was accepted as readily as a legitimate pre-generator save missing only optional fields — a real risk once Phase 1 evolves the save format.

**Initial fix:** added `looksLikeGameState()` to reject wrong-shape states while leaving `creature` and `creatureHistory` optional so real pre-generator saves still load. The Phase 0 follow-up below completes the semantic checks for the required fields. This is a v1 validation boundary, not the versioned migration system required for Phase 1.

### 2. `ResourceGranted` with a non-finite amount poisoned CP

`src/state.js` sanitized negative grants with `Math.max(0, event.cp)`, but `Math.max(0, NaN)` is `NaN`, so a malformed hook firing `ResourceGranted(NaN)` set `cp` to `NaN` permanently — and no later valid grant could recover it (`NaN + 5 = NaN`).

**Fix:** `const grant = Number.isFinite(event.cp) ? Math.max(0, event.cp) : 0;` — a non-finite grant is ignored, matching the existing "negative grants are ignored" intent. Covered by `verify-cap-cp.test.mjs`.

### 3. `ResourceGranted` before hatching skipped Stage 1

`ResourceGranted` was the only event path with no `hatched` guard (care, clock, and growth all no-op while unhatched). A grant firing before hatch accumulated CP on the egg; the instant the creature hatched, the post-event growth check saw `cp ≥ 12` and jumped straight to Stage 2 — with zero care actions ever performed.

**Fix:** `if (!state.hatched) return state;` in the `ResourceGranted` case — a pre-hatch grant is **dropped**, making the event consistent with every other path.

> **Phase 0 decision:** keep the drop behavior. Reading activity will use its own records and events rather than care CP. Revisit pre-hatch rewards only if a separate reward source is deliberately added later.

## Cross-reviewer interaction (surfaced only by the full suite)

The persistence fix (defect 1) broke one **clock**-reviewer test that used a `{marker: N}` stub as stand-in game state to isolate the `lastSeen`-monotonicity contract — the new guard correctly rejects that non-GameState shape as corrupt. The fix is right; the stub was unrealistic. The test's actual assertion (`lastSeen` is monotonic across saves) is unchanged and still passes; only its fixture was updated to a valid `initialState()`. This is why synthesis runs the whole suite together rather than trusting each file in isolation.

Separately, four `verify-cap-cp.test.mjs` tests that originally *documented* defects 2 and 3 (titled `DEFECT: …`) were reframed as `regression: …` tests asserting the fixed behavior, so a green suite doesn't read as if the defects are still live. One intermediate assertion (`cp === 15` after a pre-hatch grant) became `cp === 0` to match the "drop" fix.

## Non-defect observations (for future consideration)

- **ISBN label grammar** (from the ISBN reviewer): `"ISBN-13:"` and bare `"ISBN:"` are accepted on manual entry, but `"ISBN13:"` (no hyphen) is rejected as invalid input. Neither the PRD nor BRIEF commits to a label grammar. Since the audience is children and parents typing ISBNs by hand, whether to accept that variant is a product decision.
- **Creature-history dedup** (from the ISBN reviewer): applying ISBNs in an A→B→A sequence can leave the same identity both active and present in `creatureHistory`, since history isn't deduplicated against the incoming identity. BRIEF only promises identities are "retained," so this is not a v1 violation. Identity uniqueness and repeated-scan behavior are Phase 1 collection acceptance requirements.
- **Dead defensive branch** (from the absence reviewer): the "a stat already above 60 is left at its decayed value" branch of the absence floor is unreachable under current tuning (any ≥36h absence decays both Fullness and Spirit to ≤60 first). It is implemented correctly; it only becomes live if the decay rates, absence threshold, or floor change.

## Phase 0 follow-up hardening — July 15, 2026

A follow-up review of this report found residual input-validation paths in the same failure family as the original defects:

- Required saved statistics were not checked individually, and other required numeric fields were checked only for finiteness. `looksLikeGameState()` now requires all three statistics to be finite and within the configured range, the stage to be configured, CP to be finite and nonnegative, and the action count to be a nonnegative integer. It also requires `dayKey` to be a string or `null` and every sticker identifier to be a string, while preserving unknown string identifiers for forward compatibility.
- A malformed `lastSeen` value could still enter clock math or poison later saves. A present value must now be a finite, nonnegative number; a missing value retains the documented `0` fallback. Invalid timestamps passed to `save()` no longer change the last valid timestamp or prevent the state from being saved.
- `CareActionPerformed.cpGranted` could still set CP to `NaN`. Malformed, non-finite, or negative grants are now treated as zero without suppressing the care effect or action count. Valid grants remain unchanged, and the care system still owns the daily-cap decision.

Pre-generator saves, extra forward-compatible fields, the `creatureCare.save.v1` key, and the `{state, lastSeen}` envelope retain their prior behavior. Full suite green: **177 tests pass**.

This follow-up establishes a v1 validation boundary. It deliberately does not add `schemaVersion` or implement the Phase 1 save migration.

## Exit criteria — met after Phase 0 follow-up

The independent v1 baseline verification and its Phase 0 input-hardening follow-up are closed. Phase 1 may begin with the PRD's required contract freeze: shared records, events, provider interfaces, feature flags, and a versioned save migration. Collection deduplication remains a Phase 1 collection requirement, not unfinished Phase 0 work.
