import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { ALLOWED_UNRESOLVED_RECIPE_REFERENCES } from './config.mjs';

const root = process.cwd();
const required = [
  'generated/manifest.json',
  'generated/books.json',
  'generated/recipe-sources.json',
  'generated/vhs.json',
  'generated/dictionaries.json',
  'locales/en.json'
];

const readJson = async (relative) => JSON.parse(await readFile(path.join(root, relative), 'utf8'));
for (const relative of required) await access(path.join(root, relative));

const manifest = await readJson('generated/manifest.json');
if (manifest.schemaVersion < 2) throw new Error('Generated manifest schema is outdated');
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

const dictionaries = await readJson('generated/dictionaries.json');
for (const [skill, entry] of Object.entries(dictionaries.skills ?? {})) {
  if (!entry.translationKey) throw new Error(`Skill '${skill}' has no exact translation key`);
  for (const language of manifest.languages) {
    if (!entry.names?.[language]) throw new Error(`Skill '${skill}' is missing generated language '${language}'`);
  }
}
for (const [recipe, entry] of Object.entries(dictionaries.recipes ?? {})) {
  if (!['exact', 'explicit', 'unresolved'].includes(entry.strategy)) {
    throw new Error(`Recipe '${recipe}' has invalid translation strategy '${entry.strategy}'`);
  }
  for (const language of manifest.languages) {
    if (!entry.names?.[language]) throw new Error(`Recipe '${recipe}' is missing generated language '${language}'`);
  }
}

const unresolved = manifest.diagnostics?.unresolvedRecipeReferences ?? [];
const unexpectedUnresolved = unresolved.filter((recipe) => !ALLOWED_UNRESOLVED_RECIPE_REFERENCES.has(recipe));
if (unexpectedUnresolved.length) {
  throw new Error(`Unexpected unresolved recipe translation references: ${unexpectedUnresolved.join(', ')}`);
}

console.log(`UI locale coverage: ${coverage.join(', ')}`);
console.log(`Recipe translation resolution: ${JSON.stringify(manifest.diagnostics?.recipeResolution ?? {})}`);
if (unresolved.length) console.log(`Allowed unresolved recipe references: ${unresolved.join(', ')}`);
console.log('Generated data check passed.');
