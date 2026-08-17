# Project Zomboid Checklist

A multilingual checklist for Project Zomboid skill books, recipe magazines, and VHS tapes.

The website is a static GitHub Pages application. Checklist content is generated from copied Project Zomboid game files during the build, so normal game updates do not require editing the frontend or generated catalog by hand.

## Architecture

```text
gamedata/                 Project Zomboid source files
    ↓
scripts/build-data.mjs    Parse, normalize and validate
    ↓
generated/*.json          Frontend-ready catalog
    ↓
js/ + locales/            Static multilingual frontend
    ↓
GitHub Pages
```

The browser never parses Project Zomboid files directly. It only downloads normalized JSON from `generated/`.

## Updating after a Project Zomboid update

Replace the copied files inside `gamedata/` with fresh versions from the game installation and push the changes.

The GitHub Pages workflow automatically:

1. parses the game files;
2. validates the parsed structure;
3. generates `generated/books.json`, `generated/recipe-sources.json`, `generated/vhs.json`, and `generated/manifest.json`;
4. builds the static Pages artifact;
5. deploys it.

For a local rebuild:

```bash
npm run build:data
npm run check
```

No npm dependencies are required; Node.js is used only as the build runtime.

## Game data inputs

The current parser reads:

```text
gamedata/
├── items/
│   ├── literature.txt
│   └── normal.txt
├── recorded_media.lua
└── translate/
    ├── en/
    │   ├── ItemName.json
    │   └── Recorded_Media.json
    └── ru/
        ├── ItemName.json
        └── Recorded_Media.json
```

`literature.txt` is the source of skill books and recipe magazines. `recorded_media.lua` is the source of concrete recorded-media entries and their effect codes. Translation files provide localized game names.

`normal.txt` is currently used only as a structural sanity check for the expected VHS parent item definitions.

## Generated data

Generated files are JSON rather than JavaScript modules. The frontend does not know about Project Zomboid fields such as `DisplayCategory`, `LearnedRecipes`, or recorded-media code syntax.

The generated model stores semantic information, for example:

```json
{
  "id": "Base.BookCarpentry1",
  "names": {
    "en": "Carpentry I: ...",
    "ru": "Localized book title ..."
  },
  "skill": "Carpentry",
  "levelFrom": 1,
  "levelTo": 2
}
```

VHS effects are normalized into structures such as:

```json
{ "type": "skillXp", "skill": "Carpentry", "amount": 1 }
```

or:

```json
{ "type": "recipe", "recipe": "CraftMakeshiftRadio" }
```

This keeps presentation and localization separate from the game parser.

## Adding another language

No JavaScript changes are required to add a language.

For a language code such as `de`:

1. create `gamedata/translate/de/`;
2. copy the game's `ItemName.json` and `Recorded_Media.json` into it;
3. create `locales/de.json` using `locales/en.json` as the schema;
4. run `npm run build:data`.

The build discovers complete languages automatically and writes them to `generated/manifest.json`. The language selector is populated from that manifest at runtime.

Game item and VHS names come from Project Zomboid translation files. Website-specific strings, skill labels, group labels, status names, and optional friendly recipe labels come from `locales/<lang>.json`.

If a friendly recipe label is missing, the UI falls back to a human-readable form of the internal recipe identifier. This means newly added recipes still appear automatically even before an optional presentation translation is added.

Each locale may set:

```json
{
  "meta": {
    "name": "German",
    "showEnglishSecondary": true
  }
}
```

When `showEnglishSecondary` is enabled, English game names and descriptions are shown below the selected language, matching the current Russian presentation.

## User progress

Progress is stored only in browser `localStorage` and is not included in generated catalog files.

Users can also export and import their progress as JSON. The selected language and per-category `Hide found` settings are included in the exported state.

The current implementation remains compatible with previous `pzChecklistState_v1`, `v2`, and `v3` browser state formats.

## Parser maintenance

The build intentionally fails when a major expected source structure disappears instead of silently publishing an empty checklist.

Recorded-media skill codes are mapped in `scripts/config.mjs`. If Project Zomboid introduces a new effect code, it is preserved as an unknown effect and reported by build diagnostics so the mapping can be updated deliberately.

Recipe magazine grouping is derived from item IDs. Known families receive translated display labels from `locales/<lang>.json`; an unknown future family still appears using its source family identifier.
