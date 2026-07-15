// Best-effort bibliographic enrichment. The ISBN hash remains the canonical
// identity; this layer explains book semantics without rerolling the creature.

const PINNED_BOOKS = {
  '9780064400558': {
    title: "Charlotte's Web",
    authors: ['E. B. White'],
    publishers: ['HarperCollins'],
    publishYear: 1952,
    editionYear: 1980,
    pageCount: 184,
    format: 'Paperback chapter book',
    genres: ["Children's fiction", 'Animal fiction'],
    subjects: ['Spiders', 'Pigs', 'Friendship'],
    source: 'Pinned MVP catalog'
  },
  '9780399226908': {
    title: 'The Very Hungry Caterpillar',
    authors: ['Eric Carle'],
    publishers: ['Philomel Books'],
    publishYear: 1969,
    editionYear: 1994,
    pageCount: 26,
    format: 'Board book',
    genres: ["Children's fiction", 'Picture book'],
    subjects: ['Caterpillars', 'Food', 'Metamorphosis'],
    source: 'Pinned MVP catalog'
  },
  '9780590353403': {
    title: "Harry Potter and the Sorcerer's Stone",
    authors: ['J. K. Rowling'],
    publishers: ['Scholastic'],
    publishYear: 1997,
    editionYear: 1998,
    pageCount: 309,
    format: 'Hardcover chapter book',
    genres: ["Children's fantasy", 'Fantasy fiction'],
    subjects: ['Magic', 'Wizards', 'Friendship', 'Schools'],
    series: 'Harry Potter, book 1',
    source: 'Pinned MVP catalog'
  }
};

const ELEMENT_RULES = [
  { id: 'shade', label: 'Shade', words: ['mystery', 'detective', 'horror', 'ghost', 'scary'] },
  { id: 'wisp', label: 'Wisp', words: ['fantasy', 'magic', 'wizard', 'fairy', 'myth'] },
  { id: 'fuzz', label: 'Fuzz', words: ['animal', 'spider', 'pig', 'caterpillar', 'nature', 'friendship'] },
  { id: 'cog', label: 'Cog', words: ['science', 'technology', 'history', 'biography', 'nonfiction'] },
  { id: 'ember', label: 'Ember', words: ['adventure', 'action', 'dragon', 'sports'] },
  { id: 'hush', label: 'Hush', words: ['bedtime', 'family', 'feelings', 'poetry'] }
];

function names(values) {
  return (values ?? []).map((value) => typeof value === 'string' ? value : value?.name).filter(Boolean);
}

function yearFrom(value) {
  const match = String(value ?? '').match(/\b(1[5-9]\d{2}|20\d{2})\b/);
  return match ? Number(match[1]) : null;
}

function normalizeOpenLibrary(record, isbn) {
  const subjects = names(record.subjects).slice(0, 12);
  return {
    isbn,
    title: record.title ?? null,
    subtitle: record.subtitle ?? null,
    authors: names(record.authors),
    publishers: names(record.publishers),
    publishYear: yearFrom(record.publish_date),
    editionYear: yearFrom(record.publish_date),
    pageCount: Number(record.number_of_pages) || null,
    format: record.physical_format ?? null,
    genres: subjects.filter((subject) => /fiction|fantasy|mystery|poetry|biograph|history|science/i.test(subject)).slice(0, 6),
    subjects,
    source: 'Open Library ISBN record'
  };
}

export async function lookupBookMetadata(isbn, fetchProvider = globalThis.fetch) {
  const pinned = PINNED_BOOKS[isbn];
  if (pinned) return { ...pinned, isbn, status: 'found' };
  if (typeof fetchProvider !== 'function') return { isbn, status: 'unavailable', source: 'ISBN only' };

  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), 3500) : null;
  try {
    const key = `ISBN:${isbn}`;
    const url = `https://openlibrary.org/api/books?bibkeys=${encodeURIComponent(key)}&jscmd=data&format=json`;
    const response = await fetchProvider(url, controller ? { signal: controller.signal } : undefined);
    if (!response.ok) throw new Error(`Metadata response ${response.status}`);
    const payload = await response.json();
    const record = payload[key];
    return record
      ? { ...normalizeOpenLibrary(record, isbn), status: 'found' }
      : { isbn, status: 'notFound', source: 'Open Library ISBN record' };
  } catch {
    return { isbn, status: 'unavailable', source: 'ISBN only' };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function pageSize(pageCount) {
  if (!pageCount) return { label: 'Unknown size', rule: 'No page count; base body is unchanged' };
  if (pageCount <= 48) return { label: 'Tiny / fast-growing', rule: '1–48 pages' };
  if (pageCount <= 120) return { label: 'Small', rule: '49–120 pages' };
  if (pageCount <= 240) return { label: 'Medium', rule: '121–240 pages' };
  if (pageCount <= 400) return { label: 'Large / slow-growing', rule: '241–400 pages' };
  return { label: 'Grand / slow-growing', rule: '401+ pages' };
}

function eraStyle(year) {
  if (!year) return { label: 'Unknown era', rule: 'No publication year' };
  if (year < 1960) return { label: 'Classic story styling', rule: 'Before 1960' };
  if (year < 1990) return { label: 'Retro print styling', rule: '1960–1989' };
  if (year < 2015) return { label: 'Modern story styling', rule: '1990–2014' };
  return { label: 'Contemporary styling', rule: '2015 or newer' };
}

function formatPlan(format) {
  const value = String(format ?? '').toLowerCase();
  if (value.includes('board')) return { label: 'Round, chunky body plan', rule: 'Board book format' };
  if (value.includes('graphic') || value.includes('comic')) return { label: 'Paneled markings', rule: 'Graphic format' };
  if (value.includes('picture')) return { label: 'Soft illustrated silhouette', rule: 'Picture book format' };
  if (value.includes('chapter') || value.includes('hardcover') || value.includes('paperback')) {
    return { label: 'Storybook body plan', rule: 'Chapter/trade book format' };
  }
  return { label: 'Base hashed silhouette', rule: 'Format unavailable or unmapped' };
}

export function mapBookMetadata(book) {
  const semanticText = [...(book.genres ?? []), ...(book.subjects ?? [])].join(' ').toLowerCase();
  const element = ELEMENT_RULES.find((rule) => rule.words.some((word) => semanticText.includes(word)))
    ?? { id: 'story', label: 'Story', words: [] };
  const matchedWord = element.words.find((word) => semanticText.includes(word));
  const size = pageSize(book.pageCount);
  const era = eraStyle(book.publishYear ?? book.editionYear);
  const plan = formatPlan(book.format);

  return [
    {
      source: 'Genre + subjects',
      value: [...(book.genres ?? []), ...(book.subjects ?? [])].join(', ') || 'Unavailable',
      result: `${element.label} semantic element`,
      rule: matchedWord ? `Matched “${matchedWord}”` : 'No recognized term; Story fallback',
      affects: 'Lore element; base hashed family stays fixed'
    },
    {
      source: 'Page count',
      value: book.pageCount ? `${book.pageCount} pages` : 'Unavailable',
      result: size.label,
      rule: size.rule,
      affects: 'Size/growth descriptor'
    },
    {
      source: 'First publication year',
      value: book.publishYear ?? 'Unavailable',
      result: era.label,
      rule: era.rule,
      affects: 'Era styling descriptor'
    },
    {
      source: 'Physical format',
      value: book.format ?? 'Unavailable',
      result: plan.label,
      rule: plan.rule,
      affects: 'Body-plan descriptor'
    },
    {
      source: 'Publisher',
      value: book.publishers?.join(', ') || 'Unavailable',
      result: 'Publisher birthmark cross-check',
      rule: 'ISBN prefix remains the offline authority',
      affects: 'Birthmark explanation'
    },
    {
      source: 'Title + author',
      value: [book.title, book.authors?.join(', ')].filter(Boolean).join(' — ') || 'Unavailable',
      result: 'Book identity and lore label',
      rule: 'Displayed only; does not reroll the ISBN seed',
      affects: 'Debug provenance'
    }
  ];
}

export async function enrichCreatureWithBookData(creature, fetchProvider = globalThis.fetch) {
  const book = await lookupBookMetadata(creature.isbn, fetchProvider);
  return { ...creature, book, bookMapping: mapBookMetadata(book) };
}
