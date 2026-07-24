"use strict";
const test = require("node:test");
const assert = require("node:assert");
const {
  parseYouTubeUrl,
  formatTime,
  findSnippet,
  findSnippetsInRange,
} = require("../extension/app/helpers.js");

test("parseYouTubeUrl accepts watch URLs", () => {
  assert.strictEqual(
    parseYouTubeUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ"),
    "dQw4w9WgXcQ"
  );
});

test("parseYouTubeUrl accepts watch URLs with extra params", () => {
  assert.strictEqual(
    parseYouTubeUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42s&list=PL123"),
    "dQw4w9WgXcQ"
  );
});

test("parseYouTubeUrl accepts youtu.be URLs", () => {
  assert.strictEqual(
    parseYouTubeUrl("https://youtu.be/dQw4w9WgXcQ?si=abc"),
    "dQw4w9WgXcQ"
  );
});

test("parseYouTubeUrl accepts shorts and embed URLs", () => {
  assert.strictEqual(
    parseYouTubeUrl("https://www.youtube.com/shorts/dQw4w9WgXcQ"),
    "dQw4w9WgXcQ"
  );
  assert.strictEqual(
    parseYouTubeUrl("https://www.youtube.com/embed/dQw4w9WgXcQ"),
    "dQw4w9WgXcQ"
  );
});

test("parseYouTubeUrl tolerates m. hostname and surrounding whitespace", () => {
  assert.strictEqual(
    parseYouTubeUrl("  https://m.youtube.com/watch?v=dQw4w9WgXcQ  "),
    "dQw4w9WgXcQ"
  );
});

test("parseYouTubeUrl rejects garbage", () => {
  assert.strictEqual(parseYouTubeUrl("not a url"), null);
  assert.strictEqual(parseYouTubeUrl("https://example.com/watch?v=dQw4w9WgXcQ"), null);
  assert.strictEqual(parseYouTubeUrl("https://www.youtube.com/watch?v=short"), null);
  assert.strictEqual(parseYouTubeUrl(""), null);
});

test("formatTime formats minutes and seconds", () => {
  assert.strictEqual(formatTime(0), "0:00");
  assert.strictEqual(formatTime(65.7), "1:05");
  assert.strictEqual(formatTime(599), "9:59");
});

test("formatTime formats hours", () => {
  assert.strictEqual(formatTime(3600), "1:00:00");
  assert.strictEqual(formatTime(3725.2), "1:02:05");
});

const snippets = [
  { start: 1.2, duration: 2.16, text: "here we are" },
  { start: 5.32, duration: 2.66, text: "the cool thing" },
  { start: 7.97, duration: 4.64, text: "long trunks" },
];

test("findSnippet returns the line being spoken at t", () => {
  assert.strictEqual(findSnippet(snippets, 5.32).text, "the cool thing");
  assert.strictEqual(findSnippet(snippets, 6.0).text, "the cool thing");
  assert.strictEqual(findSnippet(snippets, 20).text, "long trunks");
});

test("findSnippet returns the previous line during a gap", () => {
  assert.strictEqual(findSnippet(snippets, 4.5).text, "here we are");
});

test("findSnippet returns null before the first line or without a transcript", () => {
  assert.strictEqual(findSnippet(snippets, 0.5), null);
  assert.strictEqual(findSnippet(null, 5), null);
  assert.strictEqual(findSnippet([], 5), null);
});

test("findSnippetsInRange returns lines that start inside the window", () => {
  assert.deepStrictEqual(
    findSnippetsInRange(snippets, 1.0, 8.5).map((s) => s.text),
    ["here we are", "the cool thing", "long trunks"]
  );
  assert.deepStrictEqual(
    findSnippetsInRange(snippets, 4.5, 8.5).map((s) => s.text),
    ["the cool thing", "long trunks"]
  );
});

test("findSnippetsInRange excludes lines that started before the window", () => {
  // Auto-caption durations often stretch across silence: a line starting at
  // 1.2 must not appear in a window starting at 2.0, even though its nominal
  // duration may overlap it.
  const stretched = [
    { start: 1.2, duration: 6.0, text: "before the window" },
    { start: 5.32, duration: 2.66, text: "inside the window" },
  ];
  assert.deepStrictEqual(
    findSnippetsInRange(stretched, 2.0, 6.0).map((s) => s.text),
    ["inside the window"]
  );
});

test("findSnippetsInRange falls back to the last line before the window", () => {
  const sparse = [{ start: 1, duration: 2, text: "early" }];
  assert.deepStrictEqual(
    findSnippetsInRange(sparse, 50, 55).map((s) => s.text),
    ["early"]
  );
  assert.deepStrictEqual(findSnippetsInRange(sparse, 0, 0.5), []);
  assert.deepStrictEqual(findSnippetsInRange(null, 0, 5), []);
});

