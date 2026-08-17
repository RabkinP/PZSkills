import { dictionaryValue, gameDictionaryValue, getSupportedLanguages, localized, t } from './i18n.js';
import { makeItemKey } from './utils.js';

const RECIPE_SKILLS = {
  SmithingMag: 'Blacksmith', CookingMag: 'Cooking', ElectronicsMag: 'Electricity', FarmingMag: 'Farming',
  FishingMag: 'Fishing', GlassmakingMag: 'Glassmaking', MechanicMag: 'Mechanics', MetalworkMag: 'MetalWelding',
  TailoringMag: 'Tailoring', HuntingMag: 'Trapping'
};

export function skillName(skill, language) {
  return gameDictionaryValue(language, 'skills', skill) || dictionaryValue(language, 'skills', skill);
}

export function recipeName(recipe, language) {
  return gameDictionaryValue(language, 'recipes', recipe) || recipe;
}

export function itemRecipes(item) {
  return item.recipes ?? (item.effects ?? [])
    .filter((effect) => effect.type === 'recipe')
    .map((effect) => effect.recipe);
}

export function groupLabel(group, language) {
  if (!group) return '';
  if (group.kind === 'skill') return skillName(group.key, language);
  if (group.kind === 'recipeFamily') return dictionaryValue(language, 'recipeGroups', group.key);
  if (group.kind === 'mediaSeries') return localized(group.names, language);
  if (group.kind === 'mediaCategory') return dictionaryValue(language, 'mediaGroups', group.key);
  return group.key;
}

export function normalizeCatalog(categories) {
  const items = [];
  for (const [categoryOrder, category] of categories.entries()) {
    for (const [sourceGroupOrder, group] of category.groups.entries()) {
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

        items.push({
          ...item,
          categoryId: category.id,
          categoryIcon: category.icon,
          categoryOrder,
          sourceGroup: group,
          sourceGroupOrder,
          skills: [...skills],
          effectTypes: [...effectTypes],
          key: makeItemKey(category.id, item.id)
        });
      }
    }
  }
  return items;
}

export function itemSearchText(item, language) {
  const parts = [item.id, item.sourceId, ...Object.values(item.names ?? {}), ...item.skills, ...item.effectTypes];
  for (const skill of item.skills) for (const lang of getSupportedLanguages()) parts.push(skillName(skill, lang));
  for (const recipe of itemRecipes(item)) for (const lang of getSupportedLanguages()) parts.push(recipe, recipeName(recipe, lang));
  for (const effect of item.effects ?? []) parts.push(effect.type, effect.skill, effect.recipe, effect.status, effect.code);
  parts.push(groupLabel(item.sourceGroup, language));
  return parts.filter(Boolean).join(' ').toLowerCase();
}

export function effectChips(item, language) {
  const chips = [];
  if (item.categoryId === 'books') {
    chips.push({ type: 'xp', text: t(language, 'xpBoost', { skill: skillName(item.skill, language) }) });
    chips.push({ type: 'type', text: t(language, 'levels', { from: item.levelFrom, to: item.levelTo }) });
  }
  for (const skill of item.skills) {
    const hasXp = (item.effects ?? []).some((effect) => effect.type === 'skillXp' && effect.skill === skill);
    if (hasXp) chips.push({ type: 'xp', text: t(language, 'skillXp', { skill: skillName(skill, language) }) });
  }
  const recipes = itemRecipes(item);
  if (recipes.length) chips.push({ type: 'recipe', text: t(language, 'recipesCount', { count: recipes.length }) });
  for (const effect of item.effects ?? []) {
    if (effect.type !== 'status') continue;
    const status = dictionaryValue(language, 'statuses', effect.status);
    chips.push({ type: 'other', text: t(language, effect.amount >= 0 ? 'statusIncrease' : 'statusDecrease', { status, amount: effect.amount }) });
  }
  if (item.categoryId === 'vhs') chips.push({ type: 'type', text: item.category === 'Home-VHS' ? t(language, 'homeVhs') : t(language, 'retailVhs') });
  return chips;
}
