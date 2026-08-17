# gamedata — Project Zomboid source files

These files are copied from a Project Zomboid installation and are used by the build script to generate the website catalog. After a game update, replace the files with fresh copies from the same game paths and rebuild the data.

## Files and original game paths

| File | Path in the game | Purpose |
|---|---|---|
| `items/literature.txt` | `media/scripts/generated/items/literature.txt` | Literature items, including skill books and recipe resources |
| `items/normal.txt` | `media/scripts/generated/items/normal.txt` | Parent VHS item definitions used for structural validation |
| `recorded_media.lua` | `media/lua/shared/RecordedMedia/recorded_media.lua` | Concrete recorded-media entries, categories and effect codes |
| `translate/<LANG>/ItemName.json` | `media/lua/shared/Translate/<LANG>/ItemName.json` | Localized item names for books and magazines |
| `translate/<LANG>/Recorded_Media.json` | `media/lua/shared/Translate/<LANG>/Recorded_Media.json` | Localized recorded-media names and text |

## What the generator extracts

### Skill books

Items with `DisplayCategory = SkillBook` are parsed from `literature.txt`. The generator reads `SkillTrained`, `LvlSkillTrained`, and `NumLevelsTrained`, then resolves localized names through `ItemName.json`.

### Recipe magazines

Recipe resources are parsed from the same file. The checklist intentionally includes magazine-tagged recipe resources plus the `RadioMag*` entries. Seed packets and other non-magazine recipe resources are not treated as checklist magazines.

The authoritative learned-recipe list is taken from `LearnedRecipes`.

### VHS

`recorded_media.lua` is parsed into concrete Retail VHS and Home VHS records. Relevant entries are selected when they teach a skill or recipe. The exceptional harmful tape `The Dog Goblin` is also included.

Recorded-media effect codes are normalized by the build script. Skill-code mappings live in `scripts/config.mjs` because the source file stores compact codes rather than full skill names.

## Adding translations

Add another `translate/<lang>/` directory containing both required game translation JSON files. A matching website locale must also exist at `locales/<lang>.json`; incomplete languages are skipped with a build warning rather than partially exposed in the UI.
