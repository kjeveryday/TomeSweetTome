// ISBN normalization and validation. Pure: no DOM, storage, network, or clock.

export function isbn13CheckDigit(firstTwelve) {
  if (!/^\d{12}$/.test(firstTwelve)) return null;
  let sum = 0;
  for (let index = 0; index < firstTwelve.length; index += 1) {
    const weight = index % 2 === 0 ? 1 : 3;
    sum += Number(firstTwelve[index]) * weight;
  }
  return String((10 - (sum % 10)) % 10);
}

export function isValidIsbn13(value) {
  return /^\d{13}$/.test(value) && isbn13CheckDigit(value.slice(0, 12)) === value[12];
}

export function isValidIsbn10(value) {
  if (!/^\d{9}[\dX]$/.test(value)) return false;
  let sum = 0;
  for (let index = 0; index < value.length; index += 1) {
    const digit = value[index] === 'X' ? 10 : Number(value[index]);
    sum += digit * (10 - index);
  }
  return sum % 11 === 0;
}

export function isbn10To13(value) {
  if (!isValidIsbn10(value)) return null;
  const firstTwelve = `978${value.slice(0, 9)}`;
  return `${firstTwelve}${isbn13CheckDigit(firstTwelve)}`;
}

export function canonicalizeIsbn(input) {
  if (input == null || String(input).trim() === '') return { ok: false, reason: 'empty' };

  const withoutLabel = String(input)
    .trim()
    .replace(/^ISBN(?:-1[03])?\s*:?\s*/i, '');

  if (/[^\dXx\s-]/.test(withoutLabel)) return { ok: false, reason: 'invalidCharacters' };
  const compact = withoutLabel.replace(/[\s-]/g, '').toUpperCase();

  if (compact.length === 10) {
    if (!isValidIsbn10(compact)) return { ok: false, reason: 'invalidChecksum' };
    return { ok: true, isbn: isbn10To13(compact), source: 'isbn10' };
  }

  if (compact.length !== 13) return { ok: false, reason: 'wrongLength' };
  if (!isValidIsbn13(compact)) return { ok: false, reason: 'invalidChecksum' };
  if (!compact.startsWith('978') && !compact.startsWith('979')) {
    return { ok: false, reason: 'notBookBarcode' };
  }
  return { ok: true, isbn: compact, source: 'isbn13' };
}

