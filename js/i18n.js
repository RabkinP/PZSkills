export const DEFAULT_LANGUAGE = 'en';

let locales = {};
let supportedLanguages = [DEFAULT_LANGUAGE];

const LANGUAGE_TAG_ALIASES = {
  ch: 'zh-TW',
  cn: 'zh-CN',
  jp: 'ja',
  ko: 'ko',
  ptbr: 'pt-BR',
  ua: 'uk'
};

function toLanguageTag(language) {
  return LANGUAGE_TAG_ALIASES[language] ?? language.replaceAll('_', '-');
}

async function tryLoadLocale(language) {
  try {
    const response = await fetch(`./locales/${language}.json`);
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

export async function loadLocales(languages, uiLanguages = [DEFAULT_LANGUAGE]) {
  supportedLanguages = Array.isArray(languages) && languages.length ? languages : [DEFAULT_LANGUAGE];
  const availableUiLanguages = new Set(Array.isArray(uiLanguages) ? uiLanguages : [DEFAULT_LANGUAGE]);

  const english = await tryLoadLocale(DEFAULT_LANGUAGE);
  if (!english) throw new Error('English locale is required');

  locales = { [DEFAULT_LANGUAGE]: english };
  const optionalLanguages = supportedLanguages.filter((language) => language !== DEFAULT_LANGUAGE && availableUiLanguages.has(language));
  const entries = await Promise.all(optionalLanguages.map(async (language) => [language, await tryLoadLocale(language)]));

  for (const [language, locale] of entries) {
    if (locale) locales[language] = locale;
  }
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
  const normalized = normalizeLanguage(language);
  if (normalized === DEFAULT_LANGUAGE) return false;

  // Languages without a website UI locale still use their game translation as
  // primary content, with English as a useful secondary label by default.
  return locales[normalized]?.meta?.showEnglishSecondary ?? true;
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
  if (locales[language]?.meta?.name) return locales[language].meta.name;

  try {
    const tag = toLanguageTag(language);
    const displayNames = new Intl.DisplayNames([tag], { type: 'language' });
    return displayNames.of(tag) ?? language.toUpperCase();
  } catch {
    return language.toUpperCase();
  }
}
