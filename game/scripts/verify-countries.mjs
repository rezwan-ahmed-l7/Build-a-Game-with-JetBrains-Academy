import { COUNTRIES } from '../src/data/countries.js';

const lc = COUNTRIES.map(c => c.name);
let ok = true;
for (let i = 1; i < lc.length; i++) {
  if (lc[i - 1].toLowerCase() > lc[i].toLowerCase()) {
    console.log(`OUT OF ORDER: [${i-1}] "${lc[i-1]}" should come AFTER [${i}] "${lc[i]}"`);
    ok = false;
  }
}
console.log(`Total: ${COUNTRIES.length} countries`);
console.log(ok ? '✓ Alphabetical order OK' : '✗ NOT in alphabetical order');

// Look for duplicates by code or emoji
const codeMap = new Map();
const emojiMap = new Map();
for (const c of COUNTRIES) {
  if (codeMap.has(c.code)) console.log(`DUPLICATE code: ${c.code} -> "${codeMap.get(c.code).name}" and "${c.name}"`);
  if (emojiMap.has(c.emoji)) console.log(`DUPLICATE emoji: ${c.emoji} -> "${emojiMap.get(c.emoji).name}" and "${c.name}"`);
  codeMap.set(c.code, c);
  emojiMap.set(c.emoji, c);
}
