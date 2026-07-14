"use strict";
const test = require("node:test");
const assert = require("node:assert");
const { parseYouTubeUrl, formatTime, findSnippet } = require("../helpers.js");

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
