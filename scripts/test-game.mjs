import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

await import(pathToFileURL(path.join(process.cwd(), "game-engine.js")));
const { parseCSV, rowsToObjects, NoRepeatDeck } = globalThis.SevenSecondsEngine;

const quotedFixture = 'question,answer,reference\n"A question, with a comma?","The ""quoted"" answer, accepted","A note"\n';
const fixtureRows = rowsToObjects(quotedFixture);
assert.equal(fixtureRows[0].question, "A question, with a comma?");
assert.equal(fixtureRows[0].answer, 'The "quoted" answer, accepted');

const name3Text = await readFile("name3-prompts.csv", "utf8");
const quizText = await readFile("quiz-questions.csv", "utf8");
const name3 = rowsToObjects(name3Text).map((row) => ({ type: "name3", prompt: row.prompt }));
const quiz = rowsToObjects(quizText).map((row) => ({ type: "quiz", prompt: row.question, answer: row.answer }));

for (const row of name3) assert.match(row.prompt, /^Name 3\b/i);
for (const row of quiz) assert.ok(row.answer.trim());

for (const [label, items] of [["name3", name3], ["quiz", quiz], ["mixed", [...name3, ...quiz]]]) {
  const deck = new NoRepeatDeck(items, () => 0.417);
  const firstCycle = Array.from({ length: items.length }, () => deck.next());
  assert.equal(new Set(firstCycle.map((item) => `${item.type}:${item.prompt}`)).size, items.length, `${label} repeated before exhaustion`);
  assert.ok(deck.next(), `${label} did not refill after exhaustion`);
}

assert.equal(parseCSV(name3Text).length - 1, name3.length);
assert.equal(parseCSV(quizText).length - 1, quiz.length);
console.log(`Game engine tests passed (${name3.length} Name 3; ${quiz.length} quiz; ${name3.length + quiz.length} mixed).`);
