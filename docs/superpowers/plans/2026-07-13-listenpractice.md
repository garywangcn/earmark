# ListenPractice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A single-page website that loads a YouTube video by URL, records timestamps on SPACE, and lets the user click a timestamp to seek back to it minus a configurable rewind offset.

**Architecture:** Static site, no build step. `helpers.js` (pure functions) and `store.js` (localStorage-backed state) are dependency-injected/plain modules testable with `node --test`; `app.js` wires them to the DOM and the YouTube IFrame Player API. Spec: `docs/superpowers/specs/2026-07-13-listenpractice-design.md`.

**Tech Stack:** Vanilla HTML/CSS/JS, YouTube IFrame Player API, YouTube oEmbed (titles), Node built-in test runner (`node --test`) for unit tests.

## Global Constraints

- No dependencies, no package.json, no build step (spec: "Files").
- localStorage key is exactly `listenpractice:v1` (spec: "Data model").
- Default rewind offset: 3 seconds; must be ≥ 0 (spec: "Settings").
- Duplicate timestamp guard: skip if within 0.5 s of an existing entry (spec: "Recording timestamps").
- Scripts are classic (non-module) `<script>` tags; node testability comes from a `module.exports` guard at the bottom of testable files.
- Serve with `python3 -m http.server 8787` from the repo root; the IFrame API does not work from `file://`.

---

### Task 1: Pure helpers (`parseYouTubeUrl`, `formatTime`)

**Files:**
- Create: `helpers.js`
- Test: `tests/helpers.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces: `parseYouTubeUrl(url: string) -> string|null` (11-char video ID or null); `formatTime(seconds: number) -> string` (`"m:ss"` or `"h:mm:ss"`). Both attached as browser globals and exported via `module.exports` for node.

- [ ] **Step 1: Write the failing test**

Create `tests/helpers.test.js`:

```js
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const { parseYouTubeUrl, formatTime } = require("../helpers.js");

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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/`
Expected: FAIL — `Cannot find module '../helpers.js'`

- [ ] **Step 3: Write minimal implementation**

Create `helpers.js`:

```js
"use strict";

// Extracts the 11-character YouTube video ID from common URL forms, or null.
function parseYouTubeUrl(url) {
  let u;
  try {
    u = new URL(String(url).trim());
  } catch {
    return null;
  }
  const host = u.hostname.replace(/^(www\.|m\.)/, "");
  const idPattern = /^[A-Za-z0-9_-]{11}$/;
  let candidate = null;
  if (host === "youtu.be") {
    candidate = u.pathname.split("/")[1] || "";
  } else if (host === "youtube.com") {
    const parts = u.pathname.split("/").filter(Boolean);
    if (u.pathname === "/watch") {
      candidate = u.searchParams.get("v") || "";
    } else if (parts.length === 2 && (parts[0] === "shorts" || parts[0] === "embed" || parts[0] === "live")) {
      candidate = parts[1];
    }
  }
  return candidate && idPattern.test(candidate) ? candidate : null;
}

// 65.7 -> "1:05"; 3725.2 -> "1:02:05"
function formatTime(seconds) {
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const ss = String(total % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { parseYouTubeUrl, formatTime };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/`
Expected: PASS — all tests, 0 failures.

- [ ] **Step 5: Commit**

```bash
git add helpers.js tests/helpers.test.js
git commit -m "feat: add URL parsing and time formatting helpers"
```

---

### Task 2: localStorage-backed store (`store.js`)

**Files:**
- Create: `store.js`
- Test: `tests/store.test.js`

**Interfaces:**
- Consumes: a `storage` object with `getItem(key)`/`setItem(key, value)` (browser `localStorage` or a test fake).
- Produces: `createStore(storage)` returning:
  - `state` (getter) → `{ settings: { rewindSeconds: number }, lastVideoId: string|null, videos: { [id]: { title, timestamps: number[], folded: boolean, updatedAt: string } } }`
  - `getVideo(videoId) -> video|null`
  - `setLastVideo(videoId)` — also creates the video record if missing
  - `setTitle(videoId, title)`
  - `addTimestamp(videoId, seconds) -> boolean` — false if within 0.5 s of an existing entry; keeps `timestamps` sorted ascending
  - `deleteTimestamp(videoId, seconds)`
  - `setFolded(videoId, folded)`
  - `setRewindSeconds(n)`
  - `STORAGE_KEY` constant `"listenpractice:v1"`

- [ ] **Step 1: Write the failing test**

Create `tests/store.test.js`:

```js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/`
Expected: FAIL — `Cannot find module '../store.js'` (helpers tests still pass).

- [ ] **Step 3: Write minimal implementation**

Create `store.js`:

```js
"use strict";

const STORAGE_KEY = "listenpractice:v1";

// storage: anything with getItem/setItem (localStorage in the browser, a fake in tests)
function createStore(storage) {
  let state;
  try {
    const raw = storage.getItem(STORAGE_KEY);
    state = raw ? JSON.parse(raw) : null;
  } catch {
    state = null;
  }
  if (!state || typeof state !== "object" || !state.settings || !state.videos) {
    state = { settings: { rewindSeconds: 3 }, lastVideoId: null, videos: {} };
  }

  function save() {
    storage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function ensureVideo(videoId) {
    if (!state.videos[videoId]) {
      state.videos[videoId] = {
        title: videoId,
        timestamps: [],
        folded: false,
        updatedAt: new Date().toISOString(),
      };
    }
    return state.videos[videoId];
  }

  return {
    get state() {
      return state;
    },
    getVideo(videoId) {
      return state.videos[videoId] || null;
    },
    setLastVideo(videoId) {
      state.lastVideoId = videoId;
      ensureVideo(videoId);
      save();
    },
    setTitle(videoId, title) {
      ensureVideo(videoId).title = title;
      save();
    },
    addTimestamp(videoId, seconds) {
      const video = ensureVideo(videoId);
      if (video.timestamps.some((t) => Math.abs(t - seconds) < 0.5)) return false;
      video.timestamps.push(seconds);
      video.timestamps.sort((a, b) => a - b);
      video.updatedAt = new Date().toISOString();
      save();
      return true;
    },
    deleteTimestamp(videoId, seconds) {
      const video = ensureVideo(videoId);
      video.timestamps = video.timestamps.filter((t) => t !== seconds);
      save();
    },
    setFolded(videoId, folded) {
      ensureVideo(videoId).folded = folded;
      save();
    },
    setRewindSeconds(n) {
      state.settings.rewindSeconds = n;
      save();
    },
  };
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { createStore, STORAGE_KEY };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/`
Expected: PASS — all helpers + store tests, 0 failures.

- [ ] **Step 5: Commit**

```bash
git add store.js tests/store.test.js
git commit -m "feat: add localStorage-backed timestamp store"
```

---

### Task 3: Page skeleton (`index.html`, `style.css`)

**Files:**
- Create: `index.html`
- Create: `style.css`

**Interfaces:**
- Consumes: `helpers.js`, `store.js` (script tags; `app.js` added here too and created in Task 4).
- Produces: DOM element IDs that `app.js` relies on: `load-form`, `url-input`, `error`, `video-title`, `fold-toggle`, `timestamp-list`, `empty-hint`, `player`, `mark-btn`, `offset-input`.

- [ ] **Step 1: Create `index.html`**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>ListenPractice</title>
  <link rel="stylesheet" href="style.css" />
</head>
<body>
  <aside id="sidebar">
    <div id="sidebar-header">
      <button id="fold-toggle" title="Fold/unfold list">▾</button>
      <h2 id="video-title">No video loaded</h2>
    </div>
    <ul id="timestamp-list"></ul>
    <p id="empty-hint">Press SPACE while the video plays to mark a moment.</p>
  </aside>
  <main>
    <form id="load-form">
      <input id="url-input" type="text" placeholder="Paste a YouTube URL…" autocomplete="off" />
      <button type="submit">Load</button>
    </form>
    <p id="error" hidden></p>
    <div id="player-wrap"><div id="player"></div></div>
    <div id="controls">
      <button id="mark-btn" type="button">⏺ Mark (Space)</button>
      <label>Rewind offset
        <input id="offset-input" type="number" min="0" step="1" value="3" />
        seconds
      </label>
    </div>
  </main>
  <script src="helpers.js"></script>
  <script src="store.js"></script>
  <script src="app.js"></script>
  <script src="https://www.youtube.com/iframe_api" async></script>
</body>
</html>
```

Note: `app.js` doesn't exist yet — the browser logs a 404 for it, which is fine for this task; it's created in Task 4. The IFrame API script is loaded last so `onYouTubeIframeAPIReady` (defined in `app.js`) exists when the API calls it.

- [ ] **Step 2: Create `style.css`**

```css
* { box-sizing: border-box; }

body {
  margin: 0;
  font-family: system-ui, -apple-system, sans-serif;
  display: flex;
  height: 100vh;
  background: #f5f5f7;
  color: #1d1d1f;
}

#sidebar {
  width: 280px;
  flex-shrink: 0;
  border-right: 1px solid #ddd;
  background: #fff;
  overflow-y: auto;
  padding: 12px;
}

#sidebar-header { display: flex; align-items: flex-start; gap: 6px; }
#fold-toggle { border: none; background: none; cursor: pointer; font-size: 14px; padding: 4px 2px; }
#video-title { font-size: 15px; margin: 2px 0 0; line-height: 1.3; font-weight: 600; }

#timestamp-list { list-style: none; margin: 12px 0; padding: 0; }
#timestamp-list li { display: flex; align-items: center; }

.jump {
  flex: 1;
  text-align: left;
  border: none;
  background: none;
  cursor: pointer;
  font-size: 15px;
  font-variant-numeric: tabular-nums;
  padding: 6px 8px;
  border-radius: 6px;
}
.jump:hover { background: #e8f0fe; color: #1a73e8; }

.delete { border: none; background: none; cursor: pointer; color: #999; font-size: 16px; padding: 4px 8px; }
.delete:hover { color: #d33; }

#empty-hint { color: #888; font-size: 13px; }

main {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 16px;
  gap: 12px;
  min-width: 0;
}

#load-form { display: flex; gap: 8px; }
#url-input { flex: 1; padding: 10px 12px; border: 1px solid #ccc; border-radius: 8px; font-size: 14px; }

#load-form button,
#mark-btn {
  padding: 10px 16px;
  border: none;
  border-radius: 8px;
  background: #1a73e8;
  color: #fff;
  font-size: 14px;
  cursor: pointer;
}
#mark-btn { background: #d93025; }

#error { color: #d33; margin: 0; }

#player-wrap { flex: 1; background: #000; border-radius: 12px; overflow: hidden; min-height: 0; }
#player-wrap iframe, #player { width: 100%; height: 100%; display: block; }

#controls { display: flex; align-items: center; gap: 16px; }
#controls label { display: flex; align-items: center; gap: 6px; font-size: 14px; }
#offset-input { width: 64px; padding: 8px; border: 1px solid #ccc; border-radius: 6px; }
```

- [ ] **Step 3: Verify the layout renders**

Run: `python3 -m http.server 8787` (background) from the repo root, open `http://localhost:8787` in Chrome.
Expected: sidebar on the left with "No video loaded" + hint text; main area with URL input, Load button, black player area, Mark button, and the rewind-offset input showing 3. (A 404 for `app.js` in the console is expected until Task 4.)

- [ ] **Step 4: Commit**

```bash
git add index.html style.css
git commit -m "feat: add page skeleton and styling"
```

---

### Task 4: App wiring (`app.js`)

**Files:**
- Create: `app.js`

**Interfaces:**
- Consumes: globals `parseYouTubeUrl`, `formatTime` (helpers.js); `createStore` (store.js); DOM IDs from Task 3; `YT.Player` from the IFrame API.
- Produces: `window.onYouTubeIframeAPIReady` (called by the YouTube API script).

- [ ] **Step 1: Create `app.js`**

```js
"use strict";

const store = createStore(window.localStorage);

const els = {
  form: document.getElementById("load-form"),
  urlInput: document.getElementById("url-input"),
  error: document.getElementById("error"),
  title: document.getElementById("video-title"),
  foldToggle: document.getElementById("fold-toggle"),
  list: document.getElementById("timestamp-list"),
  emptyHint: document.getElementById("empty-hint"),
  markBtn: document.getElementById("mark-btn"),
  offsetInput: document.getElementById("offset-input"),
};

let player = null;
let playerReady = false;
let currentVideoId = store.state.lastVideoId;

els.offsetInput.value = store.state.settings.rewindSeconds;

function showError(msg) {
  els.error.textContent = msg;
  els.error.hidden = !msg;
}

function renderList() {
  const video = currentVideoId ? store.getVideo(currentVideoId) : null;
  els.title.textContent = video ? video.title : "No video loaded";
  const folded = video ? video.folded : false;
  els.foldToggle.textContent = folded ? "▸" : "▾";
  els.list.hidden = folded;
  els.list.innerHTML = "";
  const timestamps = video ? video.timestamps : [];
  els.emptyHint.hidden = folded || timestamps.length > 0;
  for (const t of timestamps) {
    const li = document.createElement("li");
    const jump = document.createElement("button");
    jump.className = "jump";
    jump.textContent = formatTime(t);
    jump.addEventListener("click", () => {
      if (!playerReady) return;
      player.seekTo(Math.max(0, t - store.state.settings.rewindSeconds), true);
      player.playVideo();
    });
    const del = document.createElement("button");
    del.className = "delete";
    del.textContent = "×";
    del.title = "Delete this timestamp";
    del.addEventListener("click", () => {
      store.deleteTimestamp(currentVideoId, t);
      renderList();
    });
    li.append(jump, del);
    els.list.appendChild(li);
  }
}

function fetchTitle(videoId) {
  const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
  fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(watchUrl)}&format=json`)
    .then((r) => (r.ok ? r.json() : null))
    .then((data) => {
      if (data && data.title) {
        store.setTitle(videoId, data.title);
        if (videoId === currentVideoId) renderList();
      }
    })
    .catch(() => {});
}

function loadVideo(videoId) {
  currentVideoId = videoId;
  store.setLastVideo(videoId);
  showError("");
  if (playerReady) player.cueVideoById(videoId);
  fetchTitle(videoId);
  renderList();
}

function mark() {
  if (!playerReady || !currentVideoId) return;
  if (store.addTimestamp(currentVideoId, player.getCurrentTime())) renderList();
}

els.form.addEventListener("submit", (e) => {
  e.preventDefault();
  const videoId = parseYouTubeUrl(els.urlInput.value);
  if (!videoId) {
    showError("That doesn't look like a YouTube video URL.");
    return;
  }
  loadVideo(videoId);
  els.urlInput.blur();
});

document.addEventListener("keydown", (e) => {
  if (e.code !== "Space") return;
  const t = e.target;
  if (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable) return;
  e.preventDefault();
  mark();
});

els.markBtn.addEventListener("click", () => {
  mark();
  els.markBtn.blur();
});

els.foldToggle.addEventListener("click", () => {
  if (!currentVideoId) return;
  store.setFolded(currentVideoId, !store.getVideo(currentVideoId).folded);
  renderList();
});

els.offsetInput.addEventListener("change", () => {
  const n = Math.max(0, Number(els.offsetInput.value) || 0);
  els.offsetInput.value = n;
  store.setRewindSeconds(n);
  els.offsetInput.blur();
});

window.onYouTubeIframeAPIReady = function () {
  player = new YT.Player("player", {
    width: "100%",
    height: "100%",
    playerVars: { rel: 0 },
    events: {
      onReady: () => {
        playerReady = true;
        if (currentVideoId) player.cueVideoById(currentVideoId);
      },
      onStateChange: () => {
        // After clicking inside the YouTube iframe, keyboard focus belongs to
        // YouTube and SPACE toggles play/pause there. Pull focus back so our
        // SPACE listener works again.
        if (document.activeElement instanceof HTMLIFrameElement) {
          document.activeElement.blur();
          window.focus();
        }
      },
      onError: () => {
        showError("This video can't be played here (removed, private, or embedding disabled).");
      },
    },
  });
};

renderList();
```

- [ ] **Step 2: Run unit tests still pass**

Run: `node --test tests/`
Expected: PASS — app.js is browser-only and not loaded by node; helpers/store tests unaffected.

- [ ] **Step 3: Smoke-test in Chrome**

With `python3 -m http.server 8787` running, open `http://localhost:8787`:
1. Paste `https://www.youtube.com/watch?v=jNQXAC9IVRw` ("Me at the zoo"), click Load → player shows the video; sidebar title updates to the real title shortly after.
2. Play the video, press SPACE twice a few seconds apart → two entries appear in the sidebar, sorted, formatted `m:ss`.
3. Click the first entry → playback jumps to (timestamp − 3 s) and plays.
4. Click × on an entry → it disappears.
5. Click ▾ → list folds (▸ shown); click again → unfolds.
6. Change offset to 5, click a timestamp → jumps to (timestamp − 5 s).
7. Reload the page → same video and list restored.
8. Paste an invalid URL → inline error, player unchanged.

Expected: all 8 behaviors work; no uncaught errors in the console.

- [ ] **Step 4: Commit**

```bash
git add app.js
git commit -m "feat: wire player, SPACE capture, timestamp list, and settings"
```

---

### Task 5: README and final verification

**Files:**
- Create: `README.md`

**Interfaces:**
- Consumes: everything above.
- Produces: user-facing run instructions.

- [ ] **Step 1: Create `README.md`**

```markdown
# ListenPractice

Practice listening with YouTube videos: bookmark moments with SPACE, click a
bookmark to replay from a few seconds before it.

## Run

```sh
python3 -m http.server 8787
```

Open http://localhost:8787 (the YouTube player API doesn't work from `file://`).

## Use

1. Paste a YouTube URL and click **Load**.
2. While listening, press **SPACE** (or click **⏺ Mark**) to record the current time.
3. Click a timestamp in the left list to jump back to it minus the **rewind
   offset** (configurable, default 3 s). Click **×** to delete an entry.
4. The ▾ button folds/unfolds the list. Each video keeps its own list, stored
   in your browser's localStorage — reloading a video's URL restores it.

Note: if you clicked inside the video itself, YouTube owns the keyboard for a
moment and SPACE toggles play/pause; the app reclaims focus on the next
play/pause, or just use the **⏺ Mark** button.

## Tests

```sh
node --test tests/
```
```

- [ ] **Step 2: Run full verification**

Run: `node --test tests/`
Expected: PASS, 0 failures.

Re-run the 8-step Chrome smoke test from Task 4 Step 3 if any file changed since it last passed.

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: add README with run and usage instructions"
```
