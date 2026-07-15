'use strict';
// Entry point so the mandated command `node --test test/` runs the whole suite:
// this Node resolves the bare directory argument as a module (directory -> index.js),
// so this file pulls in every *.test.mjs. Running explicit globs still works and
// never double-runs, because index.js itself matches no test-file pattern.
const { readdirSync } = require('node:fs');
const { join } = require('node:path');

for (const file of readdirSync(__dirname).sort()) {
  if (file.endsWith('.test.mjs')) import(join(__dirname, file));
}
