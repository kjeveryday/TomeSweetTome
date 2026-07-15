import fs from "node:fs/promises";
import { Workbook, SpreadsheetFile } from "@oai/artifact-tool";

const outputDir = "/Users/kylejohnson/Desktop/Tome Sweet Tome/outputs/stacklings_mechanics_decision";
await fs.mkdir(outputDir, { recursive: true });

const bestPractices = [
  ["BP-001", "Simple public promise", "Participants can understand the central challenge after hearing it once.", "Purpose; One-Sentence Specification", "Required", "Can this mechanic be explained without adding exceptions to the central reading challenge?"],
  ["BP-002", "Track reading days, not quantity", "Formal progress is based on distinct reading days rather than pages, titles, speed, difficulty, or minutes.", "Program Definition; Progress Tracking", "Required", "Does this avoid advantaging short books, fast readers, or easily measured formats?"],
  ["BP-003", "No resets or penalties", "Missing days never resets accumulated progress.", "Recommended Duration; Progress Tracking", "Required", "Can a participant return after an absence with all permanent progress intact?"],
  ["BP-004", "Late enrollment", "Participants can join late without punishment.", "Recommended Duration; Accessibility", "Required", "Can a new participant begin meaningfully after the program has started?"],
  ["BP-005", "All formats count", "Print, ebooks, audiobooks, comics, manga, magazines, fan fiction, and other sustained reading count equally.", "Eligible Reading", "Required", "Can this mechanic work without a scannable print ISBN?"],
  ["BP-006", "All languages count", "Reading in any language counts equally.", "Eligible Reading; Accessibility", "Required", "Does language affect expression rather than eligibility or power?"],
  ["BP-007", "Rereading counts", "Repeated books count, especially for early readers.", "Eligible Reading", "Required", "Does returning to a familiar book remain rewarding?"],
  ["BP-008", "Shared reading counts", "Reading aloud and being read to count equally with independent reading.", "Eligible Reading; Target Audiences", "Required", "Can a caregiver or shared reader use this without being treated as a lesser path?"],
  ["BP-009", "Reader choice", "Participants decide what and how to read; there is no required list.", "Product Principles; Recommendations", "Required", "Does this preserve an easy, penalty-free choice of material?"],
  ["BP-010", "Stopping a book is allowed", "Participants are not punished for pausing or deciding a book is not for them.", "Anti-Patterns; Participant Experience", "Strong", "Does stopping this book preserve prior progress and dignity?"],
  ["BP-011", "Meaningful, nontransactional progress", "Recognition supports reading without making every book or minute feel like a transaction.", "Recognition and Rewards", "Strong", "Does the response acknowledge reading without converting it into repetitive payment?"],
  ["BP-012", "Three clear milestones", "Welcome, halfway, and completion are the primary recognition points.", "Recognition and Rewards", "Strong", "Does this align cleanly with registration, 10 days, or 20 days?"],
  ["BP-013", "Books and experiences as rewards", "Books, recognition, and experiences are preferred over unrelated trinkets.", "Product Principles; Recognition and Rewards", "Strong", "Does the reward lead back to reading, discovery, or library participation?"],
  ["BP-014", "Equivalent success paths", "Different ages, abilities, formats, and reading patterns share the same definition of success.", "Target Audiences; Accessibility", "Required", "Can a board-book reader and a long-novel reader both succeed fairly?"],
  ["BP-015", "Progress over competition", "Celebrate personal and community progress without ranking readers.", "Product Principles", "Required", "Could this become a public quantity or strength comparison?"],
  ["BP-016", "Forgive inactivity", "Absence creates no loss, distress, or urgent deficit.", "Inactivity Reminder; Progress Tracking", "Required", "What does a participant see after being away for a month?"],
  ["BP-017", "One friendly reminder", "If permitted, one reminder invites resumption without guilt or urgency.", "Inactivity Reminder", "Supporting", "Is the reminder optional, sparse, and free of loss language?"],
  ["BP-018", "Sustainable participation", "The program and its digital layer remain simple and do not displace reading time.", "Programming Cadence; Minimum Viable Program", "Required", "Can the interaction finish quickly and stop cleanly?"],
  ["BP-019", "Age-appropriate presentation, equal rules", "Age tracks may look different but do not have different definitions of success.", "Target Audiences", "Strong", "Does this change presentation without changing eligibility or thresholds?"],
  ["BP-020", "Continue the relationship", "Completion leads to a specific next library or reading activity.", "Ideal Journey; Acceptance Criteria", "Strong", "What concrete next step follows completion?"],
  ["BP-021", "Recommendations without required lists", "Help participants find enjoyable material while preserving choice.", "Recommendations and Discovery", "Required", "Can a recommendation be saved, dismissed, or corrected without penalty?"],
  ["BP-022", "Weekly staff recommendations", "Staff recommendations are refreshed weekly for each audience.", "Recommendations and Discovery", "Strong", "Can staff curate and refresh this sustainably?"],
  ["BP-023", "Inclusive recommendations", "Recommendations include multiple formats, languages, accessibility options, and high-interest choices.", "Recommendations and Discovery; Accessibility", "Required", "Does the inventory avoid defaulting only to mainstream print books?"],
  ["BP-024", "Participant recommendations", "Participants can recommend enjoyable material through a safe, appropriate surface.", "Recommendations and Discovery", "Supporting", "Can recommendations be shared without exposing a reading history or creating social pressure?"],
  ["BP-025", "Expand tastes gently", "Discovery includes optional opportunities beyond established preferences.", "Recommendations and Discovery", "Supporting", "Does this invite exploration without making diversity a requirement?"],
  ["BP-026", "Immediate recommendation", "A participant receives useful reading discovery immediately after joining.", "Ideal Journey", "Strong", "Does onboarding provide value before asking for extensive information?"],
  ["BP-027", "Programs connect to books", "Every activity connects naturally to books or library resources.", "Programming Cadence", "Strong", "Does this activity visibly lead toward relevant reading?"],
  ["BP-028", "Passive weekly activity", "A sustainable self-directed activity remains available throughout each week.", "Programming Cadence", "Strong", "Can this run without constant staff facilitation?"],
  ["BP-029", "Shared noncompetitive goal", "Community progress is visible without individual ranking.", "Community Goal", "Strong", "Does this show aggregate transformation rather than top contributors?"],
  ["BP-030", "Community does not replace individual success", "Shared progress remains separate from personal completion.", "Community Goal", "Required", "Can someone complete personally without contributing publicly?"],
  ["BP-031", "Normalize community contributions", "Different eligible activities contribute equal units to shared progress.", "Community Goal; Progress over Competition", "Strong", "Can prolific or privileged participants dominate this system?"],
  ["BP-032", "Private recognition by default", "No participant is publicly identified without permission.", "Registration; Recognition and Rewards", "Required", "Is recognition anonymous or explicitly opted into?"],
  ["BP-033", "Celebrate all participants", "Celebrations recognize participation rather than top volume.", "Final Week; Anti-Patterns", "Required", "Does everyone receive the same core recognition?"],
  ["BP-034", "Collaboration creates shared value", "Cooperation can produce an experience unavailable alone without becoming competitive.", "Community Goal", "Supporting", "Is the shared result narrative or expressive rather than strategically superior?"],
  ["BP-035", "Registration under one minute", "Joining is quick and asks only for operationally necessary information.", "Registration", "Required", "Can a new participant begin in under one minute?"],
  ["BP-036", "No library card required", "A library card is not required for full participation.", "Registration; Accessibility", "Required", "Does library integration add convenience rather than eligibility?"],
  ["BP-037", "No smartphone required", "A complete non-digital participation path exists.", "Universal Access; Accessibility", "Required", "Can someone fully participate without the app?"],
  ["BP-038", "Paper and digital parity", "Paper and digital trackers produce compatible records and equal completion.", "Progress Tracking; Acceptance Criteria", "Required", "Do paper users receive the same core progress and reward?"],
  ["BP-039", "Lost progress can be reconstructed", "Lost trackers may be rebuilt through self-report without penalty.", "Progress Tracking; Acceptance Criteria", "Required", "Can remembered activity be restored without interrogation?"],
  ["BP-040", "Multiple reporting routes", "Progress can be reported at the library, digitally, and through outreach.", "Participant Check-in", "Required", "Do all reporting routes create the same canonical progress record?"],
  ["BP-041", "Accessible participation", "Digital and physical materials support assistive technology and varied access needs.", "Accessibility and Inclusion", "Required", "Does every required gesture, visual, audio, or scan have an alternative?"],
  ["BP-042", "Plain and translated instructions", "Rules are available in plain language and principal community languages.", "Accessibility and Inclusion", "Required", "Can participants understand the rule without decoding game terminology?"],
  ["BP-043", "No purchases or required visits", "Participation does not require purchases, weekly attendance, or regular library visits.", "Accessibility and Inclusion", "Required", "Can core progress happen from home at no cost?"],
  ["BP-044", "Active outreach registration", "Staff register participants where communities already gather; flyers alone are insufficient.", "Outreach Requirements", "Strong", "Does this support immediate activation outside the library?"],
  ["BP-045", "Measure activation", "Success distinguishes registration from becoming active.", "Measurement Plan", "Required", "Does measurement identify the first meaningful reading action?"],
  ["BP-046", "Measure reader outcomes", "Evaluation asks whether reading increased and whether enjoyable material was discovered.", "Outcome Questions", "Required", "Does this capture experience rather than only activity volume?"],
  ["BP-047", "Measure library connection", "Evaluation includes comfort with the library and later return behavior.", "Outcome Questions; Calculated Metrics", "Strong", "Can this be measured without exposing unnecessary reading details?"],
  ["BP-048", "Stable definitions", "Registration, activation, halfway, completion, and return have consistent definitions.", "Core Counts; Acceptance Criteria", "Required", "Will paper, app, staff, and outreach channels calculate this identically?"],
  ["BP-049", "Data minimization", "Collect only information needed to operate and evaluate the program.", "Registration; Privacy", "Required", "Is every stored field necessary, private by default, and deletable?"],
];

const mechanics = [
  ["M-001","Program progress","Twenty-day personal challenge","Track whether a participant reads on twenty distinct self-selected days.","A tracker shows twenty spaces that are marked once per reading day.","BP-001","BP-002; BP-012; BP-014",5,"Strongly Include","","","MVP","Reading-day record","Must not become consecutive-day tracking."],
  ["M-002","Program progress","One formal progress unit per reading day","Award no more than one unit of formal personal progress for eligible reading activity on a calendar day.","Reading several books on Tuesday advances the twenty-day challenge by one day.","BP-002","BP-014; BP-015; BP-031",5,"Strongly Include","","","MVP","Reading-day record","Do not let additional books or minutes multiply formal progress."],
  ["M-003","Program progress","Permanent accumulated progress","Preserve all previously recorded reading days when a participant misses days or returns after an absence.","A participant with eight days still has eight after being away for three weeks.","BP-003","BP-016",5,"Strongly Include","","","MVP","Persistent progress","Avoid streak language and reset animations."],
  ["M-004","Program progress","Late-start personal journey","Allow a participant to begin their own challenge after the program has started.","A participant joining in week five begins at zero without being compared to earlier participants.","BP-004","BP-015; BP-035",5,"Strongly Include","","","MVP","Program dates","Late joiners need a meaningful completion policy."],
  ["M-005","Program progress","Format-neutral reading credit","Treat print, digital, audio, comics, manga, magazines, fan fiction, shared reading, and other sustained reading as eligible.","An audiobook session and a print-book session can each record a reading day.","BP-005","BP-008; BP-014; BP-041",5,"Strongly Include","","","MVP","Manual and accessible check-ins","ISBN scanning cannot be required for progress."],
  ["M-006","Program progress","Language-neutral reading credit","Treat reading in every language as equally eligible for progress.","A Spanish picture book records the same reading-day progress as an English one.","BP-006","BP-014; BP-023; BP-042",5,"Strongly Include","","","MVP","Localized metadata and UI","Metadata coverage may vary by language."],
  ["M-007","Program progress","Rereading credit","Count rereading an already encountered book as eligible reading activity.","Reading the same board book on another night can record another reading day.","BP-007","BP-014",5,"Strongly Include","","","MVP","Book history","Do not generate meaningless duplicate rewards."],
  ["M-008","Program progress","Shared-reading credit","Treat reading aloud and being read to as equal participation routes.","A caregiver selects 'we read together' after a read-aloud.","BP-008","BP-014; BP-019",5,"Strongly Include","","","MVP","Session mode selection","Wording must not rank independent reading above shared reading."],
  ["M-009","Program progress","Pause or stop a book without penalty","Preserve prior progress when a participant pauses a book or marks it as not for them.","A paused book remains available to resume and does not reduce reading-day progress.","BP-010","BP-003; BP-009; BP-016",5,"Strongly Include","","","MVP","Book status","Avoid failure or abandonment language."],
  ["M-010","Program progress","Welcome, halfway, and completion milestones","Use three primary milestones aligned to joining, ten reading days, and twenty reading days.","The interface recognizes registration, day ten, and day twenty.","BP-012","BP-001; BP-048",5,"Strongly Include","","","MVP","M-001","Do not crowd these with many competing milestone systems."],
  ["M-011","Program progress","Same success thresholds across age tracks","Keep the same formal completion rule while varying art, language, and interaction complexity.","A preschool and adult track both complete at twenty reading days.","BP-019","BP-014; BP-001",5,"Strongly Include","","","MVP","Presentation profiles","Age presentation must not imply different ability rankings."],
  ["M-012","Rewards","Participant-selected book at completion","Connect program completion to a real book chosen by the participant where the library program supports it.","At twenty days, the participant chooses from an available completion-book selection.","BP-013","BP-012; BP-020; BP-033",5,"Strongly Include","","","Program-Specific","Library fulfillment","Digital recognition must not replace the real reward."],
  ["M-013","Rewards","Specific next-step invitation","Offer one concrete next book, series, event, or library activity after completion.","The completion screen offers an upcoming library activity and an optional related title.","BP-020","BP-013; BP-021; BP-047",5,"Strongly Include","","","MVP","Recommendation or event data","Avoid a generic 'come back soon' dead end."],

  ["M-014","Reading session","Optional count-up timer","Allow a reader to start and manually stop a timer during a reading session.","The timer begins at zero and runs until the participant taps stop.","BP-018","BP-045; BP-049",4,"Include","","","MVP","Clock and session record","Must remain optional and must not be treated as proof."],
  ["M-015","Reading session","Optional preset focus timer","Offer optional preset durations as a focus aid.","A reader chooses ten, fifteen, or twenty minutes and may stop early.","BP-018","BP-009; BP-041",4,"Explore","","","Later","M-014","Preset durations can be misread as minimum requirements."],
  ["M-016","Reading session","Untimed reading check-in","Allow participants to record reading without running a timer.","A participant selects that they read today and optionally identifies the book.","BP-005","BP-002; BP-037; BP-041",5,"Strongly Include","","","MVP","Reading-day record","Must be as valid as timed reading."],
  ["M-017","Reading session","Private duration history","Store elapsed session duration privately when a reader chooses to use the timer.","A private history shows that a session lasted eighteen minutes.","BP-049","BP-018; BP-046",3,"Explore","","","Later","M-014; privacy controls","Duration is sensitive and may be unnecessary."],
  ["M-018","Reading session","Timed session can record a reading day","Let a completed timer session serve as one route to recording that day's reading activity.","Stopping the timer records today's reading day if it has not already been recorded.","BP-040","BP-002; BP-045; BP-048",5,"Include","","","MVP","M-014; M-002","Must not make timing the privileged route."],
  ["M-019","Reading session","Optional post-session reaction","Offer a brief, ungraded response about how the reading felt.","The reader may choose funny, exciting, surprising, calm, or skip.","BP-009","BP-011; BP-021; BP-046",4,"Include","","","MVP","Session end","Must never become a quiz or comprehension check."],
  ["M-020","Reading session","Reward currency per minute","Generate spendable game currency in direct proportion to timer duration.","Every recorded minute produces one unit of care currency.","BP-002","BP-014; BP-015; BP-018",1,"Avoid","","","Unassigned","M-014","Rewards idling and advantages long uninterrupted sessions."],
  ["M-021","Reading session","Creature strength determined by duration","Increase strategic creature power based on recorded reading minutes.","A creature becomes stronger after longer timer sessions.","BP-014","BP-002; BP-015; BP-049",1,"Avoid","","","Unassigned","M-014","Creates an inequitable quantity leaderboard through creature power."],
  ["M-022","Reading session","Public reading-duration totals","Display individual reading minutes to other participants.","A public profile shows total minutes read this season.","BP-015","BP-032; BP-049",1,"Avoid","","","Unassigned","Identity and social system","Conflicts with privacy and noncompetition."],
  ["M-023","Reading session","Short start-of-reading interaction","Provide one brief optional interaction before the app becomes quiet for reading.","The player selects a book and places the active creature beside it.","BP-018","BP-011",4,"Include","","","MVP","Active creature; session flow","Keep under twenty seconds and skippable."],
  ["M-024","Reading session","Explicit end to game interaction","Tell the participant when the digital interaction is complete and it is time to read or leave.","After the response, the interface says the session is complete and offers no urgent task.","BP-018","BP-016; BP-001",5,"Strongly Include","","","MVP","Session flow","Do not place another retention prompt immediately afterward."],
  ["M-025","Reading session","Cap formal daily progress","Cap challenge and community progress regardless of how many books or minutes are logged that day.","Ten books read on one day still produce one personal reading day and at most one normalized community contribution.","BP-002","BP-014; BP-031",5,"Strongly Include","","","MVP","M-002; community contribution","Additional reading can still produce private qualitative responses."],

  ["M-026","Creature discovery","Different work generates a different creature","Generate a deterministic creature identity for each distinct book work encountered.","Two different titles produce two different creature identities.","BP-009","BP-011; BP-021",4,"Include","","","MVP","Work identification and generation","Creature count must not become the success metric."],
  ["M-027","Creature discovery","Scan reveals a creature preview","Use an ISBN scan to show a preview before reading is recorded.","Scanning displays a silhouette and one clue about the associated creature.","BP-026","BP-011; BP-035",4,"Include","","","MVP","Barcode scanner; generation","Needs non-scan alternatives for digital and accessible formats."],
  ["M-028","Creature discovery","First reading interaction completes the reveal","Use the first reading interaction with a book to fully reveal its generated creature.","A previewed silhouette is introduced after the participant first reads the book.","BP-011","BP-005; BP-009; BP-045",4,"Include","","","MVP","M-026; reading check-in","Honor-based confirmation is sufficient."],
  ["M-029","Creature discovery","Finishing required to obtain creature","Withhold the generated creature until the entire source book is finished.","A creature remains unavailable throughout a long novel.","BP-014","BP-009; BP-010; BP-011",1,"Avoid","","","Unassigned","Completion record","Disadvantages long books and stopped books."],
  ["M-030","Creature discovery","Different ISBN editions generate separate creatures","Treat every edition ISBN as a separate creature even when the underlying work is the same.","Hardcover, paperback, ebook, and audiobook versions create four creatures.","BP-005","BP-007; BP-014",2,"Revise","","","Unassigned","Edition/work reconciliation","Creates clutter and format inequity; consider cosmetic provenance instead."],
  ["M-031","Creature discovery","Same work shares base creature across editions","Resolve editions and formats of the same work to one base creature identity.","Paperback and audiobook versions connect to the same creature with different provenance details.","BP-005","BP-007; BP-014",5,"Strongly Include","","","MVP","Work-level clustering","Metadata matching must degrade gracefully."],
  ["M-032","Creature discovery","Every different read book enters collection","Add the creature for each different book that the participant actually reads.","Reading six different board books adds six associated creatures to the archive or visitor pool.","BP-009","BP-011; BP-021",4,"Include","","","MVP","M-026; M-028","Needs collection scaling and grouped presentation."],
  ["M-033","Creature discovery","Multiple books in one session generate multiple creatures","Allow every different book in a shared session to generate its associated creature.","A stack of four board books produces four collection entries.","BP-008","BP-009; BP-014",4,"Include","","","MVP","M-032","Do not multiply formal daily progress."],
  ["M-034","Creature discovery","Group multiple creature reveals","Present multiple same-session discoveries in one compact sequence.","Four new creatures appear together in a short summary instead of four long introductions.","BP-018","BP-011",5,"Include","","","MVP","M-033","Each creature still needs a later inspectable record."],
  ["M-035","Creature discovery","Limit major presentation moments per day","Guarantee meaningful feedback but avoid a lengthy full ceremony for every book in a high-volume session.","One discovery receives the large introduction while the others receive compact reveals and remain available later.","BP-018","BP-014; BP-011",4,"Explore","","","MVP","M-034; daily pacing","Must not make additional books feel discarded."],
  ["M-036","Creature discovery","Source metadata shapes base traits","Use book metadata to influence non-ranked creature appearance, behavior, or preferences.","Genre influences behavior while format adds a cosmetic provenance detail.","BP-011","BP-021; BP-023",4,"Include","","","MVP","Metadata classification","Missing or biased metadata needs safe defaults and corrections."],

  ["M-037","Creature development","Continued reading develops existing creature","Give meaningful creature development when the reader continues the same book.","Another reading day reveals a behavior, memory, visual change, or environmental response.","BP-014","BP-007; BP-011",5,"Strongly Include","","","MVP","Book-creature relationship history","Development must compete in delight with new creature discovery."],
  ["M-038","Creature development","Rereading develops existing creature","Use rereading to deepen the existing creature rather than create a duplicate.","A repeated board book reveals another behavior or remembered interaction.","BP-007","BP-011; BP-014",5,"Strongly Include","","","MVP","M-037","Avoid endless grind or required reread counts."],
  ["M-039","Creature development","Finishing triggers significant recognition","Provide a substantial book-specific response when the reader reports finishing.","The creature receives a permanent change and the experience is recorded.","BP-013","BP-010; BP-011; BP-020",4,"Include","","","MVP","Book finished event","Finishing cannot be required for formal challenge completion."],
  ["M-040","Creature development","Horizontal development outcomes","Make development paths different in appearance, behavior, or role rather than stronger or weaker.","Two forms have different interests and animations but equal access and utility.","BP-014","BP-015; BP-009",5,"Strongly Include","","","MVP","Development system","Avoid rarity or stat language that reintroduces hierarchy."],
  ["M-041","Creature development","Reading patterns influence development","Let broad patterns such as sustained reading, varied reading, rereading, series continuation, or shared reading influence outcomes.","A creature develops different non-ranked traits after repeated sessions with one book versus varied books.","BP-014","BP-007; BP-008; BP-009",4,"Explore","","","Later","Readable history and enough data","Must not label ability or pressure readers into a pattern."],
  ["M-042","Creature development","Explain and redirect development","Show why a creature is leaning toward an outcome and allow the player to change course before commitment.","The interface explains which recent reading patterns are influencing the next form.","BP-009","BP-014; BP-049",5,"Include","","","Later","M-041","Explanations must remain plain and avoid sensitive inference."],
  ["M-043","Creature development","Book relationship stages","Use a small sequence of relationship stages based on first reading, continued sessions, rereads, or finishing.","A creature moves from initial reveal to familiar behavior and later established traits.","BP-011","BP-007; BP-014",4,"Explore","","","MVP","M-037","Player-facing names and exact thresholds remain undecided."],
  ["M-044","Creature care","No death, decay, or distress from absence","Prevent creatures from dying, losing permanent progress, or appearing harmed when the player is away.","After thirty days, creatures remain comfortable and permanent progress is unchanged.","BP-016","BP-003; BP-018",5,"Strongly Include","","","MVP","Persistent state","Care still needs positive reasons to return."],
  ["M-045","Creature care","Positive welcome after absence","Convert absence into a small optional return response rather than accumulated chores.","A returning player sees a saved memory or short account of what happened while away.","BP-016","BP-011; BP-018",5,"Strongly Include","","","MVP","Offline state summary","Cap stored return content to avoid backlog."],
  ["M-046","Creature care","Single optional inactivity reminder","Send at most one consented invitation to resume without urgency or loss language.","A message says the collection is ready whenever the participant wants to read again.","BP-017","BP-016; BP-049",5,"Include","","","Later","Contact consent and notification service","Avoid creature distress or expiring rewards."],
  ["M-047","Collection","One primary active creature","Allow one selected creature to receive the deepest current interaction while other creatures remain comfortable.","The selected creature accompanies current reading sessions.","BP-011","BP-018; BP-014",4,"Include","","","MVP","Creature selection","Switching must be easy and must not imply neglect."],
  ["M-048","Collection","Limited visible residents","Display a manageable number of chosen creatures in the main environment.","Four to eight favorites remain visible in the primary space.","BP-018","BP-011",4,"Include","","","MVP","Collection UI","Capacity should not become a monetized scarcity pressure."],
  ["M-049","Collection","Rotating visitors","Let discovered creatures appear temporarily based on contextual selection rules.","A creature associated with recently read material visits the environment.","BP-021","BP-011; BP-018",4,"Include","","","MVP","Visitor selection","Selection reasons should be understandable."],
  ["M-050","Collection","Unlimited collection archive","Keep a searchable record of all generated creatures and their source books without making all of them active dependents.","Every discovered creature remains in an archive even when not displayed.","BP-011","BP-018; BP-049",4,"Include","","","MVP","Persistent collection","Title-level child data needs privacy and deletion controls."],
  ["M-051","Creature care","Returning source book does not remove creature","Preserve the creature and relationship when a library book is returned.","The book goes back to the library while its associated creature remains in the collection.","BP-016","BP-009; BP-043",5,"Strongly Include","","","MVP","Circulation event optional","Avoid implying ownership of the book is required."],
  ["M-052","Creature development","Long books provide recurring depth responses","Provide periodic meaningful responses while a reader remains with one long book.","Across several reading days, the creature gains reactions and changes before the book is finished.","BP-014","BP-011; BP-018",5,"Strongly Include","","","MVP","M-037","Do not require page surveillance or exact midpoint verification."],
  ["M-053","Creature development","Short books develop through rereading","Let repeated encounters develop creatures associated with short books.","A board-book creature changes after several shared rereads.","BP-007","BP-008; BP-014",5,"Strongly Include","","","MVP","M-038","Do not treat the short book as lower value."],
  ["M-054","Feedback","Comparable meaningful feedback across reading patterns","Ensure a reader continuing one book receives meaningful feedback as regularly as a reader starting new books.","A long-novel reader receives development responses on days when a board-book reader receives discoveries.","BP-014","BP-011; BP-018",5,"Strongly Include","","","MVP","Daily response scheduler","Equalize meaningful moments, not creature counts."],

  ["M-055","Visitors and discovery","Visitors influenced by recent reading","Use recent broad reading categories to influence which creatures appear.","Recent mystery reading raises the chance of a mystery-associated visitor.","BP-021","BP-025; BP-049",4,"Include","","","MVP","Recent reading facets","Explain the reason and avoid revealing sensitive titles."],
  ["M-056","Visitors and discovery","Visitors influenced by longer-term preferences","Use an explainable, correctable summary of prior choices to influence visitors.","A participant who often chooses animal stories receives more related visitors.","BP-021","BP-009; BP-049",4,"Explore","","","Later","Preference profile","Avoid fixed identity labels and filter bubbles."],
  ["M-057","Visitors and discovery","Visitors influenced by environment","Let placed objects or environment settings influence visitor selection.","A telescope increases visits from creatures associated with space books.","BP-021","BP-011; BP-028",4,"Include","","","MVP","Environment objects","Avoid a complex optimization economy."],
  ["M-058","Visitors and discovery","Visitors influenced by active creature","Let the selected creature affect potential visitors or interactions.","The active creature attracts another with compatible interests.","BP-021","BP-011",3,"Explore","","","Later","M-047; visitor compatibility","Compatibility must not become breeding or power hierarchy unless separately approved."],
  ["M-059","Visitors and discovery","Series-related visitors","Use series continuation to reveal related visitors or future creature previews.","Reading the next volume causes a related creature to appear.","BP-020","BP-021; BP-009",4,"Include","","","Later","Series metadata","Series metadata is incomplete and needs fallback behavior."],
  ["M-060","Visitors and discovery","Wildcard visitors","Reserve some visits for optional discoveries outside established preferences.","Roughly one in five recommendation visits comes from an adjacent unfamiliar category.","BP-025","BP-021; BP-009",5,"Include","","","Later","Recommendation inventory","Wildcards must remain age-appropriate and dismissible."],
  ["M-061","Visitors and discovery","Visitors carry book recommendations","Present optional book suggestions through visiting creatures.","A visitor arrives with two books that can be saved or dismissed.","BP-021","BP-026; BP-013",5,"Strongly Include","","","MVP","Recommendation data","Do not expose why a sensitive title was selected."],
  ["M-062","Visitors and discovery","Weekly staff-curated visitor","Represent refreshed staff recommendations through a weekly visitor or display.","A weekly visitor carries a librarian-selected set for the relevant age track.","BP-022","BP-021; BP-023; BP-028",5,"Strongly Include","","","Program-Specific","Staff curation tools","Curation workload must be sustainable."],
  ["M-063","Onboarding","Immediate recommendation after joining","Offer a useful title suggestion immediately after minimal registration.","The participant chooses among three broad interests and sees an available suggestion.","BP-026","BP-035; BP-021",5,"Include","","","MVP","Starter recommendation inventory","Do not require a detailed preference questionnaire."],
  ["M-064","Social discovery","Approved-person recommendations","Allow deliberate title recommendations only among approved relationships or controlled spaces.","A participant sends one book card to an approved household member.","BP-024","BP-032; BP-049",4,"Explore","","","Later","Guardian approval, block, report","Child-safety infrastructure is substantial."],
  ["M-065","Social discovery","Structured recommendation reasons","Offer a small safe list of reasons for recommending a title.","The sender selects 'made me laugh' or 'good read-aloud.'", "BP-024","BP-021; BP-042",4,"Include","","","Later","M-064","Keep optional and avoid free-text exposure for children."],
  ["M-066","Social discovery","No recommendation read receipts or rejection feedback","Do not tell the sender whether or when a recipient opened, dismissed, or disliked a recommendation.","Dismissing a recommendation sends nothing back.","BP-009","BP-024; BP-032; BP-049",5,"Strongly Include","","","Later","M-064","Prevents social pressure and sensitive inference."],
  ["M-067","Visitors and discovery","Inclusive recommendation filters","Support format, language, accessibility, interest, length-feel, and read-aloud preferences without exposing ability labels.","A participant requests 'lots of pictures,' 'listen to it,' or 'quick and funny.'", "BP-023","BP-009; BP-041",5,"Strongly Include","","","MVP","Recommendation metadata","Avoid inferred grade-level labels."],
  ["M-068","Library discovery","Self-directed shelf activity","Provide an optional clue or trail leading to a shelf, subject, format, or display.","A creature clue directs the participant to a nature-book display.","BP-028","BP-027; BP-021",5,"Include","","","Program-Specific","Branch content tools","Should work without staff facilitation during use."],
  ["M-069","Library discovery","Event-linked book discovery","Connect library activities to related books and creature responses.","A science activity includes a related book display and associated visitor.","BP-027","BP-021; BP-013",5,"Include","","","Program-Specific","Event configuration","Books must be central rather than decorative."],

  ["M-070","Community","Shared aggregate progress goal","Visually transform a shared environment based on combined normalized participation.","Community reading days gradually restore a shared room or grow a display.","BP-029","BP-033; BP-034",5,"Strongly Include","","","Program-Specific","Community service and display","No individual ranking or contribution totals."],
  ["M-071","Community","Equal-value community contributions","Convert each eligible contribution into the same value regardless of minutes, pages, or titles.","One eligible reading day contributes one anonymous unit.","BP-031","BP-002; BP-014; BP-015",5,"Strongly Include","","","Program-Specific","M-025; community service","Define eligible events consistently."],
  ["M-072","Community","Optional community contribution separate from personal progress","Keep personal completion independent and let participants choose whether to contribute publicly or anonymously.","A reading day advances personal progress whether or not its anonymous community unit is deposited.","BP-030","BP-032; BP-049",5,"Strongly Include","","","Program-Specific","M-070; consent","Avoid making nonparticipants feel selfish."],
  ["M-073","Community","No individual leaderboard","Do not rank participants by reading days, minutes, books, pages, contributions, or creature strength.","The display shows only total community transformation.","BP-015","BP-029; BP-032; BP-033",5,"Strongly Include","","","MVP","All social surfaces","Includes indirect ranking through visible creature power."],
  ["M-074","Community","Anonymous public display elements","Represent contributions with anonymous objects or creatures unless recognition is explicitly permitted.","A participant adds a leaf or book spine without a public name.","BP-032","BP-029; BP-049",5,"Strongly Include","","","Program-Specific","Public display","Opt-in recognition must be separate and revocable."],
  ["M-075","Community","Shared completion event","Trigger the same core closing experience for all participants when the community goal concludes.","Everyone can view the restored environment and closing visitor.","BP-033","BP-029; BP-013",5,"Include","","","Program-Specific","M-070","Personal completion rewards remain separate."],
  ["M-076","Community","Collaboration unlocks narrative or cosmetic result","Let cooperation create a shared scene, visitor, or keepsake unavailable through solo activity without adding strategic power.","Combined contributions reveal a temporary visitor and collective illustration.","BP-034","BP-029; BP-015",4,"Include","","","Later","M-070","No strategically stronger or exclusive core creature."],

  ["M-077","Access and onboarding","Guest-first onboarding","Let a participant begin before creating or linking a full account.","Choose a nickname and start; account recovery is offered later.","BP-035","BP-036; BP-044",5,"Strongly Include","","","MVP","Local persistence","Recovery and consent still need a clear path."],
  ["M-078","Access and onboarding","No library card required","Allow full core participation without entering library credentials.","A home reader records days and develops creatures without a card.","BP-036","BP-043; BP-014",5,"Strongly Include","","","MVP","Manual and local modes","Card linking can add service convenience only."],
  ["M-079","Access and onboarding","Home and manual book entry","Support home-shelf scanning plus title search or minimal manual entry.","A reader can add an ebook or unlisted title without a barcode.","BP-005","BP-036; BP-041",5,"Strongly Include","","","MVP","Search and fallback entry","Manual entry cannot be treated as fraudulent participation."],
  ["M-080","Access and onboarding","Paper reading-day tracker","Provide a complete paper route using the same formal milestones.","A paper sheet contains twenty markable reading days.","BP-037","BP-038; BP-042",5,"Strongly Include","","","Program-Specific","Program operations","The game must not become mandatory."],
  ["M-081","Access and onboarding","Staff-assisted progress check-in","Allow library staff to record or reconcile progress for participants.","Staff records a participant's tenth reading day at the desk.","BP-040","BP-038; BP-039; BP-048",5,"Strongly Include","","","Program-Specific","Staff tools and privacy controls","Staff should not need title-level history."],
  ["M-082","Access and onboarding","Outreach progress and registration route","Allow staff to register and check in participants at community locations.","A staff member creates a starter record at a park or school visit.","BP-044","BP-035; BP-040",5,"Strongly Include","","","Program-Specific","Offline-capable staff workflow","A QR code alone is not completed outreach."],
  ["M-083","Access and onboarding","Progress reconstruction and import","Restore remembered paper or lost progress without penalty and optionally import it digitally.","Staff or participant re-enters twelve remembered reading days.","BP-039","BP-038; BP-040; BP-048",5,"Strongly Include","","","Program-Specific","Reconciliation rules","Do not downgrade reconstructed days."],
  ["M-084","Accessibility","Alternatives for required interactions","Provide nonvisual, nonspeech, noncamera, and nondrag alternatives for every required action.","A title can be searched instead of scanned and a button can replace a drag gesture.","BP-041","BP-005; BP-037",5,"Strongly Include","","","MVP","Accessibility design","Must be designed with the core flow, not added later."],
  ["M-085","Accessibility","Plain-language and translated participation rules","Present the central rules in plain language and principal community languages.","Every channel states that any format, language, reread, and shared reading counts.","BP-042","BP-001; BP-006",5,"Strongly Include","","","MVP","Localization","Game terminology cannot obscure program eligibility."],
  ["M-086","Access and onboarding","Complete at-home path","Allow core reading, progress, creature, and completion preparation without regular library visits.","A participant can complete twenty reading days from home.","BP-043","BP-036; BP-037",5,"Strongly Include","","","MVP","Remote check-in","Physical reward fulfillment may still need a flexible route."],
  ["M-087","Access and onboarding","Library provenance is cosmetic only","Use verified checkout or branch information for optional appearance or service convenience, not stronger progression.","A library-borrowed book adds a visual source marker but no power bonus.","BP-014","BP-036; BP-043",5,"Strongly Include","","","MVP","Library integration","Avoid geography and privilege becoming rarity."],

  ["M-088","Measurement","Activation begins with first reading day","Define an active participant as registered plus at least one recorded reading day.","An account that only scans books remains registered but not active.","BP-045","BP-048",5,"Strongly Include","","","MVP","M-002; analytics definitions","Do not use downloads or scans as activation."],
  ["M-089","Measurement","Canonical halfway and completion statuses","Define halfway at ten reading days and completion at twenty across every channel.","Paper, app, staff, and outreach records all calculate the same status.","BP-048","BP-012; BP-038",5,"Strongly Include","","","MVP","M-010; shared data contract","Definitions must not change midseason."],
  ["M-090","Measurement","Three outcome questions","Ask whether participants read more often, discovered enjoyable material, and feel more comfortable using the library.","Completion offers yes, somewhat, no, and an optional comment.","BP-046","BP-047; BP-042",5,"Strongly Include","","","Program-Specific","Survey and consent","Keep optional and brief."],
  ["M-091","Measurement","Post-program return measure","Measure a later borrow, visit, event, or next-season action within an appropriate window where privacy permits.","Report the share of participants who return within sixty days.","BP-047","BP-020; BP-049",4,"Include","","","Program-Specific","Privacy-safe identity reconciliation","Avoid creating a detailed behavioral trail."],
  ["M-092","Measurement","Stable cross-channel definitions","Use one documented vocabulary for registered, active, halfway, completed, and returned.","All reporting routes emit compatible status records.","BP-048","BP-038; BP-040",5,"Strongly Include","","","MVP","Shared data contract","Changes require explicit versioning."],
  ["M-093","Privacy","Collect minimum necessary data","Store only information needed for operation, recovery, personalization chosen by the user, and evaluation.","Public community progress receives no title or duration data.","BP-049","BP-032; BP-041",5,"Strongly Include","","","MVP","Data inventory and deletion","Title history and child preferences are sensitive."],
  ["M-094","Preferences","Explainable and correctable reading preference summary","Summarize broad recent preferences for private personalization while showing the inputs and allowing corrections or deletion.","The participant can remove a category from recommendations or hide a title from the summary.","BP-009","BP-021; BP-025; BP-049",4,"Explore","","","Later","Enough matched books; privacy controls","Do not infer ability, identity, or sensitive traits."],
  ["M-095","Environment","Environment reflects broad reading patterns","Use broad reading categories to influence optional environment decoration or ambience.","Recent nature reading adds a field-guide desk or plant motif.","BP-011","BP-021; BP-049",3,"Explore","","","Later","M-094 or recent broad facets","Must not expose exact private titles to others."],
  ["M-096","Creature care","Genre-based consumable care items","Generate category-themed care items from reading activity and use them to influence creatures or visitors.","Reading an animal story produces an animal-story-themed item used in the environment.","BP-011","BP-014; BP-018",2,"Revise","","","Unassigned","Reading classification; inventory","Risks transactional reading, multiple currencies, and format inequity."],
  ["M-097","Creature care","Prepare environment before leaving","Let the player make one short environmental choice that affects later visitor activity.","Place one object or setting, close the app, and return later to see what happened.","BP-018","BP-011; BP-028",4,"Include","","","MVP","M-057; offline simulation","Keep simple and nonconsumptive where possible."],
  ["M-098","Creature care","Offline activity report","Summarize creature visits and interactions that occurred while the app was closed.","On return, show a few snapshots of visitors and resident interactions.","BP-016","BP-011; BP-018",5,"Include","","","MVP","Offline simulation","Reports need caps and guaranteed useful outcomes."],
  ["M-099","Creature care","Collectible relationship keepsakes","Record small non-power items or memories associated with reading and creature interactions.","A completed or repeated book adds a permanent illustrated memory to its creature record.","BP-011","BP-013; BP-007",4,"Include","","","MVP","Collection record","Avoid excessive random rarity or transactional grind."],
  ["M-100","Creature care","Creature photography","Allow optional photos or posed records of creatures and environments.","The player saves an image of a visitor interaction.","BP-011","BP-013",3,"Explore","","","Later","Rendering and child privacy","Sharing must be separately controlled."],
];

const bpById = new Map(bestPractices.map(r => [r[0], r]));
const mechanicMapRows = [];
for (const m of mechanics) {
  const [id,,,description,,primary,otherString,fit,recommendation] = m;
  const relationship = recommendation === "Avoid" ? "Conflict" : fit >= 4 ? "Direct" : "Supporting";
  mechanicMapRows.push([id, primary, fit, relationship, `${description} Primary relationship to ${bpById.get(primary)?.[1] ?? primary}.`, ""]);
  for (const other of otherString.split(";").map(s => s.trim()).filter(Boolean)) {
    const secondaryFit = recommendation === "Avoid" ? Math.min(2, fit + 1) : Math.max(2, fit - 1);
    mechanicMapRows.push([id, other, secondaryFit, recommendation === "Avoid" ? "Potential conflict" : "Supporting", `${description} Also relates to ${bpById.get(other)?.[1] ?? other}.`, ""]);
  }
}

const workbook = Workbook.create();
const summary = workbook.worksheets.add("Decision Summary");
const decisions = workbook.worksheets.add("Mechanics Decisions");
const mapping = workbook.worksheets.add("Best Practice Map");
const practices = workbook.worksheets.add("Reading Best Practices");

const colors = {
  navy: "#17324D", teal: "#2F6F6D", cream: "#F7F2E8", paleTeal: "#DDEDEA",
  paleGold: "#F3E7BD", gold: "#C9993B", ink: "#24313A", muted: "#64747D",
  white: "#FFFFFF", green: "#DDEFD8", red: "#F4D7D3", yellow: "#FFF0BF", blue: "#DDE7F4", line: "#CBD6D8"
};

function titleBlock(sheet, title, subtitle, endCol) {
  sheet.showGridLines = false;
  sheet.getRange(`A1:${endCol}1`).merge();
  sheet.getRange("A1").values = [[title]];
  sheet.getRange("A1").format = { fill: colors.navy, font: { bold: true, color: colors.white, size: 18 }, verticalAlignment: "center" };
  sheet.getRange("A1").format.rowHeight = 34;
  sheet.getRange(`A2:${endCol}2`).merge();
  sheet.getRange("A2").values = [[subtitle]];
  sheet.getRange("A2").format = { fill: colors.cream, font: { color: colors.ink, italic: true }, wrapText: true, verticalAlignment: "center" };
  sheet.getRange("A2").format.rowHeight = 34;
}

function styleHeader(range) {
  range.format = {
    fill: colors.teal,
    font: { bold: true, color: colors.white },
    wrapText: true,
    verticalAlignment: "center",
    borders: { bottom: { style: "medium", color: colors.navy } }
  };
  range.format.rowHeight = 32;
}

// Mechanics Decisions
titleBlock(decisions, "Stacklings Mechanics Decision Workbook", "Review one atomic mechanic per row. Edit only Your Decision, Decision Notes, and Phase. Descriptions are intentionally functional and contain no proposed player-facing names.", "O");
const decisionHeaders = ["Mechanic ID","Category","Mechanic Name","Description — No Flavor","Example Implementation","Primary Best Practice","Other Related Best Practices","Fit Score","Recommendation","Your Decision","Decision Notes","Phase","Dependencies","Risks / Conflicts","Source / Context"];
decisions.getRange("A4:O4").values = [decisionHeaders];
styleHeader(decisions.getRange("A4:O4"));
const decisionRows = mechanics.map(r => [...r, "Prior mechanics-to-best-practices review; successful-reading-program-blueprint.md"]);
decisions.getRangeByIndexes(4, 0, decisionRows.length, decisionHeaders.length).values = decisionRows;
const lastDecisionRow = 4 + decisionRows.length;
decisions.getRange(`A5:O${lastDecisionRow}`).format = { font: { color: colors.ink, size: 10 }, verticalAlignment: "top", wrapText: true, borders: { insideHorizontal: { style: "thin", color: colors.line } } };
decisions.getRange(`J5:L${lastDecisionRow}`).format.fill = colors.paleGold;
decisions.getRange(`H5:H${lastDecisionRow}`).format.numberFormat = "0";
decisions.getRange(`J5:J${lastDecisionRow}`).dataValidation = { rule: { type: "list", values: ["Yes","No","Revise","Defer"] } };
decisions.getRange(`L5:L${lastDecisionRow}`).dataValidation = { rule: { type: "list", values: ["MVP","Later","Program-Specific","Unassigned"] } };
decisions.getRange(`J5:J${lastDecisionRow}`).conditionalFormats.add("containsText", { text: "Yes", format: { fill: colors.green, font: { bold: true, color: "#24552A" } } });
decisions.getRange(`J5:J${lastDecisionRow}`).conditionalFormats.add("containsText", { text: "No", format: { fill: colors.red, font: { bold: true, color: "#7A2C27" } } });
decisions.getRange(`J5:J${lastDecisionRow}`).conditionalFormats.add("containsText", { text: "Revise", format: { fill: colors.yellow, font: { bold: true, color: "#6F5200" } } });
decisions.getRange(`J5:J${lastDecisionRow}`).conditionalFormats.add("containsText", { text: "Defer", format: { fill: colors.blue, font: { bold: true, color: "#31547A" } } });
decisions.getRange(`A4:O${lastDecisionRow}`).format.autofitRows();
const widths = [12,18,30,48,42,18,28,10,18,14,34,18,28,38,26];
widths.forEach((w,i) => decisions.getRangeByIndexes(0,i,lastDecisionRow,1).format.columnWidth = w);
decisions.freezePanes.freezeRows(4);
decisions.freezePanes.freezeColumns(3);
decisions.tables.add(`A4:O${lastDecisionRow}`, true, "MechanicsDecisionTable");

// Best Practice Map
titleBlock(mapping, "Mechanic ↔ Reading Best-Practice Map", "Each row represents one relationship. The same mechanic and best practice may appear many times; this is intentional. Decision values update from the Mechanics Decisions sheet.", "F");
const mapHeaders = ["Mechanic ID","Best Practice ID","Fit Score","Relationship","Rationale","Current Decision"];
mapping.getRange("A4:F4").values = [mapHeaders];
styleHeader(mapping.getRange("A4:F4"));
mapping.getRangeByIndexes(4,0,mechanicMapRows.length,6).values = mechanicMapRows;
const lastMapRow = 4 + mechanicMapRows.length;
mapping.getRange("F5").formulas = [[`=IFERROR(VLOOKUP(A5,'Mechanics Decisions'!$A$5:$J$${lastDecisionRow},10,FALSE),"")`]];
mapping.getRange(`F5:F${lastMapRow}`).fillDown();
mapping.getRange(`A5:F${lastMapRow}`).format = { font: { color: colors.ink, size: 10 }, verticalAlignment: "top", wrapText: true, borders: { insideHorizontal: { style: "thin", color: colors.line } } };
mapping.getRange(`C5:C${lastMapRow}`).format.numberFormat = "0";
[14,18,10,18,62,16].forEach((w,i)=>mapping.getRangeByIndexes(0,i,lastMapRow,1).format.columnWidth=w);
mapping.getRange(`A4:F${lastMapRow}`).format.autofitRows();
mapping.freezePanes.freezeRows(4);
mapping.tables.add(`A4:F${lastMapRow}`, true, "BestPracticeMapTable");

// Reading Best Practices
titleBlock(practices, "Reading Best Practices", "Reference list extracted from successful-reading-program-blueprint.md. Coverage columns update as decisions are made.", "I");
const practiceHeaders = ["Best Practice ID","Best Practice","Plain Description","Source Section","Priority","Design Test","Approved Links","Resolution Links","Coverage Status"];
practices.getRange("A4:I4").values = [practiceHeaders];
styleHeader(practices.getRange("A4:I4"));
const practiceRows = bestPractices.map(r=>[...r,"","",""]);
practices.getRangeByIndexes(4,0,practiceRows.length,9).values = practiceRows;
const lastPracticeRow = 4 + practiceRows.length;
practices.getRange("G5").formulas = [[`=COUNTIFS('Best Practice Map'!$B$5:$B$${lastMapRow},A5,'Best Practice Map'!$F$5:$F$${lastMapRow},"Yes")`]];
practices.getRange(`G5:G${lastPracticeRow}`).fillDown();
practices.getRange("H5").formulas = [[`=COUNTIFS('Best Practice Map'!$B$5:$B$${lastMapRow},A5,'Best Practice Map'!$F$5:$F$${lastMapRow},"Revise")+COUNTIFS('Best Practice Map'!$B$5:$B$${lastMapRow},A5,'Best Practice Map'!$F$5:$F$${lastMapRow},"Defer")`]];
practices.getRange(`H5:H${lastPracticeRow}`).fillDown();
practices.getRange("I5").formulas = [[`=IF(G5>0,"Covered",IF(H5>0,"Needs resolution",IF(COUNTIFS('Best Practice Map'!$B$5:$B$${lastMapRow},A5,'Best Practice Map'!$F$5:$F$${lastMapRow},"No")>0,"No approved fit","Pending decisions")))`]];
practices.getRange(`I5:I${lastPracticeRow}`).fillDown();
practices.getRange(`A5:I${lastPracticeRow}`).format = { font: { color: colors.ink, size: 10 }, verticalAlignment: "top", wrapText: true, borders: { insideHorizontal: { style: "thin", color: colors.line } } };
practices.getRange(`G5:H${lastPracticeRow}`).format.numberFormat = "0";
practices.getRange(`I5:I${lastPracticeRow}`).conditionalFormats.add("containsText", { text: "Covered", format: { fill: colors.green, font: { bold: true } } });
practices.getRange(`I5:I${lastPracticeRow}`).conditionalFormats.add("containsText", { text: "Needs", format: { fill: colors.yellow, font: { bold: true } } });
practices.getRange(`I5:I${lastPracticeRow}`).conditionalFormats.add("containsText", { text: "No approved", format: { fill: colors.red, font: { bold: true } } });
[16,28,48,28,16,48,14,16,20].forEach((w,i)=>practices.getRangeByIndexes(0,i,lastPracticeRow,1).format.columnWidth=w);
practices.getRange(`A4:I${lastPracticeRow}`).format.autofitRows();
practices.freezePanes.freezeRows(4);
practices.freezePanes.freezeColumns(2);
practices.tables.add(`A4:I${lastPracticeRow}`, true, "ReadingBestPracticesTable");

// Decision Summary
titleBlock(summary, "Decision Summary", "This sheet updates as you choose Yes, No, Revise, or Defer. Start on Mechanics Decisions and edit the pale-gold columns.", "H");
summary.getRange("A4:B4").values = [["Decision","Count"]];
styleHeader(summary.getRange("A4:B4"));
summary.getRange("A5:A10").values = [["Total mechanics"],["Yes"],["No"],["Revise"],["Defer"],["Undecided"]];
summary.getRange("B5").formulas = [[`=COUNTA('Mechanics Decisions'!$A$5:$A$${lastDecisionRow})`]];
summary.getRange("B6").formulas = [[`=COUNTIF('Mechanics Decisions'!$J$5:$J$${lastDecisionRow},"Yes")`]];
summary.getRange("B7").formulas = [[`=COUNTIF('Mechanics Decisions'!$J$5:$J$${lastDecisionRow},"No")`]];
summary.getRange("B8").formulas = [[`=COUNTIF('Mechanics Decisions'!$J$5:$J$${lastDecisionRow},"Revise")`]];
summary.getRange("B9").formulas = [[`=COUNTIF('Mechanics Decisions'!$J$5:$J$${lastDecisionRow},"Defer")`]];
summary.getRange("B10").formulas = [[`=B5-SUM(B6:B9)`]];
summary.getRange("A5:B10").format = { fill: colors.white, font: { color: colors.ink }, borders: { insideHorizontal: { style: "thin", color: colors.line }, outside: { style: "thin", color: colors.line } } };
summary.getRange("B5:B10").format = { font: { bold: true, color: colors.navy, size: 14 }, horizontalAlignment: "right" };
summary.getRange("D4:E4").values = [["Coverage","Count"]];
styleHeader(summary.getRange("D4:E4"));
summary.getRange("D5:D8").values = [["Covered practices"],["Needs resolution"],["No approved fit"],["Pending decisions"]];
summary.getRange("E5").formulas = [[`=COUNTIF('Reading Best Practices'!$I$5:$I$${lastPracticeRow},"Covered")`]];
summary.getRange("E6").formulas = [[`=COUNTIF('Reading Best Practices'!$I$5:$I$${lastPracticeRow},"Needs resolution")`]];
summary.getRange("E7").formulas = [[`=COUNTIF('Reading Best Practices'!$I$5:$I$${lastPracticeRow},"No approved fit")`]];
summary.getRange("E8").formulas = [[`=COUNTIF('Reading Best Practices'!$I$5:$I$${lastPracticeRow},"Pending decisions")`]];
summary.getRange("D5:E8").format = { fill: colors.white, font: { color: colors.ink }, borders: { insideHorizontal: { style: "thin", color: colors.line }, outside: { style: "thin", color: colors.line } } };
summary.getRange("E5:E8").format = { font: { bold: true, color: colors.navy, size: 14 }, horizontalAlignment: "right" };

summary.getRange("A13:C13").values = [["Category","Mechanics","Approved"]];
styleHeader(summary.getRange("A13:C13"));
const categories = [...new Set(mechanics.map(m=>m[1]))];
summary.getRangeByIndexes(13,0,categories.length,1).values = categories.map(c=>[c]);
for (let i=0;i<categories.length;i++) {
  const row=14+i;
  summary.getRange(`B${row}`).formulas = [[`=COUNTIF('Mechanics Decisions'!$B$5:$B$${lastDecisionRow},A${row})`]];
  summary.getRange(`C${row}`).formulas = [[`=COUNTIFS('Mechanics Decisions'!$B$5:$B$${lastDecisionRow},A${row},'Mechanics Decisions'!$J$5:$J$${lastDecisionRow},"Yes")`]];
}
const lastCategoryRow=13+categories.length;
summary.getRange(`A14:C${lastCategoryRow}`).format = { fill: colors.white, font: { color: colors.ink }, borders: { insideHorizontal: { style: "thin", color: colors.line } } };
summary.getRange(`B14:C${lastCategoryRow}`).format.numberFormat="0";
summary.getRange("E13:H13").merge();
summary.getRange("E13").values = [["Review instructions"]];
summary.getRange("E13").format = { fill: colors.gold, font: { bold: true, color: colors.white } };
summary.getRange("E14:H19").merge();
summary.getRange("E14").values = [["1. Open Mechanics Decisions.\n2. Review each functional description and example.\n3. Choose Yes, No, Revise, or Defer.\n4. Use Decision Notes for conditions or corrections.\n5. Assign a phase only when useful.\n6. Return the sheet for conflict, dependency, and coverage analysis."]];
summary.getRange("E14").format = { fill: colors.cream, font: { color: colors.ink }, wrapText: true, verticalAlignment: "top", borders: { preset: "outside", style: "thin", color: colors.gold } };
summary.getRange("E14").format.rowHeight=110;
const meaningRow = lastCategoryRow + 2;
summary.getRange(`A${meaningRow}:H${meaningRow}`).merge();
summary.getRange(`A${meaningRow}`).values = [["Decision meanings: Yes = keep substantially as described · No = remove · Revise = keep concept but change behavior/scope · Defer = potentially useful, not current version"]];
summary.getRange(`A${meaningRow}`).format = { fill: colors.paleTeal, font: { bold: true, color: colors.ink }, wrapText: true };
[26,14,14,28,18,18,18,18].forEach((w,i)=>summary.getRangeByIndexes(0,i,meaningRow,1).format.columnWidth=w);
summary.freezePanes.freezeRows(2);

// Global sheet tabular polish
for (const sheet of [summary, decisions, mapping, practices]) {
  const used = sheet.getUsedRange();
  used.format.font.name = "Arial";
}

// Compact verification before export
const inspect = await workbook.inspect({ kind: "table", range: `Mechanics Decisions!A1:O12`, include: "values,formulas", tableMaxRows: 12, tableMaxCols: 15 });
console.log(inspect.ndjson);
const errors = await workbook.inspect({ kind: "match", searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A", options: { useRegex: true, maxResults: 100 }, summary: "formula error scan" });
console.log(errors.ndjson);

for (const [sheetName, range, fileName] of [
  ["Decision Summary", `A1:H${meaningRow + 1}`, "preview_summary.png"],
  ["Mechanics Decisions", "A1:O18", "preview_decisions.png"],
  ["Best Practice Map", "A1:F18", "preview_map.png"],
  ["Reading Best Practices", "A1:I16", "preview_practices.png"],
]) {
  const preview = await workbook.render({ sheetName, range, scale: 1, format: "png" });
  await fs.writeFile(`${outputDir}/${fileName}`, new Uint8Array(await preview.arrayBuffer()));
}

const xlsx = await SpreadsheetFile.exportXlsx(workbook);
const outputPath = `${outputDir}/Stacklings Mechanics Decision Workbook.xlsx`;
await xlsx.save(outputPath);
console.log(JSON.stringify({ outputPath, mechanics: mechanics.length, bestPractices: bestPractices.length, mappings: mechanicMapRows.length }));
