"use strict";
const test = require("node:test");
const assert = require("node:assert");
const { createStore, STORAGE_KEY } = require("../store.js");

function fakeStorage(initial) {
  const map = new Map(initial ? [[STORAGE_KEY, initial]] : []);
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    dump: () => map.get(STORAGE_KEY),
  };
}

test("starts with defaults on empty storage", () => {
  const store = createStore(fakeStorage());
  assert.strictEqual(store.state.settings.rewindSeconds, 3);
  assert.strictEqual(store.state.lastVideoId, null);
  assert.deepStrictEqual(store.state.videos, {});
});

test("starts with defaults on corrupt JSON", () => {
  const store = createStore(fakeStorage("{not json"));
  assert.strictEqual(store.state.settings.rewindSeconds, 3);
});

test("addTimestamp keeps entries sorted and persists", () => {
  const storage = fakeStorage();
  const store = createStore(storage);
  assert.strictEqual(store.addTimestamp("vid00000001", 95), true);
  assert.strictEqual(store.addTimestamp("vid00000001", 12.4), true);
  assert.deepStrictEqual(store.getVideo("vid00000001").timestamps, [12.4, 95]);
  const persisted = JSON.parse(storage.dump());
  assert.deepStrictEqual(persisted.videos.vid00000001.timestamps, [12.4, 95]);
});

test("addTimestamp rejects near-duplicates within 0.5s", () => {
  const store = createStore(fakeStorage());
  assert.strictEqual(store.addTimestamp("vid00000001", 10.0), true);
  assert.strictEqual(store.addTimestamp("vid00000001", 10.4), false);
  assert.strictEqual(store.addTimestamp("vid00000001", 10.6), true);
  assert.deepStrictEqual(store.getVideo("vid00000001").timestamps, [10.0, 10.6]);
});

test("deleteTimestamp removes the entry", () => {
  const store = createStore(fakeStorage());
  store.addTimestamp("vid00000001", 10);
  store.addTimestamp("vid00000001", 20);
  store.deleteTimestamp("vid00000001", 10);
  assert.deepStrictEqual(store.getVideo("vid00000001").timestamps, [20]);
});

test("setLastVideo creates the record and persists", () => {
  const storage = fakeStorage();
  const store = createStore(storage);
  store.setLastVideo("vid00000001");
  assert.strictEqual(store.state.lastVideoId, "vid00000001");
  assert.ok(store.getVideo("vid00000001"));
  const reloaded = createStore(storage);
  assert.strictEqual(reloaded.state.lastVideoId, "vid00000001");
});

test("deleteVideo removes the record and persists", () => {
  const storage = fakeStorage();
  const store = createStore(storage);
  store.addTimestamp("vid00000001", 10);
  store.addTimestamp("vid00000002", 20);
  store.deleteVideo("vid00000001");
  assert.strictEqual(store.getVideo("vid00000001"), null);
  assert.ok(store.getVideo("vid00000002"));
  const reloaded = createStore(storage);
  assert.strictEqual(reloaded.getVideo("vid00000001"), null);
});

test("deleteVideo clears lastVideoId when it pointed at the deleted video", () => {
  const store = createStore(fakeStorage());
  store.setLastVideo("vid00000001");
  store.deleteVideo("vid00000001");
  assert.strictEqual(store.state.lastVideoId, null);
});

test("deleteVideo keeps lastVideoId for other videos", () => {
  const store = createStore(fakeStorage());
  store.setLastVideo("vid00000002");
  store.addTimestamp("vid00000001", 10);
  store.deleteVideo("vid00000001");
  assert.strictEqual(store.state.lastVideoId, "vid00000002");
});

test("mergeVideos adds new videos and unions timestamps without near-duplicates", () => {
  const store = createStore(fakeStorage());
  store.addTimestamp("vid00000001", 10);
  store.mergeVideos({
    vid00000001: { title: "A", timestamps: [10.2, 30], folded: false, updatedAt: "2026-01-01T00:00:00Z" },
    vid00000002: { title: "B", timestamps: [5], folded: true, updatedAt: "2026-01-02T00:00:00Z" },
  });
  assert.deepStrictEqual(store.getVideo("vid00000001").timestamps, [10, 30]);
  assert.deepStrictEqual(store.getVideo("vid00000002").timestamps, [5]);
  assert.strictEqual(store.getVideo("vid00000002").title, "B");
  assert.strictEqual(store.getVideo("vid00000002").folded, true);
});

test("mergeVideos keeps the local title and skips invalid entries", () => {
  const store = createStore(fakeStorage());
  store.setTitle("vid00000001", "Local title");
  store.mergeVideos({
    vid00000001: { title: "Remote title", timestamps: [7, "bad", -3] },
    "bad id": { title: "x", timestamps: [1] },
    vid00000003: { title: "x", timestamps: "nope" },
  });
  assert.strictEqual(store.getVideo("vid00000001").title, "Local title");
  assert.deepStrictEqual(store.getVideo("vid00000001").timestamps, [7]);
  assert.strictEqual(store.getVideo("bad id"), null);
  assert.strictEqual(store.getVideo("vid00000003"), null);
});

test("mergeVideos persists and tolerates junk input", () => {
  const storage = fakeStorage();
  const store = createStore(storage);
  store.mergeVideos(null);
  store.mergeVideos("junk");
  store.mergeVideos({ vid00000009: { timestamps: [1.5] } });
  const reloaded = createStore(storage);
  assert.deepStrictEqual(reloaded.getVideo("vid00000009").timestamps, [1.5]);
});

test("setTitle, setFolded, setRewindSeconds persist", () => {
  const storage = fakeStorage();
  const store = createStore(storage);
  store.setTitle("vid00000001", "My video");
  store.setFolded("vid00000001", true);
  store.setRewindSeconds(5);
  const reloaded = createStore(storage);
  assert.strictEqual(reloaded.getVideo("vid00000001").title, "My video");
  assert.strictEqual(reloaded.getVideo("vid00000001").folded, true);
  assert.strictEqual(reloaded.state.settings.rewindSeconds, 5);
});
