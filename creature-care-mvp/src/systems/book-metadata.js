// Best-effort bibliographic enrichment. The ISBN hash remains the canonical
// identity; this layer explains book semantics without rerolling the creature.

import {
  MetadataStatuses,
  PROVIDER_WORK_IDENTITY_VERSION,
  createBookEdition,
  createBookWork,
  editionIdForIsbn,
  isbnAliasKey,
  providerEditionAliasKey,
  providerEditionId,
  providerWorkAliasKey,
  providerWorkId,
  workIdForIsbn
} from '../contracts.js';
import { ProviderSources, providerResponse } from '../providers.js';
import { canonicalizeIsbn } from './isbn.js';

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

function normalizedSearchText(value) {
  return typeof value === 'string'
    ? value.normalize('NFKC').trim().replace(/\s+/gu, ' ')
    : '';
}

function comparisonText(value) {
  return normalizedSearchText(value).toLowerCase();
}

export function normalizeTitleAuthorQuery(input) {
  const title = normalizedSearchText(input?.title);
  const author = normalizedSearchText(input?.author);
  if (!title || !author) return { ok: false, reason: 'invalidBookSearch' };
  return {
    ok: true,
    title,
    author,
    comparisonKey: `${comparisonText(title)}\u0000${comparisonText(author)}`
  };
}

function openLibraryWorkKey(value) {
  return typeof value === 'string' && /^\/works\/OL\d+W$/.test(value) ? value : null;
}

function openLibraryEditionKey(value) {
  if (typeof value !== 'string') return null;
  const key = value.startsWith('/books/') ? value.slice('/books/'.length) : value;
  return /^OL\d+M$/.test(key) ? key : null;
}

function matchingSearchDocument(documents, query) {
  return documents.find((document) => comparisonText(document?.title) === comparisonText(query.title)
    && (document?.author_name ?? []).some((author) => comparisonText(author) === comparisonText(query.author)));
}

function providerDataForSearch(document, query) {
  const workKey = openLibraryWorkKey(document.key);
  const editionKey = (document.edition_key ?? []).map(openLibraryEditionKey).find(Boolean);
  if (!workKey || !editionKey) return null;
  const workId = providerWorkId('open-library', workKey);
  const editionId = providerEditionId('open-library', editionKey);
  const authors = names(document.author_name);
  const display = {
    title: normalizedSearchText(document.title) || query.title,
    authors,
    publishers: names(document.publisher).slice(0, 12),
    publishYear: Number(document.first_publish_year) || null,
    editionYear: null,
    pageCount: null,
    format: null,
    genres: [],
    subjects: [],
    providerWorkId: workKey,
    providerEditionId: editionKey,
    source: 'Open Library title and author search'
  };
  const metadataSource = 'live:open-library-search';
  return {
    work: createBookWork({
      id: workId,
      title: display.title,
      authors,
      metadataStatus: display.title && authors.length ? MetadataStatuses.Resolved : MetadataStatuses.Partial,
      editionIds: [editionId]
    }),
    edition: createBookEdition({ id: editionId, workId, metadataSource }),
    aliases: [{ key: providerWorkAliasKey('open-library', workKey), workId }],
    editionAliases: [{ key: providerEditionAliasKey('open-library', editionKey), editionId }],
    display,
    provenance: Object.fromEntries(
      ['title', 'authors', 'publishYear', 'publishers']
        .filter((field) => display[field] != null)
        .map((field) => [field, metadataSource])
    ),
    identity: { identityVersion: PROVIDER_WORK_IDENTITY_VERSION, identityKey: workKey },
    query: { title: query.title, author: query.author, comparisonKey: query.comparisonKey }
  };
}

export async function searchBookMetadataResult(input, fetchProvider = globalThis.fetch, now = 0) {
  const query = normalizeTitleAuthorQuery(input);
  if (!query.ok) return query;
  if (typeof fetchProvider !== 'function') {
    return providerResponse({
      source: ProviderSources.Unavailable,
      providerId: 'metadata:open-library-search',
      fetchedAt: now,
      data: null,
      errorCode: 'provider_unavailable'
    });
  }

  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), 3500) : null;
  try {
    const params = new URLSearchParams({
      title: query.title,
      author: query.author,
      fields: 'key,title,author_name,edition_key,first_publish_year,publisher',
      limit: '20'
    });
    const response = await fetchProvider(
      `https://openlibrary.org/search.json?${params.toString()}`,
      controller ? { signal: controller.signal } : undefined
    );
    if (!response.ok) throw new Error(`Metadata response ${response.status}`);
    const payload = await response.json();
    const document = Array.isArray(payload?.docs) ? matchingSearchDocument(payload.docs, query) : null;
    const data = document ? providerDataForSearch(document, query) : null;
    if (!data) {
      return providerResponse({
        source: ProviderSources.Unavailable,
        providerId: 'metadata:open-library-search',
        fetchedAt: now,
        data: null,
        errorCode: document ? 'malformed_result' : 'not_found'
      });
    }
    return providerResponse({
      source: ProviderSources.Live,
      providerId: 'metadata:open-library-search',
      fetchedAt: now,
      data
    });
  } catch {
    return providerResponse({
      source: ProviderSources.Unavailable,
      providerId: 'metadata:open-library-search',
      fetchedAt: now,
      data: null,
      errorCode: 'provider_unavailable'
    });
  } finally {
    if (timer) clearTimeout(timer);
  }
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
    providerEditionId: typeof record.key === 'string' ? record.key : null,
    source: 'Open Library ISBN record'
  };
}

function metadataStatusFor(book) {
  return book.title && book.authors?.length > 0
    ? MetadataStatuses.Resolved
    : MetadataStatuses.Partial;
}

function providerDataForBook(book, isbn, metadataSource) {
  const workId = workIdForIsbn(isbn);
  const editionId = editionIdForIsbn(isbn);
  return {
    work: createBookWork({
      id: workId,
      title: book.title ?? '',
      authors: book.authors ?? [],
      metadataStatus: metadataStatusFor(book),
      editionIds: [editionId]
    }),
    edition: createBookEdition({
      id: editionId,
      workId,
      isbn13: isbn,
      format: book.format ?? undefined,
      metadataSource
    }),
    aliases: [{ key: isbnAliasKey(isbn), workId }],
    editionAliases: book.providerEditionId
      ? [{ key: providerEditionAliasKey('open-library', book.providerEditionId), editionId }]
      : [],
    display: structuredClone(book),
    provenance: Object.fromEntries(
      ['title', 'authors', 'format', 'publishYear', 'editionYear', 'pageCount', 'genres', 'subjects']
        .filter((field) => book[field] != null)
        .map((field) => [field, metadataSource])
    )
  };
}

export async function lookupBookMetadataResult(input, fetchProvider = globalThis.fetch, now = 0) {
  const parsed = canonicalizeIsbn(input);
  if (!parsed.ok) return parsed;
  const isbn = parsed.isbn;
  const pinned = PINNED_BOOKS[isbn];
  if (pinned) {
    return providerResponse({
      source: ProviderSources.Fixture,
      providerId: 'metadata:pinned-books',
      fetchedAt: now,
      data: providerDataForBook(pinned, isbn, 'fixture:pinned-books')
    });
  }
  if (typeof fetchProvider !== 'function') {
    return providerResponse({
      source: ProviderSources.Unavailable,
      providerId: 'metadata:open-library',
      fetchedAt: now,
      data: null,
      errorCode: 'provider_unavailable'
    });
  }

  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), 3500) : null;
  try {
    const key = `ISBN:${isbn}`;
    const url = `https://openlibrary.org/api/books?bibkeys=${encodeURIComponent(key)}&jscmd=data&format=json`;
    const response = await fetchProvider(url, controller ? { signal: controller.signal } : undefined);
    if (!response.ok) throw new Error(`Metadata response ${response.status}`);
    const record = (await response.json())[key];
    if (!record) {
      return providerResponse({
        source: ProviderSources.Unavailable,
        providerId: 'metadata:open-library',
        fetchedAt: now,
        data: null,
        errorCode: 'not_found'
      });
    }
    const book = normalizeOpenLibrary(record, isbn);
    return providerResponse({
      source: ProviderSources.Live,
      providerId: 'metadata:open-library',
      fetchedAt: now,
      data: providerDataForBook(book, isbn, 'live:open-library')
    });
  } catch {
    return providerResponse({
      source: ProviderSources.Unavailable,
      providerId: 'metadata:open-library',
      fetchedAt: now,
      data: null,
      errorCode: 'provider_unavailable'
    });
  } finally {
    if (timer) clearTimeout(timer);
  }
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

export function enrichCreatureWithMetadataResult(creature, metadataResult) {
  const book = metadataResult?.data?.display
    ? { ...structuredClone(metadataResult.data.display), isbn: creature.isbn, status: 'found' }
    : {
        isbn: creature.isbn,
        status: metadataResult?.errorCode === 'not_found' ? 'notFound' : 'unavailable',
        source: 'ISBN only'
      };
  return { ...creature, book, bookMapping: mapBookMetadata(book) };
}
