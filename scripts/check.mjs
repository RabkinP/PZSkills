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

const readJson = async (relative) => JSON.parse(await readFile(path.join(root, relative), 'utf8'));
for (const relative of required) await access(path.join(root, relative));

const manifest = await readJson('generated/manifest.json');
if (!manifest.languages.includes('en')) throw new Error('English game locale is required');
if (!manifest.uiLanguages?.includes('en')) throw new Error('English UI locale is required');
if (manifest.counts.books <= 0 || manifest.counts.recipeSources <= 0 || manifest.counts.vhs <= 0) {
  throw new Error('Generated catalog is unexpectedly empty');
}

const english = await readJson('locales/en.json');
const requiredUiKeys = Object.keys(english.ui ?? {});
const coverage = [];
for (const language of manifest.uiLanguages) {
  const locale = await readJson(`locales/${language}.json`);
  if (!locale.meta?.name) throw new Error(`UI locale '${language}' is missing meta.name`);
  const translated = requiredUiKeys.filter((key) => Object.hasOwn(locale.ui ?? {}, key)).length;
  coverage.push(`${language}:${translated}/${requiredUiKeys.length}`);
}

// Generated catalogs must expose every game language listed in the manifest.
for (const file of ['books.json', 'recipe-sources.json', 'vhs.json']) {
  const catalog = await readJson(`generated/${file}`);
  for (const group of catalog.groups ?? []) {
    for (const item of group.items ?? []) {
      for (const language of manifest.languages) {
        if (!item.names?.[language]) {
          throw new Error(`${file}: '${item.id}' is missing generated language '${language}'`);
        }
      }
    }
  }
}

console.log(`UI locale coverage: ${coverage.join(', ')}`);
console.log('Generated data check passed.');
