export const DEFAULT_LANGUAGE = 'en';

let locales = {};
let supportedLanguages = [DEFAULT_LANGUAGE];

export async function loadLocales(languages) {
  supportedLanguages = Array.isArray(languages) && languages.length ? languages : [DEFAULT_LANGUAGE];
  const entries = await Promise.all(supportedLanguages.map(async (language) => {
    const response = await fetch(`./locales/${language}.json`);
    if (!response.ok) throw new Error(`Could not load locale '${language}'`);
    return [language, await response.json()];
  }));
  locales = Object.fromEntries(entries);
  if (!locales[DEFAULT_LANGUAGE]) throw new Error('English locale is required');
}

export function getSupportedLanguages() {
  return [...supportedLanguages];
}

export function getLocale(language) {
  return locales[normalizeLanguage(language)] ?? locales[DEFAULT_LANGUAGE];
}

export function normalizeLanguage(language) {
  return supportedLanguages.includes(language) ? language : DEFAULT_LANGUAGE;
}

export function localized(value, language) {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  const normalized = normalizeLanguage(language);
  return value[normalized] || value[DEFAULT_LANGUAGE] || Object.values(value)[0] || '';
}

export function shouldShowEnglishSecondary(language) {
  if (normalizeLanguage(language) === DEFAULT_LANGUAGE) return false;
  return Boolean(getLocale(language)?.meta?.showEnglishSecondary);
}

export function englishSecondary(value, language) {
  if (!shouldShowEnglishSecondary(language) || !value || typeof value === 'string') return '';
  const primary = localized(value, language);
  const english = localized(value, DEFAULT_LANGUAGE);
  return english && english !== primary ? english : '';
}

export function t(language, key, params = {}) {
  const locale = getLocale(language);
  let value = locale?.ui?.[key] ?? locales[DEFAULT_LANGUAGE]?.ui?.[key] ?? key;
  for (const [name, replacement] of Object.entries(params)) {
    value = value.replaceAll(`{${name}}`, String(replacement));
  }
  return value;
}

export function dictionaryValue(language, section, key) {
  const locale = getLocale(language);
  return locale?.[section]?.[key] ?? locales[DEFAULT_LANGUAGE]?.[section]?.[key] ?? key;
}

export function languageName(language) {
  return locales[language]?.meta?.name ?? language.toUpperCase();
}
