// Explicit Project Zomboid recipe-reference -> recipe-localization-key mappings.
// Lookup is strict and case-sensitive. Do not add generic normalization here.
export const RECIPE_TRANSLATION_KEYS = {
  'base:assemble_shoulder_armor': 'Assemble_Shoulder_Armor',
  'base:kitchentools': 'KitchenTools',
  'base:makebulletprooflimbarmor': 'MakeBulletproofLimbArmor',
  'base:makemagazinearmor': 'MakeMagazineArmor'
};

export function recipeTranslationKey(recipeReference, indexes, recipeDomainFiles, languages) {
  if (languages.some((language) => indexes[language].hasExactInFile(recipeDomainFiles[language], recipeReference))) {
    return { key: recipeReference, strategy: 'exact' };
  }

  const explicitKey = RECIPE_TRANSLATION_KEYS[recipeReference];
  if (explicitKey) {
    if (!languages.some((language) => indexes[language].hasExactInFile(recipeDomainFiles[language], explicitKey))) {
      throw new Error(`Configured recipe translation key '${explicitKey}' for '${recipeReference}' does not exist in the recipe localization domain`);
    }
    return { key: explicitKey, strategy: 'explicit' };
  }

  return { key: recipeReference, strategy: 'unresolved' };
}

export function readableRecipeFallback(recipeReference) {
  return recipeReference
    .replace(/^base:/, '')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
