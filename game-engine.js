(function exposeSevenSecondsEngine(globalScope) {
  "use strict";

  function parseCSV(text) {
    const rows = [];
    let row = [];
    let field = "";
    let quoted = false;

    const source = String(text).replace(/^\uFEFF/, "");
    for (let index = 0; index < source.length; index += 1) {
      const character = source[index];

      if (quoted) {
        if (character === '"' && source[index + 1] === '"') {
          field += '"';
          index += 1;
        } else if (character === '"') {
          quoted = false;
        } else {
          field += character;
        }
      } else if (character === '"') {
        quoted = true;
      } else if (character === ",") {
        row.push(field.trim());
        field = "";
      } else if (character === "\n") {
        row.push(field.trim());
        if (row.some(Boolean)) rows.push(row);
        row = [];
        field = "";
      } else if (character !== "\r") {
        field += character;
      }
    }

    if (quoted) throw new Error("CSV contains an unclosed quotation mark.");
    row.push(field.trim());
    if (row.some(Boolean)) rows.push(row);
    return rows;
  }

  function rowsToObjects(text) {
    const rows = parseCSV(text);
    if (!rows.length) return [];
    const headers = rows.shift().map((header) => header.trim().toLowerCase());
    return rows.map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] || ""])));
  }

  function shuffle(items, random = Math.random) {
    const result = [...items];
    for (let index = result.length - 1; index > 0; index -= 1) {
      const randomIndex = Math.floor(random() * (index + 1));
      [result[index], result[randomIndex]] = [result[randomIndex], result[index]];
    }
    return result;
  }

  class NoRepeatDeck {
    constructor(items, random = Math.random) {
      if (!Array.isArray(items) || !items.length) throw new Error("A deck needs at least one item.");
      this.items = [...items];
      this.random = random;
      this.deck = [];
    }

    next() {
      if (!this.deck.length) this.deck = shuffle(this.items, this.random);
      return this.deck.pop();
    }

    reset() {
      this.deck = [];
    }
  }

  globalScope.SevenSecondsEngine = { parseCSV, rowsToObjects, shuffle, NoRepeatDeck };
})(typeof window !== "undefined" ? window : globalThis);
