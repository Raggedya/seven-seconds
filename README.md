# Seven Seconds master template

Seven Seconds is a lightweight browser game. A player sees a “Name 3” prompt and has seven seconds to respond before the bell sounds.

## Create a themed edition

Each edition changes only:

1. `theme.json` — title, audience, sharing text, accent colour and asset paths.
2. `prompts.csv` — exactly 150 reviewed, unique prompts.
3. `assets/background.png` — an original portrait background designed around the interface safe area.

The game engine, interface and audio assets remain unchanged unless an improvement is intended for every edition.

See [`docs/EDITION_WORKFLOW.md`](docs/EDITION_WORKFLOW.md) for production and [`docs/PROMPT_QUALITY.md`](docs/PROMPT_QUALITY.md) for editorial acceptance.

## Validate an edition

Run `node scripts/validate-edition.mjs`. It checks configuration, asset paths, prompt count, duplicates and basic prompt form before publication.
