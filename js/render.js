import { dictionaryValue, englishSecondary, getLocale, getSupportedLanguages, localized, t } from './i18n.js';
import { escapeHtml, makeItemKey } from './utils.js';

function localizedBlock(value, language, primaryClass = 'localized-primary', secondaryClass = 'localized-secondary') {
  const primary = localized(value, language);
  const secondary = englishSecondary(value, language);
  return `<span class="${primaryClass}">${escapeHtml(primary)}</span>` +
    (secondary ? `<span class="${secondaryClass}">${escapeHtml(secondary)}</span>` : '');
}

function groupName(group, language) {
  if (group.kind === 'skill') return dictionaryValue(language, 'skills', group.key);
  if (group.kind === 'recipeFamily') return dictionaryValue(language, 'recipeGroups', group.key);
  if (group.kind === 'mediaSeries') return localized(group.names, language);
  if (group.kind === 'mediaCategory') return dictionaryValue(language, 'mediaGroups', group.key);
  return group.key;
}

function groupNameBlock(group, language) {
  const primary = groupName(group, language);
  let secondary = '';
  if (language !== 'en' && getLocale(language)?.meta?.showEnglishSecondary) {
    secondary = group.kind === 'mediaSeries'
      ? localized(group.names, 'en')
      : groupName(group, 'en');
  }
  return `<span class="localized-primary">${escapeHtml(primary)}</span>` +
    (secondary && secondary !== primary ? `<span class="localized-secondary">${escapeHtml(secondary)}</span>` : '');
}

function groupDescription(group, language) {
  if (group.kind !== 'skill') return '';
  return getLocale(language)?.skillDescriptions?.[group.key] ?? getLocale('en')?.skillDescriptions?.[group.key] ?? '';
}

function prettifyRecipe(recipe) {
  return recipe
    .replace(/^base:/i, '')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function recipeName(recipe, language) {
  return getLocale(language)?.recipes?.[recipe] ?? getLocale('en')?.recipes?.[recipe] ?? prettifyRecipe(recipe);
}

function effectText(effect, language) {
  if (effect.type === 'skillXp') {
    return t(language, 'skillXp', { skill: dictionaryValue(language, 'skills', effect.skill) });
  }
  if (effect.type === 'recipe') {
    return t(language, 'recipe', { recipe: recipeName(effect.recipe, language) });
  }
  if (effect.type === 'status') {
    const status = dictionaryValue(language, 'statuses', effect.status);
    return t(language, effect.amount >= 0 ? 'statusIncrease' : 'statusDecrease', { status, amount: effect.amount });
  }
  return effect.code ?? '';
}

function itemNote(item, category, language) {
  if (category.id === 'books') return t(language, 'levels', { from: item.levelFrom, to: item.levelTo });
  if (category.id === 'recipeSources') return item.recipes.map((recipe) => t(language, 'recipe', { recipe: recipeName(recipe, language) })).join(', ');
  if (category.id === 'vhs') return item.effects.filter((effect) => effect.type !== 'unknown').map((effect) => effectText(effect, language)).join(', ');
  return '';
}

function itemSearchText(item, category) {
  const names = Object.values(item.names ?? {});
  const extras = [];
  const languages = getSupportedLanguages();

  if (item.skill) {
    extras.push(item.skill);
    languages.forEach((language) => extras.push(dictionaryValue(language, 'skills', item.skill)));
  }

  if (item.recipes) {
    extras.push(...item.recipes);
    for (const recipe of item.recipes) languages.forEach((language) => extras.push(recipeName(recipe, language)));
  }

  if (item.effects) {
    for (const effect of item.effects) {
      extras.push(effect.skill, effect.recipe, effect.status, effect.code);
      languages.forEach((language) => extras.push(effectText(effect, language)));
    }
  }

  return [...names, item.id, item.sourceId, ...extras].filter(Boolean).join(' ').toLowerCase();
}

export function renderTabs(categories, activeCategoryId, language) {
  const nav = document.getElementById('tabsNav');
  nav.innerHTML = '';
  categories.forEach((category) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `tabbtn${category.id === activeCategoryId ? ' active' : ''}`;
    button.dataset.tab = category.id;
    const primaryLabel = dictionaryValue(language, 'categories', category.id);
    const englishLabel = language !== 'en' && getLocale(language)?.meta?.showEnglishSecondary
      ? dictionaryValue('en', 'categories', category.id)
      : '';
    button.innerHTML = `<span class="tab-icon">${category.icon}</span><span class="tab-label"><span class="localized-primary">${escapeHtml(primaryLabel)}</span>` +
      (englishLabel && englishLabel !== primaryLabel ? `<span class="localized-secondary">${escapeHtml(englishLabel)}</span>` : '') +
      `</span><span class="tabcount" data-tabcount="${category.id}"></span>`;
    nav.appendChild(button);
  });
}

export function renderPanels(categories, activeCategoryId, state, language) {
  const main = document.getElementById('tabPanels');
  main.innerHTML = '';

  categories.forEach((category) => {
    const section = document.createElement('section');
    section.className = 'panel';
    section.id = `panel-${category.id}`;
    section.hidden = category.id !== activeCategoryId;

    const tools = document.createElement('div');
    tools.className = 'panel-tools';
    const search = document.createElement('input');
    search.type = 'search';
    search.className = 'search-input';
    search.placeholder = t(language, 'searchPlaceholder');
    search.dataset.tab = category.id;
    tools.appendChild(search);

    const hideToggle = document.createElement('label');
    hideToggle.className = 'hide-found-toggle';
    hideToggle.innerHTML = `<input type="checkbox" class="hide-found-toggle-input" data-tab="${category.id}"${state.settings.hideFound[category.id] ? ' checked' : ''}> <span>${escapeHtml(t(language, 'hideFound'))}</span>`;
    tools.appendChild(hideToggle);
    section.appendChild(tools);

    const groups = category.groups.slice().sort((a, b) => groupName(a, language).localeCompare(groupName(b, language), language, { sensitivity: 'base' }));
    groups.forEach((group) => section.appendChild(renderGroup(category, group, state, language)));

    const notes = getLocale(language)?.categoryNotes?.[category.id] ?? [];
    const englishNotes = getLocale('en')?.categoryNotes?.[category.id] ?? [];
    if (notes.length) {
      const footer = document.createElement('footer');
      footer.className = 'notes';
      notes.forEach((note, index) => {
        const paragraph = document.createElement('p');
        const englishNote = language !== 'en' && getLocale(language)?.meta?.showEnglishSecondary ? englishNotes[index] : '';
        paragraph.innerHTML = `<span class="note-primary">${escapeHtml(note)}</span>` +
          (englishNote && englishNote !== note ? `<span class="note-secondary">${escapeHtml(englishNote)}</span>` : '');
        footer.appendChild(paragraph);
      });
      section.appendChild(footer);
    }

    main.appendChild(section);
  });
}

function renderGroup(category, group, state, language) {
  const details = document.createElement('details');
  details.className = 'group';
  details.open = true;
  details.dataset.gid = group.id;

  const summary = document.createElement('summary');
  const name = groupName(group, language);
  summary.innerHTML = `<input type="checkbox" class="group-all-check" data-group-all="${group.id}" title="${escapeHtml(t(language, 'toggleWholeGroup'))}" aria-label="${escapeHtml(`${t(language, 'checkWholeGroup')} ${name}`)}">` +
    `<span class="gname">${groupNameBlock(group, language)}</span><span class="gcount" data-gcount="${group.id}"></span>`;
  details.appendChild(summary);

  const descriptionText = groupDescription(group, language);
  if (descriptionText) {
    const description = document.createElement('div');
    description.className = 'gdesc';
    const englishDescription = language !== 'en' && getLocale(language)?.meta?.showEnglishSecondary
      ? groupDescription(group, 'en')
      : '';
    description.innerHTML = `<span class="description-primary">${escapeHtml(descriptionText)}</span>` +
      (englishDescription && englishDescription !== descriptionText
        ? `<span class="description-secondary">${escapeHtml(englishDescription)}</span>`
        : '');
    details.appendChild(description);
  }

  const list = document.createElement('div');
  list.className = 'items';
  group.items.forEach((item) => {
    const key = makeItemKey(category.id, item.id);
    const row = document.createElement('label');
    row.className = 'item';
    row.dataset.key = key;
    row.dataset.search = itemSearchText(item, category);

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.dataset.key = key;
    checkbox.checked = Boolean(state.found[key]);

    const text = document.createElement('div');
    text.className = 'txt';
    const primaryName = localized(item.names, language);
    const secondaryName = englishSecondary(item.names, language);
    const primaryNote = itemNote(item, category, language);
    const secondaryNote = language !== 'en' && getLocale(language)?.meta?.showEnglishSecondary ? itemNote(item, category, 'en') : '';

    text.innerHTML = `<div class="item-primary">${escapeHtml(primaryName)}</div>` +
      (secondaryName ? `<div class="item-secondary">${escapeHtml(secondaryName)}</div>` : '') +
      (primaryNote ? `<div class="item-note"><span class="note-primary">${escapeHtml(primaryNote)}</span>` +
        (secondaryNote && secondaryNote !== primaryNote ? `<span class="note-secondary">${escapeHtml(secondaryNote)}</span>` : '') + '</div>' : '');

    row.append(checkbox, text);
    list.appendChild(row);
  });

  details.appendChild(list);
  return details;
}

export function updateCounts(categories, state) {
  let grandTotal = 0;
  let grandChecked = 0;
  categories.forEach((category) => {
    let categoryTotal = 0;
    let categoryChecked = 0;
    category.groups.forEach((group) => {
      let checked = 0;
      group.items.forEach((item) => {
        if (state.found[makeItemKey(category.id, item.id)]) checked += 1;
      });
      categoryTotal += group.items.length;
      categoryChecked += checked;
      const count = document.querySelector(`[data-gcount="${group.id}"]`);
      if (count) count.textContent = `${checked} / ${group.items.length}`;
      const checkbox = document.querySelector(`[data-group-all="${group.id}"]`);
      if (checkbox) {
        checkbox.checked = group.items.length > 0 && checked === group.items.length;
        checkbox.indeterminate = checked > 0 && checked < group.items.length;
      }
    });
    grandTotal += categoryTotal;
    grandChecked += categoryChecked;
    const tabCount = document.querySelector(`[data-tabcount="${category.id}"]`);
    if (tabCount) tabCount.textContent = `${categoryChecked}/${categoryTotal}`;
  });
  document.getElementById('grandTotal').textContent = `${grandChecked} / ${grandTotal}`;
  document.getElementById('progressBar').style.width = `${grandTotal ? Math.round(grandChecked / grandTotal * 100) : 0}%`;
}

export function setActiveTab(categoryId) {
  document.querySelectorAll('.panel').forEach((panel) => { panel.hidden = panel.id !== `panel-${categoryId}`; });
  document.querySelectorAll('.tabbtn').forEach((button) => { button.classList.toggle('active', button.dataset.tab === categoryId); });
}
