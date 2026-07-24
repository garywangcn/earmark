"use strict";

const store = createStore(window.localStorage);

const els = {
  playerFrame: document.getElementById("player"),
  form: document.getElementById("load-form"),
  urlInput: document.getElementById("url-input"),
  error: document.getElementById("error"),
  groups: document.getElementById("video-groups"),
  emptyHint: document.getElementById("empty-hint"),
  markBtn: document.getElementById("mark-btn"),
  offsetInput: document.getElementById("offset-input"),
  translateSelect: document.getElementById("translate-select"),
  exportBtn: document.getElementById("export-btn"),
  importBtn: document.getElementById("import-btn"),
  importFile: document.getElementById("import-file"),
};

let currentVideoId = store.state.lastVideoId;
const transcripts = {}; // videoId -> snippets, fetched via the extension
const translations = {}; // videoId -> translated snippets (per settings.translateTo)

// True when running as the extension's own app page (chrome-extension://…),
// where the background worker is reachable directly.
const IS_EXTENSION_PAGE =
  typeof chrome !== "undefined" &&
  !!(chrome.runtime && chrome.runtime.id) &&
  window.location.protocol === "chrome-extension:";

const player = createPlayerController(els.playerFrame, {
  onStateChange: () => {
    // After clicking inside the YouTube iframe, keyboard focus belongs to
    // YouTube and SPACE toggles play/pause there. Pull focus back so our
    // SPACE listener works again.
    if (document.activeElement instanceof HTMLIFrameElement) {
      document.activeElement.blur();
      window.focus();
    }
  },
  onError: (code) => {
    showError(`This video can't be played here (removed, private, or embedding disabled — error ${code}).`);
  },
});

els.offsetInput.value = store.state.settings.rewindSeconds;
els.translateSelect.value = store.state.settings.translateTo;

function showError(msg) {
  els.error.textContent = msg;
  els.error.hidden = !msg;
}

function jumpTo(videoId, t) {
  const target = Math.max(0, t - store.state.settings.rewindSeconds);
  if (videoId === currentVideoId) {
    if (!player.hasVideo) return;
    player.seekTo(target);
    player.play();
  } else {
    currentVideoId = videoId;
    store.setLastVideo(videoId);
    showError("");
    fetchTranscript(videoId);
    player.load(videoId, target);
    renderList();
  }
}

function renderTimestamps(videoId, video) {
  const ul = document.createElement("ul");
  ul.className = "timestamps";
  for (const t of video.timestamps) {
    const li = document.createElement("li");
    const jump = document.createElement("button");
    jump.className = "jump";
    const time = document.createElement("span");
    time.className = "time";
    time.textContent = formatTime(t);
    jump.appendChild(time);
    // Show everything spoken in the replay window: (mark − rewind offset) → mark.
    const from = Math.max(0, t - store.state.settings.rewindSeconds);
    const matched = findSnippetsInRange(snippetsFor(videoId), from, t);
    if (matched.length > 0) {
      const joined = matched.map((s) => s.text).join(" ").replace(/\s+/g, " ");
      const texts = document.createElement("span");
      texts.className = "texts";
      const text = document.createElement("span");
      text.className = "snippet";
      text.textContent = joined;
      texts.appendChild(text);
      const matchedT = findSnippetsInRange(translations[videoId], from, t);
      if (matchedT.length > 0) {
        const tjoined = matchedT.map((s) => s.text).join(" ").replace(/\s+/g, " ");
        const translation = document.createElement("span");
        translation.className = "translation";
        translation.textContent = tjoined;
        texts.appendChild(translation);
      }
      jump.appendChild(texts);
      jump.title = joined;
    }
    jump.addEventListener("click", () => {
      // A click that ends a text selection shouldn't seek.
      if (window.getSelection().toString()) return;
      jumpTo(videoId, t);
    });
    const del = document.createElement("button");
    del.className = "delete";
    del.textContent = "×";
    del.title = "Delete this timestamp";
    del.addEventListener("click", () => {
      store.deleteTimestamp(videoId, t);
      renderList();
    });
    li.append(jump, del);
    ul.appendChild(li);
  }
  return ul;
}

function renderList() {
  els.groups.innerHTML = "";
  const videos = Object.entries(store.state.videos).sort((a, b) =>
    (b[1].updatedAt || "").localeCompare(a[1].updatedAt || "")
  );
  els.emptyHint.hidden = videos.length > 0;
  for (const [videoId, video] of videos) {
    const section = document.createElement("section");
    section.className = "video-group" + (videoId === currentVideoId ? " current" : "");
    const header = document.createElement("div");
    header.className = "group-header";
    const fold = document.createElement("button");
    fold.className = "fold";
    fold.textContent = video.folded ? "▸" : "▾";
    fold.title = "Fold/unfold list";
    fold.addEventListener("click", () => {
      store.setFolded(videoId, !video.folded);
      renderList();
    });
    const title = document.createElement("button");
    title.className = "group-title";
    title.textContent = video.title;
    title.title = video.title;
    title.addEventListener("click", () => {
      if (window.getSelection().toString()) return;
      if (videoId !== currentVideoId) loadVideo(videoId);
    });
    const delVideo = document.createElement("button");
    delVideo.className = "delete";
    delVideo.textContent = "×";
    delVideo.title = "Remove this video and its timestamps";
    delVideo.addEventListener("click", () => {
      store.deleteVideo(videoId);
      renderList();
    });
    header.append(fold, title, delVideo);
    section.appendChild(header);
    if (!video.folded) section.appendChild(renderTimestamps(videoId, video));
    els.groups.appendChild(section);
  }
}

function fetchTitle(videoId) {
  const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
  fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(watchUrl)}&format=json`)
    .then((r) => (r.ok ? r.json() : null))
    .then((data) => {
      if (data && data.title) {
        store.setTitle(videoId, data.title);
        renderList();
      }
    })
    .catch(() => {});
}

// Pasted transcripts (persisted with the video) win over server-fetched ones.
function snippetsFor(videoId) {
  const video = store.getVideo(videoId);
  return (video && video.transcript) || transcripts[videoId] || null;
}

// Transcripts come from the extension's background worker, which can fetch
// YouTube captions without CORS restrictions. On the extension app page it is
// messaged directly; on the website the content script relays a postMessage.
// Fails silently (extension missing/no captions) — pasted transcripts
// (Transcript button) are the fallback.
function receiveSnippets(videoId, snippets, translated) {
  let changed = false;
  if (Array.isArray(snippets) && snippets.length > 0 && !snippetsFor(videoId)) {
    transcripts[videoId] = snippets;
    changed = true;
  }
  if (Array.isArray(translated) && translated.length > 0 && !translations[videoId]) {
    translations[videoId] = translated;
    changed = true;
  }
  if (changed) renderList();
}

function fetchTranscript(videoId) {
  const wantTranslation = !!store.state.settings.translateTo && !translations[videoId];
  if (snippetsFor(videoId) && !wantTranslation) return;
  const tlang = store.state.settings.translateTo;
  if (IS_EXTENSION_PAGE) {
    chrome.runtime.sendMessage({ videoId, tlang }, (response) => {
      void chrome.runtime.lastError;
      receiveSnippets(videoId, response && response.snippets, response && response.translated);
    });
    return;
  }
  const onMessage = (event) => {
    const msg = event.data;
    if (event.source !== window || !msg) return;
    if (msg.type !== "earmark-transcript-response" || msg.videoId !== videoId) return;
    window.removeEventListener("message", onMessage);
    clearTimeout(timer);
    receiveSnippets(videoId, msg.snippets, msg.translated);
  };
  const timer = setTimeout(() => window.removeEventListener("message", onMessage), 10000);
  window.addEventListener("message", onMessage);
  window.postMessage({ type: "earmark-transcript-request", videoId, tlang }, window.location.origin);
}

function loadVideo(videoId) {
  currentVideoId = videoId;
  store.setLastVideo(videoId);
  showError("");
  player.cue(videoId);
  fetchTitle(videoId);
  fetchTranscript(videoId);
  renderList();
}

function mark() {
  if (!player.hasVideo || !currentVideoId) return;
  if (store.addTimestamp(currentVideoId, player.currentTime)) renderList();
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

els.offsetInput.addEventListener("change", () => {
  const n = Math.max(0, Number(els.offsetInput.value) || 0);
  els.offsetInput.value = n;
  store.setRewindSeconds(n);
  els.offsetInput.blur();
  renderList(); // displayed subtitle ranges depend on the offset
});

els.translateSelect.addEventListener("change", () => {
  store.setTranslateTo(els.translateSelect.value);
  for (const videoId of Object.keys(translations)) delete translations[videoId];
  renderList();
  if (store.state.settings.translateTo) {
    for (const [videoId, video] of Object.entries(store.state.videos)) {
      if (videoId === currentVideoId || video.timestamps.length > 0) fetchTranscript(videoId);
    }
  }
});

els.exportBtn.addEventListener("click", () => {
  const payload = {
    app: "earmark",
    version: 1,
    exportedAt: new Date().toISOString(),
    videos: store.state.videos,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `earmark-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
});

function importData(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    showError("Import failed: that file isn't valid JSON.");
    return;
  }
  if (!data || typeof data !== "object" || !data.videos || typeof data.videos !== "object") {
    showError("Import failed: not an EarMark export file.");
    return;
  }
  store.mergeVideos(data.videos);
  showError("");
  for (const [videoId, video] of Object.entries(store.state.videos)) {
    if (video.timestamps.length > 0) fetchTranscript(videoId);
  }
  renderList();
}

els.importBtn.addEventListener("click", () => els.importFile.click());
els.importFile.addEventListener("change", () => {
  const file = els.importFile.files[0];
  if (!file) return;
  file.text().then(importData);
  els.importFile.value = "";
});

if (currentVideoId) player.cue(currentVideoId);
for (const [videoId, video] of Object.entries(store.state.videos)) {
  if (videoId === currentVideoId || video.timestamps.length > 0) fetchTranscript(videoId);
}
renderList();
