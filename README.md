# Project Zomboid Collection Tracker

A static, multilingual collection tracker for Project Zomboid skill books, recipe sources, and gameplay-relevant VHS tapes.

The catalog is generated from copied Project Zomboid game data. The browser UI consumes normalized JSON and does not depend on the original game-file format.

## UI features

- Responsive desktop and mobile layout.
- Global search across names, game IDs, skills, recipes, and effects.
- `All`, `Skill Books`, `Recipe Sources`, and `VHS Tapes` catalog views.
- Status filter: `All`, `Missing`, or `Found`.
- Multi-select skill filters.
- Effect filters for XP / XP boosts, recipes, and other gameplay effects.
- Grouping by default game-data groups, skill, effect, content type, or no grouping.
- Sorting by name, game ID, missing-first, or found-first.
- Expand/collapse all grouped results.
- Active-filter chips with one-click removal.
- Semantic metadata chips on item cards.
- Recipe lists can be expanded directly from relevant cards.
- Found items use a collection-state treatment instead of todo-style strikethrough text.
- Desktop filter sidebar and mobile filter drawer.
- `/` keyboard shortcut focuses global search.
- Light/dark appearance follows the operating-system preference.

## Progress and preferences

Progress is stored automatically in `localStorage` under `pzChecklistState_v4`.

The persisted state contains stable user preferences and collection progress:

```json
{
  "version": 4,
  "found": {},
  "settings": {
    "language": "en",
    "activeCategory": "all",
    "status": "all",
    "grouping": "default",
    "sort": "name"
  }
}
```

Search text and temporary skill/effect selections are intentionally not persisted. This prevents a returning user from opening the site with an unexpectedly narrow or empty result set.

Older v1, v2, and v3 checklist states are migrated automatically. Progress and persisted preferences can also be exported to JSON and imported later.

## Data pipeline

```text
gamedata/
    ↓
scripts/build-data.mjs
    ↓
generated/*.json
    ↓
static frontend
```

The build reads Project Zomboid item definitions, recorded-media definitions, and game translations. It validates expected source structures and produces normalized JSON for the frontend.

Run:

```bash
npm run build:data
npm run check
```

There are no npm runtime dependencies.

## Project structure

```text
.
├── gamedata/                 Copied Project Zomboid source data
├── generated/                Generated normalized catalog JSON
├── locales/                  UI dictionaries and site-specific translations
├── scripts/                  Parsers, validation, and data generation
├── js/
│   ├── app.js                Application state, UI orchestration, and events
│   ├── catalog.js            Normalized catalog helpers and semantic metadata
│   ├── filters.js            Faceted filtering and sorting
│   ├── i18n.js               Runtime localization helpers
│   ├── state.js              Persistence, migration, import, and export
│   └── utils.js              Shared utility functions
├── css/main.css              Responsive application styles
└── index.html                Static application shell
```

## Adding another language

Localization is intentionally separated into two layers.

Game-provided names come from:

```text
gamedata/translate/<language>/ItemName.json
gamedata/translate/<language>/Recorded_Media.json
```

Site UI text comes from:

```text
locales/<language>.json
```

A language becomes available whenever the build finds both required game translation files. Project Zomboid locale directory names are matched case-insensitively, so directories such as `DE`, `ES_MX`, and `PTBR` are supported without renaming them.

A matching `locales/<language>.json` file is optional. If it is missing, the website UI falls back to English while catalog names still use the selected game translation. Missing individual game translation strings also fall back to their English game values. JavaScript changes are not required for an additional language.

`locales/<language>.json` can optionally set:

```json
{
  "meta": {
    "name": "Language name",
    "showEnglishSecondary": true
  }
}
```

When `showEnglishSecondary` is enabled, localized catalog names can display the English game name as secondary information.

## Updating after a Project Zomboid update

Replace the copied files under `gamedata/`, then rebuild the generated catalog. The parser is deliberately strict around important source structures so that an incompatible game-data change fails the build instead of silently publishing an incomplete catalog.

The included GitHub Pages workflow rebuilds, validates, and deploys the site on push.

## UI localization

The site UI is localized independently from Project Zomboid item/media translations.

- Game translations live in `gamedata/translate/<GAME_LANGUAGE>/`.
- Website UI translations live in `locales/<language>.json`.
- Locale files may be partial. Missing UI dictionary keys fall back to `locales/en.json`.
- `meta.name` controls the language name shown in the selector.
- `meta.showEnglishSecondary` controls whether English item names are shown below the selected game translation.
- `meta.direction: "rtl"` enables right-to-left layout for languages such as Arabic.

`scripts/check.mjs` reports UI-key coverage for every enabled locale and verifies that all generated catalog items contain every game language listed in the manifest.
