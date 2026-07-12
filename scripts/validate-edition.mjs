import { readFile, access } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const errors = [];
const theme = JSON.parse(await readFile(path.join(root, "theme.json"), "utf8"));
const required = ["id", "title", "theme", "description", "audience", "locale", "promptsFile", "backgroundImage", "backgroundTitle", "brandCharacter", "accentColor", "timerSeconds", "shareText"];

for (const field of required) {
  if (theme[field] === undefined || theme[field] === "") errors.push(`theme.json is missing ${field}.`);
}

for (const asset of [theme.promptsFile, theme.backgroundImage, "assets/go.mp3", "assets/ding.mp3"]) {
  try { await access(path.join(root, asset)); }
  catch { errors.push(`Missing required file: ${asset}`); }
}

const csv = await readFile(path.join(root, theme.promptsFile), "utf8");
const prompts = csv.replace(/^\uFEFF/, "").split(/\r?\n/).slice(1)
  .map((line) => line.trim().replace(/^"|"$/g, "").replace(/""/g, '"'))
  .filter(Boolean);

if (prompts.length !== 150) errors.push(`Expected 150 prompts; found ${prompts.length}.`);

const normalized = prompts.map((prompt) => prompt.toLocaleLowerCase("en").replace(/[^a-z0-9]+/g, " ").trim());
const duplicates = normalized.filter((prompt, index) => normalized.indexOf(prompt) !== index);
if (duplicates.length) errors.push(`Found ${new Set(duplicates).size} duplicate prompt(s).`);

const malformed = prompts.filter((prompt) => !/^Name 3\b/i.test(prompt));
if (malformed.length) errors.push(`${malformed.length} prompt(s) do not start with “Name 3”.`);
if (Number(theme.timerSeconds) !== 7) errors.push("timerSeconds must be 7.");

if (errors.length) {
  console.error("Edition validation failed:\n- " + errors.join("\n- "));
  process.exit(1);
}

console.log(`Edition valid: ${theme.title} (${prompts.length} unique prompts).`);
