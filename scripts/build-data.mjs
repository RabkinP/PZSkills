import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ALLOWED_UNRESOLVED_RECIPE_REFERENCES,
  DEFAULT_LANGUAGE,
  RECIPE_GROUP_PREFIXES,
  SKILL_TRANSLATION_KEYS
} from './config.mjs';
import { dedupeEffects, parseMediaCode } from './lib/effects.mjs';
import { parseItemsFile } from './lib/items-parser.mjs';
import { parseRecordedMedia } from './lib/media-parser.mjs';
import { readableRecipeFallback, recipeTranslationKey } from './lib/recipe-translations.mjs';
import { loadTranslationIndex, translationsForDomainKey } from './lib/translation-index.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const gameDataDir = path.join(root, 'gamedata');
const translateDir = path.join(gameDataDir, 'translate');
const outputDir = path.join(root, 'generated');
const localesDir = path.join(root, 'locales');

const writeJson = async (file, value) => writeFile(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
const hash = (value) => createHash('sha256').update(value).digest('hex').slice(0, 16);

async function discoverLanguages() {
  const entries = await readdir(translateDir, { withFileTypes: true });
  const languages = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const sourceDir = entry.name;
    const code = sourceDir.toLowerCase();
    const files = await readdir(path.join(translateDir, sourceDir), { withFileTypes: true });
    if (!files.some((file) => file.isFile() && file.name.toLowerCase().endsWith('.json'))) {
      console.warn(`Skipping language '${sourceDir}': no JSON localization files were found.`);
      continue;
    }
    languages.push({ code, sourceDir });
  }

  if (!languages.some(({ code }) => code === DEFAULT_LANGUAGE)) {
    throw new Error(`Default language '${DEFAULT_LANGUAGE}' is unavailable`);
  }

  const duplicateCodes = languages
    .map(({ code }) => code)
    .filter((code, index, values) => values.indexOf(code) !== index);
  if (duplicateCodes.length) {
    throw new Error(`Locale directories collapse to duplicate language codes: ${[...new Set(duplicateCodes)].join(', ')}`);
  }

  return languages.sort((a, b) => (
    a.code === DEFAULT_LANGUAGE ? -1
      : b.code === DEFAULT_LANGUAGE ? 1
        : a.code.localeCompare(b.code)
  ));
}

async function discoverUiLanguages(languages) {
  const entries = await readdir(localesDir, { withFileTypes: true });
  const available = new Set(
    entries
      .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.json'))
      .map((entry) => entry.name.slice(0, -5).toLowerCase())
  );
  return languages.filter((language) => available.has(language));
}

function recipeFamily(itemId) {
  return RECIPE_GROUP_PREFIXES.find((prefix) => itemId.startsWith(prefix)) ?? (itemId.replace(/\d+$/, '') || 'Other');
}

function stableGroupId(prefix, key) {
  return `${prefix}-${key.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase()}`;
}

function discoverDomainFiles(indexes, languages, anchors, domainName, { required = true } = {}) {
  const files = {};
  const englishFile = indexes[DEFAULT_LANGUAGE].findDomainFile(anchors);
  if (!englishFile && required) {
    throw new Error(`Could not identify English '${domainName}' localization domain using exact anchors: ${anchors.join(', ')}`);
  }
  files[DEFAULT_LANGUAGE] = englishFile;

  const referenceKeys = indexes[DEFAULT_LANGUAGE].keysInFile(englishFile);
  for (const language of languages) {
    if (language === DEFAULT_LANGUAGE) continue;
    files[language] = indexes[language].findDomainFile(anchors)
      ?? indexes[language].findDomainFileByExactOverlap(referenceKeys);
  }
  return files;
}

function createTranslationResolver(indexes, domainFiles, languages, diagnostics) {
  return function translated(domain, key, fallback, context, { requireEnglish = true } = {}) {
    const { values, missing, english } = translationsForDomainKey(
      indexes, domainFiles[domain], languages, DEFAULT_LANGUAGE, key, fallback
    );
    if (requireEnglish && !english) {
      throw new Error(`Missing exact English translation key '${key}' in '${domain}' domain for ${context}`);
    }
    for (const language of missing) diagnostics.missingTranslations.push(`${language}:${context}:${key}`);
    return values;
  };
}

function buildBooks(items, translated) {
  const books = items.filter((item) => item.properties.DisplayCategory === 'SkillBook');
  const bySkill = new Map();

  for (const item of books) {
    const skill = item.properties.SkillTrained;
    const levelFrom = Number(item.properties.LvlSkillTrained);
    const count = Number(item.properties.NumLevelsTrained);
    if (!skill || !Number.isFinite(levelFrom) || !Number.isFinite(count)) throw new Error(`Malformed skill book: ${item.id}`);

    const list = bySkill.get(skill) ?? [];
    const id = `Base.${item.id}`;
    list.push({
      id,
      sourceId: item.id,
      names: translated('items', id, item.id, `item:${id}`),
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

function buildRecipeSources(items, translated) {
  const recipeItems = items.filter((item) => {
    if (item.properties.DisplayCategory !== 'RecipeResource' || !item.properties.LearnedRecipes) return false;
    const tags = (item.properties.Tags ?? '').toLowerCase();
    return tags.includes('base:magazine') || item.id.startsWith('RadioMag');
  });
  const byFamily = new Map();

  for (const item of recipeItems) {
    const family = recipeFamily(item.id);
    const list = byFamily.get(family) ?? [];
    const id = `Base.${item.id}`;
    list.push({
      id,
      sourceId: item.id,
      names: translated('items', id, item.id, `item:${id}`),
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

function buildVhs(records, translated) {
  const relevant = records.filter((record) => ['Retail-VHS', 'Home-VHS'].includes(record.category)).map((record) => {
    const effects = dedupeEffects(record.codes.map(parseMediaCode));
    return { record, effects };
  }).filter(({ record, effects }) => {
    const hasChecklistEffect = effects.some((effect) => effect.type === 'skillXp' || effect.type === 'recipe');
    const englishName = record.itemDisplayNameKey
      ? translated('media', record.itemDisplayNameKey, record.guid, `media:${record.guid}`).en
      : '';
    return hasChecklistEffect || englishName === 'VHS: The Dog Goblin';
  });

  const retailSeriesCounts = new Map();
  for (const { record } of relevant) {
    if (record.category !== 'Retail-VHS') continue;
    const title = record.titleKey ? translated('media', record.titleKey, record.titleKey, `media-title:${record.titleKey}`).en : 'Other';
    retailSeriesCounts.set(title, (retailSeriesCounts.get(title) ?? 0) + 1);
  }

  const groups = new Map();
  for (const { record, effects } of relevant) {
    let groupKey;
    let groupNames = null;
    if (record.category === 'Home-VHS') {
      groupKey = 'home';
    } else {
      const englishTitle = record.titleKey ? translated('media', record.titleKey, record.titleKey, `media-title:${record.titleKey}`).en : 'Other';
      if ((retailSeriesCounts.get(englishTitle) ?? 0) > 1) {
        groupKey = `series:${englishTitle}`;
        groupNames = translated('media', record.titleKey, englishTitle, `media-title:${record.titleKey}`);
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

    const names = translated('media', record.itemDisplayNameKey, record.guid, `media:${record.guid}`);
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

function collectRecipeReferences(catalog) {
  const recipes = new Set();
  for (const category of catalog) {
    for (const group of category.groups) {
      for (const item of group.items) {
        for (const recipe of item.recipes ?? []) recipes.add(recipe);
        for (const effect of item.effects ?? []) if (effect.type === 'recipe') recipes.add(effect.recipe);
      }
    }
  }
  return [...recipes].sort();
}

function buildGameDictionaries(indexes, domainFiles, languages, translated, catalog, diagnostics) {
  const skills = {};
  for (const [skill, translationKey] of Object.entries(SKILL_TRANSLATION_KEYS)) {
    skills[skill] = {
      translationKey,
      names: translated('skills', translationKey, skill, `skill:${skill}`)
    };
  }

  const recipes = {};
  for (const recipeReference of collectRecipeReferences(catalog)) {
    const resolution = recipeTranslationKey(recipeReference, indexes, domainFiles.recipes, languages);
    const fallback = readableRecipeFallback(recipeReference) || recipeReference;
    const names = translated(
      'recipes',
      resolution.key,
      fallback,
      `recipe:${recipeReference}`,
      { requireEnglish: false }
    );

    recipes[recipeReference] = {
      translationKey: resolution.key,
      strategy: resolution.strategy,
      names
    };

    diagnostics.recipeResolution[resolution.strategy] += 1;
    if (resolution.strategy === 'explicit') {
      diagnostics.explicitRecipeMappings.push(`${recipeReference}->${resolution.key}`);
    } else if (resolution.strategy === 'unresolved') {
      diagnostics.unresolvedRecipeReferences.push(recipeReference);
    }
  }

  return { schemaVersion: 1, skills, recipes };
}

function validateCatalog(catalog, languages) {
  const ids = new Set();
  const unknownEffects = [];
  const missingGeneratedNames = [];

  for (const category of catalog) {
    if (!category.groups.length) throw new Error(`Category '${category.id}' has no groups`);
    for (const group of category.groups) {
      for (const item of group.items) {
        const key = `${category.id}|${item.id}`;
        if (ids.has(key)) throw new Error(`Duplicate item key: ${key}`);
        ids.add(key);
        for (const language of languages) {
          if (!item.names?.[language]) missingGeneratedNames.push(`${language}:${item.id}`);
        }
        for (const effect of item.effects ?? []) {
          if (effect.type === 'unknown') unknownEffects.push(`${item.id}:${effect.code}`);
        }
      }
    }
  }

  return { unknownEffects, missingGeneratedNames };
}

await mkdir(outputDir, { recursive: true });
const discoveredLanguages = await discoverLanguages();
const languages = discoveredLanguages.map(({ code }) => code);
const uiLanguages = await discoverUiLanguages(languages);

const translationIndexes = {};
for (const { code, sourceDir } of discoveredLanguages) {
  translationIndexes[code] = await loadTranslationIndex(path.join(translateDir, sourceDir));
}

const diagnostics = {
  missingTranslations: [],
  duplicateTranslationKeys: Object.values(translationIndexes).reduce((sum, index) => sum + index.globalDuplicates().length, 0),
  ambiguousTranslationKeys: Object.values(translationIndexes).reduce((sum, index) => sum + index.globalDuplicates().filter((entry) => entry.ambiguous).length, 0),
  recipeResolution: { exact: 0, explicit: 0, unresolved: 0 },
  explicitRecipeMappings: [],
  unresolvedRecipeReferences: []
};
const literatureText = await readFile(path.join(gameDataDir, 'items', 'literature.txt'), 'utf8');
const mediaText = await readFile(path.join(gameDataDir, 'recorded_media.lua'), 'utf8');
const normalItemsText = await readFile(path.join(gameDataDir, 'items', 'normal.txt'), 'utf8');
const items = parseItemsFile(literatureText);
const records = parseRecordedMedia(mediaText);

const mediaAnchors = records
  .flatMap((record) => [record.itemDisplayNameKey, record.titleKey])
  .filter(Boolean)
  .filter((key, index, values) => values.indexOf(key) === index)
  .slice(0, 2);
if (mediaAnchors.length < 2) throw new Error('Could not derive recorded-media localization anchors');

const domainFiles = {
  items: discoverDomainFiles(translationIndexes, languages, ['Base.BookCarpentry1', 'Base.BookCooking1'], 'items'),
  recipes: discoverDomainFiles(translationIndexes, languages, ['MakeCakeBatter', 'MakePieDough'], 'recipes'),
  skills: discoverDomainFiles(translationIndexes, languages, ['IGUI_perks_Carpentry', 'IGUI_perks_Aiming'], 'skills'),
  media: discoverDomainFiles(translationIndexes, languages, mediaAnchors, 'recorded media')
};
const translated = createTranslationResolver(translationIndexes, domainFiles, languages, diagnostics);

if (items.length < 100) throw new Error(`Parsed only ${items.length} literature items; file structure may have changed.`);
if (records.length < 100) throw new Error(`Parsed only ${records.length} recorded-media entries; file structure may have changed.`);
if (!/item\s+VHS_Retail\b/.test(normalItemsText) || !/item\s+VHS_Home\b/.test(normalItemsText)) {
  throw new Error('Expected VHS_Retail and VHS_Home parent items were not found in items/normal.txt.');
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

const books = buildBooks(items, translated);
const recipeSources = buildRecipeSources(items, translated);
const vhs = buildVhs(records, translated);
const catalog = [books, recipeSources, vhs];
const catalogDiagnostics = validateCatalog(catalog, languages);
if (catalogDiagnostics.unknownEffects.length) {
  throw new Error(`Unknown generated media effects: ${catalogDiagnostics.unknownEffects.join(', ')}`);
}
if (catalogDiagnostics.missingGeneratedNames.length) {
  throw new Error(`Generated item names are incomplete: ${catalogDiagnostics.missingGeneratedNames.slice(0, 20).join(', ')}`);
}

const gameDictionaries = buildGameDictionaries(translationIndexes, domainFiles, languages, translated, catalog, diagnostics);
const unexpectedUnresolvedRecipes = diagnostics.unresolvedRecipeReferences
  .filter((recipe) => !ALLOWED_UNRESOLVED_RECIPE_REFERENCES.has(recipe));
if (unexpectedUnresolvedRecipes.length) {
  throw new Error(`New unresolved recipe translation references: ${unexpectedUnresolvedRecipes.join(', ')}`);
}

await writeJson(path.join(outputDir, 'books.json'), books);
await writeJson(path.join(outputDir, 'recipe-sources.json'), recipeSources);
await writeJson(path.join(outputDir, 'vhs.json'), vhs);
await writeJson(path.join(outputDir, 'dictionaries.json'), gameDictionaries);

const translationSourceText = discoveredLanguages
  .map(({ code }) => `${code}\n${translationIndexes[code].sourceText}`)
  .join('\n');
const sourceHash = hash(literatureText + mediaText + normalItemsText + translationSourceText);

await writeJson(path.join(outputDir, 'manifest.json'), {
  schemaVersion: 2,
  defaultLanguage: DEFAULT_LANGUAGE,
  languages,
  uiLanguages,
  sourceHash,
  counts: Object.fromEntries(catalog.map((category) => [category.id, category.groups.reduce((sum, group) => sum + group.items.length, 0)])),
  diagnostics: {
    unknownMediaCodes: 0,
    missingTranslations: diagnostics.missingTranslations.length,
    duplicateTranslationKeys: diagnostics.duplicateTranslationKeys,
    ambiguousTranslationKeys: diagnostics.ambiguousTranslationKeys,
    recipeResolution: diagnostics.recipeResolution,
    explicitRecipeMappings: diagnostics.explicitRecipeMappings,
    unresolvedRecipeReferences: diagnostics.unresolvedRecipeReferences,
    localizationDomains: domainFiles
  }
});

console.log(`Languages: ${languages.join(', ')}`);
console.log(`Skill books: ${books.groups.reduce((sum, group) => sum + group.items.length, 0)}`);
console.log(`Recipe sources: ${recipeSources.groups.reduce((sum, group) => sum + group.items.length, 0)}`);
console.log(`Relevant VHS: ${vhs.groups.reduce((sum, group) => sum + group.items.length, 0)}`);
console.log(`Translation JSON keys are resolved strictly by exact match.`);
console.log(`Recipe translations: exact=${diagnostics.recipeResolution.exact}, explicit=${diagnostics.recipeResolution.explicit}, unresolved=${diagnostics.recipeResolution.unresolved}`);
if (diagnostics.unresolvedRecipeReferences.length) {
  console.warn(`Unresolved recipe translation references (${diagnostics.unresolvedRecipeReferences.length}): ${diagnostics.unresolvedRecipeReferences.join(', ')}`);
}
