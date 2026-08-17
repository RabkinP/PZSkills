import { dictionaryValue, getLocale, getSupportedLanguages, localized, t } from './i18n.js';
import { makeItemKey } from './utils.js';

const RECIPE_SKILLS = {
  SmithingMag: 'Blacksmith', CookingMag: 'Cooking', ElectronicsMag: 'Electricity', FarmingMag: 'Farming',
  FishingMag: 'Fishing', GlassmakingMag: 'Glassmaking', MechanicMag: 'Mechanics', MetalworkMag: 'MetalWelding',
  TailoringMag: 'Tailoring', HuntingMag: 'Trapping'
};

export function prettifyRecipe(recipe) {
  return recipe.replace(/^base:/i, '').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
}

export function recipeName(recipe, language) {
  return getLocale(language)?.recipes?.[recipe] ?? getLocale('en')?.recipes?.[recipe] ?? prettifyRecipe(recipe);
}

export function groupLabel(group, language) {
  if (!group) return '';
  if (group.kind === 'skill') return dictionaryValue(language, 'skills', group.key);
  if (group.kind === 'recipeFamily') return dictionaryValue(language, 'recipeGroups', group.key);
  if (group.kind === 'mediaSeries') return localized(group.names, language);
  if (group.kind === 'mediaCategory') return dictionaryValue(language, 'mediaGroups', group.key);
  return group.key;
}

export function normalizeCatalog(categories) {
  const items = [];
  for (const category of categories) {
    for (const group of category.groups) {
      for (const item of group.items) {
        const skills = new Set();
        if (item.skill) skills.add(item.skill);
        if (group.kind === 'recipeFamily' && RECIPE_SKILLS[group.key]) skills.add(RECIPE_SKILLS[group.key]);
        for (const effect of item.effects ?? []) if (effect.type === 'skillXp' && effect.skill) skills.add(effect.skill);

        const effectTypes = new Set();
        if (category.id === 'books') effectTypes.add('xp');
        if ((item.recipes ?? []).length) effectTypes.add('recipe');
        for (const effect of item.effects ?? []) {
          if (effect.type === 'skillXp') effectTypes.add('xp');
          else if (effect.type === 'recipe') effectTypes.add('recipe');
          else if (effect.type === 'status') effectTypes.add('other');
        }

        items.push({ ...item, categoryId: category.id, categoryIcon: category.icon, sourceGroup: group, skills: [...skills], effectTypes: [...effectTypes], key: makeItemKey(category.id, item.id) });
      }
    }
  }
  return items;
}

export function itemSearchText(item, language) {
  const parts = [item.id, item.sourceId, ...Object.values(item.names ?? {}), ...item.skills, ...item.effectTypes];
  for (const skill of item.skills) for (const lang of getSupportedLanguages()) parts.push(dictionaryValue(lang, 'skills', skill));
  for (const recipe of item.recipes ?? []) for (const lang of getSupportedLanguages()) parts.push(recipe, recipeName(recipe, lang));
  for (const effect of item.effects ?? []) parts.push(effect.type, effect.skill, effect.recipe, effect.status, effect.code);
  parts.push(groupLabel(item.sourceGroup, language));
  return parts.filter(Boolean).join(' ').toLowerCase();
}

export function effectChips(item, language) {
  const chips = [];
  if (item.categoryId === 'books') {
    chips.push({ type: 'xp', text: t(language, 'xpBoost', { skill: dictionaryValue(language, 'skills', item.skill) }) });
    chips.push({ type: 'type', text: t(language, 'levels', { from: item.levelFrom, to: item.levelTo }) });
  }
  for (const skill of item.skills) {
    const hasXp = (item.effects ?? []).some((effect) => effect.type === 'skillXp' && effect.skill === skill);
    if (hasXp) chips.push({ type: 'xp', text: t(language, 'skillXp', { skill: dictionaryValue(language, 'skills', skill) }) });
  }
  const recipes = item.recipes ?? (item.effects ?? []).filter((effect) => effect.type === 'recipe').map((effect) => effect.recipe);
  if (recipes.length) chips.push({ type: 'recipe', text: t(language, 'recipesCount', { count: recipes.length }) });
  for (const effect of item.effects ?? []) {
    if (effect.type !== 'status') continue;
    const status = dictionaryValue(language, 'statuses', effect.status);
    chips.push({ type: 'other', text: t(language, effect.amount >= 0 ? 'statusIncrease' : 'statusDecrease', { status, amount: effect.amount }) });
  }
  if (item.categoryId === 'vhs') chips.push({ type: 'type', text: item.category === 'Home-VHS' ? t(language, 'homeVhs') : t(language, 'retailVhs') });
  return chips;
}
