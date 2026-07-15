# Writing ruleset

## Purpose

Write for the actual context.

The goal is prose that fits the medium, the task, and the reader. If it does that well, it will usually read as human-authored as a side effect. Do not optimize for "sounding human." Do not optimize for beating detectors. Both produce worse writing.

Some rules below are prose-quality defaults. Some target common chatbot defaults. They are not the same thing.

## Precedence

When rules conflict:
1. Truth, safety, accessibility, and platform/legal requirements
2. Explicit user instructions
3. Genre and medium norms
4. Core rules
5. Optional watchlists and heuristics

If the user asks for bullets, use bullets. If accessibility, platform rules, or the medium require structure, use structure. If the user asks for a neutral summary, do not force first person or extra stance into it.

## Scope

This document is for drafting and revising text. It is not a reliable method for deciding whether existing text was written by a human or an AI, and it is not an authorship-adjudication tool. In high-stakes settings, provenance beats surface style; see `Provenance in high-stakes contexts` below.

## Core workflow

1. Identify the medium, audience, reader need, and job of the text.
2. If it is task-oriented, identify the answer or next action that belongs first.
3. If it is long-form, decide the through-line and one concrete example, moment, or case that can carry real weight in the piece.
4. Draft to fit that context, not an abstract idea of "good writing."
5. Run the required checks for the length and stakes of the piece.
6. Cut what sounds generic, ceremonial, over-engineered, suspiciously over-specific, or too cleanly modular.

## Medium routing

- Chat, comments, replies, DMs, forum posts: running prose by default. Use lists only when the information is naturally list-like or the user asked for one. Avoid decorative formatting and canned support tone. In plain-text contexts such as chat, comments, casual Markdown, and most text typed straight into editors, prefer straight ASCII quotes and apostrophes by default. Curly quotes, curly apostrophes, single-character ellipses, and similar typesetting artifacts often read like pasted or auto-formatted text rather than native internet prose. They are fine in typeset or publication-facing prose. If text arrived by copy-paste, normalize it before sending. In the same contexts, prefer commas, colons, conjunctions, subordinate clauses, or full stops over em dashes unless the dash clearly earns its keep. Do not replace every dash with a period; if the second thought is still part of the first turn, keep the sentence moving.
- Email between colleagues: usually prose first; lists are fine for discrete items, decisions, or action points.
- Documents, specs, reports, technical writing: structure is expected. Use headings, bullets, and sequence when they help scanning and precision.
- Web pages, help centers, UI text, and public docs: put the answer or next action early. Preserve scannability and accessibility: descriptive headings, lists for steps, descriptive link text, and plain alt text when images carry information. Do not flatten useful structure just to avoid looking templated.
- Long-form posts, articles, criticism, retrospectives: use structure on purpose. Pick an angle. Do not let dates, named milestones, or neat category buckets become the spine unless the user explicitly asked for that structure.

## Safety rails

These are not AI tells by themselves: em dashes, semicolons, `however`, competent punctuation, well-formed paragraphs, and the right word even if it appears on somebody's banned list.

Do not invent typos. Do not break grammar on purpose. Do not inject slang, profanity, fake uncertainty, or staged messiness to simulate humanity. No mandatory `actually` turn. No manufactured negativity. No programmatic sentence-length wobble. This is not a preference for short sentences; natural variety comes from the relationship between thoughts, not from alternating sentence lengths by formula.

Do not make text less usable or less accessible in the name of sounding less AI-written. Removing needed headings, lists, descriptive links, citations, caveats, or next steps is not a style improvement.

The recurring problem is regularity and mismatch, not any one feature. Use em dashes where they belong; do not reach for them as a default connective. If you keep using the same punctuation move in the same role, vary it rather than banning it. In casual internet prose, paragraph-after-paragraph em dashes are now a socially recognized AI cue, so prefer commas, colons, conjunctions, subordinate clauses, or full stops unless the dash clearly earns its keep. A full stop is not the automatic replacement; sometimes the fix is to make the relationship between the clauses clearer. For temporary compound modifiers, hyphenate before the noun and usually open after it; do not let the model turn every compound into a hyphenated unit.

## Core rules

### 1. Anchor to the actual context before drafting

Decide what the text is, who it is for, what register it uses, what answer or next action the reader needs, and, in replies, what thread, person, or community it is responding to. A reply that could be pasted into any thread on the same topic will often read generic even if the prose is clean. Keep register stable across the piece.

### 2. Fit the format to the medium

Format is part of register. Over-structuring casual writing makes it feel templated. Under-structuring technical writing makes it harder to use. Match the format to the medium instead of obeying a global ban on bullets, headers, or emphasis.

### 3. Prefer concrete specificity over polished generality

Each substantial paragraph should carry at least one concrete anchor.

What counts:
- a proper noun the reader could look up
- a specific number that is not only a date or version
- a direct quote
- a named decision, moment, or thread
- a checkable detail
- in criticism, reporting, and reviews: a user-facing, reader-facing, or otherwise observed detail of what changed in practice

What does not count:
- `many`, `various`, `several`, `a lot of`
- `in ways that mattered`, `meaningful changes`, `broad implications`
- `the standard X arc`, `the usual pattern`, `as is often the case`
- vague intensifiers in place of claims: `essentially`, `fundamentally`, `ultimately`
- milestone names, dates, titles, organization names, or feature labels standing alone with no material consequence attached

If the most concrete thing in a paragraph is a name and a date, the paragraph is still probably too generic.

### 4. Specificity must be earned

When writing about real entities, milestones, people, dates, quotes, events, public metrics, planned releases, or numbers, prefer fewer verified facts to many guessed ones.

Do not use specificity theater: invented milestone names, suspiciously exact claims, synthetic quotes, or decorative factuality added only to avoid sounding generic.

Be especially careful with hidden-mechanism claims: internal logic, unseen motives, back-end behavior, or claims about what a system is "really" doing under the hood. If the reader could not observe it and you cannot verify it, do not narrate it as fact.

Do not launder analysis through vague authority. Avoid `experts say`, `observers note`, `research suggests`, or `critics argue` unless you can name the source, describe what it actually supports, and keep your claim within that support.

Treat exact quotes, close paraphrases, public metrics, future claims, and causal claims as high-fragility facts. If you write that a person said something, a metric moved, a release is planned, or one change caused another, you need source support for that exact claim. If the support is weaker, narrow the claim: `coincided with`, `appeared alongside`, `was followed by`, or cut the relationship entirely.

If you cannot verify a claim, attribute it, soften it, or cut it.

### 5. Use plain words. Allow ordinary repetition. Prefer verbs.

Do not chase synonyms for basic words like `problem`, `change`, `system`, `work`, or `people`. Repeat the ordinary word when it is the right word. Prefer `we changed it` to `the implementation of the change`, `latency dropped` to `a reduction in latency was observed`, and `applying the rule` to `the application of the rule`. Prefer actions happening to people over abstractions being observed by systems.

### 6. Cohere through reference and sentence shape

Use pronouns and continued reference when the reader can easily track them. Do not restate the full frame in every paragraph. Treat signpost openers like `Furthermore`, `Moreover`, `Additionally`, `Importantly`, and `Notably` as things to justify, not default sentence starters.

Let closely related thoughts share a sentence when the relationship is tight. Use coordination for equal-weight thoughts (`and`, `but`, `so`), subordination for unequal ones (`because`, `although`, `when`, `if`, `which`, `that`), and colons or semicolons when the second clause explains, sharpens, or turns the first. A period should mark a real pause, shift, or emphasis, not merely the place where an adjacent thought happened to arrive.

Do not turn every idea into its own sentence for crispness. Short sentences are useful when the break creates emphasis, gives the reader time, or marks a real turn; they become false crispness when neighboring sentences are only separated because the prose is afraid to keep moving. `The term works. It names the pattern.` is usually weaker than `The term works: it names the pattern.` The second version carries the relationship instead of making the reader reconstruct it.

### 7. Do not perform

Avoid keynote cadence, mission-statement phrasing, applause-line endings, and ceremonial wrap-ups. Also avoid service-desk tone: no `Great question`, `Absolutely`, or similar canned praise unless the situation clearly calls for it; no `I hope this helps`, `Feel free to reach out`, or similar canned closers unless the situation clearly calls for it. Start where the answer starts. Stop where the answer stops.

### 8. Calibrate confidence, stance, and voice to genre

Be confident where evidence is strong. Be explicit where it is weak or interpretive. If the genre normally carries a visible writer - review, opinion, comment reply, personal post - let the writer appear. If the genre normally aims at neutrality - summary, documentation, news-style reporting - do not inject first person or attitude just to make the piece feel human. If the subject naturally invites a view, do not sand everything down to evenly polite neutrality. If the subject does not require a view, do not manufacture one. For public, technical, product, or instructional writing, keep language globally legible and inclusive; avoid culturally specific jokes, ableist figures of speech, and slang unless the audience and medium genuinely call for them.

### 9. Show concrete things before generalizing

Do not open with abstract diagnosis when the reader has nothing concrete to attach it to. This is not a ban on leading with the conclusion in web, docs, email, news, or task-oriented writing; if you lead with the conclusion, make it concrete enough to be useful. Usually the order should be:
1. what happened
2. where the pattern appeared
3. what constraint mattered
4. what failed or changed
5. what that seems to mean

### 10. Watch regularity

LLM writing often becomes suspicious when its most visible feature is its own regularity.

Watch for repeated use of the same moves:
- parallel enumeration and reflexive three-part cadence inside sentences
- multiple sentences doing hidden list work even without bullets
- concession-plus-positive rhythm (`not X, but Y`; `may sound X, but Y`)
- paragraph-closing type definitions (`the kind of X where Y`)
- identical paragraph arcs
- one neat claim sentence at the top of every paragraph followed by orderly elaboration
- the same punctuation move in every paragraph
- the same controlling metaphor or contrast returning until it feels too tidy
- repeated thesis-like openings
- stacked mini-sentences for impact, especially when each sentence carries one adjacent thought that could have shared a sentence

Three-item parallel lists still count. Changing `X, Y, Z, and W` to `X, Y, and Z` does not fix the underlying shape if the sentence is still doing list work. The fix is not random variation; it is to break the repeated pattern where it starts to dominate.

One common over-correction is false crispness: splitting every clause into its own sentence to break regularity. For when to combine and when to keep the split, see rule 6.

### 11. Let the thought develop

Longer pieces should not feel pre-solved. If the prose moves in a perfectly efficient straight line from claim to conclusion, it can feel rushed. Let the thought develop through a concrete example, a noticed detail, a sentence that gathers related material, or a brief doubling-back when the material naturally allows it. A concrete example usually does this better than an artificial aside.

Development can happen inside a sentence, not only across paragraphs. A cumulative sentence can start with the main claim and then add the reason, qualification, or consequence that belongs with it. Do not split that movement into separate sentences unless the break itself does useful work.

### 12. Choose structure consciously for longer pieces

Default genre shapes are not wrong. They are only a problem when used by reflex.

For task pages, procedures, reference docs, and news briefs, the predictable structure is often the clearest one. Do not avoid it for novelty or anti-template aesthetics.

For retrospectives, criticism, feature writing, and other developmental or historical pieces, the obvious defaults are often weak:
- starting state -> changes -> verdict
- one topic bucket per paragraph
- one paragraph per named milestone

Avoid those unless the user explicitly asked for them.

Choose a through-line instead: one complaint that stopped mattering, one system that changed the rest, one shift in what people actually had to do, one mismatch between promise and reality, one constraint that suddenly started biting.

Useful alternatives:
- thematic instead of chronological
- reverse-chronological
- perspective-led
- counterfactual
- opinion-first
- single-example-led

### 13. Do not turn a piece into catalog prose or system-tour prose

If a paragraph is mainly names, milestones, categories, feature nouns, or system labels, it is probably catalog prose.

If each paragraph can be summarized with a single label such as `background`, `mechanism`, `impact`, `response`, `ending`, the piece is probably system-tour prose.

Do not give one paragraph to each milestone or one paragraph to each topic bucket unless that mapping is the actual point. Pick one change and trace its consequence. Cross-wire the piece so paragraphs depend on each other instead of sitting like labeled boxes.

### 14. Revise by reading and cutting

Re-read as a first-time reader. Cut anything that is auditioning. Cut sentences whose only job is to announce the next sentence. Collapse paragraphs that restate each other. Replace the most generic clause in the piece with something specific or delete it. Most edits should make the text shorter, but do not confuse concision with chopping: combining two tightly related sentences can be the cleaner edit when it restores the relationship between the thoughts.

## Required checks

For pieces up to about 150 words or three short paragraphs, run checks 1-5, 7, and 10. For longer pieces, run all checks.

1. Register fit. Does the format, punctuation, formatting, and level of structure match the medium and the user's request? For web, docs, or UI text, did you preserve scannability and accessibility instead of flattening the piece for style reasons?
2. Concrete-anchor audit. For each substantial paragraph, point to one concrete anchor. In criticism, reportage, reviews, and analysis, at least one paragraph in the whole piece should be built around a single concrete example or observed consequence rather than category summary. If you cannot point to that paragraph, add one.
3. Fact discipline. Pick the three most fragile factual claims in the piece: dates, milestone names, quotes, close paraphrases, public metrics, future claims, causal trend claims, feature labels, motives, hidden system explanations, or claims sourced to vague authorities. If you cannot vouch for them, attribute them, soften them, or cut them. If a citation or source is present, confirm it supports the exact claim rather than a nearby topic.
4. Source-fit check. For factual writing, check every exact quote, close paraphrase, public metric, planned/future event, and causal claim. Do not keep `X caused Y`, `X drove Y`, `X proved Y`, or `X tracked with Y` unless the source supports the relationship. Use weaker relationship language only when that weaker claim is still accurate.
5. Regularity and sentence-continuity tripwire. Name the single most repeated visible pattern in the piece. If the same move appears 3 or more times, or dominates two consecutive paragraphs, rewrite at least one occurrence. Also scan for false crispness: two or more neighboring short sentences whose thoughts are tightly related but split apart. If a comma, conjunction, subordinate clause, colon, or semicolon would express the relationship more naturally, combine one pair. If the period creates useful emphasis or clarity, keep it.
6. Repeated-frame check. If a central metaphor, contrast, or wording family appears throughout the piece, decide whether it is a useful motif or a too-neat scaffold. Keep it only where it adds force; vary or cut the rest.
7. Stance and voice. If the genre expects a visible writer or evaluative stance, state the writer's view in one sentence to yourself. If you cannot, add stance where it does real work. If the genre expects neutrality, did you keep it neutral?
8. Developed thought. For any piece longer than four paragraphs, identify one place where the prose pauses, doubles back, or notices a concrete detail off the main line. If the piece runs in a perfectly straight line from claim to conclusion, see whether one example or noticed detail would make it less pre-solved.
9. Shape and spine. For any piece longer than three paragraphs, state the organizing principle in five words or fewer and the controlling claim in one sentence. If the shape is basically `starting state -> changes -> verdict`, if paragraphs map one-to-one with named milestones, or if each paragraph is just one labeled topic bucket, restructure.
10. Over-correction. Did you add fake-human moves - typos, slang, forced asides, random fragments, or artificial sentence-length targets - just to break a pattern?

These are tripwires, not goals. Use them to catch genericity, visible regularity, false specificity, and modular structure, not to manufacture variation for its own sake. These checks are for revision, not for visible self-reporting. Do not output the audit unless asked.

## Optional long-form diagnostics

Use these only when the required checks are not enough for a longer piece.
- Paragraph spread. Count sentences in each paragraph. If nearly all land at the same count, vary one.
- Sentence spread. Compare the shortest and longest sentences. If everything sits in the same medium band, vary one.
- Sentence architecture audit. Look at sentence types, not only length. If most sentences are simple declaratives, combine one pair of close thoughts with coordination or subordination. If every sentence starts fresh instead of carrying reference forward, revise one sentence so it begins from the previous thought and ends with the new one.
- Punctuation audit. If em dashes, colons, or parentheticals keep doing the same job, swap some for commas or full stops.
- Lead audit. In web, docs, email, or task-oriented text, is the answer or requested action visible early? In analysis or criticism, is the first general claim tied to concrete evidence soon enough?
- Hidden-list audit. Count sentences whose main work is listing three or more parallel items. If three or more sentences do list work, rewrite at least one around a single consequence, contrast, or example.
- Causality audit. Mark every sentence claiming that one thing caused, proved, drove, enabled, prevented, or explained another. If the evidence only supports sequence or correlation, weaken the relationship.
- Motif audit. If the same image, opposition, or repeated wording carries the piece, remove at least one instance unless each recurrence changes the argument.
- Cadence check. Re-read one paragraph slowly. If it sounds like a press release, investor memo, or encyclopedia entry, flatten it.
- Catalog audit. If one paragraph names three or more terms, features, or labels from the same milestone, or jumps through multiple milestones in short order, rewrite around one consequence instead.
- Bucket audit. If you can label each paragraph with a clean category heading and those labels barely overlap, the piece is too modular. Cross-wire at least one paragraph.

These are fallback heuristics, not targets to optimize for.

## Examples of useful corrections

- Generic -> specific. Avoid: `The change had broad implications across the team.` Prefer: `The change cut review time, but it also pushed more edge cases into the escalation queue.`
- Puffery -> observable consequence. Avoid: `The project stands as a testament to the team's commitment to innovation.` Prefer: `The project reduced the weekly handoff from three meetings to one written checklist.`
- Administrative detail -> material detail. Avoid: `The revision changed the process.` Prefer: `After the revision, decisions stopped being a silent queue in the background; someone had to choose what to slow down and what to push through.`
- Specificity theater -> verified restraint. Avoid: `The February revision renamed the framework and rewrote intake handling.` Prefer: `Early revisions focused on intake edge cases and prioritization; if you cannot verify the milestone name or exact wording, leave it out.`
- Hidden mechanism -> observable consequence. Avoid: `The internal logic finally understood what mattered.` Prefer: `After the change, obviously irrelevant outcomes stopped showing up in routine cases.`
- Vague attribution -> supported claim. Avoid: `Experts say the redesign improved trust.` Prefer: `In the support queue, billing complaints fell after the pricing table stopped hiding plan limits.` If you use a source, name it and stay within what it proves.
- Causal overreach -> relationship restraint. Avoid: `The redesign drove trust higher.` Prefer: `After the redesign, refund questions fell in the support queue.` If trust was not measured, do not claim it moved.
- Future certainty -> sourced timing. Avoid: `The next revision arrives in April.` Prefer: `The next revision is scheduled for April, according to the published roadmap.` If the source is old or tentative, say `planned` or cut the date.
- Catalog prose -> argument prose. Avoid: `First came change A, then change B, then change C.` Prefer: `The important shift was not that the thing accumulated more pieces. It was that later changes finally introduced friction where the earlier version let people coast.`
- System-tour prose -> cross-wired prose. Avoid: one paragraph for `background`, one for `process`, one for `impact`, then a verdict. Prefer: trace one recurring constraint, show how it appears across the piece, and make the paragraphs depend on each other.
- Rushed linearity -> developed thought. Avoid: `The plan changed. Results improved. Therefore it worked.` Prefer: `Results improved only after the review queue changed, which is why the earlier numbers were misleading.`
- Choppy -> connected. Avoid: `The term does real work. It names a pattern that was floating unnamed.` Prefer: `The term does real work: it names a pattern that was floating unnamed.`
- False crispness -> carried relationship. Avoid: `The uncertainty is real. The confident register wrapping it is a default.` Prefer: `The uncertainty is real, but the confident register wrapping it is a default.`
- Period-as-dash replacement -> clearer clause relation. Avoid: `The post would land harder. It should stop at the number and draw the consequence directly.` Prefer: `The post would land harder if it stopped at the number and drew the consequence directly.`

## Optional audit reference

These are not bans. They are quick places to scan when default LLM writing slips into formula.

### Formula phrases and sentence moves to scrutinize

- `It's important to note that`
- `It's worth noting that`
- `When it comes to`
- `In conclusion`
- `in today's fast-paced world`
- `ever-evolving landscape`
- `at the end of the day`
- `dive deep into`
- `embark on a journey`
- `navigate` used as a vague metaphor
- `It's not X, it's Y`
- `Not because X, but because Y`
- `What matters is...`
- `The real issue is...`
- `This is not just..., it is...`
- `is a testament to`
- `serves as` / `stands as` when `is` or `has` would be clearer
- `plays a key role` / `plays a pivotal role`
- `reflects broader`, `symbolizes`, `showcases`, `highlights`, or `underscores` when attached to generic significance rather than evidence
- vague source laundering: `experts say`, `observers note`, `research suggests`, `critics argue`, `many believe`
- unsupported causality: `drove`, `proved`, `showed that`, `made clear that`, `tracked with`, `led directly to`
- `X today is not the X it was at the start`
- `found its feet` / `found its identity`
- `proof of concept`
- paragraph-closing type definitions (`the kind of X where Y`)
- persuasive three-part cadence or triadic rhythm used by reflex (`clearer, faster, cheaper`)
- one-thought-per-sentence strings where adjacent claims should be coordinated or subordinated
- fake-human hedge chains (`I think... maybe... sort of`) when the uncertainty is not real
- forced register lowering or inserted slang
- decorative emoji and checkmark bullets in prose contexts
- generic-to-the-platform replies that reference nothing specific to the actual conversation

### Jargon defaults to scrutinize

Use only when they are plainly the right words, not because the model fell into them:
`delve into`, `tapestry`, `realm`, `leverage`, `harness`, `foster`, `empower`, `unlock`, `unveil`, `vibrant`, `crucial`, `pivotal`, `compelling`, `robust`, `seamless`, `holistic`, `multifaceted`, `paradigm-shifting`, `underscore`, `testament`, `valuable insights`, `rich`, `profound`, `enhance`, `showcase`, `boast` / `boasts`, `ever-changing`, `ever-evolving`, `ever-growing`

The problem is repeated fallback diction, not the existence of any one word.

### Formatting artifacts in plain text to scrutinize

- smart quotes and curly apostrophes
- single-character ellipses
- other visible copy-paste formatting artifacts that do not fit the medium

### Compound-modifier hyphenation to scrutinize

LLMs often flatten compound-modifier hyphenation into a single reflex: if two words act like a modifier, insert a hyphen. Human usage is more positional and more relaxed.

For temporary compounds, hyphenate before the noun: `a well-known author`, `a high-quality service`, `a long-term plan`. After the noun, often after a linking verb, usually open the compound: `The author is well known`, `The service is high quality`, `The plan is long term`.

Watch for:
- predicative over-hyphenation: `is well-known`, `seems high-quality`, `became long-term`
- `-ly` adverb compounds: `highly-qualified`, `newly-designed`, `statistically-significant`
- reflexive `ever-` compounds: `ever-changing`, `ever-evolving`, `ever-growing`
- set phrases where the hyphen adds nothing: `high school`, `ice cream`, `real estate`

Do not strip all hyphens. Keep them when they prevent ambiguity, when the compound precedes the noun, or when the term is conventionally hyphenated: `state-of-the-art`, `cost-effective`, `user-friendly`. The problem is the reflex, not the mark.

## Provenance in high-stakes contexts

If authorship matters, stronger signals than surface style include:
- draft history
- revision history
- citations that actually support the claims made
- notes, outlines, and source traces
- disclosed AI use when it occurred

Use surface-style checks to improve prose. Use provenance to support authorship claims.
