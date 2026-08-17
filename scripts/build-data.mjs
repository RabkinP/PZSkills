import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFAULT_LANGUAGE, RECIPE_GROUP_PREFIXES, SKILL_CODES } from './config.mjs';
import { dedupeEffects, parseMediaCode } from './lib/effects.mjs';
import { parseItemsFile } from './lib/items-parser.mjs';
import { parseRecordedMedia } from './lib/media-parser.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const gameDataDir = path.join(root, 'gamedata');
const outputDir = path.join(root, 'generated');
const localesDir = path.join(root, 'locales');

const readJson = async (file) => JSON.parse(await readFile(file, 'utf8'));
const writeJson = async (file, value) => writeFile(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
const hash = (value) => createHash('sha256').update(value).digest('hex').slice(0, 16);

async function discoverLanguages() {
  const entries = await readdir(path.join(gameDataDir, 'translate'), { withFileTypes: true });
  const languages = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const code = entry.name.toLowerCase();
    try {
      await readFile(path.join(gameDataDir, 'translate', code, 'ItemName.json'));
      await readFile(path.join(gameDataDir, 'translate', code, 'Recorded_Media.json'));
      await readFile(path.join(localesDir, `${code}.json`));
      languages.push(code);
    } catch {
      console.warn(`Skipping language '${code}': game translations or locales/${code}.json are incomplete.`);
    }
  }
  if (!languages.includes(DEFAULT_LANGUAGE)) throw new Error(`Default language '${DEFAULT_LANGUAGE}' is unavailable`);
  return languages.sort((a, b) => (a === DEFAULT_LANGUAGE ? -1 : b === DEFAULT_LANGUAGE ? 1 : a.localeCompare(b)));
}

function translationsForKey(dictionaries, key, fallback = '') {
  return Object.fromEntries(Object.entries(dictionaries).map(([language, dictionary]) => [language, dictionary[key] ?? (fallback || key)]));
}

function recipeFamily(itemId) {
  return RECIPE_GROUP_PREFIXES.find((prefix) => itemId.startsWith(prefix)) ?? (itemId.replace(/\d+$/, '') || 'Other');
}

function stableGroupId(prefix, key) {
  return `${prefix}-${key.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase()}`;
}

function buildBooks(items, itemNames) {
  const books = items.filter((item) => item.properties.DisplayCategory === 'SkillBook');
  const bySkill = new Map();

  for (const item of books) {
    const skill = item.properties.SkillTrained;
    const levelFrom = Number(item.properties.LvlSkillTrained);
    const count = Number(item.properties.NumLevelsTrained);
    if (!skill || !Number.isFinite(levelFrom) || !Number.isFinite(count)) throw new Error(`Malformed skill book: ${item.id}`);

    const list = bySkill.get(skill) ?? [];
    list.push({
      id: `Base.${item.id}`,
      sourceId: item.id,
      names: translationsForKey(itemNames, `Base.${item.id}`, item.id),
      skill,
      levelFrom,
      levelTo: levelFrom + count - 1
    });
    bySkill.set(skill, list);
  }

  return {
    id: 'books',
    icon: '📚',
    groups: [...bySkill.entries()].map(([skill, groupItems]) => ({
      id: stableGroupId('books', skill),
      kind: 'skill',
      key: skill,
      items: groupItems.sort((a, b) => a.levelFrom - b.levelFrom || a.id.localeCompare(b.id))
    }))
  };
}

function buildRecipeSources(items, itemNames) {
  const recipeItems = items.filter((item) => {
    if (item.properties.DisplayCategory !== 'RecipeResource' || !item.properties.LearnedRecipes) return false;
    const tags = (item.properties.Tags ?? '').toLowerCase();
    return tags.includes('base:magazine') || item.id.startsWith('RadioMag');
  });
  const byFamily = new Map();

  for (const item of recipeItems) {
    const family = recipeFamily(item.id);
    const list = byFamily.get(family) ?? [];
    list.push({
      id: `Base.${item.id}`,
      sourceId: item.id,
      names: translationsForKey(itemNames, `Base.${item.id}`, item.id),
      recipes: item.properties.LearnedRecipes.split(';').map((recipe) => recipe.trim()).filter(Boolean)
    });
    byFamily.set(family, list);
  }

  return {
    id: 'recipeSources',
    icon: '📖',
    groups: [...byFamily.entries()].map(([family, groupItems]) => ({
      id: stableGroupId('recipes', family),
      kind: 'recipeFamily',
      key: family,
      items: groupItems.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }))
    }))
  };
}

function buildVhs(records, mediaNames) {
  const relevant = records.filter((record) => ['Retail-VHS', 'Home-VHS'].includes(record.category)).map((record) => {
    const effects = dedupeEffects(record.codes.map(parseMediaCode));
    return { record, effects };
  }).filter(({ record, effects }) => {
    const hasChecklistEffect = effects.some((effect) => effect.type === 'skillXp' || effect.type === 'recipe');
    const englishName = mediaNames.en?.[record.itemDisplayNameKey] ?? '';
    return hasChecklistEffect || englishName === 'VHS: The Dog Goblin';
  });

  const retailSeriesCounts = new Map();
  for (const { record } of relevant) {
    if (record.category !== 'Retail-VHS') continue;
    const title = mediaNames.en?.[record.titleKey] ?? record.titleKey ?? 'Other';
    retailSeriesCounts.set(title, (retailSeriesCounts.get(title) ?? 0) + 1);
  }

  const groups = new Map();
  for (const { record, effects } of relevant) {
    let groupKey;
    let groupNames = null;
    if (record.category === 'Home-VHS') {
      groupKey = 'home';
    } else {
      const englishTitle = mediaNames.en?.[record.titleKey] ?? record.titleKey ?? 'Other';
      if ((retailSeriesCounts.get(englishTitle) ?? 0) > 1) {
        groupKey = `series:${englishTitle}`;
        groupNames = translationsForKey(mediaNames, record.titleKey, englishTitle);
      } else {
        groupKey = 'retail-other';
      }
    }

    const group = groups.get(groupKey) ?? {
      id: stableGroupId('vhs', groupKey),
      kind: groupKey.startsWith('series:') ? 'mediaSeries' : 'mediaCategory',
      key: groupKey,
      ...(groupNames ? { names: groupNames } : {}),
      items: []
    };

    const names = translationsForKey(mediaNames, record.itemDisplayNameKey, record.guid);
    const legacyId = names.en || `VHS:${record.guid}`;
    group.items.push({
      id: legacyId,
      sourceId: record.guid,
      names,
      category: record.category,
      effects
    });
    groups.set(groupKey, group);
  }

  const order = (group) => group.key === 'home' ? 2 : group.key === 'retail-other' ? 1 : 0;
  return {
    id: 'vhs',
    icon: '📼',
    groups: [...groups.values()]
      .sort((a, b) => order(a) - order(b) || (a.names?.en ?? a.key).localeCompare(b.names?.en ?? b.key))
      .map((group) => ({ ...group, items: group.items.sort((a, b) => a.names.en.localeCompare(b.names.en, undefined, { numeric: true })) }))
  };
}

function validate(catalog, languages) {
  const ids = new Set();
  const unknownEffects = [];
  const missingTranslations = [];

  for (const category of catalog) {
    if (!category.groups.length) throw new Error(`Category '${category.id}' has no groups`);
    for (const group of category.groups) {
      for (const item of group.items) {
        const key = `${category.id}|${item.id}`;
        if (ids.has(key)) throw new Error(`Duplicate item key: ${key}`);
        ids.add(key);
        for (const language of languages) {
          if (!item.names?.[language]) missingTranslations.push(`${language}:${item.id}`);
        }
        for (const effect of item.effects ?? []) {
          if (effect.type === 'unknown') unknownEffects.push(`${item.id}:${effect.code}`);
        }
      }
    }
  }

  if (unknownEffects.length) console.warn(`Unknown media codes (${unknownEffects.length}): ${unknownEffects.join(', ')}`);
  if (missingTranslations.length) console.warn(`Missing translations (${missingTranslations.length}); English fallback will be used.`);

  return { unknownEffects, missingTranslations };
}

await mkdir(outputDir, { recursive: true });
const languages = await discoverLanguages();
const literatureText = await readFile(path.join(gameDataDir, 'items', 'literature.txt'), 'utf8');
const mediaText = await readFile(path.join(gameDataDir, 'recorded_media.lua'), 'utf8');
const normalItemsText = await readFile(path.join(gameDataDir, 'items', 'normal.txt'), 'utf8');
const items = parseItemsFile(literatureText);
const records = parseRecordedMedia(mediaText);

if (items.length < 100) throw new Error(`Parsed only ${items.length} literature items; file structure may have changed.`);
if (records.length < 100) throw new Error(`Parsed only ${records.length} recorded-media entries; file structure may have changed.`);
if (!/item\s+VHS_Retail\b/.test(normalItemsText) || !/item\s+VHS_Home\b/.test(normalItemsText)) {
  throw new Error('Expected VHS_Retail and VHS_Home parent items were not found in items/normal.txt.');
}

const itemNames = {};
const mediaNames = {};
for (const language of languages) {
  itemNames[language] = await readJson(path.join(gameDataDir, 'translate', language, 'ItemName.json'));
  mediaNames[language] = await readJson(path.join(gameDataDir, 'translate', language, 'Recorded_Media.json'));
}


const unknownSourceMediaCodes = [...new Set(
  records
    .filter((record) => ['Retail-VHS', 'Home-VHS'].includes(record.category))
    .flatMap((record) => record.codes.map(parseMediaCode))
    .filter((effect) => effect.type === 'unknown')
    .map((effect) => effect.code)
)];
if (unknownSourceMediaCodes.length) {
  throw new Error(`Unknown recorded-media codes: ${unknownSourceMediaCodes.join(', ')}`);
}

const books = buildBooks(items, itemNames);
const recipeSources = buildRecipeSources(items, itemNames);
const vhs = buildVhs(records, mediaNames);
const catalog = [books, recipeSources, vhs];
const diagnostics = validate(catalog, languages);

await writeJson(path.join(outputDir, 'books.json'), books);
await writeJson(path.join(outputDir, 'recipe-sources.json'), recipeSources);
await writeJson(path.join(outputDir, 'vhs.json'), vhs);
await writeJson(path.join(outputDir, 'manifest.json'), {
  schemaVersion: 1,
  defaultLanguage: DEFAULT_LANGUAGE,
  languages,
  sourceHash: hash(literatureText + mediaText + normalItemsText),
  counts: Object.fromEntries(catalog.map((category) => [category.id, category.groups.reduce((sum, group) => sum + group.items.length, 0)])),
  diagnostics: {
    unknownMediaCodes: diagnostics.unknownEffects.length,
    missingTranslations: diagnostics.missingTranslations.length
  }
});

console.log(`Languages: ${languages.join(', ')}`);
console.log(`Skill books: ${books.groups.reduce((sum, group) => sum + group.items.length, 0)}`);
console.log(`Recipe sources: ${recipeSources.groups.reduce((sum, group) => sum + group.items.length, 0)}`);
console.log(`Relevant VHS: ${vhs.groups.reduce((sum, group) => sum + group.items.length, 0)}`);
console.log(`Unknown media codes: ${diagnostics.unknownEffects.length}`);
