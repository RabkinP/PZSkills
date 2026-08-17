import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

async function listJsonFiles(directory) {
  const files = [];
  const entries = await readdir(directory, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await listJsonFiles(fullPath));
    else if (entry.isFile() && entry.name.toLowerCase().endsWith('.json')) files.push(fullPath);
  }
  return files;
}

function parseJson(text, file) {
  try {
    return JSON.parse(text.replace(/^\uFEFF/, ''));
  } catch (error) {
    throw new Error(`Could not parse translation JSON '${file}': ${error.message}`);
  }
}

export async function loadTranslationIndex(languageDirectory) {
  const files = new Map();
  const globalEntries = new Map();
  const sourceTexts = [];

  for (const file of (await listJsonFiles(languageDirectory)).sort()) {
    const relative = path.relative(languageDirectory, file);
    const text = await readFile(file, 'utf8');
    sourceTexts.push(`${relative}\n${text}`);
    const dictionary = parseJson(text, file);
    if (!dictionary || Array.isArray(dictionary) || typeof dictionary !== 'object') continue;

    const entries = new Map();
    for (const [key, rawValue] of Object.entries(dictionary)) {
      if (typeof rawValue !== 'string') continue;
      entries.set(key, rawValue);
      if (!rawValue.trim()) continue;
      const matches = globalEntries.get(key) ?? [];
      matches.push({ value: rawValue, source: relative });
      globalEntries.set(key, matches);
    }
    files.set(relative, entries);
  }

  return {
    sourceText: sourceTexts.join('\n'),
    fileNames: [...files.keys()],

    findDomainFile(anchorKeys) {
      const candidates = [...files.entries()]
        .filter(([, entries]) => anchorKeys.every((key) => entries.has(key)))
        .map(([file]) => file);

      if (candidates.length > 1) {
        throw new Error(`Localization domain anchors [${anchorKeys.join(', ')}] are ambiguous: ${candidates.join(', ')}`);
      }
      return candidates[0] ?? null;
    },

    keysInFile(file) {
      return file && files.has(file) ? [...files.get(file).keys()] : [];
    },

    findDomainFileByExactOverlap(referenceKeys, minimumMatches = 3) {
      const reference = new Set(referenceKeys);
      const ranked = [...files.entries()]
        .map(([file, entries]) => ({
          file,
          matches: [...entries.keys()].reduce((count, key) => count + (reference.has(key) ? 1 : 0), 0)
        }))
        .filter((candidate) => candidate.matches >= minimumMatches)
        .sort((a, b) => b.matches - a.matches || a.file.localeCompare(b.file));

      if (!ranked.length) return null;
      if (ranked.length > 1 && ranked[0].matches === ranked[1].matches) {
        throw new Error(`Localization domain exact-key overlap is ambiguous: ${ranked[0].file} and ${ranked[1].file} both match ${ranked[0].matches} keys`);
      }
      return ranked[0].file;
    },

    hasExactInFile(file, key) {
      return Boolean(file && files.get(file)?.has(key));
    },

    resolveExactInFile(file, key) {
      if (!file) return null;
      const entries = files.get(file);
      if (!entries?.has(key)) return null;
      const value = entries.get(key);
      return typeof value === 'string' && value.trim() ? { key, value, source: file } : null;
    },

    globalDuplicates() {
      return [...globalEntries.entries()]
        .filter(([, matches]) => matches.length > 1)
        .map(([key, matches]) => ({
          key,
          ambiguous: new Set(matches.map((match) => match.value)).size > 1,
          matches
        }));
    }
  };
}

export function translationsForDomainKey(indexes, domainFiles, languages, defaultLanguage, key, fallback = '') {
  const english = indexes[defaultLanguage].resolveExactInFile(domainFiles[defaultLanguage], key);
  const englishFallback = english?.value || fallback || key;
  const missing = [];

  const values = Object.fromEntries(languages.map((language) => {
    const resolved = indexes[language].resolveExactInFile(domainFiles[language], key);
    if (!resolved) missing.push(language);
    return [language, resolved?.value || englishFallback];
  }));

  return { values, missing, english };
}
