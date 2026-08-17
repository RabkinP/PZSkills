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

Search text and temporary skill/effect selections are intentionally not persisted. Older v1, v2, and v3 checklist states are migrated automatically. Progress and persisted preferences can also be exported to JSON and imported later.

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

Run:

```bash
npm run build:data
npm run check
```

There are no npm runtime dependencies.

## Translation architecture

Project Zomboid localization data is treated as game data, not as website UI text.

The build recursively scans **all JSON files** under every `gamedata/translate/<language>/` directory. It does not require localization files to keep names such as `Recipes.json`, `ItemName.json`, or `IG_UI.json`.

Localization lookup is deliberately strict:

```text
localization domain + exact key → translated value
```

The build does **not** use:

- fuzzy matching;
- case-insensitive key matching;
- punctuation stripping;
- underscore/dash normalization;
- module-prefix removal as a generic lookup rule.

This is intentional. Project Zomboid uses exact identifiers from Java/Lua data, and a similar-looking localization key must not be silently treated as the same object.

### Localization domains

The same exact key can legitimately exist in different game translation tables with different values. For example, a recipe key may also occur in moveable-object translations. Therefore the build does not create one global `key → value` map.

Instead it identifies the relevant localization domains (items, recipes, skills, recorded media) by exact anchor keys. File names are not part of the lookup contract. If an incomplete locale does not contain all anchors, the build identifies its corresponding domain file by the unique highest overlap of **exact keys** with the English domain. Translation lookup inside the selected domain remains exact and case-sensitive.

This means renaming `Recipes.json` or `ItemName.json` does not break the build as long as the localization keys themselves remain valid.

### Domain-specific mappings

If Project Zomboid source data uses one identifier but the recipe localization table uses a different exact key, the mapping must be explicit and reviewed. These mappings live in:

```text
scripts/lib/recipe-translations.mjs
```

No generic normalization is applied.

At the moment the catalog resolves recipe translations as:

```text
392 exact references
4 explicit mappings
1 known unresolved reference: MakeSlugTrap
```

`MakeSlugTrap` has no localization key in the supplied game translation data and is explicitly allowlisted as unresolved. Any new unresolved recipe reference fails the build until reviewed.

### Generated game dictionaries

Game-derived localized names are generated into:

```text
generated/dictionaries.json
```

It currently contains:

- official Project Zomboid skill names from the game localization data;
- localized names for all recipes referenced by the tracker.

Website UI locale files no longer need to duplicate skill or recipe names.

## UI localization

Website-specific UI text is separate from game translations:

```text
locales/<language>.json
```

Locale files may be partial. Missing UI keys fall back to `locales/en.json`.

`meta` supports:

```json
{
  "meta": {
    "name": "Language name",
    "showEnglishSecondary": true,
    "direction": "ltr"
  }
}
```

- `name` controls the label in the language selector.
- `showEnglishSecondary` controls whether English game names are shown below the selected translation.
- `direction: "rtl"` enables right-to-left layout.

Adding or replacing game localization files does not require JavaScript changes.

## Project structure

```text
.
├── gamedata/                 Copied Project Zomboid source data
├── generated/                Generated normalized catalog and game dictionaries
├── locales/                  Website UI dictionaries only
├── scripts/
│   ├── build-data.mjs        Catalog generation and strict localization resolution
│   ├── check.mjs             Generated-data and locale validation
│   └── lib/
│       ├── translation-index.mjs
│       ├── recipe-translations.mjs
│       ├── items-parser.mjs
│       ├── media-parser.mjs
│       └── effects.mjs
├── js/
│   ├── app.js                Application state, UI orchestration, and events
│   ├── catalog.js            Normalized catalog helpers and semantic metadata
│   ├── filters.js            Faceted filtering and sorting
│   ├── i18n.js               Runtime UI/game localization helpers
│   ├── state.js              Persistence, migration, import, and export
│   └── utils.js              Shared utility functions
├── css/main.css              Responsive application styles
└── index.html                Static application shell
```

## Updating after a Project Zomboid update

Replace the copied files under `gamedata/`, then rebuild:

```bash
npm run build:data
npm run check
```

The generator is deliberately strict. New unknown media codes, new unresolved recipe localization references, missing required English localization keys, or incompatible source structures fail the build instead of silently publishing incorrect data.

The included GitHub Pages workflow rebuilds, validates, and deploys the site on push.
