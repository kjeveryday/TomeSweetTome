# Stacklings MVP workspace

This file is the entry point for developing the Stacklings MVP. It explains which files are authoritative, what is in the first release, and how separate developers or agents must connect their work. The workspace is version-controlled at https://github.com/kjeveryday/TomeSweetTome.

## Approved direction

- The primary interface audience is ages 6–12.
- Reading aloud, being read to, listening, rereading, short books, and long books all count.
- Guest play requires no account and stores progress locally.
- Synchronized accounts for the primary audience are guardian-managed.
- Development is phased and additive. A later phase extends shared contracts; it does not replace the core implementation.
- Functional language is required. Do not add a mechanic, currency, mode, room, event, or user-facing system name unless it is explicitly approved in the current PRD.

## Which files to use

| File or folder | Purpose | How to use it |
|---|---|---|
| `README.md` | Workspace orientation and document precedence | Read first |
| `Stacklings MVP PRD v0.3.md` | Canonical product and implementation requirements | Use as the source of truth for scope, behavior, module boundaries, contracts, flags, and acceptance criteria |
| `Stacklings MVP PRD v0.3.docx` | Review-friendly copy of the canonical PRD | Use for reading and stakeholder review; make requirement edits in the Markdown source and regenerate this file |
| `Stacklings MVP Parking Lot v0.1.md` | Deferred and explicitly excluded work | Do not implement these items unless they are moved into a later approved PRD |
| `Stacklings MVP Parking Lot v0.1.docx` | Review-friendly copy of the parking lot | Use for stakeholder review only |
| `creature-care-mvp/` | Working v1 application | Extend this implementation; do not rebuild working scanner, generator, care, persistence, or reducer behavior |
| `creature-care-mvp/BRIEF.md` | Existing v1 implementation notes | Use to understand current behavior; the current PRD wins if it conflicts |
| `# Multi-agent sessions.md` | Multi-agent coordination and session reference | Read before dividing implementation among multiple agents. Use it to plan delegation, isolated contexts, coordinator responsibilities, follow-up work, and parallel tasks; adapt environment-specific setup examples to the tools actually in use |
| `# WRITING.md` | Writing and revision rules | Use for PRDs, backlog items, user-facing copy, UI text, research summaries, documentation, and agent handoffs. Apply its source discipline, plain-language rules, and required revision checks |
| `tools/` | Document build scripts and the local dev server | Regenerate both `.docx` copies with `python3 tools/build_stacklings_mvp_docs.py` (install dependencies first: `python3 -m pip install -r tools/requirements.txt`) after editing the Markdown sources; `node tools/serve.mjs` serves the app locally. `build_stacklings_mechanics_sheet.mjs` is a historical one-off bound to a machine-local runtime; do not treat it as portable tooling |
| `.claude/launch.json` | Machine-local browser-preview launch config | Contains an absolute path by necessity — the preview launcher resolves no working directory, so relative paths fail. Update the path after moving or cloning the workspace |
| `outputs/` | Generated document renders (PDF and page images) | Regenerable review output; do not edit by hand; not version-controlled |
| `successful-reading-program-blueprint.md` | Reading-program research synthesis | Use as background evidence, not as a source of unapproved mechanics |
| `childrens-reading-report (1 of 2).md`, `childrens_reading_research_report (2 of 2).md` | Reading research behind the blueprint | Use as background evidence only |
| `chicago-library-availability-mvp.md`, `chicago-library-cover-tracking-mvp.md`, `library-metadata-and-genre-classification-report.md`, `library-lending-systems-overview.md` | Integration research | Use when implementing the corresponding provider; they do not expand MVP scope |
| Superseded product documents: `Stacklings General Access PRD v0.2.docx`, `Stacklings General Access PRD - Hearth and Shelf v0.1.docx`, `creature-care-mvp-agent-brief.md`, the `Stacklings … Overview` `.html` files, `library-creature-game-overview.html`, `monster-generation-mechanics-report.md`, `book-values-creature-generation.md`, `physical_capture_report.md`, `cozy-game-return-loops-report.md` | Historical exploration | Do not treat them as current requirements or copy terminology from them into the MVP |
| `Game dev prompt example.pdf` | Prompt-authoring example reference | Not a Stacklings product document; no requirements live here |
| `workspace-changes-2026-07-15.md` | Record of the July 15, 2026 workspace reorganization | Historical record; not a requirements source |
| `verification-report-2026-07-15.md` | Findings from the independent v1 verification pass | Historical record; lists 3 fixed defects and open product questions |

## Run and verify locally

The v1 application is dependency-free vanilla JavaScript ES modules with no build step.

- **Tests**: from `creature-care-mvp/`, run `node --test test/`. The full suite must stay green (63 tests as of July 15, 2026).
- **App**: from the workspace root, run `node tools/serve.mjs`, then open `http://localhost:8437/`. Any static file server pointed at `creature-care-mvp/` works; opening `index.html` directly from the filesystem does not, because the app uses ES modules. `.claude/launch.json` starts this same server for browser preview.
- **Debug clock**: append `?clock=+40h`, `?clock=+26h`, `?clock=-5h` (cumulative), or `?clock=reset` to the URL to simulate device-clock movement when exercising absence and day-rollover behavior.
- **Documents**: after editing `Stacklings MVP PRD v0.3.md` or `Stacklings MVP Parking Lot v0.1.md`, regenerate the `.docx` copies with `python3 tools/build_stacklings_mvp_docs.py`.

### Testing checkpoints during module development

Local verification is a checkpoint inside each work package, not a step saved for the end. While developing a module:

1. Run the full test suite before starting, to confirm a green baseline.
2. Add or update the module’s tests with each behavior change and keep `node --test test/` green locally; never hand off red.
3. At each milestone within the module, serve the app locally and exercise the affected flow in the browser against the module’s PRD acceptance criteria.
4. Before declaring the package done, run the full suite once more and, when the module is optional, check its feature-off state locally.

## Precedence when files conflict

1. `Stacklings MVP PRD v0.3.md`
2. This README for file usage and approved phase boundaries
3. Existing automated tests and source code for behavior the PRD says to preserve
4. `Stacklings MVP Parking Lot v0.1.md` as a record of work that is not in scope
5. Older product documents and research reports as historical context only

Do not silently reconcile a conflict. Record it as a product question before changing a shared contract or preserved v1 behavior.

## Delivery phases

| Phase | Required outcome | Included work | Completion gate |
|---|---|---|---|
| 1 — Core guest MVP | The complete reading and creature loop works locally without an account or live service | Preserve v1; migrate saves; book records; reading records; optional timer; preview and reveal; collection; care and development; 20-day progress; fixture recommendations; research settings; provider interfaces and disabled feature flags | All existing tests and Phase 1 acceptance criteria pass with every optional service disabled |
| 2 — Account and library services | The core loop can optionally save to an account and use library data | Guardian-managed account flow; synchronized-storage provider; catalog fixture; approved live catalog provider when available; patron-action provider seam | Disabling the phase returns the application to the complete Phase 1 experience without data loss |
| 3 — Community events | Authorized library staff can manage participation without adding child-to-child communication | Event provider; administrator username search; registration; normalized aggregate progress; audit log | The entire community module can be disabled without affecting personal progress or exposing private reading data |

Care items are developed behind their feature flag. They may be turned off at release without changing reading, creature, or care records.

Live catalog, patron actions, accounts, and community events must never block Phase 1. Fixture data must always be labeled as sample or demonstration data.

## Required reading order for implementation

1. Read this README.
2. Read the current PRD sections for binding rules, module map, shared records and events, feature flags, and multi-agent implementation rules.
3. Before coordinating or participating in parallel agent work, read `# Multi-agent sessions.md` and use its delegation and context-isolation guidance.
4. Before drafting or revising requirements, backlog items, documentation, settings content, UI copy, or handoff text, read `# WRITING.md` and run its applicable revision checks.
5. Read only the PRD module section assigned to the work.
6. Inspect the corresponding existing source and tests in `creature-care-mvp/`.
7. Consult a research or integration report only when the assigned module requires it.
8. Check the parking lot before proposing additional scope.

## Rules for separate developers or agents

- One owner controls shared record types, event names, provider interfaces, feature flags, and save migrations.
- The coordinator follows `# Multi-agent sessions.md`: delegate bounded independent work, keep each agent’s context isolated, and synthesize changes through the shared contracts.
- Each module owns its state slice, reducer cases, provider adapter, UI, and tests.
- Modules communicate through approved events and provider interfaces. They do not import another module’s private implementation.
- Every provider contract includes a deterministic fixture so dependent work can proceed without a live service.
- Every optional module has a feature flag and a tested disabled state.
- A work package must state its owned files, consumed events, emitted events, provider dependencies, migration impact, tests, and acceptance criteria.
- Changes to shared contracts require review by every module that consumes them.
- New mechanics or user-facing system names require a product decision before implementation.
- All implementation notes, handoffs, UI copy, and documentation follow `# WRITING.md`; factual claims and citations must pass its source-fit checks.

## Definition of done for a work package

A work package is complete only when:

- Its public inputs and outputs match the shared contracts.
- Its reducer behavior is deterministic and tested.
- Existing v1 tests remain passing.
- The testing checkpoints in "Run and verify locally" were completed, ending with a green full suite and a browser check of the module’s flows.
- Its feature-off behavior is tested when the module is optional.
- Fixture, unavailable-provider, and recovery behavior are tested when it uses a provider.
- It does not introduce parking-lot work, social communication, public child data, duration-based power, or unapproved terminology.
- User-facing behavior satisfies the relevant PRD acceptance criteria.

## Privacy gate for later phases

Before real synchronized accounts, library credentials, or administrator account search are enabled, approve a child-privacy specification covering guardian notice and consent, collected fields, staff access, service providers, security, retention, export, and deletion. The implementation may use local fixtures before that review, but it must not collect real child or library-card data.

Official background: [FTC COPPA compliance plan](https://www.ftc.gov/business-guidance/resources/childrens-online-privacy-protection-rule-six-step-compliance-plan-your-business) and [FTC COPPA FAQ](https://www.ftc.gov/business-guidance/resources/complying-coppa-frequently-asked-questions).

## Next implementation artifact

The next artifact should be an ordered development backlog. Each backlog item should be small enough for one developer or agent, point to its PRD requirements, declare its module contract, and contain verifiable acceptance criteria.

The backlog's first item is fixed: the independent baseline verification of v1 defined in `workspace-changes-2026-07-15.md`. No Phase 1 module work starts before that item closes.
