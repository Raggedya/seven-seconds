import { readFile, access } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

await import(pathToFileURL(path.join(process.cwd(), "game-engine.js")));
const { rowsToObjects } = globalThis.SevenSecondsEngine;
const root = process.cwd();
const errors = [];
const theme = JSON.parse(await readFile(path.join(root, "theme.json"), "utf8"));
const required = ["id", "title", "theme", "description", "audience", "locale", "name3File", "quizFile", "backgroundImage", "backgroundTitle", "brandCharacter", "accentColor", "timerSeconds", "shareText"];

for (const field of required) {
  if (theme[field] === undefined || theme[field] === "") errors.push(`theme.json is missing ${field}.`);
}

for (const asset of [theme.name3File, theme.quizFile, theme.backgroundImage, "assets/go.mp3", "assets/ding.mp3"]) {
  try { await access(path.join(root, asset)); }
  catch { errors.push(`Missing required file: ${asset}`); }
}

async function readRows(file, expectedHeaders) {
  try {
    const text = await readFile(path.join(root, file), "utf8");
    const [header = []] = globalThis.SevenSecondsEngine.parseCSV(text);
    const actualHeaders = header.map((value) => value.toLowerCase());
    if (actualHeaders.join("|") !== expectedHeaders.join("|")) {
      errors.push(`${file} must use columns: ${expectedHeaders.join(", ")}.`);
    }
    return rowsToObjects(text);
  } catch (error) {
    errors.push(`${file} could not be parsed: ${error.message}`);
    return [];
  }
}

const name3Rows = await readRows(theme.name3File, ["prompt"]);
const quizRows = await readRows(theme.quizFile, ["question", "answer", "reference"]);

if (!name3Rows.length) errors.push("The Name 3 library is empty.");
if (!quizRows.length) errors.push("The Quick Quiz library is empty.");

const malformedName3 = name3Rows.filter((row) => !/^Name 3\b/i.test(row.prompt || ""));
if (malformedName3.length) errors.push(`${malformedName3.length} Name 3 prompt(s) do not begin with “Name 3”.`);

const missingQuizFields = quizRows.filter((row) => !(row.question || "").trim() || !(row.answer || "").trim());
if (missingQuizFields.length) errors.push(`${missingQuizFields.length} quiz row(s) are missing a question or answer.`);

function reportDuplicates(rows, key, label) {
  const normalized = rows.map((row) => (row[key] || "").toLocaleLowerCase("en").replace(/[^a-z0-9]+/g, " ").trim());
  const duplicates = normalized.filter((value, index) => value && normalized.indexOf(value) !== index);
  if (duplicates.length) errors.push(`${label} contains ${new Set(duplicates).size} duplicate item(s).`);
}

reportDuplicates(name3Rows, "prompt", "Name 3 library");
reportDuplicates(quizRows, "question", "Quick Quiz library");
if (Number(theme.timerSeconds) !== 7) errors.push("timerSeconds must be exactly 7.");

if (errors.length) {
  console.error("Edition validation failed:\n- " + errors.join("\n- "));
  process.exit(1);
}

console.log(`Edition valid: ${theme.title} (${name3Rows.length} Name 3 prompts; ${quizRows.length} quiz questions).`);
