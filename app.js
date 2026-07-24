"use strict";

const store = createStore(window.localStorage);

const els = {
  form: document.getElementById("load-form"),
  urlInput: document.getElementById("url-input"),
  error: document.getElementById("error"),
  groups: document.getElementById("video-groups"),
  emptyHint: document.getElementById("empty-hint"),
  markBtn: document.getElementById("mark-btn"),
  offsetInput: document.getElementById("offset-input"),
  exportBtn: document.getElementById("export-btn"),
  importBtn: document.getElementById("import-btn"),
  importFile: document.getElementById("import-file"),
  pasteBtn: document.getElementById("paste-btn"),
  pastePanel: document.getElementById("paste-panel"),
  pasteText: document.getElementById("paste-text"),
  pasteSave: document.getElementById("paste-save"),
  pasteCancel: document.getElementById("paste-cancel"),
};

let player = null;
let playerReady = false;
let currentVideoId = store.state.lastVideoId;
const transcripts = {}; // videoId -> snippets, fetched from server.py

// Marks are usually pressed shortly AFTER the interesting sentence ends, so
// match subtitles against a slightly earlier time to show the sentence the
// user actually reacted to rather than the one that just started.
const REACTION_LAG = 1.0;

els.offsetInput.value = store.state.settings.rewindSeconds;

function showError(msg) {
  els.error.textContent = msg;
  els.error.hidden = !msg;
}

function jumpTo(videoId, t) {
  const target = Math.max(0, t - store.state.settings.rewindSeconds);
  if (videoId === currentVideoId) {
    if (!playerReady) return;
    player.seekTo(target, true);
    player.playVideo();
  } else {
    currentVideoId = videoId;
    store.setLastVideo(videoId);
    showError("");
    fetchTranscript(videoId);
    if (playerReady) player.loadVideoById(videoId, target);
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
    const snippet = findSnippet(snippetsFor(videoId), t - REACTION_LAG);
    if (snippet) {
      const text = document.createElement("span");
      text.className = "snippet";
      text.textContent = snippet.text.replace(/\s+/g, " ");
      jump.appendChild(text);
      jump.title = snippet.text;
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

// Transcripts come from the EarMark Transcripts browser extension (extension/
// in the repo): the page posts a request, the extension's content script
// relays it to a background worker that can fetch YouTube captions without
// CORS restrictions. Times out silently when the extension isn't installed —
// pasted transcripts (Transcript button) are the fallback.
function fetchTranscript(videoId) {
  if (snippetsFor(videoId)) return;
  const onMessage = (event) => {
    const msg = event.data;
    if (event.source !== window || !msg) return;
    if (msg.type !== "earmark-transcript-response" || msg.videoId !== videoId) return;
    window.removeEventListener("message", onMessage);
    clearTimeout(timer);
    if (Array.isArray(msg.snippets) && msg.snippets.length > 0 && !snippetsFor(videoId)) {
      transcripts[videoId] = msg.snippets;
      renderList();
    }
  };
  const timer = setTimeout(() => window.removeEventListener("message", onMessage), 10000);
  window.addEventListener("message", onMessage);
  window.postMessage({ type: "earmark-transcript-request", videoId }, window.location.origin);
}

function loadVideo(videoId) {
  currentVideoId = videoId;
  store.setLastVideo(videoId);
  showError("");
  if (playerReady) player.cueVideoById(videoId);
  fetchTitle(videoId);
  fetchTranscript(videoId);
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

els.offsetInput.addEventListener("change", () => {
  const n = Math.max(0, Number(els.offsetInput.value) || 0);
  els.offsetInput.value = n;
  store.setRewindSeconds(n);
  els.offsetInput.blur();
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

els.pasteBtn.addEventListener("click", () => {
  if (!currentVideoId) {
    showError("Load a video first, then paste its transcript.");
    return;
  }
  showError("");
  els.pastePanel.hidden = !els.pastePanel.hidden;
  if (!els.pastePanel.hidden) els.pasteText.focus();
});

els.pasteCancel.addEventListener("click", () => {
  els.pastePanel.hidden = true;
  els.pasteText.value = "";
});

els.pasteSave.addEventListener("click", () => {
  const snippets = parseTranscriptText(els.pasteText.value);
  if (snippets.length === 0) {
    showError('No "0:12"-style lines found — copy the text from YouTube\'s Show transcript panel.');
    return;
  }
  store.setTranscript(currentVideoId, snippets);
  els.pastePanel.hidden = true;
  els.pasteText.value = "";
  showError("");
  renderList();
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

for (const [videoId, video] of Object.entries(store.state.videos)) {
  if (videoId === currentVideoId || video.timestamps.length > 0) fetchTranscript(videoId);
}
renderList();
