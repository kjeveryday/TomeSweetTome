# Workspace changes — July 15, 2026

Record of the workspace review and cleanup performed on July 15, 2026. These changes reorganized documents and infrastructure only; no application code or test behavior changed. The suite was green before and after (63 tests).

## 1. Build brief demoted from spec to as-built notes

`creature-care-mvp/BRIEF.md` still declared itself "authoritative" and "spec of record," which contradicted the README's rule that `Stacklings MVP PRD v0.3.md` wins on conflict. The brief was reviewed against the README and kept: it is the only record of the v1 tuning rationale, the locked decisions, the worked-example trace the tests reproduce exactly, the edge-case rulings, and the debug clock. Its header was replaced with a superseded banner stating that the PRD is the source of truth, the README governs file precedence, and the PRD wins on any conflict — including the brief's scope fence, which predates the reading and library phases.

## 2. README: local run, test, and verification instructions

The README previously required passing tests without saying how to run anything. Added a "Run and verify locally" section covering:

- Tests: `node --test test/` from `creature-care-mvp/`.
- App: `node tools/serve.mjs`, then open `http://localhost:8437/`; a static server is required because the app uses ES modules.
- Debug clock URL parameters (`?clock=+40h` and related) for exercising absence and day-rollover behavior.
- Document regeneration: `python3 tools/build_stacklings_mvp_docs.py` rebuilds both `.docx` copies from the Markdown sources.

Added a "Testing checkpoints during module development" subsection making local verification a checkpoint inside each work package: confirm a green baseline before starting, keep the suite green with each behavior change, exercise the affected flow in a locally served browser at each milestone, and finish with a full-suite run plus a feature-off check for optional modules. The definition of done now requires these checkpoints.

## 3. README: complete file classification

The file table previously used unnamed buckets ("Older PRDs", "Library and metadata reports"), leaving a reader unable to tell that, for example, `Stacklings General Access PRD v0.2.docx` is superseded by `Stacklings MVP PRD v0.3.md`. Every file and folder in the workspace is now classified by name, including:

- `tools/` (build scripts and dev server) and `outputs/` (generated renders, not version-controlled).
- The four library integration reports and the two children's reading research reports, listed by name.
- An explicit "superseded product documents" row naming both General Access PRDs, `creature-care-mvp-agent-brief.md`, the gameplay overview HTML files, and the early concept reports.
- The GitHub repository URL in the introduction.

## 4. Dev server moved into the project

`.claude/launch.json` pointed at a `serve.mjs` in a temporary per-session scratchpad directory, which breaks whenever that directory is cleaned. The server now lives at `tools/serve.mjs`, rewritten to resolve the app root relative to its own location instead of a hardcoded absolute path, and `launch.json` points at it. Verified end to end: the server serves `creature-care-mvp/` on port 8437 and the app renders.

Known caveat: the Claude browser-preview launcher runs sandboxed without access to Desktop paths, so it cannot start this server itself in some sessions. In that case start the server from a normal terminal (or the Bash tool) and open `http://localhost:8437/` directly.

## 5. Version control

The workspace is now a git repository on branch `main`, pushed to https://github.com/kjeveryday/TomeSweetTome. Setup notes:

- `.gitignore` excludes `.DS_Store`, `node_modules`, and `outputs/`. The `node_modules` pattern has no trailing slash on purpose: `tools/node_modules` is a symlink to an external cache, and a trailing-slash pattern matches only real directories.
- The GitHub repository contained a placeholder README; histories were merged keeping the workspace README. No force push was used.
- Generated document renders in `outputs/` are not tracked; regenerate them with the scripts in `tools/`.

## Follow-up fixes (same day, review-driven)

A second review of these changes prompted: `tools/serve.mjs` now binds `127.0.0.1` (it previously listened on all interfaces) and uses a separator-suffixed containment check (the old string-prefix check would have admitted sibling paths such as `creature-care-mvp-agent-brief.md`); `tools/requirements.txt` records the `python-docx` dependency; `.claude/launch.json` is classified as machine-local in the README, since the preview launcher resolves no working directory and relative paths fail; the mechanics-sheet script is marked as a non-portable one-off; and the verification note below was expanded into a defined backlog item.

## Independent baseline verification (first backlog item) — CLOSED July 15, 2026

**Closed the same day.** Five independent reviewers ran the pass; findings are in [`verification-report-2026-07-15.md`](verification-report-2026-07-15.md). Result: 3 genuine defects found (all in the "unvalidated input silently corrupts state" family — two produced permanent `cp: NaN` growth freezes), all fixed and covered by regression tests. The suite grew from 63 to **164 tests, all green**. Phase 1 module work is now unblocked.

The original definition of this item, kept for the record:

v1 shipped with a green 63-test suite, but the tests were written by the same agent that wrote the code, and the planned independent adversarial review had never run (earlier sessions hit limits). Verification to that point was the automated suite, the builder's self-checks, and manual browser playtests. What was missing was review by parties that did not build the code.

This was the first item of the development backlog; no Phase 1 module work started before it closed.

**Method.** Independent reviewers — agents or developers who did not write the implementation — each take one area and attempt to refute the implementation against the PRD and `creature-care-mvp/BRIEF.md`, reading source and writing targeted tests or browser reproductions. One reviewer per area, at minimum:

1. Clock rules: backward clock, the 72-hour clamp, `lastSeen` monotonicity.
2. Absence and gifts: the 36-hour threshold, one gift per return, the `max(current, 60)` floors.
3. Daily cap and CP: local-date reset, `ResourceGranted` bypass, CP monotonicity.
4. Persistence and migration: round-trip fidelity, corrupted and foreign saves, pre-generator saves rendering the original creature.
5. ISBN generator: validation, deterministic output, care-state preservation across `CreatureGenerated`.

**Exit criteria.** Every refutation attempt ends in one of two recorded states: the attempt failed and the invariant held, with evidence noted; or a defect was found, fixed, and covered by a new test. The pass closes when all five areas are reviewed, the findings report is committed to the repository, and the full suite is green.
