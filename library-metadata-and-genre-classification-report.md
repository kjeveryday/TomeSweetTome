# How Libraries Label Books: Metadata, Genre Vocabularies, and Classification Systems

*A detailed report on the standards, processes, and vocabularies libraries use to describe and organize books, with a focus on genre and on children's and young adult materials.*

---

## 1. Introduction: What "Labeling" a Book Actually Means

When a library "labels" a book, it is really doing three distinct but related things, each governed by its own standards:

1. **Descriptive cataloging** — recording who wrote it, its title, publisher, date, physical description, and identifiers (ISBN, LCCN). The content rules today are chiefly *RDA (Resource Description and Access)*, the successor to the Anglo-American Cataloguing Rules (AACR2).
2. **Subject and genre analysis** — recording what the book is *about* (subject headings) and what the book *is* (genre/form terms). These come from controlled vocabularies such as the Library of Congress Subject Headings (LCSH) and the Library of Congress Genre/Form Terms (LCGFT).
3. **Classification** — assigning a notation (a call number) that gives the book a shelf address relative to other books, using a scheme such as the Dewey Decimal Classification (DDC) or the Library of Congress Classification (LCC).

All of this information is packaged in a machine-readable **bibliographic record**. The dominant carrier format is **MARC 21** (MAchine-Readable Cataloging), developed at the Library of Congress in the 1960s by computer scientist Henriette Avram; MARC formats became the U.S. national standard for sharing bibliographic data by 1971 and an international standard two years later. MARC 21 itself dates from 1999, when the U.S. and Canadian MARC formats were harmonized. (Source: Library of Congress MARC Standards, loc.gov/marc; Librarianship Studies summary of MARC 21 history.)

### 1.1 The anatomy of the metadata record (MARC 21)

A MARC record is a structured set of numbered fields. The ones most relevant to genre and subject labeling are the **6XX "Subject Access Fields"** defined by the Library of Congress Network Development and MARC Standards Office (loc.gov/marc/bibliographic/bd6xx.html):

| MARC field | Purpose |
|---|---|
| 600 | Subject added entry — Personal name (a book *about* a person) |
| 610 | Subject added entry — Corporate name |
| 611 | Subject added entry — Meeting name |
| 630 | Subject added entry — Uniform title |
| 647 | Subject added entry — Named event |
| 648 | Subject added entry — Chronological term |
| 650 | Subject added entry — **Topical term** (the workhorse subject field) |
| 651 | Subject added entry — Geographic name |
| **655** | **Index term — Genre/Form** (the field where genre lives) |

Per the Library of Congress's MARC 21 documentation for field 655, a **genre term** "designates the style or technique of the intellectual content" of textual materials, while a **form term** designates "historically and functionally specific kinds of materials distinguished by their physical character, the subject of their intellectual content, or the order of information within them." In plain terms: field 650 says a book is *about* horses; field 655 says the book *is* a mystery novel, a cookbook, or a picture book.

Indicator values in these fields identify which vocabulary a term comes from. Notably, in fields 650/651/655, second indicator **0** means the heading conforms to LCSH, and second indicator **1** means it conforms to the **Library of Congress Children's and Young Adults' Subject Headings** — a distinction that matters greatly for the children's/YA section of this report. Terms from other thesauri (such as LCGFT) use second indicator 7 with a source code in subfield $2 (e.g., `655 _7 $a Detective and mystery fiction. $2 lcgft`).

### 1.2 Who creates the metadata, and how it spreads

Most libraries do not catalog every book from scratch. The pipeline generally works like this:

- **Publishers** supply metadata (including BISAC subject codes — see §4) and participate in the Library of Congress **Cataloging-in-Publication (CIP)** program, which lets LC catalogers create a record *before* publication; the CIP data is printed on the copyright page.
- **National libraries and cataloging agencies** (the Library of Congress in the U.S., plus cooperative programs like the Program for Cooperative Cataloging) create authoritative records with LCSH, LCGFT, DDC, and LCC data.
- Records flow into **shared union catalogs**, chiefly OCLC's **WorldCat**, from which member libraries perform "copy cataloging" — downloading and locally adapting existing records rather than re-creating them.
- **Individual libraries** then add local data: holdings, barcodes, local call numbers, genre spine labels, and shelving locations.

---

## 2. Classification Systems: Giving Books a Shelf Address

### 2.1 The Dewey Decimal Classification (DDC)

The DDC is the most consequential numbering system in library history. Key facts, drawn from OCLC (the system's owner and publisher) and standard reference sources:

- It was **created by Melvil Dewey and first published in 1876** as a 44-page pamphlet, and has since been revised through **23 major print editions** (the latest printed in 2011); it is now maintained continuously online as **WebDewey** by **OCLC**, the nonprofit library cooperative that acquired the trademark and copyrights in 1988 when it bought Forest Press.
- Dewey's core innovation was **relative location**: books are shelved relative to one another by subject rather than given fixed shelf positions based on when they were acquired.
- OCLC describes the DDC as "the world's most widely used way to organize library collections"; the American Library Association's cataloging guide notes it is used by libraries in **more than 135 countries**.
- Updates are governed by the **Decimal Classification Editorial Policy Committee (EPC)**, an international board representing national, public, special, and academic libraries, with editorial staff based partly at the Library of Congress and partly at OCLC. (Source: OCLC, *Introduction to the Dewey Decimal Classification*.)

#### Structure: ten classes, one hundred divisions, one thousand sections

Per OCLC's official *DDC Summaries*, the first summary contains the **ten main classes** (the first digit of every number), the second summary the **hundred divisions** (second digit), and the third the **thousand sections** (third digit). A decimal point follows the third digit, after which division by ten continues indefinitely to any needed specificity. The ten main classes are:

| Number | Class |
|---|---|
| 000 | Computer science, information & general works |
| 100 | Philosophy & psychology (incl. parapsychology and occultism) |
| 200 | Religion |
| 300 | Social sciences (sociology, law, economics, education, customs, etc.) |
| 400 | Language |
| 500 | Science (natural sciences and mathematics) |
| 600 | Technology (incl. medicine, engineering, agriculture) |
| 700 | Arts & recreation |
| 800 | Literature |
| 900 | History & geography |

(Source: OCLC, *DDC 23 Summaries* and *Introduction to the DDC*.)

#### The crucial principle: discipline, not subject

The single most important — and most misunderstood — rule of the DDC, stated in OCLC's official introduction, is that **the DDC is arranged by discipline, not subject**. A subject may therefore appear in more than one place. OCLC's canonical example is *clothing*: the psychological influence of clothing classes at **155.95** (psychology), customs associated with clothing at **391** (customs), and clothing as fashion design at **746.92** (arts). Similarly, OCLC's teaching materials show *holidays* at 394.26 (customs), 344.091 (law), and 203.6 (religion), with one number designated the "interdisciplinary number."

#### How a Dewey number is assigned

OCLC's *Introduction to the DDC* describes the cataloger's process:

1. **Determine the subject and the discipline** treating it, using the title page, table of contents, chapter headings, preface (which "usually states the author's purpose"), book jacket, bibliographies, index entries, and CIP data — with the caveat that CIP data "should be verified with the book in hand."
2. **Locate the class** using the schedules, the Relative Index, and the Manual (which advises on difficult areas and on choosing between related numbers).
3. **Apply rules of preference** — e.g., the "first-of-two rule": a work treating two subjects equally is classed with the number coming first in the schedules.
4. **Build the number if needed.** Only a fraction of possible DDC numbers are printed; catalogers synthesize longer numbers using Table 1 (Standard Subdivisions), Tables 2–6 (geography, literature form, languages, ethnic/national groups, etc.), other schedule numbers, and add tables. This is why a specific book can end up with a very long number such as 004.62 (network protocols).
5. **Complete the call number** with a *Cutter number* (an alphanumeric code for the author) so the full call number is unique: PREFIX (if any) + DDC number + Cutter.

#### Where genre fiction lives in Dewey — and why most libraries opt out

Formally, fiction belongs in the **800s (Literature)**, organized first by language and then by form using **Table 3**: e.g., 813 = American fiction in English, 823 = English fiction, with period subdivisions (813.6 = American fiction, 2000–). Genre *as such* (mystery, romance, science fiction) is not a primary facet of the 800s; Dewey subordinates it to language, literary form, and period.

In practice, **most U.S. public and school libraries do not shelve novels in the 800s at all**. They pull fiction out into a separate alphabetical-by-author sequence labeled "FIC" or "F" (a convention long supported by LC/DDC guidance for public libraries), reserving the 800s for poetry, drama, essays, and literary criticism. This is precisely the arrangement that the "genrefication" movement (§6.4) reacts against: as a KQED report on school-library genrefication put it, under Dewey "nonfiction essentially already gets the genrefication treatment" (music in the 780s, paleontology in the 560s) while "most fiction is shelved in one big clump alphabetized by author's last name."

### 2.2 The Library of Congress Classification (LCC)

The second great scheme, used by most academic and research libraries:

- Developed at the Library of Congress beginning in **1898** under Librarian of Congress Herbert Putnam and chief classifier Charles Martel, and first published as a system in **1914**. (Source: EBSCO Research Starters, "Library of Congress Classification.")
- Per the ALA's cataloging tools guide, LCC "divides all knowledge into **21 basic classes**, each beginning with a single letter of the alphabet," with two- or three-letter subclasses and topic spans defined by number ranges. Examples: **B** Philosophy/Psychology/Religion, **D** World History, **K** Law, **P** Language and Literature, **Q** Science, **R** Medicine.
- LC regards LCC as an internal subject authority for its own collection, not a mandated national system, but it has been widely adopted by academic institutions, specialized libraries, and large public libraries; smaller public libraries mostly retain Dewey. (Source: EBSCO Research Starters.)

**LCC and juvenile fiction — the PZ classes.** Literature is class P; children's and young adult *fiction in English* is shelved in subclass **PZ7**, arranged by author. This area became so crowded that, per the CYAC Program's own news announcements, the Library of Congress established **PZ7.1** for authors whose first work of children's or YA fiction was published in **2015 or later**. Related PZ numbers include PZ10.3, which CYAC documentation identifies as the home of *realistic animal stories*. This is one of the few places in a major classification scheme where an audience-based genre category (children's fiction) is a first-class citizen of the shelf notation itself.

### 2.3 Other numeration systems in brief

- **Universal Decimal Classification (UDC)** — a European-origin derivative of Dewey (begun by Otlet and La Fontaine, 1895) that adds punctuation-based syntax (`:`, `+`, `=`) to combine concepts; widely used in Europe and in scientific/technical libraries.
- **Superintendent of Documents (SuDoc)** — U.S. government documents, arranged by issuing agency.
- **National Library of Medicine (NLM) classification** — extends LCC's QS–QZ and W ranges for medicine.
- **BISAC (§4)** — not a shelf classification in the traditional sense, but the book *industry's* subject scheme, increasingly used by "bookstore model" libraries that have abandoned Dewey.

---

## 3. Subject Headings vs. Genre Terms: The Two Vocabularies

### 3.1 Library of Congress Subject Headings (LCSH) — what a book is *about*

Per the Library of Congress's Controlled Vocabularies page, LCSH has been **in publication since 1909** and is "the only subject headings list accepted as a worldwide standard." It is a massive, continuously updated thesaurus (new and revised headings are approved monthly) of topical headings that can be extended with standardized subdivisions: topical ($x), geographic ($z), chronological ($y), and **form ($v)** subdivisions. A classic pre-2016-era string for a children's mystery might read:

```
650 #0 $a Horses $z Montana $v Juvenile fiction.
```

Historically, LCSH did double duty for genre via **form subdivisions** like `$v Fiction`, `$v Juvenile fiction`, and full headings like *Detective and mystery stories*. That double duty is exactly what LCGFT was created to end.

A significant recent policy change: according to reporting on LC's announcement (Librarianship Studies, January 2026, summarizing LC policy effective **February 2, 2026**), the Library of Congress is ceasing to add form subdivisions ($v) at the end of LCSH strings and will express form concepts through LCGFT terms instead, to simplify LCSH/CYAC cataloging and better support BIBFRAME linked-data environments. Existing records are not being retroactively converted, and other institutions may choose whether to follow.

### 3.2 Library of Congress Genre/Form Terms (LCGFT) — what a book *is*

LCGFT is the authoritative genre vocabulary of the U.S. library world, and its own published history (LC, *Introduction to Library of Congress Genre/Form Terms*, 2020, and LC's genre/form project pages) gives us precise details:

- **Origin.** Development began in **2007** "at the behest of the library community," which had long petitioned LC for a genre/form thesaurus. It was initially part of LCSH and was **formally separated from LCSH in May 2011**.
- **Core definition.** LCGFT terms "describe what something **is** rather than what it is **about**, as subject headings do" (LC's own phrasing, repeated across its announcements).
- **Governing principle: literary warrant.** New terms are proposed only as needed for actual cataloging, "based on information provided in the resources being cataloged as well as on research." Terms must be applied per the *Genre/Form Terms Manual*, freely available from LC.
- **Size and scope.** As of March 2017 LC reported **over 1,950 terms** spanning moving images, sound recordings, cartography, law, **literature**, music, religion, and "general" works; the vocabulary has continued to grow monthly since (it now numbers well over 2,000 terms).
- **Development by discipline.** LC's Policy and Standards Division deliberately handled each discipline as a separate project, rolling terms out in groups: radio programs first (2008), then sound recordings, cartographic materials (first terms approved May 2010), law (2010), moving images, music (~570 terms approved February 2015), general works (~175 terms, January 2015), literature (2015), and religion (2015).
- **The literature project specifically.** Per LC's introduction to LCGFT: the project began in **2012** when the ALA Subject Analysis Committee's Subcommittee on Genre/Form Implementation formed the Working Group on LCGFT Literature Terms. The **first group of approximately 230 literature terms was approved in May 2015** (LC's announcement page says ~125 were approved in the first tranche from Tentative List 1515, with the remainder following); the **second group of approximately 150 terms was added in October 2015**. LCSH headings were the starting point, but headings and reference structures were adjusted and scope notes added, and the Working Group proposed terms with no LCSH equivalent. **All literary genre/form terms are narrower terms in the single "Literature" hierarchy.**
- **Term construction.** Each LCGFT term is a single genre or form — one word (*Cookbooks*, *Novels*, *Encyclopedias*) or a phrase (*Handbooks and manuals*, *Steampunk music*, *Tongue twisters*), with parenthetical qualifiers only to break homonyms (*Thrillers (Motion pictures)* vs. *Thrillers (Radio programs)*). LC's stated preference is for **broader rather than narrower terms**, because most literary works give "only a broad indication of their genres and forms," and broad terms serve both catalogers and users.
- **Faceted design.** The cartography project taught LC that the vocabulary must be **fully faceted** — each term representing a single concept, with multiple terms assigned to express multiple concepts. A single novel can therefore legitimately carry *Detective and mystery fiction* + *Historical fiction* + *Novels* simultaneously.
- **Continuing growth.** LC catalogers and SACO (Subject Authority Cooperative Program) members may propose additional terms, which are reviewed and approved on monthly lists.

#### The literary genre terms themselves

The LCGFT Literature hierarchy contains (with counts approximate, since the list grows monthly) several hundred terms organized under top-level forms — **Fiction, Poetry, Drama, Essays, Folk literature, Humor, Prose literature**, etc. Representative genre terms under *Fiction* include (each an authorized LCGFT term with its own authority record and scope note):

- **Action and adventure fiction** — fast-paced narratives of physical danger and exploits
- **Detective and mystery fiction** — crime-solving narratives centered on investigation
- **Science fiction** — with narrower terms such as *Steampunk fiction*, *Cyberpunk fiction*, *Dystopian fiction*, *Apocalyptic fiction*
- **Fantasy fiction** — with narrower terms such as *Epic fiction*, *Paranormal fiction*
- **Historical fiction** — narratives set in a recognizable historical past
- **Romance fiction** — narratives whose central concern is a love relationship with an emotionally satisfying resolution
- **Horror fiction**, **Thrillers (Fiction)**, **Westerns (Fiction)**, **War fiction**, **Sea fiction**, **Sports fiction**, **Christian fiction**, **Humorous fiction**, **Gothic fiction**, **Magic realist fiction**, **Legal fiction (Literature)**, **Spy fiction**, **Bildungsromans** (coming-of-age novels), **Epistolary fiction**, **Flash fiction**, **Short stories**, **Novellas**, **Novels**, **Graphic novels**, **Fan fiction**
- Folk-literature forms: **Fairy tales**, **Folk tales**, **Fables**, **Legends**, **Myths**, **Tall tales**, **Nursery rhymes**
- Audience-flavored genre terms (technically out of scope for a pure genre facet, but retained): **Children's films** and analogous "Children's…" terms; LC's introduction itself notes such audience terms are "technically out of scope" but currently included.

Definitions live in each term's **scope note** in its MARC authority record (tag 155 = authorized form, 455 = unauthorized variants, 555 = related terms), retrievable freely at **id.loc.gov/authorities/genreForms**. That is the authoritative place to look up any individual genre's official definition.

#### Predecessor vocabulary: GSAFD

Before LCGFT literature terms existed, many libraries used ALA's ***Guidelines on Subject Access to Individual Works of Fiction, Drama, Etc.* (GSAFD)** — per LC's controlled-vocabularies page, a list of genre and form headings for literature "designed to assist with the provision of readers' advisory services," which LC applied to English-language literary works until LCGFT literature terms were implemented. GSAFD codes (`$2 gsafd`) still appear in millions of legacy records.

#### Other genre/form thesauri a cataloger may draw on

MARC 655's subfield $2 accepts codes for many vocabularies. Commonly encountered (per Yale's Beinecke rare-book cataloging manual and LC's source-code lists): **rbmscv** (RBMS Controlled Vocabulary for rare materials), **gmgpc** (LC Thesaurus for Graphic Materials — ~650 genre/format terms per LC), **aat** (Getty Art & Architecture Thesaurus), **fast** (OCLC's Faceted Application of Subject Terminology), and national systems such as Canadian Subject Headings and the French *Répertoire de vedettes-matière*.

### 3.3 How a genre actually gets assigned to a book — the workflow

Synthesizing LC's manuals and announcements, the assignment process for a new trade novel looks like this:

1. **Publisher stage.** The publisher assigns up to three **BISAC codes** (§4) and submits a CIP application to LC.
2. **LC cataloging.** A cataloger (for juvenile fiction, a **CYAC** cataloger — §6) examines the galley/book, writes a brief objective summary, assigns **subject headings** (LCSH and/or Children's Subject Headings) for what the story is about (topics, settings, character types), and assigns **LCGFT terms in 655 fields** for what it is (e.g., `655 _7 $a Detective and mystery fiction. $2 lcgft` plus `655 _7 $a Novels. $2 lcgft`). LC's example from the literature-terms announcement: a concrete-poetry collection receives `650 #0 Concrete poetry, American` *and* `655 #7 Concrete poetry. $2 lcgft` — while a critical work *about* concrete poetry gets only subject headings, no genre term.
3. **Classification.** The same record receives a DDC number and an LCC number (juvenile fiction → PZ7/PZ7.1; public-library convention → FIC/E/J FIC local call numbers).
4. **Distribution and local adaptation.** The record enters WorldCat; local libraries copy it and may add local genre categories, spine labels, and shelving locations. Vendors formalize this: per the Mississippi Department of Education's genrefication guide, **Follett Destiny** recommends using copy-level "sublocation" and "category" fields (not the title-level 655 tag) for school genre locations, and **Mackin** will match a library's exported MARC records by title/ISBN against its internal master genre lists and return a spreadsheet assigning each title a *dominant genre*, then print new spine labels.
5. **Ongoing vocabulary maintenance.** If no existing term fits, catalogers propose new terms (via SACO for LCGFT; via BISG's suggestion process for BISAC), which are approved on monthly (LC) or annual (BISAC) cycles — the mechanism of *literary warrant* keeping the vocabularies tethered to what is actually being published.

---

## 4. BISAC: The Book Industry's Genre System

Libraries increasingly interact with — and sometimes adopt — the **BISAC Subject Headings**, maintained by the **Book Industry Study Group (BISG)**. Facts from BISG's own FAQ and pages:

- BISAC ("Book Industry Standards and Communications") is "an industry-approved list of subject descriptors, each of which is represented by a **nine-character alphanumeric code**" — a 3-letter section prefix + 6 digits (e.g., `FIC022020 = FICTION / Mystery & Detective / Police Procedural`).
- There are **54 major sections** (BISG FAQ), such as FICTION, HISTORY, TRUE CRIME, COMPUTERS — and, critically for this report, four audience-segregated sections: **JUVENILE FICTION (JUV), JUVENILE NONFICTION (JNF), YOUNG ADULT FICTION (YAF), YOUNG ADULT NONFICTION (YAN)**.
- Descriptors have two to four levels (e.g., `TRAVEL / United States / South / General`).
- **Assignment rules (BISG best practice):** the publisher selects the codes; choose the *primary* code first (retailers weight it most and it may be the only one printed on the book); use **no more than three** codes per title; fiction and nonfiction codes must not be mixed on one title; and the four juvenile/YA sections must not be mixed with each other or with adult sections.
- The list is revised annually each fall (the **2025 Edition** was released in December 2025); suggestions for new codes are accepted year-round.
- Purpose: standardized electronic transfer of subject information between trading partners, search access, and **shelving guidance** — which is why "bookstore model" libraries that drop Dewey often shelve by BISAC categories instead.

BISAC is thus the *industry-side* genre metadata that arrives with a book before a library ever touches it, and it heavily influences the genre categories libraries and vendors use. (Its international counterpart is **Thema**, maintained by EDItEUR for global trade metadata.)

---

## 5. Summary Table: The Major Systems Compared

| System | Maintainer | Kind | Size/Structure | Answers |
|---|---|---|---|---|
| DDC | OCLC (EPC editorial board) | Shelf classification | 10 classes → 100 divisions → 1,000 sections → infinite decimal expansion | "Where does it sit relative to other subjects?" |
| LCC | Library of Congress | Shelf classification | 21 lettered classes + subclasses + number spans | Same, for research collections |
| LCSH | Library of Congress | Subject vocabulary | Hundreds of thousands of headings; published since 1909; monthly updates | "What is it about?" |
| LCGFT | Library of Congress | Genre/form vocabulary | 1,950+ terms (2017 count), faceted, 655 field | "What is it?" |
| CYAC / Children's Subject Headings | Library of Congress | Subject vocabulary for youth | Separate authority file since July 2021 | "What is it about?" — in kid-friendly language |
| GSAFD | ALA (legacy) | Genre vocabulary | Superseded by LCGFT for new cataloging | Legacy genre access |
| BISAC | Book Industry Study Group | Industry subject/genre codes | 54 major sections, ~5,000 codes, annual editions | Trade categorization, shelving, discovery |

---

## 6. Special Section: Children's and Young Adult Books

Children's and YA materials get an entire parallel metadata infrastructure, because — in the Library of Congress's own words — how "children, young adults, and those who assist them in libraries search for books… can be very different from the approach taken by most adults."

### 6.1 The CYAC Program: the authoritative source of children's cataloging

All facts below are from the Library of Congress's own CYAC program pages (loc.gov/aba/cyac):

- **History.** The **Children's and Young Adults' Cataloging (CYAC) Program** is one of LC's oldest programs, continuing the **Annotated Card (AC) Program established in the fall of 1965**. The AC Program's innovations were (a) including a **summary or annotation** of each book on the printed catalog card — "a new idea at the time" — and (b) using subject headings **more accessible to youths**. It was officially renamed CYAC in **2010**.
- **What it catalogs.** CYAC catalogs fiction (belles lettres) for children and young adults acquired through CIP or the Copyright Office — English-language material published anywhere and foreign-language material published in the U.S. Because most children's publishers participate in CIP, CYAC creates metadata for a high percentage of new U.S. children's/YA literature **before publication**.
- **Official age definitions.** For LC purposes, *juvenile/children's literature* is material for an audience **up to and including ninth grade or age fifteen**; *young adult literature* is generally **ages twelve through high school**. (Note the deliberate overlap.)
- **Genres in scope** — LC's own enumerated list of material types the CYAC program handles: collections and single works of fiction for children and YA; **juvenile graphic novels; juvenile novels in verse; juvenile poetry; original and traditional fairy tales; folklore; fables; classical nursery rhymes (Mother Goose); stories in rhyme; song lyrics in picture-book format; fiction about realistic animals; bilingual and polyglot juvenile fiction**.
- **Each record includes** "an objective and succinct summary of the book" plus tailored subject headings — used by researchers, publishers, and school and public libraries.
- The program also **develops new children's subject headings, proposes changes, monitors children's cataloging policy, and tracks trends in children's publishing**.

### 6.2 Children's Subject Headings (CSH): a vocabulary built for young users

Again per LC's own documentation (CYAC subject cataloging pages and the *Introduction to Children's Subject Headings*):

- The AC/CYAC approach was originally "a more liberal application" of LCSH — simplified headings, changed application rules, and new headings where LCSH had none — maintained as a list of *exceptions* to LCSH.
- In **July 2021**, the **Children's and Young Adults' Subject Headings were formally separated from LCSH**; every heading now has its own authority record.
- **Design principles LC documents explicitly:**
  - *Compression of academic distinctions*: LCSH's *Separation (Philosophy)* and *Separation (Psychology)* collapse into the single CYAC term **Separation** — "such granularity… is unnecessary in a children's catalog."
  - *Common names over scientific ones*: **Bedwetting** rather than *Enuresis*; **Tube-lipped nectar bats** rather than *Anoura fistulata*; plural forms for most species.
  - *Scope notes* define terms and constrain application, especially where CYAC usage differs from LCSH.
  - New headings are vetted against dictionaries (Webster's Third, Random House), indexes the public actually uses (Reader's Guide, New York Times Index), the **Sears List of Subject Headings**, and children's encyclopedias.
- **Dual-heading records.** For certain popular categories, CYAC records carry *both* an LCSH string and a CYAC string, distinguished by MARC indicators — LC's own example for a realistic horse story (classed in PZ10.3):

```
650 #0 $a Horses $v Juvenile fiction.   (LCSH — indicator 0)
650 #1 $a Horses $v Fiction.            (CYAC — indicator 1)
```

  Note the deliberate simplification: the child-facing heading says just "Fiction," not "Juvenile fiction." Categories receiving this dual treatment include realistic animal stories, stories about real people (e.g., *Houdini, Harry… — Fiction*), historical settings, peoples, and named entities.
- **Genre access in CYAC records** additionally comes from LCGFT terms (655 fields) — e.g., authority records exist for terms like **Children's audiobooks** — and from the required-headings rules for young creators (LC maintains headings like *Children's writings, [nationality]* for works written by authors through age twelve, and *Children's art* for artwork by children under fifteen).

### 6.3 The children's/YA genre taxonomy in the book trade: BISAC's JUV/YAF sections

The most granular, explicitly enumerated genre lists for children's and YA books are BISG's. From BISG's published section pages:

- **Audience boundaries (BISG's official definitions):** *Juvenile Fiction* = children's fiction for **ages 0–11 (preschool–grade 6)**; *Young Adult Fiction* = fiction for **ages 12–18 (grades 7–12)**. Juvenile/YA fiction and nonfiction codes must not be mixed on a single title, and critical works *about* children's literature intended for adults go under `LITERARY CRITICISM / Children's & Young Adult Literature` instead.
- **The JUV subgenre tree.** The Juvenile Fiction section contains hundreds of codes organized into top-level subgenre families, each with numbered children. Representative families (from BISG's list): **Action & Adventure; Animals** (Publishers Weekly noted the section has had *43 headings for animal fiction alone*); **Bedtime & Dreams; Biographical; Comics & Graphic Novels; Concepts** (alphabet, counting, colors); **Diversity & Multicultural** trees such as **Hispanic & Latino** (with children like *Borders, Immigration & Migration; Family Life (Familia); Historical*) and **Indigenous** (BISG's usage notes specify "Indigenous Peoples of Turtle Island" phrasing for works about Indigenous people in Canada); **Fairy Tales & Folklore; Family; Fantasy & Magic; Health & Daily Living** (children include *Diseases, Illnesses & Injuries; Mental Health; Mindfulness & Meditation; Toilet Training*); **Historical; Holidays & Celebrations** (with usage note: only for works actually *about* the holiday, with children like *Birthdays*); **Horror & Ghost Stories; Humorous; Imagination & Play; Legends, Myths, Fables; LGBTQ+; Media Tie-In** (BISG's rule: use when a new ISBN is based on a movie/TV show, and pair it with another primary subject); **Mysteries & Detective Stories; Paranormal; Readers** (beginner/early/chapter); **Religious** (e.g., Christian, with its own sub-tree: General; Action & Adventure; Animals; Bedtime & Dreams; Comics & Graphic Novels; Early Readers; Emotions & Feelings; Family; Fantasy; Friendship; Historical; Holidays & Celebrations; Humorous; Learning Concepts…); **Robots; School & Education; Science Fiction; Social Themes** (children include *Depression & Mental Illness; Violence*); **Sports & Recreation; Superheroes; Transportation; Westerns**.
- **The YAF subgenre tree** parallels JUV but with age-appropriate families: Action & Adventure; **Comics & Graphic Novels** with its own genre children (*Fairy Tales, Folklore, Legends & Mythology; Fantasy; Hispanic & Latino; Historical; Horror; Humorous; Indigenous…*); Coming of Age; Dystopian; Fantasy; Horror; LGBTQ+; Mysteries & Thrillers; Romance; Science Fiction; Social Themes; etc.
- **The taxonomy evolves with the market.** A documented example: effective **January 2017**, BISG added **11 new graphic-novel headings to Juvenile Fiction, 2 to Juvenile Nonfiction, 13 to Young Adult Fiction (splitting science fiction and fantasy into separate headings), and 2 to Young Adult Nonfiction**, at the suggestion of the Children's Book Council's Graphic Novel Advisory Group. The CBC's Matthew Poulter explained that children's graphic novels were "about 15% of total graphic novel sales and… the fastest-growing segment," and that better codes help publishers position books, help retailers recommend and shelve, and — per Papercutz's Sven Larsen — help *libraries* "find 'like' graphic novels more easily… and make more informed decisions about where titles are shelved." (Source: Publishers Weekly, July 2016.) This is a clean case study of how genre categories are *created*: market growth → industry advisory group proposal → standards-body approval → annual edition release → propagation into library vendor systems.

### 6.4 Genrefication: how school and children's libraries assign genres to shelves

"Genrefication" is the now-widespread practice of physically reorganizing (usually) the fiction collection by genre instead of one A–Z author run. Authoritative practitioner and state-library sources describe both the definition and the process:

- **Definition.** The South Dakota State Library's *School Library Genrefication Guide*: "A genre is a label that tells its audience what to expect… Genrefication, then, is the process of organizing, classifying, and categorizing items in your library into genres," noting that partial genrefication (separating graphic novels, poetry, biography) is already common.
- **Motivation and evidence.** The same guide reports that libraries transitioning to genrefied shelving almost universally report large circulation increases. The North Dakota State Library's guide dates the movement's acceleration to around **2009**. A peer-reviewed action-research study published by AASL (*School Library Research*, vol. 23, "Genrefying the Children's Fiction Collection") found elementary students **located fiction books faster and with greater satisfaction** in a genrefied collection than in a standard FIC-label arrangement — while also noting there had previously been little formal research on the practice.
- **Typical genre set.** Follett's how-to guidance lists common school-library genres: **fantasy, science fiction, mystery, historical fiction, realistic fiction**, and nonfiction — advising librarians to keep categories broad and student-interest-driven. One widely cited practitioner set (Mighty Little Librarian): *historical fiction, general/realistic fiction, sci-fi/fantasy, action/adventure, mystery/suspense, sports fiction, relationships/romance, inspirational fiction*.
- **Process** (synthesized from the SD State Library guide, Follett, Demco, and the Mississippi DOE genrefication manual): (1) set goals and scope — fiction only, or nonfiction too; label only, or re-catalog and re-shelve; (2) **weed** the collection first; (3) determine each title's dominant genre using the catalog's existing 650/655 subject and genre metadata, vendor master lists (e.g., Mackin's ISBN-matching service), review sources like NoveList, and professional judgment; (4) apply color-coded genre spine labels; (5) update the catalog — in Follett Destiny, using copy-level *sublocation/category* fields rather than the title-level 655 tag; (6) physically re-shelve by genre section with bold signage; (7) gather feedback and adjust categories over time.
- **Judgment calls and edge cases.** The KQED report documents real practice for multi-genre books: *Twilight* qualifying as both Romance and Paranormal, librarians letting students vote or lobby for a book's genre, picture books often left alphabetical "since it can be unclear how to categorize a story about a duck driving a tractor," and some librarians genrefying nonfiction too — one moved the Dewey 133 section (parapsychology/occult) next to scary fiction and found that "students didn't tend to find the 133 section before, but boy do they find them in the Horror section."

The important conceptual point: genrefication does **not** replace the cataloging-level metadata described in §§3–4. The MARC record keeps its LCSH/CYAC subject headings and LCGFT genre terms; genrefication adds a *local shelving layer* on top — usually recorded in copy-level location fields and expressed physically as spine labels and signage.

### 6.5 How the pieces fit together for one children's book

A single new middle-grade mystery about horses in Montana might simultaneously carry:

- **BISAC** (from the publisher): `JUV028000 JUVENILE FICTION / Mysteries & Detective Stories` (primary) + `JUV002130 JUVENILE FICTION / Animals / Horses`
- **CYAC/LCSH subjects** (from LC): `650 #0 Horses $v Juvenile fiction.` / `650 #1 Horses $v Fiction.` plus geographic and topical headings
- **LCGFT genre terms**: `655 #7 Detective and mystery fiction. $2 lcgft` and `655 #7 Novels. $2 lcgft`
- **A summary annotation** (the CYAC hallmark since 1965)
- **Classification**: LCC **PZ7.1** (post-2015 debut author); DDC **[Fic]** by public-library convention (or 813.6 formally); local call number `J FIC` + author cutter
- **Local genre layer**: a green "Mystery" spine sticker and a Destiny sublocation of "Mystery," shelving it in the school library's Mystery bay.

Five different systems, five different maintainers, one book — which is the essential truth of library genre metadata: it is not one label but a *stack* of labels, each serving a different community of users.

---

## 7. Sources

Authoritative/primary sources cited in this report:

- OCLC, *Introduction to the Dewey Decimal Classification* — oclc.org/content/dam/oclc/dewey/versions/print/intro.pdf
- OCLC, *DDC Summaries* and *DDC 23 Summaries* — oclc.org/content/dam/oclc/dewey/resources/summaries/deweysummaries.pdf
- OCLC, Dewey Services overview — oclc.org/en/dewey.html
- Mitchell & Vizine-Goetz (DDC editors), "The Dewey Decimal Classification" (OCLC Research) — oclc.org/research/publications/library/2009/mitchell-dvg-elis.pdf
- Library of Congress, *Introduction to Library of Congress Genre/Form Terms* (2020) — loc.gov/aba/publications/FreeLCGFT/2020 LCGFT intro.pdf
- Library of Congress, Genre/Form Headings project pages and announcements (general terms; literary works) — loc.gov/catdir/cpso/
- Library of Congress, Controlled Vocabularies for librarians — loc.gov/librarians/controlled-vocabularies/
- Library of Congress, CYAC Program: About; Subject Cataloging; Children's Subject Headings; Required LCSH on CYAC records; News (PZ7.1) — loc.gov/aba/cyac/
- Library of Congress, *Introduction to Children's Subject Headings* — loc.gov/aba/publications/
- Library of Congress, MARC 21 Format for Bibliographic Data (fields 6XX, 650, 651, 655) — loc.gov/marc/bibliographic/
- Book Industry Study Group: BISAC FAQ; Complete BISAC Subject Headings List; Juvenile Fiction; Juvenile Nonfiction; Young Adult Fiction section pages — bisg.org
- American Library Association, Cataloging Tools & Resources: Classification — libguides.ala.org/catalogingtools/classification
- AASL *School Library Research* vol. 23, "Genrefying the Children's Fiction Collection" — ala.org/aasl
- South Dakota State Library, *School Library Genrefication Guide*; North Dakota State Library genrefication guide; Mississippi Dept. of Education, *Genrefying Your School Library*
- Publishers Weekly, "Children's, YA Graphic Novels Get Expanded BISAC Codes" (2016); KQED MindShift, "How Genrefication Makes School Libraries More Like Bookstores" (2018)
- EBSCO Research Starters, "Library of Congress Classification (LCC)"; Wikipedia, "Dewey Decimal Classification" (historical/ownership details cross-checked against OCLC sources)
