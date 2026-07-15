# Stacklings MVP Parking Lot

Version 0.1  
Date: July 15, 2026

This document contains approved ideas that are intentionally excluded from the current MVP, deferred decisions, and known access gaps. Items here are not implementation requirements until moved into a future PRD.

## Deferred product work

| Item | Current direction | Revisit when |
|---|---|---|
| Participant-selected completion book | Keep as a future library-program reward | A library partner and fulfillment process are available |
| Specific post-completion library invitation | Offer a concrete next event or book after completion | Library event and recommendation data are reliable |
| Reading-pattern-driven development | Broad patterns may influence non-ranked outcomes | The initial relationship-development responses are tested |
| Explain and redirect development outcomes | Show why an outcome is changing and allow correction | Specific development outcomes exist and need player control |
| Inactivity reminder | At most one optional, non-urgent reminder | Accounts, consent, and notification infrastructure exist |
| Longer-term preference profile | Use longer history for recommendations without creating fixed labels | Recent-history recommendations and privacy controls are validated |
| Series-related visitors | Recommend related books in a series | Series metadata is reliable |
| Wildcard visitors | Occasionally recommend outside established preferences | Recommendation quality and age suitability are validated |
| Person-to-person recommendations | Deferred as one complete module | A future decision explicitly approves child-safe social interaction |
| Structured recommendation reasons between people | Remains part of the deferred person-to-person module | Person-to-person recommendations are approved |
| No read receipts or rejection feedback | Mandatory safeguard if person-to-person recommendations are ever built | Person-to-person recommendations are approved |
| Collaboration-specific cosmetic result | Shared activity may create a non-power result | Community participation is tested without it |
| Full preference summary | Private, explainable, correctable, and deletable | The minimal per-recommendation explanation is insufficient |
| Environment changes from long-term reading patterns | Non-ranked and private | Full preference controls exist |

## Library and program work

| Item | Current direction | Revisit when |
|---|---|---|
| Paper version | Explore a collaborative paper activity based on reading, potentially using an exquisite-corpse structure | The digital mechanics are stable enough to translate |
| Spanish localization | First additional interface language | MVP rules and copy are stable |
| Additional languages | Prioritize using community needs and partner capacity | Spanish localization workflow is proven |
| Circulation and post-program return measurement | Deferred; do not collect borrowing history in MVP | A library partner approves the purpose, data fields, retention, and privacy review |
| Live patron borrowing and reservation integration | Provider interface exists in the MVP; production connection is conditional | Approved library/vendor credentials and security review are available |
| Live branch availability | Use the provider interface and sample data until authorized access exists | An approved catalog API or partner feed is available |
| Program completion survey | Keep brief, optional, and age-appropriate | A library program needs outcome measurement |
| Staff-curated weekly recommendations | Keep provider and admin seams modular | Staff capacity and content tools exist |
| Self-directed in-library shelf activity | Do not treat this as separate from recommendation visitors unless its library use is materially different | A library partner defines a distinct in-building need |
| Event-specific book discovery and configuration tools | Administrator configuration may be added after basic event registration | Event registration is working and staff requirements are known |
| Completion event and optional shared contributions | Program-specific and separate from personal completion | A community program is scheduled |

## Explicitly excluded unless reconsidered

- Open chat, direct messages, comments, friend lists, follower systems, or public profiles.
- User-to-user trading or creature exchange.
- Public reading-duration totals or individual leaderboards.
- Creature strength based on reading duration.
- Currency granted per minute.
- A requirement to finish a book before receiving its creature.
- Separate creatures for different editions of the same work when the work match is known.
- Creature harm, death, permanent decay, or guilt after absence.
- Production dependence on unauthorized catalog scraping.
- Creature photography and public sharing.

## Parking-lot entry requirements

Before an item moves into a future PRD, record:

1. The user problem it solves.
2. Its required data and privacy impact.
3. Its module owner and shared events.
4. Its fallback when an external provider is unavailable.
5. Its feature flag and removal behavior.
6. Acceptance criteria that do not weaken the core reading rules.
