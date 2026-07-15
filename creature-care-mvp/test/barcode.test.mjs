import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  decodeBookBarcode,
  decodeEan13Bits,
  decodeEan13ImageData,
  selectBookIsbn
} from '../src/systems/barcode.js';

const CHARLOTTE_BITS = '10101110110001001010011100011010000101010001101010101110011100101110010100111010011101001000101';

test('multiple detections select the first valid book ISBN', () => {
  assert.deepEqual(selectBookIsbn(['12345', '9780064400558']), {
    ok: true, isbn: '9780064400558', source: 'isbn13'
  });
  assert.equal(selectBookIsbn([]).reason, 'noBarcode');
});

test('the built-in fallback decodes EAN-13 modules from image pixels', () => {
  assert.equal(decodeEan13Bits(CHARLOTTE_BITS), '9780064400558');
  const width = CHARLOTTE_BITS.length + 20;
  const height = 24;
  const data = new Uint8ClampedArray(width * height * 4).fill(255);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < CHARLOTTE_BITS.length; x += 1) {
      if (CHARLOTTE_BITS[x] !== '1') continue;
      const offset = (y * width + x + 10) * 4;
      data[offset] = 0;
      data[offset + 1] = 0;
      data[offset + 2] = 0;
    }
  }
  assert.equal(decodeEan13ImageData({ data, width, height }), '9780064400558');
});

test('the image adapter decodes locally and closes its bitmap', async () => {
  let closed = false;
  class FakeDetector {
    static async getSupportedFormats() { return ['ean_13']; }
    async detect() { return [{ rawValue: '9780399226908' }]; }
  }
  const environment = {
    BarcodeDetector: FakeDetector,
    async createImageBitmap() { return { close() { closed = true; } }; }
  };
  const result = await decodeBookBarcode({ type: 'image/jpeg' }, environment);
  assert.equal(result.isbn, '9780399226908');
  assert.equal(closed, true);
});

test('unsupported detectors and non-images fail into the manual path', async () => {
  assert.equal((await decodeBookBarcode({ type: 'image/png' }, {})).reason, 'detectorUnavailable');
  assert.equal((await decodeBookBarcode({ type: 'text/plain' }, {})).reason, 'notImage');
});
