# Edition production workflow

## Production contract

**Input:** a theme plus optional audience, locale, tone and sensitivity requirements.

**Output:** a tested Seven Seconds edition and its published GitHub repository link.

## Steps

1. Define the theme, intended players, locale and boundaries.
2. Research the theme when current or specialist knowledge affects coverage.
3. Build a category map representing the theme broadly.
4. Generate 220–250 candidate prompts.
5. Remove weak, unsafe, ambiguous and near-duplicate prompts.
6. Select and edit exactly 150 prompts using `PROMPT_QUALITY.md`.
7. Create an original portrait background with clear space behind the controls.
8. Copy this master template into a new repository.
9. Replace only `theme.json`, `prompts.csv` and `assets/background.png`.
10. Run `node scripts/validate-edition.mjs`.
11. Test timer, audio, prompt shuffling, sharing and mobile layout.
12. Publish and return the repository and live-game links.

Engine changes belong in the master template first and should be propagated deliberately to existing editions.
