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
