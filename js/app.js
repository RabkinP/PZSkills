import { applyFilters } from './filters.js';
import { getSupportedLanguages, languageName, loadLocales, normalizeLanguage, t } from './i18n.js';
import { renderPanels, renderTabs, setActiveTab, updateCounts } from './render.js';
import { createEmptyState, exportState, importState, loadState, saveState } from './state.js';
import { downloadJson, makeItemKey, showToast } from './utils.js';

let categories = [];
let state = loadState();
let activeCategoryId = 'books';

function currentLanguage() {
  return normalizeLanguage(state.settings.language);
}

async function loadGeneratedData() {
  const manifestResponse = await fetch('./generated/manifest.json');
  if (!manifestResponse.ok) throw new Error('Could not load generated/manifest.json');
  const manifest = await manifestResponse.json();
  await loadLocales(manifest.languages);

  const files = ['books.json', 'recipe-sources.json', 'vhs.json'];
  const loaded = await Promise.all(files.map(async (file) => {
    const response = await fetch(`./generated/${file}`);
    if (!response.ok) throw new Error(`Could not load generated/${file}`);
    return response.json();
  }));

  return { manifest, categories: loaded };
}

function findGroup(groupId) {
  for (const category of categories) {
    const group = category.groups.find((candidate) => candidate.id === groupId);
    if (group) return { category, group };
  }
  return null;
}

function populateLanguageSelect() {
  const select = document.getElementById('languageSelect');
  select.innerHTML = '';
  for (const language of getSupportedLanguages()) {
    const option = document.createElement('option');
    option.value = language;
    option.textContent = languageName(language);
    select.appendChild(option);
  }
}

function renderStaticUi() {
  const language = currentLanguage();
  state.settings.language = language;
  document.documentElement.lang = language;
  document.title = t(language, 'pageTitle');
  document.getElementById('pageHeading').textContent = t(language, 'heading');
  document.getElementById('totalFoundLabel').textContent = t(language, 'totalFound');
  document.getElementById('languageLabel').textContent = t(language, 'language');
  document.getElementById('exportBtn').textContent = t(language, 'exportJson');
  document.getElementById('importBtn').textContent = t(language, 'importJson');
  document.getElementById('resetAllBtn').textContent = t(language, 'resetAll');
  document.getElementById('languageSelect').value = language;
}

function refreshFilters() {
  categories.forEach((category) => {
    const panel = document.getElementById(`panel-${category.id}`);
    const search = panel?.querySelector('.search-input');
    applyFilters(panel, search?.value || '', Boolean(state.settings.hideFound[category.id]), state.found);
  });
}

function refreshUi() {
  updateCounts(categories, state);
  refreshFilters();
}

function renderApp() {
  const language = currentLanguage();
  renderStaticUi();
  renderTabs(categories, activeCategoryId, language);
  renderPanels(categories, activeCategoryId, state, language);
  refreshUi();
}

function toggleGroup(groupId) {
  const match = findGroup(groupId);
  if (!match) return;
  const { category, group } = match;
  const allChecked = group.items.every((item) => state.found[makeItemKey(category.id, item.id)]);

  group.items.forEach((item) => {
    const key = makeItemKey(category.id, item.id);
    if (allChecked) delete state.found[key];
    else state.found[key] = true;
  });

  saveState(state);
  const groupElement = document.querySelector(`details.group[data-gid="${group.id}"]`);
  groupElement?.querySelectorAll('.items input[type="checkbox"][data-key]').forEach((checkbox) => {
    checkbox.checked = !allChecked;
  });
  refreshUi();
}

function sanitizeImportedState(imported) {
  const allowedKeys = new Set();
  const allowedCategories = new Set(categories.map((category) => category.id));
  categories.forEach((category) => category.groups.forEach((group) => group.items.forEach((item) => {
    allowedKeys.add(makeItemKey(category.id, item.id));
  })));

  const clean = createEmptyState();
  clean.settings.language = normalizeLanguage(imported.settings.language);
  for (const key of Object.keys(imported.found)) {
    if (allowedKeys.has(key) && imported.found[key] === true) clean.found[key] = true;
  }
  for (const categoryId of Object.keys(imported.settings.hideFound)) {
    if (allowedCategories.has(categoryId) && imported.settings.hideFound[categoryId] === true) clean.settings.hideFound[categoryId] = true;
  }
  return clean;
}

async function handleImport(file) {
  if (!file) return;
  try {
    const parsed = JSON.parse(await file.text());
    state = sanitizeImportedState(importState(parsed));
    saveState(state);
    renderApp();
    showToast(t(currentLanguage(), 'progressImported'));
  } catch (error) {
    console.error(error);
    showToast(t(currentLanguage(), 'importFailed'));
  }
}

function attachEvents() {
  document.addEventListener('click', (event) => {
    const groupCheckbox = event.target.closest('input[data-group-all]');
    if (groupCheckbox) {
      event.preventDefault();
      setTimeout(() => toggleGroup(groupCheckbox.dataset.groupAll), 0);
      return;
    }

    const tabButton = event.target.closest('.tabbtn');
    if (tabButton) {
      activeCategoryId = tabButton.dataset.tab;
      setActiveTab(activeCategoryId);
      return;
    }

    if (event.target.id === 'exportBtn') {
      downloadJson(exportState(state), 'pz-checklist-progress.json');
      showToast(t(currentLanguage(), 'progressExported'));
      return;
    }
    if (event.target.id === 'importBtn') {
      document.getElementById('importFileInput').click();
      return;
    }
    if (event.target.id === 'resetAllBtn' && confirm(t(currentLanguage(), 'resetConfirm'))) {
      state = createEmptyState();
      saveState(state);
      renderApp();
    }
  });

  document.addEventListener('change', (event) => {
    if (event.target.id === 'languageSelect') {
      state.settings.language = normalizeLanguage(event.target.value);
      saveState(state);
      renderApp();
      return;
    }
    if (event.target.matches('input[type="checkbox"][data-key]')) {
      const key = event.target.dataset.key;
      if (event.target.checked) state.found[key] = true;
      else delete state.found[key];
      saveState(state);
      refreshUi();
      return;
    }
    if (event.target.matches('.hide-found-toggle-input')) {
      const categoryId = event.target.dataset.tab;
      if (event.target.checked) state.settings.hideFound[categoryId] = true;
      else delete state.settings.hideFound[categoryId];
      saveState(state);
      refreshUi();
      return;
    }
    if (event.target.id === 'importFileInput') {
      handleImport(event.target.files?.[0]);
      event.target.value = '';
    }
  });

  document.addEventListener('input', (event) => {
    if (!event.target.classList?.contains('search-input')) return;
    const categoryId = event.target.dataset.tab;
    const panel = document.getElementById(`panel-${categoryId}`);
    applyFilters(panel, event.target.value, Boolean(state.settings.hideFound[categoryId]), state.found);
  });
}

async function init() {
  try {
    const loaded = await loadGeneratedData();
    categories = loaded.categories;
    activeCategoryId = categories[0]?.id ?? 'books';
    populateLanguageSelect();
    state.settings.language = currentLanguage();
    saveState(state);
    attachEvents();
    renderApp();
  } catch (error) {
    console.error(error);
    document.getElementById('tabPanels').innerHTML = '<p class="load-error">Could not load generated checklist data. Run <code>npm run build:data</code> before deploying.</p>';
  }
}

init();
