import { access, readFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const required = [
  'generated/manifest.json',
  'generated/books.json',
  'generated/recipe-sources.json',
  'generated/vhs.json',
  'locales/en.json'
];

for (const relative of required) await access(path.join(root, relative));
const manifest = JSON.parse(await readFile(path.join(root, 'generated/manifest.json'), 'utf8'));
if (!manifest.languages.includes('en')) throw new Error('English locale is required');
if (manifest.counts.books <= 0 || manifest.counts.recipeSources <= 0 || manifest.counts.vhs <= 0) throw new Error('Generated catalog is unexpectedly empty');
console.log('Generated data check passed.');
