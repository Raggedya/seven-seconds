# Seven Seconds master template

Seven Seconds is a lightweight mobile-first browser game with three choices:

- **Name 3** — open-ended conversation prompts with no displayed answer.
- **Quick Quiz** — factual questions with answers revealed after the seven-second timer.
- **Mixed Game** — one no-repeat shuffled deck containing both item types.

Every round retains the Go sound, seven-second countdown and finishing bell. The audio implementation uses Web Audio with an HTML Audio fallback and unlocks directly from the player’s Start Timer tap.

## Edition content

Each edition keeps content outside the engine:

1. `theme.json` — title, audience, sharing text, accent colour and asset paths.
2. `name3-prompts.csv` — one `prompt` column; every row starts with `Name 3`.
3. `quiz-questions.csv` — `question,answer,reference` columns; reference is optional.
4. `assets/background.png` — the existing portrait background designed around the interface safe area.

The engine lives in `game-engine.js` and `script.js`. The existing `assets/go.mp3` and `assets/ding.mp3` files must not be replaced without deliberate audio testing.

## Validate and test

```text
node scripts/validate-edition.mjs
node scripts/test-game.mjs
node --check game-engine.js
node --check script.js
```

See `docs/EDITION_WORKFLOW.md` for production and `docs/PROMPT_QUALITY.md` for editorial acceptance.
