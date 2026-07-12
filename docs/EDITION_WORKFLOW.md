# Edition production workflow

## Production contract

**Input:** a theme plus optional audience, locale, tone and sensitivity requirements.

**Output:** a tested Seven Seconds edition and its published GitHub repository link.

## Steps

1. Define the theme, intended players, locale and boundaries.
2. Research the theme when current or specialist knowledge affects coverage or factual quiz answers.
3. Build a category map representing the theme broadly.
4. Write and edit the Name 3 library in `name3-prompts.csv`.
5. Write and fact-check the Quick Quiz library in `quiz-questions.csv`; include accepted answers and a useful reference or explanatory note where appropriate.
6. Remove weak, unsafe, ambiguous and near-duplicate content using `PROMPT_QUALITY.md`.
7. Use the existing portrait background and Aggits identity. For a themed edition, only use an approved background carrying the exact edition title `Seven Seconds - [Theme]` and a clear central interface area.
8. Copy this master template into a new repository.
9. Update `theme.json`, the two content CSVs and only the edition-specific approved background.
10. Run `node scripts/validate-edition.mjs` and `node scripts/test-game.mjs`.
11. Test all modes, timer, audio, answer reveal, no-repeat decks, sharing and short-screen mobile layout.
12. Publish and return the repository and live-game links.

Engine changes belong in the master template first and should be propagated deliberately to existing editions.
