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
