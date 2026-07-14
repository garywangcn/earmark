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
