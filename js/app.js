import { effectChips, groupLabel, itemSearchText, normalizeCatalog, recipeName } from './catalog.js';
import { filterItems, sortItems } from './filters.js';
import { dictionaryValue, englishSecondary, getSupportedLanguages, languageName, loadLocales, localized, normalizeLanguage, t } from './i18n.js';
import { createEmptyState, exportState, importState, loadState, saveState } from './state.js';
import { downloadJson, escapeHtml, showToast } from './utils.js';

let categories = [];
let allItems = [];
let state = loadState();
let filters = { query: '', category: state.settings.activeCategory || 'all', status: state.settings.status || 'all', skills: new Set(), effects: new Set() };
let allExpanded = true;

const categoryMap = () => Object.fromEntries(categories.map((category) => [category.id, category]));
const currentLanguage = () => normalizeLanguage(state.settings.language);

async function loadData() {
  const manifest = await fetch('./generated/manifest.json').then((response) => {
    if (!response.ok) throw new Error('Could not load generated/manifest.json');
    return response.json();
  });
  await loadLocales(manifest.languages, manifest.uiLanguages);
  categories = await Promise.all(['books.json', 'recipe-sources.json', 'vhs.json'].map(async (file) => {
    const response = await fetch(`./generated/${file}`);
    if (!response.ok) throw new Error(`Could not load generated/${file}`);
    return response.json();
  }));
  allItems = normalizeCatalog(categories);
}

function populateLanguages() {
  const select = document.getElementById('languageSelect');
  select.innerHTML = getSupportedLanguages().map((language) => `<option value="${escapeHtml(language)}">${escapeHtml(languageName(language))}</option>`).join('');
  select.value = currentLanguage();
}

function setSelectOptions(selectId, options, selected) {
  const select = document.getElementById(selectId);
  select.innerHTML = options.map(([value, label]) => `<option value="${value}">${escapeHtml(label)}</option>`).join('');
  select.value = selected;
}

function renderStaticUi() {
  const lang = currentLanguage();
  document.documentElement.lang = lang;
  document.title = t(lang, 'pageTitleModern');
  document.getElementById('pageHeading').textContent = t(lang, 'headingModern');
  document.getElementById('globalSearch').placeholder = t(lang, 'searchPlaceholder');
  document.getElementById('mobileFiltersLabel').textContent = t(lang, 'filters');
  document.getElementById('filtersHeading').textContent = t(lang, 'filters');
  document.getElementById('statusHeading').textContent = t(lang, 'status');
  document.getElementById('effectHeading').textContent = t(lang, 'effect');
  document.getElementById('skillHeading').textContent = t(lang, 'skill');
  document.getElementById('clearEffectsBtn').textContent = t(lang, 'clear');
  document.getElementById('clearSkillsBtn').textContent = t(lang, 'clear');
  document.getElementById('resetFiltersBtn').textContent = t(lang, 'resetFilters');
  document.getElementById('groupByLabel').textContent = t(lang, 'groupBy');
  document.getElementById('sortByLabel').textContent = t(lang, 'sortBy');
  document.getElementById('resultLabel').textContent = t(lang, 'items');
  document.getElementById('exportBtn').textContent = t(lang, 'exportJson');
  document.getElementById('importBtn').textContent = t(lang, 'importJson');
  document.getElementById('resetAllBtn').textContent = t(lang, 'resetAll');
  document.getElementById('languageSelect').value = lang;
  document.getElementById('expandCollapseBtn').textContent = t(lang, allExpanded ? 'collapseAll' : 'expandAll');

  setSelectOptions('groupBySelect', [
    ['default', t(lang, 'groupDefault')], ['skill', t(lang, 'groupSkill')], ['effect', t(lang, 'groupEffect')], ['type', t(lang, 'groupType')], ['none', t(lang, 'groupNone')]
  ], state.settings.grouping);
  setSelectOptions('sortBySelect', [
    ['name', t(lang, 'sortName')], ['nameDesc', t(lang, 'sortNameDesc')], ['missingFirst', t(lang, 'sortMissingFirst')], ['foundFirst', t(lang, 'sortFoundFirst')], ['id', t(lang, 'sortId')]
  ], state.settings.sort);

  const status = document.getElementById('statusControl');
  status.innerHTML = ['all', 'missing', 'found'].map((value) => `<button class="segment${filters.status === value ? ' active' : ''}" data-status="${value}">${escapeHtml(t(lang, `status_${value}`))}</button>`).join('');

  const effects = [['xp', t(lang, 'effectXp')], ['recipe', t(lang, 'effectRecipe')], ['other', t(lang, 'effectOther')]];
  document.getElementById('effectFilters').innerHTML = effects.map(([value, label]) => `<label class="check-row"><input type="checkbox" data-effect="${value}"${filters.effects.has(value) ? ' checked' : ''}><span>${escapeHtml(label)}</span></label>`).join('');

  const skills = [...new Set(allItems.flatMap((item) => item.skills))].sort((a, b) => dictionaryValue(lang, 'skills', a).localeCompare(dictionaryValue(lang, 'skills', b), lang));
  document.getElementById('skillFilters').innerHTML = skills.map((skill) => `<label class="check-row"><input type="checkbox" data-skill="${escapeHtml(skill)}"${filters.skills.has(skill) ? ' checked' : ''}><span>${escapeHtml(dictionaryValue(lang, 'skills', skill))}</span></label>`).join('');
}

function renderCategories() {
  const lang = currentLanguage();
  const nav = document.getElementById('categoryNav');
  const categoryEntries = [{ id: 'all', icon: '◫', count: allItems.length }, ...categories.map((category) => ({ id: category.id, icon: category.icon, count: allItems.filter((item) => item.categoryId === category.id).length }))];
  nav.innerHTML = categoryEntries.map((entry) => {
    const label = entry.id === 'all' ? t(lang, 'allItems') : dictionaryValue(lang, 'categories', entry.id);
    return `<button class="category-button${filters.category === entry.id ? ' active' : ''}" data-category="${entry.id}"><span>${entry.icon}</span> ${escapeHtml(label)} <span class="nav-count">${entry.count}</span></button>`;
  }).join('');
}

function groupKeyFor(item) {
  const grouping = state.settings.grouping;
  const lang = currentLanguage();
  if (grouping === 'none') return { key: 'all', label: '' };
  if (grouping === 'skill') {
    const skill = item.skills[0];
    return skill ? { key: `skill:${skill}`, label: dictionaryValue(lang, 'skills', skill) } : { key: 'skill:other', label: t(lang, 'other') };
  }
  if (grouping === 'effect') {
    const type = item.effectTypes.includes('xp') ? 'xp' : item.effectTypes.includes('recipe') ? 'recipe' : 'other';
    return { key: `effect:${type}`, label: type === 'xp' ? t(lang, 'effectXp') : type === 'recipe' ? t(lang, 'effectRecipe') : t(lang, 'effectOther') };
  }
  if (grouping === 'type' || (grouping === 'default' && filters.category === 'all')) {
    return { key: `type:${item.categoryId}`, label: dictionaryValue(lang, 'categories', item.categoryId) };
  }
  if (grouping === 'default') return { key: item.sourceGroup.id, label: groupLabel(item.sourceGroup, lang) };
  return { key: 'all', label: '' };
}

function renderItem(item) {
  const lang = currentLanguage();
  const found = Boolean(state.found[item.key]);
  const primary = localized(item.names, lang);
  const secondary = englishSecondary(item.names, lang);
  const chips = effectChips(item, lang).map((chip) => `<span class="meta-chip ${chip.type}">${escapeHtml(chip.text)}</span>`).join('');
  const recipes = item.recipes ?? (item.effects ?? []).filter((effect) => effect.type === 'recipe').map((effect) => effect.recipe);
  const recipeDetails = recipes.length ? `<details class="recipe-details"><summary>${escapeHtml(t(lang, 'showRecipes', { count: recipes.length }))}</summary><ul class="recipe-list">${recipes.map((recipe) => `<li>${escapeHtml(recipeName(recipe, lang))}</li>`).join('')}</ul></details>` : '';
  return `<label class="item-card${found ? ' found' : ''}" data-item-key="${escapeHtml(item.key)}">
    <input class="item-check" type="checkbox" data-key="${escapeHtml(item.key)}"${found ? ' checked' : ''}>
    <span class="item-body"><span class="item-heading"><span><span class="item-name">${escapeHtml(primary)}</span>${secondary ? `<span class="item-secondary">${escapeHtml(secondary)}</span>` : ''}</span></span><span class="item-id">${escapeHtml(item.id)}</span><span class="chip-row">${chips}</span>${recipeDetails}</span>
  </label>`;
}

function renderResults() {
  const lang = currentLanguage();
  const filtered = filterItems(allItems, filters, state.found, lang, itemSearchText);
  const sorted = sortItems(filtered, state.settings.sort, state.found, (item) => localized(item.names, lang));
  document.getElementById('resultCount').textContent = sorted.length;
  document.getElementById('emptyState').hidden = sorted.length > 0;
  document.getElementById('emptyState').textContent = t(lang, 'emptyState');
  document.getElementById('catalogResults').hidden = sorted.length === 0;

  const groups = new Map();
  for (const item of sorted) {
    const descriptor = groupKeyFor(item);
    if (!groups.has(descriptor.key)) groups.set(descriptor.key, { label: descriptor.label, items: [] });
    groups.get(descriptor.key).items.push(item);
  }

  const html = [...groups.values()].map((group) => {
    if (state.settings.grouping === 'none') return group.items.map(renderItem).join('');
    const foundCount = group.items.filter((item) => state.found[item.key]).length;
    const secondaryLabel = lang !== 'en' ? (() => {
      const first = group.items[0];
      if (!first) return '';
      const descriptor = state.settings.grouping === 'default' && filters.category !== 'all' ? groupLabel(first.sourceGroup, 'en') : '';
      return descriptor && descriptor !== group.label ? descriptor : '';
    })() : '';
    return `<details class="catalog-group"${allExpanded ? ' open' : ''}><summary class="group-header"><span class="group-title">${escapeHtml(group.label)}${secondaryLabel ? `<span class="group-title-secondary">${escapeHtml(secondaryLabel)}</span>` : ''}</span><span class="group-meta">${foundCount} / ${group.items.length}</span></summary><div class="group-items">${group.items.map(renderItem).join('')}</div></details>`;
  }).join('');
  document.getElementById('catalogResults').innerHTML = html;
  renderActiveFilters();
  updateProgress();
}

function renderActiveFilters() {
  const lang = currentLanguage();
  const container = document.getElementById('activeFilters');
  const chips = [];
  if (filters.status !== 'all') chips.push({ kind: 'status', value: filters.status, label: t(lang, `status_${filters.status}`) });
  for (const effect of filters.effects) chips.push({ kind: 'effect', value: effect, label: effect === 'xp' ? t(lang, 'effectXp') : effect === 'recipe' ? t(lang, 'effectRecipe') : t(lang, 'effectOther') });
  for (const skill of filters.skills) chips.push({ kind: 'skill', value: skill, label: dictionaryValue(lang, 'skills', skill) });
  container.hidden = chips.length === 0;
  container.innerHTML = chips.map((chip) => `<button class="filter-chip" data-remove-kind="${chip.kind}" data-remove-value="${escapeHtml(chip.value)}">${escapeHtml(chip.label)} ×</button>`).join('') + (chips.length ? `<button class="text-button" data-clear="all">${escapeHtml(t(lang, 'clearAll'))}</button>` : '');
  const count = filters.skills.size + filters.effects.size + (filters.status === 'all' ? 0 : 1);
  const badge = document.getElementById('mobileFilterCount');
  badge.hidden = count === 0;
  badge.textContent = count;
}

function updateProgress() {
  const found = allItems.filter((item) => state.found[item.key]).length;
  const total = allItems.length;
  const pct = total ? Math.round(found / total * 100) : 0;
  document.getElementById('grandTotal').textContent = `${found} / ${total}`;
  document.getElementById('progressPercent').textContent = `${pct}%`;
  document.getElementById('progressBar').style.width = `${pct}%`;
}

function renderAll() { renderStaticUi(); renderCategories(); renderResults(); }
function persistView() { state.settings.activeCategory = filters.category; state.settings.status = filters.status; saveState(state); }
function resetTransientFilters() { filters.skills.clear(); filters.effects.clear(); filters.status = 'all'; filters.query = ''; document.getElementById('globalSearch').value = ''; persistView(); }
function closeDrawer() { document.getElementById('filtersPanel').classList.remove('open'); document.getElementById('drawerBackdrop').hidden = true; }
function openDrawer() { document.getElementById('filtersPanel').classList.add('open'); document.getElementById('drawerBackdrop').hidden = false; }

function sanitizeImportedState(imported) {
  const allowed = new Set(allItems.map((item) => item.key));
  const clean = createEmptyState();
  clean.settings = { ...clean.settings, ...imported.settings, language: normalizeLanguage(imported.settings?.language) };
  for (const [key, value] of Object.entries(imported.found ?? {})) if (allowed.has(key) && value === true) clean.found[key] = true;
  return clean;
}

async function handleImport(file) {
  if (!file) return;
  try { state = sanitizeImportedState(importState(JSON.parse(await file.text()))); filters.category = state.settings.activeCategory; filters.status = state.settings.status; saveState(state); renderAll(); showToast(t(currentLanguage(), 'progressImported')); }
  catch (error) { console.error(error); showToast(t(currentLanguage(), 'importFailed')); }
}

function attachEvents() {
  document.addEventListener('click', (event) => {
    const category = event.target.closest('[data-category]');
    if (category) { filters.category = category.dataset.category; persistView(); renderCategories(); renderResults(); return; }
    const status = event.target.closest('[data-status]');
    if (status) { filters.status = status.dataset.status; persistView(); renderAll(); return; }
    const clear = event.target.closest('[data-clear]');
    if (clear) { if (clear.dataset.clear === 'skills') filters.skills.clear(); else if (clear.dataset.clear === 'effects') filters.effects.clear(); else resetTransientFilters(); renderAll(); return; }
    const remove = event.target.closest('[data-remove-kind]');
    if (remove) { if (remove.dataset.removeKind === 'skill') filters.skills.delete(remove.dataset.removeValue); if (remove.dataset.removeKind === 'effect') filters.effects.delete(remove.dataset.removeValue); if (remove.dataset.removeKind === 'status') filters.status = 'all'; persistView(); renderAll(); return; }
    if (event.target.id === 'menuBtn') { const menu = document.getElementById('actionMenu'); menu.hidden = !menu.hidden; event.target.setAttribute('aria-expanded', String(!menu.hidden)); return; }
    if (!event.target.closest('.header-actions')) document.getElementById('actionMenu').hidden = true;
    if (event.target.id === 'exportBtn') { downloadJson(exportState(state), 'pz-checklist-progress.json'); showToast(t(currentLanguage(), 'progressExported')); }
    if (event.target.id === 'importBtn') document.getElementById('importFileInput').click();
    if (event.target.id === 'resetAllBtn' && confirm(t(currentLanguage(), 'resetConfirm'))) { const lang = state.settings.language; state = createEmptyState(); state.settings.language = lang; filters = { query: '', category: 'all', status: 'all', skills: new Set(), effects: new Set() }; saveState(state); renderAll(); }
    if (event.target.id === 'mobileFiltersBtn') openDrawer();
    if (event.target.id === 'closeFiltersBtn' || event.target.id === 'drawerBackdrop') closeDrawer();
    if (event.target.id === 'expandCollapseBtn') { allExpanded = !allExpanded; document.querySelectorAll('.catalog-group').forEach((group) => { group.open = allExpanded; }); document.getElementById('expandCollapseBtn').textContent = t(currentLanguage(), allExpanded ? 'collapseAll' : 'expandAll'); }
  });

  document.addEventListener('change', (event) => {
    if (event.target.id === 'languageSelect') { state.settings.language = normalizeLanguage(event.target.value); saveState(state); renderAll(); return; }
    if (event.target.id === 'groupBySelect') { state.settings.grouping = event.target.value; saveState(state); renderResults(); return; }
    if (event.target.id === 'sortBySelect') { state.settings.sort = event.target.value; saveState(state); renderResults(); return; }
    if (event.target.matches('[data-skill]')) { event.target.checked ? filters.skills.add(event.target.dataset.skill) : filters.skills.delete(event.target.dataset.skill); renderResults(); return; }
    if (event.target.matches('[data-effect]')) { event.target.checked ? filters.effects.add(event.target.dataset.effect) : filters.effects.delete(event.target.dataset.effect); renderResults(); return; }
    if (event.target.matches('input[data-key]')) { event.target.checked ? state.found[event.target.dataset.key] = true : delete state.found[event.target.dataset.key]; saveState(state); renderResults(); return; }
    if (event.target.id === 'importFileInput') { handleImport(event.target.files?.[0]); event.target.value = ''; }
  });

  document.getElementById('globalSearch').addEventListener('input', (event) => { filters.query = event.target.value; renderResults(); });
  document.addEventListener('keydown', (event) => { if (event.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName)) { event.preventDefault(); document.getElementById('globalSearch').focus(); } if (event.key === 'Escape') closeDrawer(); });
}

async function init() {
  try {
    await loadData();
    state.settings.language = currentLanguage();
    if (!['all', ...categories.map((category) => category.id)].includes(filters.category)) filters.category = 'all';
    populateLanguages();
    attachEvents();
    renderAll();
  } catch (error) {
    console.error(error);
    document.getElementById('catalogResults').innerHTML = '<div class="empty-state">Could not load generated checklist data. Run <code>npm run build:data</code> before deploying.</div>';
  }
}

init();
