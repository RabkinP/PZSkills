const STORAGE_KEY = 'pzChecklistState_v4';
const LEGACY_KEYS = ['pzChecklistState_v3', 'pzChecklistState_v2'];
const V1_STORAGE_KEY = 'pzChecklistState_v1';
const STATE_VERSION = 4;
const DEFAULT_LANGUAGE = 'en';

export function createEmptyState() {
  return {
    version: STATE_VERSION,
    found: {},
    settings: {
      language: DEFAULT_LANGUAGE,
      activeCategory: 'all',
      status: 'all',
      grouping: 'default',
      sort: 'name'
    }
  };
}

function copyCommonState(candidate) {
  const state = createEmptyState();
  if (!candidate || typeof candidate !== 'object') return state;
  if (candidate.found && typeof candidate.found === 'object') {
    for (const [key, value] of Object.entries(candidate.found)) if (value === true) state.found[key] = true;
  }
  const settings = candidate.settings ?? {};
  if (typeof settings.language === 'string') state.settings.language = settings.language;
  if (typeof settings.activeCategory === 'string') state.settings.activeCategory = settings.activeCategory;
  if (['all', 'missing', 'found'].includes(settings.status)) state.settings.status = settings.status;
  if (['default', 'skill', 'effect', 'type', 'none'].includes(settings.grouping)) state.settings.grouping = settings.grouping;
  if (['name', 'nameDesc', 'missingFirst', 'foundFirst', 'id'].includes(settings.sort)) state.settings.sort = settings.sort;
  return state;
}

function migrateV1(candidate) {
  const state = createEmptyState();
  if (!candidate || typeof candidate !== 'object') return state;
  for (const [key, value] of Object.entries(candidate)) {
    if (key === '_settings') continue;
    const migratedKey = key.startsWith('recipes|') ? `recipeSources|${key.slice('recipes|'.length)}` : key;
    if (value === true) state.found[migratedKey] = true;
  }
  return state;
}

function readJsonFromStorage(key) {
  try { const raw = localStorage.getItem(key); return raw === null ? null : JSON.parse(raw); }
  catch { return null; }
}

export function loadState() {
  const current = readJsonFromStorage(STORAGE_KEY);
  if (current) return copyCommonState(current);
  for (const key of LEGACY_KEYS) {
    const legacy = readJsonFromStorage(key);
    if (legacy) { const migrated = copyCommonState(legacy); saveState(migrated); return migrated; }
  }
  const v1 = readJsonFromStorage(V1_STORAGE_KEY);
  if (v1) { const migrated = migrateV1(v1); saveState(migrated); return migrated; }
  return createEmptyState();
}

export function saveState(state) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(copyCommonState(state))); }
  catch { /* The page remains usable when localStorage is unavailable. */ }
}

export function exportState(state) { return copyCommonState(state); }

export function importState(candidate) {
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) throw new Error('Invalid progress file format.');
  if (candidate.found || candidate.settings || candidate.version >= 2) return copyCommonState(candidate);
  return migrateV1(candidate);
}
