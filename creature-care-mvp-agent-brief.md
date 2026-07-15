# Creature Care MVP — Agent Build Brief

Instructions for a coding agent. Build in kernel order; do not start a kernel until the previous one is playable end to end.

## Vision

A cozy single-creature care prototype: hatch a creature, keep it happy through short daily visits (feed, play, tidy), and watch it grow through three stages over roughly two weeks of real time. The rhythm is a gentle daily appointment with an explicit stopping point. The creature never dies, never looks distressed, and always forgives absence. This is not a pressure game: no fail states, no notifications, no monetization, no social features. Sessions run under five minutes on one device.

## Kernel ladder

1. **Hatch & feed.** Tap egg → creature appears with a name and a mood; one Feed action changes mood with visible feedback. Playable: open app, hatch, feed, quit.
2. **The clock.** Stats drift on real time; a daily visit of up to 3 care actions; a tuck-in action ends the session with "see you tomorrow."
3. **Growth.** Care points accumulate toward three stages (hatchling → juvenile → grown) with a visible form change at each threshold.
4. **Absence & return.** Away 24h+ → creature naps and prepares a small gift; reopening plays a welcome-back moment. Never a penalty.
5. **Habitat (stretch).** Three decor slots bought with care points.

## Architecture contract

- `GameState` is the single source of truth. All mutations go through one `applyEvent(event)` reducer. UI reads state, never writes it.
- Systems, one responsibility each: **ClockSystem** (computes elapsed real time on app open, emits drift), **CareSystem** (validates and applies care actions), **GrowthSystem** (watches care points, triggers stage changes), **Persistence** (serializes GameState after every event).
- Systems communicate only via events: `CareActionPerformed`, `CreatureStateChanged`, `DayRolledOver`, `GiftGranted`. Also accept an external `ResourceGranted` event (future hook for reading or other apps) — handle it as bonus care points, but build no source for it.
- Content is data: species, actions, stat values, and thresholds live in one JSON/table file. No tuning numbers in code.
- No globals except GameState. No system reads another system's internals.

## Care rules (full spec)

Stats, all 0–100, floors at 0 with no punishment — low stats only change the idle animation to sleepy/peckish, never distressed:

- **Fullness**: decays 4/h. **Spirit**: decays 2/h. **Energy**: regenerates 5/h while the app is closed.
- Actions (daily cap: 3 actions grant care points; extra actions still animate and affect stats but grant 0 CP): **Feed** +30 Fullness · **Play** +25 Spirit, −10 Energy · **Tidy** +15 Spirit. Each capped action grants 1 CP; CP never decays.
- Mood is display-only, from the lowest stat: both Fullness and Spirit ≥70 → Beaming; ≥40 → Content; below → Peckish (if Fullness is lowest) or Sleepy (otherwise).
- Growth: Stage 2 at 12 CP (~4 days of full visits), Stage 3 at 30 CP (~10 more days).
- Tuck-in: ends the day's visit, dims the scene, states the return time in words ("see you tomorrow"). Nothing else to do afterward — the stop is designed in.

Edge cases, resolved:

1. Device clock moved backward → clamp elapsed time to ≥0; never subtract stats or CP.
2. Forward jump >72h → treat as 72h (casual time-skipping is fine; this is not anti-cheat, it just keeps absence logic sane).
3. Absence ≥24h → on open: wake-up scene, exactly one gift (cosmetic sticker), Fullness and Spirit set to max(current, 60). Repeated absences never stack gifts; at most one is pending.
4. App killed mid-action → state on reopen matches the last persisted event exactly.
5. All three stats at 0 simultaneously → mood shows Sleepy, creature naps; one Feed restores normal idle. No deeper "bad state" exists.

Worked example: install Tuesday 5pm, hatch (Fullness 80 / Spirit 80 / Energy 100). Full visit daily at 5pm. Wednesday 5pm pre-visit: Fullness 80−96 → 0 floor, shown Peckish, not suffering; Feed → 30, Play → Spirit 33+25=58, Tidy → 73, mood Content, 6 CP total. Friday's visit reaches 12 CP → Stage 2 that evening. Skip the weekend: Monday open → wake-up scene, one sticker, Fullness/Spirit at 60, CP still 12.

## Acceptance criteria

- Fresh install → hatched and first Feed completed within 60 seconds; no tutorial text over two lines.
- Set clock +26h → wake-up scene, exactly 1 gift, no stat below its pre-absence value. Set clock −5h → no change at all.
- 3 actions/day for 4 days → Stage 2 fires on day 4 at 12 CP; event log shows CP monotonically increasing.
- Kill the app mid-action, reopen → identical state.
- Grep the code for `30`, `12`, `70` etc. — no tuning numbers outside the content file.
- A complete visit (open → 3 actions → tuck-in) takes under 3 minutes.

## Scope fence

Refused for MVP: death/sickness/neglect states (breaks the cozy contract); push notifications (the return pull is affection, not nagging); multiple creatures, breeding, minigames; monetization of any kind; accounts or cloud sync; any reading/library integration (the `ResourceGranted` hook is the only concession).

## Assumptions

Engine and platform are the developer's choice; the spec assumes single-player, offline, local save. Tone targets ages 6–12: icon-first UI, minimal text. Real-time hours (not accelerated sim time) are deliberate — the daily-appointment rhythm is the retention mechanic, borrowed from the Animal Crossing/Neko Atsume lineage.
