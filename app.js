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
};

let player = null;
let playerReady = false;
let currentVideoId = store.state.lastVideoId;
const transcripts = {}; // videoId -> snippets, fetched from server.py

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
    const snippet = findSnippet(transcripts[videoId], t);
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

function fetchTranscript(videoId) {
  if (transcripts[videoId]) return;
  fetch(`/transcript?v=${videoId}`)
    .then((r) => (r.ok ? r.json() : null))
    .then((data) => {
      if (data && data.available) {
        transcripts[videoId] = data.snippets;
        renderList();
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
