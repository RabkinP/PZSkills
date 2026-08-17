const STORAGE_KEY = 'pzChecklistState_v3';
const V2_STORAGE_KEY = 'pzChecklistState_v2';
const V1_STORAGE_KEY = 'pzChecklistState_v1';
const STATE_VERSION = 3;
const DEFAULT_LANGUAGE = 'en';

export function createEmptyState() {
  return {
    version: STATE_VERSION,
    found: {},
    settings: {
      hideFound: {},
      language: DEFAULT_LANGUAGE
    }
  };
}

function copyCommonState(candidate) {
  const state = createEmptyState();
  if (!candidate || typeof candidate !== 'object') return state;

  if (candidate.found && typeof candidate.found === 'object') {
    for (const [key, value] of Object.entries(candidate.found)) {
      if (value === true) state.found[key] = true;
    }
  }

  const hideFound = candidate.settings?.hideFound;
  if (hideFound && typeof hideFound === 'object') {
    for (const [key, value] of Object.entries(hideFound)) {
      if (value === true) state.settings.hideFound[key] = true;
    }
  }

  if (typeof candidate.settings?.language === 'string') state.settings.language = candidate.settings.language;
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

  const hideFound = candidate._settings?.hideFound;
  if (hideFound && typeof hideFound === 'object') {
    for (const [key, value] of Object.entries(hideFound)) {
      const migratedKey = key === 'recipes' ? 'recipeSources' : key;
      if (value === true) state.settings.hideFound[migratedKey] = true;
    }
  }

  return state;
}

function readJsonFromStorage(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? null : JSON.parse(raw);
  } catch {
    return null;
  }
}

export function loadState() {
  const current = readJsonFromStorage(STORAGE_KEY);
  if (current) return copyCommonState(current);

  const v2 = readJsonFromStorage(V2_STORAGE_KEY);
  if (v2) {
    const migrated = copyCommonState(v2);
    saveState(migrated);
    return migrated;
  }

  const v1 = readJsonFromStorage(V1_STORAGE_KEY);
  if (v1) {
    const migrated = migrateV1(v1);
    saveState(migrated);
    return migrated;
  }

  return createEmptyState();
}

export function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(copyCommonState(state)));
  } catch {
    // The checklist still works for the current page even if storage is unavailable.
  }
}

export function exportState(state) {
  return copyCommonState(state);
}

export function importState(candidate) {
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
    throw new Error('Invalid progress file format.');
  }
  if (candidate.version === STATE_VERSION || candidate.version === 2 || candidate.found || candidate.settings) {
    return copyCommonState(candidate);
  }
  return migrateV1(candidate);
}
