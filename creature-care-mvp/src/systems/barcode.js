// Local image barcode adapter. The selected photo never leaves the browser and
// is never persisted. BarcodeDetector support varies, so manual ISBN entry is
// always available in the UI.

import { canonicalizeIsbn } from './isbn.js';
import content from '../content.json' with { type: 'json' };

const WANTED_FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e'];
const LEFT_ODD = ['0001101', '0011001', '0010011', '0111101', '0100011', '0110001', '0101111', '0111011', '0110111', '0001011'];
const LEFT_EVEN = ['0100111', '0110011', '0011011', '0100001', '0011101', '0111001', '0000101', '0010001', '0001001', '0010111'];
const RIGHT = ['1110010', '1100110', '1101100', '1000010', '1011100', '1001110', '1010000', '1000100', '1001000', '1110100'];
const FIRST_DIGIT_PARITY = ['LLLLLL', 'LLGLGG', 'LLGGLG', 'LLGGGL', 'LGLLGG', 'LGGLLG', 'LGGGLL', 'LGLGLG', 'LGLGGL', 'LGGLGL'];

export function selectBookIsbn(rawValues) {
  let sawBarcode = false;
  let lastReason = 'noBarcode';
  for (const raw of rawValues) {
    if (raw == null || String(raw).trim() === '') continue;
    sawBarcode = true;
    const result = canonicalizeIsbn(raw);
    if (result.ok) return result;
    lastReason = result.reason;
  }
  return { ok: false, reason: sawBarcode ? lastReason : 'noBarcode' };
}

function digitFor(pattern, table) {
  const index = table.indexOf(pattern);
  return index < 0 ? null : String(index);
}

// Decodes an already-normalized 95-module EAN-13 bit string. Exported so the
// dependency-free fallback can be verified without a camera or image fixture.
export function decodeEan13Bits(bits) {
  if (!/^[01]{95}$/.test(bits)) return null;
  const startGuardLength = 3;
  const digitWidth = 7;
  const digitsPerSide = 6;
  const centerStart = startGuardLength + digitWidth * digitsPerSide;
  const centerGuardLength = 5;
  const endStart = centerStart + centerGuardLength + digitWidth * digitsPerSide;
  if (bits.slice(0, startGuardLength) !== '101'
    || bits.slice(centerStart, centerStart + centerGuardLength) !== '01010'
    || bits.slice(endStart) !== '101') {
    return null;
  }

  let parity = '';
  let leftDigits = '';
  for (let index = 0; index < 6; index += 1) {
    const group = bits.slice(3 + index * 7, 10 + index * 7);
    const odd = digitFor(group, LEFT_ODD);
    const even = digitFor(group, LEFT_EVEN);
    if (odd != null) { parity += 'L'; leftDigits += odd; }
    else if (even != null) { parity += 'G'; leftDigits += even; }
    else return null;
  }

  const firstDigit = FIRST_DIGIT_PARITY.indexOf(parity);
  if (firstDigit < 0) return null;
  let rightDigits = '';
  for (let index = 0; index < 6; index += 1) {
    const group = bits.slice(50 + index * 7, 57 + index * 7);
    const digit = digitFor(group, RIGHT);
    if (digit == null) return null;
    rightDigits += digit;
  }
  return `${firstDigit}${leftDigits}${rightDigits}`;
}

function sampleModules(values) {
  let darkest = 255;
  let lightest = 0;
  for (const value of values) {
    darkest = Math.min(darkest, value);
    lightest = Math.max(lightest, value);
  }
  if (lightest - darkest < content.generation.scan.contrastMin) return null;

  const threshold = darkest + (lightest - darkest) * 0.5;
  const dark = values.map((value) => value < threshold);
  const first = dark.indexOf(true);
  const lastFromEnd = [...dark].reverse().indexOf(true);
  if (first < 0 || lastFromEnd < 0) return null;
  const last = dark.length - 1 - lastFromEnd;
  const moduleWidth = (last - first + 1) / 95;
  if (moduleWidth < 1) return null;

  let bits = '';
  for (let module = 0; module < 95; module += 1) {
    const center = first + (module + 0.5) * moduleWidth;
    const radius = Math.max(0, Math.floor(moduleWidth * 0.22));
    let darkSamples = 0;
    let samples = 0;
    for (let offset = -radius; offset <= radius; offset += 1) {
      const position = Math.max(0, Math.min(dark.length - 1, Math.floor(center + offset)));
      darkSamples += dark[position] ? 1 : 0;
      samples += 1;
    }
    bits += darkSamples * 2 >= samples ? '1' : '0';
  }
  return decodeEan13Bits(bits) ?? decodeEan13Bits([...bits].reverse().join(''));
}

function luminance(red, green, blue) {
  return red * 0.299 + green * 0.587 + blue * 0.114;
}

export function decodeEan13ImageData(imageData) {
  const { data, width, height } = imageData;
  const scanRatios = [0.3, 0.4, 0.5, 0.6, 0.7];

  for (const ratio of scanRatios) {
    const y = Math.min(height - 1, Math.round(height * ratio));
    const row = [];
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4;
      row.push(luminance(data[offset], data[offset + 1], data[offset + 2]));
    }
    const decoded = sampleModules(row);
    if (decoded) return decoded;
  }

  // Also scan vertically for a photo taken with the barcode rotated 90°.
  for (const ratio of scanRatios) {
    const x = Math.min(width - 1, Math.round(width * ratio));
    const column = [];
    for (let y = 0; y < height; y += 1) {
      const offset = (y * width + x) * 4;
      column.push(luminance(data[offset], data[offset + 1], data[offset + 2]));
    }
    const decoded = sampleModules(column);
    if (decoded) return decoded;
  }
  return null;
}

function decodeWithCanvas(bitmap, environment) {
  const maxSide = content.generation.scan.maxImageSide;
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = typeof environment.OffscreenCanvas === 'function'
    ? new environment.OffscreenCanvas(width, height)
    : environment.document?.createElement?.('canvas');
  if (!canvas) return null;
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) return null;
  context.drawImage(bitmap, 0, 0, width, height);
  return decodeEan13ImageData(context.getImageData(0, 0, width, height));
}

export async function decodeBookBarcode(file, environment = globalThis) {
  if (!file || !String(file.type ?? '').startsWith('image/')) {
    return { ok: false, reason: 'notImage' };
  }

  let bitmap;
  try {
    if (typeof environment.createImageBitmap !== 'function') {
      return { ok: false, reason: 'detectorUnavailable' };
    }
    bitmap = await environment.createImageBitmap(file);
    const Detector = environment.BarcodeDetector;
    if (typeof Detector === 'function') {
      let formats = WANTED_FORMATS;
      if (typeof Detector.getSupportedFormats === 'function') {
        const supported = await Detector.getSupportedFormats();
        formats = WANTED_FORMATS.filter((format) => supported.includes(format));
      }
      if (formats.length > 0) {
        const detector = new Detector({ formats });
        const detections = await detector.detect(bitmap);
        const rawValues = detections.map((result) => result.rawValue);
        const nativeResult = selectBookIsbn(rawValues);
        if (nativeResult.ok) {
          return {
            ...nativeResult,
            capture: {
              source: 'image',
              decoder: 'BarcodeDetector',
              rawValues,
              formats: detections.map((result) => result.format ?? 'unknown'),
              imageType: file.type,
              imageWidth: bitmap.width ?? null,
              imageHeight: bitmap.height ?? null
            }
          };
        }
      }
    }

    const fallbackValue = decodeWithCanvas(bitmap, environment);
    if (!fallbackValue) return { ok: false, reason: 'noBarcode' };
    return {
      ...selectBookIsbn([fallbackValue]),
      capture: {
        source: 'image',
        decoder: 'Built-in EAN-13',
        rawValues: [fallbackValue],
        formats: ['ean_13'],
        imageType: file.type,
        imageWidth: bitmap.width ?? null,
        imageHeight: bitmap.height ?? null
      }
    };
  } catch {
    return { ok: false, reason: 'scanFailed' };
  } finally {
    if (bitmap && typeof bitmap.close === 'function') bitmap.close();
  }
}
